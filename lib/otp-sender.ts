import { smartSend, isInWindow } from '@/lib/wa-smart-send'
import { supabaseAdmin } from './supabase'
import { getSetting } from './settings'
import { sendOtpTemplate } from './otp-template'
import { sendWAWebMessage } from './wa-web'

/**
 * Send a platform message (OTP code / reset link) over WhatsApp.
 *
 * ONLY the platform instance configured by the admin (`otp_instance_id`) is
 * ever used. There is deliberately no fallback to "any connected instance":
 * that would send platform OTPs (and their recipients' numbers) through a
 * random tenant's WhatsApp account. If it is missing or disconnected this
 * returns false and the caller falls back to email or fails closed.
 *
 * `code` is the OTP itself and must be passed explicitly when the message
 * carries one — it is what Cloud API Authentication templates send. Messages
 * without a code (e.g. reset links) can't be delivered via an Authentication
 * template and are only sent as text (WA Web, or Cloud API inside the 24h window).
 */
export async function sendOtpWhatsApp(phone: string, message: string, code?: string): Promise<boolean> {
  if (!phone) return false
  const db = supabaseAdmin()

  const otpInstanceId = await getSetting('otp_instance_id', '') as string
  if (!otpInstanceId) {
    console.warn('[otp-sender] otp_instance_id not configured — WhatsApp OTP unavailable')
    return false
  }

  const { data: instance } = await db.from('whatsapp_instances')
    .select('*').eq('id', otpInstanceId).eq('status', 'connected').maybeSingle()
  if (!instance) {
    console.warn('[otp-sender] configured OTP instance is missing or disconnected')
    return false
  }

  try {
    const isCloudApi = (instance.instance_type || instance.type) === 'cloud_api'

    if (isCloudApi) {
      const otpTemplateName = await getSetting('otp_template_name', 'wabek_otp') as string

      if (otpTemplateName && code) {
        const result = await sendOtpTemplate({
          phoneNumberId: instance.phone_number_id,
          accessToken:   instance.access_token,
          to:            phone,
          templateName:  otpTemplateName,
          code,
        })
        if (!result.sent) {
          // Do NOT fall back to a generic broadcast template.
          console.error('[otp-sender] all template attempts failed:', JSON.stringify(result.attempts))
          return false
        }
      } else {
        // No Authentication template usable (none configured, or no code in
        // this message). Plain text is only safe inside the 24h window.
        const inWindow = await isInWindow(instance.user_id || '', phone, instance.id || '')
        if (!inWindow) {
          console.error('[otp-sender] recipient outside 24h window and no usable OTP template — not sending')
          return false
        }
        await smartSend({ userId: instance.user_id || '', instanceId: instance.id || '', phoneNumberId: instance.phone_number_id, accessToken: instance.access_token, to: phone, text: message, source: 'api' as any, forceTemplate: false })
      }
    } else {
      await sendWAWebMessage({ instanceId: instance.id, to: phone, text: message })
    }
    return true
  } catch (e) {
    console.error('OTP send error:', e)
    return false
  }
}

/**
 * Deliver an OTP code: WhatsApp via the platform instance first, then email
 * (when an address is given and `allowEmail` is not false).
 */
export async function sendOtpCode(opts: {
  code: string
  phone?: string | null
  email?: string | null
  name?: string | null
  whatsappMessage: string
  emailSubject?: string
  allowEmail?: boolean
}): Promise<{ sent: boolean; method: 'whatsapp' | 'email' | 'none' }> {
  if (opts.phone) {
    const ok = await sendOtpWhatsApp(opts.phone, opts.whatsappMessage, opts.code)
    if (ok) return { sent: true, method: 'whatsapp' }
  }
  if (opts.email && opts.allowEmail !== false) {
    try {
      const { sendEmail, otpEmail } = await import('./email')
      const { data: brandRow } = await supabaseAdmin().from('system_settings').select('value').eq('key', 'brand_settings').maybeSingle()
      const brandName = (brandRow?.value as any)?.brand_name || 'WABEK'
      const brandColor = (brandRow?.value as any)?.brand_color || '#00D46A'
      const ok = await sendEmail({
        to: opts.email,
        subject: opts.emailSubject || `${brandName} — Verification Code`,
        html: otpEmail(opts.name || '', opts.code, brandName, brandColor),
        text: `Your verification code: ${opts.code}`,
      })
      if (ok) return { sent: true, method: 'email' }
    } catch (e) {
      console.error('[otp-sender] email fallback failed:', e)
    }
  }
  return { sent: false, method: 'none' }
}
