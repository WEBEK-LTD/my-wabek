import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    // Exclude invite_token from response — it's a secret
    const { data: members, error: membersErr } = await db.from('team_members')
      .select('id, owner_id, user_id, name, email, role, status, created_at, updated_at')
      .eq('owner_id', user.userId)
      .order('created_at')

    // Debug: log what we got
    console.log('[team GET] userId:', user.userId, 'members count:', members?.length, 'error:', membersErr?.message)

    // Get allowed instances for each member
    const memberIds = (members || []).map(m => m.user_id).filter(Boolean)
    let permsMap: Record<string, string[]> = {}
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
    const { email, name: rawName, role: rawRole = 'agent' } = req.body
    if (!email || !rawName) return res.status(400).json({ error: 'email and name required' })
    const VALID_ROLES = ['agent', 'admin', 'viewer']
    const role = VALID_ROLES.includes(rawRole) ? rawRole : 'agent'
    const name = rawName.trim()

    const inviteToken = crypto.randomBytes(32).toString('hex')

    const { data, error } = await db.from('team_members').insert({
      id: uuidv4(),
      owner_id: user.userId,
      email: email.toLowerCase(),
      name,
      role,
      invite_token: inviteToken,
      status: 'pending',
    }).select().single()

    if (error) return res.status(500).json({ error: error.message })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://waabek.com'
    const inviteUrl = `${appUrl}/auth/team-invite?token=${inviteToken}`

    // Send invite email
    try {
      const { sendEmail, teamInviteEmail } = await import('@/lib/email')
      const { data: ownerData } = await db.from('users').select('name, email').eq('id', user.userId).maybeSingle()
      const { data: wl } = await db.from('white_label_settings').select('brand_name').eq('user_id', user.userId).maybeSingle()
      const platformName = wl?.brand_name || process.env.NEXT_PUBLIC_APP_NAME || 'WABEK'
      const html = teamInviteEmail(
        ownerData?.name || platformName,
        platformName,
        inviteUrl
      )
      await sendEmail({ to: email, subject: `You've been invited to join ${platformName}`, html })
    } catch (emailErr: any) {
      console.error('[team invite] email send failed:', emailErr?.message)
    }

    return res.status(201).json({ member: data, inviteUrl })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
