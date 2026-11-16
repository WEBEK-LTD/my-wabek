import { NextApiRequest, NextApiResponse } from 'next'
import { requireOwnerOrRole, bumpTokenVersion } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

function limitInt(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined
  const n = parseInt(String(v), 10)
  if (!Number.isFinite(n) || n < -1) return undefined
  return Math.min(n, 10_000_000)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireOwnerOrRole(req, res)
  if (!user) return
  const db = supabaseAdmin()
  const { id } = req.query
  if (typeof id !== 'string') return res.status(400).json({ error: 'Invalid id' })

  // Verify ownership
  const { data: sub } = await db.from('sub_accounts').select('*').eq('id', id).eq('owner_id', user.userId).maybeSingle()
  if (!sub) return res.status(404).json({ error: 'Sub-account not found' })

  if (req.method === 'PUT') {
    const { max_contacts, max_instances, max_messages_month, is_active } = req.body || {}
    const updates: Record<string, unknown> = {}
    const mc = limitInt(max_contacts), mi = limitInt(max_instances), mm = limitInt(max_messages_month)
    if (mc !== undefined) updates.max_contacts = mc
    if (mi !== undefined) updates.max_instances = mi
    if (mm !== undefined) updates.max_messages_month = mm
    if (typeof is_active === 'boolean') updates.is_active = is_active
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nothing to update' })

    const { data, error } = await db.from('sub_accounts').update(updates).eq('id', id).eq('owner_id', user.userId).select().single()
    if (error) {
      console.error('[sub-accounts PUT] failed:', error.message)
      return res.status(500).json({ error: 'Could not update sub-account' })
    }

    if (typeof is_active === 'boolean') {
      await db.from('users').update({ is_active }).eq('id', sub.user_id)
      if (!is_active) await bumpTokenVersion(sub.user_id)
    }

    return res.status(200).json({ account: data })
  }

  if (req.method === 'DELETE') {
    // Suspend the user account and revoke its sessions
    await db.from('users').update({ is_active: false }).eq('id', sub.user_id)
    await db.from('sub_accounts').update({ is_active: false }).eq('id', id).eq('owner_id', user.userId)
    await bumpTokenVersion(sub.user_id)
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
