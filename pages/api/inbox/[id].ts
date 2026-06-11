import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()
  const { id } = req.query

  if (req.method === 'PUT') {
    const { assigned_to, status, priority, tags, notes } = req.body
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (assigned_to !== undefined) update.assigned_to = assigned_to
    if (status) update.status = status
    if (priority) update.priority = priority
    if (tags) update.tags = tags
    if (notes !== undefined) update.notes = notes
    if (status === 'resolved') update.resolved_at = new Date().toISOString()

    const { data, error } = await db.from('conversation_assignments').update(update).eq('id', id as string).eq('owner_id', user.userId).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ conversation: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
