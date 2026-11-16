import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { hashPassword, bumpTokenVersion } from '@/lib/auth'
import { authRateLimitAsync } from '@/lib/middleware'
import crypto from 'crypto'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!(await authRateLimitAsync(req, res))) return

  const { token, password } = req.body || {}
  if (typeof token !== 'string' || typeof password !== 'string' || !token || !password) {
    return res.status(400).json({ error: 'Token and password required' })
  }
  if (password.length < 8) return res.status(400).json({ error: 'Password too short' })
  if (password.length > 256) return res.status(400).json({ error: 'Password too long' })

  try {
    const db = supabaseAdmin()
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    // Consume atomically: only the request that deletes the row may proceed.
    const { data: consumed } = await db
      .from('system_logs')
      .delete()
      .eq('action', 'password_reset_token')
      .eq('resource_id', tokenHash)
      .select('id, user_id, details')

    const log = consumed?.[0]
    if (!log) return res.status(400).json({ error: 'Invalid or expired reset link' })

    const details = (log.details || {}) as { expires_at?: string }
    if (!details.expires_at || new Date(details.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' })
    }

    const passwordHash = await hashPassword(password)
    const { error } = await db.from('users').update({
      password_hash: passwordHash,
      failed_login_attempts: 0,
      locked_until: null,
      updated_at: new Date().toISOString(),
    }).eq('id', log.user_id)
    if (error) {
      console.error('[reset-password] update failed:', error.message)
      return res.status(500).json({ error: 'Could not reset password' })
    }

    // Invalidate every other outstanding reset link and every session.
    await db.from('system_logs').delete().eq('action', 'password_reset_token').eq('user_id', log.user_id)
    await bumpTokenVersion(log.user_id)

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('[reset-password] error:', err)
    return res.status(500).json({ error: 'Could not reset password' })
  }
}
