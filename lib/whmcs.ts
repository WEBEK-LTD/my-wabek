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

// Send WhatsApp notification for WHMCS events
export async function sendWHMCSNotification(params: {
  userId: string      // WABEK user ID (the admin using WHMCS integration)
  phone: string       // Customer's phone number
  event: 'invoice_created' | 'invoice_paid' | 'invoice_overdue' | 'ticket_open' | 'ticket_reply' | 'service_active' | 'service_suspended' | 'payment_reminder'
  variables: Record<string, string>
}) {
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
    throw new Error('No connected WhatsApp instance')
  }

  // Get message template for this event
  const templates: Record<string, string> = {
    invoice_created: `🧾 *Yeni Fatura - {{invoice_id}}*\n\nMerhaba {{client_name}},\n\nToplam: {{amount}} {{currency}}\nVade: {{due_date}}\n\nÖdeme için: {{invoice_url}}`,
    invoice_paid: `✅ *Ödeme Alındı*\n\nMerhaba {{client_name}},\n\n{{amount}} {{currency}} tutarındaki fatura #{{invoice_id}} ödemeniz başarıyla alınmıştır.\n\nTeşekkürler! 🙏`,
    invoice_overdue: `⚠️ *Gecikmiş Ödeme - #{{invoice_id}}*\n\nMerhaba {{client_name}},\n\n{{amount}} {{currency}} tutarındaki faturanız vadesi geçmiş.\n\nLütfen en kısa sürede ödeyiniz: {{invoice_url}}`,
    ticket_open: `🎫 *Destek Talebi Açıldı - #{{ticket_id}}*\n\nMerhaba {{client_name}},\n\nDestek talebiniz alınmıştır.\nKonu: {{subject}}\n\nEkibimiz en kısa sürede yanıt verecektir.`,
    ticket_reply: `💬 *Destek Talebi Yanıtı - #{{ticket_id}}*\n\nMerhaba {{client_name}},\n\nDestek talebinize yeni bir yanıt geldi.\n\nGörüntülemek için: {{ticket_url}}`,
    service_active: `🚀 *Hizmetiniz Aktif!*\n\nMerhaba {{client_name}},\n\n{{service_name}} hizmetiniz aktif edilmiştir.\n\nBilgiler:\n{{service_details}}`,
    service_suspended: `🔴 *Hizmet Askıya Alındı*\n\nMerhaba {{client_name}},\n\n{{service_name}} hizmetiniz ödeme yapılmadığı için askıya alınmıştır.\n\nAktivasyon: {{invoice_url}}`,
    payment_reminder: `💰 *Ödeme Hatırlatması*\n\nMerhaba {{client_name}},\n\n#{{invoice_id}} numaralı faturanızın son ödeme tarihi {{due_date}}.\nToplam: {{amount}} {{currency}}\n\n{{invoice_url}}`,
  }

  let message = templates[params.event] || 'WHMCS notification'

  // Replace variables (plain string replacement — no regex built from input)
  for (const [key, value] of Object.entries(params.variables)) {
    message = message.split(`{{${key}}}`).join(String(value ?? ''))
  }

  // Send via WhatsApp (plan limit / opt-out applied in smartSend*)
  if (resolveProvider(instance) === 'wa_web') {
    return smartSendWAWeb({ userId: params.userId, instanceId: instance.id, to: params.phone, text: message, source: 'notification' })
  }
  return smartSend({ userId: params.userId, instanceId: instance.id, phoneNumberId: instance.phone_number_id, accessToken: instance.access_token, to: params.phone, text: message, source: 'notification' })
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
}

const str = (v: unknown) => (v === undefined || v === null ? '' : String(v).slice(0, 500))

export async function processWHMCSWebhook(
  userId: string,
  payload: WHMCSWebhookPayload
): Promise<void> {
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

  if (!phone) return

  const action = payload.action
  let event: Parameters<typeof sendWHMCSNotification>[0]['event'] | null = null

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

  if (event) {
    await sendWHMCSNotification({ userId, phone, event, variables })
  }
}
