import { NextApiRequest, NextApiResponse } from 'next'
import { requireOwnerOrRole } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireOwnerOrRole(req, res)
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data } = await db.from('system_settings')
      .select('value').eq('key', `wix_settings_${user.userId}`).maybeSingle()
    return res.status(200).json(data?.value || {})
  }

  if (req.method === 'POST') {
    const { api_key } = req.body || {}
    if (api_key !== undefined && api_key !== null && (typeof api_key !== 'string' || api_key.length > 512)) {
      return res.status(400).json({ error: 'Invalid api_key' })
    }
    await db.from('system_settings').upsert({
      key:        `wix_settings_${user.userId}`,
      value:      { api_key },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
