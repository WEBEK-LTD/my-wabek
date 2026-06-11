import { NextApiRequest, NextApiResponse } from 'next'
import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { notifyServiceNotification, notifyInvoiceCreated, notifyInvoiceOverdue, notifyPaymentReminder } from '@/lib/wa-notifications'
import { smartSend, smartSendWAWeb } from '@/lib/wa-smart-send'
import { v4 as uuidv4 } from 'uuid'

export const config = { api: { bodyParser: true } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // API key from query string
  const apiKey = (req.query.api_key as string) || (req.headers['x-api-key'] as string)
  if (!apiKey) return res.status(401).json({ error: 'api_key required' })

  const db = supabaseAdmin()

  // Lookup by hash
  const keyHash = createHash('sha256').update(apiKey).digest('hex')
  const { data: keyRow } = await db
    .from('api_keys')
    .select('user_id, is_active')
    .eq('key_hash', keyHash)
    .eq('is_active', true)
    .maybeSingle()

  if (!keyRow) return res.status(401).json({ error: 'Invalid API key' })

  const userId = keyRow.user_id
  const body   = req.body as Record<string, unknown>

  // Wix sends key-value pairs — support both flat and nested
  // event field is required
  const event = String(body.event || body.type || '')
  if (!event) return res.status(400).json({ error: 'event field required. Add a key "event" with value e.g. "order_placed"' })

  // Extract phone — Wix key-value pairs use whatever key you define
  const phone = cleanPhone(
    String(body.customer_phone || body.phone || body.billing_phone || body.buyerPhone || '')
  )
  if (!phone) return res.status(200).json({ success: true, skipped: 'no phone number in payload' })

  // Get connected instance
  const { data: instances } = await db
    .from('whatsapp_instances')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(10)

  const instance = instances?.find(i => i.status === 'connected' && i.is_default)
    || instances?.find(i => i.status === 'connected')
    || instances?.[0]

  if (!instance) return res.status(404).json({ error: 'No connected WhatsApp instance found' })

  // Get custom templates if any
  const { data: tplRow } = await db.from('system_settings')
    .select('value').eq('key', `wix_templates_${userId}`).maybeSingle()
  const customTemplates = (tplRow?.value || {}) as Record<string, string>

  // Build message
  const message = buildMessage(event, body, customTemplates)
  if (!message) return res.status(200).json({ success: true, skipped: `event "${event}" not recognized` })

  // Send
  try {
    const isWAWeb = (instance.instance_type || instance.type) === 'wa_web'
    let waMessageId = ''

    if (isWAWeb) {
      const r = await notifyServiceNotification(userId, phone, 'Customer', message)
      waMessageId = r?.messageId || ''
    } else {
      const r = await smartSend({ userId: userId, instanceId: instance?.id || '', phoneNumberId: instance.phone_number_id, accessToken: instance.access_token, to: phone, text: message, forceTemplate: false })
      waMessageId = r?.messageId || ''
    }

    await db.from('messages').insert({
      id:            uuidv4(),
      user_id:       userId,
      instance_id:   instance.id,
      direction:     'outbound',
      type:          'text',
      content:       message,
      wa_message_id: waMessageId,
      status:        'sent',
    })

    return res.status(200).json({ success: true, event, phone, wa_message_id: waMessageId })
  } catch (err: unknown) {
    const e = err as { message?: string }
    console.error('[wix webhook] error:', e?.message)
    return res.status(500).json({ error: 'Failed to send', detail: e?.message })
  }
}

function buildMessage(event: string, d: Record<string, unknown>, custom: Record<string, string> = {}): string {
  const name  = String(d.customer_name || d.name || 'Customer')
  const first = name.split(' ')[0]
  const oid   = d.order_id   || d.orderId   || ''
  const total = d.total      || d.amount    || ''
  const track = d.tracking_number || d.trackingNumber || 'N/A'
  const site  = d.site_name  || ''
  const cart  = d.cart_url   || ''

  // Use custom template if saved
  if (custom[event]) {
    return custom[event]
      .replace(/{{customer_name}}/g, name)
      .replace(/{{first_name}}/g,    first)
      .replace(/{{order_id}}/g,      String(d.order_id || d.orderId || ''))
      .replace(/{{total}}/g,         String(d.total || d.amount || ''))
      .replace(/{{tracking_number}}/g, String(d.tracking_number || 'N/A'))
      .replace(/{{cart_url}}/g,      String(d.cart_url || ''))
      .replace(/{{site_name}}/g,     String(d.site_name || ''))
  }

  const msgs: Record<string, string> = {
    order_placed:    `🛒 Order Confirmed!\n\nHi ${first}, your order #${oid} has been placed.\n💰 Total: ${total}\n\nThank you! 🙏`,
    order_paid:      `✅ Payment Received!\n\nHi ${first}, payment for order #${oid} confirmed.\n💰 ${total}\n\nWe're preparing your order!`,
    order_shipped:   `🚚 Order Shipped!\n\nHi ${first}, order #${oid} is on its way!\n📦 Tracking: ${track}`,
    order_delivered: `✅ Order Delivered!\n\nHi ${first}, order #${oid} has been delivered.\n\nEnjoy your purchase! 😊`,
    order_cancelled: `❌ Order Cancelled\n\nHi ${first}, order #${oid} has been cancelled.\nContact us if you need help.`,
    order_refunded:  `💸 Refund Processed\n\nHi ${first}, your refund for order #${oid} is being processed.\n💰 ${total}\n\nAllow 3-5 business days.`,
    abandoned_cart:  `🛒 You left something!\n\nHi ${first}, you have items waiting in your cart.\n\nComplete your order: ${cart}`,
    new_member:      `👋 Welcome to ${site}!\n\nHi ${first}, we're happy to have you. Start exploring now!`,
    form_submitted:  `📋 Form Received!\n\nHi ${first}, we got your submission and will be in touch shortly.`,
  }

  return msgs[event] || ''
}

function cleanPhone(phone: string): string {
  return phone.replace(/[^\d]/g, '').replace(/^0+/, '')
}
