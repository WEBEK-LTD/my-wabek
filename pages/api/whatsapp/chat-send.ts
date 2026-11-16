/**
 * /api/whatsapp/chat-send
 * Live Chat send endpoint — source=live_chat
 *
 * Inside 24h window  → send agent message as text
 * Outside 24h window → 403 outside_window (the agent must wait for the
 *                       customer, or use a template elsewhere)
 *
 * All sends go through lib/wa-smart-send (plan limit, opt-out, SSRF check).
 */
import { NextApiRequest, NextApiResponse } from 'next'
import { requireMemberAccess } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { smartSend, smartSendWAWeb, smartSendMedia, resolveProvider, isInWindow } from '@/lib/wa-smart-send'
import { sanitizeDisplayFilename } from '@/lib/media-storage'

const MEDIA_TYPES = new Set(['image', 'video', 'audio', 'ptt', 'document', 'sticker'])

const OUTSIDE_WINDOW = {
  success: false,
  inWindow: false,
  outside_window: true,
  error: 'outside_window',
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireMemberAccess(req, res, 'inbox')
  if (!user) return

  const { to, text, instance_id, contact_id, media_url, media_type, media_mime_type, media_filename } = req.body || {}
  // Either a text message OR a media message (with optional caption=text) is required.
  if (!to || typeof to !== 'string') return res.status(400).json({ error: 'to required' })
  if (!text && !media_url) return res.status(400).json({ error: 'text or media_url required' })
  if (text !== undefined && typeof text !== 'string') return res.status(400).json({ error: 'text must be a string' })

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
  const sentBy = user.actualUserId || user.userId

  // ── Media send path ──
  if (media_url) {
    if (typeof media_url !== 'string') return res.status(400).json({ error: 'media_url must be a string' })
    const type = MEDIA_TYPES.has(media_type) ? media_type : 'document'
    console.log(`[live_chat] media send to=${cleanPhone} type=${type} provider=${provider.toUpperCase()} instance=${instance.id}`)

    const r = await smartSendMedia({
      userId: user.userId,
      instance,
      to: cleanPhone,
      mediaUrl: media_url,
      mediaType: type,
      caption: text || undefined,
      mimeType: typeof media_mime_type === 'string' ? media_mime_type.slice(0, 100) : undefined,
      filename: media_filename ? sanitizeDisplayFilename(media_filename) : undefined,
      contactId: contact_id || null,
      source: 'live_chat',
      sentBy,
    })
    if (r.error === 'outside_window') {
      return res.status(403).json({
        ...OUTSIDE_WINDOW,
        message: 'This contact is outside the 24-hour messaging window. You can only send media after the customer messages you first.',
      })
    }
    if (r.error) return res.status(r.blocked ? 403 : 502).json({ error: r.error, code: r.blocked })
    return res.status(200).json({ success: true, wa_message_id: r.messageId, method: 'media', inWindow: r.inWindow })
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
      source: 'live_chat',
      sentBy,
    })
    console.log(`[live_chat] WA_WEB result: msgId=${r.messageId} error=${r.error || 'none'}`)
    if (r.error) return res.status(r.blocked ? 403 : 400).json({ error: r.error, code: r.blocked })
    return res.status(200).json({ success: true, wa_message_id: r.messageId, method: 'text' })
  }

  // Cloud API — check the 24h window for THIS number on THIS instance
  const inWindow = await isInWindow(user.userId, cleanPhone, instance.id)

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
      source: 'live_chat',
      forceTemplate: false,
      sentBy,
    })
    console.log(`[live_chat] IN_WINDOW result: method=${r.method} msgId=${r.messageId}`)
    if (r.error) return res.status(r.blocked ? 403 : 400).json({ error: r.error, code: r.blocked, inWindow: true })
    return res.status(200).json({ success: true, wa_message_id: r.messageId, method: 'text', inWindow: true })
  }

  // Outside 24h window — cannot send free text
  // Return 403 so the UI shows the agent a clear notice
  console.log(`[live_chat] OUTSIDE_WINDOW — blocking send, notifying agent`)
  return res.status(403).json({
    ...OUTSIDE_WINDOW,
    message: 'This contact is outside the 24-hour messaging window. You can only reply after the customer sends you a message first.',
  })
}
