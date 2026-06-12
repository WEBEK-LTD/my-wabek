import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import { checkPlanFeature, getUserPlan } from '@/lib/middleware'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
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

    const { name, description, trigger_type, trigger_keywords, instance_id, nodes, edges } = req.body
    if (!name) return res.status(400).json({ error: 'name required' })

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

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ flow: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
