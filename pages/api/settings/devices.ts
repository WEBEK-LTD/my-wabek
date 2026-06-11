import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data } = await db.from('trusted_devices').select('*').eq('user_id', user.userId).order('last_used_at', { ascending: false })
    return res.status(200).json({ devices: data || [] })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
