import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'

const INVITE_TTL_DAYS = 7
const VALID_ROLES = ['agent', 'admin', 'viewer']

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()
  const isOwner = !user.actualUserId

  if (req.method === 'GET') {
    // invite_token is a secret — never selected here.
    const { data: members, error: membersErr } = await db.from('team_members')
      .select('id, owner_id, user_id, name, email, role, status, created_at')
      .eq('owner_id', user.userId)
      .order('created_at')
    if (membersErr) console.error('[team GET] error:', membersErr.message)

    // Get allowed instances for each member
    const memberIds = (members || []).map(m => m.user_id).filter(Boolean)
    const permsMap: Record<string, string[]> = {}
    if (memberIds.length > 0) {
      const { data: perms } = await db.from('team_member_instances')
        .select('member_user_id, instance_id')
        .in('member_user_id', memberIds)
      for (const p of perms || []) {
        if (!permsMap[p.member_user_id]) permsMap[p.member_user_id] = []
        permsMap[p.member_user_id].push(p.instance_id)
      }
    }

    // Get owner's instances for the inbox permissions UI
    const { data: instances } = await db.from('whatsapp_instances')
      .select('id, phone_number, display_name, status')
      .eq('user_id', user.userId)
      .in('status', ['connected', 'active'])

    const enriched = (members || []).map(m => ({
      ...m,
      allowed_instances: m.user_id ? (permsMap[m.user_id] || []) : [],
    }))

    return res.status(200).json({ members: enriched, instances: instances || [] })
  }

  if (req.method === 'POST') {
    // Team management is owner-only.
    if (!isOwner) return res.status(403).json({ error: 'Only the account owner can do this' })

    const { email: rawEmail, name: rawName, role: rawRole = 'agent' } = req.body || {}
    if (typeof rawEmail !== 'string' || typeof rawName !== 'string' || !rawEmail || !rawName.trim()) {
      return res.status(400).json({ error: 'email and name required' })
    }
    const email = rawEmail.toLowerCase().trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ error: 'Invalid email' })
    const name = rawName.trim().slice(0, 100)
    const role = VALID_ROLES.includes(rawRole) ? rawRole : 'agent'

    const { data: owner } = await db.from('users').select('name, email').eq('id', user.userId).maybeSingle()
    if (owner?.email?.toLowerCase() === email) return res.status(400).json({ error: 'You cannot invite yourself' })

    const { data: dups } = await db.from('team_members')
      .select('*').eq('owner_id', user.userId).eq('email', email).in('status', ['pending', 'active'])
    for (const d of dups || []) {
      const issued = new Date(d.invited_at || d.created_at || 0).getTime()
      const exp = d.invite_expires_at ? new Date(d.invite_expires_at).getTime() : issued + INVITE_TTL_DAYS * 86400000
      if (d.status === 'pending' && exp < Date.now()) {
        await db.from('team_members').delete().eq('id', d.id).eq('status', 'pending') // stale invite
        continue
      }
      return res.status(409).json({ error: 'This person is already on your team or has a pending invite' })
    }

    const inviteToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()

    const row: Record<string, unknown> = {
      id: uuidv4(),
      owner_id: user.userId,
      email,
      name,
      role,
      invite_token: inviteToken,
      invite_expires_at: expiresAt,
      status: 'pending',
    }
    let { data, error } = await db.from('team_members').insert(row)
      .select('id, owner_id, user_id, name, email, role, status, created_at').single()
    if (error && /invite_expires_at/i.test(error.message || '')) {
      // Migration 027 not applied yet — expiry falls back to invited_at/created_at + 7 days.
      delete row.invite_expires_at
      ;({ data, error } = await db.from('team_members').insert(row)
        .select('id, owner_id, user_id, name, email, role, status, created_at').single())
    }
    if (error) {
      console.error('[team invite] insert failed:', error.message)
      return res.status(500).json({ error: 'Could not create invitation' })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://waabek.com'
    const inviteUrl = `${appUrl}/auth/team-invite?token=${inviteToken}`

    try {
      const { sendEmail, teamInviteEmail } = await import('@/lib/email')
      const { data: wl } = await db.from('white_label_settings').select('brand_name').eq('user_id', user.userId).maybeSingle()
      const platformName = wl?.brand_name || process.env.NEXT_PUBLIC_APP_NAME || 'WABEK'
      const html = teamInviteEmail(owner?.name || platformName, platformName, inviteUrl)
      await sendEmail({ to: email, subject: `You've been invited to join ${String(platformName).replace(/[\r\n]/g, ' ')}`, html })
    } catch (emailErr: any) {
      console.error('[team invite] email send failed:', emailErr?.message)
    }

    // Returned to the owner only (owner-only endpoint) so they can share it manually.
    return res.status(201).json({ member: data, inviteUrl })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
