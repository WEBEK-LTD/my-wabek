import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyWebhook, parseWebhookPayload, fetchInboundMedia } from '@/lib/whatsapp'
import { sendTextMessage } from '@/lib/whatsapp'
import { sendWAWebMessage } from '@/lib/wa-web'
import { uploadMediaBuffer, mimeToMessageType } from '@/lib/media-storage'
import { notifyNewMessage } from '@/lib/notifications'
import { executeAutomationFlow } from '@/lib/automation-engine'
import { processChatbotMessage } from '@/lib/chatbot-engine'
import { processAIReply } from '@/lib/ai-engine'
import { v4 as uuidv4 } from 'uuid'

export const config = { api: { bodyParser: true } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'] as string
    const token = req.query['hub.verify_token'] as string
    const challenge = req.query['hub.challenge'] as string
    const result = verifyWebhook(mode, token, challenge)
    if (result !== null) return res.status(200).send(result)
    return res.status(403).json({ error: 'Forbidden' })
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const db = supabaseAdmin()
    const { messages, statuses } = parseWebhookPayload(req.body)

    for (const msg of messages) {
      // Ignore broadcast/newsletter senders
      if (msg.from && (msg.from.includes('@broadcast') || msg.from.includes('@newsletter') || msg.from === 'status@broadcast')) {
        console.log(`[WEBHOOK] ignoring broadcast/newsletter sender: ${msg.from}`)
        continue
      }

      const { data: instance } = await db
        .from('whatsapp_instances')
        .select('*')
        .eq('phone_number_id', msg.phoneNumberId)
        .maybeSingle()

      if (!instance) continue

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
      // Meta only gives us a media `id` in the webhook payload, with a
      // signed URL that expires in minutes. We must fetch + re-host it on
      // our own storage immediately. Any failure here falls back silently
      // to the existing "[type]" placeholder text behavior.
      let mediaUrl: string | null = null
      let mediaMimeType: string | null = null
      let mediaFilename: string | null = null
      let resolvedType: string = msg.type

      const mediaObj = (msg.image || msg.document || msg.audio || msg.video || msg.sticker) as
        { id?: string; mime_type?: string; filename?: string; voice?: boolean } | undefined

      if (mediaObj?.id) {
        try {
          const fetched = await fetchInboundMedia(mediaObj.id, instance.access_token)
          if (fetched) {
            const uploaded = await uploadMediaBuffer(fetched.buffer, {
              userId: instance.user_id,
              mimeType: fetched.mimeType,
              filename: mediaObj.filename,
            })
            if (uploaded) {
              mediaUrl = uploaded.url
              mediaMimeType = fetched.mimeType
              mediaFilename = mediaObj.filename || null
              resolvedType = mimeToMessageType(fetched.mimeType, !!mediaObj.voice)
            }
          }
        } catch (mediaErr) {
          console.error(`[WEBHOOK] media fetch/upload failed (non-fatal) wa_message_id=${msg.messageId}:`, mediaErr instanceof Error ? mediaErr.message : mediaErr)
        }
      }

      await db.from('messages').insert({
        id: uuidv4(), user_id: instance.user_id, instance_id: instance.id, contact_id: contactId,
        wa_message_id: msg.messageId, direction: 'inbound',
        type: resolvedType as 'text' | 'image' | 'document' | 'audio' | 'video' | 'sticker' | 'ptt',
        content, status: 'delivered',
        media_url: mediaUrl,
        media_mime_type: mediaMimeType,
        media_filename: mediaFilename,
      })

      // Notification for new message
      await notifyNewMessage(instance.user_id, msg.contactName || msg.from, content)

      // Auto-create inbox conversation
      try {
        await db.from('conversation_assignments').upsert({
          owner_id: instance.user_id,
          contact_id: contactId,
          status: 'open',
          priority: 'normal',
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'owner_id,contact_id', ignoreDuplicates: false })
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

    for (const status of statuses) {
      const errorCode = status.errors?.[0]?.code
      const errorMsg = status.errors?.[0]?.message || status.errors?.[0]?.title
      const recipientPhone = status.recipientId || status.recipient_id || 'unknown'

      // Find message with campaign correlation
      const { data: msgRow } = await db
        .from('messages')
        .select('id, campaign_id, contact_id')
        .eq('wa_message_id', status.messageId)
        .maybeSingle()

      console.log(`[webhook status] phone=${recipientPhone} msgId=${status.messageId} status=${status.status} campaign_id=${msgRow?.campaign_id || 'none'} found=${!!msgRow} error_code=${errorCode || 'none'} error="${errorMsg || 'none'}"`)

      if (!msgRow) {
        console.log(`[webhook status] ⚠️ UNMATCHED msgId=${status.messageId} phone=${recipientPhone} — message not in DB`)
      }

      // Update message status
      const { data: updated } = await db
        .from('messages')
        .update({
          status: status.status,
          ...(errorCode ? { meta: { error_code: errorCode, error_msg: errorMsg } } : {}),
        })
        .eq('wa_message_id', status.messageId)
        .select('id')

      // Update campaign stats
      if (msgRow?.campaign_id) {
        const statField = status.status === 'delivered' ? 'delivered_count'
          : status.status === 'read' ? 'read_count'
          : status.status === 'failed' ? 'failed_count' : null
        if (statField) {
          try {
            // Direct stat increment — no RPC needed
            const { data: cmp } = await db.from('campaigns').select(statField).eq('id', msgRow.campaign_id).maybeSingle()
            if (cmp) {
              await db.from('campaigns').update({ [statField]: ((cmp as any)[statField] || 0) + 1 }).eq('id', msgRow.campaign_id)
            }
          } catch {}
        }
      }
    }
  } catch (err) {
    console.error('Webhook error:', err)
  }

  res.status(200).json({ status: 'ok' })
}

