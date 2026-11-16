import Stripe from 'stripe'
import { supabaseAdmin } from './supabase'

type DB = ReturnType<typeof supabaseAdmin>
export type BillingCycle = 'monthly' | 'yearly'

/** Error whose message is safe to show to the end user. */
export class BillingError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new BillingError('Stripe is not configured. Ask the admin to add Stripe keys.', 400)
  return new Stripe(key, { apiVersion: '2023-10-16' })
}

const iso = (unix: number | null | undefined) => (unix ? new Date(unix * 1000).toISOString() : null)
const round2 = (n: number) => Math.round(n * 100) / 100

// subscriptions.status CHECK: active | cancelled | past_due | trialing | paused (028)
export function mapStripeStatus(s: Stripe.Subscription.Status): 'active' | 'trialing' | 'past_due' | 'cancelled' | 'paused' {
  switch (s) {
    case 'active': return 'active'
    case 'trialing': return 'trialing'
    case 'past_due':
    case 'unpaid':
    case 'incomplete': return 'past_due'
    case 'paused': return 'paused'
    case 'canceled':
    case 'incomplete_expired':
    default: return 'cancelled'
  }
}

/** Statuses for which a Stripe subscription is still considered live/billing. */
export const LIVE_SUB_STATUSES = ['active', 'trialing', 'past_due'] as const

// ── Checkout / portal ─────────────────────────────────────────────────────────

/**
 * Creates a platform checkout session. The Stripe price is always chosen
 * server-side from the plan row + billing cycle; client-supplied price ids are
 * never trusted.
 */
export async function createCheckoutSession(params: {
  userId: string
  email: string
  planId: string
  billingCycle: BillingCycle
  successUrl: string
  cancelUrl: string
}): Promise<Stripe.Checkout.Session> {
  const db = supabaseAdmin()

  const { data: plan, error: planErr } = await db.from('plans')
    .select('id, name, is_active, stripe_price_id_monthly, stripe_price_id_yearly')
    .eq('id', params.planId).maybeSingle()
  if (planErr) console.error('[stripe] plan lookup failed:', planErr.message)
  if (!plan || plan.is_active === false) throw new BillingError('Plan not found', 404)

  const priceId = params.billingCycle === 'yearly' ? plan.stripe_price_id_yearly : plan.stripe_price_id_monthly
  if (!priceId) throw new BillingError('No Stripe price for this plan and billing cycle. Ask the admin to sync plans with Stripe.')

  const stripe = getStripe()

  const { data: user, error: userErr } = await db.from('users')
    .select('stripe_customer_id, referred_by').eq('id', params.userId).single()
  if (userErr) console.error('[stripe] user lookup failed:', userErr.message)

  // Refuse a second concurrent Stripe subscription (would double-bill).
  const { data: liveSub } = await db.from('subscriptions')
    .select('id, stripe_subscription_id, status')
    .eq('user_id', params.userId)
    .not('stripe_subscription_id', 'is', null)
    .in('status', [...LIVE_SUB_STATUSES])
    .limit(1).maybeSingle()
  if (liveSub) {
    throw new BillingError('You already have an active subscription. Use "Manage billing" to change or cancel it.', 409)
  }

  let customerId = user?.stripe_customer_id as string | null | undefined
  if (!customerId) {
    const customer = await stripe.customers.create({ email: params.email, metadata: { userId: params.userId } })
    customerId = customer.id
    const { error } = await db.from('users').update({ stripe_customer_id: customerId }).eq('id', params.userId)
    if (error) console.error('[stripe] saving stripe_customer_id failed:', error.message)
  }

  const meta = {
    userId: params.userId,
    planId: plan.id,
    billingCycle: params.billingCycle,
    resellerId: user?.referred_by || '',
  }

  return stripe.checkout.sessions.create({
    customer: customerId,
    client_reference_id: params.userId,
    payment_method_types: ['card'],
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: meta,
    subscription_data: { metadata: meta },
    allow_promotion_codes: true,
  })
}

export async function createPortalSession(params: { userId: string; returnUrl: string }): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripe()
  const db = supabaseAdmin()
  const { data: user } = await db.from('users').select('stripe_customer_id').eq('id', params.userId).single()
  if (!user?.stripe_customer_id) throw new BillingError('No billing account found for this user', 404)
  return stripe.billingPortal.sessions.create({ customer: user.stripe_customer_id, return_url: params.returnUrl })
}

