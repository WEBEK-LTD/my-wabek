import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth'
import { checkPlanFeature } from '@/lib/middleware'
import { automationFlowSchema } from '@/lib/automation-engine'

// Same validation as POST, but every field optional (and no defaults, so a
// partial update such as `{ is_active }` doesn't reset other columns).
const updateSchema = automationFlowSchema.extend({
  nodes: automationFlowSchema.shape.nodes.removeDefault(),
  is_active: automationFlowSchema.shape.is_active.removeDefault(),
}).partial()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()
  const id = typeof req.query.id === 'string' ? req.query.id : ''

  const { data: flow } = await db.from('automation_flows').select('*').eq('id', id).eq('user_id', user.userId).maybeSingle()
  if (!flow) return res.status(404).json({ error: 'Flow not found' })

  if (req.method === 'GET') return res.status(200).json({ flow })

  if (req.method === 'PUT') {
    const parsed = updateSchema.safeParse(req.body || {})
    if (!parsed.success) return res.status(400).json({ error: 'Invalid data', details: parsed.error.errors })
    const body = parsed.data

    if (body.is_active) {
      const allowed = await checkPlanFeature(user.userId, 'allow_automation')
      if (!allowed) {
        return res.status(403).json({
          error: 'Upgrade required',
          detail: 'Automation Flows are available on Starter, Pro, and Business plans. Please upgrade to activate automation flows.',
          upgrade_required: true,
        })
      }
    }

    if (body.instance_id) {
      const { data: inst } = await db.from('whatsapp_instances').select('id')
        .eq('id', body.instance_id).eq('user_id', user.userId).maybeSingle()
      if (!inst) return res.status(400).json({ error: 'Instance not found' })
    }

    const { data, error } = await db.from('automation_flows')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id).eq('user_id', user.userId).select().single()
    if (error) {
      console.error('[automation] update error:', error.message)
      return res.status(500).json({ error: 'Failed to update flow' })
    }
    return res.status(200).json({ flow: data })
  }

  if (req.method === 'DELETE') {
    await db.from('automation_flows').delete().eq('id', id).eq('user_id', user.userId)
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
