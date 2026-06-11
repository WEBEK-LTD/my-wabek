import { smartSend, smartSendWAWeb, isInWindow } from '@/lib/wa-smart-send'
import { supabaseAdmin } from './supabase'
import { getSetting } from './settings'
import { sendOtpTemplate } from './otp-template'
import { sendWAWebMessage } from './wa-web'

export async function sendOtpWhatsApp(phone: string, message: string): Promise<boolean> {
  const db = supabaseAdmin()

  // Get configured OTP instance from admin settings
  const otpInstanceId = await getSetting('otp_instance_id', '') as string

  let instance = null

  if (otpInstanceId) {
    const { data } = await db.from('whatsapp_instances').select('*').eq('id', otpInstanceId).eq('status', 'connected').single()
    instance = data
  }

  // Fallback to first connected instance
  if (!instance) {
    const { data: instances } = await db.from('whatsapp_instances').select('*').eq('status', 'connected').limit(1)
    instance = instances?.[0]
  }

  if (!instance) return false

  try {
    const isCloudApi = (instance.instance_type || instance.type) === 'cloud_api'

    if (isCloudApi) {
      // Extract OTP code from message (6-digit number)
      const codeMatch = message.match(/\b(\d{6})\b/)
      const otpCode = codeMatch ? codeMatch[1] : message

      // Get OTP template name from settings (default: 'wabek_otp' or use authentication category)
      const otpTemplateName = await getSetting('otp_template_name', 'wabek_otp') as string

      if (otpTemplateName) {
        const result = await sendOtpTemplate({
          phoneNumberId: instance.phone_number_id,
          accessToken:   instance.access_token,
          to:            phone,
          templateName:  otpTemplateName,
          code:          otpCode,
        })

        if (!result.sent) {
          // Do NOT fall back to a generic broadcast template — that sends
          // the wrong message entirely. Surface the failure instead.
          console.error('[otp-sender] all template attempts failed:', JSON.stringify(result.attempts))
          return false
        }
      } else {
        // No OTP template configured. Only safe to send plain text if the
        // recipient is within the 24h window — otherwise smartSend would
        // pick an unrelated broadcast/marketing template.
        const inWindow = await isInWindow((instance as any)?.user_id || (instance as any)?.userId || '', phone, (instance as any)?.id || '')
        if (!inWindow) {
          console.error('[otp-sender] No otp_template_name configured and recipient outside 24h window — refusing to send via wrong template')
          return false
        }
        await smartSend({ userId: (instance as any)?.user_id || (instance as any)?.userId || '', instanceId: (instance as any)?.id || '', phoneNumberId: instance.phone_number_id, accessToken: instance.access_token, to: phone, text: message, source: 'api' as any, forceTemplate: false })
      }
    } else {
      // WA Web — send text directly
      await sendWAWebMessage({ instanceId: instance.id, to: phone, text: message })
    }
    return true
  } catch (e) {
    console.error('OTP send error:', e)
    return false
  }
}
