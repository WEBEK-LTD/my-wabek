import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth, requireMemberAccess } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { escapeFilterValue } from '@/lib/security'
import { getAllowedInstances, canUseInstance, ownsContact, isValidAssignee, saveConversationAssignment } from '@/lib/inbox-access'
import { v4 as uuidv4 } from 'uuid'

const STATUSES = ['open', 'pending', 'resolved', 'spam']
const PRIORITIES = ['low', 'normal', 'high', 'urgent']

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireMemberAccess(req, res, 'inbox')
  if (!user) return
  const db = supabaseAdmin()

  // The effective owner is either the user themselves or their owner (sub-account)
  const ownerId = user.userId  // requireAuth already resolves sub_account_of
  const actingUserId = user.actualUserId || user.userId

  if (req.method === 'GET') {
    const status = typeof req.query.status === 'string' ? req.query.status : 'open'
    const assigned_to = typeof req.query.assigned_to === 'string' ? req.query.assigned_to : undefined
    const instance_id = typeof req.query.instance_id === 'string' ? req.query.instance_id : undefined
    const search = typeof req.query.search === 'string' ? escapeFilterValue(req.query.search) : ''
    const page = Math.min(Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1), 1000)
    const limit = 30
    const offset = (page - 1) * limit

    // ── Permission check ────────────────────────────────────────
    const allowedInstances = await getAllowedInstances(db, actingUserId, ownerId)

    if (instance_id && instance_id !== 'all') {
      if (allowedInstances && !allowedInstances.includes(instance_id)) {
        return res.status(403).json({ error: 'Access denied to this inbox' })
      }
    }

    // ── Build query ─────────────────────────────────────────────
    let query = db.from('conversation_assignments')
      .select(`
        *,
        contacts(id, name, phone, tags),
        assigned_user:assigned_to(id, name, email)
      `, { count: 'exact' })
      .eq('owner_id', ownerId)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1)

    if (instance_id && instance_id !== 'all') {
      query = query.eq('instance_id', instance_id)
    } else if (allowedInstances) {
      query = query.in('instance_id', allowedInstances)
    }

    if (status !== 'all') query = query.eq('status', status)
    if (assigned_to) query = query.eq('assigned_to', assigned_to)
    if (search) {
      query = query.or(`contacts.name.ilike.%${search}%,contacts.phone.ilike.%${search}%`)
    }

    const { data, error, count } = await query
    if (error) {
      console.error('[inbox] list error:', error.message)
      return res.status(500).json({ error: 'Failed to load conversations' })
    }

    // ── Last message per conversation ──────────────────────────
    // One indexed `limit 1` query per conversation instead of loading every
    // message of every listed contact.
    const selectedInstance = instance_id && instance_id !== 'all' ? instance_id : null
    const rows = data || []
    const lastMessages = await Promise.all(rows.map(async conv => {
      if (!conv.contact_id) return null
      const scope = selectedInstance || conv.instance_id
      const base = () => db.from('messages')
        .select('contact_id, instance_id, content, direction, created_at, type, media_url')
        .eq('user_id', ownerId)
        .eq('contact_id', conv.contact_id)
        .order('created_at', { ascending: false })
        .limit(1)
      if (scope) {
        const { data: m } = await base().eq('instance_id', scope)
        if (m?.[0]) return m[0]
        if (selectedInstance) return null
      }
      const { data: m } = await base()
      return m?.[0] || null
    }))

    // Enrich with instance data (owner-scoped)
    const instanceIds = [...new Set(rows.map(c => c.instance_id).filter(Boolean))]
    const instanceMap: Record<string, unknown> = {}
    if (instanceIds.length > 0) {
      const { data: instances } = await db.from('whatsapp_instances')
        .select('id, phone_number, display_name, instance_type, type')
        .eq('user_id', ownerId)
        .in('id', instanceIds)
      for (const inst of instances || []) instanceMap[inst.id] = inst
    }

    const conversations = rows.map((conv, i) => ({
      ...conv,
      last_message:       lastMessages[i] || null,
      whatsapp_instances: conv.instance_id ? (instanceMap[conv.instance_id] || null) : null,
    }))

    return res.status(200).json({ conversations, total: count, page })
  }

  if (req.method === 'POST') {
    const { contact_id, assigned_to, status, priority, tags, notes, instance_id } = req.body || {}
    if (!contact_id || typeof contact_id !== 'string') return res.status(400).json({ error: 'contact_id required' })
    if (status && !STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' })
    if (priority && !PRIORITIES.includes(priority)) return res.status(400).json({ error: 'Invalid priority' })
    if (tags !== undefined && (!Array.isArray(tags) || tags.some((t: unknown) => typeof t !== 'string'))) {
      return res.status(400).json({ error: 'tags must be an array of strings' })
    }

    if (!(await ownsContact(db, ownerId, contact_id))) return res.status(404).json({ error: 'Contact not found' })

    const allowed = await getAllowedInstances(db, actingUserId, ownerId)
    if (instance_id) {
      if (typeof instance_id !== 'string' || !(await canUseInstance(db, ownerId, instance_id, allowed))) {
        return res.status(403).json({ error: 'Access denied to this inbox' })
      }
    } else if (allowed) {
      // Restricted team members may only create conversations in their inboxes
      return res.status(400).json({ error: 'instance_id required' })
    }

    if (assigned_to && (typeof assigned_to !== 'string' || !(await isValidAssignee(db, ownerId, assigned_to)))) {
      return res.status(400).json({ error: 'Invalid assignee' })
    }

    const upsertData: Record<string, unknown> = {
      id: uuidv4(),
      owner_id: ownerId,
      contact_id,
      instance_id: instance_id || null,
      assigned_to: assigned_to || null,
      status: status || 'open',
      priority: priority || 'normal',
      tags: tags || [],
      notes: notes ? String(notes).slice(0, 5000) : null,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Upsert with the correct conflict target based on whether instance_id is set
    // Select-then-update/insert (022's unique key includes instance_id, and
    // NULL instance_ids never conflict, so a plain upsert can't be used).
    const { data, error } = await saveConversationAssignment(db, upsertData as typeof upsertData & { owner_id: string; contact_id: string })

    if (error) {
      console.error('[inbox] upsert error:', error.message)
      return res.status(500).json({ error: 'Failed to save conversation' })
    }
    return res.status(201).json({ conversation: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
