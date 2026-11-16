import { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getSetting } from '@/lib/settings'
import { sendOtpTemplate } from '@/lib/otp-template'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const { phone } = req.body as { phone?: string }
  if (!phone) return res.status(400).json({ error: 'phone is required' })

  const db = supabaseAdmin()

  const otpInstanceId = await getSetting('otp_instance_id', '') as string
  let instance: any = null

  // Only the configured platform OTP instance — never some other customer's
  // connected instance.
  if (!otpInstanceId) {
    return res.status(400).json({ error: 'No OTP instance configured. Choose one in Settings → Security & OTP.' })
  }
  const { data } = await db.from('whatsapp_instances').select('*').eq('id', otpInstanceId).eq('status', 'connected').maybeSingle()
  instance = data
  if (!instance) return res.status(400).json({ error: 'The configured OTP instance is not connected' })

  if (typeof phone !== 'string' || !/^\+?[0-9]{6,15}$/.test(phone.replace(/[\s-]/g, ''))) {
    return res.status(400).json({ error: 'Invalid phone number' })
  }

  const isCloudApi = (instance.instance_type || instance.type) === 'cloud_api'
  const otpTemplateName = await getSetting('otp_template_name', 'wabek_otp') as string
  const testCode = '123456'

  if (!isCloudApi) {
    return res.status(200).json({
      success: true,
      provider: 'wa_web',
      note: 'This instance is WA Web (Baileys) — OTP is sent as plain text, no Meta template needed.',
    })
  }

  if (!otpTemplateName) {
    return res.status(200).json({
      success: false,
      provider: 'cloud_api',
      error: 'No OTP Template Name configured. Go to Settings → Security & OTP and set "OTP Template Name" to an Approved Authentication template (e.g. "digits").',
    })
  }

  const result = await sendOtpTemplate({
    phoneNumberId: instance.phone_number_id,
    accessToken:   instance.access_token,
    to:            phone,
    templateName:  otpTemplateName,
    code:          testCode,
  })

  return res.status(200).json({
    success: result.sent,
    provider: 'cloud_api',
    templateName: otpTemplateName,
    testCode,
    usedTemplateName: result.usedTemplateName,
    usedLanguage: result.usedLanguage,
    usedComponents: result.usedComponents,
    messageId: result.messageId,
    attempts: result.attempts,
  })
}
