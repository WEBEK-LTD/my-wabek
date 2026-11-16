// Wix app notifications: event catalogue + payload parsing.
//
// Server-safe and dependency-free (no Supabase, no fetch, no Node APIs), so
// it can be imported by API routes, by the dashboard UI (catalogue only) and
// by scripts/wix-events-check.mjs (plain `node`, type stripping).
//
//  * WIX_EVENTS — every notification WABEK can send for a Wix site: key,
//    group, audience, the Wix webhooks that trigger it, placeholders and the
//    default texts in Arabic (فصحى) and English.
//  * unwrapWixWebhook() — the JWT body → { instanceId, entity, body, … }.
//  * classifyWixEvent() — the callback's ?event= value → the notification key.
//  * build*Notice() — pure extractors: payload → { phone, name, vars }.
//
// Placeholders are `{{name}}`. Custom texts are stored per user in
// system_settings `wix_templates_<userId>` ({ key: text }), on/off switches in
// `wix_notify_enabled_<userId>` ({ key: boolean }, missing = on).
//
// NOTE: Arabic strings here are WhatsApp message templates sent to
// recipients (allowed in lib/** by scripts/i18n-audit.mjs), not UI strings.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Obj = Record<string, any>

export type WixLang = 'ar' | 'en'
export type WixEventGroup = 'ecommerce' | 'bookings' | 'events' | 'restaurants' | 'pricing_plans'
export type WixAudience = 'customer' | 'merchant'

export interface WixEventDef {
  key: string
  group: WixEventGroup
  /** customer = the site's customer; merchant = the WABEK user (store owner). */
  audience: WixAudience
  /** Wix Dev Center webhooks (category / event) that produce this notification. */
  wixWebhooks: string[]
  placeholders: string[]
  label: Record<WixLang, string>
  description: Record<WixLang, string>
  defaults: Record<WixLang, string>
}

export const WIX_EVENT_GROUPS: Array<{ key: WixEventGroup; label: Record<WixLang, string> }> = [
  { key: 'ecommerce',     label: { ar: 'المتجر', en: 'Store' } },
  { key: 'bookings',      label: { ar: 'الحجوزات', en: 'Bookings' } },
  { key: 'events',        label: { ar: 'الفعاليات', en: 'Events' } },
  { key: 'restaurants',   label: { ar: 'المطاعم', en: 'Restaurants' } },
  { key: 'pricing_plans', label: { ar: 'باقات الاشتراك', en: 'Pricing plans' } },
]

export const WIX_PLACEHOLDERS: Array<{ key: string; description: Record<WixLang, string> }> = [
  { key: 'customer_name',   description: { ar: 'الاسم الأول للعميل', en: "Customer's first name" } },
  { key: 'order_id',        description: { ar: 'رقم الطلب (مثل 1042)', en: 'Order number (e.g. 1042)' } },
  { key: 'total',           description: { ar: 'الإجمالي مع العملة', en: 'Total with currency' } },
  { key: 'amount',          description: { ar: 'مبلغ الاعتراض على الدفع', en: 'Chargeback amount' } },
  { key: 'tracking_number', description: { ar: 'رابط التتبع أو رقمه', en: 'Tracking link or number' } },
  { key: 'checkout_url',    description: { ar: 'رابط إكمال الشراء', en: 'Checkout link (abandoned cart)' } },
  { key: 'service_name',    description: { ar: 'اسم الخدمة المحجوزة', en: 'Booked service' } },
  { key: 'event_name',      description: { ar: 'اسم الفعالية', en: 'Event name' } },
  { key: 'plan_name',       description: { ar: 'اسم الباقة', en: 'Plan name' } },
  { key: 'date',            description: { ar: 'التاريخ', en: 'Date' } },
  { key: 'time',            description: { ar: 'الوقت', en: 'Time' } },
]

/**
 * In the DEFAULT texts, a line whose only variable part is one of these and
 * which is empty for this message is dropped (e.g. no tracking link → no
 * "Track:" line). Custom texts are rendered as written.
 */
const OPTIONAL_PLACEHOLDERS = new Set([
  'tracking_number', 'checkout_url', 'total', 'amount', 'service_name', 'event_name', 'plan_name', 'date', 'time',
])

const SCHEDULE_LINES = '📌 {{service_name}}\n🗓️ {{date}}\n⏰ {{time}}'
const EVENT_LINES = '📌 {{event_name}}\n🗓️ {{date}}\n⏰ {{time}}'

