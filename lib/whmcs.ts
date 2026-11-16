import { smartSend, smartSendWAWeb, resolveProvider } from '@/lib/wa-smart-send'
import axios from 'axios'
import { supabaseAdmin } from './supabase'

// The WHMCS_* env credentials are the PLATFORM's own WHMCS. They may only be
// used for the WABEK account that owns that WHMCS (WHMCS_OWNER_USER_ID) —
// never to look up clients/invoices on behalf of arbitrary tenants. Tenants'
// own WHMCS installs (the WABEK addon) send the data they want delivered.
const WHMCS_URL = process.env.WHMCS_URL
const WHMCS_IDENTIFIER = process.env.WHMCS_API_IDENTIFIER
const WHMCS_SECRET = process.env.WHMCS_API_SECRET
const WHMCS_OWNER_USER_ID = process.env.WHMCS_OWNER_USER_ID

function platformWhmcsAllowed(userId: string): boolean {
  return !!(WHMCS_URL && WHMCS_IDENTIFIER && WHMCS_SECRET && WHMCS_OWNER_USER_ID && userId === WHMCS_OWNER_USER_ID)
}

async function whmcsRequest(action: string, params: Record<string, unknown> = {}) {
  if (!WHMCS_URL || !WHMCS_IDENTIFIER || !WHMCS_SECRET) {
    throw new Error('WHMCS not configured')
  }

  const formData = new URLSearchParams({
    identifier: WHMCS_IDENTIFIER,
    secret: WHMCS_SECRET,
    action,
    responsetype: 'json',
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  })

  const { data } = await axios.post(`${WHMCS_URL}/includes/api.php`, formData.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000,
  })

  if (data.result === 'error') {
    throw new Error(data.message)
  }

  return data
}

export async function getWHMCSClient(clientId: string) {
  return whmcsRequest('GetClientsDetails', { clientid: clientId, stats: true })
}

export async function getWHMCSInvoice(invoiceId: string) {
  return whmcsRequest('GetInvoice', { invoiceid: invoiceId })
}

export type WHMCSEvent = 'invoice_created' | 'invoice_paid' | 'invoice_overdue' | 'ticket_open' | 'ticket_reply' | 'service_active' | 'service_suspended' | 'payment_reminder'
export type WHMCSLang = 'ar' | 'en'