/** Cancels a platform Stripe subscription immediately (used by admin plan removal). */
export async function cancelStripeSubscription(subscriptionId: string): Promise<void> {
  const stripe = getStripe()
  try {
    await stripe.subscriptions.cancel(subscriptionId)
  } catch (e) {
    // Already cancelled / missing is fine; anything else is surfaced.
    const code = (e as { code?: string })?.code
    if (code !== 'resource_missing') throw e
  }
}

/** Minimal status read used by the expiry cron (supports Connect accounts). */
export async function fetchSubscriptionState(
  subscriptionId: string,
  stripeAccount?: string
): Promise<{ status: Stripe.Subscription.Status; current_period_end: number } | null> {
  const stripe = getStripe()
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId, undefined, stripeAccount ? { stripeAccount } : undefined)
    return { status: sub.status, current_period_end: sub.current_period_end }
  } catch (e) {
    if ((e as { code?: string })?.code === 'resource_missing') return null
    throw e
  }
}

// ── Webhook ───────────────────────────────────────────────────────────────────

const HANDLED_EVENTS = new Set([
  'checkout.session.completed',
  'invoice.payment_succeeded',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
])

export type WebhookOutcome = 'processed' | 'duplicate' | 'ignored'

/**
 * Processes a verified Stripe event. Deterministic problems (unknown user,
 * unknown price, invoice without subscription, ...) are logged and treated as
 * handled so Stripe does not retry forever. Only unexpected/transient errors
 * throw (and un-claim the event so a Stripe retry can process it).
 */
export async function handleWebhookEvent(event: Stripe.Event): Promise<WebhookOutcome> {
  // Events from connected accounts are handled by /api/reseller/stripe-connect/webhook.
  if (event.account) return 'ignored'
  if (!HANDLED_EVENTS.has(event.type)) return 'ignored'

  const db = supabaseAdmin()
  const claim = await claimEvent(db, event.id)
  if (claim === 'duplicate') return 'duplicate'

  try {
    await processEvent(db, event, claim === 'claimed')
    return 'processed'
  } catch (e) {
    if (claim === 'claimed') {
      const { error } = await db.from('processed_stripe_events').delete().eq('id', event.id)
      if (error) console.error('[stripe] could not release event claim:', error.message)
    }
    throw e
  }
}

async function claimEvent(db: DB, id: string): Promise<'claimed' | 'duplicate' | 'unavailable'> {
  const { error } = await db.from('processed_stripe_events').insert({ id })
  if (!error) return 'claimed'
  if (error.code === '23505') return 'duplicate'
  console.error('[stripe] processed_stripe_events unavailable (apply migration 028):', error.message)
  return 'unavailable'
}

async function processEvent(db: DB, event: Stripe.Event, idempotent: boolean): Promise<void> {
  const stripe = getStripe()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode !== 'subscription' || !session.subscription) return
      const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id
      const sub = await stripe.subscriptions.retrieve(subId, { expand: ['items.data.price'] })
      const userId = await resolveUserId(db, sub.customer, session.metadata?.userId || session.client_reference_id || sub.metadata?.userId)
      if (!userId) { console.error(`[stripe] ${event.id}: no user for checkout ${session.id}`); return }
      await syncSubscription(stripe, db, sub, userId)
      // Earnings are recorded from invoice.payment_succeeded only.
      return
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      if (!invoice.subscription) return // one-off invoice — nothing to sync
      const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id
      const sub = await stripe.subscriptions.retrieve(subId, { expand: ['items.data.price'] })
      const userId = await resolveUserId(db, sub.customer, sub.metadata?.userId)
      if (!userId) { console.error(`[stripe] ${event.id}: no user for subscription ${sub.id}`); return }
      const synced = await syncSubscription(stripe, db, sub, userId)

      if (invoice.amount_paid > 0 && synced?.planId) {
        if (!idempotent) {
          console.error(`[stripe] ${event.id}: skipping reseller earning — idempotency table unavailable`)
        } else {
          await trackResellerEarning(db, {
            userId,
            fallbackResellerId: sub.metadata?.resellerId || null,
            planId: synced.planId,
            cycle: synced.cycle,
            amountCents: invoice.amount_paid,
            paymentRef: invoice.id,
          })
        }
      }
      return
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
    case 'customer.subscription.paused':
    case 'customer.subscription.resumed': {
      const evSub = event.data.object as Stripe.Subscription
      // Re-read to avoid acting on an out-of-order event payload.
      let sub: Stripe.Subscription
      try {
        sub = await stripe.subscriptions.retrieve(evSub.id, { expand: ['items.data.price'] })
      } catch (e) {
        if ((e as { code?: string })?.code !== 'resource_missing') throw e
        sub = evSub
      }
      const userId = await resolveUserId(db, sub.customer, sub.metadata?.userId)
      if (!userId) { console.error(`[stripe] ${event.id}: no user for subscription ${sub.id}`); return }
      await syncSubscription(stripe, db, sub, userId)
      return
    }
  }
}

