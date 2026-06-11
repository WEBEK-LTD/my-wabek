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
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireAuth(req, res)
  if (!user) return

  const { to, text, instance_id, contact_id } = req.body
  if (!to || !text) return res.status(400).json({ error: 'to and text required' })

  const db = supabaseAdmin()

  // Get instance
  const { data: instance } = await db
    .from('whatsapp_instances')
    .select('id,phone_number_id,access_token,instance_type,type,status')
    .eq('id', instance_id)
    .eq('user_id', user.userId)
    .maybeSingle()

  if (!instance) return res.status(404).json({ error: 'Instance not found' })

  const provider = resolveProvider(instance)
  const cleanPhone = to.replace(/[^0-9]/g, '')

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
