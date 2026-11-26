import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { IAP_PRODUCT_IDS } from '@/lib/apple-iap'

/**
 * GET — what the iOS plans screen needs: product ids, the current plan and
 * where it is billed (apple / web / other), and the token to tie purchases to this account.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  const [{ data: account }, { data: subs }, { data: plans }] = await Promise.all([
    db.from('users').select('plan_id, plan_expires_at').eq('id', user.userId).maybeSingle(),
    db.from('subscriptions').select('plan_id, stripe_subscription_id, status, current_period_end, cancel_at_period_end, billing_cycle')
      .eq('user_id', user.userId).order('created_at', { ascending: false }).limit(1),
    db.from('plans').select('id, name, max_messages_month, max_instances, max_team_members, is_active').eq('is_active', true),
  ])
  const sub = subs?.[0] || null
  const live = !!sub && ['active', 'trialing', 'past_due'].includes(sub.status)
  const source = !live ? 'none' : String(sub!.stripe_subscription_id || '').startsWith('apple:') ? 'apple' : sub!.stripe_subscription_id ? 'web' : 'other'
  const expired = account?.plan_expires_at ? new Date(account.plan_expires_at) < new Date() : false
  const current = !expired && account?.plan_id ? (plans || []).find(p => p.id === account.plan_id) || null : null

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({
    product_ids: IAP_PRODUCT_IDS,
    is_owner: !user.actualUserId,
    account_token: user.actualUserId ? null : user.userId,
    source,
    status: live ? sub!.status : null,
    cycle: live ? sub!.billing_cycle : null,
    renews: live ? !sub!.cancel_at_period_end : false,
    expires_at: account?.plan_expires_at || null,
    plan: current ? { id: current.id, name: current.name } : null,
    plans: (plans || []).filter(p => ['starter', 'pro', 'business'].includes(String(p.name).toLowerCase())).map(p => ({
      key: String(p.name).toLowerCase(), name: p.name,
      max_messages_month: p.max_messages_month, max_instances: p.max_instances, max_team_members: p.max_team_members,
    })),
  })
}