async function resolveUserId(db: DB, customer: string | Stripe.Customer | Stripe.DeletedCustomer | null, metaUserId?: string | null): Promise<string | null> {
  const customerId = typeof customer === 'string' ? customer : customer?.id
  if (customerId) {
    const { data, error } = await db.from('users').select('id').eq('stripe_customer_id', customerId).maybeSingle()
    if (error) console.error('[stripe] user by customer lookup failed:', error.message)
    if (data?.id) return data.id
  }
  if (metaUserId) {
    const { data, error } = await db.from('users').select('id, stripe_customer_id').eq('id', metaUserId).maybeSingle()
    if (error) console.error('[stripe] user by id lookup failed:', error.message)
    if (data?.id && (!data.stripe_customer_id || data.stripe_customer_id === customerId)) return data.id
  }
  return null
}

type PlanRow = { id: string; price_monthly: number | null; price_yearly: number | null }

/** Maps a Stripe price to our plan. Never uses client-influenced metadata. */
async function resolvePlanFromPrice(stripe: Stripe, db: DB, price: Stripe.Price | undefined | null): Promise<PlanRow | null> {
  if (!price?.id) return null
  const cols = 'id, price_monthly, price_yearly'

  if (/^[A-Za-z0-9_]+$/.test(price.id)) {
    const { data, error } = await db.from('plans').select(cols)
      .or(`stripe_price_id_monthly.eq.${price.id},stripe_price_id_yearly.eq.${price.id}`)
      .limit(1).maybeSingle()
    if (error) console.error('[stripe] plan by price lookup failed:', error.message)
    if (data) return data as PlanRow
  }

  // Prices/products created by /api/admin/sync-stripe carry wabek_plan_id.
  let planId = price.metadata?.wabek_plan_id || null
  if (!planId && price.product) {
    try {
      const product = typeof price.product === 'string' ? await stripe.products.retrieve(price.product) : price.product
      if (!('deleted' in product && product.deleted)) planId = (product as Stripe.Product).metadata?.wabek_plan_id || null
    } catch (e) {
      console.error('[stripe] product lookup failed:', (e as Error).message)
    }
  }
  if (planId) {
    const { data } = await db.from('plans').select(cols).eq('id', planId).maybeSingle()
    if (data) return data as PlanRow
  }
  return null
}

/** Writes the Stripe subscription state to `subscriptions` and the user's plan. */
async function syncSubscription(
  stripe: Stripe,
  db: DB,
  sub: Stripe.Subscription,
  userId: string
): Promise<{ planId: string; cycle: BillingCycle } | null> {
  const price = sub.items?.data?.[0]?.price
  const plan = await resolvePlanFromPrice(stripe, db, price)
  const cycle: BillingCycle = price?.recurring?.interval === 'year' ? 'yearly' : 'monthly'
  const status = mapStripeStatus(sub.status)

  const { data: user } = await db.from('users').select('plan_id').eq('id', userId).maybeSingle()
  const { data: existingRows } = await db.from('subscriptions')
    .select('plan_id, stripe_subscription_id, status')
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(1)
  const existing = existingRows?.[0]

  // An old/other subscription ending must not overwrite a different live one
  // (another Stripe subscription, or an admin/gift assignment).
  const isLive = (s: string) => (LIVE_SUB_STATUSES as readonly string[]).includes(s)
  if (existing && existing.stripe_subscription_id !== sub.id &&
      isLive(existing.status) && !isLive(status)) {
    console.warn(`[stripe] ignoring ${status} for ${sub.id}: user has another live subscription`)
    return null
  }

  if (!plan) console.error(`[stripe] subscription ${sub.id}: price ${price?.id} does not map to a plan`)
  const planId = plan?.id || existing?.plan_id || user?.plan_id || null
  if (!planId) return null

  await upsertSubscriptionRow(db, {
    user_id: userId,
    plan_id: planId,
    stripe_subscription_id: sub.id,
    status,
    billing_cycle: cycle,
    current_period_start: iso(sub.current_period_start) || new Date().toISOString(),
    current_period_end: iso(sub.current_period_end) || new Date().toISOString(),
    cancel_at_period_end: !!sub.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  })

  let userUpdate: Record<string, unknown> | null = null
  if (status === 'active' || status === 'trialing') {
    userUpdate = { plan_id: planId, plan_expires_at: iso(sub.current_period_end) }
  } else if (status === 'paused') {
    userUpdate = { plan_expires_at: new Date().toISOString() }
  } else if (status === 'cancelled') {
    // Only drop the plan this subscription granted (not a later gift/admin plan).
    if (!user?.plan_id || user.plan_id === planId) userUpdate = { plan_id: null, plan_expires_at: null }
  }
  // past_due: leave plan_id and plan_expires_at untouched — the expiry cron
  // gives Stripe-billed users a grace period before removing the plan.

  if (userUpdate) {
    const { error } = await db.from('users').update(userUpdate).eq('id', userId)
    if (error) throw new Error(`users update failed: ${error.message}`)
  }
  return { planId, cycle }
}

