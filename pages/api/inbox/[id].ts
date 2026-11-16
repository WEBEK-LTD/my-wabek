import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getAllowedInstances, isValidAssignee } from '@/lib/inbox-access'

const STATUSES = ['open', 'pending', 'resolved', 'spam']
const PRIORITIES = ['low', 'normal', 'high', 'urgent']

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()
  const id = typeof req.query.id === 'string' ? req.query.id : ''
  const ownerId = user.userId

  if (req.method === 'PUT') {
    const { data: conv } = await db.from('conversation_assignments').select('id, instance_id')
      .eq('id', id).eq('owner_id', ownerId).maybeSingle()
    if (!conv) return res.status(404).json({ error: 'Conversation not found' })

    // Team members restricted to specific inboxes may only touch those
    const allowed = await getAllowedInstances(db, user.actualUserId || user.userId, ownerId)
    if (allowed && (!conv.instance_id || !allowed.includes(conv.instance_id))) {
      return res.status(403).json({ error: 'Access denied to this inbox' })
    }

    const { assigned_to, status, priority, tags, notes } = req.body || {}
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (assigned_to !== undefined) {
      if (assigned_to !== null && assigned_to !== '') {
        if (typeof assigned_to !== 'string' || !(await isValidAssignee(db, ownerId, assigned_to))) {
          return res.status(400).json({ error: 'Invalid assignee' })
        }
        update.assigned_to = assigned_to
      } else {
        update.assigned_to = null
      }
    }
    if (status) {
      if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' })
      update.status = status
    }
    if (priority) {
      if (!PRIORITIES.includes(priority)) return res.status(400).json({ error: 'Invalid priority' })
      update.priority = priority
    }
    if (tags) {
      if (!Array.isArray(tags) || tags.some((t: unknown) => typeof t !== 'string')) {
        return res.status(400).json({ error: 'tags must be an array of strings' })
      }
      update.tags = tags.slice(0, 50)
    }
    if (notes !== undefined) update.notes = notes === null ? null : String(notes).slice(0, 5000)
    if (status === 'resolved') update.resolved_at = new Date().toISOString()

    const { data, error } = await db.from('conversation_assignments').update(update).eq('id', id).eq('owner_id', ownerId).select().single()
    if (error) {
      console.error('[inbox] update error:', error.message)
      return res.status(500).json({ error: 'Failed to update conversation' })
    }
    return res.status(200).json({ conversation: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
