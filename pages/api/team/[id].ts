import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()
  const { id } = req.query
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!id || !UUID_RE.test(id as string)) return res.status(400).json({ error: 'Invalid member id' })

  if (req.method === 'PUT') {
    const { role, status, toggle_instance } = req.body

    if (toggle_instance) {
      const { data: member } = await db.from('team_members')
        .select('user_id').eq('id', id as string).eq('owner_id', user.userId).maybeSingle()
      if (!member?.user_id) return res.status(404).json({ error: 'Member not found' })

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

    // Guard: only update if at least one valid field provided
    const updates: Record<string, unknown> = {}
    if (role && ['agent', 'admin', 'viewer'].includes(role)) updates.role = role
    if (status && ['active', 'pending', 'suspended'].includes(status)) updates.status = status
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nothing to update' })

    const { data, error } = await db.from('team_members')
      .update(updates).eq('id', id as string).eq('owner_id', user.userId).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ member: data })
  }

  if (req.method === 'DELETE') {
    const { data: member } = await db.from('team_members')
      .select('user_id').eq('id', id as string).eq('owner_id', user.userId).maybeSingle()

    if (member?.user_id) {
      await db.from('team_member_instances').delete().eq('member_user_id', member.user_id)
    }

    await db.from('team_members').delete().eq('id', id as string).eq('owner_id', user.userId)
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

