import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()
  const { id } = req.query

  const { data: flow } = await db.from('automation_flows').select('*').eq('id', id as string).eq('user_id', user.userId).single()
  if (!flow) return res.status(404).json({ error: 'Flow not found' })

  if (req.method === 'GET') return res.status(200).json({ flow })

  if (req.method === 'PUT') {
    const { name, trigger_type, trigger_value, nodes, is_active } = req.body
    const { data, error } = await db.from('automation_flows')
      .update({ name, trigger_type, trigger_value, nodes, is_active, updated_at: new Date().toISOString() })
      .eq('id', id as string).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ flow: data })
  }

  if (req.method === 'DELETE') {
    await db.from('automation_flows').delete().eq('id', id as string)
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
