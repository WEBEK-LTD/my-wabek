import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = req.query.user_id as string
  if (!userId) return res.status(400).json({})

  const db = supabaseAdmin()

  const [msgsRes, contactsRes, campaignsRes] = await Promise.all([
    db.from('messages').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('direction', 'outbound'),
    db.from('contacts').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    db.from('campaigns').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ])

  return res.status(200).json({
    messages:  msgsRes.count  || 0,
    contacts:  contactsRes.count  || 0,
    campaigns: campaignsRes.count || 0,
  })
}
