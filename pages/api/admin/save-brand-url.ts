import { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { logAction, getClientIp } from '@/lib/middleware'

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } }

const URL_FIELDS = ['logo_url', 'favicon_url']

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const admin = await requireAdmin(req, res)
  if (!admin) return

  const { url, field } = req.body || {}
  const allowed = [...URL_FIELDS, 'app_name']
  if (!field || !allowed.includes(field)) return res.status(400).json({ error: 'Invalid field' })

  let value: string | null = null
  if (url !== undefined && url !== null && url !== '') {
    if (typeof url !== 'string') return res.status(400).json({ error: 'Invalid value' })
    if (URL_FIELDS.includes(field)) {
      // https URLs only (no javascript:, data:, http: or relative tricks).
      let parsed: URL
      try { parsed = new URL(url.trim()) } catch { return res.status(400).json({ error: 'Must be a valid https:// URL' }) }
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password || url.length > 2048) {
        return res.status(400).json({ error: 'Must be a valid https:// URL' })
      }
      value = parsed.toString()
    } else {
      value = url.trim().slice(0, 100) // app_name
    }
  }

  const db = supabaseAdmin()
  const { data: row } = await db.from('system_settings').select('value').eq('key', 'brand_settings').maybeSingle()
  const brand: Record<string, any> = row?.value && typeof row.value === 'object' ? { ...(row.value as object) } : {}
  brand[field] = value

  const { error } = await db.from('system_settings').upsert(
    { key: 'brand_settings', value: brand },
    { onConflict: 'key' }
  )
  if (error) {
    console.error('[save-brand-url] save failed:', error.message)
    return res.status(500).json({ error: 'Failed to save' })
  }
  await logAction({ userId: admin.userId, action: 'admin_brand_update', resource: 'brand_settings', details: { field, value }, ipAddress: getClientIp(req) })
  return res.status(200).json({ success: true })
}
