import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'

export const config = { api: { bodyParser: false } }

async function getRawBody(req: NextApiRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => { data += chunk.toString() })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

// Map Wix vendorProductId → WABEK plan name
const WIX_PLAN_MAP: Record<string, string> = {
  'basic':    'Free',
  'starter':  'Starter',
  'pro':      'Pro',
  'business': 'Business',
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Always return 200 immediately — Wix requires this
  res.status(200).json({ received: true })

  if (req.method !== 'POST') return

  try {
    const rawBody = await getRawBody(req)
    if (!rawBody) return

    // Decode Wix JWT payload (two-level: root JWT -> data is a JSON
    // *string* containing the real event payload, NOT base64 - the
    // previous base64-decode here threw, was caught by the outer try,
    // and reset `payload = {}` for EVERY event, so this handler always
    // returned early with instanceId='').
    let payload: Record<string, unknown> = {}
    try {
      const parts = rawBody.split('.')
      if (parts.length === 3) {
        const root = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
        payload = root
        console.log('[Wix Billing] JWT ROOT', JSON.stringify(root).slice(0, 500))
        if (root.data) {
          try {
            const d1 = JSON.parse(typeof root.data === 'string' ? root.data : JSON.stringify(root.data))
            console.log('[Wix Billing] D1', JSON.stringify(d1).slice(0, 500))
            payload = { ...root, ...d1 }
            if (d1.data) {
              const d2 = JSON.parse(typeof d1.data === 'string' ? d1.data : JSON.stringify(d1.data))
              console.log('[Wix Billing] D2', JSON.stringify(d2).slice(0, 500))
              payload = { ...payload, ...d2 }
            }
          } catch (e) {
            console.log('[Wix Billing] inner data parse error:', (e as Error)?.message)
          }
        }
      } else {
        payload = JSON.parse(rawBody)
      }
    } catch (e) {
      console.log('[Wix Billing] JWT decode error:', (e as Error)?.message)
      payload = {}
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
