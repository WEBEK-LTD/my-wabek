import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { hashPassword, issueSession, generateApiKey, getAuthUser, getTokenFromRequest } from '@/lib/auth'
import { authRateLimitAsync } from '@/lib/middleware'
import { v4 as uuidv4 } from 'uuid'

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

function inviteExpired(invite: { invite_expires_at?: string | null; invited_at?: string | null; created_at?: string | null }): boolean {
  const explicit = invite.invite_expires_at ? new Date(invite.invite_expires_at).getTime() : null
  const issued = new Date(invite.invited_at || invite.created_at || 0).getTime()
  const expiresAt = explicit ?? issued + INVITE_TTL_MS
  return !Number.isFinite(expiresAt) || expiresAt < Date.now()
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!(await authRateLimitAsync(req, res))) return

  const { token, password } = req.body || {}
  if (typeof token !== 'string' || !/^[a-f0-9]{32,128}$/i.test(token)) {
    return res.status(400).json({ error: 'token required' })
  }

  const db = supabaseAdmin()
  const { data: invite } = await db.from('team_members').select('*')
    .eq('invite_token', token).eq('status', 'pending').maybeSingle()
  if (!invite || inviteExpired(invite)) return res.status(404).json({ error: 'Invalid or expired invitation' })

  const email = String(invite.email || '').toLowerCase()

  // Single use: only the request that flips pending → active (and clears the
  // token) may continue.
  const consume = async (userId: string | null) => {
    const { data } = await db.from('team_members').update({
      ...(userId ? { user_id: userId } : {}),
      status: 'active',
      joined_at: new Date().toISOString(),
      invite_token: null,
    }).eq('id', invite.id).eq('status', 'pending').eq('invite_token', token).select('id')
    return !!data?.length
  }

  // Numbers chosen in the invite (permissions.instances) → team_member_instances.
  const applyInviteNumbers = async (memberUserId: string) => {
    const ids = (invite.permissions as { instances?: unknown } | null)?.instances
    if (!Array.isArray(ids) || ids.length === 0) return
    const { data: owned } = await db.from('whatsapp_instances').select('id').eq('user_id', invite.owner_id).in('id', ids.filter(x => typeof x === 'string').slice(0, 50))
    const rows = (owned || []).map(o => ({ member_user_id: memberUserId, instance_id: o.id }))
    if (rows.length) await db.from('team_member_instances').insert(rows)
  }

  const { data: existing } = await db.from('users')
    .select('id, email, role, is_active, sub_account_of').eq('email', email).maybeSingle()

  // ── The invited email already has an account ──────────────────────────────
  // NEVER mint a token for it from the invite. The person must already be
  // logged in as that exact account to accept.
  if (existing) {
    const auth = await getAuthUser(req)
    const selfId = auth.ok ? (auth.payload.actualUserId || auth.payload.userId) : null
    if (!auth.ok || selfId !== existing.id) {
      return res.status(409).json({
        error: 'An account with this email already exists. Log in with that account, then open the invitation link again to accept it.',
        requiresLogin: true,
      })
    }
    if (existing.is_active === false) return res.status(403).json({ error: 'Account suspended' })
    if (existing.role === 'admin') return res.status(400).json({ error: 'Admin accounts cannot join a team' })
    if (existing.id === invite.owner_id) return res.status(400).json({ error: 'You cannot join your own team' })
    if (existing.sub_account_of && existing.sub_account_of !== invite.owner_id) {
      return res.status(409).json({ error: 'This account already belongs to another team' })
    }

    if (!(await consume(existing.id))) return res.status(404).json({ error: 'Invalid or expired invitation' })
    await db.from('users').update({ sub_account_of: invite.owner_id }).eq('id', existing.id)
    await applyInviteNumbers(existing.id)

    return res.status(200).json({
      success: true,
      user: { id: existing.id, email: existing.email, name: invite.name, role: existing.role, sub_account_of: invite.owner_id },
      // The caller's own, already-valid session (no new identity is issued).
      token: getTokenFromRequest(req),
    })
  }

  // ── New account for the invitee ───────────────────────────────────────────
  if (typeof password !== 'string' || password.length < 8 || password.length > 256) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }

  const userId = uuidv4()
  if (!(await consume(null))) return res.status(404).json({ error: 'Invalid or expired invitation' })

  const passwordHash = await hashPassword(password)
  const { data: user, error } = await db.from('users').insert({
    id: userId,
    email,
    name: invite.name,
    password_hash: passwordHash,
    role: 'user',
    api_key: generateApiKey().key,
    is_active: true,
    is_verified: true,
    sub_account_of: invite.owner_id,
  }).select('*').single()

  if (error || !user) {
    console.error('[team accept] user insert failed:', error?.message)
    // Roll the invite back so it can be retried.
    await db.from('team_members').update({ user_id: null, status: 'pending', joined_at: null, invite_token: token }).eq('id', invite.id)
    return res.status(500).json({ error: 'Could not accept invitation' })
  }
  await db.from('team_members').update({ user_id: user.id }).eq('id', invite.id)
  await applyInviteNumbers(user.id)

  const jwtToken = await issueSession(res, user)
  return res.status(200).json({ success: true, user: { id: user.id, email: user.email, name: user.name, role: user.role, sub_account_of: invite.owner_id }, token: jwtToken })
}
