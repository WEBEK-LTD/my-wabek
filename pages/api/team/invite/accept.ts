import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { hashPassword, signToken, generateApiKey } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { token, password } = req.body
  if (!token || !password) return res.status(400).json({ error: 'token and password required' })

  const db = supabaseAdmin()
  const { data: invite } = await db.from('team_members').select('*').eq('invite_token', token).eq('status', 'pending').single()
  if (!invite) return res.status(404).json({ error: 'Invalid or expired invitation' })

  const passwordHash = await hashPassword(password)
  const { key: apiKey } = generateApiKey()

  // Create user account
  const { data: user, error } = await db.from('users').insert({
    id: uuidv4(),
    email: invite.email.toLowerCase(),
    name: invite.name,
    password_hash: passwordHash,
    role: 'user',
    api_key: apiKey,
    is_active: true,
    is_verified: true,
  }).select().single()

  if (error) {
    // User might already exist
    const { data: existing } = await db.from('users').select('id').eq('email', invite.email.toLowerCase()).single()
    if (!existing) return res.status(500).json({ error: error.message })

    await db.from('team_members').update({
      user_id: existing.id,
      status: 'active',
      joined_at: new Date().toISOString(),
      invite_token: null,
    }).eq('id', invite.id)

    const jwtToken = await signToken({ userId: existing.id, email: invite.email, role: 'user' })
    res.setHeader('Set-Cookie', `wabek_token=${jwtToken}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax; Secure`)
    return res.status(200).json({ success: true, user: { id: existing.id, email: invite.email, name: invite.name, role: 'user' }, token: jwtToken })
  }

  // Update team member with user_id
  await db.from('team_members').update({
    user_id: user.id,
    status: 'active',
    joined_at: new Date().toISOString(),
    invite_token: null,
  }).eq('id', invite.id)

  const jwtToken = await signToken({ userId: user.id, email: user.email, role: user.role })
  res.setHeader('Set-Cookie', `wabek_token=${jwtToken}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax; Secure`)
  return res.status(200).json({ success: true, user: { id: user.id, email: user.email, name: user.name, role: user.role }, token: jwtToken })
}
