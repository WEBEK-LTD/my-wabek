import { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export const config = { api: { bodyParser: { sizeLimit: '6mb' } } }

const SEO_KEY = 'seo_settings'
const BRAND_KEY = 'brand_settings'
const SMTP_KEY = 'smtp_settings'
const PUSH_KEY = 'push_settings'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res)
  if (!admin) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const keys = [SEO_KEY, BRAND_KEY, SMTP_KEY, PUSH_KEY]
    const { data: rows } = await db.from('system_settings').select('key, value').in('key', keys)
    const map = Object.fromEntries((rows || []).map(r => [r.key, r.value]))
    return res.status(200).json({
      seo: map[SEO_KEY] || {},
      brand: map[BRAND_KEY] || {},
      smtp: map[SMTP_KEY] || {},
      push: map[PUSH_KEY] || {},
    })
  }

  if (req.method === 'PUT') {
    const { seo, brand } = req.body

    if (seo) await db.from('system_settings').upsert({ key: SEO_KEY, value: seo }, { onConflict: 'key' })
    if (brand) await db.from('system_settings').upsert({ key: BRAND_KEY, value: brand }, { onConflict: 'key' })
    if (req.body.smtp) await db.from('system_settings').upsert({ key: SMTP_KEY, value: req.body.smtp }, { onConflict: 'key' })
    if (req.body.push) await db.from('system_settings').upsert({ key: PUSH_KEY, value: req.body.push }, { onConflict: 'key' })

    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
