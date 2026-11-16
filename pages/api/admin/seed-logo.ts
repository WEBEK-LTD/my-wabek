import { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const LOGO_URL = 'https://res.cloudinary.com/dkl7ntpgw/image/upload/f_auto,q_auto/%D8%AA%D8%B5%D9%85%D9%8A%D9%85_%D8%A8%D8%AF%D9%88%D9%86_%D8%B9%D9%86%D9%88%D8%A7%D9%86_1_kejdrs'

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
