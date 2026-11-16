import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyWebhook, verifyMetaSignature, parseWebhookPayload, fetchInboundMedia, WebhookMessage, WebhookStatus } from '@/lib/whatsapp'
import { uploadMediaBuffer } from '@/lib/media-storage'
import { insertMessage } from '@/lib/message-insert'
import { notifyNewMessage } from '@/lib/notifications'
import { executeAutomationFlow } from '@/lib/automation-engine'
import { processChatbotMessage } from '@/lib/chatbot-engine'
import { processAIReply } from '@/lib/ai-engine'
import { readRawBody, withTimeout } from '@/lib/raw-body'
import { v4 as uuidv4 } from 'uuid'

// Raw body is required to verify X-Hub-Signature-256.
export const config = { api: { bodyParser: false } }

// Meta retries deliveries that are not answered quickly; never hold the
// response longer than this, whatever the bots are doing.
const PROCESSING_BUDGET_MS = 8000

type Instance = Record<string, any>
// The chosen instance plus every row id of the same owner sharing that number
type Resolved = { inst: Instance; ids: string[] }

/**
 * Instance for a phone_number_id. Several rows can share one number when a
 * user reconnected it; they are only usable when they all belong to the same
 * user (then the connected / most recently updated one wins).
 */
async function findInstance(cache: Map<string, Resolved | null>, phoneNumberId: string): Promise<Resolved | null> {
  if (!phoneNumberId) return null
  if (cache.has(phoneNumberId)) return cache.get(phoneNumberId) || null
  const { data: rows } = await supabaseAdmin()
    .from('whatsapp_instances')
    .select('*')
    .eq('phone_number_id', phoneNumberId)
    .limit(10)
  let resolved: Resolved | null = null
  if (rows?.length) {
    const owners = new Set(rows.map(r => r.user_id))
    if (owners.size === 1) {
      const inst = [...rows].sort((a, b) =>
        (a.status === 'connected' ? 0 : 1) - (b.status === 'connected' ? 0 : 1) ||
        String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || ''))
      )[0]
      resolved = { inst, ids: rows.map(r => r.id) }
    } else {
      console.error(`[WEBHOOK] phone_number_id=${phoneNumberId} is attached to ${owners.size} different users — ignoring`)
    }
  }
  cache.set(phoneNumberId, resolved)
  return resolved
}

async function handleInbound(msg: WebhookMessage, instances: Map<string, Resolved | null>): Promise<void> {
  const db = supabaseAdmin()

  // Ignore broadcast/newsletter senders
  if (msg.from && (msg.from.includes('@broadcast') || msg.from.includes('@newsletter') || msg.from === 'status@broadcast')) return
  if (!msg.messageId) return

  const resolved = await findInstance(instances, msg.phoneNumberId)
  if (!resolved) return
  const instance = resolved.inst

  // Dedupe: Meta redelivers on timeouts — never process a message twice
  const { data: seen } = await db
    .from('messages')
    .select('id')
    .eq('wa_message_id', msg.messageId)
    .in('instance_id', resolved.ids)
    .eq('direction', 'inbound')
    .limit(1)
  if (seen?.length) {
    console.log(`[WEBHOOK] duplicate delivery wa_message_id=${msg.messageId} — skipped`)
    return
  }

  let contactId: string | null = null
  const { data: contact } = await db.from('contacts').select('id, name').eq('user_id', instance.user_id).eq('phone', msg.from).limit(1)
  if (contact?.[0]) {
    contactId = contact[0].id
    if (!contact[0].name && msg.contactName) {
      await db.from('contacts').update({ name: msg.contactName }).eq('id', contact[0].id)
    }
  } else {
    const { data: newContact } = await db.from('contacts').insert({
      id: uuidv4(), user_id: instance.user_id, phone: msg.from, name: msg.contactName || null, tags: [],
    }).select().maybeSingle()
    contactId = newContact?.id || null
  }

  const content = msg.text || `[${msg.type}]`

  // ── Inbound media (isolated — never blocks text message saving) ──────
  // Meta only gives us a media `id`, with a signed URL that expires in
  // minutes; re-host it on our storage. Failures fall back to "[type]".
  let mediaUrl: string | null = null
  let mediaMimeType: string | null = null
  let mediaFilename: string | null = null
  // Meta's msg.type is authoritative; audio.voice=true marks a voice note.
  const mediaObj = (msg.image || msg.document || msg.audio || msg.video || msg.sticker) as
    { id?: string; mime_type?: string; filename?: string; voice?: boolean } | undefined
  const resolvedType: string = (msg.type === 'audio' && mediaObj?.voice) ? 'ptt' : msg.type

  if (mediaObj?.id) {
    try {
      const fetched = await fetchInboundMedia(mediaObj.id, instance.access_token)
      if (fetched) {
        const uploaded = await uploadMediaBuffer(fetched.buffer, {
          userId: instance.user_id,
          mimeType: fetched.mimeType,
        })
        if (uploaded) {
          mediaUrl = uploaded.url
          mediaMimeType = fetched.mimeType
          mediaFilename = mediaObj.filename || null
        }
      }
    } catch (mediaErr) {
      console.error(`[WEBHOOK] media fetch/upload failed (non-fatal) wa_message_id=${msg.messageId}:`, mediaErr instanceof Error ? mediaErr.message : mediaErr)
    }
  }

  const inserted = await insertMessage({
    user_id:         instance.user_id,
    instance_id:     instance.id,
    contact_id:      contactId,
    wa_message_id:   msg.messageId,
    direction:       'inbound',
    type:            resolvedType,
    content,
    status:          'delivered',
    media_url:       mediaUrl,
    media_mime_type: mediaMimeType,
    media_filename:  mediaFilename,
  })
  if (inserted.duplicate) {
    // A concurrent delivery of the same message won the insert
    console.log(`[WEBHOOK] duplicate insert wa_message_id=${msg.messageId} — skipped`)
    return
  }

  // Notification for new message
  await notifyNewMessage(instance.user_id, msg.contactName || msg.from, content)

  // Auto-create inbox conversation — scoped to this instance (inbox)
  try {
    await db.from('conversation_assignments').upsert({
      owner_id:        instance.user_id,
      contact_id:      contactId,
      instance_id:     instance.id,
      status:          'open',
      priority:        'normal',
      last_message_at: new Date().toISOString(),
      updated_at:      new Date().toISOString(),
      last_activity:   new Date().toISOString(),
      review_status:   'active',
    }, { onConflict: 'owner_id,contact_id,instance_id', ignoreDuplicates: false })
  } catch {}

  await executeAutomationFlow({
    userId: instance.user_id,
    instanceId: instance.id,
    from: msg.from,
    message: content,
  })

  // Run chatbot flows
  const chatbotHandled = await processChatbotMessage({
    userId: instance.user_id,
    instanceId: instance.id,
    instance: instance,
    from: msg.from,
    message: content,
    contactName: msg.contactName,
  })

  // AI fallback — only if chatbot didn't handle it
  if (!chatbotHandled) {
    await processAIReply({
      userId: instance.user_id,
      instanceId: instance.id,
      instance: instance,
      from: msg.from,
      message: content,
      contactName: msg.contactName,
      contactId: contactId,
    })
  }
}

