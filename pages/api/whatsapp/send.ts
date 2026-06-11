import { smartSend, smartSendWAWeb, resolveProvider } from '@/lib/wa-smart-send'
import { sendWAWebMessage } from '@/lib/wa-web'
import { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth'
import { sendTextMessage, sendMediaMessage } from '@/lib/whatsapp'
import { v4 as uuidv4 } from 'uuid'

const schema = z.object({
  instance_id: z.string().uuid(),
  to: z.string().min(5),
  type: z.enum(['text', 'image', 'document', 'audio', 'video']).default('text'),
  text: z.string().optional(),
  media_url: z.string().url().optional(),
  caption: z.string().optional(),
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  try {
    const body = schema.parse(req.body)

    const { data: instance } = await db
      .from('whatsapp_instances')
      .select('*')
      .eq('id', body.instance_id)
      .eq('user_id', user.userId)
      .single()

    if (!instance) return res.status(404).json({ error: 'Instance not found' })
    if (instance.status !== 'connected') return res.status(400).json({ error: 'Instance not connected' })

    // Find or create contact
    let contactId: string | null = null
    const { data: contact } = await db.from('contacts').select('id').eq('user_id', user.userId).eq('phone', body.to).maybeSingle()
    contactId = contact?.id || null
    if (!contactId) {
      const { data: newContact } = await db.from('contacts').insert({ id: uuidv4(), user_id: user.userId, phone: body.to, tags: [] }).select().single()
      contactId = newContact?.id || null
    }

    // Send via WhatsApp — Cloud API or WA Web
    let waResult: { messages?: Array<{ id: string }>; messageId?: string | null } = { messageId: null }
    const isWAWeb = (instance.instance_type || instance.type) === 'wa_web'

    if (isWAWeb) {
      const { sendWAWebMessage } = await import('@/lib/wa-web')
      if (!body.text) return res.status(400).json({ error: 'text required' })
      const webResult = await sendWAWebMessage({ instanceId: instance.id, to: body.to, text: body.text })
      waResult = { messages: [{ id: webResult.messageId }] }
    } else if (body.type === 'text') {
      if (!body.text) return res.status(400).json({ error: 'text required for text messages' })
      const sr = await smartSend({ userId: (instance as any)?.user_id || (instance as any)?.userId || '', instanceId: (instance as any)?.id || '', phoneNumberId: instance.phone_number_id, accessToken: instance.access_token, to: body.to, text: body.text, source: 'api' as any })
      waResult = { messageId: sr.messageId, messages: sr.messageId ? [{ id: sr.messageId }] : [] }
    } else {
      if (!body.media_url) return res.status(400).json({ error: 'media_url required for media messages' })
      waResult = await sendMediaMessage({ phoneNumberId: instance.phone_number_id, accessToken: instance.access_token, to: body.to, type: body.type, mediaUrl: body.media_url, caption: body.caption })
    }

    const waMessageId = waResult.messageId || waResult.messages?.[0]?.id

    await db.from('messages').insert({
      id: uuidv4(),
      user_id: user.userId,
      instance_id: body.instance_id,
      contact_id: contactId,
      wa_message_id: waMessageId,
      direction: 'outbound',
      type: body.type,
      content: body.text || body.caption || '',
      media_url: body.media_url || null,
      status: 'sent',
    })

    return res.status(200).json({ success: true, wa_message_id: waMessageId })
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid data', details: err.errors })
    console.error('Send message error:', err)
    return res.status(500).json({ error: 'Failed to send message' })
  }
}
