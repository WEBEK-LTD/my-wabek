import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveWixCaller } from '@/lib/wix-auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // user_id in the query is ignored: the account comes from the verified caller
  const caller = await resolveWixCaller(req, res)
  if (!caller) return
  const userId = caller.userId

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
