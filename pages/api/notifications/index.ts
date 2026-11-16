import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data } = await db
      .from('notifications')
      .select('*')
      .eq('user_id', user.userId)
      .order('created_at', { ascending: false })
      .limit(Math.min(Math.max(parseInt(String(req.query.limit ?? '20'), 10) || 20, 1), 100))
    return res.status(200).json({ notifications: data || [] })
  }

  if (req.method === 'PUT') {
    // Mark one notification ({ id }) or all of them (no id) as read
    const id = typeof req.body?.id === 'string' ? req.body.id : null
    let q = db.from('notifications').update({ is_read: true }).eq('user_id', user.userId).eq('is_read', false)
    if (id) q = q.eq('id', id)
    await q
    return res.status(200).json({ success: true })
  }

  if (req.method === 'DELETE') {
    const id = typeof req.body?.id === 'string' ? req.body.id : null
    if (id) await db.from('notifications').delete().eq('id', id).eq('user_id', user.userId)
    else await db.from('notifications').delete().eq('user_id', user.userId)
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
