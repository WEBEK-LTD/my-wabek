import { smartSend, smartSendWAWeb, smartSendMedia, resolveProvider } from '@/lib/wa-smart-send'
import { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { requireMemberAccess } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

const schema = z.object({
  instance_id: z.string().uuid(),
  to: z.string().min(5).max(64),
  type: z.enum(['text', 'image', 'document', 'audio', 'video']).default('text'),
  text: z.string().max(4096).optional(),
  media_url: z.string().url().optional(),
  caption: z.string().max(1024).optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await requireMemberAccess(req, res, 'inbox')
  if (!user) return
  const db = supabaseAdmin()

  try {
    const body = schema.parse(req.body)

    const { data: instance } = await db
      .from('whatsapp_instances')
      .select('id, user_id, status, instance_type, type, phone_number_id, access_token')
      .eq('id', body.instance_id)
      .eq('user_id', user.userId)
      .maybeSingle()

    if (!instance) return res.status(404).json({ error: 'Instance not found' })
    if (instance.status !== 'connected') return res.status(400).json({ error: 'Instance not connected' })

    // Find or create contact
    let contactId: string | null = null
    const { data: contact } = await db.from('contacts').select('id').eq('user_id', user.userId).eq('phone', body.to).limit(1)
    contactId = contact?.[0]?.id || null
    if (!contactId) {
      const { data: newContact } = await db.from('contacts').insert({ id: uuidv4(), user_id: user.userId, phone: body.to, tags: [] }).select().maybeSingle()
      contactId = newContact?.id || null
    }

    const sentBy = user.actualUserId || user.userId
    let result
    if (body.type === 'text') {
      if (!body.text) return res.status(400).json({ error: 'text required for text messages' })
      // smartSend / smartSendWAWeb insert the message row themselves
      result = resolveProvider(instance) === 'wa_web'
        ? await smartSendWAWeb({ userId: user.userId, instanceId: instance.id, to: body.to, text: body.text, contactId, source: 'api', sentBy })
        : await smartSend({ userId: user.userId, instanceId: instance.id, phoneNumberId: instance.phone_number_id, accessToken: instance.access_token, to: body.to, text: body.text, contactId, source: 'api', sentBy })
    } else {
      if (!body.media_url) return res.status(400).json({ error: 'media_url required for media messages' })
      result = await smartSendMedia({
        userId: user.userId, instance, to: body.to, mediaUrl: body.media_url, mediaType: body.type,
        caption: body.caption || body.text, contactId, source: 'api', sentBy,
      })
    }

    if (result.error === 'outside_window') {
      return res.status(403).json({ error: 'outside_window', outside_window: true, message: 'Text and media can only be sent within 24 hours of the customer\'s last message. Outside that window send an approved template.' })
    }
    if (result.error) return res.status(result.blocked ? 403 : 502).json({ error: result.error, code: result.blocked })
    return res.status(200).json({ success: true, wa_message_id: result.messageId })
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid data', details: err.errors })
    console.error('Send message error:', err)
    return res.status(500).json({ error: 'Failed to send message' })
  }
}
