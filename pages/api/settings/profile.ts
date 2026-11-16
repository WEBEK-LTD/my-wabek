import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { pick } from '@/lib/security'
import { hitRateLimit } from '@/lib/middleware'
import { getSetting } from '@/lib/settings'
import { createPendingOtp, verifyPendingOtp } from '@/lib/otp'
import { sendOtpWhatsApp } from '@/lib/otp-sender'

// The ONLY columns a user may change here. role, plan_id, sub_account_of,
// is_active, email, api_key ... are never writable through this endpoint.
const EDITABLE = ['name', 'language', 'timezone'] as const
const LANGUAGES = ['en', 'ar', 'tr', 'fr', 'es']

function normalizePhone(p: string): string {
  return p.replace(/[\s()-]/g, '')
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()
  // A team member edits their own profile, never the owner's.
  const selfId = user.actualUserId || user.userId

  if (req.method === 'GET') {
    const { data } = await db.from('users').select('id, email, name, phone, otp_mode, is_verified, last_login_at, last_login_ip, last_login_device').eq('id', selfId).maybeSingle()
    return res.status(200).json({ user: data })
  }

  if (req.method === 'PUT') {
    const body = req.body || {}
    const updates: Record<string, unknown> = pick(body, EDITABLE)

    if ('name' in updates) {
      if (typeof updates.name !== 'string' || updates.name.trim().length < 1 || updates.name.length > 100) {
        return res.status(400).json({ error: 'Invalid name' })
      }
      updates.name = (updates.name as string).trim()
    }
    if ('language' in updates && !LANGUAGES.includes(updates.language as string)) {
      return res.status(400).json({ error: 'Invalid language' })
    }
    if ('timezone' in updates && (typeof updates.timezone !== 'string' || updates.timezone.length > 64)) {
      return res.status(400).json({ error: 'Invalid timezone' })
    }

    const { data: current } = await db.from('users').select('phone').eq('id', selfId).maybeSingle()
    if (!current) return res.status(404).json({ error: 'User not found' })

    // ── Phone change: must be proven with an OTP sent to the NEW number ──────
    let phoneStatus: 'unchanged' | 'verification_sent' | 'updated' | 'removed' = 'unchanged'
    if (body.phone !== undefined && body.phone !== null) {
      if (typeof body.phone !== 'string') return res.status(400).json({ error: 'Invalid phone' })
      const newPhone = normalizePhone(body.phone.trim())
      const oldPhone = current.phone ? normalizePhone(current.phone) : ''

      if (newPhone !== oldPhone) {
        if (newPhone && !/^\+?\d{6,15}$/.test(newPhone)) return res.status(400).json({ error: 'Invalid phone number' })

        // New number → code goes to the new number. Removing the number →
        // code goes to the current number.
        const target = newPhone || oldPhone
        if (body.phone_otp) {
          if (!(await hitRateLimit(`phone-verify:${selfId}`, 10, 15 * 60))) {
            return res.status(429).json({ error: 'Too many attempts. Please try again later.' })
          }
          const check = await verifyPendingOtp({ userId: selfId, purpose: 'phone_change', otp: body.phone_otp, phone: target })
          if (!check.ok) return res.status(400).json({ error: check.error, requiresPhoneVerification: true })
          updates.phone = newPhone || null
          phoneStatus = newPhone ? 'updated' : 'removed'
        } else {
          if (!(await hitRateLimit(`otp-send:${selfId}`, 5, 15 * 60))) {
            return res.status(429).json({ error: 'Too many verification codes requested. Please try again later.' })
          }
          const expiryMinutes = Number(await getSetting('otp_expiry_minutes', 10)) || 10
          const code = await createPendingOtp({ userId: selfId, phone: target, purpose: 'phone_change', expiryMinutes })
          const sent = await sendOtpWhatsApp(target, `🔐 *WABEK Phone Verification*\n\nYour code: *${code}*\n\nExpires in ${expiryMinutes} minutes. Do not share this code.`, code)
          if (!sent) {
            return res.status(503).json({ error: 'Could not send a verification code to this number. Please try again later.' })
          }
          phoneStatus = 'verification_sent'
        }
      }
    }

    let data: Record<string, unknown> | null = null
    if (Object.keys(updates).length) {
      const r = await db.from('users')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', selfId)
        .select('id, email, name, phone, language, timezone')
        .single()
      if (r.error) {
        console.error('[settings/profile] update failed:', r.error.message)
        return res.status(500).json({ error: 'Could not update profile' })
      }
      data = r.data
    } else {
      const r = await db.from('users').select('id, email, name, phone, language, timezone').eq('id', selfId).maybeSingle()
      data = r.data
    }

    if (phoneStatus === 'verification_sent') {
      return res.status(202).json({
        user: data,
        requiresPhoneVerification: true,
        message: 'We sent a verification code by WhatsApp. Submit it as phone_otp together with the phone number to confirm the change.',
      })
    }
    return res.status(200).json({ user: data, phone: phoneStatus })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
