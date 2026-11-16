import { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { requireMemberAccess } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { checkPlanFeature } from '@/lib/middleware'

// Whitelisted, validated fields for PUT — never spread req.body into the row.
const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  trigger_type: z.enum(['keyword', 'any_message', 'opt_in', 'button_reply', 'first_message']).optional(),
  trigger_keywords: z.array(z.string().max(200)).max(100).optional(),
  instance_id: z.string().uuid().nullable().optional(),
  nodes: z.array(z.record(z.unknown())).max(200).optional(),
  edges: z.array(z.record(z.unknown())).max(500).optional(),
  is_active: z.boolean().optional(),
  priority: z.number().int().min(-1000).max(1000).optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireMemberAccess(req, res, 'chatbot')
  if (!user) return
  const db = supabaseAdmin()
  const id = typeof req.query.id === 'string' ? req.query.id : ''

  const { data: flow } = await db.from('chatbot_flows').select('*').eq('id', id).eq('user_id', user.userId).maybeSingle()
  if (!flow) return res.status(404).json({ error: 'Flow not found' })

  if (req.method === 'GET') return res.status(200).json({ flow })

  if (req.method === 'PUT') {
    const parsed = updateSchema.safeParse(req.body || {})
    if (!parsed.success) return res.status(400).json({ error: 'Invalid data', details: parsed.error.errors })
    const body = parsed.data

    if (body.is_active) {
      const allowed = await checkPlanFeature(user.userId, 'allow_chatbot')
      if (!allowed) {
        return res.status(403).json({
          error: 'Upgrade required',
          detail: 'The Chatbot Builder is available on Pro and Business plans. Please upgrade to activate chatbot flows.',
          upgrade_required: true,
        })
      }
    }

    if (body.instance_id) {
      const { data: inst } = await db.from('whatsapp_instances').select('id')
        .eq('id', body.instance_id).eq('user_id', user.userId).maybeSingle()
      if (!inst) return res.status(400).json({ error: 'Instance not found' })
    }

    const { data, error } = await db.from('chatbot_flows').update({
      ...body,
      updated_at: new Date().toISOString(),
    }).eq('id', id).eq('user_id', user.userId).select().single()
    if (error) {
      console.error('[chatbot] update error:', error.message)
      return res.status(500).json({ error: 'Failed to update flow' })
    }
    return res.status(200).json({ flow: data })
  }

  if (req.method === 'DELETE') {
    await db.from('chatbot_flows').delete().eq('id', id).eq('user_id', user.userId)
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
