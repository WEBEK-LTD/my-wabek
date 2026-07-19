import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { sendWAWebMessage } from '@/lib/wa-web'
import { processChatbotMessage } from '@/lib/chatbot-engine'
import { processAIReply } from '@/lib/ai-engine'
import { insertMessage } from '@/lib/message-insert'
import { executeAutomationFlow } from '@/lib/automation-engine'
import { notifyNewMessage, notifyInstanceConnected, notifyInstanceDisconnected } from '@/lib/notifications'
import { v4 as uuidv4 } from 'uuid'

export const config = { api: { bodyParser: true } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const secret = req.headers['x-secret'] || req.headers['x-wa-secret']
  if (secret !== process.env.WA_WEB_SERVER_SECRET && process.env.WA_WEB_SERVER_SECRET) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const db = supabaseAdmin()
  const { event, instanceId, data } = req.body

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
        console.log(`[wa-web-events] message_received instanceId=${instanceId} from=${data.from} type=${data.type} text="${(data.text || '').slice(0, 50)}"`)

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
        console.log(`[wa-web-events] saving message contactId=${contactId} content="${content.slice(0, 50)}" mediaUrl=${data.mediaUrl ? 'yes' : 'no'}`)

        // Save message
        // Save message (safe — falls back if media columns missing in DB)
        const { error: msgErr } = await insertMessage({
          user_id:        instance.user_id,
          instance_id:    instanceId,
          contact_id:     contactId,
          wa_message_id:  data.messageId,
          direction:      'inbound',
          type:           data.type || 'text',
          content,
          status:         'delivered',
          media_url:      data.mediaUrl || null,
          media_mime_type: data.mimeType || data.mimetype || null,
          media_filename: data.filename || null,
        })

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
        const { data: updated, error: updErr } = await db
          .from('messages')
          .update({ status: data.status })
          .eq('wa_message_id', data.messageId)
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
