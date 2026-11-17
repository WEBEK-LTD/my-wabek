// Server-only helpers for tenant / team-member scoping in the inbox APIs.
import { supabaseAdmin } from './supabase'

type Db = ReturnType<typeof supabaseAdmin>

/**
 * Which WhatsApp instances (inboxes) the acting user may access.
 *   Owner                                   → null (no restriction)
 *   Team member with no team_member_instances rows → null (all of owner's)
 *   Team member with rows                   → only those instance ids
 */
export async function getAllowedInstances(db: Db, actingUserId: string, ownerId: string): Promise<string[] | null> {
  if (actingUserId === ownerId) return null
  const { data } = await db.from('team_member_instances').select('instance_id').eq('member_user_id', actingUserId)
  if (!data || data.length === 0) return null
  return data.map(r => r.instance_id as string)
}

/**
 * Team members limited to some numbers (Team → Inboxes) may not use the others.
 * Owners and unrestricted members always may.
 */
export async function memberMayUseInstance(db: Db, user: { userId: string; actualUserId?: string }, instanceId: string): Promise<boolean> {
  if (!user.actualUserId) return true
  const allowed = await getAllowedInstances(db, user.actualUserId, user.userId)
  return !allowed || allowed.includes(instanceId)
}

/** True if `instanceId` belongs to `ownerId` and the acting user may use it. */
export async function canUseInstance(db: Db, ownerId: string, instanceId: string, allowed: string[] | null): Promise<boolean> {
  if (allowed && !allowed.includes(instanceId)) return false
  const { data } = await db.from('whatsapp_instances').select('id').eq('id', instanceId).eq('user_id', ownerId).maybeSingle()
  return !!data
}

/** True if `contactId` belongs to `ownerId`. */
export async function ownsContact(db: Db, ownerId: string, contactId: string): Promise<boolean> {
  const { data } = await db.from('contacts').select('id').eq('id', contactId).eq('user_id', ownerId).maybeSingle()
  return !!data
}

/** A conversation may be assigned to the owner or to one of the owner's team members / sub-accounts. */
export async function isValidAssignee(db: Db, ownerId: string, assigneeId: string): Promise<boolean> {
  if (assigneeId === ownerId) return true
  const { data: tm } = await db.from('team_members').select('id').eq('owner_id', ownerId).eq('user_id', assigneeId).limit(1).maybeSingle()
  if (tm) return true
  const { data: sub } = await db.from('users').select('id').eq('id', assigneeId).eq('sub_account_of', ownerId).maybeSingle()
  return !!sub
}

/**
 * Create-or-update the conversation for (owner, contact, instance).
 * Migration 022 replaced the old UNIQUE(owner_id, contact_id) with
 * UNIQUE(owner_id, contact_id, instance_id) — NULL instance_ids never conflict,
 * so `upsert(onConflict: 'owner_id,contact_id')` no longer works. This does an
 * explicit select-then-update/insert and never rewrites an existing row's id.
 */
export async function saveConversationAssignment(
  db: Db,
  row: Record<string, unknown> & { owner_id: string; contact_id: string; instance_id?: string | null }
): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> {
  const instanceId = row.instance_id || null
  let q = db.from('conversation_assignments').select('id')
    .eq('owner_id', row.owner_id).eq('contact_id', row.contact_id)
  q = instanceId ? q.eq('instance_id', instanceId) : q.is('instance_id', null)
  const { data: existing, error: findErr } = await q.order('updated_at', { ascending: false }).limit(1)
  if (findErr) return { data: null, error: findErr }

  const fields: Record<string, unknown> = { ...row }
  delete fields.id
  const existingId = existing?.[0]?.id as string | undefined
  if (existingId) {
    const { data, error } = await db.from('conversation_assignments')
      .update(fields).eq('id', existingId).select().single()
    return { data, error }
  }
  const { data, error } = await db.from('conversation_assignments')
    .insert({ ...row, instance_id: instanceId }).select().single()
  return { data, error }
}
