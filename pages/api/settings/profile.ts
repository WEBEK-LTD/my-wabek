import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data } = await db.from('users').select('id, email, name, phone, otp_mode, is_verified, last_login_at, last_login_ip, last_login_device').eq('id', user.userId).single()
    return res.status(200).json({ user: data })
  }

  if (req.method === 'PUT') {
    const { name, phone, language, timezone } = req.body
    const { data, error } = await db.from('users').update({ name, phone, language, timezone, updated_at: new Date().toISOString() }).eq('id', user.userId).select('id, email, name, phone, language, timezone').single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ user: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
