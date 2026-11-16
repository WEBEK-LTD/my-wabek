import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveWixCaller } from '@/lib/wix-auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // instance_id / x-wix-instance-id (plain ids) are no longer trusted: the
  // account comes from a signed Wix instance or the WABEK session.
  const caller = await resolveWixCaller(req, res)
  if (!caller) return

  const db = supabaseAdmin()
  const { data } = await db.from('whatsapp_instances')
    .select('id,phone_number,display_name,status,phone_number_id,instance_type,type')
    .eq('user_id', caller.userId)
  return res.status(200).json({ instances: data || [] })
}
