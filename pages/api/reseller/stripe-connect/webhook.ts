import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import Stripe from 'stripe'
import { v4 as uuidv4 } from 'uuid'

export const config = { api: { bodyParser: false } }

async function buffer(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req as unknown as AsyncIterable<Buffer>) chunks.push(chunk)
  return Buffer.concat(chunks)
}

/** Atomic balance/earning increments (migration 027), with a safe fallback. */
async function addResellerEarning(db: ReturnType<typeof supabaseAdmin>, resellerId: string, referredUserId: string, amount: number) {
  const { error } = await db.rpc('reseller_add_earning', {
    p_reseller_id: resellerId, p_referred_user_id: referredUserId, p_amount: amount,
  })
  if (!error) return
  console.error('[connect-webhook] reseller_add_earning rpc failed, using fallback:', error.message)
  const { data: rp } = await db.from('reseller_profiles').select('balance_pending, balance_total').eq('user_id', resellerId).maybeSingle()
  if (rp) {
    await db.from('reseller_profiles').update({
      balance_pending: Number(rp.balance_pending || 0) + amount,
      balance_total: Number(rp.balance_total || 0) + amount,
    }).eq('user_id', resellerId)
  }
  const { data: ref } = await db.from('reseller_referrals').select('total_earned')
    .eq('reseller_id', resellerId).eq('referred_user_id', referredUserId).maybeSingle()
  if (ref) {
    await db.from('reseller_referrals').update({ total_earned: Number(ref.total_earned || 0) + amount })
      .eq('reseller_id', resellerId).eq('referred_user_id', referredUserId)
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Dedicated secret for the Connect endpoint — never the platform webhook secret.
  const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!webhookSecret || !stripeKey) {
    console.error('[connect-webhook] STRIPE_CONNECT_WEBHOOK_SECRET / STRIPE_SECRET_KEY not configured')
    return res.status(500).json({ error: 'Webhook not configured' })
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })
  const buf = await buffer(req)

  let event: Stripe.Event
  try {
    const sig = req.headers['stripe-signature']
    if (typeof sig !== 'string') throw new Error('missing signature')
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret)
  } catch {
    return res.status(400).json({ error: 'Invalid signature' })
  }

  // The connected account comes from the signed event, not from a header.
  const accountId = event.account
  if (!accountId) return res.status(200).json({ received: true, ignored: 'not a connect event' })

  const db = supabaseAdmin()

  // Idempotency: first writer wins; duplicates are acknowledged and skipped.
  const { error: dupErr } = await db.from('processed_stripe_events').insert({ id: event.id })
  if (dupErr) {
    if ((dupErr as { code?: string }).code === '23505') return res.status(200).json({ received: true, duplicate: true })
    console.error('[connect-webhook] idempotency insert failed:', dupErr.message)
    return res.status(500).json({ error: 'Temporary error' })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const { userId, planId, resellerId, billingCycle } = session.metadata || {}

      if (!userId || !planId || !resellerId || session.mode !== 'subscription' || !session.subscription) {
        return res.status(200).json({ received: true })
      }
      if (session.payment_status === 'unpaid') return res.status(200).json({ received: true })

      // The connected account must belong to the reseller named in metadata,
      // the user must be that reseller's referral, and the plan must be one
      // the reseller actually sells. Metadata alone is never trusted.
      const { data: profile } = await db.from('reseller_profiles').select('user_id')
        .eq('stripe_connect_account_id', accountId).maybeSingle()
      if (!profile || profile.user_id !== resellerId) {
        console.warn('[connect-webhook] account/reseller mismatch for event', event.id)
        return res.status(200).json({ received: true })
      }
      const { data: referral } = await db.from('reseller_referrals').select('id')
        .eq('reseller_id', resellerId).eq('referred_user_id', userId).maybeSingle()
      if (!referral) {
        console.warn('[connect-webhook] user is not a referral of reseller, event', event.id)
        return res.status(200).json({ received: true })
      }
      const { data: rplan } = await db.from('reseller_plans').select('id')
        .eq('reseller_id', resellerId).eq('base_plan_id', planId).eq('is_active', true).maybeSingle()
      if (!rplan) {
        console.warn('[connect-webhook] plan not offered by reseller, event', event.id)
        return res.status(200).json({ received: true })
      }

      const subscription = await stripe.subscriptions.retrieve(
        session.subscription as string,
        { stripeAccount: accountId }
      )

      await db.from('subscriptions').upsert({
        id: uuidv4(),
        user_id: userId, plan_id: planId,
        stripe_subscription_id: subscription.id,
        status: 'active', billing_cycle: billingCycle === 'yearly' ? 'yearly' : 'monthly',
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: false,
      }, { onConflict: 'user_id' })

      await db.from('users').update({
        plan_id: planId,
        plan_expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
      }).eq('id', userId)

      // Record earning for reseller
      const amount = (session.amount_total || 0) / 100
      const { data: basePlanData } = await db.from('plans').select('price_monthly').eq('id', planId).maybeSingle()
      const platformFee = Number(basePlanData?.price_monthly || 0)
      const resellerEarning = Math.round((amount - platformFee) * 100) / 100

      if (resellerEarning > 0) {
        await db.from('reseller_earnings').insert({
          id: uuidv4(),
          reseller_id: resellerId,
          referred_user_id: userId,
          amount: resellerEarning,
          gross_amount: amount,
          platform_fee: platformFee,
          source: 'subscription',
          payment_ref: session.id,
        })
        await addResellerEarning(db, resellerId, userId, resellerEarning)
      }
    }

    return res.status(200).json({ received: true })
  } catch (err) {
    console.error('[connect-webhook] processing failed:', err)
    // Allow Stripe to retry this event.
    await db.from('processed_stripe_events').delete().eq('id', event.id)
    return res.status(500).json({ error: 'Processing failed' })
  }
}
