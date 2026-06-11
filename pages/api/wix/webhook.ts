import { smartSend, smartSendWAWeb } from '@/lib/wa-smart-send'
import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

export const config = { api: { bodyParser: false } }

async function getRawBody(req: NextApiRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => { data += chunk.toString() })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({ received: true })
  if (req.method !== 'POST') return

  try {
    const rawBody = await getRawBody(req)
    if (!rawBody) return

    const event = req.query.event as string || ''

    // Decode JWT
    let instanceId   = ''
    let orderId      = ''
    let jwtOrderData: Record<string, unknown> | null = null

    try {
      const parts = rawBody.trim().split('.')
      if (parts.length === 3) {
        const b64    = parts[1].replace(/-/g, '+').replace(/_/g, '/')
        const pad    = b64.length % 4
        const jwt    = JSON.parse(Buffer.from(pad ? b64 + '='.repeat(4-pad) : b64, 'base64').toString('utf8'))
        instanceId   = String(jwt.instanceId || jwt.appInstanceId || '')

        if (jwt.data) {
          try {
            const d1 = JSON.parse(typeof jwt.data === 'string' ? jwt.data : JSON.stringify(jwt.data))
            orderId  = String(d1.entityId || d1.id || d1.orderId || '')

            if (d1.data) {
              const d2 = JSON.parse(typeof d1.data === 'string' ? d1.data : JSON.stringify(d1.data))
              if (!orderId) orderId = String(d2.entityId || d2.id || d2.orderId || '')

              // Extract order entity from webhook payload
              if (d2.updatedEvent?.currentEntity) jwtOrderData = d2.updatedEvent.currentEntity
              else if (d2.createdEvent?.entity)   jwtOrderData = d2.createdEvent.entity
              else if (d2.entity)                 jwtOrderData = d2.entity
            }

            if (!jwtOrderData) {
              if (d1.updatedEvent?.currentEntity) jwtOrderData = d1.updatedEvent.currentEntity
              else if (d1.createdEvent?.entity)   jwtOrderData = d1.createdEvent.entity
              else if (d1.entity)                 jwtOrderData = d1.entity
            }
          } catch {}
        }
      } else {
        const parsed = JSON.parse(rawBody)
        instanceId   = String(parsed.instanceId || '')
        orderId      = String(parsed.entityId || '')
      }
    } catch { return }

    if (!instanceId) instanceId = String(req.query.instance_id || '')

    console.log('[wix webhook] instanceId:', instanceId, 'orderId:', orderId, 'event:', event, 'hasJWT:', !!jwtOrderData)

    if (!instanceId) return

    const db = supabaseAdmin()

    // Deduplication — use raw event key
    if (orderId) {
      const dedupeKey = `wix_sent_${orderId}_${event}`
      const { data: already } = await db.from('system_settings').select('key').eq('key', dedupeKey).maybeSingle()
      if (already) { console.log('[wix webhook] duplicate — skip'); return }
      await db.from('system_settings').upsert({
        key: dedupeKey, value: { ts: new Date().toISOString() }, updated_at: new Date().toISOString(),
      }, { onConflict: 'key' })
    }

    // Find user
    const { data: link } = await db.from('wix_user_links').select('user_id').eq('wix_instance_id', instanceId).maybeSingle()
    if (!link?.user_id) { console.log('[wix webhook] no user for instance:', instanceId); return }
    const userId = link.user_id

    // Get installation
    const { data: install } = await db.from('wix_installations').select('access_token, meta_site_id').eq('wix_instance_id', instanceId).maybeSingle()
    let accessToken  = install?.access_token || ''
    const metaSiteId = install?.meta_site_id || ''

    // Get token if needed
    if (!accessToken) {
      try {
        const tokenRes = await fetch('https://www.wixapis.com/oauth2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grant_type:    'client_credentials',
            client_id:     process.env.WIX_APP_ID     || '48cfce94-1e3d-4d09-a34d-e5f41e5b0469',
            client_secret: process.env.WIX_APP_SECRET || 'eaf03696-cfc8-4fe0-92e6-d0e00d1f5e76',
            instance_id:   instanceId,
          }),
        })
        const td = await tokenRes.json()
        accessToken = td.access_token || ''
        console.log('[wix webhook] token status:', tokenRes.status, 'hasToken:', !!accessToken)
      } catch (e) { console.log('[wix webhook] token error:', e) }
    }

    // Use JWT order data if available, otherwise fetch from API
    let orderData: Record<string, unknown> = jwtOrderData || {}

    if (!jwtOrderData && orderId && accessToken) {
      const headers: Record<string, string> = {
        Authorization:  `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      }
      if (metaSiteId) headers['wix-site-id'] = metaSiteId

      // order_placed needs retry — order may not be ready in API yet
      const maxAttempts = event === 'order_placed' ? 4 : 1
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 3000))
        try {
          const r = await fetch(`https://www.wixapis.com/ecom/v1/orders/${orderId}`, { headers })
          console.log(`[wix webhook] order fetch attempt ${attempt + 1}:`, r.status)
          if (r.ok) {
            const j = await r.json()
            orderData = j?.order || j || {}
            break
          } else {
            const err = await r.json().catch(() => ({}))
            console.log('[wix webhook] order error:', JSON.stringify(err).slice(0, 200))
            if (r.status !== 404) break
          }
        } catch (e) { console.log('[wix webhook] fetch error:', e); break }
      }
    } else if (jwtOrderData) {
      console.log('[wix webhook] using JWT order data ✅')
    }

    // For order_updated — map to correct event based on status
    if (event === 'order_updated') {
      const status        = String((orderData as any)?.status || '').toUpperCase()
      const paymentStatus = String((orderData as any)?.paymentStatus || '').toUpperCase()
      const isRefunded    = ['REFUNDED', 'PARTIALLY_REFUNDED'].includes(paymentStatus)
      const isCancelled   = ['CANCELED', 'CANCELLED'].includes(status)
      const isNew         = ['INITIALIZED', 'APPROVED', 'NEW'].includes(status)

      if (isCancelled || isRefunded) {
        // Will be handled as order_cancelled below
      } else if (isNew) {
        // New order — treat as order_placed
        console.log('[wix webhook] order_updated with new status:', status, '— treating as order_placed')
        ;(req.query as any).event = 'order_placed'
      } else {
        console.log('[wix webhook] order_updated but status:', status, '— skip')
        return
      }
    }

    // For order_cancelled — check actual status
    if (event === 'order_cancelled') {
      const status        = String((orderData as any)?.status || '').toUpperCase()
      const paymentStatus = String((orderData as any)?.paymentStatus || '').toUpperCase()
      const isRefunded    = ['REFUNDED', 'PARTIALLY_REFUNDED'].includes(paymentStatus)
      const isCancelled   = ['CANCELED', 'CANCELLED'].includes(status)
      if (!isCancelled && !isRefunded) {
        console.log('[wix webhook] order_cancelled but status:', status, '— skip')
        return
      }
    }

    // Extract phone
    const buyerInfo = (orderData as any)?.buyerInfo || {}
    const shipping  = (orderData as any)?.shippingInfo?.logistics?.shippingDestination || {}
    const billing   = (orderData as any)?.billingInfo || {}
    const rawPhone  = buyerInfo.phone || buyerInfo.contactDetails?.phone ||
                      shipping.contactDetails?.phone || billing.contactDetails?.phone ||
                      billing.address?.phone || ''
    const phone = rawPhone.replace(/[^\d]/g, '').replace(/^0+/, '')

    if (!phone) { console.log('[wix webhook] no phone. buyerInfo:', JSON.stringify(buyerInfo).slice(0,200)); return }

    // Get WhatsApp instance
    const { data: instances } = await db.from('whatsapp_instances').select('*').eq('user_id', userId).order('created_at', { ascending: true })
    const instance = instances?.find(i => i.status === 'connected' && i.is_default)
                  || instances?.find(i => i.status === 'connected')
                  || instances?.[0]
    if (!instance) { console.log('[wix webhook] no WA instance for:', userId); return }

    // Templates
    const { data: tplRow } = await db.from('system_settings').select('value').eq('key', `wix_templates_${instanceId}`).maybeSingle()
    const templates = (tplRow?.value || {}) as Record<string, string>

    // Build message vars
    const buyerName   = `${buyerInfo.contactDetails?.firstName || buyerInfo.firstName || ''}`.trim() || 'Customer'
    const total       = (orderData as any)?.priceSummary?.total?.formattedAmount || ''
    const rawNum      = (orderData as any)?.number
    const orderNum    = (rawNum && Number(rawNum) > 0) ? rawNum : orderId.slice(0, 8)
    const checkoutUrl = ''

    // Fetch tracking from fulfillments API
    let tracking = ''
    if (event === 'order_shipped' && orderId && accessToken) {
      try {
        const fHeaders: Record<string, string> = {
          Authorization:  `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        }
        if (metaSiteId) fHeaders['wix-site-id'] = metaSiteId
        const fRes = await fetch(`https://www.wixapis.com/ecom/v1/fulfillments/orders/${orderId}/list`, { headers: fHeaders })
        console.log('[wix webhook] fulfillments status:', fRes.status)
        if (fRes.ok) {
          const fData = await fRes.json()
          const f0 = fData?.fulfillments?.[0]
          tracking = f0?.trackingInfo?.trackingLink || f0?.trackingInfo?.trackingNumber || ''
          console.log('[wix webhook] tracking:', tracking)
        }
      } catch {}
    }

    // Use the potentially updated event
    const finalEvent = String((req.query as any).event || event)

    const message = buildMessage(finalEvent, {
      customer_name:   buyerName,
      order_id:        String(orderNum),
      total,
      tracking_number: tracking,
      checkout_url:    checkoutUrl,
    }, templates)

    if (!message) { console.log('[wix webhook] no message for:', finalEvent); return }

    // Send
    const isWAWeb = (instance.instance_type || instance.type) === 'wa_web'
    let waMessageId = ''
    if (isWAWeb) {
      const r = await smartSendWAWeb({ userId: userId, instanceId: instance.id, to: phone, text: message })
      waMessageId = r?.messageId || ''
    } else {
      const r = await smartSend({ userId: userId, instanceId: instance?.id || '', phoneNumberId: instance.phone_number_id, accessToken: instance.access_token, to: phone, text: message, forceTemplate: false })
      waMessageId = r?.messageId || ''
    }

    await db.from('messages').insert({
      id: uuidv4(), user_id: userId, instance_id: instance.id,
      direction: 'outbound', type: 'text', content: message,
      wa_message_id: waMessageId, status: 'sent',
    })
    console.log('[wix webhook] ✅ sent to', phone, 'event:', finalEvent)

  } catch (err) {
    console.error('[wix webhook] error:', err)
  }
}

