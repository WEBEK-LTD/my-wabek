import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth, generateApiKey } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data } = await db.from('api_keys').select('id, name, key_prefix, permissions, last_used_at, is_active, created_at').eq('user_id', user.userId).order('created_at', { ascending: false })
    return res.status(200).json({ keys: data || [] })
  }

  if (req.method === 'POST') {
    const { name, permissions = ['send', 'contacts', 'otp'] } = req.body
    if (!name) return res.status(400).json({ error: 'Name required' })

    const { key, prefix, hash } = generateApiKey()
    const { data, error } = await db.from('api_keys').insert({
      id: uuidv4(),
      user_id: user.userId,
      name,
      key_hash: hash,
      key_prefix: prefix,
      permissions,
      is_active: true,
    }).select().single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ key, record: { ...data } })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