export const WIX_EVENTS: WixEventDef[] = [
  // ── eCommerce (customer) ──────────────────────────────────────────────
  {
    key: 'order_placed', group: 'ecommerce', audience: 'customer',
    wixWebhooks: ['eCommerce / Order Approved'],
    placeholders: ['customer_name', 'order_id', 'total'],
    label: { ar: 'تأكيد الطلب', en: 'Order confirmed' },
    description: { ar: 'عند إنشاء العميل طلبًا جديدًا', en: 'When a customer places a new order' },
    defaults: {
      en: '🛒 Order Confirmed!\n\nHi {{customer_name}}, your order #{{order_id}} has been placed.\n💰 Total: {{total}}\n\nThank you! 🙏',
      ar: '🛒 تم تأكيد طلبك!\n\nمرحبًا {{customer_name}}، تم استلام طلبك رقم #{{order_id}} بنجاح.\n💰 الإجمالي: {{total}}\n\nشكرًا لك! 🙏',
    },
  },
  {
    key: 'order_paid', group: 'ecommerce', audience: 'customer',
    wixWebhooks: ['eCommerce / Order Transactions Updated'],
    placeholders: ['customer_name', 'order_id', 'total'],
    label: { ar: 'استلام الدفعة', en: 'Payment received' },
    description: { ar: 'عند اكتمال دفع الطلب بالكامل', en: 'When the order is fully paid' },
    defaults: {
      en: '✅ Payment Received!\n\nHi {{customer_name}}, payment for order #{{order_id}} confirmed.\n💰 {{total}}',
      ar: '✅ تم استلام الدفعة!\n\nمرحبًا {{customer_name}}، تم تأكيد الدفع للطلب رقم #{{order_id}}.\n💰 {{total}}',
    },
  },
  {
    key: 'order_shipped', group: 'ecommerce', audience: 'customer',
    wixWebhooks: ['eCommerce / Fulfillment Status Updated'],
    placeholders: ['customer_name', 'order_id', 'tracking_number'],
    label: { ar: 'شحن الطلب', en: 'Order shipped' },
    description: { ar: 'عند تنفيذ الطلب مع رابط التتبع', en: 'When the order is fulfilled, with tracking' },
    defaults: {
      en: '🚚 Order Shipped!\n\nHi {{customer_name}}, order #{{order_id}} is on its way!\n📦 Track: {{tracking_number}}',
      ar: '🚚 تم شحن طلبك!\n\nمرحبًا {{customer_name}}، طلبك رقم #{{order_id}} في الطريق إليك!\n📦 التتبع: {{tracking_number}}',
    },
  },
  {
    key: 'order_cancelled', group: 'ecommerce', audience: 'customer',
    wixWebhooks: ['eCommerce / Order Canceled'],
    placeholders: ['customer_name', 'order_id'],
    label: { ar: 'إلغاء الطلب', en: 'Order cancelled' },
    description: { ar: 'عند إلغاء الطلب', en: 'When the order is cancelled' },
    defaults: {
      en: '❌ Order Cancelled\n\nHi {{customer_name}}, order #{{order_id}} has been cancelled.',
      ar: '❌ تم إلغاء الطلب\n\nمرحبًا {{customer_name}}، تم إلغاء طلبك رقم #{{order_id}}.',
    },
  },
  {
    key: 'order_refunded', group: 'ecommerce', audience: 'customer',
    wixWebhooks: ['eCommerce / Order Transactions Refund Completed'],
    placeholders: ['customer_name', 'order_id', 'total'],
    label: { ar: 'إتمام الاسترداد', en: 'Refund completed' },
    description: { ar: 'عند اكتمال استرداد المبلغ', en: 'When a refund is completed' },
    defaults: {
      en: '💰 Refund Processed\n\nHi {{customer_name}}, your refund for order #{{order_id}} has been processed.',
      ar: '💰 تم استرداد المبلغ\n\nمرحبًا {{customer_name}}، تمت معالجة استرداد المبلغ الخاص بطلبك رقم #{{order_id}}.',
    },
  },
  {
    key: 'abandoned_cart', group: 'ecommerce', audience: 'customer',
    wixWebhooks: ['eCommerce / Abandoned Checkout Created'],
    placeholders: ['customer_name', 'total', 'checkout_url'],
    label: { ar: 'سلة متروكة', en: 'Abandoned cart' },
    description: { ar: 'عند مغادرة العميل دون إتمام الشراء', en: 'When a customer leaves without paying' },
    defaults: {
      en: '🛒 You left something behind!\n\nHi {{customer_name}}, you have items waiting in your cart.\n\n💡 Complete your purchase now!\n\n🔗 {{checkout_url}}',
      ar: '🛒 نسيت شيئًا في سلتك!\n\nمرحبًا {{customer_name}}، لا تزال هناك منتجات بانتظارك في سلة التسوق.\n\n💡 أكمل عملية الشراء الآن!\n\n🔗 {{checkout_url}}',
    },
  },
  {
    key: 'cart_recovered', group: 'ecommerce', audience: 'customer',
    wixWebhooks: [],
    placeholders: ['customer_name', 'order_id'],
    label: { ar: 'استعادة السلة', en: 'Cart recovered' },
    description: { ar: 'عبر أتمتة Wix فقط', en: 'Via Wix Automations only' },
    defaults: {
      en: '🎉 Welcome back!\n\nHi {{customer_name}}, your order #{{order_id}} has been completed. Thank you! 🙏',
      ar: '🎉 أهلًا بعودتك!\n\nمرحبًا {{customer_name}}، تم إتمام طلبك رقم #{{order_id}}. شكرًا لك! 🙏',
    },
  },
  {
    key: 'back_in_stock', group: 'ecommerce', audience: 'customer',
    wixWebhooks: [],
    placeholders: ['customer_name'],
    label: { ar: 'عودة المنتج إلى المخزون', en: 'Back in stock' },
    description: { ar: 'عبر أتمتة Wix فقط', en: 'Via Wix Automations only' },
    defaults: {
      en: '📦 Good news, {{customer_name}}!\n\nA product you were waiting for is back in stock. Order now! 🛒',
      ar: '📦 خبر سار يا {{customer_name}}!\n\nالمنتج الذي كنت تنتظره عاد متوفرًا في المخزون. اطلبه الآن! 🛒',
    },
  },
  // ── eCommerce (merchant) ──────────────────────────────────────────────
  {
    key: 'order_chargeback', group: 'ecommerce', audience: 'merchant',
    wixWebhooks: ['eCommerce / Order Transactions Chargeback Approved'],
    placeholders: ['customer_name', 'order_id', 'amount', 'total'],
    label: { ar: 'اعتراض على الدفع (للتاجر)', en: 'Chargeback (to you)' },
    description: { ar: 'يُرسل إلى رقمك أنت، لا إلى العميل', en: 'Sent to your own number, never to the customer' },
    defaults: {
      en: '⚠️ Chargeback approved\n\nA chargeback was approved on order #{{order_id}}.\n💰 Amount: {{amount}}\n👤 Customer: {{customer_name}}\n\nReview it in your Wix dashboard.',
      ar: '⚠️ تنبيه: اعتراض على عملية دفع\n\nتمت الموافقة على اعتراض (Chargeback) على الطلب رقم #{{order_id}}.\n💰 المبلغ: {{amount}}\n👤 العميل: {{customer_name}}\n\nيُرجى مراجعته من لوحة تحكم Wix.',
    },
  },
  {
    key: 'order_chargeback_reversed', group: 'ecommerce', audience: 'merchant',
    wixWebhooks: ['eCommerce / Order Transactions Chargeback Reversed'],
    placeholders: ['customer_name', 'order_id', 'amount', 'total'],
    label: { ar: 'إلغاء الاعتراض على الدفع (للتاجر)', en: 'Chargeback reversed (to you)' },
    description: { ar: 'يُرسل إلى رقمك أنت، لا إلى العميل', en: 'Sent to your own number, never to the customer' },
    defaults: {
      en: '✅ Chargeback reversed\n\nThe chargeback on order #{{order_id}} was reversed in your favor.\n💰 Amount: {{amount}}',
      ar: '✅ أُلغي الاعتراض على الدفع\n\nأُلغي الاعتراض (Chargeback) على الطلب رقم #{{order_id}} لصالحك.\n💰 المبلغ: {{amount}}',
    },
  },
  // ── Bookings ──────────────────────────────────────────────────────────
  {
    key: 'booking_created', group: 'bookings', audience: 'customer',
    wixWebhooks: ['Bookings / Booking Created'],
    placeholders: ['customer_name', 'service_name', 'date', 'time'],
    label: { ar: 'استلام الحجز', en: 'Booking received' },
    description: { ar: 'عند إنشاء حجز ينتظر التأكيد', en: 'When a booking is created (awaiting confirmation)' },
    defaults: {
      en: `📅 Booking received\n\nHi {{customer_name}}, we've received your booking.\n${SCHEDULE_LINES}\n\nWe'll confirm it shortly.`,
      ar: `📅 تم استلام حجزك\n\nمرحبًا {{customer_name}}، استلمنا طلب حجزك.\n${SCHEDULE_LINES}\n\nسنؤكد حجزك قريبًا.`,
    },
  },
  {
    key: 'booking_confirmed', group: 'bookings', audience: 'customer',
    wixWebhooks: ['Bookings / Booking Confirmed', 'Bookings / Booking Created (already confirmed)'],
    placeholders: ['customer_name', 'service_name', 'date', 'time'],
    label: { ar: 'تأكيد الحجز', en: 'Booking confirmed' },
    description: { ar: 'عند تأكيد الحجز', en: 'When the booking is confirmed' },
    defaults: {
      en: `✅ Booking confirmed\n\nHi {{customer_name}}, your booking is confirmed.\n${SCHEDULE_LINES}\n\nSee you soon! 🙏`,
      ar: `✅ تم تأكيد حجزك\n\nمرحبًا {{customer_name}}، تم تأكيد حجزك.\n${SCHEDULE_LINES}\n\nنتطلع إلى رؤيتك! 🙏`,
    },
  },
  {
    key: 'booking_cancelled', group: 'bookings', audience: 'customer',
    wixWebhooks: ['Bookings / Booking Canceled'],
    placeholders: ['customer_name', 'service_name', 'date', 'time'],
    label: { ar: 'إلغاء الحجز', en: 'Booking cancelled' },
    description: { ar: 'عند إلغاء الحجز', en: 'When the booking is cancelled' },
    defaults: {
      en: `❌ Booking cancelled\n\nHi {{customer_name}}, your booking has been cancelled.\n${SCHEDULE_LINES}`,
      ar: `❌ تم إلغاء الحجز\n\nمرحبًا {{customer_name}}، تم إلغاء حجزك.\n${SCHEDULE_LINES}`,
    },
  },
  {
    key: 'booking_updated', group: 'bookings', audience: 'customer',
    wixWebhooks: ['Bookings / Booking Updated (date/time changed only)'],
    placeholders: ['customer_name', 'service_name', 'date', 'time'],
    label: { ar: 'تغيير موعد الحجز', en: 'Booking rescheduled' },
    description: { ar: 'عند تغيير تاريخ الحجز أو وقته فقط', en: 'Only when the date or time changes' },
    defaults: {
      en: `🔄 Booking rescheduled\n\nHi {{customer_name}}, your booking has a new date and time.\n${SCHEDULE_LINES}`,
      ar: `🔄 تم تغيير موعد حجزك\n\nمرحبًا {{customer_name}}، تم تحديث موعد حجزك.\n${SCHEDULE_LINES}`,
    },
  },
  // ── Events ────────────────────────────────────────────────────────────
  {
    key: 'event_registered', group: 'events', audience: 'customer',
    wixWebhooks: ['Events / RSVP Created'],
    placeholders: ['customer_name', 'event_name', 'date', 'time'],
    label: { ar: 'التسجيل في فعالية', en: 'Event registration' },
    description: { ar: 'عند تسجيل الحضور (RSVP)', en: 'When a guest RSVPs' },
    defaults: {
      en: `🎟️ You're registered!\n\nHi {{customer_name}}, your registration is confirmed.\n${EVENT_LINES}\n\nSee you there!`,
      ar: `🎟️ تم تسجيلك بنجاح!\n\nمرحبًا {{customer_name}}، تم تأكيد تسجيلك في الفعالية.\n${EVENT_LINES}\n\nنراك هناك!`,
    },
  },
  {
    key: 'event_ticket_purchased', group: 'events', audience: 'customer',
    wixWebhooks: ['Events / Order Confirmed'],
    placeholders: ['customer_name', 'order_id', 'event_name', 'date', 'time', 'total'],
    label: { ar: 'شراء تذاكر', en: 'Tickets purchased' },
    description: { ar: 'عند تأكيد طلب التذاكر', en: 'When a ticket order is confirmed' },
    defaults: {
      en: `🎫 Tickets confirmed!\n\nHi {{customer_name}}, your ticket order #{{order_id}} is confirmed.\n${EVENT_LINES}\n💰 Total: {{total}}`,
      ar: `🎫 تم تأكيد تذاكرك!\n\nمرحبًا {{customer_name}}، تم تأكيد طلب التذاكر رقم #{{order_id}}.\n${EVENT_LINES}\n💰 الإجمالي: {{total}}`,
    },
  },
  // ── Restaurants ───────────────────────────────────────────────────────
  {
    key: 'restaurant_order_accepted', group: 'restaurants', audience: 'customer',
    wixWebhooks: ['Restaurants / Order Accepted'],
    placeholders: ['customer_name', 'order_id', 'total'],
    label: { ar: 'قبول طلب المطعم', en: 'Restaurant order accepted' },
    description: { ar: 'عند قبول المطعم للطلب', en: 'When the restaurant accepts the order' },
    defaults: {
      en: '👨‍🍳 Order accepted!\n\nHi {{customer_name}}, the restaurant has accepted your order #{{order_id}} and is preparing it now.\n💰 Total: {{total}}',
      ar: '👨‍🍳 تم قبول طلبك!\n\nمرحبًا {{customer_name}}، قبل المطعم طلبك رقم #{{order_id}} ويجري تحضيره الآن.\n💰 الإجمالي: {{total}}',
    },
  },
  {
    key: 'restaurant_order_fulfilled', group: 'restaurants', audience: 'customer',
    wixWebhooks: ['Restaurants / Order Fulfilled'],
    placeholders: ['customer_name', 'order_id', 'total'],
    label: { ar: 'تجهيز طلب المطعم', en: 'Restaurant order ready' },
    description: { ar: 'عند تجهيز الطلب أو خروجه للتوصيل', en: 'When the order is ready or out for delivery' },
    defaults: {
      en: '🍽️ Your order is ready!\n\nHi {{customer_name}}, your order #{{order_id}} is ready or on its way to you. Enjoy your meal! 😋',
      ar: '🍽️ طلبك جاهز!\n\nمرحبًا {{customer_name}}، طلبك رقم #{{order_id}} جاهز أو في الطريق إليك. بالهناء والشفاء! 😋',
    },
  },
  // ── Pricing Plans (the site's own plans sold to its customers) ────────
  {
    key: 'site_plan_purchased', group: 'pricing_plans', audience: 'customer',
    wixWebhooks: ['Pricing Plans / Order Created'],
    placeholders: ['customer_name', 'plan_name', 'total', 'date'],
    label: { ar: 'الاشتراك في باقة', en: 'Plan purchased' },
    description: { ar: 'عند اشتراك عميل في إحدى باقات موقعك', en: 'When a customer buys one of your site plans' },
    defaults: {
      en: '🎉 Welcome aboard!\n\nHi {{customer_name}}, your subscription is active.\n📌 Plan: {{plan_name}}\n💰 Price: {{total}}\n\nThank you for joining! 🙏',
      ar: '🎉 أهلًا بك!\n\nمرحبًا {{customer_name}}، تم تفعيل اشتراكك.\n📌 الباقة: {{plan_name}}\n💰 السعر: {{total}}\n\nشكرًا لانضمامك! 🙏',
    },
  },
  {
    key: 'site_plan_cancelled', group: 'pricing_plans', audience: 'customer',
    wixWebhooks: ['Pricing Plans / Order Canceled'],
    placeholders: ['customer_name', 'plan_name', 'date'],
    label: { ar: 'إلغاء الاشتراك في باقة', en: 'Plan cancelled' },
    description: { ar: 'عند إلغاء اشتراك عميل في باقة', en: "When a customer's site plan is cancelled" },
    defaults: {
      en: '❌ Subscription cancelled\n\nHi {{customer_name}}, your subscription has been cancelled.\n📌 Plan: {{plan_name}}\n🗓️ Ends on: {{date}}',
      ar: '❌ تم إلغاء الاشتراك\n\nمرحبًا {{customer_name}}، تم إلغاء اشتراكك.\n📌 الباقة: {{plan_name}}\n🗓️ ينتهي في: {{date}}',
    },
  },
]

