import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAuth, requireOwnerOrRole } from '@/lib/auth'
import { BillingError, BillingCycle, createCheckoutSession, createPortalSession, getStripe } from '@/lib/stripe'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // GET is readable by team members; buying / managing billing (POST) is
  // owner-only.
  const user = req.method === 'POST' ? await requireOwnerOrRole(req, res) : await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    // Get user record first
    const { data: userRecord } = await db
      .from('users')
      .select('plan_id, plan_expires_at, trial_ends_at, referred_by, stripe_customer_id')
      .eq('id', user.userId)
      .single()

    // ── Find active subscription ──────────────────────
    // 1. Check subscriptions table
    const { data: stripeSub } = await db
      .from('subscriptions')
      .select('*, plans(*)')
      .eq('user_id', user.userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let effectiveSubscription = stripeSub

    // 2. Fallback: user has plan_id set (admin-assigned or gift)
    if (!effectiveSubscription && userRecord?.plan_id) {
      // Check if not expired
      const isExpired = userRecord.plan_expires_at && new Date(userRecord.plan_expires_at) < new Date()
      if (!isExpired) {
        const { data: plan } = await db.from('plans').select('*').eq('id', userRecord.plan_id).single()
        if (plan) {
          effectiveSubscription = {
            id: 'manual',
            user_id: user.userId,
            plan_id: userRecord.plan_id,
            status: 'active',
            billing_cycle: 'monthly',
            current_period_start: new Date().toISOString(),
            current_period_end: userRecord.plan_expires_at || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            cancel_at_period_end: false,
            stripe_subscription_id: null,
            plans: plan,
          }
        }
      }
    }

    // ── Get plans ─────────────────────────────────────
    let plans = null
    let isResellerBilling = false

    // Check if user came via reseller
    if (userRecord?.referred_by) {
      const { data: resellerPlans } = await db
        .from('reseller_plans')
        .select('*, base_plan:base_plan_id(*)')
        .eq('reseller_id', userRecord.referred_by)
        .eq('is_active', true)

      if (resellerPlans?.length) {
        plans = resellerPlans.map(rp => ({
          ...rp.base_plan,
          id: rp.base_plan_id,
          name: rp.custom_name || rp.base_plan?.name,
          price_monthly: rp.custom_price_monthly,
          price_yearly: rp.custom_price_yearly || rp.base_plan?.price_yearly,
          stripe_price_id_monthly: rp.base_plan?.stripe_price_id_monthly,
          stripe_price_id_yearly: rp.base_plan?.stripe_price_id_yearly,
          reseller_plan_id: rp.id,
          reseller_id: userRecord.referred_by,
        }))
        isResellerBilling = true
      }
    }

    if (!plans) {
      const { data: defaultPlans } = await db.from('plans').select('*').eq('is_active', true).order('sort_order')
      plans = defaultPlans || []

      // Auto-sync Stripe if needed
      const needsSync = plans.some((p: { price_monthly: number; stripe_price_id_monthly?: string }) => p.price_monthly > 0 && !p.stripe_price_id_monthly)
      // Only an admin's own request can trigger the (admin-only) sync.
      if (needsSync && process.env.STRIPE_SECRET_KEY && user.role === 'admin') {
        try {
          await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/sync-stripe`, {
            method: 'POST',
            headers: {
              'Authorization': req.headers.authorization || '',
              'Cookie': req.headers.cookie || '',
              'Content-Type': 'application/json',
            },
          })
          const { data: synced } = await db.from('plans').select('*').eq('is_active', true).order('sort_order')
          if (synced) plans = synced
        } catch {}
      }
    }

    return res.status(200).json({ plans, subscription: effectiveSubscription, isResellerBilling })
  }

  if (req.method === 'POST') {
    const { action, plan_id, reseller_id, reseller_plan_id } = req.body || {}
    const billing_cycle: BillingCycle = req.body?.billing_cycle === 'yearly' ? 'yearly' : 'monthly'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL

    try {
      if (action === 'checkout') {
        // Reseller with Stripe Connect
        if (reseller_id) {
          const { data: me } = await db.from('users').select('referred_by').eq('id', user.userId).single()
          if (!me?.referred_by || me.referred_by !== reseller_id) {
            return res.status(400).json({ error: 'Invalid reseller' })
          }

          const { data: resellerProfile } = await db.from('reseller_profiles')
            .select('stripe_connect_account_id, payment_method')
            .eq('user_id', reseller_id).single()

          if (resellerProfile?.stripe_connect_account_id && resellerProfile?.payment_method !== 'platform') {
            if (typeof reseller_plan_id !== 'string' || !reseller_plan_id) return res.status(400).json({ error: 'reseller_plan_id required' })
            const stripe = getStripe()
            const { data: rPlan } = await db.from('reseller_plans')
              .select('*, base_plan:base_plan_id(name, price_yearly)')
              .eq('id', reseller_plan_id)
              .eq('reseller_id', reseller_id)
              .eq('is_active', true)
              .maybeSingle()
            if (!rPlan) return res.status(404).json({ error: 'Plan not found' })

            const amount = billing_cycle === 'yearly'
              ? Number(rPlan.custom_price_yearly || rPlan.base_plan?.price_yearly || 0)
              : Number(rPlan.custom_price_monthly || 0)
            if (!(amount > 0)) return res.status(400).json({ error: 'This plan is not available for the selected billing cycle' })

            const price = await stripe.prices.create({
              currency: rPlan.currency?.toLowerCase() || 'usd',
              unit_amount: Math.round(amount * 100),
              recurring: { interval: billing_cycle === 'yearly' ? 'year' : 'month' },
              product_data: { name: rPlan.custom_name || rPlan.base_plan?.name || 'Plan' },
            }, { stripeAccount: resellerProfile.stripe_connect_account_id })

            const meta = {
              userId: user.userId,
              planId: rPlan.base_plan_id,          // server-derived, never the client's plan_id
              resellerId: reseller_id,
              resellerPlanId: rPlan.id,
              billingCycle: billing_cycle,
            }
            const session = await stripe.checkout.sessions.create({
              payment_method_types: ['card'],
              mode: 'subscription',
              client_reference_id: user.userId,
              line_items: [{ price: price.id, quantity: 1 }],
              success_url: `${appUrl}/dashboard/billing?success=1`,
              cancel_url: `${appUrl}/dashboard/billing?cancelled=1`,
              metadata: meta,
              subscription_data: { metadata: meta },
            }, { stripeAccount: resellerProfile.stripe_connect_account_id })

            return res.status(200).json({ url: session.url })
          }
        }

        // Platform checkout: the price is chosen server-side from plan + cycle
        // (any client-sent price_id is ignored).
        if (!process.env.STRIPE_SECRET_KEY) return res.status(400).json({ error: 'Stripe is not configured. Ask the admin to add Stripe keys.' })
        if (typeof plan_id !== 'string' || !plan_id) return res.status(400).json({ error: 'plan_id required' })

        const session = await createCheckoutSession({
          userId: user.userId, email: user.email,
          planId: plan_id,
          billingCycle: billing_cycle,
          successUrl: `${appUrl}/dashboard/billing?success=1`,
          cancelUrl: `${appUrl}/dashboard/billing?cancelled=1`,
        })
        return res.status(200).json({ url: session.url })
      }

      if (action === 'portal') {
        if (!process.env.STRIPE_SECRET_KEY) return res.status(400).json({ error: 'Stripe not configured' })
        const session = await createPortalSession({
          userId: user.userId,
          returnUrl: `${appUrl}/dashboard/billing`,
        })
        return res.status(200).json({ url: session.url })
      }

      return res.status(400).json({ error: 'Unknown action' })
    } catch (err: unknown) {
      if (err instanceof BillingError) return res.status(err.status).json({ error: err.message })
      console.error('[billing] checkout/portal error:', (err as Error)?.message)
      return res.status(500).json({ error: 'Payment provider error. Please try again later.' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
