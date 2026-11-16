import { smartSend, smartSendWAWeb, resolveProvider } from '@/lib/wa-smart-send'
import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyWixWebhook, decodeUnverifiedWixWebhook, isWixPublicKeyConfigured } from '@/lib/wix-auth'
import { readRawBody, withTimeout } from '@/lib/raw-body'
import {
  unwrapWixWebhook, classifyWixEvent, pickWixLanguage, buildWixMessage, cleanPhone, isInternationalPhone,
  ecomOrderFromPayload, ecomOrderId, abandonedCheckoutFromPayload, decideEcomEvent, buildEcomNotice, ecomChargeback,
  bookingFromPayload, bookingStart, bookingRescheduled, buildBookingNotice,
  eventsPayload, eventInfoFromPayload, buildEventsNotice, buildRestaurantNotice,
  planOrderFromPayload, buildSitePlanNotice,
  type WixEnvelope, type WixLang, type WixParse, type WixRoute,
} from '@/lib/wix-events'
import { createWixApiClient, fetchWixContact, fetchWixMemberContact, fetchWixEventInfo, fetchWixSiteLanguage, type WixApiClient } from '@/lib/wix-api'

export const config = { api: { bodyParser: false } }

// Wix needs a timely answer; the work (incl. order fetch retries) is bounded.
const PROCESSING_BUDGET_MS = 8000

type DB = ReturnType<typeof supabaseAdmin>
type Obj = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

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

  // Never 500: unknown events and processing errors are logged and acknowledged.
  await withTimeout(processWixEvent(String(req.query.event || ''), jwt).catch(err => console.error('[wix webhook] error:', err)), PROCESSING_BUDGET_MS, undefined)
  return res.status(200).json({ received: true })
}

interface Ctx {
  db: DB
  env: WixEnvelope
  api: WixApiClient
  lang: () => Promise<WixLang>
}

