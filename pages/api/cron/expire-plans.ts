import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { requireCron } from '@/lib/security'
import { fetchSubscriptionState, LIVE_SUB_STATUSES } from '@/lib/stripe'

// Run daily via Netlify scheduled function (netlify/functions/scheduled-cron.mts).
// Auth: header `x-cron-secret: <CRON_SECRET>` only.

const GRACE_MS = 3 * 24 * 60 * 60 * 1000 // Stripe-billed users keep access 3 days past expiry
const MAX_STRIPE_CHECKS = 50

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireCron(req, res)) return

  const db = supabaseAdmin()
  const nowMs = Date.now()
  const now = new Date(nowMs).toISOString()

  // ── Monthly AI counter reset (independent of plan expiry) ──────────────────
  let aiCountersReset = false
  try {
    const monthKey = now.slice(0, 7) // YYYY-MM
    const { data: marker } = await db.from('system_settings').select('value').eq('key', 'ai_counter_reset_month').maybeSingle()
    // No marker yet (first run after deploy): keep the old "reset on the 1st" rule.
    const shouldReset = marker ? marker.value !== monthKey : new Date(nowMs).getUTCDate() === 1
    if (shouldReset) {
      const { error } = await db.from('ai_settings').update({ replies_this_month: 0 }).neq('replies_this_month', 0)
      if (error) console.error('[expire-plans] AI counter reset failed:', error.message)
      else aiCountersReset = true
    }
    if (!marker || aiCountersReset) {
      await db.from('system_settings').upsert({ key: 'ai_counter_reset_month', value: monthKey }, { onConflict: 'key' })
    }
  } catch (e) {
    console.error('[expire-plans] AI counter reset error:', (e as Error)?.message)
  }

  // ── Plan expiry ─────────────────────────────────────────────────────────────
  const { data: expired, error: expErr } = await db
    .from('users')
    .select('id, plan_id, plan_expires_at, referred_by')
    .not('plan_id', 'is', null)
    .not('plan_expires_at', 'is', null)
    .lt('plan_expires_at', now)
  if (expErr) {
    console.error('[expire-plans] query failed:', expErr.message)
    return res.status(500).json({ error: 'Query failed' })
  }

  if (!expired?.length) {
    return res.status(200).json({ expired: 0, kept: 0, ai_counters_reset: aiCountersReset })
  }

  const { data: subs } = await db.from('subscriptions')
    .select('user_id, stripe_subscription_id, status')
    .in('user_id', expired.map(u => u.id))
    .not('stripe_subscription_id', 'is', null)
  const stripeSubByUser = new Map<string, { stripe_subscription_id: string; status: string }>()
  for (const s of subs || []) {
    if ((LIVE_SUB_STATUSES as readonly string[]).includes(s.status)) stripeSubByUser.set(s.user_id, s as { stripe_subscription_id: string; status: string })
  }

  const toExpire: string[] = []
  let kept = 0
  let extended = 0
  let stripeChecks = 0

  for (const u of expired) {
    const sub = stripeSubByUser.get(u.id)
    if (!sub) { toExpire.push(u.id); continue }

    // Stripe-billed: grace period first (renewal webhooks can lag).
    if (nowMs - new Date(u.plan_expires_at as string).getTime() < GRACE_MS) { kept++; continue }

    // Past grace: ask Stripe for the truth before removing a paying customer's plan.
    if (!process.env.STRIPE_SECRET_KEY || stripeChecks >= MAX_STRIPE_CHECKS) { kept++; continue }
    stripeChecks++
    try {
      let state = await fetchSubscriptionState(sub.stripe_subscription_id)
      if (!state && u.referred_by) {
        // Subscription may live on a reseller's Connect account.
        const { data: rp } = await db.from('reseller_profiles').select('stripe_connect_account_id').eq('user_id', u.referred_by).maybeSingle()
        if (rp?.stripe_connect_account_id) state = await fetchSubscriptionState(sub.stripe_subscription_id, rp.stripe_connect_account_id)
      }
      if (state && (state.status === 'active' || state.status === 'trialing')) {
        const periodEnd = new Date(state.current_period_end * 1000).toISOString()
        await db.from('users').update({ plan_expires_at: periodEnd }).eq('id', u.id)
        await db.from('subscriptions').update({ status: state.status, current_period_end: periodEnd })
          .eq('stripe_subscription_id', sub.stripe_subscription_id)
        extended++
        continue
      }
      // Not found anywhere, or past_due/unpaid/canceled beyond the grace period.
      toExpire.push(u.id)
      if (!state || state.status === 'canceled' || state.status === 'incomplete_expired') {
        await db.from('subscriptions').update({ status: 'cancelled' }).eq('stripe_subscription_id', sub.stripe_subscription_id)
      }
    } catch (e) {
      // Stripe unreachable: never strip a paying customer on a transient error.
      console.error('[expire-plans] Stripe check failed:', (e as Error)?.message)
      kept++
    }
  }

  if (toExpire.length) {
    const { error: uErr } = await db.from('users').update({ plan_id: null, plan_expires_at: null }).in('id', toExpire)
    if (uErr) console.error('[expire-plans] downgrade failed:', uErr.message)
    // Non-Stripe (gift/admin/trial) rows: mark cancelled. Stripe rows keep their
    // Stripe-derived status so a later successful payment restores the plan.
    const { error: sErr } = await db.from('subscriptions').update({ status: 'cancelled' })
      .in('user_id', toExpire).eq('status', 'active').is('stripe_subscription_id', null)
    if (sErr) console.error('[expire-plans] subscription update failed:', sErr.message)
  }

  return res.status(200).json({
    expired: toExpire.length,
    kept,
    extended,
    ai_counters_reset: aiCountersReset,
  })
}
