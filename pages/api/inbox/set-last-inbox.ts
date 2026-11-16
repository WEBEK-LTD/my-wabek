import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getAllowedInstances, canUseInstance } from '@/lib/inbox-access'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  const inboxId = req.body?.inbox_id || null  // null = "All Inboxes"
  if (inboxId !== null) {
    const allowed = await getAllowedInstances(db, user.actualUserId || user.userId, user.userId)
    if (typeof inboxId !== 'string' || !(await canUseInstance(db, user.userId, inboxId, allowed))) {
      return res.status(400).json({ error: 'Invalid inbox' })
    }
  }

  await db.from('users')
    .update({ last_inbox_id: inboxId })
    .eq('id', user.userId)

  return res.status(200).json({ ok: true })
}
