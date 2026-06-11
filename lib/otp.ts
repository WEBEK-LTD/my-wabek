import { smartSend, smartSendWAWeb, isInWindow } from '@/lib/wa-smart-send'
import { supabaseAdmin } from './supabase'
import { sendOtpTemplate } from './otp-template'
import { sendWAWebMessage } from './wa-web'
import { randomInt } from 'crypto'
import { createHash } from 'crypto'

const OTP_EXPIRY = parseInt(process.env.OTP_EXPIRY_MINUTES || '10') * 60 * 1000

export async function sendOTP(params: {
  userId: string
  phone: string
  purpose: 'verification' | 'login' | 'transaction'
  instanceId?: string
}): Promise<{ success: boolean; otpId: string }> {
  const db = supabaseAdmin()

  const otp = randomInt(100000, 999999).toString()
  const expiresAt = new Date(Date.now() + OTP_EXPIRY).toISOString()
  const otpHash = createHash('sha256').update(otp).digest('hex')

  const { data, error } = await db.from('otp_codes').insert({
    user_id: params.userId,
    phone: params.phone,
    otp_hash: otpHash,
    purpose: params.purpose,
    expires_at: expiresAt,
    is_used: false,
  }).select().single()

  if (error) throw new Error(`DB error: ${error.message}`)

  // Get WhatsApp instance for OTP:
  // 1. Check if admin configured a global OTP instance (WABEK's own number)
  // 2. Fallback to user's own connected instance
  const { getSetting: getGlobalSetting } = await import('./settings')
  const globalOtpInstanceId = await getGlobalSetting('global_otp_instance_id', '') as string

  let instance = null

  if (globalOtpInstanceId) {
    // Use WABEK's global OTP sender (admin configured)
    const { data: globalInstance } = await db
      .from('whatsapp_instances')
      .select('*')
      .eq('id', globalOtpInstanceId)
      .eq('status', 'connected')
      .single()
    instance = globalInstance
  }

  if (!instance) {
    // Fallback: user's own instance — prefer WA Web
    const { data: allInstances } = await db
      .from('whatsapp_instances')
      .select('*')
      .eq('user_id', params.userId)
      .eq('status', 'connected')
    instance = allInstances?.find(i => i.instance_type === 'wa_web') || allInstances?.[0]
  }
  if (!instance) throw new Error('No connected WhatsApp instance found')

  const message = `🔐 *WABEK Verification Code*\n\nYour code: *${otp}*\n\nValid for ${process.env.OTP_EXPIRY_MINUTES || 10} minutes.\n\nDo not share this code.`

  // Prefer WA Web for OTP (no template restrictions)
  // Fall back to Cloud API with template if only cloud_api available
  const isWAWeb = instance.instance_type === 'wa_web'

  if (isWAWeb) {
    await sendWAWebMessage({ instanceId: instance.id, to: params.phone, text: message })
  } else {
    // Cloud API — try template first, then text
    const { getSetting } = await import('./settings')
    const otpTemplateName = await getSetting('otp_template_name', 'wabek_otp') as string

    if (otpTemplateName) {
      const result = await sendOtpTemplate({
        phoneNumberId: instance.phone_number_id,
        accessToken:   instance.access_token,
        to:            params.phone,
        templateName:  otpTemplateName,
        code:          otp,
      })

      if (!result.sent) {
        // IMPORTANT: do NOT fall back to smartSend's generic BROADCAST template here.
        // Sending the wrong template (e.g. a marketing/broadcast message) instead of
        // the OTP code is worse than failing outright. Surface a clear error instead.
        const lastAttempt = result.attempts[result.attempts.length - 1]
        const errMsg = lastAttempt?.error || 'Unknown error'
        console.error('[otp] all template attempts failed:', JSON.stringify(result.attempts))
        throw new Error(`Failed to send OTP via template "${otpTemplateName}": ${errMsg}. Check Settings → Security & OTP → OTP Template Name matches an Approved Authentication template in Meta Business Manager.`)
      }
    } else {
      // No OTP template configured — only safe to send if within the 24h window
      // (otherwise smartSend would pick an unrelated broadcast template).
      const inWindow = await isInWindow((instance as any)?.user_id || (instance as any)?.userId || '', params.phone, (instance as any)?.id || '')
      if (!inWindow) {
        throw new Error('No OTP Template Name configured (Settings → Security & OTP) and the recipient is outside the 24h messaging window. Configure an Authentication template (e.g. "digits") to send OTP codes reliably.')
      }
      await smartSend({ userId: (instance as any)?.user_id || (instance as any)?.userId || '', instanceId: (instance as any)?.id || '', phoneNumberId: instance.phone_number_id, accessToken: instance.access_token, to: params.phone, text: message, source: 'api' as any, forceTemplate: false })
    }
  }

  return { success: true, otpId: data.id }
}

export async function verifyOTP(params: {
  otpId: string
  otp: string
}): Promise<{ valid: boolean; reason?: string }> {
  const db = supabaseAdmin()
  const otpHash = createHash('sha256').update(params.otp).digest('hex')
  const { data } = await db.from('otp_codes').select('*').eq('id', params.otpId).single()

  if (!data) return { valid: false, reason: 'OTP not found' }
  if (data.is_used) return { valid: false, reason: 'OTP already used' }
  if (new Date(data.expires_at) < new Date()) return { valid: false, reason: 'OTP expired' }
  if (data.otp_hash !== otpHash) return { valid: false, reason: 'Invalid OTP' }

  await db.from('otp_codes').update({ is_used: true, used_at: new Date().toISOString() }).eq('id', params.otpId)
  return { valid: true }
}
