import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import {
  uploadMediaBuffer, isAllowedMime, contentMatchesMime, maxBytesForMime, baseMime,
  sanitizeDisplayFilename, MAX_DOCUMENT_BYTES,
} from '@/lib/media-storage'
import Busboy from 'busboy'

export const config = { api: { bodyParser: false } }

class UploadError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const user = await requireAuth(req, res)
  if (!user) return

  try {
    const { buffer, mimeType: declared, filename } = await parseUpload(req)
    if (!buffer || !buffer.length) return res.status(400).json({ error: 'file required' })

    const mimeType = baseMime(declared)
    if (!isAllowedMime(mimeType)) {
      return res.status(415).json({ error: 'File type not supported. Allowed: images (jpg, png, webp, gif), video (mp4, 3gp), audio (ogg, mp3, aac, m4a, amr), PDF, Office documents, plain text.' })
    }
    const max = maxBytesForMime(mimeType)
    if (buffer.length > max) return res.status(413).json({ error: `File too large (max ${Math.round(max / 1024 / 1024)}MB)` })
    if (!contentMatchesMime(buffer, mimeType)) {
      return res.status(415).json({ error: 'File content does not match its type' })
    }

    const uploaded = await uploadMediaBuffer(buffer, { userId: user.userId, mimeType, strict: true })
    if (!uploaded) return res.status(500).json({ error: 'Upload failed' })

    return res.status(200).json({
      url: uploaded.url,
      mimeType: uploaded.mimeType,
      // Display name only (e.g. WhatsApp document filename) — never used in storage paths
      filename: sanitizeDisplayFilename(filename),
      sizeBytes: buffer.length,
    })
  } catch (err: any) {
    if (err instanceof UploadError) return res.status(err.status).json({ error: err.message })
    console.error('[chat-upload] error:', err?.message)
    return res.status(500).json({ error: 'Upload failed' })
  }
}

function parseUpload(req: NextApiRequest): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
  return new Promise((resolve, reject) => {
    let bb: ReturnType<typeof Busboy>
    try {
      bb = Busboy({ headers: req.headers, limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1 } })
    } catch {
      return reject(new UploadError(400, 'Expected multipart/form-data'))
    }
    let mimeType = 'application/octet-stream'
    let filename = 'file'
    const chunks: Buffer[] = []
    let gotFile = false

    bb.on('file', (_name, stream, info) => {
      if (gotFile) { stream.resume(); return }
      gotFile = true
      mimeType = info.mimeType || mimeType
      filename = info.filename || filename
      stream.on('data', (d: Buffer) => chunks.push(d))
      stream.on('limit', () => reject(new UploadError(413, `File too large (max ${MAX_DOCUMENT_BYTES / 1024 / 1024}MB)`)))
    })
    bb.on('error', () => reject(new UploadError(400, 'Malformed upload')))
    bb.on('finish', () => {
      if (!gotFile) return reject(new UploadError(400, 'No file in upload'))
      resolve({ buffer: Buffer.concat(chunks), mimeType, filename })
    })
    req.pipe(bb)
  })
}
