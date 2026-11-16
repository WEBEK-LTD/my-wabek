import { NextApiRequest, NextApiResponse } from 'next'
import { requireOwnerOrRole } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit, logAction, getClientIp } from '@/lib/middleware'
import { upsertSubscriptionRow, LIVE_SUB_STATUSES } from '@/lib/stripe'

const redeemLimiter = rateLimit({ maxRequests: 10, windowMs: 60 * 1000 })
const MAX_REDEEMS_PER_HOUR = 5

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!redeemLimiter(req, res)) return
  // Only the account owner may change the account's plan.
  const user = await requireOwnerOrRole(req, res)
  if (!user) return

  const raw = req.body?.code
  if (typeof raw !== 'string' || !raw.trim() || raw.length > 64) return res.status(400).json({ error: 'Gift code required' })
  const code = raw.toUpperCase().trim()

  const db = supabaseAdmin()

  // Abuse guard: no more than N redemptions per user per hour.
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count: recent } = await db.from('gift_invites')
    .select('id', { count: 'exact', head: true })
    .eq('used_by', user.userId).gte('used_at', since)
  if ((recent || 0) >= MAX_REDEEMS_PER_HOUR) {
    return res.status(429).json({ error: 'Too many gift codes redeemed recently. Please try again later.' })
  }

  // A gift must never replace a live paid Stripe subscription.
  const { data: liveSub } = await db.from('subscriptions')
    .select('id').eq('user_id', user.userId)
    .not('stripe_subscription_id', 'is', null)
    .in('status', [...LIVE_SUB_STATUSES])
    .limit(1).maybeSingle()
  if (liveSub) {
    return res.status(409).json({ error: 'You already have an active paid subscription. Gift codes can be redeemed once it ends.' })
  }

  const { data: gift } = await db.from('gift_invites')
    .select('id, plan_id, duration_days, expires_at, is_used, plan:plan_id(id, name, is_active)')
    .eq('code', code)
    .maybeSingle()

  if (!gift || gift.is_used) return res.status(404).json({ error: 'Invalid or already used gift code' })
  if (gift.expires_at && new Date(gift.expires_at) < new Date()) return res.status(410).json({ error: 'This gift code has expired' })
  const plan = gift.plan as unknown as { id: string; name: string; is_active: boolean } | null
  if (!plan) return res.status(404).json({ error: 'Invalid or already used gift code' })

  const durationDays = Math.min(Math.max(parseInt(String(gift.duration_days), 10) || 0, 1), 365)

  // Atomic claim: only one request can flip is_used false → true.
  const usedAt = new Date().toISOString()
  const { data: claimed, error: claimErr } = await db.from('gift_invites')
    .update({ is_used: true, used_by: user.userId, used_at: usedAt })
    .eq('id', gift.id)
    .eq('is_used', false)
    .select('id')
  if (claimErr) {
    console.error('[redeem-gift] claim failed:', claimErr.message)
    return res.status(500).json({ error: 'Could not redeem gift code' })
  }
  if (!claimed?.length) return res.status(404).json({ error: 'Invalid or already used gift code' })

  try {
    // Extend an unexpired plan of the same kind instead of cutting it short.
    const { data: me } = await db.from('users').select('plan_id, plan_expires_at').eq('id', user.userId).single()
    let base = Date.now()
    if (me && me.plan_id === gift.plan_id && me.plan_expires_at && new Date(me.plan_expires_at).getTime() > base) {
      base = new Date(me.plan_expires_at).getTime()
    }
    const expiresAt = new Date(base + durationDays * 24 * 60 * 60 * 1000).toISOString()

    const { error: uErr } = await db.from('users').update({
      plan_id: gift.plan_id,
      plan_expires_at: expiresAt,
    }).eq('id', user.userId)
    if (uErr) throw new Error(uErr.message)

    await upsertSubscriptionRow(db, {
      user_id: user.userId,
      plan_id: gift.plan_id,
      status: 'active',
      billing_cycle: 'monthly',
      current_period_start: usedAt,
      current_period_end: expiresAt,
      cancel_at_period_end: false,
      stripe_subscription_id: null,
      updated_at: usedAt,
    })

    await db.from('notifications').insert({
      user_id: user.userId,
      type: 'success',
      title: '🎁 Gift Code Redeemed!',
      body: `${plan.name} plan activated for ${durationDays} days`,
      link: '/dashboard/billing',
    })

    await logAction({ userId: user.userId, action: 'gift_redeemed', resource: 'gift_invite', resourceId: gift.id, details: { plan_id: gift.plan_id, duration_days: durationDays }, ipAddress: getClientIp(req) })

    return res.status(200).json({
      success: true,
      plan: plan.name,
      duration_days: durationDays,
      expires_at: expiresAt,
    })
  } catch (e) {
    console.error('[redeem-gift] activation failed:', (e as Error)?.message)
    // Release the claim so the code is not burned by a server error.
    await db.from('gift_invites').update({ is_used: false, used_by: null, used_at: null })
      .eq('id', gift.id).eq('used_by', user.userId)
    return res.status(500).json({ error: 'Could not redeem gift code' })
  }
}
