/**
 * Stripe Connect webhook — subscriptions that resellers sell on their OWN
 * connected Stripe account (direct charges, created by POST /api/billing
 * action=checkout with reseller_id). The platform webhook
 * (/api/billing/webhook) ignores every event that carries `event.account`.
 *
 * Handled (all for connected accounts only):
 *   checkout.session.completed      → activate subscription + plan
 *   invoice.payment_succeeded       → (first payment and every renewal)
 *                                      extend plan_expires_at + record the
 *                                      reseller earning exactly once
 *   customer.subscription.updated / deleted / paused / resumed
 *                                   → status / cancel / period changes
 *
 * Trust model: the connected account comes from the signed event; it must
 * belong to the reseller in the subscription metadata, the user must be that
 * reseller's referral, and the plan must be one the reseller sells.
 * Idempotency: processed_stripe_events (shared with the platform webhook) +
 * the unique (reseller_id, payment_ref) index on reseller_earnings (028).
 */
import { NextApiRequest, NextApiResponse } from 'next'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase'
import { applySubscriptionState, mapStripeStatus, recordResellerEarning, BillingCycle } from '@/lib/stripe'

export const config = { api: { bodyParser: false } }

type DB = ReturnType<typeof supabaseAdmin>

async function buffer(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req as unknown as AsyncIterable<Buffer>) chunks.push(chunk)
  return Buffer.concat(chunks)
}

interface ConnectContext { userId: string; planId: string; resellerId: string }

/** Validates metadata against the DB. Returns null (and logs) when anything doesn't line up. */
async function resolveContext(
  db: DB,
  accountId: string,
  meta: Stripe.Metadata | null | undefined,
  eventId: string,
  requireActivePlan: boolean
): Promise<ConnectContext | null> {
  const userId = meta?.userId
  const planId = meta?.planId
  const resellerId = meta?.resellerId
  if (!userId || !planId || !resellerId) {
    console.warn(`[connect-webhook] ${eventId}: missing metadata`)
    return null
  }
  const { data: profile } = await db.from('reseller_profiles').select('user_id')
    .eq('stripe_connect_account_id', accountId).maybeSingle()
  if (!profile || profile.user_id !== resellerId) {
    console.warn(`[connect-webhook] ${eventId}: account/reseller mismatch`)
    return null
  }
  const { data: referral } = await db.from('reseller_referrals').select('id')
    .eq('reseller_id', resellerId).eq('referred_user_id', userId).maybeSingle()
  if (!referral) {
    console.warn(`[connect-webhook] ${eventId}: user is not a referral of reseller`)
    return null
  }
  let q = db.from('reseller_plans').select('id')
    .eq('reseller_id', resellerId).eq('base_plan_id', planId)
  if (requireActivePlan) q = q.eq('is_active', true)
  const { data: rplans } = await q.limit(1)
  if (!rplans?.length) {
    console.warn(`[connect-webhook] ${eventId}: plan not offered by reseller`)
    return null
  }
  return { userId, planId, resellerId }
}

function cycleOf(sub: Stripe.Subscription): BillingCycle {
  const interval = sub.items?.data?.[0]?.price?.recurring?.interval
  if (interval === 'year') return 'yearly'
  if (interval === 'month') return 'monthly'
  return sub.metadata?.billingCycle === 'yearly' ? 'yearly' : 'monthly'
}

async function retrieveSub(stripe: Stripe, id: string, accountId: string): Promise<Stripe.Subscription | null> {
  try {
    return await stripe.subscriptions.retrieve(id, { expand: ['items.data.price'] }, { stripeAccount: accountId })
  } catch (e) {
    if ((e as { code?: string })?.code === 'resource_missing') return null
    throw e
  }
}

async function syncSub(db: DB, sub: Stripe.Subscription, ctx: ConnectContext) {
  return applySubscriptionState(db, {
    userId: ctx.userId,
    planId: ctx.planId,
    sub,
    status: mapStripeStatus(sub.status),
    cycle: cycleOf(sub),
  })
}

async function processEvent(stripe: Stripe, db: DB, event: Stripe.Event, accountId: string): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode !== 'subscription' || !session.subscription) return
      if (session.payment_status === 'unpaid') return
      const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id
      const sub = await retrieveSub(stripe, subId, accountId)
      if (!sub) return
      const ctx = await resolveContext(db, accountId, { ...(sub.metadata || {}), ...(session.metadata || {}) }, event.id, true)
      if (!ctx) return
      await syncSub(db, sub, ctx)
      // Earnings are recorded from invoice.payment_succeeded only (once per invoice).
      return
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      if (!invoice.subscription) return
      const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id
      const sub = await retrieveSub(stripe, subId, accountId)
      if (!sub) return
      const ctx = await resolveContext(db, accountId, sub.metadata, event.id, false)
      if (!ctx) return
      // Renewal: the retrieved subscription carries the new period end.
      const synced = await syncSub(db, sub, ctx)
      if (synced && invoice.amount_paid > 0) {
        await recordResellerEarning(db, {
          resellerId: ctx.resellerId,
          userId: ctx.userId,
          planId: ctx.planId,
          cycle: synced.cycle,
          amountCents: invoice.amount_paid,
          paymentRef: invoice.id,
        })
      }
      return
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
    case 'customer.subscription.paused':
    case 'customer.subscription.resumed': {
      const evSub = event.data.object as Stripe.Subscription
      // Re-read to avoid acting on an out-of-order payload.
      const sub = (await retrieveSub(stripe, evSub.id, accountId)) || evSub
      const ctx = await resolveContext(db, accountId, sub.metadata, event.id, false)
      if (!ctx) return
      await syncSub(db, sub, ctx)
      return
    }
  }
}

const HANDLED = new Set([
  'checkout.session.completed',
  'invoice.payment_succeeded',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
])

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
  if (!HANDLED.has(event.type)) return res.status(200).json({ received: true, ignored: event.type })

  const db = supabaseAdmin()

  // Idempotency: first writer wins; duplicates are acknowledged and skipped.
  const { error: dupErr } = await db.from('processed_stripe_events').insert({ id: event.id })
  if (dupErr) {
    if ((dupErr as { code?: string }).code === '23505') return res.status(200).json({ received: true, duplicate: true })
    console.error('[connect-webhook] idempotency insert failed:', dupErr.message)
    return res.status(500).json({ error: 'Temporary error' })
  }

  try {
    await processEvent(stripe, db, event, accountId)
    return res.status(200).json({ received: true })
  } catch (err) {
    console.error('[connect-webhook] processing failed:', (err as Error)?.message)
    // Allow Stripe to retry this event.
    await db.from('processed_stripe_events').delete().eq('id', event.id)
    return res.status(500).json({ error: 'Processing failed' })
  }
}
