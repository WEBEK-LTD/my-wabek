import { smartSend, smartSendWAWeb } from '@/lib/wa-smart-send'
import axios from 'axios'
import { supabaseAdmin } from './supabase'
import { sendTextMessage } from './whatsapp'

const WHMCS_URL = process.env.WHMCS_URL
const WHMCS_IDENTIFIER = process.env.WHMCS_API_IDENTIFIER
const WHMCS_SECRET = process.env.WHMCS_API_SECRET

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

  // Get user's WhatsApp instance
  const { data: instance } = await db
    .from('whatsapp_instances')
    .select('*')
    .eq('user_id', params.userId)
    .eq('status', 'connected')
    .single()

  if (!instance?.phone_number_id || !instance?.access_token) {
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

  // Replace variables
  for (const [key, value] of Object.entries(params.variables)) {
    message = message.replace(new RegExp(`{{${key}}}`, 'g'), value)
  }

  // Send via WhatsApp
  return smartSend({ userId: (instance as any)?.user_id || (instance as any)?.userId || '', instanceId: (instance as any)?.id || '', phoneNumberId: instance.phone_number_id, accessToken: instance.access_token, to: params.phone, text: message, source: 'notification' as any })
}

export interface WHMCSWebhookPayload {
  action: string
  invoiceid?: string
  ticketid?: string
  userid?: string
  serviceid?: string
}

export async function processWHMCSWebhook(
  userId: string,
  payload: WHMCSWebhookPayload
): Promise<void> {
  const db = supabaseAdmin()

  // Get the contact's phone from WHMCS
  let phone: string | null = null
  let variables: Record<string, string> = {}

  if (payload.userid) {
    const client = await getWHMCSClient(payload.userid)
    phone = client?.phonenumber?.replace(/\D/g, '') || null
    variables.client_name = `${client.firstname} ${client.lastname}`
  }

  if (!phone) return

  const action = payload.action
  let event: Parameters<typeof sendWHMCSNotification>[0]['event'] | null = null

  if (action === 'InvoiceCreated' && payload.invoiceid) {
    const invoice = await getWHMCSInvoice(payload.invoiceid)
    event = 'invoice_created'
    variables = { ...variables, invoice_id: payload.invoiceid, amount: invoice.total, currency: invoice.currencycode, due_date: invoice.duedate, invoice_url: `${WHMCS_URL}/viewinvoice.php?id=${payload.invoiceid}` }
  } else if (action === 'InvoicePaid' && payload.invoiceid) {
    const invoice = await getWHMCSInvoice(payload.invoiceid)
    event = 'invoice_paid'
    variables = { ...variables, invoice_id: payload.invoiceid, amount: invoice.total, currency: invoice.currencycode }
  } else if (action === 'TicketOpen' && payload.ticketid) {
    event = 'ticket_open'
    variables = { ...variables, ticket_id: payload.ticketid, subject: 'Support Request', ticket_url: `${WHMCS_URL}/supporttickets.php` }
  }

  if (event) {
    await sendWHMCSNotification({ userId, phone, event, variables })
  }
}
