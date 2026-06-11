import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()
  const { id } = req.query

  if (req.method === 'PUT') {
    const { is_active, label } = req.body
    const { data } = await db.from('reseller_invites').update({ is_active, label }).eq('id', id as string).eq('reseller_id', user.userId).select().single()
    return res.status(200).json({ invite: data })
  }

  if (req.method === 'DELETE') {
    await db.from('reseller_invites').delete().eq('id', id as string).eq('reseller_id', user.userId)
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
