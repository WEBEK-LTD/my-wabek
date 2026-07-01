/**
 * /api/whatsapp/chat-send
 * Live Chat send endpoint — source=live_chat
 * 
 * Inside 24h window  → send agent message as text
 * Outside 24h window → send support_ticket_update template first,
 *                       then send agent message as text (re-opens window)
 */
import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { smartSend, smartSendWAWeb, resolveProvider, isInWindow } from '@/lib/wa-smart-send'
import { sendMediaMessage } from '@/lib/whatsapp'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireAuth(req, res)
  if (!user) return

  const { to, text, instance_id, contact_id, media_url, media_type, media_mime_type, media_filename } = req.body
  // Either a text message OR a media message (with optional caption=text) is required.
  if (!to) return res.status(400).json({ error: 'to required' })
  if (!text && !media_url) return res.status(400).json({ error: 'text or media_url required' })

  const db = supabaseAdmin()

  // Get instance
  const { data: instance } = await db
    .from('whatsapp_instances')
    .select('id,user_id,phone_number_id,access_token,instance_type,type,status')
    .eq('id', instance_id)
    .eq('user_id', user.userId)
    .maybeSingle()

  if (!instance) return res.status(404).json({ error: 'Instance not found' })

  const provider = resolveProvider(instance)
  const isJid = /@(lid|g\.us|s\.whatsapp\.net|broadcast)$/.test(to)
  const cleanPhone = isJid ? to : to.replace(/[^0-9]/g, '')

  // ── Media send path (isolated — does not touch the existing text-only flow below) ──
  if (media_url) {
    console.log(`[live_chat] media send to=${cleanPhone} type=${media_type} provider=${provider.toUpperCase()} instance=${instance.id}`)

    if (provider === 'wa_web') {
      try {
        const { sendWAWebMedia } = await import('@/lib/wa-web')
        const r = await sendWAWebMedia({
          instanceId: instance.id,
          to: cleanPhone,
          mediaUrl: media_url,
          mediaType: media_type || 'document',
          caption: text || undefined,
          filename: media_filename || undefined,
          mimetype: media_mime_type || undefined,
        })

        await db.from('messages').insert({
          id: uuidv4(), user_id: instance.user_id, instance_id: instance.id, contact_id: contact_id || null,
          wa_message_id: r.messageId || null, direction: 'outbound',
          type: media_type || 'document', content: text || '',
          media_url, media_mime_type: media_mime_type || null, media_filename: media_filename || null,
          status: 'sent', meta: { source: 'live_chat' },
        })
        return res.status(200).json({ success: true, wa_message_id: r.messageId, method: 'media' })
      } catch (err: any) {
        console.error('[live_chat] WA Web media send failed:', err?.message)
        return res.status(502).json({ error: err?.message || 'Media send failed (WA Web)' })
      }
    }

    // Cloud API — media also requires the 24h window like text (Meta restriction)
    const inWindow = await isInWindow(user.userId, cleanPhone)
    if (!inWindow) {
      return res.status(403).json({
        success: false, inWindow: false, outside_window: true, error: 'outside_window',
        message: 'This contact is outside the 24-hour messaging window. You can only send media after the customer messages you first.',
      })
    }

    try {
      // Cloud API has no separate "ptt" send type — voice notes are sent as
      // regular "audio" messages (the `voice: true` distinction only exists
      // on the RECEIVING side of the webhook, not for sending).
      const sendType = media_type === 'ptt' ? 'audio' : (media_type || 'document')

      const result = await sendMediaMessage({
        phoneNumberId: instance.phone_number_id,
        accessToken: instance.access_token,
        to: cleanPhone,
        type: sendType as 'image' | 'document' | 'audio' | 'video' | 'sticker',
        mediaUrl: media_url,
        caption: text || undefined,
        filename: sendType === 'document' ? (media_filename || undefined) : undefined,
      })
      const waMessageId = result?.messages?.[0]?.id || null

      await db.from('messages').insert({
        id: uuidv4(), user_id: instance.user_id, instance_id: instance.id, contact_id: contact_id || null,
        wa_message_id: waMessageId, direction: 'outbound',
        type: media_type || 'document', content: text || '',
        media_url, media_mime_type: media_mime_type || null, media_filename: media_filename || null,
        status: 'sent', meta: { source: 'live_chat' },
      })
      return res.status(200).json({ success: true, wa_message_id: waMessageId, method: 'media', inWindow: true })
    } catch (err: any) {
      console.error('[live_chat] Cloud API media send failed:', err?.response?.data || err?.message)
      return res.status(502).json({ error: err?.response?.data?.error?.message || err?.message || 'Media send failed' })
    }
  }
  // ── End media send path ──

  console.log(`[live_chat] send to=${cleanPhone} provider=${provider.toUpperCase()} instance=${instance.id}`)

  // WA Web — always send text directly, no window restriction
  if (provider === 'wa_web') {
    const r = await smartSendWAWeb({
      userId: user.userId,
      instanceId: instance.id,
      to: cleanPhone,
      text,
      contactId: contact_id || null,
    })
    console.log(`[live_chat] WA_WEB result: msgId=${r.messageId} error=${r.error || 'none'}`)
    if (r.error) return res.status(400).json({ error: r.error })
    return res.status(200).json({ success: true, wa_message_id: r.messageId, method: 'text' })
  }

  // Cloud API — check 24h window
  const inWindow = await isInWindow(user.userId, cleanPhone)

  console.log(`[live_chat] inWindow=${inWindow} phone=${cleanPhone}`)

  if (inWindow) {
    // Inside window — send text directly
    const r = await smartSend({
      userId: user.userId,
      instanceId: instance.id,
      phoneNumberId: instance.phone_number_id,
      accessToken: instance.access_token,
      to: cleanPhone,
      text,
      contactId: contact_id || null,
      source: 'live_chat' as any,
      forceTemplate: false,
    })
    console.log(`[live_chat] IN_WINDOW result: method=${r.method} msgId=${r.messageId}`)
    if (r.error) return res.status(400).json({ error: r.error, inWindow: true })
    return res.status(200).json({ success: true, wa_message_id: r.messageId, method: 'text', inWindow: true })
  }

  // Outside 24h window — cannot send free text
  // Return 403 so the UI shows the agent a clear notice
  console.log(`[live_chat] OUTSIDE_WINDOW — blocking send, notifying agent`)
  return res.status(403).json({
    success: false,
    inWindow: false,
    outside_window: true,
    error: 'outside_window',
    message: 'This contact is outside the 24-hour messaging window. You can only reply after the customer sends you a message first.',
  })
}
