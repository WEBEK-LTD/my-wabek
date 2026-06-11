import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const user = await requireAuth(req, res)
  if (!user) return

  const db = supabaseAdmin()

  // Get user's active plan
  const { data: userRecord } = await db.from('users')
    .select('plan_id, plan_expires_at, trial_ends_at')
    .eq('id', user.userId).single()

  // Check subscription table first
  const { data: sub } = await db.from('subscriptions')
    .select('plan_id, status, current_period_end')
    .eq('user_id', user.userId)
    .eq('status', 'active')
    .maybeSingle()

  const activePlanId = sub?.plan_id || userRecord?.plan_id

  if (!activePlanId) {
    // Free / no plan — minimal access
    return res.status(200).json({
      plan: null,
      features: {
        allow_api_access: false,
        allow_chatbot: true,
        allow_automation: true,
        allow_analytics: true,
        allow_white_label: false,
        allow_sub_accounts: false,
        allow_reseller: false,
        allow_gift_invites: false,
        max_messages_month: 500,
        max_contacts: 100,
        max_instances: 1,
        max_campaigns: 3,
        max_team_members: 1,
        max_chatbot_flows: 2,
        max_ai_replies: 0,
      }
    })
  }

  // Check if plan expired
  const expiry = sub?.current_period_end || userRecord?.plan_expires_at
  if (expiry && new Date(expiry) < new Date()) {
    return res.status(200).json({
      plan: null,
      features: { expired: true },
    })
  }

  const { data: plan } = await db.from('plans').select('*').eq('id', activePlanId).single()

  if (!plan) {
    return res.status(200).json({ plan: null, features: {} })
  }

  return res.status(200).json({
    plan: {
      id: plan.id,
      name: plan.name,
      price_monthly: plan.price_monthly,
    },
    features: {
      allow_api_access: plan.allow_api_access ?? false,
      allow_chatbot: plan.allow_chatbot ?? true,
      allow_automation: plan.allow_automation ?? true,
      allow_analytics: plan.allow_analytics ?? true,
      allow_white_label: plan.allow_white_label ?? false,
      allow_sub_accounts: plan.allow_sub_accounts ?? false,
      allow_reseller: plan.allow_reseller ?? false,
      allow_gift_invites: plan.allow_gift_invites ?? false,
      max_messages_month: plan.max_messages_month,
      max_contacts: plan.max_contacts,
      max_instances: plan.max_instances,
      max_campaigns: plan.max_campaigns,
      max_team_members: plan.max_team_members ?? 1,
      max_chatbot_flows: plan.max_chatbot_flows ?? 2,
      max_segments: plan.max_segments ?? 5,
      max_links: plan.max_links ?? 10,
      max_sub_accounts: plan.max_sub_accounts ?? 0,
      invite_credits: plan.invite_credits ?? 0,
      max_ai_replies: plan.max_ai_replies ?? 0,
    }
  })
}
