import { smartSend, smartSendWAWeb } from '@/lib/wa-smart-send'
import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { notifyInvoiceCreated, notifyInvoiceOverdue, notifyPaymentReminder, notifyServiceNotification, sendNotification } from '@/lib/wa-notifications'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  const { phone, event } = req.body
  if (!phone) return res.status(400).json({ error: 'phone required' })

  const { data: instances } = await db
    .from('whatsapp_instances')
    .select('*')
    .eq('user_id', user.userId)
    .eq('status', 'connected')
    .limit(1)

  const instance = instances?.[0]
  if (!instance) return res.status(400).json({ error: 'No connected WhatsApp instance' })

  const templates: Record<string, string> = {
    invoice_created: `🧾 *Test: New Invoice #1234*\n\nHi Test Client,\n\nTotal: $99.00 USD\nDue: ${new Date(Date.now() + 7 * 86400000).toLocaleDateString()}\n\nPay here: https://your-whmcs.com/viewinvoice.php?id=1234\n\n_This is a test message from WABEK_`,
    invoice_paid: `✅ *Test: Payment Received*\n\nHi Test Client,\n\nYour payment of $99.00 USD for invoice #1234 has been received.\n\nThank you! 🙏\n\n_This is a test message from WABEK_`,
    invoice_overdue: `⚠️ *Test: Overdue Invoice #1234*\n\nHi Test Client,\n\nYour invoice of $99.00 USD is overdue.\n\n_This is a test message from WABEK_`,
    ticket_open: `🎫 *Test: Support Ticket #42*\n\nHi Test Client,\n\nYour support ticket has been received.\nSubject: Help with my service\n\nOur team will respond shortly.\n\n_This is a test message from WABEK_`,
    ticket_reply: `💬 *Test: Ticket Reply #42*\n\nHi Test Client,\n\nA new reply has been added to your support ticket.\n\n_This is a test message from WABEK_`,
    service_active: `🚀 *Test: Service Activated*\n\nHi Test Client,\n\nYour service has been activated!\n\n_This is a test message from WABEK_`,
    service_suspended: `🔴 *Test: Service Suspended*\n\nHi Test Client,\n\nYour service has been suspended due to non-payment.\n\n_This is a test message from WABEK_`,
    payment_reminder: `💰 *Test: Payment Reminder*\n\nHi Test Client,\n\nInvoice #1234 is due in 3 days. Amount: $99.00 USD\n\n_This is a test message from WABEK_`,
  }

  const message = templates[event] || templates['invoice_paid']

  try {
    if (instance.type === 'wa_web' || instance.type === 'baileys') {
      await smartSendWAWeb({ userId: user.userId, instanceId: instance.id, to: phone, text: message })
    } else {
      await smartSend({ userId: user.userId, instanceId: instance?.id || inst?.id || '', phoneNumberId: instance.phone_number_id, accessToken: instance.access_token, to: phone, text: message, forceTemplate: false })
    }
    return res.status(200).json({ 
      success: true, 
      message: `Test sent to ${phone}`,
      instance: instance.display_name || instance.phone_number,
    })
  } catch (err: unknown) {
    const msg = (err as Error).message
    console.error('WHMCS test send error:', msg)
    return res.status(500).json({ error: msg || 'Send failed — check your WhatsApp instance is connected' })
  }
}
