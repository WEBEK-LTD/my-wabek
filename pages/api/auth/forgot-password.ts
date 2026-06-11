import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { authRateLimit } from '@/lib/middleware'
import { sendOtpWhatsApp } from '@/lib/otp-sender'
import { sendEmail, passwordResetEmail } from '@/lib/email'
import crypto from 'crypto'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!authRateLimit(req, res)) return

  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'Email required' })

  const db = supabaseAdmin()
  const { data: user } = await db.from('users').select('id, email, name, phone').eq('email', email.toLowerCase()).single()

  if (!user) return res.status(200).json({ success: true, method: 'none' })

  const token = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

  await db.from('system_logs').insert({
    user_id: user.id,
    action: 'password_reset_token',
    resource: 'token_hash',
    resource_id: tokenHash,
    details: { expires_at: expiresAt, email: user.email },
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://waabek.com'
  const resetUrl = `${appUrl}/auth/reset-password?token=${token}`

  // Get brand name from settings
  const { data: brandRow } = await db.from('system_settings').select('value').eq('key', 'brand_settings').single()
  const brandName = brandRow?.value?.brand_name || 'WABEK'
  const brandColor = brandRow?.value?.brand_color || '#00D46A'

  // 1. Try WhatsApp first (if user has phone)
  if (user.phone) {
    const msg = `🔐 *${brandName} Password Reset*\n\nHi ${user.name},\n\nReset your password:\n${resetUrl}\n\n⏱️ Expires in 1 hour.`
    const sent = await sendOtpWhatsApp(user.phone, msg)
    if (sent) return res.status(200).json({ success: true, method: 'whatsapp' })
  }

  // 2. Try Email (SMTP from DB or env)
  const emailHtml = passwordResetEmail(user.name, resetUrl, brandName, brandColor)
  const emailSent = await sendEmail({
    to: user.email,
    subject: `${brandName} — Password Reset`,
    html: emailHtml,
    text: `Reset your password: ${resetUrl}`,
  })
  if (emailSent) return res.status(200).json({ success: true, method: 'email' })

  // 3. Fallback log
  console.log(`Password reset for ${email}: ${resetUrl}`)
  return res.status(200).json({ success: true, method: 'logged' })
}
