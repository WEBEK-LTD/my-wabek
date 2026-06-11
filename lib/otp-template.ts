import { sendTemplateMessage } from './whatsapp'

export interface OtpTemplateAttempt {
  templateName: string
  language: string
  components: string // human-readable label
  ok: boolean
  status?: number
  error?: string
}

export interface OtpTemplateResult {
  sent: boolean
  messageId?: string | null
  usedTemplateName?: string
  usedLanguage?: string
  usedComponents?: string
  attempts: OtpTemplateAttempt[]
}

// Component shapes to try, ordered by likelihood of matching common
// Authentication template designs (named "otp_code" parameter is most
// common for templates created via the WABEK template generator; "digits"
// uses positional {{1}}).
const VARIANTS: { label: string; components: (code: string) => any[] }[] = [
  {
    label: 'body (named param: otp_code)',
    components: (code) => [
      { type: 'body', parameters: [{ type: 'text', parameter_name: 'otp_code', text: code }] },
    ],
  },
  {
    label: 'body (named param: otp_code) + url button',
    components: (code) => [
      { type: 'body', parameters: [{ type: 'text', parameter_name: 'otp_code', text: code }] },
      { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
    ],
  },
  {
    label: 'body only',
    components: (code) => [
      { type: 'body', parameters: [{ type: 'text', text: code }] },
    ],
  },
  {
    label: 'body + url button',
    components: (code) => [
      { type: 'body', parameters: [{ type: 'text', text: code }] },
      { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
    ],
  },
  {
    label: 'body + copy_code button',
    components: (code) => [
      { type: 'body', parameters: [{ type: 'text', text: code }] },
      { type: 'button', sub_type: 'copy_code', index: '0', parameters: [{ type: 'coupon_code', coupon_code: code }] },
    ],
  },
  {
    label: 'body (named param: otp_code) + copy_code button',
    components: (code) => [
      { type: 'body', parameters: [{ type: 'text', parameter_name: 'otp_code', text: code }] },
      { type: 'button', sub_type: 'copy_code', index: '0', parameters: [{ type: 'coupon_code', coupon_code: code }] },
    ],
  },
]

const LANGUAGES = ['en', 'en_US', 'en_GB']

// Common Authentication template names used as fallbacks if the configured
// otp_template_name doesn't exist on this account's WABA (error 132001).
// Different WABEK accounts may have approved differently-named templates.
const FALLBACK_TEMPLATE_NAMES = ['wabek_otp', 'digits', 'otp_verification', 'authentication']

/**
 * Send a one-time-password code via a Meta-approved Authentication template.
 *
 * Tries the configured template name first with the full matrix of
 * component shapes + language codes. If that template name doesn't exist
 * on this account's WhatsApp Business Account at all (error 132001), it
 * automatically tries other common template names (wabek_otp, digits, etc.)
 * with a smaller matrix -- since different WABEK accounts may have approved
 * differently-named OTP templates.
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
  const attempts: OtpTemplateAttempt[] = []

  async function tryTemplate(name: string, variants: typeof VARIANTS, languages: string[]): Promise<OtpTemplateResult | null> {
    let templateMissing = true // becomes false if any non-132001 error occurs (template exists but other issue)

    for (const language of languages) {
      for (const variant of variants) {
        try {
          const result: any = await sendTemplateMessage({
            phoneNumberId,
            accessToken,
            to,
            templateName: name,
            languageCode: language,
            components: variant.components(code),
          })
          attempts.push({ templateName: name, language, components: variant.label, ok: true })
          return {
            sent: true,
            messageId: result?.messages?.[0]?.id || null,
            usedTemplateName: name,
            usedLanguage: language,
            usedComponents: variant.label,
            attempts,
          }
        } catch (err: any) {
          const status = err?.response?.status
          const errBody = err?.response?.data?.error
          const code_ = errBody?.code
          const errMsg = errBody?.message || err?.message || 'Unknown error'
          attempts.push({ templateName: name, language, components: variant.label, ok: false, status, error: errMsg })
          if (code_ !== 132001) templateMissing = false
        }
      }
    }
    // Returning null with templateMissing=true signals "try another template name"
    return templateMissing ? null : { sent: false, attempts }
  }

  // 1. Try the configured/primary template name with the full matrix
  const primary = await tryTemplate(templateName, VARIANTS, LANGUAGES)
  if (primary) return primary

  // 2. Primary template doesn't exist on this account at all (132001 for every
  //    attempt) -- try other common template names with a reduced matrix
  //    (top 2 component shapes, 2 languages) to keep total calls bounded.
  const reducedVariants = VARIANTS.slice(0, 2)
  const reducedLanguages = LANGUAGES.slice(0, 2)

  for (const fallbackName of FALLBACK_TEMPLATE_NAMES) {
    if (fallbackName === templateName) continue // already tried above
    const result = await tryTemplate(fallbackName, reducedVariants, reducedLanguages)
    if (result) return result
  }

  return { sent: false, attempts }
}
