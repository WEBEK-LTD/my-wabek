import { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  // Official logo, absolute (brand_settings.logo_url is also used in e-mails).
  const LOGO_URL = `${(process.env.NEXT_PUBLIC_APP_URL || 'https://waabek.com').replace(/\/+$/, '')}/brand/logo-mark.png`

  const db = supabaseAdmin()
  const { data: row } = await db.from('system_settings').select('value').eq('key', 'brand_settings').maybeSingle()
  const brand: Record<string, any> = row?.value ? { ...(row.value as object) } : {}
  brand['logo_url'] = LOGO_URL

  const { error } = await db.from('system_settings').upsert({ key: 'brand_settings', value: brand }, { onConflict: 'key' })
  if (error) {
    console.error('[seed-logo] save failed:', error.message)
    return res.status(500).json({ error: 'Failed to save' })
  }
  return res.status(200).json({ success: true, logo_url: LOGO_URL })
}
