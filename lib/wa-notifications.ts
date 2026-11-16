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
  // Platform system messages only (OTP, password reset, welcome). These are
  // also bypassed automatically by templateKey below.
  bypassLimits?: boolean
}

// Map template keys to Meta template names + their parameter names in order
export const TEMPLATE_MAP = {
  // NOTE: This map is kept in sync with the templates Approved on Meta
  // (Business Manager > WhatsApp Manager > Message Templates). Each entry's
  // paramNames/paramStyle MUST match the template's actual body exactly --
  // a mismatch causes Meta error 132000/131008 and (previously) silent
  // fallback to the wrong template.
  OTP: {
    name: 'wabek_otp',
    // Body: "*{{1}}* is your verification code." -- POSITIONAL, 1 param.
    paramNames: ['otp_code'],
    paramStyle: 'positional' as const,
  },
  PASSWORD_RESET: {
    name: 'password_reset',
    // Body: "Hello {{customer_name}}, A password reset request was received..."
    paramNames: ['customer_name'],
    paramStyle: 'named' as const,
  },
  WELCOME: {
    name: 'welcome_message_v2',
    // Body: "Hello, Welcome to Wabek..." -- no variables.
    paramNames: [],
    paramStyle: 'named' as const,
  },
  WELCOME_V1: {
    name: 'welcome_message',
    // Body: "Hello, Thank you for contacting Wabek..." -- no variables.
    paramNames: [],
    paramStyle: 'named' as const,
  },
  SUPPORT_TICKET_OPEN: {
    name: 'support_ticket_update',
    // Body: "Hello {{customer_name}}, We have an important update regarding your service..."
    paramNames: ['customer_name'],
    paramStyle: 'named' as const,
  },
  SUPPORT_REPLY: {
    name: 'support_reply',
    // Body: "You have received a new reply... Message: {{message}} ..."
    paramNames: ['message'],
    paramStyle: 'named' as const,
  },
  PAYMENT_REMINDER: {
    name: 'payment_reminder',
    // Body: "Hello {{customer_name}}, This is a reminder that you have an unpaid invoice..."
    paramNames: ['customer_name'],
    paramStyle: 'named' as const,
  },
  INVOICE_CREATED: {
    name: 'invoice_created',
    // Body: "Hello {{customer_name}}, A new invoice has been generated..."
    paramNames: ['customer_name'],
    paramStyle: 'named' as const,
  },
  INVOICE_OVERDUE: {
    name: 'invoice_overdue',
    // Body: "Hello {{customer_name}}, Your invoice is overdue..."
    paramNames: ['customer_name'],
    paramStyle: 'named' as const,
  },
  SERVICE_NOTIFICATION: {
    name: 'service_notification',
    // Body: "Hello {{customer_name}}, We have an important update regarding your service..."
    paramNames: ['customer_name'],
    paramStyle: 'named' as const,
  },
  AI_FOLLOWUP: {
    name: 'ai_assistant_followup',
    // Body: "Hello {{customer_name}}, Our AI assistant has prepared a response..."
    paramNames: ['customer_name'],
    paramStyle: 'named' as const,
  },
  MARKETING: {
    name: 'marketing_offer',
    // Body (updated Jun 12 2026): "Hello {{customer_name}}, {{offer_details}} Thank you, Wabek Team"
    paramNames: ['customer_name', 'offer_details'],
    paramStyle: 'named' as const,
  },
  BROADCAST: {
    name: 'broadcast_notification',
    // Body: "Hello {{customer_name}}, We have an important announcement..."
    paramNames: ['customer_name'],
    paramStyle: 'named' as const,
  },
} as const

export type NotificationKey = keyof typeof TEMPLATE_MAP

// Platform system messages: never blocked by plan limits or opt-out.
const SYSTEM_TEMPLATE_KEYS = new Set<string>(['OTP', 'PASSWORD_RESET', 'WELCOME', 'WELCOME_V1'])

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

  // Build body parameters in correct order, matching the template's
  // approved style: "named" uses {{customer_name}}-style variables and
  // requires `parameter_name`; "positional" uses {{1}}, {{2}}... and must
  // NOT include `parameter_name`.
  const paramStyle = (tmpl as any).paramStyle === 'positional' ? 'positional' : 'named'
  const parameters = tmpl.paramNames.map(name => (
    paramStyle === 'positional'
      ? { type: 'text' as const, text: p.params[name] || '' }
      : { type: 'text' as const, parameter_name: name, text: p.params[name] || '' }
  ))

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

  // Never log params: they can contain OTP codes and reset links.
  console.log(`[notify] ${p.templateKey} → template=${tmpl.name} phone=${cleanPhone} params=${Object.keys(p.params).join(',')}`)

  const provider = resolveProvider(inst)
  const bypassLimits = p.bypassLimits === true || SYSTEM_TEMPLATE_KEYS.has(p.templateKey)
  console.log(`[notify] instance_id=${inst.id} instance_type=${inst.instance_type} provider=${provider.toUpperCase()} phone=${cleanPhone} template=${tmpl.name}`)

  if (provider === 'wa_web') {
    const r = await smartSendWAWeb({
      userId: p.userId, instanceId: inst.id,
      to: cleanPhone, text: p.fallbackText, contactId: p.contactId, bypassLimits,
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
    bypassLimits,
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
