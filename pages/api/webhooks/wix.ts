import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { smartSend, smartSendWAWeb, resolveProvider } from '@/lib/wa-smart-send'
import { authenticateApiKey } from '@/lib/api-key-auth'

export const config = { api: { bodyParser: true } }

// NOTE: this is NOT a Wix-app webhook (those are signed JWTs, see
// /api/wix/webhook). It is the URL tenants paste into Wix Automations
// ("send HTTP request" with key/value pairs) and is authenticated with the
// tenant's WABEK API key: X-API-Key / Bearer header, or ?api_key= for
// existing automations (deprecated, see lib/api-key-auth).

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const auth = await authenticateApiKey(req, { route: '/api/webhooks/wix' })
  if (!auth) return res.status(401).json({ error: 'Invalid or missing API key' })

  const userId = auth.userId
  const db     = supabaseAdmin()
  const body   = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>

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
    .select('id, user_id, status, is_default, instance_type, type, phone_number_id, access_token')
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

  // Send — smartSend / smartSendWAWeb apply the plan/opt-out guard and
  // insert the outbound message row (no second insert here).
  const r = resolveProvider(instance) === 'wa_web'
    ? await smartSendWAWeb({ userId, instanceId: instance.id, to: phone, text: message, source: 'notification' })
    : await smartSend({ userId, instanceId: instance.id, phoneNumberId: instance.phone_number_id, accessToken: instance.access_token, to: phone, text: message, forceTemplate: false, source: 'notification' })

  if (r.error) {
    console.error('[wix webhook] send failed:', r.error)
    return res.status(r.blocked ? 403 : 502).json({ error: 'Failed to send', code: r.blocked })
  }
  return res.status(200).json({ success: true, event, phone, wa_message_id: r.messageId || '' })
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
