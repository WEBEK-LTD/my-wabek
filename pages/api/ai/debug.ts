import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  // Check user plan
  const { data: userRow } = await db.from('users').select('plan_id, plan_expires_at').eq('id', user.userId).single()
  
  // Check plan max_ai_replies
  let planInfo = null
  if (userRow?.plan_id) {
    const { data: plan } = await db.from('plans').select('name, max_ai_replies').eq('id', userRow.plan_id).single()
    planInfo = plan
  }

  // Check ai_settings
  const { data: aiSettings } = await db.from('ai_settings').select('instance_id, is_enabled, model, replies_this_month').eq('user_id', user.userId)

  // Check instances
  const { data: instances } = await db.from('whatsapp_instances').select('id, display_name, status, instance_type, type').eq('user_id', user.userId)

  return res.status(200).json({
    user_id: user.userId,
    plan: planInfo,
    plan_id: userRow?.plan_id,
    plan_expires_at: userRow?.plan_expires_at,
    ai_settings: aiSettings || [],
    instances: instances || [],
    issues: [
      !userRow?.plan_id ? '❌ No plan assigned' : null,
      planInfo?.max_ai_replies === 0 ? '❌ Plan has max_ai_replies=0 — update in Admin → Plans' : null,
      planInfo?.max_ai_replies == null ? '❌ max_ai_replies column missing — run 010_with_ai.sql' : null,
      !aiSettings?.some(s => s.is_enabled) ? '❌ No AI settings enabled — go to Dashboard → AI Auto-Reply' : null,
    ].filter(Boolean)
  })
}
