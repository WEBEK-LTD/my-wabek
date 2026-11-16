import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  const ownerId = user.userId

  // Get all connected instances for this owner
  const { data: instances, error } = await db
    .from('whatsapp_instances')
    .select('id, phone_number, display_name, instance_type, type, status')
    .eq('user_id', ownerId)
    .in('status', ['connected', 'active'])
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[inbox/inboxes] error:', error.message)
    return res.status(500).json({ error: 'Failed to load inboxes' })
  }

  // Check if this user has instance-level restrictions
  const isSubAccount = !!user.actualUserId
  let allowedIds: string[] | null = null

  if (isSubAccount) {
    const { data: perms } = await db
      .from('team_member_instances')
      .select('instance_id')
      .eq('member_user_id', user.actualUserId!)
    if (perms && perms.length > 0) {
      allowedIds = perms.map(p => p.instance_id)
    }
  }

  const accessible = (instances || []).filter(inst =>
    !allowedIds || allowedIds.includes(inst.id)
  )

  // Unread counts per inbox
  // (head-only exact counts — never load the rows themselves)
  const unreadCounts: Record<string, number> = {}
  await Promise.all(accessible.map(async inst => {
    const { count } = await db
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', ownerId)
      .eq('instance_id', inst.id)
      .eq('direction', 'inbound')
      .eq('status', 'delivered')
    unreadCounts[inst.id] = count || 0
  }))

  const inboxes = accessible.map(inst => ({
    id: inst.id,
    name: inst.display_name || inst.phone_number,
    phone_number: inst.phone_number,
    type: inst.instance_type || inst.type,
    unread: unreadCounts[inst.id] || 0,
  }))

  // Is this user an owner (can see "All Inboxes")?
  const canSeeAll = !isSubAccount || !allowedIds

  // Last selected inbox (from user preferences)
  const { data: userPref } = await db
    .from('users')
    .select('last_inbox_id')
    .eq('id', ownerId)
    .maybeSingle()

  return res.status(200).json({
    inboxes,
    can_see_all: canSeeAll,
    last_inbox_id: userPref?.last_inbox_id || null,
  })
}
