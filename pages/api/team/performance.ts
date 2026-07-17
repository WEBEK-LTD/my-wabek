import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  const ownerId  = user.userId
  const { range = '7d', member_id } = req.query

  // Date range
  const days  = range === '1d' ? 1 : range === '30d' ? 30 : 7
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  // Is this user an owner or a member?
  const { data: me } = await db.from('users').select('sub_account_of').eq('id', ownerId).maybeSingle()
  const isOwner   = !me?.sub_account_of
  const realOwner = me?.sub_account_of || ownerId

  // If member viewing own stats — only show their own
  if (!isOwner) {
    const stats = await getMemberStats(db, realOwner, ownerId, since)
    return res.status(200).json({ mode: 'self', stats })
  }

  // Owner viewing all members
  const { data: members } = await db.from('team_members')
    .select('id, user_id, name, email, role, status')
    .eq('owner_id', ownerId)
    .eq('status', 'active')

  const allStats = await Promise.all(
    (members || []).map(async m => {
      if (!m.user_id) return null
      const stats = await getMemberStats(db, ownerId, m.user_id, since)
      return { ...m, ...stats }
    })
  )

  // Also include owner's own activity if they reply too
  const ownerStats = await getMemberStats(db, ownerId, ownerId, since)

  return res.status(200).json({
    mode:    'team',
    members: allStats.filter(Boolean),
    owner:   { id: ownerId, name: 'You (Owner)', ...ownerStats },
    range,
  })
}

async function getMemberStats(db: any, ownerId: string, memberId: string, since: string) {
  // Outbound messages sent by this member (via assigned conversations)
  // We track outbound messages where the sender is this member
  const { count: msgCount } = await db.from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', ownerId)
    .eq('direction', 'outbound')
    .gte('created_at', since)

  // Conversations assigned to this member
  const { data: assigned, count: convCount } = await db.from('conversation_assignments')
    .select('id, last_message_at, created_at', { count: 'exact' })
    .eq('owner_id', ownerId)
    .eq('assigned_to', memberId)
    .gte('updated_at', since)

  // Inbound messages on assigned conversations (to calculate response rate)
  const convIds = (assigned || []).map((c: any) => c.id)
  let inboundCount = 0
  let outboundCount = 0
  let avgResponseMinutes: number | null = null

  if (convIds.length > 0) {
    const { count: inbound } = await db.from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', ownerId)
      .eq('direction', 'inbound')
      .in('contact_id', (assigned || []).map((c: any) => c.contact_id).filter(Boolean))
      .gte('created_at', since)
    inboundCount = inbound || 0

    const { count: outbound } = await db.from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', ownerId)
      .eq('direction', 'outbound')
      .in('contact_id', (assigned || []).map((c: any) => c.contact_id).filter(Boolean))
      .gte('created_at', since)
    outboundCount = outbound || 0

    // Avg response time: for each assigned conv, find time between last inbound and next outbound
    if (assigned && assigned.length > 0) {
      const times: number[] = []
      for (const conv of (assigned || []).slice(0, 20)) { // limit to 20 for perf
        const { data: msgs } = await db.from('messages')
          .select('direction, created_at')
          .eq('user_id', ownerId)
          .eq('contact_id', conv.contact_id)
          .gte('created_at', since)
          .order('created_at', { ascending: true })
          .limit(50)

        if (!msgs) continue
        for (let i = 0; i < msgs.length - 1; i++) {
          if (msgs[i].direction === 'inbound' && msgs[i + 1].direction === 'outbound') {
            const diff = new Date(msgs[i + 1].created_at).getTime() - new Date(msgs[i].created_at).getTime()
            times.push(diff / 60000) // ms to minutes
          }
        }
      }
      if (times.length > 0) {
        avgResponseMinutes = Math.round(times.reduce((a, b) => a + b, 0) / times.length)
      }
    }
  }

  const responseRate = inboundCount > 0 ? Math.round((outboundCount / inboundCount) * 100) : null

  // Last active: last outbound message on assigned conversations
  const { data: lastMsg } = await db.from('messages')
    .select('created_at')
    .eq('user_id', ownerId)
    .eq('direction', 'outbound')
    .in('contact_id', (assigned || []).map((c: any) => c.contact_id).filter(Boolean))
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return {
    conversations_handled: convCount || 0,
    messages_sent:         outboundCount,
    messages_received:     inboundCount,
    response_rate:         responseRate,
    avg_response_minutes:  avgResponseMinutes,
    last_active:           lastMsg?.created_at || null,
  }
}