export const WIX_EVENT_KEYS: string[] = WIX_EVENTS.map(e => e.key)
const EVENT_BY_KEY = new Map(WIX_EVENTS.map(e => [e.key, e]))

export function getWixEventDef(key: string): WixEventDef | undefined {
  return EVENT_BY_KEY.get(key)
}

/**
 * Default texts the dashboard (pages/dashboard/wix.tsx) used to save as if
 * they were custom texts. A saved text equal to one of these (or to a
 * catalogue default) is treated as "not customised" for non-English
 * merchants, so they get the default in their language.
 */
const LEGACY_DASHBOARD_DEFAULTS: Record<string, string> = {
  order_shipped:   '🚚 Order Shipped!\n\nHi {{customer_name}}, order #{{order_id}} is on its way!\n📦 Track: {{tracking_number}}',
  order_cancelled: '❌ Order Cancelled\n\nHi {{customer_name}}, order #{{order_id}} has been cancelled.\nContact us if you need help.',
  cart_recovered:  '🎉 Welcome back!\n\nHi {{customer_name}}, your order #{{order_id}} has been completed. Thank you for coming back! 🙏',
  back_in_stock:   '📦 Good news, {{customer_name}}!\n\nA product you were waiting for is back in stock. Order now before it sells out! 🛒',
}

