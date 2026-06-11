import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { hashPassword, generateApiKey } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data } = await db.from('sub_accounts').select('*, user:user_id(id, name, email, is_active, created_at)').eq('owner_id', user.userId).order('created_at')
    return res.status(200).json({ accounts: data || [] })
  }

  if (req.method === 'POST') {
    const { name, email, password, max_contacts, max_instances, max_messages_month } = req.body
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' })

    const { data: existing } = await db.from('users').select('id').eq('email', email.toLowerCase()).single()
    if (existing) return res.status(409).json({ error: 'Email already registered' })

    const passwordHash = await hashPassword(password)
    const { key: apiKey } = generateApiKey()

    const { data: newUser, error: userError } = await db.from('users').insert({
      id: uuidv4(), email: email.toLowerCase(), name,
      password_hash: passwordHash, role: 'user',
      api_key: apiKey, is_active: true, is_verified: true,
    }).select().single()

    if (userError) return res.status(500).json({ error: userError.message })

    const { data: subAccount, error: subError } = await db.from('sub_accounts').insert({
      id: uuidv4(), owner_id: user.userId, user_id: newUser.id,
      max_contacts: max_contacts || -1,
      max_instances: max_instances || 1,
      max_messages_month: max_messages_month || 1000,
    }).select().single()

    if (subError) return res.status(500).json({ error: subError.message })
    return res.status(201).json({ account: { ...subAccount, user: newUser } })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
