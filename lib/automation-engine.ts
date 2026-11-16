import { z } from 'zod'
import { smartSend, smartSendWAWeb } from '@/lib/wa-smart-send'
import { supabaseAdmin } from './supabase'
import { v4 as uuidv4 } from 'uuid'

// ── Shared validation for automation flows (POST + PUT) ──────────────────────
export const automationNodeSchema = z.object({
  id: z.string().max(100),
  type: z.enum(['send_message', 'delay', 'condition', 'tag_contact', 'end']),
  data: z.record(z.string().max(4096)),
  next: z.string().optional(),
  nextFalse: z.string().optional(),
})

export const automationFlowSchema = z.object({
  name: z.string().min(1).max(200),
  instance_id: z.string().uuid().nullable().optional(),
  trigger_type: z.enum(['keyword', 'message_received', 'opt_in', 'scheduled']),
  trigger_value: z.string().max(2000).nullable().optional(),
  nodes: z.array(automationNodeSchema).max(50).default([]),
  is_active: z.boolean().default(false),
})

// Anti ping-pong: at most this many automated replies per contact per window.
// Stops two bots (or an auto-responder) from replying to each other forever.
const AUTOMATION_MAX_REPLIES = 5
const AUTOMATION_WINDOW_MS = 10 * 60 * 1000
const AUTOMATION_MAX_TOTAL_DELAY_MS = 15000

async function automationRateLimited(
  db: ReturnType<typeof supabaseAdmin>,
  userId: string,
  instanceId: string,
  contactId: string | null
): Promise<boolean> {
  if (!contactId) return false
  const since = new Date(Date.now() - AUTOMATION_WINDOW_MS).toISOString()
  const { count } = await db.from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('instance_id', instanceId)
    .eq('contact_id', contactId)
    .eq('direction', 'outbound')
    .eq('meta->>source', 'automation')
    .gte('created_at', since)
  return (count ?? 0) >= AUTOMATION_MAX_REPLIES
}

export async function executeAutomationFlow(params: {
  userId: string
  instanceId: string
  from: string
  message: string
  flowId?: string
}) {
  const db = supabaseAdmin()
  const { userId, instanceId, from, message } = params

  // Instance must belong to this user
  const { data: instance } = await db.from('whatsapp_instances').select('*')
    .eq('id', instanceId).eq('user_id', userId).maybeSingle()
  if (!instance) return

  // Find matching flows
  const { data: flows } = await db.from('automation_flows').select('*')
    .eq('user_id', userId).eq('is_active', true)
    .or(`instance_id.eq.${instanceId},instance_id.is.null`)

  if (!flows?.length) return

  const { data: contactRow } = await db.from('contacts').select('id, tags')
    .eq('user_id', userId).eq('phone', from).maybeSingle()
  const contactId: string | null = contactRow?.id || null

  if (await automationRateLimited(db, userId, instanceId, contactId)) {
    console.warn(`[automation] rate limit hit user=${userId} contact=${contactId} — skipping`)
    return
  }

  const isWAWeb = (instance.instance_type || instance.type) === 'wa_web'
  let repliesThisRun = 0
  let delayUsedMs = 0

  for (const flow of flows) {
    let triggered = false
    if (flow.trigger_type === 'message_received') triggered = true
    else if (flow.trigger_type === 'keyword' && flow.trigger_value) {
      const keywords = String(flow.trigger_value).split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean)
      triggered = keywords.some((kw: string) => message.toLowerCase().includes(kw))
    }
    if (!triggered) continue

    // Execute nodes
    const nodes: Array<{ type: string; data: Record<string, string>; next?: string }> = Array.isArray(flow.nodes) ? flow.nodes.slice(0, 50) : []
    for (const node of nodes) {
      if (node.type === 'send_message' && node.data?.text) {
        if (repliesThisRun >= AUTOMATION_MAX_REPLIES) break
        try {
          if (isWAWeb) {
            // Guarded send (plan limit / opt-out); persists the outbound row.
            const r = await smartSendWAWeb({
              userId, instanceId, to: from, text: node.data.text, contactId,
              source: 'automation', extraMeta: { flow_id: flow.id },
            })
            if (r.blocked) break
          } else {
            // smartSend persists the outbound message itself (with
            // meta.source='automation') — do not insert a second row.
            await smartSend({
              userId, instanceId, phoneNumberId: instance.phone_number_id, accessToken: instance.access_token,
              to: from, text: node.data.text, contactId, source: 'automation', flowId: flow.id,
            })
          }
          repliesThisRun++
        } catch (e) { console.error('Automation send error:', (e as Error)?.message) }
      }
      if (node.type === 'delay' && node.data?.seconds) {
        const requested = Math.max(0, Math.min((parseInt(node.data.seconds) || 0) * 1000, 10000))
        const ms = Math.min(requested, Math.max(0, AUTOMATION_MAX_TOTAL_DELAY_MS - delayUsedMs))
        delayUsedMs += ms
        if (ms > 0) await new Promise(r => setTimeout(r, ms))
      }
      if (node.type === 'tag_contact' && node.data?.tag && contactRow) {
        const tags: string[] = contactRow.tags || []
        if (!tags.includes(node.data.tag)) {
          contactRow.tags = [...tags, node.data.tag]
          await db.from('contacts').update({ tags: contactRow.tags }).eq('id', contactRow.id).eq('user_id', userId)
        }
      }
    }
    await db.from('automation_flows').update({ trigger_count: (flow.trigger_count || 0) + 1 }).eq('id', flow.id)
  }
}
