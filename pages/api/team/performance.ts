import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  const { range = '7d' } = req.query
  const days  = range === '1d' ? 1 : range === '30d' ? 30 : 7
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const isOwner = !user.actualUserId
  const ownerId = user.userId

  if (!isOwner) {
    const memberId = user.actualUserId!
    const stats    = await getMemberStats(db, ownerId, memberId, since)
    return res.status(200).json({ mode: 'self', stats })
  }

  // ── Owner: fetch all messages once, then compute per-member ──────
  // Single query instead of N queries per member (fix N+1)
  const { data: members } = await db.from('team_members')
    .select('id, user_id, name, email, role, status')
    .eq('owner_id', ownerId)
    .eq('status', 'active')

  // One bulk query for all outbound messages in range
  const { data: allOutbound } = await db.from('messages')
    .select('id, contact_id, created_at, meta')
    .eq('user_id', ownerId)
    .eq('direction', 'outbound')
    .gte('created_at', since)
    .limit(5000)  // safety limit

  // One bulk query for all inbound messages in range
  const { data: allInbound } = await db.from('messages')
    .select('id, contact_id, created_at')
    .eq('user_id', ownerId)
    .eq('direction', 'inbound')
    .gte('created_at', since)
    .limit(5000)

  // Build lookup maps for fast per-member computation
  // outbound by sent_by → [messages]
  // Messages WITHOUT sent_by are legacy (pre-v586) — exclude from per-member stats
  const outboundBySender: Record<string, typeof allOutbound> = {}
  for (const msg of allOutbound || []) {
    const sentBy = (msg.meta as any)?.sent_by
    if (!sentBy) continue  // legacy message — skip, don't assign to owner falsely
    if (!outboundBySender[sentBy]) outboundBySender[sentBy] = []
    outboundBySender[sentBy].push(msg)
  }

  // inbound by contact_id → [messages]
  const inboundByContact: Record<string, { created_at: string }[]> = {}
  for (const msg of allInbound || []) {
    if (!msg.contact_id) continue
    if (!inboundByContact[msg.contact_id]) inboundByContact[msg.contact_id] = []
    inboundByContact[msg.contact_id].push(msg)
  }

  // outbound by contact_id (only tracked messages) for response time calc
  const outboundByContact: Record<string, { created_at: string; sent_by: string }[]> = {}
  for (const msg of allOutbound || []) {
    const sentBy = (msg.meta as any)?.sent_by
    if (!sentBy || !msg.contact_id) continue  // skip legacy messages
    if (!outboundByContact[msg.contact_id]) outboundByContact[msg.contact_id] = []
    outboundByContact[msg.contact_id].push({ created_at: msg.created_at, sent_by: sentBy })
  }

  const computeStats = (memberId: string) => {
    const sent       = outboundBySender[memberId] || []
    const msgCount   = sent.length
    const contactIds = [...new Set(sent.map(m => m.contact_id).filter(Boolean))] as string[]

    if (msgCount === 0) {
      return {
        conversations_handled: 0,
        messages_sent:         0,
        response_rate:         null,
        avg_response_minutes:  null,
        last_active:           null,
      }
    }

    // Response rate: outbound / inbound on same contacts
    let totalInbound = 0
    for (const cid of contactIds) {
      totalInbound += (inboundByContact[cid] || []).length
    }
    const responseRate = totalInbound > 0
      ? Math.min(Math.round((msgCount / totalInbound) * 100), 100)
      : null

    // Avg response time — this member's outbound after inbound on same contact
    const times: number[] = []
    for (const cid of contactIds.slice(0, 50)) {  // use up to 50 contacts (data is in memory)
      const inbounds  = (inboundByContact[cid] || [])
        .map(m => new Date(m.created_at).getTime())
        .sort((a, b) => a - b)  // ascending
      const outbounds = (outboundByContact[cid] || [])
        .filter(m => m.sent_by === memberId)
        .map(m => new Date(m.created_at).getTime())
        .sort((a, b) => a - b)  // ascending — required for find() to work correctly

      for (const inT of inbounds) {
        const reply = outbounds.find(outT => outT > inT && outT - inT < 24 * 60 * 60 * 1000)
        if (reply) times.push((reply - inT) / 60000)
      }
    }
    const avgResponseMinutes = times.length > 0
      ? Math.round(times.reduce((a, b) => a + b) / times.length)
      : null

    // Last active
    const lastActive = sent.length > 0
      ? [...sent].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at
      : null

    return {
      conversations_handled: contactIds.length,
      messages_sent:         msgCount,
      response_rate:         responseRate,
      avg_response_minutes:  avgResponseMinutes,
      last_active:           lastActive,
    }
  }

  const allStats = (members || [])
    .filter(m => m.user_id)
    .map(m => ({ ...m, ...computeStats(m.user_id) }))

  const ownerStats = computeStats(ownerId)

  return res.status(200).json({
    mode:    'team',
    members: allStats,
    owner:   { id: ownerId, name: 'You (Owner)', email: null, ...ownerStats },
    range,
  })
}

// Used for member self-view only
async function getMemberStats(
  db: ReturnType<typeof supabaseAdmin>,
  ownerId: string,
  memberId: string,
  since: string
) {
  const { data: sent } = await db.from('messages')
    .select('id, contact_id, created_at')
    .eq('user_id', ownerId)
    .eq('direction', 'outbound')
    .gte('created_at', since)
    .filter('meta->>sent_by', 'eq', memberId)
    .limit(2000)

  const msgCount   = sent?.length || 0
  const contactIds = [...new Set((sent || []).map(m => m.contact_id).filter(Boolean))] as string[]
  // Limit to 200 contacts for the IN query (Supabase/PostgREST limit)
  const safeContactIds = contactIds.slice(0, 200)

  if (msgCount === 0) return {
    conversations_handled: 0, messages_sent: 0,
    response_rate: null, avg_response_minutes: null, last_active: null,
  }

  const { count: inboundCount } = await db.from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', ownerId).eq('direction', 'inbound')
    .in('contact_id', safeContactIds).gte('created_at', since)

  const responseRate = (inboundCount || 0) > 0
    ? Math.min(Math.round((msgCount / (inboundCount || 1)) * 100), 100)
    : null

  // Avg response time
  const times: number[] = []
  for (const contactId of safeContactIds.slice(0, 10)) {
    const { data: msgs } = await db.from('messages')
      .select('direction, created_at, meta')
      .eq('user_id', ownerId).eq('contact_id', contactId)
      .gte('created_at', since).order('created_at', { ascending: true }).limit(50)
    if (!msgs) continue
    for (let i = 0; i < msgs.length - 1; i++) {
      if (msgs[i].direction === 'inbound' && msgs[i + 1].direction === 'outbound') {
        if ((msgs[i + 1].meta as any)?.sent_by !== memberId) continue
        const diff = new Date(msgs[i + 1].created_at).getTime() - new Date(msgs[i].created_at).getTime()
        if (diff > 0 && diff < 24 * 60 * 60 * 1000) times.push(diff / 60000)
      }
    }
  }

  const lastActive = sent && sent.length > 0
    ? [...sent].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at
    : null

  return {
    conversations_handled: safeContactIds.length,
    messages_sent:         msgCount,
    response_rate:         responseRate,
    avg_response_minutes:  times.length > 0 ? Math.round(times.reduce((a, b) => a + b) / times.length) : null,
    last_active:           lastActive,
  }
}
