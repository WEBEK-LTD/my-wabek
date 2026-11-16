import { smartSend, smartSendWAWeb, isInWindow } from '@/lib/wa-smart-send'
import { supabaseAdmin } from './supabase'
import { sendOtpTemplate } from './otp-template'
import { createHash } from 'crypto'
import { randomDigits, safeEqual } from './security'

export const MAX_OTP_ATTEMPTS = 5

function sha256(v: string): string {
  return createHash('sha256').update(v).digest('hex')
}

const OTP_EXPIRY = parseInt(process.env.OTP_EXPIRY_MINUTES || '10') * 60 * 1000

export async function sendOTP(params: {
  userId: string
  phone: string
  purpose: 'verification' | 'login' | 'transaction'
  instanceId?: string
}): Promise<{ success: boolean; otpId: string }> {
  const db = supabaseAdmin()

  const otp = randomDigits(6)
  const expiresAt = new Date(Date.now() + OTP_EXPIRY).toISOString()
  const otpHash = sha256(otp)

  const { data, error } = await db.from('otp_codes').insert({
    user_id: params.userId,
    phone: params.phone,
    otp_hash: otpHash,
    purpose: params.purpose,
    expires_at: expiresAt,
    is_used: false,
  }).select().single()

  if (error) {
    console.error('[otp] insert failed:', error.message)
    throw new Error('Failed to create OTP')
  }

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
    // OTP is a system message (bypassLimits) and is never stored in the inbox.
    const r = await smartSendWAWeb({ userId: instance.user_id || params.userId, instanceId: instance.id, to: params.phone, text: message, source: 'notification', bypassLimits: true, persist: false })
    if (r.error && !r.messageId) throw new Error('Failed to send OTP via WhatsApp')
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
        const triedNames = Array.from(new Set(result.attempts.map(a => a.templateName)))
        console.error('[otp] all template attempts failed:', JSON.stringify(result.attempts))
        throw new Error(`Failed to send OTP. Tried templates: ${triedNames.join(', ')}. Last error: ${errMsg}. Go to Settings → Security & OTP and set "OTP Template Name" to an Approved Authentication template that exists in your Meta Business Manager.`)
      }
    } else {
      // No OTP template configured — only safe to send if within the 24h window
      // (otherwise smartSend would pick an unrelated broadcast template).
      const inWindow = await isInWindow((instance as any)?.user_id || (instance as any)?.userId || '', params.phone, (instance as any)?.id || '')
      if (!inWindow) {
        throw new Error('No OTP Template Name configured (Settings → Security & OTP) and the recipient is outside the 24h messaging window. Configure an Authentication template (e.g. "digits") to send OTP codes reliably.')
      }
      const r = await smartSend({ userId: (instance as any)?.user_id || (instance as any)?.userId || '', instanceId: (instance as any)?.id || '', phoneNumberId: instance.phone_number_id, accessToken: instance.access_token, to: params.phone, text: message, source: 'notification', forceTemplate: false, bypassLimits: true })
      if (r.error && !r.messageId) throw new Error('Failed to send OTP via WhatsApp')
    }
  }

  return { success: true, otpId: data.id }
}

