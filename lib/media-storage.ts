// Shared media storage helper for /dashboard/chat attachments.
// Used for: (1) re-hosting inbound Cloud API media (Meta URLs expire in
// minutes), (2) hosting outbound files uploaded by an admin before sending.
//
// Isolated module — any failure here must never break text message
// send/receive. Callers should wrap usage in try/catch and fall back
// gracefully (e.g. store "[image]" placeholder content) on failure.

import { supabaseAdmin } from './supabase'

const BUCKET = 'wa-media'
let bucketEnsured = false

async function ensureBucket(): Promise<void> {
  if (bucketEnsured) return
  try {
    const db = supabaseAdmin()
    const { data: buckets } = await db.storage.listBuckets()
    const exists = buckets?.some(b => b.name === BUCKET)
    if (!exists) {
      await db.storage.createBucket(BUCKET, { public: true, fileSizeLimit: '16MB' })
    }
    bucketEnsured = true
  } catch (err) {
    // Non-fatal — upload will simply fail and caller handles it
    console.error('[media-storage] ensureBucket failed:', err instanceof Error ? err.message : err)
  }
}

export interface UploadResult {
  url: string
  path: string
}

/**
 * Upload a buffer to permanent storage and return its public URL.
 * Returns null on any failure (caller must handle gracefully).
 */
export async function uploadMediaBuffer(
  buffer: Buffer,
  opts: { userId: string; mimeType: string; filename?: string }
): Promise<UploadResult | null> {
  try {
    await ensureBucket()
    const db = supabaseAdmin()

    const ext = (opts.filename?.split('.').pop() || extFromMime(opts.mimeType) || 'bin').toLowerCase()
    const path = `${opts.userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const { error } = await db.storage.from(BUCKET).upload(path, buffer, {
      contentType: opts.mimeType,
      upsert: false,
    })
    if (error) {
      console.error('[media-storage] upload failed:', error.message)
      return null
    }

    const { data: pub } = db.storage.from(BUCKET).getPublicUrl(path)
    return { url: pub.publicUrl, path }
  } catch (err) {
    console.error('[media-storage] uploadMediaBuffer error:', err instanceof Error ? err.message : err)
    return null
  }
}

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
    'video/mp4': 'mp4', 'video/3gpp': '3gp',
    'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/amr': 'amr',
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/msword': 'doc',
    'application/vnd.ms-excel': 'xls',
    'application/zip': 'zip',
  }
  return map[mime] || ''
}

/** Map a Meta/WhatsApp mime type to our messages.type enum value. */
export function mimeToMessageType(mimeType: string, isPtt?: boolean): string {
  if (isPtt) return 'ptt'
  if (mimeType.startsWith('image/')) return mimeType.includes('webp') ? 'sticker' : 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  return 'document'
}
