import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyWixWebhook, parseMaybeJson, reactivateWixInstallation } from '@/lib/wix-auth'
import { readRawBody } from '@/lib/raw-body'

type DB = ReturnType<typeof supabaseAdmin>

export const config = { api: { bodyParser: false } }

// Map Wix vendorProductId → WABEK plan name
const WIX_PLAN_MAP: Record<string, string> = {
  'basic':    'Free',
  'starter':  'Starter',
  'pro':      'Pro',
  'business': 'Business',
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  let rawBody: string
  try {
    rawBody = (await readRawBody(req, 1024 * 1024)).toString('utf8')
  } catch {
    return res.status(413).json({ error: 'Payload too large' })
  }
  if (!rawBody) return res.status(400).json({ error: 'Empty body' })

  // Billing events change plans: only a JWT signed by Wix (RS256, WIX_PUBLIC_KEY) is accepted
  let root: Record<string, any> | null
  try {
    root = await verifyWixWebhook(rawBody) as Record<string, any> | null
  } catch (e) {
    // Fail closed on purpose: an unsigned billing event could grant a free
    // plan. 503 makes Wix retry the delivery once WIX_PUBLIC_KEY is set.
    console.error('[Wix Billing] WIX_PUBLIC_KEY missing/invalid — rejecting (Wix will retry):', (e as Error).message)
    return res.status(503).json({ error: 'Wix billing webhook not configured', code: 'wix_not_configured' })
  }
  if (!root) {
    console.error('[Wix Billing] invalid signature — rejected')
    return res.status(401).json({ error: 'Invalid signature' })
  }

  // Process first (DB only, fast), then answer
  await processBillingEvent(req, root)
  return res.status(200).json({ received: true })
}