type SubscriptionRow = {
  user_id: string; plan_id: string; stripe_subscription_id: string | null; status: string
  billing_cycle: BillingCycle; current_period_start: string; current_period_end: string
  cancel_at_period_end: boolean; updated_at?: string
}

/**
 * Upsert keyed on user_id. Falls back to select+update/insert when the
 * database has no unique index on subscriptions.user_id (pre-028 001 schema).
 */
export async function upsertSubscriptionRow(db: DB, row: SubscriptionRow): Promise<void> {
  const { error } = await db.from('subscriptions').upsert(row, { onConflict: 'user_id' })
  if (!error) return
  if (error.code !== '42P10' && !/unique or exclusion constraint/i.test(error.message)) {
    throw new Error(`subscriptions upsert failed: ${error.message}`)
  }
  const { data: rows } = await db.from('subscriptions').select('id')
    .eq('user_id', row.user_id).order('created_at', { ascending: false }).limit(1)
  const existingId = rows?.[0]?.id
  const res = existingId
    ? await db.from('subscriptions').update(row).eq('id', existingId)
    : await db.from('subscriptions').insert(row)
  if (res.error) throw new Error(`subscriptions write failed: ${res.error.message}`)
}

async function trackResellerEarning(db: DB, p: {
  userId: string
  fallbackResellerId: string | null
  planId: string
  cycle: BillingCycle
  amountCents: number
  paymentRef: string
}) {
  try {
    const { data: u } = await db.from('users').select('referred_by').eq('id', p.userId).maybeSingle()
    const resellerId = u?.referred_by || p.fallbackResellerId
    if (!resellerId || resellerId === p.userId) return

    const { data: rp } = await db.from('reseller_profiles')
      .select('is_approved').eq('user_id', resellerId).maybeSingle()
    if (!rp?.is_approved) return

    const { data: plan } = await db.from('plans').select('price_monthly, price_yearly').eq('id', p.planId).maybeSingle()
    const monthly = Number(plan?.price_monthly || 0)
    const platformFee = p.cycle === 'yearly' ? Number(plan?.price_yearly || monthly * 12) : monthly
    const grossAmount = round2(p.amountCents / 100)
    const resellerEarning = round2(Math.max(0, grossAmount - platformFee))
    if (resellerEarning <= 0) return

    const { error: insErr } = await db.from('reseller_earnings').insert({
      reseller_id: resellerId,
      referred_user_id: p.userId,
      amount: resellerEarning,
      gross_amount: grossAmount,
      platform_fee: platformFee,
      source: 'subscription',
      payment_ref: p.paymentRef,
    })
    if (insErr) {
      if (insErr.code !== '23505') console.error('[stripe] reseller_earnings insert failed:', insErr.message)
      return
    }

    const { error: rpcErr } = await db.rpc('reseller_add_earning', {
      p_user: resellerId, p_amount: resellerEarning, p_referred: p.userId,
    })
    if (rpcErr) {
      console.error('[stripe] reseller_add_earning failed (apply migration 028):', rpcErr.message)
      // Pre-028 fallback (non-atomic) so balances still move.
      const { data: bal } = await db.from('reseller_profiles')
        .select('balance_pending, balance_total').eq('user_id', resellerId).maybeSingle()
      if (bal) {
        const { error } = await db.from('reseller_profiles').update({
          balance_pending: round2(Number(bal.balance_pending || 0) + resellerEarning),
          balance_total: round2(Number(bal.balance_total || 0) + resellerEarning),
        }).eq('user_id', resellerId)
        if (error) console.error('[stripe] reseller balance fallback failed:', error.message)
      }
    }
  } catch (e) {
    console.error('[stripe] reseller earning error:', (e as Error).message)
  }
}
