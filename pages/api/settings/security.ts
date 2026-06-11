import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' })
  const db = supabaseAdmin()
  const { otp_mode } = req.body

  if (!['disabled', 'always', 'new_device'].includes(otp_mode)) {
    return res.status(400).json({ error: 'Invalid OTP mode' })
  }

  await db.from('users').update({ otp_mode, updated_at: new Date().toISOString() }).eq('id', user.userId)
  return res.status(200).json({ success: true })
}
