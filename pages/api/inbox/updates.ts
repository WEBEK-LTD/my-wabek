/**
 * GET /api/inbox/updates?after=<ISO cursor>
 *
 * Authenticated replacement for the old anon-key Supabase Realtime
 * subscription in the live chat. Returns the owner's messages created after
 * the cursor (with a small overlap so late-committing rows are not missed —
 * clients de-duplicate by id), restricted to the inboxes the acting team
 * member may see.
 *
 * Call without `after` to obtain an initial server-side cursor.
 */
import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getAllowedInstances } from '@/lib/inbox-access'

const OVERLAP_MS = 15000
const MAX_ROWS = 200
const MAX_LOOKBACK_MS = 60 * 60 * 1000

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = await requireAuth(req, res)
  if (!user) return
  res.setHeader('Cache-Control', 'no-store')
  const db = supabaseAdmin()
  const ownerId = user.userId
  const now = Date.now()

  const afterRaw = typeof req.query.after === 'string' ? req.query.after : ''
  const afterMs = afterRaw ? Date.parse(afterRaw) : NaN
  if (!afterRaw || Number.isNaN(afterMs)) {
    return res.status(200).json({ messages: [], cursor: new Date(now).toISOString() })
  }

  // Never scan further back than an hour, whatever the client sends
  const since = new Date(Math.max(afterMs - OVERLAP_MS, now - MAX_LOOKBACK_MS)).toISOString()

  const allowed = await getAllowedInstances(db, user.actualUserId || user.userId, ownerId)

  // Keep the server's microsecond-precision timestamp when it's well-formed
  const afterIso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.test(afterRaw)
    ? afterRaw
    : new Date(afterMs).toISOString()
  const base = () => {
    let q = db.from('messages').select('*').eq('user_id', ownerId)
    if (allowed) q = q.in('instance_id', allowed)
    return q
  }

  // New rows after the cursor (these advance the cursor) + rows that landed
  // just before it (late commits; re-sent, de-duplicated client-side).
  const [fresh, late] = await Promise.all([
    base().gt('created_at', afterIso).order('created_at', { ascending: true }).limit(MAX_ROWS),
    base().gt('created_at', since).lte('created_at', afterIso).order('created_at', { ascending: true }).limit(100),
  ])
  if (fresh.error || late.error) {
    console.error('[inbox/updates] error:', fresh.error?.message || late.error?.message)
    return res.status(500).json({ error: 'Failed to load updates' })
  }

  const freshRows = fresh.data || []
  const messages = [...(late.data || []), ...freshRows]
  const cursor = freshRows.length ? freshRows[freshRows.length - 1].created_at : afterIso

  return res.status(200).json({ messages, cursor })
}
