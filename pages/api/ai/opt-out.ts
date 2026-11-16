import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  const { contact_id, opted_out } = req.body
  if (!contact_id) return res.status(400).json({ error: 'contact_id required' })

  await db.from('contacts')
    .update({ ai_opted_out: opted_out !== false })
    .eq('id', contact_id)
    .eq('user_id', user.userId)

  return res.status(200).json({ success: true })
}
