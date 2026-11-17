import { NextApiRequest, NextApiResponse } from 'next'
import { requireOwnerOrPermission, generateApiKey } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { API_KEY_PERMISSIONS, isValidApiKeyPermission } from '@/lib/api-key-auth'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireOwnerOrPermission(req, res, 'integrations', 'edit')
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data } = await db.from('api_keys').select('id, name, key_prefix, permissions, last_used_at, is_active, created_at').eq('user_id', user.userId).order('created_at', { ascending: false })
    return res.status(200).json({ keys: data || [], available_permissions: API_KEY_PERMISSIONS })
  }

  if (req.method === 'POST') {
    // Permissions: 'send', 'contacts:read', 'contacts:write', 'otp' (default: all)
    const { name, permissions = [...API_KEY_PERMISSIONS] } = req.body || {}
    if (typeof name !== 'string' || !name.trim() || name.length > 100) return res.status(400).json({ error: 'Name required' })
    if (!Array.isArray(permissions) || !permissions.length || permissions.length > 20 || permissions.some(p => !isValidApiKeyPermission(p))) {
      return res.status(400).json({ error: `Invalid permissions. Allowed: ${API_KEY_PERMISSIONS.join(', ')}` })
    }

    const { key, prefix, hash } = generateApiKey()
    const { data, error } = await db.from('api_keys').insert({
      id: uuidv4(),
      user_id: user.userId,
      name: name.trim(),
      key_hash: hash,
      key_prefix: prefix,
      permissions: Array.from(new Set(permissions as string[])),
      is_active: true,
    }).select().single()

    if (error || !data) {
      console.error('[api-keys] insert failed:', error?.message)
      return res.status(500).json({ error: 'Could not create API key' })
    }
    const { key_hash: _omit, ...record } = data as Record<string, unknown>
    return res.status(201).json({ key, record })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
