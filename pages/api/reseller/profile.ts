import { NextApiRequest, NextApiResponse } from 'next'
import { requireOwnerOrRole } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

const PAYMENT_METHODS = ['platform', 'stripe_own', 'both']
const PAYOUT_SCHEDULES = ['weekly', 'biweekly', 'monthly']
const PAYOUT_METHODS = ['bank_transfer', 'paypal', 'wise', 'crypto']
const SECRET_FIELDS = ['own_stripe_secret_key', 'own_stripe_webhook_secret', 'stripe_connect_access_token', 'stripe_connect_refresh_token']

/** Never send secrets to the browser — only whether they are configured. */
function sanitize(profile: Record<string, any> | null) {
  if (!profile) return null
  const out: Record<string, unknown> = { ...profile }
  for (const k of SECRET_FIELDS) delete out[k]
  out.has_stripe_key = !!profile.own_stripe_secret_key
  out.has_stripe_webhook_secret = !!profile.own_stripe_webhook_secret
  out.has_stripe_connect = !!profile.stripe_connect_account_id && !!profile.stripe_connect_access_token
  return out
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireOwnerOrRole(req, res)
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data } = await db.from('reseller_profiles').select('*').eq('user_id', user.userId).maybeSingle()
    const { data: referrals } = await db.from('reseller_referrals').select('*, referred_user:referred_user_id(name, email, created_at)').eq('reseller_id', user.userId)
    const { data: payouts } = await db.from('reseller_payouts').select('*').eq('reseller_id', user.userId).order('created_at', { ascending: false }).limit(10)
    return res.status(200).json({ profile: sanitize(data), referrals: referrals || [], payouts: payouts || [] })
  }

  if (req.method === 'PUT') {
    const body = req.body || {}
    const { data: existing } = await db.from('reseller_profiles').select('id').eq('user_id', user.userId).maybeSingle()

    const upsertData: Record<string, unknown> = {
      id: existing?.id || uuidv4(),
      user_id: user.userId,
      updated_at: new Date().toISOString(),
    }

    if (body.payment_method !== undefined && body.payment_method !== null) {
      if (!PAYMENT_METHODS.includes(body.payment_method)) return res.status(400).json({ error: 'Invalid payment method' })
      upsertData.payment_method = body.payment_method
    }
    if (body.payout_schedule !== undefined && body.payout_schedule !== null) {
      if (!PAYOUT_SCHEDULES.includes(body.payout_schedule)) return res.status(400).json({ error: 'Invalid payout schedule' })
      upsertData.payout_schedule = body.payout_schedule
    }
    if (body.payout_method !== undefined && body.payout_method !== null) {
      if (!PAYOUT_METHODS.includes(body.payout_method)) return res.status(400).json({ error: 'Invalid payout method' })
      upsertData.payout_method = body.payout_method
    }
    if (body.payout_details !== undefined && body.payout_details !== null) {
      if (typeof body.payout_details !== 'object' || Array.isArray(body.payout_details) || JSON.stringify(body.payout_details).length > 4000) {
        return res.status(400).json({ error: 'Invalid payout details' })
      }
      upsertData.payout_details = body.payout_details
    }

    // Stripe keys: write-only. Only replaced when a new, well-formed value is sent;
    // an empty/omitted field keeps the stored secret.
    const keyRules: [string, RegExp][] = [
      ['own_stripe_secret_key', /^(sk|rk)_(live|test)_[A-Za-z0-9]{10,255}$/],
      ['own_stripe_publishable_key', /^pk_(live|test)_[A-Za-z0-9]{10,255}$/],
      ['own_stripe_webhook_secret', /^whsec_[A-Za-z0-9]{10,255}$/],
    ]
    for (const [field, re] of keyRules) {
      const v = body[field]
      if (typeof v === 'string' && v.trim()) {
        if (!re.test(v.trim())) return res.status(400).json({ error: `Invalid ${field.replace(/_/g, ' ')}` })
        upsertData[field] = v.trim()
      }
    }

    // Only set these on new profiles (never override admin-controlled data)
    if (!existing) {
      upsertData.is_approved = false
      upsertData.balance_pending = 0
      upsertData.balance_paid = 0
      upsertData.balance_total = 0
      upsertData.referral_commission_pct = 0
      upsertData.created_at = new Date().toISOString()
    }

    const { data, error } = await db.from('reseller_profiles').upsert(upsertData, { onConflict: 'user_id' }).select().single()
    if (error) {
      console.error('[reseller/profile] upsert failed:', error.message)
      return res.status(500).json({ error: 'Could not save profile' })
    }
    return res.status(200).json({ profile: sanitize(data) })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
