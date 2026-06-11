import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const instance = req.query.instance as string
  if (!instance) return res.status(200).json({ connected: false })

  const db = supabaseAdmin()
  const { data } = await db
    .from('wix_user_links')
    .select('user_id')
    .eq('wix_instance_id', instance)
    .maybeSingle()

  return res.status(200).json({ connected: !!data })
}
