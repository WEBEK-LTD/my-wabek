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
