import { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const admin = await requireAdmin(req, res)
  if (!admin) return

  const { url, field } = req.body
  const allowed = ['logo_url', 'favicon_url', 'app_name']
  if (!field || !allowed.includes(field)) return res.status(400).json({ error: 'Invalid field' })

  const db = supabaseAdmin()
  const { data: row } = await db.from('system_settings').select('value').eq('key', 'brand_settings').maybeSingle()
  const brand: Record<string, any> = row?.value ? { ...(row.value as object) } : {}
  brand[field] = url || null

  const { error } = await db.from('system_settings').upsert(
    { key: 'brand_settings', value: brand },
    { onConflict: 'key' }
  )
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ success: true })
}
