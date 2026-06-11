import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data } = await db.from('reseller_profiles').select('*').eq('user_id', user.userId).maybeSingle()
    const { data: referrals } = await db.from('reseller_referrals').select('*, referred_user:referred_user_id(name, email, created_at)').eq('reseller_id', user.userId)
    const { data: payouts } = await db.from('reseller_payouts').select('*').eq('reseller_id', user.userId).order('created_at', { ascending: false }).limit(10)
    return res.status(200).json({ profile: data || null, referrals: referrals || [], payouts: payouts || [] })
  }

  if (req.method === 'PUT') {
    const { payment_method, own_stripe_secret_key, own_stripe_publishable_key, own_stripe_webhook_secret, payout_schedule, payout_method, payout_details } = req.body

    // Check if profile exists
    const { data: existing } = await db.from('reseller_profiles').select('id, is_approved').eq('user_id', user.userId).maybeSingle()

    const upsertData: Record<string, unknown> = {
      id: existing?.id || uuidv4(),
      user_id: user.userId,
      payment_method, own_stripe_secret_key, own_stripe_publishable_key, own_stripe_webhook_secret,
      payout_schedule, payout_method, payout_details,
      updated_at: new Date().toISOString(),
    }
    // Only set these on new profiles (don't override admin data)
    if (!existing) {
      upsertData.is_approved = false
      upsertData.balance_pending = 0
      upsertData.balance_paid = 0
      upsertData.balance_total = 0
      upsertData.referral_commission_pct = 0
      upsertData.created_at = new Date().toISOString()
    }

    const { data, error } = await db.from('reseller_profiles').upsert(upsertData, { onConflict: 'user_id' }).select().single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ profile: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
