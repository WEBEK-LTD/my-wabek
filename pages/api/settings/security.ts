import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth, comparePassword } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { hitRateLimit } from '@/lib/middleware'

const MODES = ['disabled', 'always', 'new_device'] as const
// Lower = weaker. Weakening 2FA requires the current password.
const STRENGTH: Record<string, number> = { disabled: 0, new_device: 1, always: 2 }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' })
  const db = supabaseAdmin()
  // 2FA settings always apply to the logged-in person's own login.
  const selfId = user.actualUserId || user.userId
  const { otp_mode, current_password } = req.body || {}

  if (!(MODES as readonly string[]).includes(otp_mode)) {
    return res.status(400).json({ error: 'Invalid OTP mode' })
  }

  const { data: dbUser } = await db.from('users').select('otp_mode, password_hash').eq('id', selfId).maybeSingle()
  if (!dbUser) return res.status(404).json({ error: 'User not found' })

  const current = dbUser.otp_mode || 'disabled'
  if (STRENGTH[otp_mode] < STRENGTH[current]) {
    if (!(await hitRateLimit(`security:${selfId}`, 5, 15 * 60))) {
      return res.status(429).json({ error: 'Too many attempts. Please try again later.' })
    }
    if (typeof current_password !== 'string' || !current_password) {
      return res.status(400).json({ error: 'Current password is required to weaken two-factor authentication', requiresPassword: true })
    }
    if (!(await comparePassword(current_password, dbUser.password_hash))) {
      return res.status(401).json({ error: 'Current password is incorrect', requiresPassword: true })
    }
  }

  const { error } = await db.from('users').update({ otp_mode, updated_at: new Date().toISOString() }).eq('id', selfId)
  if (error) {
    console.error('[settings/security] update failed:', error.message)
    return res.status(500).json({ error: 'Could not update security settings' })
  }
  return res.status(200).json({ success: true })
}
