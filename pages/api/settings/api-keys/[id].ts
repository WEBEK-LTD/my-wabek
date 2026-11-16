import { NextApiRequest, NextApiResponse } from 'next'
import { requireOwnerOrRole } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { API_KEY_PERMISSIONS, isValidApiKeyPermission } from '@/lib/api-key-auth'

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
    const { name, permissions } = req.body || {}
    const update: Record<string, unknown> = {}
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim() || name.length > 100) return res.status(400).json({ error: 'Name required' })
      update.name = name.trim()
    }
    if (permissions !== undefined) {
      if (!Array.isArray(permissions) || !permissions.length || permissions.length > 20 || permissions.some(p => !isValidApiKeyPermission(p))) {
        return res.status(400).json({ error: `Invalid permissions. Allowed: ${API_KEY_PERMISSIONS.join(', ')}` })
      }
      update.permissions = Array.from(new Set(permissions as string[]))
    }
    if (!Object.keys(update).length) return res.status(400).json({ error: 'Nothing to update' })
    const { data } = await db.from('api_keys').update(update).eq('id', id).eq('user_id', user.userId)
      .select('id, name, key_prefix, permissions, last_used_at, is_active, created_at').single()
    return res.status(200).json({ key: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
