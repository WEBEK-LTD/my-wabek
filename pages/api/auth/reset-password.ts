import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { hashPassword } from '@/lib/auth'
import crypto from 'crypto'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { token, password } = req.body
  if (!token || !password) return res.status(400).json({ error: 'Token and password required' })
  if (password.length < 8) return res.status(400).json({ error: 'Password too short' })

  const db = supabaseAdmin()
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  // Find token in system_logs
  const { data: log } = await db
    .from('system_logs')
    .select('*')
    .eq('action', 'password_reset_token')
    .eq('resource_id', tokenHash)
    .single()

  if (!log) return res.status(400).json({ error: 'Invalid or expired reset link' })

  const details = log.details as { expires_at: string }
  if (new Date(details.expires_at) < new Date()) {
    return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' })
  }

  // Update password
  const passwordHash = await hashPassword(password)
  await db.from('users').update({ password_hash: passwordHash, updated_at: new Date().toISOString() }).eq('id', log.user_id)

  // Invalidate token by deleting it
  await db.from('system_logs').delete().eq('id', log.id)

  return res.status(200).json({ success: true })
}
