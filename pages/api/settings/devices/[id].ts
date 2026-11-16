import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' })
  const db = supabaseAdmin()
  await db.from('trusted_devices').delete().eq('id', req.query.id as string).eq('user_id', user.actualUserId || user.userId)
  return res.status(200).json({ success: true })
}
