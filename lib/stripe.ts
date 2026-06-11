import Stripe from 'stripe'
import { supabaseAdmin } from './supabase'
import { v4 as uuidv4 } from 'uuid'

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured')
  return new Stripe(key, { apiVersion: '2023-10-16' })
}

export async function createCheckoutSession(params: {
  userId: string
  email: string
  planId: string
  priceId: string
  billingCycle: 'monthly' | 'yearly'
  successUrl: string
  cancelUrl: string
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe()
  const db = supabaseAdmin()
  const { data: user } = await db.from('users').select('stripe_customer_id, referred_by').eq('id', params.userId).single()

  let customerId = user?.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({ email: params.email, metadata: { userId: params.userId } })
    customerId = customer.id
    await db.from('users').update({ stripe_customer_id: customerId }).eq('id', params.userId)
  }

  return stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    mode: 'subscription',
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      userId: params.userId,
      planId: params.planId,
      billingCycle: params.billingCycle,
      resellerId: user?.referred_by || '',
    },
    subscription_data: { metadata: { userId: params.userId, planId: params.planId, resellerId: user?.referred_by || '' } },
    allow_promotion_codes: true,
  })
}

export async function createPortalSession(params: { userId: string; returnUrl: string }): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripe()
  const db = supabaseAdmin()
  const { data: user } = await db.from('users').select('stripe_customer_id').eq('id', params.userId).single()
  if (!user?.stripe_customer_id) throw new Error('No Stripe customer found')
  return stripe.billingPortal.sessions.create({ customer: user.stripe_customer_id, return_url: params.returnUrl })
}

export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  const stripe = getStripe()
  const db = supabaseAdmin()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const { userId, planId, billingCycle, resellerId } = session.metadata || {}
      if (!userId || !planId) break

      const subscription = await stripe.subscriptions.retrieve(session.subscription as string)

      await db.from('subscriptions').upsert({
        user_id: userId, plan_id: planId,
        stripe_subscription_id: subscription.id, status: 'active',
        billing_cycle: billingCycle as 'monthly' | 'yearly',
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
      })
      await db.from('users').update({
        plan_id: planId,
        plan_expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
      }).eq('id', userId)

      // Track reseller earnings (platform billing)
      if (resellerId) {
        await trackResellerEarning(db, resellerId, userId, planId, session.amount_total || 0)
      }
      break
    }

    case 'invoice.payment_succeeded': {
      // Recurring payment - track reseller commission
      const invoice = event.data.object as Stripe.Invoice
      const sub = await stripe.subscriptions.retrieve(invoice.subscription as string)
      const { userId, planId, resellerId } = sub.metadata || {}

      if (userId && planId) {
        await db.from('subscriptions').update({
          status: 'active',
          current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        }).eq('stripe_subscription_id', sub.id)

        await db.from('users').update({
          plan_expires_at: new Date(sub.current_period_end * 1000).toISOString(),
        }).eq('id', userId)

        // Track recurring commission
        if (resellerId && invoice.amount_paid > 0) {
          await trackResellerEarning(db, resellerId, userId, planId, invoice.amount_paid)
        }
      }
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      await db.from('subscriptions').update({
        status: sub.status as 'active' | 'cancelled' | 'past_due' | 'trialing',
        current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        cancel_at_period_end: sub.cancel_at_period_end,
      }).eq('stripe_subscription_id', sub.id)
      if (sub.metadata?.userId) {
        if (sub.status === 'past_due' || sub.status === 'unpaid' || sub.status === 'incomplete_expired') {
          // Revoke access immediately on non-payment
          await db.from('users').update({ plan_id: null, plan_expires_at: null }).eq('id', sub.metadata.userId)
        } else {
          await db.from('users').update({ plan_expires_at: new Date(sub.current_period_end * 1000).toISOString() }).eq('id', sub.metadata.userId)
        }
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await db.from('subscriptions').update({ status: 'cancelled' }).eq('stripe_subscription_id', sub.id)
      if (sub.metadata?.userId) {
        // Clear plan — user drops to free/no plan
        await db.from('users').update({
          plan_id: null,
          plan_expires_at: null,
        }).eq('id', sub.metadata.userId)
      }
      break
    }

    case 'customer.subscription.paused': {
      // Subscription paused — treat same as expired
      const sub = event.data.object as Stripe.Subscription
      if (sub.metadata?.userId) {
        await db.from('users').update({
          plan_expires_at: new Date().toISOString(),
        }).eq('id', sub.metadata.userId)
      }
      break
    }
  }
}

async function trackResellerEarning(
  db: ReturnType<typeof supabaseAdmin>,
  resellerId: string,
  userId: string,
  planId: string,
  amountCents: number
) {
  try {
    // Get reseller profile
    const { data: rp } = await db.from('reseller_profiles')
      .select('is_approved, referral_commission_pct, balance_pending, balance_total')
      .eq('user_id', resellerId).single()

    if (!rp?.is_approved) return

    // Get base plan cost
    const { data: plan } = await db.from('plans').select('price_monthly').eq('id', planId).single()
    const platformFee = (plan?.price_monthly || 0)
    const grossAmount = amountCents / 100

    // Reseller earns: gross - platform cost
    const resellerEarning = Math.max(0, grossAmount - platformFee)
    if (resellerEarning <= 0) return

    // Record earning
    await db.from('reseller_earnings').insert({
      id: uuidv4(),
      reseller_id: resellerId,
      referred_user_id: userId,
      amount: resellerEarning,
      gross_amount: grossAmount,
      platform_fee: platformFee,
      source: 'subscription',
    })

    // Update balance
    await db.from('reseller_profiles').update({
      balance_pending: (rp.balance_pending || 0) + resellerEarning,
      balance_total: (rp.balance_total || 0) + resellerEarning,
    }).eq('user_id', resellerId)

    // Update referral total_earned
    const { data: ref } = await db.from('reseller_referrals').select('total_earned').eq('reseller_id', resellerId).eq('referred_user_id', userId).single()
    if (ref) {
      await db.from('reseller_referrals').update({ total_earned: (ref.total_earned || 0) + resellerEarning }).eq('reseller_id', resellerId).eq('referred_user_id', userId)
    }
  } catch (e) {
    console.error('Reseller earning track error:', e)
  }
}
