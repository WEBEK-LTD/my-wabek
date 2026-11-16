/**
 * Campaign Reconciliation Job
 * Call via: POST /api/campaigns/reconcile?campaign_id=xxx
 * Logs messages with wamid but no status after 60s
 */
import { NextApiRequest, NextApiResponse } from 'next'
import { requireMemberAccess } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireMemberAccess(req, res, 'campaigns')
  if (!user) return

  const { campaign_id } = req.query
  if (!campaign_id) return res.status(400).json({ error: 'campaign_id required' })

  const db = supabaseAdmin()

  // Get all campaign messages
  const { data: msgs } = await db
    .from('messages')
    .select('id, wa_message_id, status, created_at, contact_id')
    .eq('campaign_id', campaign_id as string)
    .eq('user_id', user.userId)

  if (!msgs?.length) return res.status(200).json({ message: 'No messages found', stats: {} })

  const now = Date.now()
  const TIMEOUT_MS = 60 * 1000 // 60 seconds

  const stats = {
    total: msgs.length,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    awaiting_webhook: 0,
    pending: 0,
  }

  const awaiting: Array<{ wa_message_id: string; age_seconds: number; status: string }> = []

  for (const msg of msgs) {
    const ageMs = now - new Date(msg.created_at).getTime()
    const ageSec = Math.round(ageMs / 1000)

    const s = msg.status as keyof typeof stats
    if (s in stats) (stats as any)[s]++

    // Message has wamid but still 'sent' after 60s — awaiting webhook
    if (
      msg.wa_message_id &&
      !msg.wa_message_id.startsWith('00000000') &&
      msg.status === 'sent' &&
      ageMs > TIMEOUT_MS
    ) {
      stats.awaiting_webhook++
      awaiting.push({
        wa_message_id: msg.wa_message_id,
        age_seconds: ageSec,
        status: msg.status,
      })
      console.log(`[reconcile] ⏳ AWAITING WEBHOOK campaign=${campaign_id} msgId=${msg.wa_message_id} age=${ageSec}s status=${msg.status}`)
    }
  }

  console.log(`[reconcile] campaign=${campaign_id} stats=${JSON.stringify(stats)} awaiting=${awaiting.length}`)

  return res.status(200).json({ stats, awaiting, campaign_id })
}
