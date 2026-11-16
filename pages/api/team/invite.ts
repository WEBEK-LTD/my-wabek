import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { authRateLimitAsync } from '@/lib/middleware'

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

function inviteExpired(invite: { invite_expires_at?: string | null; invited_at?: string | null; created_at?: string | null }): boolean {
  const explicit = invite.invite_expires_at ? new Date(invite.invite_expires_at).getTime() : null
  const issued = new Date(invite.invited_at || invite.created_at || 0).getTime()
  const expiresAt = explicit ?? issued + INVITE_TTL_MS
  return !Number.isFinite(expiresAt) || expiresAt < Date.now()
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!(await authRateLimitAsync(req, res))) return
  const { token } = req.query
  if (typeof token !== 'string' || !/^[a-f0-9]{32,128}$/i.test(token)) {
    return res.status(400).json({ error: 'token required' })
  }

  const db = supabaseAdmin()
  const { data: invite } = await db.from('team_members')
    .select('*, owner:owner_id(name)')
    .eq('invite_token', token).eq('status', 'pending').maybeSingle()
  if (!invite || inviteExpired(invite)) return res.status(404).json({ error: 'Invalid or expired invitation' })

  return res.status(200).json({
    invite: {
      name: invite.name,
      email: invite.email,
      role: invite.role,
      owner_name: invite.owner?.name,
    }
  })
}