export async function verifyOTP(params: {
  otpId: string
  otp: string
  userId?: string // when given, the OTP must belong to this user
}): Promise<{ valid: boolean; reason?: string }> {
  const db = supabaseAdmin()
  const otpHash = sha256(String(params.otp ?? ''))
  const { data } = await db.from('otp_codes').select('*').eq('id', params.otpId).maybeSingle()

  if (!data) return { valid: false, reason: 'OTP not found' }
  if (params.userId && data.user_id !== params.userId) return { valid: false, reason: 'OTP not found' }
  if (data.is_used) return { valid: false, reason: 'OTP already used' }
  if (new Date(data.expires_at) < new Date()) return { valid: false, reason: 'OTP expired' }
  const attempts = typeof data.attempts === 'number' ? data.attempts : 0
  if (attempts >= MAX_OTP_ATTEMPTS) {
    await db.from('otp_codes').update({ is_used: true }).eq('id', params.otpId)
    return { valid: false, reason: 'Too many attempts' }
  }
  if (!safeEqual(otpHash, data.otp_hash)) {
    const next = attempts + 1
    await db.from('otp_codes').update({ attempts: next, ...(next >= MAX_OTP_ATTEMPTS ? { is_used: true } : {}) }).eq('id', params.otpId)
    return { valid: false, reason: 'Invalid OTP' }
  }

  // Single use: only the request that flips is_used wins.
  const { data: consumed } = await db.from('otp_codes')
    .update({ is_used: true, used_at: new Date().toISOString() })
    .eq('id', params.otpId).eq('is_used', false)
    .select('id')
  if (!consumed?.length) return { valid: false, reason: 'OTP already used' }
  return { valid: true }
}

// ── Pending OTPs for login / registration / phone change (otp_pending) ────────
export type PendingOtpPurpose = 'login' | 'registration' | 'phone_change'

/** Create a fresh code, invalidating any earlier unused code for the same purpose. */
export async function createPendingOtp(params: {
  userId: string
  phone: string | null | undefined
  purpose: PendingOtpPurpose
  expiryMinutes: number
}): Promise<string> {
  const db = supabaseAdmin()
  await db.from('otp_pending').update({ is_used: true })
    .eq('user_id', params.userId).eq('purpose', params.purpose).eq('is_used', false)

  const code = randomDigits(6)
  const { error } = await db.from('otp_pending').insert({
    user_id: params.userId,
    phone: params.phone || '',
    otp_hash: sha256(code),
    purpose: params.purpose,
    expires_at: new Date(Date.now() + params.expiryMinutes * 60 * 1000).toISOString(),
  })
  if (error) {
    console.error('[otp] pending insert failed:', error.message)
    throw new Error('Failed to create verification code')
  }
  return code
}

/** Verify a pending code: attempts counter, invalidation after 5 failures, single use. */
export async function verifyPendingOtp(params: {
  userId: string
  purpose: PendingOtpPurpose
  otp: unknown
  phone?: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin()
  let q = db.from('otp_pending')
    .select('*')
    .eq('user_id', params.userId)
    .eq('purpose', params.purpose)
    .eq('is_used', false)
    .gt('expires_at', new Date().toISOString())
  if (params.phone !== undefined) q = q.eq('phone', params.phone)
  const { data: pending } = await q.order('created_at', { ascending: false }).limit(1)

  const rec = pending?.[0]
  if (!rec) return { ok: false, error: 'Code expired or not found. Request a new one.' }

  const attempts = typeof rec.attempts === 'number' ? rec.attempts : 0
  if (attempts >= MAX_OTP_ATTEMPTS) {
    await db.from('otp_pending').update({ is_used: true }).eq('id', rec.id)
    return { ok: false, error: 'Too many attempts. Request a new code.' }
  }

  const code = typeof params.otp === 'string' || typeof params.otp === 'number' ? String(params.otp).trim() : ''
  if (!/^\d{4,8}$/.test(code) || !safeEqual(sha256(code), rec.otp_hash)) {
    const next = attempts + 1
    await db.from('otp_pending').update({ attempts: next, ...(next >= MAX_OTP_ATTEMPTS ? { is_used: true } : {}) }).eq('id', rec.id)
    return { ok: false, error: next >= MAX_OTP_ATTEMPTS ? 'Too many attempts. Request a new code.' : 'Invalid verification code' }
  }

  const { data: consumed } = await db.from('otp_pending')
    .update({ is_used: true }).eq('id', rec.id).eq('is_used', false).select('id')
  if (!consumed?.length) return { ok: false, error: 'Code already used. Request a new one.' }
  return { ok: true }
}
