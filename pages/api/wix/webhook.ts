import { smartSend, smartSendWAWeb, resolveProvider } from '@/lib/wa-smart-send'
import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyWixWebhook, parseMaybeJson, decodeUnverifiedWixWebhook, isWixPublicKeyConfigured } from '@/lib/wix-auth'
import { readRawBody, withTimeout } from '@/lib/raw-body'
import { requireEnv } from '@/lib/security'

export const config = { api: { bodyParser: false } }

// Wix needs a timely answer; the work (incl. order fetch retries) is bounded.
const PROCESSING_BUDGET_MS = 8000

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  let rawBody: string
  try {
    rawBody = (await readRawBody(req, 1024 * 1024)).toString('utf8')
  } catch {
    return res.status(413).json({ error: 'Payload too large' })
  }
  if (!rawBody) return res.status(400).json({ error: 'Empty body' })

  // Wix app webhooks are RS256 JWTs signed by Wix — verify before trusting
  // anything. While WIX_PUBLIC_KEY is not configured (or unusable), ORDER
  // notifications are still processed unverified, as the previous code did,
  // so merchants keep getting them. (Billing stays fail-closed.)
  let jwt: Record<string, any> | null
  try {
    jwt = await verifyWixWebhook(rawBody) as Record<string, any> | null
  } catch (e) {
    console.error('[wix webhook] ⚠️ SECURITY: WIX_PUBLIC_KEY missing/invalid — accepting UNVERIFIED order webhook. Set WIX_PUBLIC_KEY now.', isWixPublicKeyConfigured() ? (e as Error).message : '')
    jwt = decodeUnverifiedWixWebhook(rawBody) as Record<string, any> | null
    if (!jwt) return res.status(400).json({ error: 'Invalid body' })
  }
  if (!jwt) {
    console.error('[wix webhook] invalid signature — rejected')
    return res.status(401).json({ error: 'Invalid signature' })
  }

  await withTimeout(processOrderEvent(req, jwt), PROCESSING_BUDGET_MS, undefined)
  return res.status(200).json({ received: true })
}

