#!/usr/bin/env node
// Manual check of the Wix webhook parsing (lib/wix-events.ts). Not run in CI.
//
//   node scripts/wix-events-check.mjs          # Arabic texts (default)
//   node scripts/wix-events-check.mjs en       # English texts
//
// Builds a sample payload per configured Wix webhook (double-encoded like the
// real JWT body: root.data = JSON string, .data = JSON string of the domain
// event), runs the same pure steps as /api/wix/webhook, and prints the
// extracted { event, phone, name, message } — or why it is skipped. Wix API
// calls (order fetch, contacts, events) are replaced by the fixtures below.
// Needs Node >= 22.18 (TypeScript type stripping) — or falls back to jiti.

process.removeAllListeners('warning') // "module type not specified" noise from importing .ts

let W
try {
  W = await import('../lib/wix-events.ts')
} catch {
  const { default: createJiti } = await import('jiti')
  W = createJiti(import.meta.url)('../lib/wix-events.ts')
}

const LANG = process.argv[2] === 'en' ? 'en' : 'ar'
const INSTANCE = 'inst-1111'

// ── Fixtures standing in for Wix REST API answers ─────────────────────────
const ecomOrder = (over = {}) => ({
  id: 'ord-aaaa-bbbb', number: '10042', status: 'APPROVED', paymentStatus: 'PAID', fulfillmentStatus: 'NOT_FULFILLED',
  currency: 'SAR', buyerInfo: { contactId: 'ct-1', email: 'sara@example.com' },
  billingInfo: { contactDetails: { firstName: 'Sara', lastName: 'Ali', phone: '+966 50 123 4567' } },
  priceSummary: { total: { amount: '250.00', formattedAmount: 'SAR 250.00' } },
  lineItems: [{ productName: { original: 'Abaya' }, quantity: 1 }],
  ...over,
})
const API = {
  orders: { 'ord-aaaa-bbbb': ecomOrder(), 'ord-unpaid': ecomOrder({ id: 'ord-unpaid', number: '10043', paymentStatus: 'NOT_PAID' }) },
  contacts: { 'ct-77': { info: { name: { first: 'Omar' }, phones: { items: [{ phone: '0501112222', e164Phone: '+971501112222', primary: true }] } } } },
  events: { 'ev-1': { title: 'Riyadh Design Week', startDate: '2026-12-03T16:00:00Z', timeZone: 'Asia/Riyadh' } },
}

// ── Payload builders ──────────────────────────────────────────────────────
const jwt = (eventType, domain) => ({
  data: JSON.stringify({ eventType, instanceId: INSTANCE, data: JSON.stringify(domain) }),
})
const created = (fqdn, entity) => ({ id: 'evt-' + Math.random().toString(36).slice(2), entityFqdn: fqdn, slug: 'created', entityId: entity.id, createdEvent: { entity } })
const updated = (fqdn, entity, extra = {}) => ({ id: 'evt-x', entityFqdn: fqdn, slug: 'updated', entityId: entity.id, updatedEvent: { currentEntity: entity, ...extra } })
const action = (fqdn, slug, entityId, body) => ({ id: 'evt-y', entityFqdn: fqdn, slug, entityId, actionEvent: { body } })

const booking = (over = {}) => ({
  id: 'bk-1', status: 'PENDING', startDate: '2026-11-20T09:30:00Z', endDate: '2026-11-20T10:30:00Z',
  contactDetails: { contactId: 'ct-9', firstName: 'Lina', lastName: 'H', phone: '+962791234567', timeZone: 'Asia/Amman' },
  bookedEntity: { title: 'Haircut & Styling', slot: { startDate: '2026-11-20T09:30:00Z', timezone: 'Asia/Amman' } },
  ...over,
})

const transactions = (orderId, status, extra = {}) => ({
  orderTransactions: { orderId, payments: [{ id: 'pay-1', amount: { amount: '250.00' }, regularPaymentDetails: { status, ...extra } }] },
})

