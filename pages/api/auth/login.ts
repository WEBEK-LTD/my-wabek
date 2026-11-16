import { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { comparePassword, issueSession } from '@/lib/auth'
import { authRateLimitAsync, hitRateLimit, logAction, getClientIp } from '@/lib/middleware'
import { getSetting } from '@/lib/settings'
import { sendOtpCode } from '@/lib/otp-sender'
import { createPendingOtp } from '@/lib/otp'
import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'

const schema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(256),
  deviceFingerprint: z.string().max(128).optional(),
})

const LOCKOUT_MINUTES = 15
const GENERIC_INVALID = 'Invalid email or password'

function getDeviceName(req: NextApiRequest): string {
  const ua = req.headers['user-agent'] || ''
  if (ua.includes('Mobile')) return 'Mobile Browser'
  if (ua.includes('Chrome')) return 'Chrome Browser'
  if (ua.includes('Firefox')) return 'Firefox Browser'
  if (ua.includes('Safari')) return 'Safari Browser'
  return 'Unknown Device'
}

function maskPhone(p: string): string {
  return p.replace(/(\d{2})\d+(\d{4})/, '$1****$2')
}

function maskEmail(e: string): string {
  const [local, domain] = e.split('@')
  return `${local.slice(0, 2)}***@${domain || ''}`
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!(await authRateLimitAsync(req, res))) return

  try {
    const body = schema.parse(req.body)
    const email = body.email.toLowerCase().trim()
    const db = supabaseAdmin()
    const ip = getClientIp(req)

    // Throttle guessing per (account, IP) and per account across all IPs.
    // Applied before the account is looked up, so it reveals nothing.
    const [perPair, perAccount] = await Promise.all([
      hitRateLimit(`login:${email}:${ip}`, 10, LOCKOUT_MINUTES * 60),
      hitRateLimit(`login:${email}`, 30, LOCKOUT_MINUTES * 60),
    ])
    if (!perPair || !perAccount) {
      return res.status(429).json({ error: 'Too many login attempts. Please try again later.' })
    }

    const { data: user } = await db.from('users').select('*').eq('email', email).maybeSingle()

    // Always run bcrypt (dummy hash when the user doesn't exist) — no timing oracle.
    const valid = await comparePassword(body.password, user?.password_hash)

    if (!user || !valid) {
      if (user) {
        const maxAttempts = Math.max(3, Number(await getSetting('max_login_attempts', 5)) || 5)
        const lockExpired = user.locked_until && new Date(user.locked_until) <= new Date()
        const prev = lockExpired ? 0 : (user.failed_login_attempts || 0)
        const attempts = prev + 1
        const update: Record<string, unknown> = { failed_login_attempts: attempts }
        if (lockExpired) update.locked_until = null
        if (attempts >= maxAttempts && !(user.locked_until && !lockExpired)) {
          update.locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60000).toISOString()
        }
        await db.from('users').update(update).eq('id', user.id)
        await logAction({ userId: user.id, action: 'login_failed', ipAddress: ip })
        // Progressive delay (captcha-ready counter lives in failed_login_attempts).
        await sleep(Math.min(250 * 2 ** Math.min(attempts - 1, 4), 3000))
      } else {
        await sleep(250)
      }
      return res.status(401).json({ error: GENERIC_INVALID })
    }

    // Password is correct — only now reveal account state.
    if (user.is_active === false) return res.status(403).json({ error: 'Account suspended' })
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const mins = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000)
      return res.status(429).json({ error: `Account temporarily locked. Try again in ${mins} minutes.` })
    }

    await db.from('users').update({ failed_login_attempts: 0, locked_until: null }).eq('id', user.id)

    const expiryMinutes = Number(await getSetting('otp_expiry_minutes', 10)) || 10

    // Account needs verification (registration not completed)
    if (!user.is_verified) {
      if (await hitRateLimit(`otp-send:${user.id}`, 5, 15 * 60)) {
        const otp = await createPendingOtp({ userId: user.id, phone: user.phone, purpose: 'registration', expiryMinutes })
        await sendOtpCode({
          code: otp,
          phone: user.phone,
          email: user.email,
          name: user.name,
          whatsappMessage: `🔐 *WABEK Verification*\n\nYour code: *${otp}*\n\nExpires in ${expiryMinutes} minutes.`,
        })
      }
      return res.status(403).json({ error: 'Account not verified', requiresVerification: true, userId: user.id })
    }

    // Two-factor
    const otpMode = user.otp_mode || 'disabled'
    const deviceFp = body.deviceFingerprint || crypto.createHash('sha256').update(`${ip}-${req.headers['user-agent']}`).digest('hex').slice(0, 16)

    if (otpMode === 'always' || otpMode === 'new_device') {
      let needOtp = otpMode === 'always'
      if (otpMode === 'new_device') {
        const { data: trusted } = await db.from('trusted_devices')
          .select('id').eq('user_id', user.id).eq('device_fingerprint', deviceFp).gt('expires_at', new Date().toISOString()).limit(1)
        needOtp = !trusted?.length
      }

      if (needOtp) {
        if (!(await hitRateLimit(`otp-send:${user.id}`, 5, 15 * 60))) {
          return res.status(429).json({ error: 'Too many verification codes requested. Please try again later.' })
        }
        const otp = await createPendingOtp({ userId: user.id, phone: user.phone, purpose: 'login', expiryMinutes })
        // No phone (or WhatsApp unavailable) → email OTP. Never skip 2FA silently.
        const sent = await sendOtpCode({
          code: otp,
          phone: user.phone,
          email: user.email,
          name: user.name,
          whatsappMessage: `🔐 *WABEK Login Verification*\n\nYour login code: *${otp}*\n\nDevice: ${getDeviceName(req)}\n\n⏱️ Expires in ${expiryMinutes} minutes.\n\nIf this wasn't you, change your password immediately!`,
          emailSubject: 'Your login verification code',
        })
        if (!sent.sent) {
          return res.status(503).json({ error: 'Could not send your verification code. Please try again later or contact support.' })
        }
        return res.status(200).json({
          success: false,
          requiresOtp: true,
          userId: user.id,
          method: sent.method,
          phone: sent.method === 'whatsapp' && user.phone ? maskPhone(user.phone) : undefined,
          email: sent.method === 'email' ? maskEmail(user.email) : undefined,
          message: sent.method === 'whatsapp' ? 'Verification code sent to your WhatsApp' : 'Verification code sent to your email',
        })
      }
    }

    // Login successful
    const token = await issueSession(res, user)
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

    return res.status(200).json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, plan_id: user.plan_id, trial_ends_at: user.trial_ends_at, phone: user.phone, otp_mode: user.otp_mode, sub_account_of: user.sub_account_of || null },
      token,
    })
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid data' })
    console.error('[login] error:', err)
    return res.status(500).json({ error: 'Login failed' })
  }
}