async function processWixEvent(queryEvent: string, jwt: Record<string, any>): Promise<void> {
  const env = unwrapWixWebhook(jwt)
  const route = classifyWixEvent(queryEvent, env)
  console.log('[wix webhook] instanceId:', env.instanceId, 'event:', queryEvent, 'route:', route?.event || '-', 'wixType:', env.eventType || '-', 'entity:', env.entityId || '-')

  if (!route) {
    console.log('[wix webhook] unsupported event — ignored:', queryEvent || '(none)', env.eventType || '')
    return
  }
  if (!env.instanceId) return

  const db = supabaseAdmin()

  // Find user
  const { data: link } = await db.from('wix_user_links').select('user_id').eq('wix_instance_id', env.instanceId).maybeSingle()
  if (!link?.user_id) { console.log('[wix webhook] no user for instance:', env.instanceId); return }
  const userId = link.user_id as string

  // Installation ('*': status/removed_at exist only after migration 034)
  const { data: install } = await db.from('wix_installations').select('*').eq('wix_instance_id', env.instanceId).maybeSingle()
  if (install?.status === 'removed') { console.log('[wix webhook] app removed from this site — skip', env.instanceId); return }

  const api = createWixApiClient({ instanceId: env.instanceId, storedToken: install?.access_token, metaSiteId: install?.meta_site_id })

  // Settings: texts (per user wins over the older per-instance ones) + on/off flags
  const { data: tplRows } = await db.from('system_settings').select('key, value')
    .in('key', [`wix_templates_${userId}`, `wix_templates_${env.instanceId}`, `wix_notify_enabled_${userId}`])
  const byKey = new Map((tplRows || []).map(r => [r.key as string, (r.value || {}) as Record<string, string>]))
  const enabledFlags = (byKey.get(`wix_notify_enabled_${userId}`) || {}) as Record<string, unknown>
  const templates: Record<string, string> = {
    ...(byKey.get(`wix_templates_${env.instanceId}`) || {}),
    ...Object.fromEntries(Object.entries(byKey.get(`wix_templates_${userId}`) || {}).filter(([, v]) => typeof v === 'string' && v.trim())),
  }

  // Merchant row (language, own phone) — loaded once, lazily.
  let userRowP: Promise<Obj | null> | null = null
  const userRow = () => (userRowP ||= Promise.resolve(db.from('users').select('language, phone').eq('id', userId).maybeSingle()).then(r => (r.data as Obj) || null))
  let langP: Promise<WixLang> | null = null
  const lang = () => (langP ||= (async () => {
    const u = await userRow()
    const siteLang = u?.language ? '' : await fetchWixSiteLanguage(api)
    return pickWixLanguage(u?.language, siteLang)
  })())

  const ctx: Ctx = { db, env, api, lang }
  const isOn = (event: string) => enabledFlags[event] !== false

  // Early exit for a switched-off event (avoids API calls). order_updated is
  // remapped later, so it is checked after its real event is known.
  if (route.event !== 'order_updated' && route.event !== 'booking_created' && !isOn(route.event)) {
    console.log('[wix webhook] event disabled by user — skip', route.event)
    return
  }

  const parsed = await parseRoute(route, queryEvent, ctx)
  if (!parsed.ok) { console.log('[wix webhook] skip:', route.event, '—', parsed.skip); return }
  const n = parsed.notice

  // Turned off in the dashboard → no message (missing flag = on).
  if (!isOn(n.event)) { console.log('[wix webhook] event disabled by user — skip', n.event); return }

  // Recipient
  let to = ''
  if (n.audience === 'merchant') {
    // Chargebacks go to the merchant only — never to the customer.
    to = await merchantPhone(db, userId, await userRow())
    if (!to) { console.log('[wix webhook] no merchant phone (users.phone / WhatsApp number) for', n.event, '— skip'); return }
  } else {
    to = n.phone
    if ((!to || !isInternationalPhone(n.rawPhone)) && (n.contactId || n.memberId)) {
      const c = n.contactId ? await fetchWixContact(api, n.contactId) : await fetchWixMemberContact(api, n.memberId)
      if (c?.phone) to = cleanPhone(c.phone)
      if (!n.vars.customer_name && c?.firstName) n.vars.customer_name = c.firstName
    }
    if (!to) { console.log('[wix webhook] no phone for', n.event, n.dedupeId, '— skip'); return }
  }

  // Get WhatsApp instance
  const { data: instances } = await db.from('whatsapp_instances').select('*').eq('user_id', userId).order('created_at', { ascending: true })
  const instance = instances?.find(i => i.status === 'connected' && i.is_default)
                || instances?.find(i => i.status === 'connected')
                || instances?.[0]
  if (!instance) { console.log('[wix webhook] no WA instance for:', userId); return }

  const message = buildWixMessage(n.event, await lang(), n.vars, templates)
  if (!message) { console.log('[wix webhook] no message for:', n.event); return }

  // Deduplication — keyed by the FINAL (remapped) event + entity, e.g.
  // order_placed vs order_shipped for the same order are different
  // notifications; both Order Transactions webhooks → one order_paid.
  // Claimed atomically (insert) so concurrent deliveries send once.
  const dedupeKey = `wix_sent_${n.dedupeId}_${n.event}`
  if (!(await claimOnce(db, dedupeKey))) { console.log('[wix webhook] duplicate — skip', dedupeKey); return }

  // Send (smartSend / smartSendWAWeb insert the outbound message row)
  const r = resolveProvider(instance) === 'wa_web'
    ? await smartSendWAWeb({ userId, instanceId: instance.id, to, text: message, source: 'notification' })
    : await smartSend({ userId, instanceId: instance.id, phoneNumberId: instance.phone_number_id, accessToken: instance.access_token, to, text: message, forceTemplate: false, source: 'notification' })
  if (r.error) {
    console.log('[wix webhook] send failed:', r.error)
    // Let a later delivery (e.g. the second Order Transactions webhook) retry.
    await db.from('system_settings').delete().eq('key', dedupeKey)
    return
  }
  console.log('[wix webhook] ✅ sent to', to, 'event:', n.event)
}

async function parseRoute(route: WixRoute, queryEvent: string, ctx: Ctx): Promise<WixParse> {
  switch (route.group) {
    case 'ecommerce':     return parseEcommerce(route.event, queryEvent, ctx)
    case 'bookings':      return parseBooking(route.event, ctx)
    case 'events': {
      const p = eventsPayload(ctx.env)
      const info = eventInfoFromPayload(p) || (p?.eventId ? await fetchWixEventInfo(ctx.api, String(p.eventId)) : null)
      return buildEventsNotice(route.event, p, info, await ctx.lang())
    }
    case 'restaurants':   return buildRestaurantNotice(route.event, ctx.env)
    case 'pricing_plans': return buildSitePlanNotice(route.event, planOrderFromPayload(ctx.env), await ctx.lang())
  }
}