// Default notification texts. {{placeholders}} are filled from the webhook.
const WHMCS_MESSAGES: Record<WHMCSLang, Record<WHMCSEvent, string>> = {
  ar: {
    invoice_created: `🧾 *فاتورة جديدة رقم {{invoice_id}}*\n\nمرحبًا {{client_name}}،\n\nالمبلغ الإجمالي: {{amount}} {{currency}}\nتاريخ الاستحقاق: {{due_date}}\n\nللدفع: {{invoice_url}}`,
    invoice_paid: `✅ *تم استلام الدفعة*\n\nمرحبًا {{client_name}}،\n\nاستلمنا دفعتك بمبلغ {{amount}} {{currency}} للفاتورة رقم {{invoice_id}} بنجاح.\n\nشكرًا لك! 🙏`,
    invoice_overdue: `⚠️ *فاتورة متأخرة رقم {{invoice_id}}*\n\nمرحبًا {{client_name}}،\n\nتجاوزت فاتورتك بمبلغ {{amount}} {{currency}} تاريخ استحقاقها.\n\nيُرجى السداد في أقرب وقت: {{invoice_url}}`,
    ticket_open: `🎫 *تم فتح تذكرة دعم رقم {{ticket_id}}*\n\nمرحبًا {{client_name}}،\n\nاستلمنا طلب الدعم الخاص بك.\nالموضوع: {{subject}}\n\nسيرد عليك فريقنا في أقرب وقت.`,
    ticket_reply: `💬 *رد جديد على التذكرة رقم {{ticket_id}}*\n\nمرحبًا {{client_name}}،\n\nوصل رد جديد على طلب الدعم الخاص بك.\n\nللاطلاع عليه: {{ticket_url}}`,
    service_active: `🚀 *تم تفعيل خدمتك*\n\nمرحبًا {{client_name}}،\n\nفُعّلت خدمة {{service_name}} الخاصة بك.\n\nالتفاصيل:\n{{service_details}}`,
    service_suspended: `🔴 *تم إيقاف الخدمة مؤقتًا*\n\nمرحبًا {{client_name}}،\n\nأُوقفت خدمة {{service_name}} مؤقتًا لعدم السداد.\n\nلإعادة التفعيل: {{invoice_url}}`,
    payment_reminder: `💰 *تذكير بالدفع*\n\nمرحبًا {{client_name}}،\n\nموعد استحقاق الفاتورة رقم {{invoice_id}} هو {{due_date}}.\nالمبلغ الإجمالي: {{amount}} {{currency}}\n\n{{invoice_url}}`,
  },
  en: {
    invoice_created: `🧾 *New invoice #{{invoice_id}}*\n\nHello {{client_name}},\n\nTotal: {{amount}} {{currency}}\nDue date: {{due_date}}\n\nPay here: {{invoice_url}}`,
    invoice_paid: `✅ *Payment received*\n\nHello {{client_name}},\n\nWe have received your payment of {{amount}} {{currency}} for invoice #{{invoice_id}}.\n\nThank you! 🙏`,
    invoice_overdue: `⚠️ *Overdue invoice #{{invoice_id}}*\n\nHello {{client_name}},\n\nYour invoice of {{amount}} {{currency}} is past its due date.\n\nPlease pay as soon as possible: {{invoice_url}}`,
    ticket_open: `🎫 *Support ticket #{{ticket_id}} opened*\n\nHello {{client_name}},\n\nWe have received your support request.\nSubject: {{subject}}\n\nOur team will reply shortly.`,
    ticket_reply: `💬 *New reply on ticket #{{ticket_id}}*\n\nHello {{client_name}},\n\nThere is a new reply on your support request.\n\nView it here: {{ticket_url}}`,
    service_active: `🚀 *Your service is active*\n\nHello {{client_name}},\n\nYour {{service_name}} service has been activated.\n\nDetails:\n{{service_details}}`,
    service_suspended: `🔴 *Service suspended*\n\nHello {{client_name}},\n\nYour {{service_name}} service has been suspended for non-payment.\n\nReactivate: {{invoice_url}}`,
    payment_reminder: `💰 *Payment reminder*\n\nHello {{client_name}},\n\nInvoice #{{invoice_id}} is due on {{due_date}}.\nTotal: {{amount}} {{currency}}\n\n{{invoice_url}}`,
  },
}

/** 'ar' (default) or 'en' from a `lang` value such as "en", "english", "ar_SA", "arabic". */
export function whmcsLang(v: unknown): WHMCSLang {
  const s = String(v || '').toLowerCase()
  return s.startsWith('en') ? 'en' : 'ar'
}

export interface WHMCSSendResult {
  sent: boolean
  messageId?: string | null
  error?: string
  blocked?: string
  /** 'ignored' = nothing to send for this webhook (no phone / unsupported action) */
  reason?: 'ignored' | 'no_instance' | 'outside_window' | 'send_failed' | 'opted_out' | 'blocked' | 'plan_limit'
  detail?: string
}

