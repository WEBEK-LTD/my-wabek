// Shared media storage helper for /dashboard/chat attachments.
// Used for: (1) re-hosting inbound media (Meta URLs expire in minutes; WA Web
// media arrives as data: URLs), (2) hosting outbound files uploaded by an
// agent before sending.
//
// Isolated module — any failure here must never break text message
// send/receive. Callers should wrap usage in try/catch and fall back
// gracefully (e.g. store "[image]" placeholder content) on failure.
//
// Paths are `${userId}/${randomUUID()}.${ext}` — unguessable, with the
// extension chosen by the server from the MIME type (never from a client
// filename). The bucket stays public so links to media already sent keep
// working; moving to signed URLs is a separate migration.

import { randomUUID } from 'crypto'
import { supabaseAdmin } from './supabase'
import { assertPublicUrl } from './security'

const BUCKET = 'wa-media'
let bucketEnsured = false

// Meta's own limits are 16MB for media and 100MB for documents; we cap
// documents lower to keep serverless memory bounded.
export const MAX_MEDIA_BYTES = 16 * 1024 * 1024
export const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024

// MIME → server-chosen extension. Only these are accepted for agent uploads.
const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/3gpp': '3gp',
  'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/aac': 'aac', 'audio/mp4': 'm4a', 'audio/amr': 'amr',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt',
}

// Non-standard names some browsers/OSes send for the same formats
const MIME_ALIASES: Record<string, string> = {
  'image/jpg': 'image/jpeg', 'image/pjpeg': 'image/jpeg',
  'audio/mp3': 'audio/mpeg', 'audio/x-m4a': 'audio/mp4', 'audio/m4a': 'audio/mp4',
  'audio/x-aac': 'audio/aac', 'audio/aacp': 'audio/aac', 'audio/opus': 'audio/ogg',
  'video/3gp': 'video/3gpp',
}

/** "audio/ogg; codecs=opus" → "audio/ogg" (lower-case, no parameters, aliases resolved). */
export function baseMime(mime: string | null | undefined): string {
  const m = String(mime || '').split(';')[0].trim().toLowerCase()
  return MIME_ALIASES[m] || m
}

export function isAllowedMime(mime: string): boolean {
  return Object.prototype.hasOwnProperty.call(ALLOWED_MIME, baseMime(mime))
}

export function maxBytesForMime(mime: string): number {
  const m = baseMime(mime)
  return m.startsWith('image/') || m.startsWith('video/') || m.startsWith('audio/') ? MAX_MEDIA_BYTES : MAX_DOCUMENT_BYTES
}

function startsWith(buf: Buffer, bytes: number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false
  return bytes.every((b, i) => buf[offset + i] === b)
}
const ascii = (s: string) => Array.from(s).map(c => c.charCodeAt(0))

/**
 * Checks the file's magic bytes against its declared MIME type.
 * Returns false when the content clearly is not what the client claims.
 */
export function contentMatchesMime(buf: Buffer, mime: string): boolean {
  const m = baseMime(mime)
  const isFtyp = startsWith(buf, ascii('ftyp'), 4)
  switch (m) {
    case 'image/jpeg': return startsWith(buf, [0xff, 0xd8, 0xff])
    case 'image/png':  return startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    case 'image/gif':  return startsWith(buf, ascii('GIF87a')) || startsWith(buf, ascii('GIF89a'))
    case 'image/webp': return startsWith(buf, ascii('RIFF')) && startsWith(buf, ascii('WEBP'), 8)
    case 'video/mp4':
    case 'video/3gpp':
    case 'audio/mp4':  return isFtyp
    case 'audio/ogg':  return startsWith(buf, ascii('OggS'))
    case 'audio/mpeg': return startsWith(buf, ascii('ID3')) || (buf.length > 1 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)
    case 'audio/aac':  return buf.length > 1 && buf[0] === 0xff && (buf[1] & 0xf6) === 0xf0
    case 'audio/amr':  return startsWith(buf, ascii('#!AMR'))
    case 'application/pdf': return startsWith(buf, ascii('%PDF-'))
    case 'application/msword':
    case 'application/vnd.ms-excel':
    case 'application/vnd.ms-powerpoint':
      return startsWith(buf, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      return startsWith(buf, [0x50, 0x4b, 0x03, 0x04])
    case 'text/plain': {
      // Plain text: no NUL bytes and no HTML/script markup at the start.
      const head = buf.subarray(0, 8192)
      if (head.includes(0)) return false
      return !/^\s*<(!doctype|html|script|svg|\?xml)/i.test(head.toString('utf8'))
    }
    default: return false
  }
}

/** Display-only filename: no path parts or control characters, bounded length. */
export function sanitizeDisplayFilename(name: string | null | undefined, fallback = 'file'): string {
  const base = String(name || '').split(/[\\/]/).pop() || ''
  const clean = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120)
  return clean || fallback
}