async function parseEcommerce(event: string, queryEvent: string, { env, api }: Ctx): Promise<WixParse> {
  if (event === 'abandoned_cart') {
    const checkout = abandonedCheckoutFromPayload(env)
    const d = decideEcomEvent('abandoned_cart', checkout, env)
    if ('skip' in d) return { ok: false, skip: d.skip }
    return buildEcomNotice('abandoned_cart', checkout, { orderId: String(checkout?.id || env.entityId || '') })
  }

  const orderId = ecomOrderId(env)
  let order = ecomOrderFromPayload(env)

  if (order) {
    console.log('[wix webhook] using JWT order data ✅')
  } else if (orderId && api.canCall()) {
    // order_placed needs retry — order may not be ready in API yet
    const maxAttempts = queryEvent === 'order_placed' ? 3 : 1
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 2000))
      const r = await api.get(`/ecom/v1/orders/${encodeURIComponent(orderId)}`)
      console.log(`[wix webhook] order fetch attempt ${attempt + 1}:`, r.status)
      if (r.ok) { order = (r.data?.order || r.data || {}) as Obj; break }
      console.log('[wix webhook] order error:', JSON.stringify(r.data || {}).slice(0, 200))
      if (r.status !== 404) break
    }
  }

  const d = decideEcomEvent(event, order, env)
  if ('skip' in d) return { ok: false, skip: d.skip }
  const finalEvent = d.event
  if (finalEvent !== event) console.log('[wix webhook]', event, '→ treating as', finalEvent)

  // Fetch tracking from fulfillments API
  let tracking = ''
  if (finalEvent === 'order_shipped' && orderId && api.canCall()) {
    const f = await api.get(`/ecom/v1/fulfillments/orders/${encodeURIComponent(orderId)}/list`)
    console.log('[wix webhook] fulfillments status:', f.status)
    const f0 = f.ok ? f.data?.fulfillments?.[0] : null
    tracking = f0?.trackingInfo?.trackingLink || f0?.trackingInfo?.trackingNumber || ''
  }

  const chargeback = finalEvent === 'order_chargeback' || finalEvent === 'order_chargeback_reversed'
    ? ecomChargeback(env, finalEvent === 'order_chargeback' ? 'APPROVED' : 'REVERSED', order?.currency)
    : undefined

  return buildEcomNotice(finalEvent, order, { orderId, tracking, chargeback })
}

async function parseBooking(event: string, { db, env, lang }: Ctx): Promise<WixParse> {
  const booking = bookingFromPayload(env)
  const parsed = buildBookingNotice(event, booking, await lang())
  const id = String(booking?.id || '')
  const start = bookingStart(booking)
  if (!parsed.ok || !id || !start) return parsed

  // Remember the last start we saw, so Booking Updated can tell a
  // reschedule from noise (status/notes/payment updates).
  const startKey = `wix_booking_start_${id}`
  let previous: string | null = bookingStart(env.previousEntity) || null
  if (event === 'booking_updated' && !previous) {
    const { data } = await db.from('system_settings').select('value').eq('key', startKey).maybeSingle()
    previous = (data?.value as Obj | null)?.start || null
  }
  await db.from('system_settings').upsert({ key: startKey, value: { start }, updated_at: new Date().toISOString() }, { onConflict: 'key' })

  if (event === 'booking_updated') {
    const modified = env.modifiedFields ? Object.keys(env.modifiedFields) : []
    const touchedSchedule = modified.some(k => /startDate|endDate|slot/i.test(k))
    if (!bookingRescheduled(start, previous) && !(touchedSchedule && previous === null)) {
      return { ok: false, skip: previous ? 'booking_updated without a date/time change' : 'booking_updated — previous start unknown, not treated as a reschedule' }
    }
  }
  return parsed
}

/** The merchant's own WhatsApp-reachable number: profile phone, else their WhatsApp number. */
async function merchantPhone(db: DB, userId: string, user: Obj | null): Promise<string> {
  const own = cleanPhone(user?.phone)
  if (own) return own
  const { data: inst } = await db.from('whatsapp_instances').select('phone_number, status, is_default')
    .eq('user_id', userId).order('created_at', { ascending: true }).limit(10)
  const pick = inst?.find(i => i.status === 'connected' && i.is_default) || inst?.find(i => i.status === 'connected') || inst?.[0]
  return cleanPhone(pick?.phone_number)
}

/** Atomically claim a one-time key in system_settings; false if already claimed. */
async function claimOnce(db: DB, key: string): Promise<boolean> {
  const now = new Date().toISOString()
  const { error } = await db.from('system_settings').insert({ key, value: { ts: now }, updated_at: now })
  if (!error) return true
  if (error.code === '23505') return false
  // Unexpected insert error: fall back to check-then-set (previous behaviour).
  console.log('[wix webhook] dedupe insert failed, falling back:', error.message)
  const { data: already } = await db.from('system_settings').select('key').eq('key', key).maybeSingle()
  if (already) return false
  await db.from('system_settings').upsert({ key, value: { ts: now }, updated_at: now }, { onConflict: 'key' })
  return true
}
