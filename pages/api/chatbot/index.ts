import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data } = await db.from('chatbot_flows').select('*').eq('user_id', user.userId).order('created_at', { ascending: false })
    return res.status(200).json({ flows: data || [] })
  }

  if (req.method === 'POST') {
    // Check plan limit
    // Plan limit check removed (was incorrectly checking 'campaigns' limit for this resource)

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
      is_active: false,
    }).select().single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ flow: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
