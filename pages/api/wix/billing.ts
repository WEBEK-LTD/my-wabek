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

    const event = req.query.event as string

    // Decode Wix JWT payload
    let payload: Record<string, unknown> = {}
    try {
      const parts = rawBody.split('.')
      if (parts.length === 3) {
        payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
        if (payload.data) {
          const inner = JSON.parse(Buffer.from(payload.data as string, 'base64').toString())
          payload = { ...payload, ...inner }
        }
      } else {
        payload = JSON.parse(rawBody)
      }
    } catch {
      payload = {}
    }

    const instanceId      = String(payload.instanceId || payload.appInstanceId || '')
    const vendorProductId = String(payload.vendorProductId || payload.packageName || '')

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
      const { data: plan } = await db
        .from('plans')
        .select('id, name')
        .ilike('name', wabPlanName)
        .maybeSingle()

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
