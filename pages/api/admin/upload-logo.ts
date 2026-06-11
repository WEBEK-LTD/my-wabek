import { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export const config = { api: { bodyParser: { sizeLimit: '8mb' } } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const admin = await requireAdmin(req, res)
  if (!admin) return

  const { imageBase64, field } = req.body
  const allowed = ['logo_url', 'favicon_url']
  if (!field || !allowed.includes(field)) return res.status(400).json({ error: 'Invalid field' })
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' })

  const db = supabaseAdmin()

  // Read current brand_settings
  const { data: row } = await db
    .from('system_settings')
    .select('value')
    .eq('key', 'brand_settings')
    .maybeSingle()

  const brand: Record<string, any> = row?.value ? { ...(row.value as object) } : {}
  brand[field] = imageBase64  // store base64 directly

  const { error } = await db.from('system_settings').upsert(
    { key: 'brand_settings', value: brand },
    { onConflict: 'key' }
  )

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ success: true, url: imageBase64 })
}
