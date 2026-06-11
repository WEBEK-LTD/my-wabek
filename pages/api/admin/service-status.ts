import { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

const KEY = 'service_status'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = supabaseAdmin()

  // GET — public, no auth needed
  if (req.method === 'GET') {
    const { data } = await db
      .from('system_settings')
      .select('value')
      .eq('key', KEY)
      .maybeSingle()
    return res.status(200).json({ services: data?.value || {} })
  }

  // POST — admin only
  if (req.method === 'POST') {
    const admin = await requireAdmin(req, res)
    if (!admin) return

    const { services } = req.body
    if (!services) return res.status(400).json({ error: 'services required' })

    const { error } = await db.from('system_settings').upsert(
      { key: KEY, value: services },
      { onConflict: 'key' }
    )
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  return res.status(405).end()
}
