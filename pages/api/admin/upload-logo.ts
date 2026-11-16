import { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { randomCode } from '@/lib/security'
import { logAction, getClientIp } from '@/lib/middleware'

// 512KB image → ~700KB base64 data URL; leave headroom for JSON.
export const config = { api: { bodyParser: { sizeLimit: '1mb' } } }

const MAX_BYTES = 512 * 1024
const BUCKET = 'brand-assets'

// Raster formats only (SVG rejected: it can carry script).
function sniffImage(buf: Buffer): { mime: string; ext: string } | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', ext: 'png' }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' }
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return { mime: 'image/webp', ext: 'webp' }
  if (buf.length >= 6 && (buf.subarray(0, 6).toString('ascii') === 'GIF87a' || buf.subarray(0, 6).toString('ascii') === 'GIF89a')) return { mime: 'image/gif', ext: 'gif' }
  if (buf.length >= 4 && buf[0] === 0 && buf[1] === 0 && buf[2] === 1 && buf[3] === 0) return { mime: 'image/x-icon', ext: 'ico' }
  return null
}

let bucketReady = false
async function ensureBucket(db: ReturnType<typeof supabaseAdmin>) {
  if (bucketReady) return
  const { data } = await db.storage.getBucket(BUCKET)
  if (!data) await db.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_BYTES })
  bucketReady = true
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const admin = await requireAdmin(req, res)
  if (!admin) return

  const { imageBase64, field } = req.body || {}
  const allowed = ['logo_url', 'favicon_url']
  if (!field || !allowed.includes(field)) return res.status(400).json({ error: 'Invalid field' })
  if (typeof imageBase64 !== 'string' || !imageBase64) return res.status(400).json({ error: 'imageBase64 required' })

  // Accept a data URL or bare base64; the declared type is ignored — the bytes decide.
  const b64 = imageBase64.replace(/^data:[^;,]*;base64,/, '')
  if (!/^[A-Za-z0-9+/=\s]+$/.test(b64)) return res.status(400).json({ error: 'Invalid image data' })
  const buf = Buffer.from(b64, 'base64')
  if (!buf.length) return res.status(400).json({ error: 'Invalid image data' })
  if (buf.length > MAX_BYTES) return res.status(413).json({ error: 'Image must be 512KB or smaller' })
  const kind = sniffImage(buf)
  if (!kind) return res.status(400).json({ error: 'Only PNG, JPEG, WebP, GIF or ICO images are allowed' })

  const db = supabaseAdmin()

  // Prefer Supabase Storage; fall back to a validated data URL if Storage is unavailable.
  let url: string
  try {
    await ensureBucket(db)
    const path = `${field.replace('_url', '')}/${Date.now()}-${randomCode(8, 'abcdefghijklmnopqrstuvwxyz0123456789')}.${kind.ext}`
    const { error: upErr } = await db.storage.from(BUCKET).upload(path, buf, { contentType: kind.mime, upsert: false })
    if (upErr) throw new Error(upErr.message)
    url = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  } catch (e) {
    console.error('[upload-logo] storage upload failed, storing inline:', (e as Error)?.message)
    url = `data:${kind.mime};base64,${buf.toString('base64')}`
  }

  const { data: row } = await db
    .from('system_settings')
    .select('value')
    .eq('key', 'brand_settings')
    .maybeSingle()

  const brand: Record<string, any> = row?.value && typeof row.value === 'object' ? { ...(row.value as object) } : {}
  brand[field] = url

  const { error } = await db.from('system_settings').upsert(
    { key: 'brand_settings', value: brand },
    { onConflict: 'key' }
  )

  if (error) {
    console.error('[upload-logo] save failed:', error.message)
    return res.status(500).json({ error: 'Failed to save image' })
  }
  await logAction({ userId: admin.userId, action: 'admin_brand_update', resource: 'brand_settings', details: { field, stored: url.startsWith('data:') ? 'inline' : 'storage' }, ipAddress: getClientIp(req) })
  return res.status(200).json({ success: true, url })
}
