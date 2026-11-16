import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveWixCaller } from '@/lib/wix-auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const caller = await resolveWixCaller(req, res)
  if (!caller) return

  const { wa_instance_id } = req.body || {}
  if (!wa_instance_id) return res.status(400).json({ error: 'Missing params' })

  const db = supabaseAdmin()
  await db.from('whatsapp_instances')
    .update({ status: 'disconnected', updated_at: new Date().toISOString() })
    .eq('id', wa_instance_id)
    .eq('user_id', caller.userId)

  return res.status(200).json({ success: true })
}
