import { NextApiRequest, NextApiResponse } from 'next'
import { requireOwnerOrRole, hashPassword, generateApiKey } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getSetting } from '@/lib/settings'
import { v4 as uuidv4 } from 'uuid'

const PUBLIC_USER_FIELDS = 'id, name, email, is_active, created_at'

function limitInt(v: unknown, def: number): number {
  if (v === undefined || v === null || v === '') return def
  const n = parseInt(String(v), 10)
  if (!Number.isFinite(n) || n < -1) return def
  return Math.min(n, 10_000_000)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireOwnerOrRole(req, res)
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data } = await db.from('sub_accounts')
      .select(`*, user:user_id(${PUBLIC_USER_FIELDS})`)
      .eq('owner_id', user.userId).order('created_at')
    return res.status(200).json({ accounts: data || [] })
  }

  if (req.method === 'POST') {
    const { name, email, password, max_contacts, max_instances, max_messages_month } = req.body || {}
    if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string' || !name.trim() || !email || !password) {
      return res.status(400).json({ error: 'name, email, password required' })
    }
    const cleanEmail = email.toLowerCase().trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 254) return res.status(400).json({ error: 'Invalid email' })
    if (password.length < 8 || password.length > 256) return res.status(400).json({ error: 'Password must be at least 8 characters' })

    const allowReg = await getSetting('allow_registration', 'true')
    if (allowReg === 'false' || allowReg === false) {
      return res.status(403).json({ error: 'Creating new accounts is currently disabled' })
    }

    const { data: existing } = await db.from('users').select('id').eq('email', cleanEmail).maybeSingle()
    if (existing) return res.status(409).json({ error: 'Email already registered' })

    const passwordHash = await hashPassword(password)
    const { key: apiKey } = generateApiKey()

    const { data: newUser, error: userError } = await db.from('users').insert({
      id: uuidv4(), email: cleanEmail, name: name.trim().slice(0, 100),
      password_hash: passwordHash, role: 'user',
      api_key: apiKey, is_active: true, is_verified: true,
    }).select(PUBLIC_USER_FIELDS).single()

    if (userError || !newUser) {
      console.error('[sub-accounts] user insert failed:', userError?.message)
      return res.status(500).json({ error: 'Could not create sub-account' })
    }

    const { data: subAccount, error: subError } = await db.from('sub_accounts').insert({
      id: uuidv4(), owner_id: user.userId, user_id: newUser.id,
      max_contacts: limitInt(max_contacts, -1),
      max_instances: limitInt(max_instances, 1),
      max_messages_month: limitInt(max_messages_month, 1000),
    }).select().single()

    if (subError) {
      console.error('[sub-accounts] insert failed:', subError.message)
      return res.status(500).json({ error: 'Could not create sub-account' })
    }
    return res.status(201).json({ account: { ...subAccount, user: newUser } })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
