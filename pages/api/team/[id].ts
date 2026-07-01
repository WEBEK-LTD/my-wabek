import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()
  const { id } = req.query

  if (req.method === 'PUT') {
    const { role, status, toggle_instance } = req.body

    // Handle inbox permission toggle
    if (toggle_instance) {
      // First get the member's user_id
      const { data: member } = await db.from('team_members')
        .select('user_id').eq('id', id as string).eq('owner_id', user.userId).maybeSingle()
      if (!member?.user_id) return res.status(404).json({ error: 'Member not found' })

      // Check if permission already exists
      const { data: existing } = await db.from('team_member_instances')
        .select('id').eq('member_user_id', member.user_id).eq('instance_id', toggle_instance).maybeSingle()

      if (existing) {
        // Remove permission
        await db.from('team_member_instances')
          .delete().eq('member_user_id', member.user_id).eq('instance_id', toggle_instance)
      } else {
        // Add permission
        await db.from('team_member_instances')
          .insert({ member_user_id: member.user_id, instance_id: toggle_instance })
      }
      return res.status(200).json({ success: true })
    }

    const updates: Record<string, unknown> = {}
    if (role) updates.role = role
    if (status) updates.status = status

    const { data, error } = await db.from('team_members')
      .update(updates).eq('id', id as string).eq('owner_id', user.userId).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ member: data })
  }

  if (req.method === 'DELETE') {
    await db.from('team_members').delete().eq('id', id as string).eq('owner_id', user.userId)
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