const norm = (s: string) => String(s || '').replace(/\r\n/g, '\n').trim()

export function isUntouchedDefault(key: string, text: string): boolean {
  const def = EVENT_BY_KEY.get(key)
  const t = norm(text)
  if (!t) return true
  if (def && (t === norm(def.defaults.en) || t === norm(def.defaults.ar))) return true
  return LEGACY_DASHBOARD_DEFAULTS[key] !== undefined && t === norm(LEGACY_DASHBOARD_DEFAULTS[key])
}

/** Merchant language: users.language first, then the Wix site language; Arabic by default. */
export function pickWixLanguage(userLanguage?: string | null, siteLanguage?: string | null): WixLang {
  const pick = (v?: string | null): WixLang | null => {
    const l = String(v || '').trim().toLowerCase().slice(0, 2)
    if (!l) return null
    return l === 'ar' ? 'ar' : 'en'
  }
  return pick(userLanguage) || pick(siteLanguage) || 'ar'
}

export const DEFAULT_CUSTOMER_NAME: Record<WixLang, string> = { ar: 'عميلنا العزيز', en: 'Customer' }

export function renderWixTemplate(text: string, vars: Record<string, string>, opts: { dropEmptyOptionalLines?: boolean } = {}): string {
  let lines = String(text || '').split('\n')
  if (opts.dropEmptyOptionalLines) {
    lines = lines.filter(line => {
      const used = Array.from(line.matchAll(/\{\{(\w+)\}\}/g)).map(m => m[1])
      if (!used.length) return true
      return !used.every(k => OPTIONAL_PLACEHOLDERS.has(k) && !String(vars[k] ?? '').trim())
    })
  }
  return Object.entries(vars).reduce(
    (t, [k, v]) => t.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v ?? '')),
    lines.join('\n'),
  )
}

/**
 * The message for `key`: the merchant's custom text if they wrote one, else
 * the default in `lang`. Returns '' for an unknown key.
 */
export function buildWixMessage(key: string, lang: WixLang, vars: Record<string, string>, custom: Record<string, string> = {}): string {
  const def = EVENT_BY_KEY.get(key)
  const saved = typeof custom[key] === 'string' ? custom[key] : ''
  // Legacy behaviour: any saved text wins for English merchants; for others
  // a saved copy of an English default falls back to their language.
  const useCustom = !!saved.trim() && !(lang !== 'en' && isUntouchedDefault(key, saved))
  const full = { ...vars, customer_name: String(vars.customer_name || '').trim() || DEFAULT_CUSTOMER_NAME[lang] }
  if (useCustom) return renderWixTemplate(saved, full)
  if (!def) return ''
  return renderWixTemplate(def.defaults[lang], full, { dropEmptyOptionalLines: true })
}

// ── Formatting helpers ────────────────────────────────────────────────────

/** Digits only, no leading zeros — the format the existing order flow sends to. */
export function cleanPhone(raw: unknown): string {
  return String(raw || '').replace(/[^\d]/g, '').replace(/^0+/, '')
}

/** Whether a phone string carries a country code (+… or 00…). */
export function isInternationalPhone(raw: unknown): boolean {
  return /^\s*(\+|00)/.test(String(raw || ''))
}

export function moneyText(v: unknown, currency?: string): string {
  if (v === null || v === undefined || v === '') return ''
  if (typeof v === 'object') {
    const o = v as Obj
    if (o.formattedAmount) return String(o.formattedAmount)
    if (o.formattedValue) return String(o.formattedValue)
    const amt = o.amount ?? o.value ?? o.total
    if (amt === undefined || amt === null || amt === '') return ''
    return moneyText(amt, o.currency || currency)
  }
  const s = String(v).trim()
  if (!s) return ''
  return currency ? `${s} ${currency}` : s
}