async function processOrderEvent(req: NextApiRequest, jwt: Record<string, any>): Promise<void> {
  try {
    const event = req.query.event as string || ''

    let instanceId   = String(jwt.instanceId || jwt.appInstanceId || '')
    let orderId      = ''
    let jwtOrderData: Record<string, unknown> | null = null

    const d1 = parseMaybeJson(jwt.data)
    if (d1) {
      // instanceId for order webhooks lives one level down, inside the
      // first-decoded `data` field — not at the JWT root.
      if (!instanceId) instanceId = String(d1.instanceId || d1.metaSiteId || d1.siteId || '')
      orderId  = String(d1.entityId || d1.id || d1.orderId || '')

      const d2 = parseMaybeJson(d1.data)
      if (d2) {
        if (!orderId) orderId = String(d2.entityId || d2.id || d2.orderId || '')
        if (!instanceId) instanceId = String(d2.instanceId || d2.metaSiteId || d2.siteId || '')
        if (d2.updatedEvent?.currentEntity) jwtOrderData = d2.updatedEvent.currentEntity
        else if (d2.createdEvent?.entity)   jwtOrderData = d2.createdEvent.entity
        else if (d2.entity)                 jwtOrderData = d2.entity
      }

      if (!jwtOrderData) {
        if (d1.updatedEvent?.currentEntity) jwtOrderData = d1.updatedEvent.currentEntity
        else if (d1.createdEvent?.entity)   jwtOrderData = d1.createdEvent.entity
        else if (d1.entity)                 jwtOrderData = d1.entity
      }
    }

    console.log('[wix webhook] instanceId:', instanceId, 'orderId:', orderId, 'event:', event, 'hasJWT:', !!jwtOrderData)

    if (!instanceId) return

    const db = supabaseAdmin()

    // Find user
    const { data: link } = await db.from('wix_user_links').select('user_id').eq('wix_instance_id', instanceId).maybeSingle()
    if (!link?.user_id) { console.log('[wix webhook] no user for instance:', instanceId); return }
    const userId = link.user_id

    // Get installation
    const { data: install } = await db.from('wix_installations').select('access_token, meta_site_id').eq('wix_instance_id', instanceId).maybeSingle()
    let accessToken  = install?.access_token || ''
    const metaSiteId = install?.meta_site_id || ''

    // Get token if needed
    if (!accessToken && (!process.env.WIX_APP_ID || !process.env.WIX_APP_SECRET)) {
      console.error('[wix webhook] Wix app not configured (WIX_APP_ID / WIX_APP_SECRET) — using the order data in the webhook only')
    } else if (!accessToken) {
      try {
        const tokenRes = await fetch('https://www.wixapis.com/oauth2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grant_type:    'client_credentials',
            client_id:     requireEnv('WIX_APP_ID'),
            client_secret: requireEnv('WIX_APP_SECRET'),
            instance_id:   instanceId,
          }),
        })
        const td = await tokenRes.json()
        accessToken = td.access_token || ''
        console.log('[wix webhook] token status:', tokenRes.status, 'hasToken:', !!accessToken)
      } catch (e) { console.log('[wix webhook] token error:', (e as Error)?.message) }
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
      const maxAttempts = event === 'order_placed' ? 3 : 1
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 2000))
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
      const status            = String((orderData as any)?.status || '').toUpperCase()
      const fulfillmentStatus = String((orderData as any)?.fulfillmentStatus || '').toUpperCase()
      const paymentStatus     = String((orderData as any)?.paymentStatus || '').toUpperCase()
      const isRefunded    = ['REFUNDED', 'PARTIALLY_REFUNDED'].includes(paymentStatus)
      const isCancelled   = ['CANCELED', 'CANCELLED'].includes(status)
      const isNew         = ['INITIALIZED', 'APPROVED', 'NEW'].includes(status)
      const isShipped     = ['FULFILLED', 'PARTIALLY_FULFILLED'].includes(fulfillmentStatus)

      if (isCancelled || isRefunded) {
        // Will be handled as order_cancelled below
      } else if (isShipped) {
        // Order marked as fulfilled/shipped — Wix sends this as
        // order_updated with fulfillmentStatus changed, NOT order.status.
        // Previously this fell into the "else" branch below and was
        // silently skipped — no shipping notification was ever sent.
        console.log('[wix webhook] order_updated with fulfillmentStatus:', fulfillmentStatus, '— treating as order_shipped')
        ;(req.query as any).event = 'order_shipped'
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
    // Custom texts: the dashboard saves them per WABEK user
    // (wix_templates_<userId>); older rows / the Wix panel per Wix instance
    // (wix_templates_<instanceId>). The user's own texts win per event.
    const { data: tplRows } = await db.from('system_settings').select('key, value')
      .in('key', [`wix_templates_${userId}`, `wix_templates_${instanceId}`])
    const byKey = new Map((tplRows || []).map(r => [r.key as string, (r.value || {}) as Record<string, string>]))
    const templates: Record<string, string> = {
      ...(byKey.get(`wix_templates_${instanceId}`) || {}),
      ...Object.fromEntries(Object.entries(byKey.get(`wix_templates_${userId}`) || {}).filter(([, v]) => typeof v === 'string' && v.trim())),
    }

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

    // Deduplication — keyed by the FINAL (remapped) event, e.g.
    // order_placed vs order_shipped for the same orderId are different
    // notifications and must NOT share a dedupe key.
    if (orderId) {
      const dedupeKey = `wix_sent_${orderId}_${finalEvent}`
      const { data: already } = await db.from('system_settings').select('key').eq('key', dedupeKey).maybeSingle()
      if (already) { console.log('[wix webhook] duplicate — skip', dedupeKey); return }
      await db.from('system_settings').upsert({
        key: dedupeKey, value: { ts: new Date().toISOString() }, updated_at: new Date().toISOString(),
      }, { onConflict: 'key' })
    }

    const message = buildMessage(finalEvent, {
      customer_name:   buyerName,
      order_id:        String(orderNum),
      total,
      tracking_number: tracking,
      checkout_url:    checkoutUrl,
    }, templates)

    if (!message) { console.log('[wix webhook] no message for:', finalEvent); return }

    // Send (smartSend / smartSendWAWeb insert the outbound message row)
    const r = resolveProvider(instance) === 'wa_web'
      ? await smartSendWAWeb({ userId, instanceId: instance.id, to: phone, text: message, source: 'notification' })
      : await smartSend({ userId, instanceId: instance.id, phoneNumberId: instance.phone_number_id, accessToken: instance.access_token, to: phone, text: message, forceTemplate: false, source: 'notification' })
    if (r.error) { console.log('[wix webhook] send failed:', r.error); return }
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
