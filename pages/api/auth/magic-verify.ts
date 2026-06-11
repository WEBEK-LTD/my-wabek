import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { signToken } from '@/lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { token } = req.body
  if (!token) return res.status(400).json({ error: 'Token required' })

  const db = supabaseAdmin()
  const key = `magic_login_${token}`

  const { data: record } = await db.from('system_settings').select('value').eq('key', key).maybeSingle()
  if (!record?.value) return res.status(401).json({ error: 'Invalid or expired link' })

  const { user_id, created_at } = record.value as { user_id: string; created_at: string }

  // Check 5 min expiry
  if (new Date().getTime() - new Date(created_at).getTime() > 5 * 60 * 1000) {
    await db.from('system_settings').delete().eq('key', key)
    return res.status(401).json({ error: 'Link expired. Please try again.' })
  }

  // Delete token — one time use
  await db.from('system_settings').delete().eq('key', key)

  // Get user
  const { data: user } = await db.from('users').select('id, email, role, name').eq('id', user_id).maybeSingle()
  if (!user) return res.status(404).json({ error: 'User not found' })

  // Generate JWT
  const authToken = await signToken({ userId: user.id, email: user.email, role: user.role })

  // Set same cookie as normal login
  res.setHeader('Set-Cookie', `wabek_token=${authToken}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`)
  return res.status(200).json({ success: true, token: authToken, user })
}
