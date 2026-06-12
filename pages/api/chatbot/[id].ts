import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()
  const { id } = req.query

  const { data: flow } = await db.from('chatbot_flows').select('*').eq('id', id as string).eq('user_id', user.userId).single()
  if (!flow) return res.status(404).json({ error: 'Flow not found' })

  if (req.method === 'GET') return res.status(200).json({ flow })

  if (req.method === 'PUT') {
    if (req.body?.is_active === true) {
      const allowed = await (await import('@/lib/middleware')).checkPlanFeature(user.userId, 'allow_chatbot')
      if (!allowed) {
        return res.status(403).json({
          error: 'Upgrade required',
          detail: 'The Chatbot Builder is available on Pro and Business plans. Please upgrade to activate chatbot flows.',
          upgrade_required: true,
        })
      }
    }

    const { data, error } = await db.from('chatbot_flows').update({
      ...req.body,
      updated_at: new Date().toISOString(),
    }).eq('id', id as string).eq('user_id', user.userId).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ flow: data })
  }

  if (req.method === 'DELETE') {
    await db.from('chatbot_flows').delete().eq('id', id as string).eq('user_id', user.userId)
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