const CASES = [
  // eCommerce
  ['order_placed', 'eCommerce / Order Approved', jwt('wix.ecom.v1.order_approved', action('wix.ecom.v1.order', 'approved', 'ord-aaaa-bbbb', { order: ecomOrder() }))],
  ['order_paid', 'eCommerce / Order Transactions Updated (APPROVED)', jwt('wix.ecom.payments.v1.order_transactions_updated', action('wix.ecom.payments.v1.order_transactions', 'transactions_updated', 'ord-aaaa-bbbb', transactions('ord-aaaa-bbbb', 'APPROVED')))],
  ['order_paid', 'eCommerce / Order Transactions Details Updated (same order → dedupe)', jwt('wix.ecom.payments.v1.order_transactions_details_updated', action('wix.ecom.payments.v1.order_transactions', 'details_updated', 'ord-aaaa-bbbb', transactions('ord-aaaa-bbbb', 'APPROVED')))],
  ['order_paid', 'eCommerce / Order Transactions Updated (PENDING, order NOT_PAID)', jwt('wix.ecom.payments.v1.order_transactions_updated', action('wix.ecom.payments.v1.order_transactions', 'transactions_updated', 'ord-unpaid', transactions('ord-unpaid', 'PENDING')))],
  ['order_shipped', 'eCommerce / Fulfillment Status Updated', jwt('wix.ecom.v1.order_fulfillment_status_updated', action('wix.ecom.v1.order', 'fulfillment_status_updated', 'ord-aaaa-bbbb', { order: ecomOrder({ fulfillmentStatus: 'FULFILLED' }) }))],
  ['order_updated', 'eCommerce / Order Updated (legacy, fulfilled → order_shipped)', jwt('wix.ecom.v1.order_updated', updated('wix.ecom.v1.order', ecomOrder({ fulfillmentStatus: 'FULFILLED' })))],
  ['order_cancelled', 'eCommerce / Order Canceled', jwt('wix.ecom.v1.order_canceled', action('wix.ecom.v1.order', 'canceled', 'ord-aaaa-bbbb', { order: ecomOrder({ status: 'CANCELED' }) }))],
  ['order_refunded', 'eCommerce / Order Transactions Refund Completed', jwt('wix.ecom.payments.v1.refund_completed', action('wix.ecom.payments.v1.order_transactions', 'refund_completed', 'ord-aaaa-bbbb', { orderId: 'ord-aaaa-bbbb', refundId: 'rf-1' }))],
  ['order_chargeback', 'eCommerce / Order Transactions Chargeback Approved', jwt('wix.ecom.payments.v1.chargeback_approved', action('wix.ecom.payments.v1.order_transactions', 'chargeback_approved', 'ord-aaaa-bbbb', transactions('ord-aaaa-bbbb', 'APPROVED', { chargebacks: [{ id: 'cb-1', status: 'APPROVED', amount: { amount: '250.00', formattedAmount: 'SAR 250.00' }, createdDate: '2026-11-10T00:00:00Z' }] })))],
  ['order_chargeback_reversed', 'eCommerce / Order Transactions Chargeback Reversed', jwt('wix.ecom.payments.v1.chargeback_reversed', action('wix.ecom.payments.v1.order_transactions', 'chargeback_reversed', 'ord-aaaa-bbbb', { orderId: 'ord-aaaa-bbbb', chargeback: { id: 'cb-1', status: 'REVERSED', amount: { amount: '250.00', currency: 'SAR' } } }))],
  ['abandoned_cart', 'eCommerce / Abandoned Checkout Created', jwt('wix.ecom.v1.abandoned_checkout_created', created('wix.ecom.v1.abandoned_checkout', { id: 'ac-1', status: 'ABANDONED', checkoutUrl: 'https://shop.example.com/checkout?id=ac-1', buyerInfo: { contactId: 'ct-77' }, contactDetails: { firstName: 'Omar' }, totalPrice: { amount: '99', formattedAmount: 'AED 99.00' } }))],
  // Bookings
  ['booking_created', 'Bookings / Booking Created (pending)', jwt('wix.bookings.v2.booking_created', created('wix.bookings.v2.booking', booking()))],
  ['booking_created', 'Bookings / Booking Created (auto-confirmed → booking_confirmed)', jwt('wix.bookings.v2.booking_created', created('wix.bookings.v2.booking', booking({ id: 'bk-2', status: 'CONFIRMED' })))],
  ['booking_confirmed', 'Bookings / Booking Confirmed (for the auto-confirmed bk-2 → dedupe)', jwt('wix.bookings.v2.booking_confirmed', action('wix.bookings.v2.booking', 'confirmed', 'bk-2', { booking: booking({ id: 'bk-2', status: 'CONFIRMED' }) }))],
  ['booking_confirmed', 'Bookings / Booking Confirmed', jwt('wix.bookings.v2.booking_confirmed', action('wix.bookings.v2.booking', 'confirmed', 'bk-1', { booking: booking({ status: 'CONFIRMED' }) }))],
  ['booking_cancelled', 'Bookings / Booking Canceled', jwt('wix.bookings.v2.booking_canceled', action('wix.bookings.v2.booking', 'canceled', 'bk-1', { booking: booking({ status: 'CANCELED' }) }))],
  ['booking_updated', 'Bookings / Booking Updated (rescheduled)', jwt('wix.bookings.v2.booking_updated', updated('wix.bookings.v2.booking', booking({ status: 'CONFIRMED', startDate: '2026-11-22T13:00:00Z' })))],
  ['booking_updated', 'Bookings / Booking Updated (notes only → skip)', jwt('wix.bookings.v2.booking_updated', updated('wix.bookings.v2.booking', booking({ status: 'CONFIRMED', startDate: '2026-11-22T13:00:00Z' })))],
  // Events (legacy flat payloads)
  ['event_registered', 'Events / RSVP Created', jwt('wix.events.rsvp_created', { timestamp: '2026-11-16T10:00:00Z', eventId: 'ev-1', rsvpId: 'rsvp-1', contactId: 'ct-77', firstName: 'Omar', lastName: 'K', email: 'o@example.com', rsvpStatus: 'YES', form: { inputValues: [{ inputName: 'phone', value: '+971 50 999 8888' }] } })],
  ['event_ticket_purchased', 'Events / Order Confirmed', jwt('wix.events.ticketing.order_confirmed', { eventId: 'ev-1', orderNumber: 'T7Q2-91', contactId: 'ct-77', firstName: 'Omar', status: 'PAID', invoice: { grandTotal: { amount: '120.00', currency: 'AED' } }, tickets: [{ number: 'T1' }, { number: 'T2' }] })],
  // Restaurants
  ['restaurant_order_accepted', 'Restaurants / Order Accepted', jwt('wix.restaurants.orders.order_accepted', { order: { id: 'r-55', status: 'ACCEPTED', contact: { firstName: 'Yousef', phone: '+201001234567' }, totals: { total: '185.50' }, currency: 'EGP', fulfillment: { type: 'DELIVERY' } } })],
  ['order_shipped', 'Restaurants / Order Fulfilled (→ restaurant_order_fulfilled)', jwt('', { order: { id: 'r-55', status: 'FULFILLED', contact: { firstName: 'Yousef', phone: '+201001234567' }, totals: { total: '185.50' }, currency: 'EGP', fulfillment: { type: 'PICKUP' } } })],
  // Pricing Plans (site plans)
  ['plan_purchased', 'Pricing Plans / Order Created (→ site_plan_purchased)', jwt('wix.pricing_plans.v2.order_created', created('wix.pricing_plans.v2.order', { id: 'po-1', planId: 'pl-1', planName: 'Gold Membership', status: 'ACTIVE', buyer: { contactId: 'ct-77', memberId: 'm-1' }, priceDetails: { total: '49.00', currency: 'USD' }, startDate: '2026-11-16T00:00:00Z' }))],
  ['plan_purchased', 'Pricing Plans / Order Created (DRAFT → skip)', jwt('wix.pricing_plans.v2.order_created', created('wix.pricing_plans.v2.order', { id: 'po-2', planName: 'Gold Membership', status: 'DRAFT', buyer: { contactId: 'ct-77' } }))],
  ['plan_cancelled', 'Pricing Plans / Order Canceled (→ site_plan_cancelled)', jwt('wix.pricing_plans.v2.order_canceled', action('wix.pricing_plans.v2.order', 'canceled', 'po-1', { order: { id: 'po-1', planName: 'Gold Membership', status: 'CANCELED', buyer: { contactId: 'ct-77' }, endDate: '2026-12-16T00:00:00Z' } }))],
  // Unknown
  ['coupon_used', 'unsupported ?event= value', jwt('wix.marketing.v1.coupon_used', { id: 'x' })],
]

