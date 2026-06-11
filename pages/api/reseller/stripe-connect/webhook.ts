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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' })
  const buf = await buffer(req)

  // Stripe Connect sends account info in header
  const accountId = req.headers['stripe-account'] as string

  let event: Stripe.Event
  try {
    // For Connect webhooks, verify with webhook secret
    const sig = req.headers['stripe-signature'] as string
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_CONNECT_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return res.status(400).json({ error: 'Invalid signature' })
  }

  const db = supabaseAdmin()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const { userId, planId, resellerId, billingCycle } = session.metadata || {}

    if (!userId || !planId || !resellerId) {
      return res.status(200).json({ received: true })
    }

    // Get subscription details
    const subscription = await stripe.subscriptions.retrieve(
      session.subscription as string,
      { stripeAccount: accountId }
    )

    // Activate plan for user
    await db.from('subscriptions').upsert({
      id: uuidv4(),
      user_id: userId, plan_id: planId,
      stripe_subscription_id: subscription.id,
      status: 'active', billing_cycle: billingCycle || 'monthly',
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
    const { data: basePlanData } = await db.from('plans').select('price_monthly').eq('id', planId).single()
    const platformFee = basePlanData?.price_monthly || 0
    const resellerEarning = amount - platformFee

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

      // Update reseller balance
      const { data: rp } = await db.from('reseller_profiles').select('balance_pending, balance_total').eq('user_id', resellerId).single()
      if (rp) {
        await db.from('reseller_profiles').update({
          balance_pending: (rp.balance_pending || 0) + resellerEarning,
          balance_total: (rp.balance_total || 0) + resellerEarning,
        }).eq('user_id', resellerId)
      }

      // Update referral total_earned
      await db.from('reseller_referrals').update({
        total_earned: db.from('reseller_referrals').select('total_earned'),
      }).eq('reseller_id', resellerId).eq('referred_user_id', userId)
    }
  }

  return res.status(200).json({ received: true })
}
