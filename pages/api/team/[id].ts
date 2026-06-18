import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()
  const { id } = req.query

  // Only the actual account owner can manage team members.
  // Sub-accounts (team members) have userId = owner's ID but actualUserId = their own ID.
  // If actualUserId differs from userId, this is a team member trying to modify the team — block it.
  if (user.actualUserId && user.actualUserId !== user.userId) {
    return res.status(403).json({ error: 'Only the account owner can manage team members.' })
  }

  if (req.method === 'PUT') {
    const { role, status } = req.body
    const { data, error } = await db.from('team_members').update({ role, status }).eq('id', id as string).eq('owner_id', user.userId).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ member: data })
  }

  if (req.method === 'DELETE') {
    await db.from('team_members').delete().eq('id', id as string).eq('owner_id', user.userId)
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
