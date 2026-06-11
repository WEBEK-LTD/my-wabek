/**
 * WABEK Notification System
 * Centralized WhatsApp notifications with template support
 * All outbound notifications route through here
 */
import { supabaseAdmin } from '@/lib/supabase'
import { smartSend, smartSendWAWeb, resolveProvider } from '@/lib/wa-smart-send'
import { v4 as uuidv4 } from 'uuid'

interface NotifyParams {
  userId: string
  phone: string
  templateKey: keyof typeof TEMPLATE_MAP
  // Named params matching the template variables
  params: Record<string, string>
  // Fallback text if template fails or WA Web
  fallbackText: string
  contactId?: string | null
}

// Map template keys to Meta template names + their parameter names in order
export const TEMPLATE_MAP = {
  OTP: {
    name: 'wabek_otp',
    paramNames: ['otp_code'],
    // This template's approved design includes a URL button whose dynamic
    // suffix is the OTP code itself (e.g. https://waabek.com/verify?code={{1}}).
    // Meta requires this button parameter even though the body uses a
    // named parameter (otp_code).
    buttons: [
      { type: 'url' as const, index: 0, paramFrom: 'otp_code' },
    ],
  },
  PASSWORD_RESET: {
    name: 'password_reset',
    paramNames: ['customer_name', 'reset_link'],
  },
  WELCOME: {
    name: 'welcome_message_v2',
    paramNames: ['customer_name'],
  },
  SUPPORT_TICKET_OPEN: {
    name: 'support_ticket_update',
    paramNames: [],  // no params
  },
  SUPPORT_REPLY: {
    name: 'support_ticket_update',
    paramNames: [],  // no params
  },
  PAYMENT_REMINDER: {
    name: 'payment_reminder',
    paramNames: ['customer_name', 'amount', 'due_date'],
  },
  INVOICE_CREATED: {
    name: 'invoice_created',
    paramNames: ['customer_name', 'invoice_id', 'amount', 'due_date'],
  },
  INVOICE_OVERDUE: {
    name: 'invoice_overdue',
    paramNames: ['customer_name', 'invoice_id', 'amount'],
  },
  SERVICE_NOTIFICATION: {
    name: 'service_notification',
    paramNames: ['customer_name', 'message'],
  },
  MARKETING: {
    name: 'marketing_offer',
    paramNames: ['customer_name'],
  },
  BROADCAST: {
    name: 'broadcast_notification',
    paramNames: ['customer_name'],
  },
} as const

export type NotificationKey = keyof typeof TEMPLATE_MAP

async function getAdminInstance(userId: string) {
  const db = supabaseAdmin()
  const CONNECTED = ['connected', 'active', 'open', 'ready']
  const { data: insts } = await db
    .from('whatsapp_instances')
    .select('id,phone_number_id,access_token,instance_type,type,status')
    .eq('user_id', userId)
    .in('status', CONNECTED)
    .limit(1)
  let inst = insts?.[0]
  if (!inst) {
    const { data: any } = await db
      .from('whatsapp_instances')
      .select('id,phone_number_id,access_token,instance_type,type,status')
      .eq('user_id', userId)
      .limit(1)
    inst = any?.[0]
  }
  return inst
}