async function handleStatus(status: WebhookStatus, instances: Map<string, Resolved | null>): Promise<void> {
  const db = supabaseAdmin()
  const errorCode = status.errors?.[0]?.code
  const errorMsg = status.errors?.[0]?.message || status.errors?.[0]?.title
  const recipientPhone = status.recipientId || status.recipient_id || 'unknown'

  // Scope by the instance that owns this phone_number_id: a status event must
  // never touch another tenant's message rows.
  const resolved = await findInstance(instances, status.phoneNumberId)
  if (!resolved || !status.messageId) {
    console.log(`[webhook status] no instance for phone_number_id=${status.phoneNumberId} msgId=${status.messageId}`)
    return
  }
  const instance = resolved.inst

  const { data: msgRows } = await db
    .from('messages')
    .select('id, campaign_id, contact_id')
    .eq('wa_message_id', status.messageId)
    .in('instance_id', resolved.ids)
    .limit(1)
  const msgRow = msgRows?.[0]

  console.log(`[webhook status] phone=${recipientPhone} msgId=${status.messageId} status=${status.status} campaign_id=${msgRow?.campaign_id || 'none'} found=${!!msgRow} error_code=${errorCode || 'none'}`)
  if (!msgRow) return

  await db
    .from('messages')
    .update({
      status: status.status,
      ...(errorCode ? { meta: { error_code: errorCode, error_msg: errorMsg } } : {}),
    })
    .eq('wa_message_id', status.messageId)
    .in('instance_id', resolved.ids)

  // Update campaign stats
  if (msgRow.campaign_id) {
    const statField = status.status === 'delivered' ? 'delivered_count'
      : status.status === 'read' ? 'read_count'
      : status.status === 'failed' ? 'failed_count' : null
    if (statField) {
      try {
        const { data: cmp } = await db.from('campaigns').select(statField).eq('id', msgRow.campaign_id).eq('user_id', instance.user_id).maybeSingle()
        if (cmp) {
          await db.from('campaigns').update({ [statField]: ((cmp as any)[statField] || 0) + 1 }).eq('id', msgRow.campaign_id)
        }
      } catch {}
    }
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // ── GET: Meta verification handshake (unchanged URL and params) ──
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'] as string
    const token = req.query['hub.verify_token'] as string
    const challenge = req.query['hub.challenge'] as string
    const result = verifyWebhook(mode, token, challenge)
    if (result !== null) return res.status(200).send(result)
    return res.status(403).json({ error: 'Forbidden' })
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  let raw: Buffer
  try {
    raw = await readRawBody(req, 5 * 1024 * 1024)
  } catch {
    return res.status(413).json({ error: 'Payload too large' })
  }

  const sig = verifyMetaSignature(raw, req.headers['x-hub-signature-256'])
  if (sig === 'invalid') {
    console.error('[WEBHOOK] rejected: invalid X-Hub-Signature-256')
    return res.status(401).json({ error: 'Invalid signature' })
  }
  if (sig === 'unconfigured') {
    console.error('[WEBHOOK] ⚠️ SECURITY: META_APP_SECRET / META_APP_SECRETS not set — accepting UNSIGNED webhook. Set META_APP_SECRET now.')
  }

  let body: unknown
  try {
    body = JSON.parse(raw.toString('utf8') || '{}')
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' })
  }

  const work = (async () => {
    try {
      const { messages, statuses } = parseWebhookPayload(body)
      const instances = new Map<string, Resolved | null>()
      for (const msg of messages) {
        try { await handleInbound(msg, instances) } catch (err) { console.error('[WEBHOOK] message error:', err) }
      }
      for (const status of statuses) {
        try { await handleStatus(status, instances) } catch (err) { console.error('[WEBHOOK] status error:', err) }
      }
    } catch (err) {
      console.error('Webhook error:', err)
    }
    return true
  })()

  const finished = await withTimeout(work, PROCESSING_BUDGET_MS, false)
  if (!finished) console.warn(`[WEBHOOK] processing exceeded ${PROCESSING_BUDGET_MS}ms — acknowledging anyway`)

  res.status(200).json({ status: 'ok' })
}
