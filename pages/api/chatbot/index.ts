import { NextApiRequest, NextApiResponse } from 'next'
import { requireMemberAccess } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import { checkPlanFeature, getUserPlan } from '@/lib/middleware'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireMemberAccess(req, res, 'chatbot')
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data } = await db.from('chatbot_flows').select('*').eq('user_id', user.userId).order('created_at', { ascending: false })
    return res.status(200).json({ flows: data || [] })
  }

  if (req.method === 'POST') {
    // Premium feature gate (Wix review requirement): Chatbot Builder is a
    // Pro+ feature. Free/Starter plans (or no plan assigned) must not be
    // able to create chatbot flows.
    const allowed = await checkPlanFeature(user.userId, 'allow_chatbot')
    if (!allowed) {
      return res.status(403).json({
        error: 'Upgrade required',
        detail: 'The Chatbot Builder is available on Pro and Business plans. Please upgrade to create chatbot flows.',
        upgrade_required: true,
      })
    }

    // Max flows limit
    const plan = await getUserPlan(user.userId)
    const maxFlows = parseInt(String((plan as any)?.max_chatbot_flows ?? '-1'), 10)
    if (maxFlows >= 0) {
      const { count } = await db.from('chatbot_flows').select('id', { count: 'exact', head: true }).eq('user_id', user.userId)
      if ((count ?? 0) >= maxFlows) {
        return res.status(403).json({
          error: 'Plan limit reached',
          detail: `You've reached your plan's chatbot flow limit (${maxFlows}). Please upgrade to create more.`,
          upgrade_required: true,
        })
      }
    }

    const { name, description, trigger_type, trigger_keywords, instance_id, nodes, edges } = req.body || {}
    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name required' })
    if (nodes !== undefined && !Array.isArray(nodes)) return res.status(400).json({ error: 'nodes must be an array' })
    if (edges !== undefined && !Array.isArray(edges)) return res.status(400).json({ error: 'edges must be an array' })
    if (trigger_keywords !== undefined && !Array.isArray(trigger_keywords)) return res.status(400).json({ error: 'trigger_keywords must be an array' })

    if (instance_id) {
      const { data: inst } = await db.from('whatsapp_instances').select('id')
        .eq('id', String(instance_id)).eq('user_id', user.userId).maybeSingle()
      if (!inst) return res.status(400).json({ error: 'Instance not found' })
    }

    const { data, error } = await db.from('chatbot_flows').insert({
      id: uuidv4(),
      user_id: user.userId,
      name, description,
      trigger_type: trigger_type || 'keyword',
      trigger_keywords: trigger_keywords || [],
      instance_id: instance_id || null,
      nodes: nodes || [],
      edges: edges || [],
      is_active: true,
    }).select().single()

    if (error) {
      console.error('[chatbot] create error:', error.message)
      return res.status(500).json({ error: 'Failed to create flow' })
    }
    return res.status(201).json({ flow: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
