import { sendTemplateMessage } from './whatsapp'

export interface OtpTemplateAttempt {
  language: string
  components: string // human-readable label
  ok: boolean
  status?: number
  error?: string
}

export interface OtpTemplateResult {
  sent: boolean
  messageId?: string | null
  usedLanguage?: string
  usedComponents?: string
  attempts: OtpTemplateAttempt[]
}

/**
 * Send a one-time-password code via a Meta-approved Authentication template
 * (e.g. "digits"). Tries a few common language codes and component shapes,
 * since Meta Authentication templates are sometimes approved as "en_US"
 * rather than "en", and sometimes require a copy-code button parameter in
 * addition to the body parameter.
 *
 * Returns full attempt diagnostics so admins can see exactly what was tried
 * and why it failed (instead of silently sending the wrong template).
 */
export async function sendOtpTemplate(params: {
  phoneNumberId: string
  accessToken: string
  to: string
  templateName: string
  code: string
}): Promise<OtpTemplateResult> {
  const { phoneNumberId, accessToken, to, templateName, code } = params

  const variants: { label: string; components: any[] }[] = [
    {
      label: 'body (named param: otp_code)',
      components: [
        { type: 'body', parameters: [{ type: 'text', parameter_name: 'otp_code', text: code }] },
      ],
    },
    {
      label: 'body (named param: otp_code) + url button',
      components: [
        { type: 'body', parameters: [{ type: 'text', parameter_name: 'otp_code', text: code }] },
        { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
      ],
    },
    {
      label: 'body only',
      components: [
        { type: 'body', parameters: [{ type: 'text', text: code }] },
      ],
    },
    {
      label: 'body + url button',
      components: [
        { type: 'body', parameters: [{ type: 'text', text: code }] },
        { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
      ],
    },
    {
      label: 'body + copy_code button',
      components: [
        { type: 'body', parameters: [{ type: 'text', text: code }] },
        { type: 'button', sub_type: 'copy_code', index: '0', parameters: [{ type: 'coupon_code', coupon_code: code }] },
      ],
    },
    {
      label: 'body (named param: otp_code) + copy_code button',
      components: [
        { type: 'body', parameters: [{ type: 'text', parameter_name: 'otp_code', text: code }] },
        { type: 'button', sub_type: 'copy_code', index: '0', parameters: [{ type: 'coupon_code', coupon_code: code }] },
      ],
    },
  ]

  const languages = ['en', 'en_US', 'en_GB']
  const attempts: OtpTemplateAttempt[] = []

  for (const language of languages) {
    for (const variant of variants) {
      try {
        const result: any = await sendTemplateMessage({
          phoneNumberId,
          accessToken,
          to,
          templateName,
          languageCode: language,
          components: variant.components,
        })
        attempts.push({ language, components: variant.label, ok: true })
        return {
          sent: true,
          messageId: result?.messages?.[0]?.id || null,
          usedLanguage: language,
          usedComponents: variant.label,
          attempts,
        }
      } catch (err: any) {
        const status = err?.response?.status
        const errBody = err?.response?.data?.error
        const errMsg = errBody?.message || err?.message || 'Unknown error'
        attempts.push({ language, components: variant.label, ok: false, status, error: errMsg })
      }
    }
  }

  return { sent: false, attempts }
}