export function formatWixDateTime(iso: unknown, lang: WixLang, timeZone?: string | null): { date: string; time: string } {
  const d = new Date(String(iso || ''))
  if (!iso || Number.isNaN(d.getTime())) return { date: '', time: '' }
  const locale = lang === 'ar' ? 'ar-u-nu-latn-ca-gregory' : 'en-US'
  const fmt = (tz: string | undefined) => ({
    date: new Intl.DateTimeFormat(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: tz }).format(d),
    time: new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone: tz }).format(d),
  })
  if (timeZone) {
    try { return fmt(timeZone) } catch { /* invalid zone → UTC */ }
  }
  const r = fmt('UTC')
  return { date: r.date, time: `${r.time} UTC` }
}

// ── Payload unwrapping ────────────────────────────────────────────────────

export function parseJsonish(v: unknown): Obj | null {
  if (!v) return null
  if (typeof v === 'object') return v as Obj
  if (typeof v === 'string') {
    try { const j = JSON.parse(v); return j && typeof j === 'object' ? j : null } catch { return null }
  }
  return null
}

export interface WixEnvelope {
  instanceId: string
  eventType: string
  entityFqdn: string
  slug: string
  /** Domain-event entityId (for most entities the entity's own id). */
  entityId: string
  /** createdEvent.entity / updatedEvent.currentEntity / entity. */
  entity: Obj | null
  /** updatedEvent.previousEntity when Wix sends it. */
  previousEntity: Obj | null
  /** updatedEvent.modifiedFields when Wix sends it. */
  modifiedFields: Obj | null
  /** actionEvent.body, or the whole inner object for legacy flat payloads. */
  body: Obj | null
}

/**
 * Wix app webhook JWT payload: root.data = JSON string of
 * { eventType, instanceId, data: JSON string of the domain event }. The
 * domain event holds createdEvent / updatedEvent / actionEvent / deletedEvent
 * (v2/v3 APIs) or, for older APIs (Events, Restaurants), the fields directly.
 */
export function unwrapWixWebhook(jwt: Obj): WixEnvelope {
  const d1 = parseJsonish(jwt?.data)
  const d2 = d1 ? parseJsonish(d1.data) : null
  const str = (...vals: unknown[]) => { for (const v of vals) if (v !== undefined && v !== null && v !== '') return String(v); return '' }

  const instanceId = str(jwt?.instanceId, jwt?.appInstanceId, d1?.instanceId, d1?.metaSiteId, d1?.siteId, d2?.instanceId, d2?.metaSiteId, d2?.siteId)
  const eventType = str(d1?.eventType, jwt?.eventType, d2?.eventType)

  let entity: Obj | null = null
  let previousEntity: Obj | null = null
  let modifiedFields: Obj | null = null
  let body: Obj | null = null
  let domain: Obj | null = null
  for (const layer of [d2, d1]) {
    if (!layer) continue
    const upd = parseJsonish(layer.updatedEvent)
    const crt = parseJsonish(layer.createdEvent)
    const act = parseJsonish(layer.actionEvent)
    if (upd?.currentEntity)  { entity = parseJsonish(upd.currentEntity); previousEntity = parseJsonish(upd.previousEntity); modifiedFields = parseJsonish(upd.modifiedFields) }
    else if (crt?.entity)    entity = parseJsonish(crt.entity)
    else if (layer.entity)   entity = parseJsonish(layer.entity)
    if (act) body = parseJsonish(act.body) || parseJsonish(act.bodyAsJson)
    if (entity || body) { domain = layer; break }
  }
  // Legacy flat payload (no domain-event wrapper): the inner object is the body.
  if (!entity && !body && d2) { body = d2; domain = d2 }

  return {
    instanceId,
    eventType,
    entityFqdn: str(domain?.entityFqdn, d2?.entityFqdn, d1?.entityFqdn),
    slug: str(domain?.slug, d2?.slug, d1?.slug),
    entityId: str(d1?.entityId, d2?.entityId, domain?.entityId),
    entity, previousEntity, modifiedFields, body,
  }
}

// ── Event routing ─────────────────────────────────────────────────────────

/**
 * ?event= values accepted on /api/wix/webhook. order_updated, the second
 * Order Transactions webhook and Abandoned Checkout Updated are no longer
 * configured but still handled (old subscriptions / retries): dedupe keeps
 * them from producing a second message.
 */
export const WIX_WEBHOOK_QUERY_EVENTS = [
  'order_placed', 'order_updated', 'order_cancelled', 'order_shipped', 'order_paid', 'order_refunded',
  'order_chargeback', 'order_chargeback_reversed', 'abandoned_cart',
  'booking_created', 'booking_confirmed', 'booking_cancelled', 'booking_updated',
  'event_registered', 'event_ticket_purchased',
  'restaurant_order_accepted', 'restaurant_order_fulfilled',
  'plan_purchased', 'plan_cancelled', 'site_plan_purchased', 'site_plan_cancelled',
] as const

export type WixRoute =
  | { group: 'ecommerce'; event: string }
  | { group: 'bookings'; event: string }
  | { group: 'events'; event: string }
  | { group: 'restaurants'; event: string }
  | { group: 'pricing_plans'; event: string }

const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)

export function isEcomOrder(o: unknown): boolean {
  if (!isObj(o)) return false
  return !!(o.buyerInfo || o.priceSummary || o.lineItems?.[0]?.productName || (o.number && o.fulfillmentStatus))
}

/** The restaurant order object in a Restaurants webhook, if any. */
export function restaurantOrderOf(env: WixEnvelope): Obj | null {
  const cands = [env.body?.order, env.entity, env.body]
  for (const c of cands) if (isObj(c) && !isEcomOrder(c) && (c.contact || c.customer || c.totals || c.fulfillment || c.status)) return c
  return null
}

/** A Restaurants (not eCommerce) order payload — the owner points both at ?event=order_shipped. */
export function isRestaurantsPayload(env: WixEnvelope): boolean {
  const tag = `${env.eventType} ${env.entityFqdn} ${env.slug}`.toLowerCase()
  if (tag.includes('restaurant')) return true
  if (tag.includes('ecom')) return false
  if (isEcomOrder(env.entity) || isEcomOrder(env.body?.order)) return false
  const o = restaurantOrderOf(env)
  return !!(o && (o.contact || o.customer || o.totals || o.fulfillment?.type || o.restaurantId))
}

