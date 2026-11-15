import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { safeEqual } from '@/lib/security'
import { uploadMediaBuffer, parseDataUrl } from '@/lib/media-storage'
import { isValidInstanceId } from '@/lib/wa-web'
import { processChatbotMessage } from '@/lib/chatbot-engine'
import { processAIReply } from '@/lib/ai-engine'
import { insertMessage } from '@/lib/message-insert'
import { executeAutomationFlow } from '@/lib/automation-engine'
import { notifyNewMessage, notifyInstanceConnected, notifyInstanceDisconnected } from '@/lib/notifications'
import { v4 as uuidv4 } from 'uuid'

// Inbound WA Web media arrives as base64 data: URLs inside the JSON body.
export const config = { api: { bodyParser: { sizeLimit: '25mb' } } }

/** Accepted event secrets: WA_WEB_SERVER_SECRET (as before) and, if set, WABEK_EVENTS_SECRET. */
function eventSecrets(): string[] {
  return [process.env.WA_WEB_SERVER_SECRET || '', process.env.WABEK_EVENTS_SECRET || ''].filter(Boolean)
}

/**
 * Re-host a data: URL from the Baileys server on our storage, so the DB
 * stores a short storage URL instead of megabytes of base64. Already-hosted
 * http(s) URLs (Baileys uploading itself) are kept as they are.
 */
