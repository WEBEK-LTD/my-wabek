import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth'
import { getAllowedInstances } from '@/lib/inbox-access'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { contact_id, instance_id, page = '1', limit = '50' } = req.query
    const pageNum = Math.max(1, parseInt(page as string) || 1)
    const limitNum = Math.min(Math.max(1, parseInt(limit as string) || 50), 100)
    const offset = (pageNum - 1) * limitNum

    let query = db.from('messages').select('*, contacts(name, phone)', { count: 'exact' })
      .eq('user_id', user.userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1)

    // Team members limited to some inboxes only see those instances' messages.
    const allowed = await getAllowedInstances(db, user.actualUserId || user.userId, user.userId)
    if (instance_id && allowed && !allowed.includes(String(instance_id))) {
      return res.status(403).json({ error: 'You do not have access to this inbox' })
    }

    if (contact_id) query = query.eq('contact_id', contact_id as string)
    if (instance_id) query = query.eq('instance_id', instance_id as string)
    else if (allowed) query = query.in('instance_id', allowed)

    const { data, error, count } = await query
    if (error) return res.status(500).json({ error: 'Failed to load messages' })
    return res.status(200).json({ messages: data?.reverse(), total: count, page: pageNum })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
