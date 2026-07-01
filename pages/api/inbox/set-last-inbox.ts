import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  const { inbox_id } = req.body  // null = "All Inboxes"

  await db.from('users')
    .update({ last_inbox_id: inbox_id || null })
    .eq('id', user.userId)

  return res.status(200).json({ ok: true })
}
