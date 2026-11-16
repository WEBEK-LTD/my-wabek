import { NextApiRequest, NextApiResponse } from 'next'
import { requireOwnerOrRole } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireOwnerOrRole(req, res)
  if (!user) return
  const db = supabaseAdmin()
  const { id } = req.query
  if (typeof id !== 'string') return res.status(400).json({ error: 'Invalid id' })

  if (req.method === 'PUT') {
    const { is_active, label } = req.body || {}
    const updates: Record<string, unknown> = {}
    if (typeof is_active === 'boolean') updates.is_active = is_active
    if (typeof label === 'string' && label.length <= 100) updates.label = label
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nothing to update' })
    const { data } = await db.from('reseller_invites').update(updates).eq('id', id).eq('reseller_id', user.userId).select().maybeSingle()
    if (!data) return res.status(404).json({ error: 'Invite not found' })
    return res.status(200).json({ invite: data })
  }

  if (req.method === 'DELETE') {
    await db.from('reseller_invites').delete().eq('id', id).eq('reseller_id', user.userId)
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
