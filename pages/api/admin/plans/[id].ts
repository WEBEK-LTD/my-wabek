import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'
import { pick } from '@/lib/security'
import { logAction, getClientIp } from '@/lib/middleware'

// Columns an admin may edit through this endpoint.
export const PLAN_EDITABLE_FIELDS = [
  'name', 'description', 'price_monthly', 'price_yearly',
  'max_messages_month', 'max_contacts', 'max_instances', 'max_campaigns',
  'max_team_members', 'max_chatbot_flows', 'max_quick_replies', 'max_segments',
  'max_links', 'max_sub_accounts', 'max_ai_replies',
  'allow_api_access', 'allow_chatbot', 'allow_automation', 'allow_analytics',
  'allow_white_label', 'allow_sub_accounts', 'allow_reseller', 'allow_gift_invites', 'allow_ai',
  'invite_credits', 'features', 'is_active', 'sort_order',
  'stripe_price_id_monthly', 'stripe_price_id_yearly',
] as const

const NUMERIC = new Set(['price_monthly', 'price_yearly', 'max_messages_month', 'max_contacts', 'max_instances', 'max_campaigns',
  'max_team_members', 'max_chatbot_flows', 'max_quick_replies', 'max_segments', 'max_links', 'max_sub_accounts',
  'max_ai_replies', 'invite_credits', 'sort_order'])
const BOOLEAN = new Set(['allow_api_access', 'allow_chatbot', 'allow_automation', 'allow_analytics', 'allow_white_label',
  'allow_sub_accounts', 'allow_reseller', 'allow_gift_invites', 'allow_ai', 'is_active'])

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res)
  if (!admin) return
  const db = supabaseAdmin()
  const id = String(req.query.id || '')

  if (req.method === 'PUT') {
    const update = pick<Record<string, unknown>>(req.body, PLAN_EDITABLE_FIELDS)
    for (const [k, v] of Object.entries(update)) {
      if (NUMERIC.has(k) && v !== null && (typeof v !== 'number' || !Number.isFinite(v))) {
        return res.status(400).json({ error: `${k} must be a number` })
      }
      if (BOOLEAN.has(k) && v === null) { delete update[k]; continue }
      if (BOOLEAN.has(k) && typeof v !== 'boolean') return res.status(400).json({ error: `${k} must be true/false` })
      if ((k === 'stripe_price_id_monthly' || k === 'stripe_price_id_yearly') && v !== null && v !== '' &&
          (typeof v !== 'string' || !/^price_[A-Za-z0-9]+$/.test(v))) {
        return res.status(400).json({ error: `${k} must be a Stripe price id` })
      }
      if (k === 'stripe_price_id_monthly' || k === 'stripe_price_id_yearly') update[k] = v || null
    }
    if (typeof update.name === 'string' && !update.name.trim()) return res.status(400).json({ error: 'name is required' })

    const { data, error } = await db.from('plans').update({ ...update, updated_at: new Date().toISOString() }).eq('id', id).select().single()
    if (error) {
      console.error('[admin plans] update failed:', error.message)
      return res.status(500).json({ error: 'Failed to update plan' })
    }
    await logAction({ userId: admin.userId, action: 'admin_plan_update', resource: 'plan', resourceId: id, details: { fields: Object.keys(update) }, ipAddress: getClientIp(req) })
    return res.status(200).json({ plan: data })
  }

  if (req.method === 'DELETE') {
    const { error } = await db.from('plans').update({ is_active: false }).eq('id', id)
    if (error) {
      console.error('[admin plans] deactivate failed:', error.message)
      return res.status(500).json({ error: 'Failed to deactivate plan' })
    }
    await logAction({ userId: admin.userId, action: 'admin_plan_deactivate', resource: 'plan', resourceId: id, ipAddress: getClientIp(req) })
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