async function hostInboundMedia(mediaUrl: unknown, userId: string, mimeType?: string): Promise<string | null> {
  if (!mediaUrl || typeof mediaUrl !== 'string') return null
  if (/^https:\/\//i.test(mediaUrl)) return mediaUrl
  const parsed = parseDataUrl(mediaUrl)
  if (!parsed) return null
  const uploaded = await uploadMediaBuffer(parsed.buffer, { userId, mimeType: mimeType || parsed.mimeType })
  if (!uploaded) console.error('[wa-web-events] media upload failed — storing message without media')
  return uploaded?.url || null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Fail closed: without a configured secret nobody may post events.
  const secrets = eventSecrets()
  if (!secrets.length) {
    console.error('[wa-web-events] WA_WEB_SERVER_SECRET is not set — rejecting event')
    return res.status(503).json({ error: 'Not configured' })
  }
  const provided = req.headers['x-secret'] || req.headers['x-wa-secret']
  if (!secrets.some(s => safeEqual(provided, s))) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const db = supabaseAdmin()
  const { event, instanceId } = req.body || {}
  const data = (req.body?.data || {}) as Record<string, any>
  if (!isValidInstanceId(instanceId)) return res.status(400).json({ error: 'Invalid instanceId' })

  try {
    switch (event) {
      case 'qr_updated': {
        await db.from('whatsapp_instances').update({ qr_code: data.qrCode, status: 'qr_pending' }).eq('id', instanceId)
        break
      }

      case 'display_name_update': {
        if (data.displayName) {
          await db.from('whatsapp_instances')
            .update({ display_name: data.displayName })
            .eq('id', instanceId)
          console.log(`[wa-web-events] display_name updated: ${data.displayName} for ${instanceId}`)
        }
        break
      }

      case 'connected': {
        // Build update — only include display_name if we actually received one
        // (never overwrite existing name with null/empty)
        const connUpdate: Record<string, unknown> = {
          status: 'connected',
          phone_number: data.phoneNumber || 'unknown',
          qr_code: null,
          last_seen_at: new Date().toISOString(),
        }
        if (data.displayName) connUpdate.display_name = data.displayName

        await db.from('whatsapp_instances').update(connUpdate).eq('id', instanceId)

        const { data: inst } = await db.from('whatsapp_instances').select('user_id, phone_number').eq('id', instanceId).maybeSingle()
        if (inst) await notifyInstanceConnected(inst.user_id, data.phoneNumber || inst.phone_number)
        break
      }

      case 'disconnected': {
        const { data: inst } = await db.from('whatsapp_instances').select('user_id, phone_number').eq('id', instanceId).maybeSingle()
        await db.from('whatsapp_instances').update({ status: 'disconnected', qr_code: null }).eq('id', instanceId)
        if (inst) await notifyInstanceDisconnected(inst.user_id, inst.phone_number)
        break
      }

      case 'message_received': {
        console.log(`[wa-web-events] message_received instanceId=${instanceId} from=${data.from} type=${data.type}`)

        // Filter newsletter/broadcast
        if (data.from && (
          data.from.includes('@newsletter') ||
          data.from.includes('@broadcast') ||
          data.from.includes('status@') ||
          data.from === 'status@broadcast'
        )) {
          console.log(`[wa-web-events] skip newsletter/broadcast from=${data.from}`)
          break
        }

        const { data: instance, error: instErr } = await db.from('whatsapp_instances').select('*').eq('id', instanceId).maybeSingle()
        if (!instance) {
          console.log(`[wa-web-events] instance not found instanceId=${instanceId} error=${instErr?.message}`)
          break
        }
        console.log(`[wa-web-events] instance found userId=${instance.user_id}`)

        // Dedupe: never process the same inbound message twice
        if (data.messageId) {
          const { data: seen } = await db.from('messages').select('id')
            .eq('wa_message_id', data.messageId).eq('instance_id', instanceId).eq('direction', 'inbound').limit(1)
          if (seen?.length) {
            console.log(`[wa-web-events] duplicate message ${data.messageId} — skipped`)
            break
          }
        }

        // Find or create contact
        let contactId: string | null = null
        const { data: contacts } = await db.from('contacts').select('id').eq('user_id', instance.user_id).eq('phone', data.from).limit(1)
        if (contacts?.[0]) {
          contactId = contacts[0].id
        } else {
          const { data: newContact } = await db.from('contacts').insert({
            id: uuidv4(), user_id: instance.user_id, phone: data.from, name: data.pushName || null, tags: [],
          }).select().maybeSingle()
          contactId = newContact?.id || null
        }

        const content = data.text || data.caption || `[${data.type}]`
        console.log(`[wa-web-events] saving message contactId=${contactId} mediaUrl=${data.mediaUrl ? 'yes' : 'no'}`)

        let mediaUrl: string | null = null
        try {
          mediaUrl = await hostInboundMedia(data.mediaUrl, instance.user_id, data.mimeType || data.mimetype)
        } catch (e: any) {
          console.error('[wa-web-events] media hosting error (non-fatal):', e?.message)
        }

        // Save message (safe — falls back if media columns missing in DB)
        const { error: msgErr, duplicate } = await insertMessage({
          user_id:        instance.user_id,
          instance_id:    instanceId,
          contact_id:     contactId,
          wa_message_id:  data.messageId,
          direction:      'inbound',
          type:           data.type || 'text',
          content,
          status:         'delivered',
          media_url:      mediaUrl,
          media_mime_type: data.mimeType || data.mimetype || null,
          media_filename: data.filename || null,
        })

        if (duplicate) {
          console.log(`[wa-web-events] duplicate insert ${data.messageId} — skipped`)
          break
        }
        if (msgErr) {
          console.error(`[wa-web-events] ❌ message save failed:`, msgErr)
        } else {
          console.log(`[wa-web-events] ✅ message saved wa_message_id=${data.messageId}`)
        }

        // Notification
        await notifyNewMessage(instance.user_id, data.pushName || data.from, content)

        // Auto-create inbox conversation — scoped to this instance (inbox)
        try {
          await db.from('conversation_assignments').upsert({
            owner_id:        instance.user_id,
            contact_id:      contactId,
            instance_id:     instanceId,
            status:          'open',
            priority:        'normal',
            last_message_at: new Date().toISOString(),
            updated_at:      new Date().toISOString(),
            last_activity:   new Date().toISOString(),
            review_status:   'active',
          }, { onConflict: 'owner_id,contact_id,instance_id', ignoreDuplicates: false })
        } catch (e: any) {
          console.error('[wa-web-events] conversation upsert error:', e?.message)
        }

        // Run automation flows
        if (content) {
          await executeAutomationFlow({
            userId: instance.user_id,
            instanceId,
            from: data.from,
            message: content,
          })
        }
        // Try chatbot flow
        const chatbotHandled = await processChatbotMessage({
          userId: instance.user_id,
          instanceId: instanceId,
          instance: instance,
          from: data.from,
          message: content,
          contactName: data.pushName,
        })
        console.log(`[WEBHOOK] chatbot done, handled=${chatbotHandled}`)
        if (chatbotHandled) break

        // AI fallback — only if chatbot didn't handle it
        console.log(`[WEBHOOK] chatbotHandled=${chatbotHandled}, calling AI...`)
        await processAIReply({
          userId: instance.user_id,
          instanceId: instanceId,
          instance: instance,
          from: data.from,
          message: content,
          contactName: data.pushName,
          contactId: contactId,
        })
        break
      }

      case 'message_status': {
        // Update main messages table
        if (!data.messageId) break
        const { data: updated } = await db
          .from('messages')
          .update({ status: data.status })
          .eq('wa_message_id', data.messageId)
          .eq('instance_id', instanceId)
          .select('id')
        
        console.log(`[message_status] id=${data.messageId} status=${data.status} updated=${updated?.length || 0}`)
        
        // Also update support_messages if this messageId belongs to a support reply
        try {
          await db
            .from('support_messages')
            .update({ wa_message_id: data.messageId })
            .eq('wa_message_id', data.messageId)
        } catch {}

        break
      }
    }
  } catch (err) {
    console.error('WA Web event error:', err)
  }

  res.status(200).json({ ok: true })
}