/** Map the callback's ?event= to what we notify about; null = not supported. */
export function classifyWixEvent(queryEvent: string, env: WixEnvelope): WixRoute | null {
  const e = String(queryEvent || '').trim()
  switch (e) {
    case 'order_shipped':
      return isRestaurantsPayload(env) ? { group: 'restaurants', event: 'restaurant_order_fulfilled' } : { group: 'ecommerce', event: e }
    case 'order_placed': case 'order_updated': case 'order_cancelled': case 'order_paid': case 'order_refunded':
    case 'order_chargeback': case 'order_chargeback_reversed': case 'abandoned_cart':
      return { group: 'ecommerce', event: e }
    case 'booking_created': case 'booking_confirmed': case 'booking_cancelled': case 'booking_updated':
      return { group: 'bookings', event: e }
    case 'event_registered': case 'event_ticket_purchased':
      return { group: 'events', event: e }
    case 'restaurant_order_accepted': case 'restaurant_order_fulfilled':
      return { group: 'restaurants', event: e }
    // Pricing Plans on /api/wix/webhook are the SITE's plans (customer-facing);
    // WABEK's own billing lives on /api/wix/billing.
    case 'plan_purchased': case 'site_plan_purchased':
      return { group: 'pricing_plans', event: 'site_plan_purchased' }
    case 'plan_cancelled': case 'site_plan_cancelled':
      return { group: 'pricing_plans', event: 'site_plan_cancelled' }
    default:
      return null
  }
}

// ── Notices (pure extractors) ─────────────────────────────────────────────

export interface WixNotice {
  /** Final notification key (catalogue key). */
  event: string
  audience: WixAudience
  /** Entity id used for dedupe (order / booking / rsvp / …). */
  dedupeId: string
  /** Raw phone as found in the payload ('' if none). */
  rawPhone: string
  phone: string
  /** For a Contacts / Members API lookup when the phone is missing or local. */
  contactId: string
  memberId: string
  vars: Record<string, string>
}

export type WixParse = { ok: true; notice: WixNotice } | { ok: false; skip: string }

const skip = (reason: string): WixParse => ({ ok: false, skip: reason })
const up = (v: unknown) => String(v || '').toUpperCase()
const firstStr = (...vals: unknown[]): string => {
  for (const v of vals) if (typeof v === 'string' ? v.trim() : (typeof v === 'number')) return String(v).trim()
  return ''
}

function notice(p: Partial<WixNotice> & { event: string; dedupeId: string }): WixNotice {
  const def = EVENT_BY_KEY.get(p.event)
  const vars: Record<string, string> = {}
  for (const k of def?.placeholders || []) vars[k] = ''
  Object.assign(vars, p.vars || {})
  const rawPhone = p.rawPhone || ''
  return {
    event: p.event,
    audience: def?.audience || 'customer',
    dedupeId: p.dedupeId,
    rawPhone,
    phone: cleanPhone(rawPhone),
    contactId: p.contactId || '',
    memberId: p.memberId || '',
    vars,
  }
}

/** Phone in a Wix form submission ({ inputValues: [{ inputName, value, values }] }). */
function formPhone(form: unknown): string {
  const f = parseJsonish(form)
  const list = Array.isArray(f?.inputValues) ? f!.inputValues : Array.isArray(f) ? (f as unknown as Obj[]) : []
  const hit = list.find((iv: Obj) => /phone|mobile|tel|whatsapp|هاتف|جوال/i.test(String(iv?.inputName || iv?.name || '')))
  return firstStr(hit?.value, hit?.values?.[0])
}

// eCommerce ------------------------------------------------------------------

/** The eCom order carried by the webhook (Order Approved/Canceled body, Order Updated entity…). */
export function ecomOrderFromPayload(env: WixEnvelope): Obj | null {
  if (isEcomOrder(env.entity)) return env.entity
  if (isEcomOrder(env.body?.order)) return env.body!.order
  if (isObj(env.body?.order) && env.body!.order.id) return env.body!.order
  return null
}

/** Order id for order / transactions / fulfillment / chargeback payloads. */
export function ecomOrderId(env: WixEnvelope): string {
  const b = env.body || {}
  const e = env.entity || {}
  return firstStr(
    b.orderId, b.order?.id, b.orderTransactions?.orderId, b.orderWithFulfillments?.orderId,
    e.orderId, isEcomOrder(e) ? e.id : '', env.entityId, b.id && isEcomOrder(b) ? b.id : '',
  )
}

/** Abandoned checkout entity (Abandoned Checkout Created/Updated). */
export function abandonedCheckoutFromPayload(env: WixEnvelope): Obj | null {
  return (isObj(env.entity) && env.entity) || (isObj(env.body?.abandonedCheckout) && env.body!.abandonedCheckout) || null
}

function allPayments(env: WixEnvelope): Obj[] {
  const src = [env.body?.orderTransactions, env.entity, env.body]
  for (const s of src) if (isObj(s) && Array.isArray(s.payments)) return s.payments
  return []
}

/**
 * Whether the order is actually paid: order.paymentStatus === 'PAID', or (no
 * order status available) an APPROVED/COMPLETED payment in the transactions.
 */
export function ecomPaymentState(order: Obj | null, env: WixEnvelope): 'paid' | 'not_paid' | 'unknown' {
  const ps = up(order?.paymentStatus)
  if (ps) return ps === 'PAID' ? 'paid' : 'not_paid'
  const pays = allPayments(env)
  if (!pays.length) return 'unknown'
  const ok = pays.some(p => ['APPROVED', 'COMPLETED'].includes(up(p?.regularPaymentDetails?.status || p?.status)) ||
    (p?.giftcardPaymentDetails && !p.giftcardPaymentDetails.voided))
  return ok ? 'paid' : 'not_paid'
}

/** The chargeback this webhook is about ({ id, amount text }). */
export function ecomChargeback(env: WixEnvelope, wantStatus: 'APPROVED' | 'REVERSED', currency?: string): { id: string; amount: string } {
  const direct = parseJsonish(env.body?.chargeback)
  const list: Obj[] = []
  if (direct) list.push(direct)
  for (const p of allPayments(env)) for (const c of (p?.regularPaymentDetails?.chargebacks || p?.chargebacks || [])) list.push(c)
  const byStatus = list.filter(c => !c?.status || up(c.status) === wantStatus)
  const cb = (direct && list[0]) || byStatus.sort((a, b) => String(b?.updatedDate || b?.createdDate || '').localeCompare(String(a?.updatedDate || a?.createdDate || '')))[0] || null
  if (!cb) return { id: firstStr(env.body?.chargebackId), amount: '' }
  const amount = wantStatus === 'REVERSED' && cb.reversalAmount ? cb.reversalAmount : cb.amount
  return { id: firstStr(cb.id, env.body?.chargebackId), amount: moneyText(amount, currency) }
}

/**
 * order_updated → the event it really is (existing behaviour), plus the
 * paid / cancelled / shipped guards. Returns the final key or a skip reason.
 */