async function processBillingEvent(req: NextApiRequest, root: Record<string, any>): Promise<void> {
  try {
    // Two-level payload: root JWT → data (JSON string) → data (JSON string)
    let payload: Record<string, unknown> = { ...root }
    const d1 = parseMaybeJson(root.data)
    if (d1) {
      payload = { ...payload, ...d1 }
      const d2 = parseMaybeJson(d1.data)
      if (d2) payload = { ...payload, ...d2 }
    }

    const event = String(req.query.event || (payload as any).eventType || '').replace(/^wix\.app_market\.v1\.app_/, '').replace(/^wix\.iam\.v1\./, '')

    const instanceId      = String(payload.instanceId || payload.appInstanceId || payload.metaSiteId || payload.siteId || '')
    const vendorProductId = String(payload.vendorProductId || payload.packageName || payload.planId || '')
    console.log('[Wix Billing] event:', event, 'instanceId:', instanceId, 'vendorProductId:', vendorProductId)

    if (!instanceId) return

    const db = supabaseAdmin()

    // Find WABEK user by Wix instance
    const { data: link } = await db
      .from('wix_user_links')
      .select('user_id')
      .eq('wix_instance_id', instanceId)
      .maybeSingle()

    if (event === 'app_removed') {
      await handleAppRemoved(db, instanceId, link?.user_id || null)
      return
    }

    if (!link?.user_id) return

    const userId = link.user_id

    if (event === 'plan_purchased' || event === 'plan_upgraded') {
      // Find matching WABEK plan
      const wabPlanName = WIX_PLAN_MAP[vendorProductId] || vendorProductId
      const { data: plans } = await db
        .from('plans')
        .select('id, name')
        .ilike('name', wabPlanName)
        .limit(1)
      const plan = plans?.[0]

      if (plan) {
        // Assign plan to user
        const expiresAt = new Date()
        expiresAt.setFullYear(expiresAt.getFullYear() + 1) // default 1 year

        await db.from('users').update({
          plan_id:         plan.id,
          plan_expires_at: expiresAt.toISOString(),
          updated_at:      new Date().toISOString(),
        }).eq('id', userId)

        // Remember that this plan came from Wix billing for this instance
        // (app_removed ends it only then).
        await db.from('system_settings').upsert({
          key:        planSourceKey(userId),
          value:      { instanceId, planId: plan.id, planName: plan.name, vendorProductId, at: new Date().toISOString() },
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' })

        console.log(`[Wix Billing] Upgraded user ${userId} to plan ${plan.name}`)
      }

      // Log billing event
      await db.from('system_settings').upsert({
        key:        `wix_billing_${instanceId}_${Date.now()}`,
        value:      { event, instanceId, vendorProductId, userId, timestamp: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' })

    } else if (event === 'plan_expired' || event === 'plan_cancelled') {
      await endWixPlan(db, userId)
    } else if (event === 'app_installed') {
      // Reinstall after a removal: notifications on again
      await reactivateWixInstallation(instanceId)

      // Assign free plan on install
      const { data: freePlan } = await db
        .from('plans')
        .select('id')
        .ilike('name', 'Free')
        .limit(1)
        .maybeSingle()

      if (freePlan) {
        await db.from('users').update({
          plan_id:    freePlan.id,
          updated_at: new Date().toISOString(),
        }).eq('id', userId)
      }
    } else {
      console.log('[Wix Billing] unsupported event — ignored:', event || '(none)')
    }
  } catch (err) {
    console.error('[Wix Billing] error:', err)
  }
}

const planSourceKey = (userId: string) => `wix_plan_source_${userId}`

/** plan_cancelled semantics: back to the Free plan, no expiry. */
async function endWixPlan(db: DB, userId: string): Promise<void> {
  // Downgrade to Free
  const { data: freePlan } = await db
    .from('plans')
    .select('id')
    .ilike('name', 'Free')
    .limit(1)
    .maybeSingle()

  if (freePlan) {
    await db.from('users').update({
      plan_id:         freePlan.id,
      plan_expires_at: null,
      updated_at:      new Date().toISOString(),
    }).eq('id', userId)
  }
  await db.from('system_settings').delete().eq('key', planSourceKey(userId))
}

/**
 * Whether the user's CURRENT WABEK plan was bought through Wix billing for
 * this instance (and not since replaced, e.g. by Stripe or an admin).
 */
async function planCameFromWix(db: DB, userId: string, instanceId: string): Promise<boolean> {
  const { data: user } = await db.from('users').select('plan_id').eq('id', userId).maybeSingle()
  if (!user?.plan_id) return false

  const { data: src } = await db.from('system_settings').select('value').eq('key', planSourceKey(userId)).maybeSingle()
  const rec = (src?.value || null) as { instanceId?: string; planId?: string } | null
  if (rec) return rec.instanceId === instanceId && rec.planId === user.plan_id

  // Purchases made before the source record existed: the latest Wix billing
  // log for this instance + user must match the current plan, and no live
  // Stripe subscription may hold it.
  const { data: logs } = await db.from('system_settings').select('key, value, updated_at')
    .like('key', `wix_billing_${instanceId}_%`).order('updated_at', { ascending: false }).limit(20)
  const last = (logs || []).map(l => l.value as { event?: string; userId?: string; vendorProductId?: string })
    .find(v => v?.userId === userId && (v.event === 'plan_purchased' || v.event === 'plan_upgraded'))
  if (!last) return false
  const name = WIX_PLAN_MAP[String(last.vendorProductId || '')] || String(last.vendorProductId || '')
  if (!name) return false
  const { data: plans } = await db.from('plans').select('id').ilike('name', name).limit(1)
  if (plans?.[0]?.id !== user.plan_id) return false
  const { data: liveSub } = await db.from('subscriptions').select('id')
    .eq('user_id', userId).not('stripe_subscription_id', 'is', null)
    .in('status', ['active', 'trialing', 'past_due']).limit(1).maybeSingle()
  return !liveSub
}

/**
 * App Removed: mark the installation removed (the order webhook then ignores
 * this site), drop its Wix tokens and, if the merchant's WABEK plan came
 * from Wix billing for this instance, end it like plan_cancelled.
 * Idempotent: a repeated delivery finds nothing left to change.
 *
 * The wix_user_links row is kept on purpose: on reinstall the store comes
 * back to the same WABEK account (with its texts and settings) instead of
 * auto-connect creating a fresh one.
 */
async function handleAppRemoved(db: DB, instanceId: string, userId: string | null): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await db.from('wix_installations')
    .update({ status: 'removed', removed_at: now, access_token: null, refresh_token: null, updated_at: now })
    .eq('wix_instance_id', instanceId)
    .or('status.is.null,status.neq.removed')
  if (error) {
    console.error('[Wix Billing] app_removed: could not mark installation removed (apply migration 034):', error.message)
    // Still drop the tokens so nothing calls Wix for this site any more.
    await db.from('wix_installations').update({ access_token: null, refresh_token: null, updated_at: now }).eq('wix_instance_id', instanceId)
  }

  if (userId && await planCameFromWix(db, userId, instanceId)) {
    await endWixPlan(db, userId)
    console.log(`[Wix Billing] app_removed: Wix plan of user ${userId} ended (instance ${instanceId})`)
  }

  await db.from('system_settings').upsert({
    key:        `wix_billing_${instanceId}_${Date.now()}`,
    value:      { event: 'app_removed', instanceId, userId, timestamp: now },
    updated_at: now,
  }, { onConflict: 'key' })
  console.log('[Wix Billing] app_removed:', instanceId, 'user:', userId || '-')
}
