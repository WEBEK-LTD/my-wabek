import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth, hashPassword, comparePassword } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' })
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  const { current_password, new_password } = req.body
  if (!current_password || !new_password) return res.status(400).json({ error: 'Both passwords required' })
  if (new_password.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' })

  const { data: dbUser } = await db.from('users').select('password_hash').eq('id', user.userId).single()
  if (!dbUser) return res.status(404).json({ error: 'User not found' })

  const valid = await comparePassword(current_password, dbUser.password_hash)
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' })

  const newHash = await hashPassword(new_password)
  await db.from('users').update({ password_hash: newHash, updated_at: new Date().toISOString() }).eq('id', user.userId)

  return res.status(200).json({ success: true })
}