export function decideEcomEvent(queryEvent: string, order: Obj | null, env: WixEnvelope): { event: string } | { skip: string } {
  const o = order || {}
  const status = up(o.status)
  const fulfillmentStatus = up(env.body?.fulfillmentStatus || o.fulfillmentStatus)
  const paymentStatus = up(o.paymentStatus)
  const isRefunded  = ['REFUNDED', 'PARTIALLY_REFUNDED', 'FULLY_REFUNDED'].includes(paymentStatus)
  const isCancelled = ['CANCELED', 'CANCELLED'].includes(status)

  switch (queryEvent) {
    case 'order_updated': {
      const isNew     = ['INITIALIZED', 'APPROVED', 'NEW'].includes(status)
      const isShipped = ['FULFILLED', 'PARTIALLY_FULFILLED'].includes(fulfillmentStatus)
      if (isCancelled || isRefunded) return { skip: `order_updated with status ${status}/${paymentStatus} — the cancel/refund webhooks handle it` }
      if (isShipped) return { event: 'order_shipped' }
      if (isNew) return { event: 'order_placed' }
      return { skip: `order_updated but status: ${status}` }
    }
    case 'order_cancelled':
      if (!isCancelled && !isRefunded) return { skip: `order_cancelled but status: ${status}` }
      return { event: 'order_cancelled' }
    case 'order_paid': {
      const st = ecomPaymentState(order, env)
      if (st !== 'paid') return { skip: `order_paid but payment ${st}${paymentStatus ? ` (${paymentStatus})` : ''}` }
      return { event: 'order_paid' }
    }
    case 'order_shipped':
      if (fulfillmentStatus === 'NOT_FULFILLED') return { skip: 'order_shipped but fulfillmentStatus NOT_FULFILLED' }
      return { event: 'order_shipped' }
    case 'abandoned_cart': {
      const s = up(o.status)
      if (s === 'RECOVERED') return { skip: 'abandoned checkout already recovered' }
      return { event: 'abandoned_cart' }
    }
    default:
      return { event: queryEvent }
  }
}

/** Customer-facing (and chargeback) notice for an eCom order / abandoned checkout. */
export function buildEcomNotice(event: string, order: Obj | null, ctx: { orderId: string; tracking?: string; chargeback?: { id: string; amount: string } }): WixParse {
  const o = order || {}
  const buyerInfo = o.buyerInfo || {}
  const shipping  = o.shippingInfo?.logistics?.shippingDestination || {}
  const billing   = o.billingInfo || {}
  const contact   = o.contactDetails || {}
  const rawPhone = firstStr(
    buyerInfo.phone, buyerInfo.contactDetails?.phone, shipping.contactDetails?.phone,
    billing.contactDetails?.phone, billing.address?.phone, contact.phone,
  )
  const name = firstStr(
    buyerInfo.contactDetails?.firstName, buyerInfo.firstName, billing.contactDetails?.firstName,
    shipping.contactDetails?.firstName, contact.firstName,
  )
  const rawNum = o.number
  const orderNum = (rawNum && Number(rawNum) > 0) ? String(rawNum) : String(ctx.orderId || o.id || '').slice(0, 8)
  const currency = o.currency
  const total = firstStr(o.priceSummary?.total?.formattedAmount, o.totalPrice?.formattedAmount, o.priceSummary?.total ? moneyText(o.priceSummary.total, currency) : '')

  let dedupeId = ctx.orderId || String(o.id || '')
  if ((event === 'order_chargeback' || event === 'order_chargeback_reversed') && ctx.chargeback?.id) dedupeId = `${dedupeId}_${ctx.chargeback.id}`
  if (!dedupeId) return skip('no order id')

  return {
    ok: true,
    notice: notice({
      event, dedupeId, rawPhone,
      contactId: firstStr(buyerInfo.contactId, o.contactId),
      memberId: firstStr(buyerInfo.memberId),
      vars: {
        customer_name: name,
        order_id: orderNum,
        total,
        tracking_number: ctx.tracking || '',
        checkout_url: firstStr(o.checkoutUrl),
        amount: ctx.chargeback?.amount || total,
      },
    }),
  }
}

// Bookings -------------------------------------------------------------------

export function bookingFromPayload(env: WixEnvelope): Obj | null {
  const c = [env.body?.booking, env.entity, env.body]
  for (const b of c) if (isObj(b) && (b.bookedEntity || b.contactDetails || b.startDate)) return b
  return null
}

export function bookingStart(b: Obj | null): string {
  if (!b) return ''
  return firstStr(b.startDate, b.bookedEntity?.slot?.startDate, b.bookedEntity?.schedule?.firstSessionStart)
}

/**
 * booking_updated is only worth a message when the start changed. `previous`
 * is the last start we saw for this booking (payload previousEntity or our
 * own record); unknown → skip (can't tell a reschedule from noise).
 */
export function bookingRescheduled(currentStart: string, previousStart: string | null | undefined): boolean {
  if (!currentStart || !previousStart) return false
  const a = new Date(currentStart).getTime()
  const b = new Date(previousStart).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return currentStart !== previousStart
  return a !== b
}

export function buildBookingNotice(event: string, booking: Obj | null, lang: WixLang): WixParse {
  if (!booking) return skip('no booking in payload')
  const id = firstStr(booking.id, booking._id)
  if (!id) return skip('booking without id')
  const status = up(booking.status)
  let final = event
  if (event === 'booking_created') {
    if (['CANCELED', 'DECLINED'].includes(status)) return skip(`booking_created with status ${status}`)
    // Auto-confirmed bookings: send the confirmation once (its dedupe key
    // also absorbs the Booking Confirmed webhook that follows).
    if (status === 'CONFIRMED') final = 'booking_confirmed'
  }
  if (event === 'booking_confirmed' && status && status !== 'CONFIRMED') return skip(`booking_confirmed but status ${status}`)
  if (event === 'booking_cancelled' && status && !['CANCELED', 'DECLINED'].includes(status)) return skip(`booking_cancelled but status ${status}`)
  if (event === 'booking_updated' && ['CANCELED', 'DECLINED'].includes(status)) return skip('booking_updated on a cancelled booking')

  const cd = booking.contactDetails || {}
  const slot = booking.bookedEntity?.slot || {}
  const tz = firstStr(slot.timezone, booking.bookedEntity?.schedule?.timezone, cd.timeZone)
  const start = bookingStart(booking)
  const { date, time } = formatWixDateTime(start, lang, tz)
  return {
    ok: true,
    notice: notice({
      event: final,
      dedupeId: final === 'booking_updated' ? `${id}_${start}` : id,
      rawPhone: firstStr(cd.phone, booking.formInfo ? formPhone(booking.formInfo) : ''),
      contactId: firstStr(cd.contactId, booking.contactId),
      vars: {
        customer_name: firstStr(cd.firstName, cd.fullName),
        service_name: firstStr(booking.bookedEntity?.title, booking.bookedEntity?.serviceName),
        date, time,
      },
    }),
  }
}

// Events ---------------------------------------------------------------------

export interface WixEventInfo { title: string; startDate: string; timeZone: string }

