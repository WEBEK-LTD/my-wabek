import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const instanceId = req.query.instance_id as string || req.headers['x-wix-instance-id'] as string
  if (!instanceId) return res.status(400).json({ instances: [] })

  const db = supabaseAdmin()
  const { data: link } = await db.from('wix_user_links').select('user_id').eq('wix_instance_id', instanceId).maybeSingle()
  if (!link) return res.status(200).json({ instances: [] })

  const { data } = await db.from('whatsapp_instances').select('id,phone_number,display_name,status,phone_number_id,instance_type,type').eq('user_id', link.user_id)
  return res.status(200).json({ instances: data || [] })
}
