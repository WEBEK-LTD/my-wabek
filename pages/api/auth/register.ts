import { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { hashPassword, issueSession, generateApiKey } from '@/lib/auth'
import { authRateLimitAsync, hitRateLimit, logAction, getClientIp } from '@/lib/middleware'
import { getSetting } from '@/lib/settings'
import { sendOtpCode } from '@/lib/otp-sender'
import { createPendingOtp } from '@/lib/otp'
import { v4 as uuidv4 } from 'uuid'

const MAX_INVITE_TRIAL_DAYS = 30

const schema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(256),
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{6,24}$/).optional().or(z.literal('')),
  invite_code: z.string().trim().max(64).optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!(await authRateLimitAsync(req, res))) return
  if (!(await hitRateLimit(`register:${getClientIp(req)}`, 10, 60 * 60))) {
    return res.status(429).json({ error: 'Too many registrations from this network. Please try again later.' })
  }

  try {
    const body = schema.parse(req.body)
    const db = supabaseAdmin()

    // Check if registration is allowed
    const allowReg = await getSetting('allow_registration', 'true')
    if (allowReg === 'false' || allowReg === false) {
      return res.status(403).json({ error: 'Registration is currently disabled' })
    }

    // Check email exists
    const { data: existing } = await db.from('users').select('id').eq('email', body.email.toLowerCase()).limit(1)
    if (existing?.length) return res.status(409).json({ error: 'Email already registered' })

    const passwordHash = await hashPassword(body.password)
    const { key: apiKey } = generateApiKey()
    const { data: freePlan } = await db.from('plans').select('id').eq('name', 'Free').limit(1)
    const trialDays = await getSetting('default_trial_days', 14) as number
    const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString()

    // Check if OTP required on register
    const otpRequired = await getSetting('otp_required_on_register', 'false')
    const requireOtp = (otpRequired === 'true' || otpRequired === true) && body.phone

    // Handle reseller invite code
    let resellerId: string | null = null
    let inviteRecord: any = null
    if (body.invite_code) {
      const { data: invite } = await db.from('reseller_invites')
        .select('*, reseller_plan:reseller_plan_id(id, reseller_id, base_plan_id, is_active)')
        .eq('code', body.invite_code.toUpperCase().trim())
        .eq('is_active', true)
        .maybeSingle()

      if (invite && (!invite.expires_at || new Date(invite.expires_at) > new Date())) {
        if (!invite.max_uses || invite.use_count < invite.max_uses) {
          // Only approved resellers can refer users / grant trials.
          const { data: rp } = await db.from('reseller_profiles')
            .select('is_approved').eq('user_id', invite.reseller_id).maybeSingle()
          if (rp?.is_approved) {
            resellerId = invite.reseller_id
            inviteRecord = invite
          }
        }
      }
    }

    const { data: user, error: insertError } = await db.from('users').insert({
      id: uuidv4(),
      email: body.email.toLowerCase(),
      name: body.name,
      phone: body.phone || null,
      password_hash: passwordHash,
      role: 'user',
      plan_id: freePlan?.[0]?.id || null,
      api_key: apiKey,
      is_active: true,
      is_verified: !requireOtp,
      trial_ends_at: trialEndsAt,
      referred_by: resellerId,
    }).select().single()

    if (insertError || !user) {
      console.error('[register] insert failed:', insertError?.message)
      return res.status(500).json({ error: 'Registration failed' })
    }

    // Activate reseller invite
    if (inviteRecord && user) {
      // Update invite use count
      await db.from('reseller_invites').update({
        use_count: (inviteRecord.use_count || 0) + 1,
      }).eq('id', inviteRecord.id)

      // Create referral record
      await db.from('reseller_referrals').insert({
        id: uuidv4(),
        reseller_id: inviteRecord.reseller_id,
        referred_user_id: user.id,
        invite_code: inviteRecord.code,
        total_earned: 0,
      }).select().maybeSingle()

      // If invite has a plan, activate it with a (capped) trial — but only if
      // the reseller plan really belongs to this reseller and both it and the
      // base plan are active.
      const rplan = inviteRecord.reseller_plan
      const trialDays = Math.min(Math.max(parseInt(String(inviteRecord.trial_days || 0), 10) || 0, 0), MAX_INVITE_TRIAL_DAYS)
      if (rplan?.base_plan_id && rplan.reseller_id === inviteRecord.reseller_id && rplan.is_active !== false && trialDays > 0) {
        const { data: basePlan } = await db.from('plans').select('id, is_active').eq('id', rplan.base_plan_id).maybeSingle()
        if (basePlan && basePlan.is_active !== false) {
          const planExpiry = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000)
          await db.from('users').update({
            plan_id: basePlan.id,
            plan_expires_at: planExpiry.toISOString(),
          }).eq('id', user.id)
        }
      }
    }

    await logAction({ userId: user.id, action: 'register', ipAddress: getClientIp(req) })

    // If OTP required, send OTP and return pending state
    if (requireOtp && body.phone) {
      const expiryMinutes = Number(await getSetting('otp_expiry_minutes', 10)) || 10
      const otp = await createPendingOtp({ userId: user.id, phone: body.phone, purpose: 'registration', expiryMinutes })
      await sendOtpCode({
        code: otp,
        phone: body.phone,
        email: user.email,
        name: user.name,
        whatsappMessage: `🔐 *WABEK Verification*\n\nWelcome!\n\nYour verification code: *${otp}*\n\nExpires in ${expiryMinutes} minutes.`,
      })

      return res.status(201).json({
        success: true,
        requiresVerification: true,
        userId: user.id,
        message: `Verification code sent to ${body.phone}`,
      })
    }

    // No OTP required — login immediately
    const token = await issueSession(res, user)

    return res.status(201).json({
      success: true,
      requiresVerification: false,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      token,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: err.errors.map(e => ({ path: e.path, message: e.message })) })
    }
    console.error('[register] error:', err)
    return res.status(500).json({ error: 'Registration failed' })
  }
}
