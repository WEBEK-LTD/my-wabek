import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { contact_id, instance_id, page = '1', limit = '50' } = req.query
    const pageNum = parseInt(page as string)
    const limitNum = Math.min(parseInt(limit as string), 100)
    const offset = (pageNum - 1) * limitNum

    let query = db.from('messages').select('*, contacts(name, phone)', { count: 'exact' })
      .eq('user_id', user.userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1)

    if (contact_id) query = query.eq('contact_id', contact_id as string)
    if (instance_id) query = query.eq('instance_id', instance_id as string)

    const { data, error, count } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ messages: data?.reverse(), total: count, page: pageNum })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