// ── Same steps as pages/api/wix/webhook.ts (API calls → fixtures) ─────────
const sent = new Set()
const bookingStarts = new Map([['bk-1', '2026-11-20T09:30:00Z']])

function run(queryEvent, payload) {
  const env = W.unwrapWixWebhook(payload)
  const route = W.classifyWixEvent(queryEvent, env)
  if (!route) return { skip: `unsupported event "${queryEvent}" → 200 + log` }
  let parsed
  switch (route.group) {
    case 'ecommerce': {
      if (route.event === 'abandoned_cart') {
        const co = W.abandonedCheckoutFromPayload(env)
        const d = W.decideEcomEvent('abandoned_cart', co, env)
        parsed = 'skip' in d ? { ok: false, skip: d.skip } : W.buildEcomNotice('abandoned_cart', co, { orderId: co?.id || env.entityId })
        break
      }
      const orderId = W.ecomOrderId(env)
      const order = W.ecomOrderFromPayload(env) || API.orders[orderId] || null
      const d = W.decideEcomEvent(route.event, order, env)
      if ('skip' in d) { parsed = { ok: false, skip: d.skip }; break }
      const cb = d.event.startsWith('order_chargeback') ? W.ecomChargeback(env, d.event === 'order_chargeback' ? 'APPROVED' : 'REVERSED', order?.currency) : undefined
      parsed = W.buildEcomNotice(d.event, order, { orderId, tracking: d.event === 'order_shipped' ? 'https://track.example.com/XY123' : '', chargeback: cb })
      break
    }
    case 'bookings': {
      const b = W.bookingFromPayload(env)
      parsed = W.buildBookingNotice(route.event, b, LANG)
      if (parsed.ok && route.event === 'booking_updated') {
        const prev = bookingStarts.get(b.id)
        if (!W.bookingRescheduled(W.bookingStart(b), prev)) parsed = { ok: false, skip: 'booking_updated without a date/time change' }
      }
      if (b?.id) bookingStarts.set(b.id, W.bookingStart(b))
      break
    }
    case 'events': {
      const p = W.eventsPayload(env)
      parsed = W.buildEventsNotice(route.event, p, W.eventInfoFromPayload(p) || API.events[p?.eventId] || null, LANG)
      break
    }
    case 'restaurants': parsed = W.buildRestaurantNotice(route.event, env); break
    case 'pricing_plans': parsed = W.buildSitePlanNotice(route.event, W.planOrderFromPayload(env), LANG); break
  }
  if (!parsed.ok) return { route: route.event, skip: parsed.skip }
  const n = parsed.notice
  let phone = n.phone
  let lookedUp = ''
  if (n.audience === 'merchant') { phone = '966555000111 (merchant users.phone)'; }
  else if ((!phone || !W.isInternationalPhone(n.rawPhone)) && n.contactId && API.contacts[n.contactId]) {
    const c = W.contactPhoneAndName(API.contacts[n.contactId])
    if (c.phone) { phone = W.cleanPhone(c.phone); lookedUp = ' (Contacts API)' }
    if (!n.vars.customer_name) n.vars.customer_name = c.firstName
  }
  if (!phone) return { route: n.event, skip: 'no phone' }
  const key = `wix_sent_${n.dedupeId}_${n.event}`
  if (sent.has(key)) return { route: n.event, skip: `duplicate (${key})` }
  sent.add(key)
  return { event: n.event, to: phone + lookedUp, name: n.vars.customer_name || '(default)', message: W.buildWixMessage(n.event, LANG, n.vars, {}) }
}

let sentCount = 0, skipped = 0
for (const [q, label, payload] of CASES) {
  const r = run(q, payload)
  console.log(`\n■ ${label}   [?event=${q}]`)
  if (r.skip) { skipped++; console.log(`  SKIP${r.route ? ` (${r.route})` : ''}: ${r.skip}`); continue }
  sentCount++
  console.log(`  → ${r.event} | phone ${r.to} | name ${r.name}`)
  console.log('  ' + r.message.replace(/\n/g, '\n  '))
}
console.log(`\n${CASES.length} payloads: ${sentCount} messages, ${skipped} skipped (lang=${LANG}). Catalogue: ${W.WIX_EVENTS.length} events.`)
