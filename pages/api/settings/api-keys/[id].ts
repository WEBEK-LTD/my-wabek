import { NextApiRequest, NextApiResponse } from 'next'
import { requireOwnerOrRole } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireOwnerOrRole(req, res)
  if (!user) return
  const db = supabaseAdmin()
  const { id } = req.query

  // Verify ownership
  if (typeof id !== 'string') return res.status(400).json({ error: 'Invalid id' })
  const { data: key } = await db.from('api_keys').select('id').eq('id', id).eq('user_id', user.userId).maybeSingle()
  if (!key) return res.status(404).json({ error: 'Key not found' })

  if (req.method === 'DELETE') {
    await db.from('api_keys').update({ is_active: false }).eq('id', id).eq('user_id', user.userId)
    return res.status(200).json({ success: true })
  }

  if (req.method === 'PUT') {
    const { name } = req.body || {}
    if (typeof name !== 'string' || !name.trim() || name.length > 100) return res.status(400).json({ error: 'Name required' })
    const { data } = await db.from('api_keys').update({ name: name.trim() }).eq('id', id).eq('user_id', user.userId)
      .select('id, name, key_prefix, permissions, last_used_at, is_active, created_at').single()
    return res.status(200).json({ key: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
