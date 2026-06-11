import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { wa_instance_id, user_id } = req.body
  if (!wa_instance_id || !user_id) return res.status(400).json({ error: 'Missing params' })

  const db = supabaseAdmin()
  await db.from('whatsapp_instances')
    .update({ status: 'disconnected', updated_at: new Date().toISOString() })
    .eq('id', wa_instance_id)
    .eq('user_id', user_id)

  return res.status(200).json({ success: true })
}
