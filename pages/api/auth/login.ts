import { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { comparePassword, signToken } from '@/lib/auth'
import { authRateLimit, logAction, getClientIp } from '@/lib/middleware'
import { getSetting } from '@/lib/settings'
import { sendOtpWhatsApp } from '@/lib/otp-sender'
import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceFingerprint: z.string().optional(),
})

function getDeviceName(req: NextApiRequest): string {
  const ua = req.headers['user-agent'] || ''
  if (ua.includes('Mobile')) return 'Mobile Browser'
  if (ua.includes('Chrome')) return 'Chrome Browser'
  if (ua.includes('Firefox')) return 'Firefox Browser'
  if (ua.includes('Safari')) return 'Safari Browser'
  return 'Unknown Device'
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!authRateLimit(req, res)) return

  try {
    const body = schema.parse(req.body)
    const db = supabaseAdmin()
    const ip = getClientIp(req)

    const { data: user } = await db.from('users').select('*').eq('email', body.email.toLowerCase()).single()
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })
    if (!user.is_active) return res.status(403).json({ error: 'Account suspended' })

    // Check lockout
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const mins = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000)
      return res.status(429).json({ error: `Account locked. Try again in ${mins} minutes.` })
    }

    const valid = await comparePassword(body.password, user.password_hash)
    if (!valid) {
      const maxAttempts = await getSetting('max_login_attempts', 5) as number
      const lockoutMins = await getSetting('lockout_minutes', 15) as number
      const newAttempts = (user.failed_login_attempts || 0) + 1
      const update: Record<string, unknown> = { failed_login_attempts: newAttempts }
      if (newAttempts >= maxAttempts) {
        update.locked_until = new Date(Date.now() + lockoutMins * 60000).toISOString()
      }
      await db.from('users').update(update).eq('id', user.id)
      await logAction({ userId: user.id, action: 'login_failed', ipAddress: ip })
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // Reset failed attempts
    await db.from('users').update({ failed_login_attempts: 0, locked_until: null }).eq('id', user.id)

    // Check if account needs verification
    if (!user.is_verified) {
      if (user.phone) {
        const otp = Math.floor(100000 + Math.random() * 900000).toString()
        const otpHash = crypto.createHash('sha256').update(otp).digest('hex')
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
        await db.from('otp_pending').insert({ user_id: user.id, phone: user.phone, otp_hash: otpHash, purpose: 'registration', expires_at: expiresAt })
        const msg = `🔐 *WABEK Verification*\n\nYour code: *${otp}*\n\nExpires in 10 minutes.`
        await sendOtpWhatsApp(user.phone, msg)
      }
      return res.status(403).json({ error: 'Account not verified', requiresVerification: true, userId: user.id })
    }

    // Check OTP mode
    const otpMode = user.otp_mode || 'disabled'
    const deviceFp = body.deviceFingerprint || crypto.createHash('sha256').update(`${ip}-${req.headers['user-agent']}`).digest('hex').slice(0, 16)

    if (otpMode === 'always' || otpMode === 'new_device') {
      let needOtp = otpMode === 'always'
      if (otpMode === 'new_device') {
        const { data: trusted } = await db.from('trusted_devices')
          .select('id').eq('user_id', user.id).eq('device_fingerprint', deviceFp).gt('expires_at', new Date().toISOString()).limit(1)
        needOtp = !trusted?.length
      }

      if (needOtp && user.phone) {
        const expiryMinutes = await getSetting('otp_expiry_minutes', 10) as number
        const otp = Math.floor(100000 + Math.random() * 900000).toString()
        const otpHash = crypto.createHash('sha256').update(otp).digest('hex')
        const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString()
        await db.from('otp_pending').insert({ user_id: user.id, phone: user.phone, otp_hash: otpHash, purpose: 'login', expires_at: expiresAt })

        const msg = `🔐 *WABEK Login Verification*\n\nHi ${user.name},\n\nYour login code: *${otp}*\n\nIP: ${ip}\nDevice: ${getDeviceName(req)}\n\n⏱️ Expires in ${expiryMinutes} minutes.\n\nIf this wasn't you, change your password immediately!`
        await sendOtpWhatsApp(user.phone, msg)

        return res.status(200).json({
          success: false,
          requiresOtp: true,
          userId: user.id,
          phone: user.phone.replace(/(\d{2})\d+(\d{4})/, '$1****$2'),
          message: 'Verification code sent to your WhatsApp',
        })
      }
    }

    // Login successful
    const token = await signToken({ userId: user.id, email: user.email, role: user.role })
    await logAction({ userId: user.id, action: 'login', ipAddress: ip })
    await db.from('users').update({
      last_login_at: new Date().toISOString(),
      last_login_ip: ip,
      last_login_device: getDeviceName(req),
    }).eq('id', user.id)

    if (otpMode === 'new_device' && deviceFp) {
      await db.from('trusted_devices').upsert({
        id: uuidv4(),
        user_id: user.id,
        device_fingerprint: deviceFp,
        device_name: getDeviceName(req),
        ip_address: ip,
        user_agent: req.headers['user-agent'] || '',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
    }

    res.setHeader('Set-Cookie', `wabek_token=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`)
    return res.status(200).json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, plan_id: user.plan_id, trial_ends_at: user.trial_ends_at, phone: user.phone, otp_mode: user.otp_mode },
      token,
    })
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid data' })
    return res.status(500).json({ error: 'Login failed', details: String(err) })
  }
}
