import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()
  const { id } = req.query

  if (req.method === 'GET') {
    const { data: link } = await db.from('tracked_links').select('*').eq('id', id as string).eq('user_id', user.userId).single()
    if (!link) return res.status(404).json({ error: 'Link not found' })
    const { data: clicks } = await db.from('link_clicks').select('*').eq('link_id', id as string).order('clicked_at', { ascending: false }).limit(100)
    return res.status(200).json({ link, clicks: clicks || [] })
  }

  if (req.method === 'DELETE') {
    await db.from('tracked_links').delete().eq('id', id as string).eq('user_id', user.userId)
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