function storageHost(): string | null {
  try {
    const u = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_DATABASE_URL ||
      process.env.SUPABASE_DATABASE_URL || process.env.SUPABASE_URL || ''
    return u ? new URL(u).hostname : null
  } catch { return null }
}

/**
 * SSRF guard for any URL we hand to Meta or the Baileys server for fetching.
 * Allows https URLs on our own Supabase storage host, or https URLs whose host
 * resolves only to public addresses. Throws otherwise.
 */
export async function assertSafeMediaUrl(raw: string): Promise<string> {
  let url: URL
  try { url = new URL(String(raw)) } catch { throw new Error('Invalid media URL') }
  if (url.protocol !== 'https:') throw new Error('Media URL must use https')
  if (url.username || url.password) throw new Error('Media URL not allowed')
  const own = storageHost()
  if (own && url.hostname === own) return url.toString()
  await assertPublicUrl(url.toString(), { httpsOnly: true })
  return url.toString()
}

async function ensureBucket(): Promise<void> {
  if (bucketEnsured) return
  try {
    const db = supabaseAdmin()
    const { data: buckets } = await db.storage.listBuckets()
    const exists = buckets?.some(b => b.name === BUCKET)
    if (!exists) {
      await db.storage.createBucket(BUCKET, { public: true, fileSizeLimit: '50MB' })
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
  mimeType: string
}

/**
 * Upload a buffer to permanent storage and return its public URL.
 * Returns null on any failure (caller must handle gracefully).
 *
 * `strict: true` (agent uploads): the MIME must be on the allowlist.
 * Otherwise (inbound media from customers) unknown types are stored as
 * application/octet-stream so the browser never renders them inline.
 */
export async function uploadMediaBuffer(
  buffer: Buffer,
  opts: { userId: string; mimeType: string; filename?: string; strict?: boolean }
): Promise<UploadResult | null> {
  try {
    let mime = baseMime(opts.mimeType)
    if (!isAllowedMime(mime)) {
      if (opts.strict) {
        console.error('[media-storage] rejected MIME type:', mime)
        return null
      }
      mime = 'application/octet-stream'
    }
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(opts.userId)) return null

    await ensureBucket()
    const db = supabaseAdmin()

    const ext = ALLOWED_MIME[mime] || 'bin'
    const path = `${opts.userId}/${randomUUID()}.${ext}`

    const { error } = await db.storage.from(BUCKET).upload(path, buffer, {
      contentType: mime,
      upsert: false,
    })
    if (error) {
      console.error('[media-storage] upload failed:', error.message)
      return null
    }

    const { data: pub } = db.storage.from(BUCKET).getPublicUrl(path)
    return { url: pub.publicUrl, path, mimeType: mime }
  } catch (err) {
    console.error('[media-storage] uploadMediaBuffer error:', err instanceof Error ? err.message : err)
    return null
  }
}

/** Decode a `data:<mime>;base64,<payload>` URL. Returns null if it is not one. */
export function parseDataUrl(raw: unknown): { mimeType: string; buffer: Buffer } | null {
  if (typeof raw !== 'string' || !raw.startsWith('data:')) return null
  const comma = raw.indexOf(',')
  if (comma < 0) return null
  const meta = raw.slice(5, comma)
  if (!/;base64$/i.test(meta)) return null
  const mimeType = meta.replace(/;base64$/i, '') || 'application/octet-stream'
  try {
    return { mimeType, buffer: Buffer.from(raw.slice(comma + 1), 'base64') }
  } catch { return null }
}

/** Map a Meta/WhatsApp mime type to our messages.type enum value. */
export function mimeToMessageType(mimeType: string, isPtt?: boolean): string {
  if (isPtt) return 'ptt'
  if (mimeType.startsWith('image/')) return mimeType.includes('webp') ? 'sticker' : 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  return 'document'
}
