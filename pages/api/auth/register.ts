import { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { hashPassword, signToken, generateApiKey } from '@/lib/auth'
import { authRateLimit, logAction, getClientIp } from '@/lib/middleware'
import { getSetting } from '@/lib/settings'
import { sendOtpWhatsApp } from '@/lib/otp-sender'
import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).max(100),
  phone: z.string().optional(),
  invite_code: z.string().optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!authRateLimit(req, res)) return

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
        .select('*, reseller_plan:reseller_plan_id(base_plan_id)')
        .eq('code', body.invite_code.toUpperCase().trim())
        .eq('is_active', true)
        .single()

      if (invite && (!invite.expires_at || new Date(invite.expires_at) > new Date())) {
        if (!invite.max_uses || invite.use_count < invite.max_uses) {
          resellerId = invite.reseller_id
          inviteRecord = invite
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

    if (insertError) return res.status(500).json({ error: insertError.message })

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

      // If invite has a plan, activate it with trial
      if (inviteRecord.reseller_plan?.base_plan_id) {
        const trialExtra = inviteRecord.trial_days || 0
        const planExpiry = new Date(Date.now() + trialExtra * 24 * 60 * 60 * 1000)
        await db.from('users').update({
          plan_id: inviteRecord.reseller_plan.base_plan_id,
          plan_expires_at: planExpiry.toISOString(),
        }).eq('id', user.id)
      }
    }

    await logAction({ userId: user.id, action: 'register', ipAddress: getClientIp(req) })

    // If OTP required, send OTP and return pending state
    if (requireOtp && body.phone) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString()
      const otpHash = crypto.createHash('sha256').update(otp).digest('hex')
      const expiryMinutes = await getSetting('otp_expiry_minutes', 10) as number
      const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString()

      await db.from('otp_pending').insert({
        user_id: user.id,
        phone: body.phone,
        otp_hash: otpHash,
        purpose: 'registration',
        expires_at: expiresAt,
      })

      // Send OTP via WhatsApp
      const msg = `🔐 *WABEK Verification*\n\nWelcome ${user.name}!\n\nYour verification code: *${otp}*\n\nExpires in ${expiryMinutes} minutes.`
      await sendOtpWhatsApp(body.phone, msg)

      return res.status(201).json({
        success: true,
        requiresVerification: true,
        userId: user.id,
        message: `Verification code sent to ${body.phone}`,
      })
    }

    // No OTP required — login immediately
    const token = await signToken({ userId: user.id, email: user.email, role: user.role })
    res.setHeader('Set-Cookie', `wabek_token=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`)

    return res.status(201).json({
      success: true,
      requiresVerification: false,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      token,
    })
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid data', details: err.errors })
    return res.status(500).json({ error: 'Registration failed', details: String(err) })
  }
}