// Send WhatsApp notification for WHMCS events
export async function sendWHMCSNotification(params: {
  userId: string      // WABEK user ID (the admin using WHMCS integration)
  phone: string       // Customer's phone number
  event: WHMCSEvent
  variables: Record<string, string>
  lang?: WHMCSLang
}): Promise<WHMCSSendResult> {
  const db = supabaseAdmin()

  // The user's default connected instance (several may exist)
  const { data: instances } = await db
    .from('whatsapp_instances')
    .select('id, user_id, status, is_default, instance_type, type, phone_number_id, access_token, created_at')
    .eq('user_id', params.userId)
    .eq('status', 'connected')
    .order('created_at', { ascending: true })
    .limit(10)
  const instance = instances?.find(i => i.is_default) || instances?.[0]

  if (!instance) {
    return { sent: false, reason: 'no_instance', error: 'No connected WhatsApp instance' }
  }

  let message = WHMCS_MESSAGES[params.lang || 'ar'][params.event]

  // Replace variables (plain string replacement — no regex built from input)
  for (const [key, value] of Object.entries(params.variables)) {
    message = message.split(`{{${key}}}`).join(String(value ?? ''))
  }
  // Placeholders the webhook did not provide
  message = message.replace(/\{\{[a-z_]+\}\}/g, '').replace(/[ \t]+\n/g, '\n').trim()

  // Send via WhatsApp (plan limit / opt-out applied in smartSend*)
  const r = resolveProvider(instance) === 'wa_web'
    ? await smartSendWAWeb({ userId: params.userId, instanceId: instance.id, to: params.phone, text: message, source: 'notification' })
    : await smartSend({ userId: params.userId, instanceId: instance.id, phoneNumberId: instance.phone_number_id, accessToken: instance.access_token, to: params.phone, text: message, source: 'notification' })

  if (r.error) {
    if (r.blocked) return { sent: false, blocked: r.blocked, reason: r.blocked, error: r.error }
    if (r.error === 'outside_window') {
      return { sent: false, reason: 'outside_window', error: 'The customer is outside the 24-hour WhatsApp window; plain text cannot be delivered. Send an approved template through /api/v1/send instead.' }
    }
    return { sent: false, reason: 'send_failed', error: r.error || 'Send failed' }
  }
  return { sent: true, messageId: r.messageId }
}

export interface WHMCSWebhookPayload {
  action: string
  invoiceid?: string
  ticketid?: string
  userid?: string
  serviceid?: string
  // Data a tenant's own WHMCS can send directly
  phone?: string
  phonenumber?: string
  client_name?: string
  amount?: string
  currency?: string
  due_date?: string
  invoice_url?: string
  subject?: string
  ticket_url?: string
  /** Message language: 'ar' (default) or 'en' */
  lang?: string
}

const str = (v: unknown) => (v === undefined || v === null ? '' : String(v).slice(0, 500))

export async function processWHMCSWebhook(
  userId: string,
  payload: WHMCSWebhookPayload
): Promise<WHMCSSendResult> {
  const usePlatformWhmcs = platformWhmcsAllowed(userId)

  // Phone + names: from the platform WHMCS only for its owner; otherwise
  // only what the caller (their own WHMCS) sent.
  let phone: string | null = str(payload.phone || payload.phonenumber).replace(/\D/g, '') || null
  let variables: Record<string, string> = { client_name: str(payload.client_name) }

  if (usePlatformWhmcs && payload.userid) {
    const client = await getWHMCSClient(String(payload.userid))
    phone = client?.phonenumber?.replace(/\D/g, '') || phone
    variables.client_name = `${client.firstname} ${client.lastname}`
  }

  if (!phone) return { sent: false, reason: 'ignored', detail: 'no phone number in the webhook' }

  const action = payload.action
  let event: WHMCSEvent | null = null

  if ((action === 'InvoiceCreated' || action === 'InvoicePaid') && payload.invoiceid) {
    const invoiceId = str(payload.invoiceid)
    let amount = str(payload.amount), currency = str(payload.currency), dueDate = str(payload.due_date)
    let invoiceUrl = str(payload.invoice_url)
    if (usePlatformWhmcs) {
      const invoice = await getWHMCSInvoice(invoiceId)
      amount = invoice.total; currency = invoice.currencycode; dueDate = invoice.duedate
      invoiceUrl = `${WHMCS_URL}/viewinvoice.php?id=${encodeURIComponent(invoiceId)}`
    }
    event = action === 'InvoiceCreated' ? 'invoice_created' : 'invoice_paid'
    variables = { ...variables, invoice_id: invoiceId, amount, currency, due_date: dueDate, invoice_url: invoiceUrl }
  } else if (action === 'TicketOpen' && payload.ticketid) {
    event = 'ticket_open'
    variables = {
      ...variables, ticket_id: str(payload.ticketid), subject: str(payload.subject) || 'Support Request',
      ticket_url: usePlatformWhmcs ? `${WHMCS_URL}/supporttickets.php` : str(payload.ticket_url),
    }
  }

  if (!event) return { sent: false, reason: 'ignored', detail: `unsupported action "${str(action).slice(0, 50)}"` }
  return sendWHMCSNotification({ userId, phone, event, variables, lang: whmcsLang(payload.lang) })
}
