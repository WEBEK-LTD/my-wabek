import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const user = await requireAuth(req, res)
    if (!user) return

    const db = supabaseAdmin()
    const { data } = await db
      .from('users')
      .select('id, email, name, role, plan_id, trial_ends_at, plan_expires_at, api_key, created_at, phone, otp_mode, is_verified, last_login_at, last_login_ip, last_login_device, wix_instance_id')
      .eq('id', user.userId)
      .single()

    return res.status(200).json({ user: data })
  }

  if (req.method === 'POST') {
    res.setHeader('Set-Cookie', 'wabek_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax')
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