/** Event info already present in the payload (some deliveries embed it). */
export function eventInfoFromPayload(p: Obj | null): WixEventInfo | null {
  const ev = parseJsonish(p?.event)
  const title = firstStr(p?.eventTitle, ev?.title)
  if (!title) return null
  return {
    title,
    startDate: firstStr(ev?.dateAndTimeSettings?.startDate, ev?.scheduling?.config?.startDate, p?.eventStartDate),
    timeZone: firstStr(ev?.dateAndTimeSettings?.timeZoneId, ev?.scheduling?.config?.timeZoneId),
  }
}

export function eventsPayload(env: WixEnvelope): Obj | null {
  const c = [env.body?.rsvp, env.body?.order, env.entity, env.body]
  for (const b of c) if (isObj(b) && (b.eventId || b.rsvpId || b.orderNumber || b.firstName)) return b
  return null
}

export function buildEventsNotice(event: string, p: Obj | null, info: WixEventInfo | null, lang: WixLang): WixParse {
  if (!p) return skip('no RSVP / ticket order in payload')
  const { date, time } = formatWixDateTime(info?.startDate, lang, info?.timeZone)
  const phone = firstStr(p.phone, formPhone(p.form), formPhone(p.checkoutForm), p.guests?.[0]?.phone, formPhone(p.guests?.[0]?.form), p.buyer?.phone)
  const name = firstStr(p.firstName, p.buyer?.firstName, p.contactDetails?.firstName, p.guests?.[0]?.firstName)
  const base = { rawPhone: phone, contactId: firstStr(p.contactId, p.buyer?.contactId), memberId: firstStr(p.memberId, p.buyer?.memberId) }

  if (event === 'event_registered') {
    const st = up(p.rsvpStatus || p.status)
    if (st === 'NO' || st === 'WAITING' || st === 'WAITLIST') return skip(`RSVP status ${st}`)
    const id = firstStr(p.rsvpId, p.id, p._id)
    if (!id) return skip('RSVP without id')
    return { ok: true, notice: notice({ event, dedupeId: id, ...base, vars: { customer_name: name, event_name: info?.title || '', date, time } }) }
  }
  // event_ticket_purchased
  const st = up(p.status)
  if (['CANCELED', 'DECLINED', 'INITIATED', 'PENDING'].includes(st)) return skip(`ticket order status ${st}`)
  const orderNumber = firstStr(p.orderNumber, p.number, p.id)
  if (!orderNumber) return skip('ticket order without number')
  const inv = p.invoice || {}
  const total = moneyText(inv.grandTotal || inv.total || p.totalPrice || p.total)
  return {
    ok: true,
    notice: notice({ event, dedupeId: `${firstStr(p.eventId)}_${orderNumber}`, ...base, vars: { customer_name: name, order_id: orderNumber, event_name: info?.title || '', date, time, total } }),
  }
}

// Restaurants ----------------------------------------------------------------

export function buildRestaurantNotice(event: string, env: WixEnvelope): WixParse {
  const o = restaurantOrderOf(env)
  if (!o) return skip('no restaurant order in payload')
  const id = firstStr(o.id, o._id, o.orderId, env.entityId)
  if (!id) return skip('restaurant order without id')
  const status = up(o.status)
  if (['CANCELED', 'CANCELLED', 'REJECTED'].includes(status)) return skip(`restaurant order status ${status}`)
  const c = o.contact || o.customer || o.contactDetails || {}
  const currency = firstStr(o.currency)
  const total = firstStr(o.priceSummary?.total?.formattedAmount) || moneyText(o.totals?.total ?? o.total, currency)
  const num = firstStr(o.number, o.orderNumber, o.shortId, o.displayId) || id.slice(0, 8)
  return {
    ok: true,
    notice: notice({
      event, dedupeId: `restaurant_${id}`,
      rawPhone: firstStr(c.phone, c.phoneNumber, o.phone),
      contactId: firstStr(c.contactId, o.contactId),
      vars: { customer_name: firstStr(c.firstName, c.name), order_id: num, total },
    }),
  }
}

// Pricing Plans (site plans) -------------------------------------------------

export function planOrderFromPayload(env: WixEnvelope): Obj | null {
  const c = [env.body?.order, env.entity, env.body]
  for (const b of c) if (isObj(b) && (b.planId || b.planName || b.buyer)) return b
  return null
}

export function buildSitePlanNotice(event: string, order: Obj | null, lang: WixLang): WixParse {
  if (!order) return skip('no pricing-plan order in payload')
  const id = firstStr(order.id, order._id)
  if (!id) return skip('plan order without id')
  const status = up(order.status)
  if (event === 'site_plan_purchased') {
    // DRAFT = online checkout not paid yet (the "Order Purchased" webhook
    // fires when it is). Cancelled/ended orders are not purchases.
    if (['DRAFT', 'CANCELED', 'ENDED'].includes(status)) return skip(`plan order status ${status}`)
  }
  const pd = order.priceDetails || {}
  const currency = firstStr(pd.currency, order.currency)
  const total = moneyText(pd.total ?? pd.planPrice ?? order.planPrice, currency)
  const endIso = event === 'site_plan_cancelled'
    ? firstStr(order.cancellation?.effectiveDate, order.endDate, order.currentCycle?.endedDate)
    : firstStr(order.startDate)
  const { date } = formatWixDateTime(endIso, lang, null)
  return {
    ok: true,
    notice: notice({
      event, dedupeId: `plan_${id}`,
      rawPhone: firstStr(order.buyer?.phone),
      contactId: firstStr(order.buyer?.contactId),
      memberId: firstStr(order.buyer?.memberId),
      // formatWixDateTime appends " UTC" to times only, so the date is clean
      vars: { customer_name: firstStr(order.buyer?.firstName), plan_name: firstStr(order.planName, order.plan?.name), total, date },
    }),
  }
}

// Contacts / Members API responses ---------------------------------------------

/** Phone + first name from a Contacts v4 contact or a Members v1 member. */
export function contactPhoneAndName(c: Obj | null): { phone: string; firstName: string } {
  if (!c) return { phone: '', firstName: '' }
  const info = c.info || c.contact || {}
  const items: Obj[] = info.phones?.items || (Array.isArray(info.phones) ? info.phones : []) || []
  const primary = items.find(p => p?.primary) || items[0]
  const phone = firstStr(
    primary?.e164Phone, items.find(p => p?.e164Phone)?.e164Phone, c.primaryInfo?.phone, primary?.phone,
    typeof info.phones?.[0] === 'string' ? info.phones[0] : '', c.primaryPhone?.e164Phone, c.primaryPhone?.phone,
  )
  const firstName = firstStr(info.name?.first, info.firstName, c.profile?.nickname)
  return { phone, firstName }
}
