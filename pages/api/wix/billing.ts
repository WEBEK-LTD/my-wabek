import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyWixWebhook, parseMaybeJson } from '@/lib/wix-auth'
import { readRawBody } from '@/lib/raw-body'

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

        console.log(`[Wix Billing] Upgraded user ${userId} to plan ${plan.name}`)
      }

      // Log billing event
      await db.from('system_settings').upsert({
        key:        `wix_billing_${instanceId}_${Date.now()}`,
        value:      { event, instanceId, vendorProductId, userId, timestamp: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' })

    } else if (event === 'plan_expired' || event === 'plan_cancelled') {
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
    } else if (event === 'app_installed') {
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
    }
  } catch (err) {
    console.error('[Wix Billing] error:', err)
  }
}
