import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { authRateLimitAsync, hitRateLimit, getClientIp } from '@/lib/middleware'
import { sendOtpWhatsApp } from '@/lib/otp-sender'
import { sendEmail, passwordResetEmail } from '@/lib/email'
import crypto from 'crypto'

// Identical response whether or not the account exists (no enumeration).
const GENERIC = { success: true, message: 'If an account exists for this email, a reset link has been sent.' }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!(await authRateLimitAsync(req, res))) return

  const { email } = req.body || {}
  if (typeof email !== 'string' || !email.includes('@') || email.length > 254) {
    return res.status(400).json({ error: 'Email required' })
  }
  const normalized = email.toLowerCase().trim()

  const [ipOk, emailOk] = await Promise.all([
    hitRateLimit(`forgot:${getClientIp(req)}`, 10, 60 * 60),
    hitRateLimit(`forgot:${normalized}`, 3, 60 * 60),
  ])
  if (!ipOk || !emailOk) return res.status(200).json(GENERIC)

  try {
    const db = supabaseAdmin()
    const { data: user } = await db.from('users').select('id, email, name, phone, is_active').eq('email', normalized).maybeSingle()
    if (!user || user.is_active === false) return res.status(200).json(GENERIC)

    // Only the newest link is valid.
    await db.from('system_logs').delete().eq('action', 'password_reset_token').eq('user_id', user.id)

    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

    await db.from('system_logs').insert({
      user_id: user.id,
      action: 'password_reset_token',
      resource: 'token_hash',
      resource_id: tokenHash,
      details: { expires_at: expiresAt },
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://waabek.com'
    const resetUrl = `${appUrl}/auth/reset-password?token=${token}`

    const { data: brandRow } = await db.from('system_settings').select('value').eq('key', 'brand_settings').maybeSingle()
    const brandName = (brandRow?.value as any)?.brand_name || 'WABEK'
    const brandColor = (brandRow?.value as any)?.brand_color || '#00D46A'

    let sent = false
    if (user.phone) {
      const msg = `🔐 *${brandName} Password Reset*\n\nReset your password:\n${resetUrl}\n\n⏱️ Expires in 1 hour.`
      sent = await sendOtpWhatsApp(user.phone, msg)
    }
    if (!sent) {
      sent = await sendEmail({
        to: user.email,
        subject: `${brandName} — Password Reset`,
        html: passwordResetEmail(user.name, resetUrl, brandName, brandColor),
        text: `Reset your password: ${resetUrl}`,
      })
    }
    if (!sent) console.warn('[forgot-password] no delivery channel available for user', user.id)
  } catch (err) {
    console.error('[forgot-password] error:', err)
  }

  return res.status(200).json(GENERIC)
}
