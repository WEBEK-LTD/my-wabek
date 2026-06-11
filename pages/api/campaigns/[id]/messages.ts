import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = await requireAuth(req, res)
  if (!user) return
  const { id } = req.query
  const db = supabaseAdmin()
  const { data } = await db
    .from('messages')
    .select('id,wa_message_id,status,created_at,meta,contacts(name,phone)')
    .eq('campaign_id', id as string)
    .eq('user_id', user.userId)
    .order('created_at')
  return res.status(200).json({ messages: data || [] })
}