export async function sendNotification(p: NotifyParams): Promise<{ success: boolean; messageId?: string | null; method?: string; error?: string }> {
  const cleanPhone = p.phone.replace(/[^0-9]/g, '')
  if (!cleanPhone || cleanPhone.length < 7) {
    return { success: false, error: 'Invalid phone number' }
  }

  const inst = await getAdminInstance(p.userId)
  if (!inst) return { success: false, error: 'No WhatsApp instance found' }

  // provider resolved above
  const tmpl = TEMPLATE_MAP[p.templateKey]

  // Build named parameters in correct order
  const parameters = tmpl.paramNames.map(name => ({
    type: 'text' as const,
    parameter_name: name,
    text: p.params[name] || '',
  }))

  const components: any[] = parameters.length > 0
    ? [{ type: 'body', parameters }]
    : []

  // Add button components if this template has buttons requiring dynamic params
  const buttonsConfig = (tmpl as any).buttons as
    { type: 'url' | 'copy_code'; index: number; paramFrom: string }[] | undefined

  if (buttonsConfig) {
    for (const btn of buttonsConfig) {
      const value = p.params[btn.paramFrom] || ''
      if (btn.type === 'copy_code') {
        components.push({
          type: 'button',
          sub_type: 'copy_code',
          index: String(btn.index),
          parameters: [{ type: 'coupon_code', coupon_code: value }],
        })
      } else {
        components.push({
          type: 'button',
          sub_type: 'url',
          index: String(btn.index),
          parameters: [{ type: 'text', text: value }],
        })
      }
    }
  }

  console.log(`[notify] ${p.templateKey} → template=${tmpl.name} phone=${cleanPhone} params=${JSON.stringify(p.params)} components=${JSON.stringify(components)}`)

  const provider = resolveProvider(inst)
  console.log(`[notify] instance_id=${inst.id} instance_type=${inst.instance_type} provider=${provider.toUpperCase()} phone=${cleanPhone} template=${tmpl.name}`)

  if (provider === 'wa_web') {
    const r = await smartSendWAWeb({
      userId: p.userId, instanceId: inst.id,
      to: cleanPhone, text: p.fallbackText, contactId: p.contactId,
    })
    console.log(`[notify] result instance_id=${inst.id} provider=WA_WEB method=text message_id=${r.messageId || 'null'} error=${r.error || 'none'}`)
    return { success: !r.error, messageId: r.messageId, method: 'wa_web', error: r.error }
  }

  const r = await smartSend({
    userId: p.userId,
    instanceId: inst.id,
    phoneNumberId: inst.phone_number_id,
    accessToken: inst.access_token,
    to: cleanPhone,
    text: p.fallbackText,
    contactId: p.contactId,
    templateKey: p.templateKey as any,
    templateLanguage: 'en',
    templateComponents: components,
    forceTemplate: true,
    source: 'notification' as const,
  })

  console.log(`[notify] result instance_id=${inst.id} provider=CLOUD_API method=${r.method} template=${r.templateUsed || 'none'} message_id=${r.messageId || 'null'} error=${r.error || 'none'}`)
  return { success: !r.error, messageId: r.messageId, method: r.method, error: r.error }
}

// ── Convenience helpers ────────────────────────────────────

export const notifyOTP = (userId: string, phone: string, otp: string, contactId?: string) =>
  sendNotification({
    userId, phone, templateKey: 'OTP', contactId,
    params: { otp_code: otp },
    fallbackText: `Your verification code is: *${otp}*\n\nValid for 5 minutes. Do not share this code.`,
  })

export const notifyWelcome = (userId: string, phone: string, name: string, contactId?: string) =>
  sendNotification({
    userId, phone, templateKey: 'WELCOME', contactId,
    params: { customer_name: name || 'Customer' },
    fallbackText: `Welcome to WABEK, ${name}! 🎉\n\nYour account is ready. Start automating your WhatsApp business today.`,
  })

export const notifyPasswordReset = (userId: string, phone: string, name: string, link: string, contactId?: string) =>
  sendNotification({
    userId, phone, templateKey: 'PASSWORD_RESET', contactId,
    params: { customer_name: name || 'Customer', reset_link: link },
    fallbackText: `Hi ${name}, click here to reset your password:\n${link}\n\nLink expires in 1 hour.`,
  })

export const notifyInvoiceCreated = (userId: string, phone: string, name: string, invoiceId: string, amount: string, dueDate: string, contactId?: string) =>
  sendNotification({
    userId, phone, templateKey: 'INVOICE_CREATED', contactId,
    params: { customer_name: name || 'Customer', invoice_id: invoiceId, amount, due_date: dueDate },
    fallbackText: `Hi ${name},\n\n🧾 New invoice #${invoiceId}\nAmount: ${amount}\nDue: ${dueDate}`,
  })

export const notifyInvoiceOverdue = (userId: string, phone: string, name: string, invoiceId: string, amount: string, contactId?: string) =>
  sendNotification({
    userId, phone, templateKey: 'INVOICE_OVERDUE', contactId,
    params: { customer_name: name || 'Customer', invoice_id: invoiceId, amount },
    fallbackText: `⚠️ Hi ${name}, your invoice #${invoiceId} (${amount}) is overdue. Please pay now to avoid service interruption.`,
  })

export const notifyPaymentReminder = (userId: string, phone: string, name: string, amount: string, dueDate: string, contactId?: string) =>
  sendNotification({
    userId, phone, templateKey: 'PAYMENT_REMINDER', contactId,
    params: { customer_name: name || 'Customer', amount, due_date: dueDate },
    fallbackText: `💳 Hi ${name}, reminder: payment of ${amount} is due on ${dueDate}.`,
  })

export const notifyServiceNotification = (userId: string, phone: string, name: string, message: string, contactId?: string) =>
  sendNotification({
    userId, phone, templateKey: 'SERVICE_NOTIFICATION', contactId,
    params: { customer_name: name || 'Customer', message },
    fallbackText: `📢 Hi ${name},\n\n${message}`,
  })
