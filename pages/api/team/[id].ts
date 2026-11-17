import { NextApiRequest, NextApiResponse } from 'next'
import { requireOwnerOrRole, bumpTokenVersion } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { effectivePermissions, parseStoredPermissions, presetOf, roleForPreset } from '@/lib/team-permissions'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Team management is owner-only.
  const user = await requireOwnerOrRole(req, res)
  if (!user) return
  const db = supabaseAdmin()
  const { id } = req.query
  if (typeof id !== 'string' || !UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid member id' })

  const { data: member } = await db.from('team_members')
    .select('*').eq('id', id).eq('owner_id', user.userId).maybeSingle()
  if (!member) return res.status(404).json({ error: 'Member not found' })

  if (req.method === 'PUT') {
    let pendingInstances: string[] | null = null
    const { role, status, toggle_instance, permissions, instances } = req.body || {}

    // Full list of numbers the member may reply from ([] = all numbers).
    let instancesSaved = false
    if (Array.isArray(instances)) {
      const ids = instances.filter((x: unknown) => typeof x === 'string' && UUID_RE.test(x)).slice(0, 50)
      const { data: owned } = ids.length
        ? await db.from('whatsapp_instances').select('id').eq('user_id', user.userId).in('id', ids)
        : { data: [] as { id: string }[] }
      const keep = (owned || []).map(o => o.id)
      if (member.user_id) {
        await db.from('team_member_instances').delete().eq('member_user_id', member.user_id)
        if (keep.length) await db.from('team_member_instances').insert(keep.map(id => ({ member_user_id: member.user_id, instance_id: id })))
      } else {
        pendingInstances = keep // pending invite: applied on accept
      }
      instancesSaved = true
    }

    if (toggle_instance) {
      if (!member.user_id) return res.status(404).json({ error: 'Member not found' })
      if (typeof toggle_instance !== 'string' || !UUID_RE.test(toggle_instance)) {
        return res.status(400).json({ error: 'Invalid instance id' })
      }

      // Security: verify instance belongs to this owner
      const { data: inst } = await db.from('whatsapp_instances')
        .select('id').eq('id', toggle_instance).eq('user_id', user.userId).maybeSingle()
      if (!inst) return res.status(403).json({ error: 'Instance not found or not yours' })

      const { data: existing } = await db.from('team_member_instances')
        .select('id').eq('member_user_id', member.user_id).eq('instance_id', toggle_instance).maybeSingle()

      if (existing) {
        await db.from('team_member_instances')
          .delete().eq('member_user_id', member.user_id).eq('instance_id', toggle_instance)
      } else {
        await db.from('team_member_instances')
          .insert({ member_user_id: member.user_id, instance_id: toggle_instance })
      }
      return res.status(200).json({ success: true })
    }

    const updates: Record<string, unknown> = {}
    if (role && ['agent', 'admin', 'viewer'].includes(role)) { updates.role = role; updates.permissions = null }
    if (permissions !== undefined) {
      const p = parseStoredPermissions(permissions)
      if (!p) return res.status(400).json({ error: 'Invalid permissions' })
      updates.role = roleForPreset(p.preset, p.areas)
      updates.permissions = updates.role === 'admin' ? null : p
    }
    if (pendingInstances) {
      const base = (updates.permissions !== undefined ? updates.permissions : (member as { permissions?: unknown }).permissions) as Record<string, unknown> | null
      updates.permissions = { ...(base || {}), instances: pendingInstances }
    }
    if (instancesSaved && Object.keys(updates).length === 0) return res.status(200).json({ success: true })
    if (status && ['active', 'suspended'].includes(status)) updates.status = status
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nothing to update' })
    // A pending invite can only become active by being accepted.
    if (updates.status === 'active' && member.status === 'pending') {
      return res.status(400).json({ error: 'Invitation has not been accepted yet' })
    }

    let { data, error } = await db.from('team_members')
      .update(updates).eq('id', id).eq('owner_id', user.userId)
      .select('*').single()
    if (error && permissions === undefined && 'permissions' in updates && /permissions/i.test(error.message || '')) {
      // Plain role change before migration 037: nothing to reset.
      delete updates.permissions
      ;({ data, error } = await db.from('team_members').update(updates).eq('id', id).eq('owner_id', user.userId).select('*').single())
    }
    if (error) {
      console.error('[team PUT] update failed:', error.message)
      if (/permissions/i.test(error.message || '')) return res.status(503).json({ error: 'Permissions are not available yet (database migration 037 pending)' })
      return res.status(500).json({ error: 'Could not update member' })
    }

    if (member.user_id && updates.status === 'suspended') {
      // Access stops immediately: requireAuth only maps active memberships,
      // and outstanding tokens are revoked.
      await bumpTokenVersion(member.user_id)
    }
    if (member.user_id && updates.status === 'active') {
      // Re-link a reactivated member (only if not attached to another account).
      await db.from('users').update({ sub_account_of: user.userId })
        .eq('id', member.user_id).is('sub_account_of', null)
    }
    // New permissions apply on the member's next request (requireAuth reads them from the DB).
    const m = data as Record<string, any>
    return res.status(200).json({ member: {
      id: m.id, owner_id: m.owner_id, user_id: m.user_id, name: m.name, email: m.email, role: m.role, status: m.status, created_at: m.created_at,
      preset: presetOf(m.role, m.permissions), permissions: effectivePermissions(m.role, m.permissions),
    } })
  }

  if (req.method === 'DELETE') {
    if (member.user_id) {
      await db.from('team_member_instances').delete().eq('member_user_id', member.user_id)
      // Detach from this owner's account and revoke all of the member's sessions.
      await db.from('users').update({ sub_account_of: null })
        .eq('id', member.user_id).eq('sub_account_of', user.userId)
      await bumpTokenVersion(member.user_id)
    }

    await db.from('team_members').delete().eq('id', id).eq('owner_id', user.userId)
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
