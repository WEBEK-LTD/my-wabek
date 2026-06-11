import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { authRateLimit } from '@/lib/middleware'
import { sendOtpWhatsApp } from '@/lib/otp-sender'
import { sendEmail, otpEmail } from '@/lib/email'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!authRateLimit(req, res)) return

  const { userId, purpose } = req.body
  if (!userId) return res.status(400).json({ error: 'userId required' })

  const db = supabaseAdmin()
  const { data: user } = await db.from('users').select('id, email, name, phone').eq('id', userId).single()
  if (!user) return res.status(404).json({ error: 'User not found' })

  const code = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  await db.from('otp_codes').insert({
    id: uuidv4(),
    user_id: userId,
    code,
    purpose: purpose || 'login',
    expires_at: expiresAt,
    is_used: false,
  })

  const { data: brandRow } = await db.from('system_settings').select('value').eq('key', 'brand_settings').single()
  const brandName = brandRow?.value?.brand_name || 'WABEK'
  const brandColor = brandRow?.value?.brand_color || '#00D46A'

  // 1. Try WhatsApp
  if (user.phone) {
    const msg = `🔐 Your ${brandName} verification code:\n\n*${code}*\n\nExpires in 10 minutes. Don't share it.`
    const sent = await sendOtpWhatsApp(user.phone, msg)
    if (sent) return res.status(200).json({ success: true, method: 'whatsapp', phone: user.phone })
  }

  // 2. Fallback to email
  if (user.email) {
    const html = otpEmail(user.name, code, brandName, brandColor)
    const sent = await sendEmail({
      to: user.email,
      subject: `${brandName} — Verification Code: ${code}`,
      html,
    })
    if (sent) return res.status(200).json({ success: true, method: 'email', email: user.email })
  }

  return res.status(200).json({ success: true, method: 'none' })
}
