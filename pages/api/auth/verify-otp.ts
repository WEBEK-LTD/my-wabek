import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { issueSession } from '@/lib/auth'
import { authRateLimitAsync, hitRateLimit, logAction, getClientIp } from '@/lib/middleware'
import { verifyPendingOtp } from '@/lib/otp'
import { v4 as uuidv4 } from 'uuid'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Only purposes that may result in a session. (phone_change codes are
// verified by /api/settings/profile and must never log anyone in.)
const PURPOSES = ['login', 'registration'] as const

function getDeviceName(req: NextApiRequest): string {
  const ua = req.headers['user-agent'] || ''
  if (ua.includes('Mobile')) return 'Mobile Browser'
  if (ua.includes('Chrome')) return 'Chrome Browser'
  if (ua.includes('Firefox')) return 'Firefox Browser'
  return 'Unknown Device'
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!(await authRateLimitAsync(req, res))) return

  const { userId, otp, purpose = 'login', trustDevice, deviceFingerprint } = req.body || {}
  if (typeof userId !== 'string' || !UUID_RE.test(userId) || !otp) {
    return res.status(400).json({ error: 'userId and otp required' })
  }
  if (!(PURPOSES as readonly string[]).includes(purpose)) {
    return res.status(400).json({ error: 'Invalid purpose' })
  }

  if (!(await hitRateLimit(`otp-verify:${userId}`, 10, 15 * 60))) {
    return res.status(429).json({ error: 'Too many attempts. Please try again later.' })
  }

  try {
    const db = supabaseAdmin()
    const ip = getClientIp(req)

    const result = await verifyPendingOtp({ userId, purpose, otp })
    if (!result.ok) {
      await logAction({ userId, action: 'otp_failed', ipAddress: ip })
      return res.status(400).json({ error: result.error })
    }

    const { data: user } = await db.from('users').select('*').eq('id', userId).maybeSingle()
    if (!user) return res.status(400).json({ error: 'Code expired or not found. Request a new one.' })
    if (user.is_active === false) return res.status(403).json({ error: 'Account suspended' })

    if (purpose === 'registration') {
      await db.from('users').update({ is_verified: true }).eq('id', userId)
    }

    await db.from('users').update({
      last_login_at: new Date().toISOString(),
      last_login_ip: ip,
      last_login_device: getDeviceName(req),
      failed_login_attempts: 0,
    }).eq('id', userId)

    await logAction({ userId, action: 'otp_verified', ipAddress: ip })

    if (trustDevice && typeof deviceFingerprint === 'string' && deviceFingerprint.length <= 128) {
      await db.from('trusted_devices').upsert({
        id: uuidv4(),
        user_id: userId,
        device_fingerprint: deviceFingerprint,
        device_name: getDeviceName(req),
        ip_address: ip,
        user_agent: String(req.headers['user-agent'] || '').slice(0, 500),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
    }

    try {
      await db.from('notifications').insert({
        user_id: userId,
        type: 'success',
        title: 'New login verified',
        body: `Login from ${getDeviceName(req)} (${ip})`,
        link: '/dashboard/settings',
      })
    } catch {}

    const token = await issueSession(res, user)
    return res.status(200).json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, plan_id: user.plan_id, sub_account_of: user.sub_account_of || null },
      token,
    })
  } catch (err) {
    console.error('[verify-otp] error:', err)
    return res.status(500).json({ error: 'Verification failed' })
  }
}
