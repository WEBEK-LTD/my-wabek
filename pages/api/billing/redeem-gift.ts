import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const user = await requireAuth(req, res)
  if (!user) return

  const { code } = req.body
  if (!code) return res.status(400).json({ error: 'Gift code required' })

  const db = supabaseAdmin()
  const { data: gift } = await db.from('gift_invites')
    .select('*, plan:plan_id(*)')
    .eq('code', code.toUpperCase().trim())
    .eq('is_used', false)
    .single()

  if (!gift) return res.status(404).json({ error: 'Invalid or already used gift code' })
  if (gift.expires_at && new Date(gift.expires_at) < new Date()) return res.status(410).json({ error: 'This gift code has expired' })

  // Activate plan for user
  const expiresAt = new Date(Date.now() + gift.duration_days * 24 * 60 * 60 * 1000).toISOString()

  await db.from('users').update({
    plan_id: gift.plan_id,
    plan_expires_at: expiresAt,
  }).eq('id', user.userId)

  await db.from('subscriptions').upsert({
    id: require('uuid').v4(),
    user_id: user.userId,
    plan_id: gift.plan_id,
    status: 'active',
    billing_cycle: 'monthly',
    current_period_start: new Date().toISOString(),
    current_period_end: expiresAt,
    cancel_at_period_end: false,
    stripe_subscription_id: null,
  }, { onConflict: 'user_id' })

  // Mark gift as used
  await db.from('gift_invites').update({
    is_used: true,
    used_by: user.userId,
    used_at: new Date().toISOString(),
  }).eq('id', gift.id)

  // Notify user
  await db.from('notifications').insert({
    user_id: user.userId,
    type: 'success',
    title: '🎁 Gift Code Redeemed!',
    body: `${gift.plan?.name} plan activated for ${gift.duration_days} days`,
    link: '/dashboard/billing',
  })

  return res.status(200).json({
    success: true,
    plan: gift.plan?.name,
    duration_days: gift.duration_days,
    expires_at: expiresAt,
  })
}
