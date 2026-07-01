import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

// ─── Resolve allowed instances for current user ───────────────
// Owner → all instances (returns null = no filter)
// Team member with no rows in team_member_instances → all instances
// Team member with rows → only those instances
async function getAllowedInstances(
  db: ReturnType<typeof supabaseAdmin>,
  userId: string,
  ownerId: string
): Promise<string[] | null> {
  // Owner always sees everything
  if (userId === ownerId) return null

  const { data } = await db
    .from('team_member_instances')
    .select('instance_id')
    .eq('member_user_id', userId)

  if (!data || data.length === 0) return null // no restrictions = see all
  return data.map(r => r.instance_id)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  // The effective owner is either the user themselves or their owner (sub-account)
  const ownerId = user.userId  // requireAuth already resolves sub_account_of

  if (req.method === 'GET') {
    const { status = 'open', assigned_to, page = '1', search, instance_id } = req.query
    const limit = 30
    const offset = (parseInt(page as string) - 1) * limit

    // ── Permission check ────────────────────────────────────────
    // Resolve which instances this user can see
    const allowedInstances = await getAllowedInstances(db, user.actualUserId || user.userId, ownerId)

    // If a specific inbox was requested, verify access
    if (instance_id && instance_id !== 'all') {
      if (allowedInstances && !allowedInstances.includes(instance_id as string)) {
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

    // Filter by specific inbox (backend filtering — not frontend)
    if (instance_id && instance_id !== 'all') {
      query = query.eq('instance_id', instance_id as string)
    } else if (allowedInstances) {
      // Team member: restrict to allowed instances only
      query = query.in('instance_id', allowedInstances)
    }
    // instance_id === 'all' and owner → no instance filter (see everything)

    if (status !== 'all') query = query.eq('status', status as string)
    if (assigned_to) query = query.eq('assigned_to', assigned_to as string)
    if (search) {
      // Search by contact name or phone
      query = query.or(`contacts.name.ilike.%${search}%,contacts.phone.ilike.%${search}%`)
    }

    const { data, error, count } = await query
    if (error) return res.status(500).json({ error: error.message })

    // ── Last message per conversation ──────────────────────────
    // Scoped to the instance if one is selected (avoids cross-inbox message bleed)
    const convIds = (data || []).map(c => c.id)
    const contactIds = (data || []).map(c => c.contact_id)
    let lastMessages: Record<string, unknown> = {}

    if (contactIds.length > 0) {
      let msgQuery = db.from('messages')
        .select('contact_id, instance_id, content, direction, created_at, type, media_url')
        .eq('user_id', ownerId)
        .in('contact_id', contactIds)
        .order('created_at', { ascending: false })

      // Scope last message to the selected instance too
      if (instance_id && instance_id !== 'all') {
        msgQuery = msgQuery.eq('instance_id', instance_id as string)
      }

      const { data: msgs } = await msgQuery
      for (const msg of msgs || []) {
        const key = `${msg.contact_id as string}:${msg.instance_id as string}`
        if (!lastMessages[key]) lastMessages[key] = msg
        // Also keep a fallback by contact_id only (for All Inboxes view)
        const contactKey = msg.contact_id as string
        if (!lastMessages[contactKey]) lastMessages[contactKey] = msg
      }
    }

    // Enrich with instance data (separate query — no FK dependency required)
    const instanceIds = [...new Set((data || []).map(c => c.instance_id).filter(Boolean))]
    let instanceMap: Record<string, unknown> = {}
    if (instanceIds.length > 0) {
      const { data: instances } = await db.from('whatsapp_instances')
        .select('id, phone_number, display_name, instance_type, type')
        .in('id', instanceIds)
      for (const inst of instances || []) {
        instanceMap[inst.id] = inst
      }
    }

    const conversations = (data || []).map(conv => {
      const key = `${conv.contact_id}:${conv.instance_id}`
      return {
        ...conv,
        last_message:         lastMessages[key] || lastMessages[conv.contact_id] || null,
        whatsapp_instances:   conv.instance_id ? (instanceMap[conv.instance_id] || null) : null,
      }
    })

    return res.status(200).json({
      conversations,
      total: count,
      page: parseInt(page as string),
    })
  }

  // ── GET /api/inbox/instances — list accessible inboxes ───────
  // (handled by the specific instances endpoint, but also here for convenience)

  if (req.method === 'POST') {
    const { contact_id, assigned_to, status, priority, tags, notes, instance_id } = req.body
    if (!contact_id) return res.status(400).json({ error: 'contact_id required' })

    // Use new conflict target that includes instance_id
    const upsertData: Record<string, unknown> = {
      id: uuidv4(),
      owner_id: ownerId,
      contact_id,
      instance_id: instance_id || null,
      assigned_to: assigned_to || null,
      status: status || 'open',
      priority: priority || 'normal',
      tags: tags || [],
      notes: notes || null,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Upsert with the correct conflict target based on whether instance_id is set
    const { data, error } = instance_id
      ? await db.from('conversation_assignments').upsert(upsertData, {
          onConflict: 'owner_id,contact_id,instance_id',
        }).select().single()
      : await db.from('conversation_assignments').upsert(upsertData, {
          onConflict: 'owner_id,contact_id',
        }).select().single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ conversation: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
