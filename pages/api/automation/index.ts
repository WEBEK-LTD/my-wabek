import { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { requireMemberAccess } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'
import { checkPlanFeature } from '@/lib/middleware'
import { automationFlowSchema as createSchema } from '@/lib/automation-engine'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireMemberAccess(req, res, 'automation')
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data, error } = await db.from('automation_flows').select('*').eq('user_id', user.userId).order('created_at', { ascending: false })
    if (error) {
      console.error('[automation] list error:', error.message)
      return res.status(500).json({ error: 'Failed to load flows' })
    }
    return res.status(200).json({ flows: data })
  }

  if (req.method === 'POST') {
    // Premium feature gate (Wix review requirement): Automation Builder is
    // a Starter+ feature. Free plan (or no plan assigned) must not be able
    // to create automation flows.
    const allowed = await checkPlanFeature(user.userId, 'allow_automation')
    if (!allowed) {
      return res.status(403).json({
        error: 'Upgrade required',
        detail: 'Automation Flows are available on Starter, Pro, and Business plans. Please upgrade to create automation flows.',
        upgrade_required: true,
      })
    }

    try {
      const body = createSchema.parse(req.body)
      if (body.instance_id) {
        const { data: inst } = await db.from('whatsapp_instances').select('id')
          .eq('id', body.instance_id).eq('user_id', user.userId).maybeSingle()
        if (!inst) return res.status(400).json({ error: 'Instance not found' })
      }
      const { data, error } = await db.from('automation_flows').insert({ id: uuidv4(), user_id: user.userId, trigger_count: 0, ...body }).select().single()
      if (error) {
        console.error('[automation] create error:', error.message)
        return res.status(500).json({ error: 'Failed to create flow' })
      }
      return res.status(201).json({ flow: data })
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid data', details: err.errors })
      return res.status(500).json({ error: 'Failed to create flow' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
