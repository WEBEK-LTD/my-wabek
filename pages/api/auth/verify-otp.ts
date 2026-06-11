import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { signToken } from '@/lib/auth'
import { logAction, getClientIp } from '@/lib/middleware'
import { getSetting } from '@/lib/settings'
import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'

function getDeviceName(req: NextApiRequest): string {
  const ua = req.headers['user-agent'] || ''
  if (ua.includes('Mobile')) return 'Mobile Browser'
  if (ua.includes('Chrome')) return 'Chrome Browser'
  if (ua.includes('Firefox')) return 'Firefox Browser'
  return 'Unknown Device'
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { userId, otp, purpose = 'login', trustDevice, deviceFingerprint } = req.body
  if (!userId || !otp) return res.status(400).json({ error: 'userId and otp required' })

  const db = supabaseAdmin()
  const ip = getClientIp(req)

  // Find pending OTP
  const { data: pending } = await db.from('otp_pending')
    .select('*')
    .eq('user_id', userId)
    .eq('purpose', purpose)
    .eq('is_used', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)

  const otpRecord = pending?.[0]
  if (!otpRecord) return res.status(400).json({ error: 'OTP expired or not found. Request a new one.' })

  // Verify OTP
  const otpHash = crypto.createHash('sha256').update(otp).digest('hex')
  if (otpHash !== otpRecord.otp_hash) {
    return res.status(400).json({ error: 'Invalid verification code' })
  }

  // Mark as used
  await db.from('otp_pending').update({ is_used: true }).eq('id', otpRecord.id)

  // Get user
  const { data: user } = await db.from('users').select('*').eq('id', userId).single()
  if (!user) return res.status(404).json({ error: 'User not found' })

  // Mark user as verified if registration
  if (purpose === 'registration') {
    await db.from('users').update({ is_verified: true }).eq('id', userId)
  }

  // Update last login
  await db.from('users').update({
    last_login_at: new Date().toISOString(),
    last_login_ip: ip,
    last_login_device: getDeviceName(req),
    failed_login_attempts: 0,
  }).eq('id', userId)

  await logAction({ userId, action: 'otp_verified', ipAddress: ip })

  // Trust device if requested
  if (trustDevice && deviceFingerprint) {
    await db.from('trusted_devices').upsert({
      id: uuidv4(),
      user_id: userId,
      device_fingerprint: deviceFingerprint,
      device_name: getDeviceName(req),
      ip_address: ip,
      user_agent: req.headers['user-agent'] || '',
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
  }

  // Add notification
  try {
    await db.from('notifications').insert({
      user_id: userId,
      type: 'success',
      title: 'New login verified',
      body: `Login from ${getDeviceName(req)} (${ip})`,
      link: '/dashboard/settings',
    })
  } catch {}

  const token = await signToken({ userId: user.id, email: user.email, role: user.role })
  res.setHeader('Set-Cookie', `wabek_token=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`)

  return res.status(200).json({
    success: true,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, plan_id: user.plan_id },
    token,
  })
}
