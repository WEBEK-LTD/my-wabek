import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { uploadMediaBuffer } from '@/lib/media-storage'
import Busboy from 'busboy'

export const config = { api: { bodyParser: false } }

const MAX_BYTES = 16 * 1024 * 1024 // 16MB — matches WhatsApp's own limits

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const user = await requireAuth(req, res)
  if (!user) return

  try {
    const { buffer, mimeType, filename } = await parseUpload(req)
    if (!buffer || !buffer.length) return res.status(400).json({ error: 'file required' })
    if (buffer.length > MAX_BYTES) return res.status(413).json({ error: 'File too large (max 16MB)' })

    const uploaded = await uploadMediaBuffer(buffer, { userId: user.userId, mimeType, filename })
    if (!uploaded) return res.status(500).json({ error: 'Upload failed' })

    return res.status(200).json({
      url: uploaded.url,
      mimeType,
      filename,
      sizeBytes: buffer.length,
    })
  } catch (err: any) {
    console.error('[chat-upload] error:', err?.message)
    return res.status(500).json({ error: err?.message || 'Upload failed' })
  }
}

function parseUpload(req: NextApiRequest): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
  return new Promise((resolve, reject) => {
    const bb = Busboy({ headers: req.headers, limits: { fileSize: MAX_BYTES } })
    let mimeType = 'application/octet-stream'
    let filename = 'file'
    const chunks: Buffer[] = []
    let gotFile = false

    bb.on('file', (_name, stream, info) => {
      gotFile = true
      mimeType = info.mimeType || mimeType
      filename = info.filename || filename
      stream.on('data', (d: Buffer) => chunks.push(d))
      stream.on('limit', () => reject(new Error('File too large (max 16MB)')))
    })
    bb.on('error', reject)
    bb.on('finish', () => {
      if (!gotFile) return reject(new Error('No file in upload'))
      resolve({ buffer: Buffer.concat(chunks), mimeType, filename })
    })
    req.pipe(bb)
  })
}