function buildMessage(event: string, d: Record<string, string>, custom: Record<string, string>): string {
  if (custom[event]) return Object.entries(d).reduce((t, [k, v]) => t.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v), custom[event])
  const msgs: Record<string, string> = {
    order_placed:    `🛒 Order Confirmed!\n\nHi ${d.customer_name}, your order #${d.order_id} has been placed.\n💰 Total: ${d.total}\n\nThank you! 🙏`,
    order_paid:      `✅ Payment Received!\n\nHi ${d.customer_name}, payment for order #${d.order_id} confirmed.\n💰 ${d.total}`,
    order_shipped:   `🚚 Order Shipped!\n\nHi ${d.customer_name}, order #${d.order_id} is on its way!${d.tracking_number ? '\n📦 Track: ' + d.tracking_number : ''}`,
    order_cancelled: `❌ Order Cancelled\n\nHi ${d.customer_name}, order #${d.order_id} has been cancelled.`,
    order_refunded:  `💰 Refund Processed\n\nHi ${d.customer_name}, your refund for order #${d.order_id} has been processed.`,
    abandoned_cart:  `🛒 You left something behind!\n\nHi ${d.customer_name}, you have items waiting in your cart.\n\n💡 Complete your purchase now!\n\n🔗 ${d.checkout_url || ''}`,
    cart_recovered:  `🎉 Welcome back!\n\nHi ${d.customer_name}, your order #${d.order_id} has been completed. Thank you! 🙏`,
    back_in_stock:   `📦 Good news, ${d.customer_name}!\n\nA product you were waiting for is back in stock. Order now! 🛒`,
  }
  return msgs[event] || ''
}
