/**
 * WABEK Smart Send — Auto 24-hour window detection
 * Uses text messages inside window, templates outside
 */
import { supabaseAdmin } from '@/lib/supabase'
import { sendTextMessage, sendTemplateMessage } from '@/lib/whatsapp'
import { sendWAWebMessage } from '@/lib/wa-web'
import { v4 as uuidv4 } from 'uuid'

// ── Provider resolver — single source of truth ────────────────
export function resolveProvider(instance: { instance_type?: string; type?: string }): 'wa_web' | 'cloud_api' {
  // ONLY trust instance_type — 'type' column is legacy and may contain stale values
  if (instance.instance_type === 'wa_web') return 'wa_web'
  if (instance.instance_type === 'cloud_api') return 'cloud_api'
  // Fallback to type column if instance_type is missing
  if (instance.type === 'wa_web') return 'wa_web'
  return 'cloud_api'  // default to cloud_api
}

export const TEMPLATES = {
  OTP:                  'wabek_otp',
  WELCOME:              'welcome_message_v2',
  SUPPORT_REPLY:        'support_ticket_update',
  AI_FOLLOWUP:          'ai_assistant_followup',
  PAYMENT_REMINDER:     'payment_reminder',
  SERVICE_NOTIFICATION: 'service_notification',
  MARKETING:            'marketing_offer',
  BROADCAST:            'broadcast_notification',
  INVOICE_CREATED:      'invoice_created',
  INVOICE_OVERDUE:      'invoice_overdue',
  PASSWORD_RESET:       'password_reset',
} as const

export type TemplateKey = keyof typeof TEMPLATES

interface SmartSendParams {
  userId: string
  instanceId: string
  phoneNumberId: string
  accessToken: string
  to: string
  text: string
  contactId?: string | null
  templateKey?: TemplateKey
  templateComponents?: unknown[]
  templateLanguage?: string
  forceTemplate?: boolean
  messageType?: string
  // Source tracking — mandatory for debugging
  source?: 'support_reply' | 'campaign' | 'ai_assistant' | 'chatbot' | 'flow' | 'automation' | 'api' | 'notification'
  campaignId?: string
  ticketId?: string
  flowId?: string
}

export interface SmartSendResult {
  messageId: string | null
  method: 'text' | 'template' | 'wa_web'
  templateUsed?: string
  inWindow: boolean
  error?: string
}

/** Check if contact is within 24-hour messaging window */
export async function isInWindow(userId: string, phone: string, instanceId?: string): Promise<boolean> {
  const db = supabaseAdmin()
  const cleanPhone = phone.replace(/[^0-9]/g, '')

  // Find contact by phone
  const { data: contact } = await db
    .from('contacts')
    .select('id, last_seen')
    .eq('user_id', userId)
    .eq('phone', cleanPhone)
    .maybeSingle()

  // Check last inbound message specifically from this contact
  // Try contact_id first (most reliable)
  let lastInbound: string | null = null

  if (contact?.id) {
    const { data: msg } = await db
      .from('messages')
      .select('created_at')
      .eq('user_id', userId)
      .eq('contact_id', contact.id)
      .eq('direction', 'inbound')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (msg?.created_at) lastInbound = msg.created_at
  }

  // Fallback: check wa_from column if it exists
  if (!lastInbound) {
    const { data: msg } = await db
      .from('messages')
      .select('created_at')
      .eq('user_id', userId)
      .eq('direction', 'inbound')
      .eq('wa_from', cleanPhone)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (msg?.created_at) lastInbound = msg.created_at
  }

  // Last resort: contact last_seen
  const lastActivity = lastInbound || contact?.last_seen || null
  if (!lastActivity) return false

  const diff = Date.now() - new Date(lastActivity).getTime()
  const hours24 = 24 * 60 * 60 * 1000
  return diff < hours24
}

/** Get template config from system_settings or use default */
export async function getTemplateName(templateKey: TemplateKey): Promise<string> {
  const db = supabaseAdmin()
  const { data } = await db
    .from('system_settings')
    .select('value')
    .eq('key', 'wa_templates')
    .maybeSingle()

  const config = data?.value as Record<string, string> | null
  return config?.[templateKey] || TEMPLATES[templateKey]
}

/** Main smart send function */
export async function smartSend(params: SmartSendParams): Promise<SmartSendResult> {
  const db = supabaseAdmin()
  const {
    userId, instanceId, phoneNumberId, accessToken, to, text,
    contactId, templateKey, templateComponents: templateComponentsInput = [], templateLanguage = 'en',
    forceTemplate = false, messageType = 'text'
  } = params
  let templateComponents: unknown[] = templateComponentsInput

  const cleanPhone = to.replace(/[^0-9]/g, '')

  // Full send context log
  const {
    source = 'api',
    campaignId = null,
    ticketId = null,
    flowId = null,
  } = params

  // Check 24h window
  let lastInboundAt: string | null = null
  let hoursSinceInbound: number | null = null
  let inWindow = false

  if (!forceTemplate && templateKey) {
    const db2 = supabaseAdmin()
    const { data: lastMsg } = await db2.from('messages')
      .select('created_at')
      .eq('user_id', userId)
      .eq('direction', 'inbound')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (lastMsg?.created_at) {
      lastInboundAt = lastMsg.created_at
      hoursSinceInbound = Math.round((Date.now() - new Date(lastMsg.created_at).getTime()) / 3600000 * 10) / 10
      inWindow = hoursSinceInbound < 24
    }
  } else if (!forceTemplate) {
    inWindow = await isInWindow(userId, cleanPhone, instanceId)
  }

  const windowDecision = forceTemplate ? 'FORCE_TEMPLATE' : inWindow ? 'IN_WINDOW' : 'OUTSIDE_WINDOW'

  const decidedMethod = (inWindow && !forceTemplate) ? 'text' : 'template'
  const templateName = templateKey ? await getTemplateName(templateKey as TemplateKey) : 'none'
  console.log(`[SEND] source=${source} instance_id=${instanceId} provider=CLOUD_API phone=${cleanPhone} method=${decidedMethod} inWindow=${inWindow} window=${windowDecision} hours_since=${hoursSinceInbound ?? 'n/a'} template=${templateName} campaign_id=${campaignId || 'none'} ticket_id=${ticketId || 'none'}`)

  let messageId: string | null = null
  let method: SmartSendResult['method'] = 'text'
  let templateUsed: string | undefined
  let error: string | undefined

  try {
    if (inWindow && !forceTemplate) {
      // Send normal text message
      console.log(`[smart-send] IN WINDOW → text message to ${cleanPhone} phoneNumberId=${phoneNumberId}`)
      try {
        const result = await sendTextMessage({ phoneNumberId, accessToken, to: cleanPhone, text })
        console.log(`[smart-send] Meta text response:`, JSON.stringify(result))
        messageId = result.messages?.[0]?.id || null
        method = 'text'
      } catch (sendErr: any) {
        const metaErr = sendErr?.response?.data || sendErr?.response || sendErr?.message
        console.error(`[smart-send] Meta text FAILED status=${sendErr?.response?.status} body=`, JSON.stringify(metaErr))
        throw sendErr
      }
    } else {
      // Outside 24h window — use template
      // Use provided templateKey OR fallback to broadcast_notification (safe default - only needs customer_name)
      const fallbackKey = (templateKey || 'BROADCAST') as TemplateKey
      templateUsed = await getTemplateName(fallbackKey) || 'broadcast_notification'

      // If using fallback template and no components provided, add customer_name
      if (!templateKey && (!templateComponents || (templateComponents as any[]).length === 0)) {
        templateComponents = [{ type: 'body', parameters: [{ type: 'text', parameter_name: 'customer_name', text: 'Customer' }] }]
      }

      console.log(`[smart-send] OUTSIDE WINDOW → template "${templateUsed}" to ${cleanPhone}`)

      // Only send components if they have actual parameters
      const hasComponents = Array.isArray(templateComponents) && templateComponents.length > 0 &&
        (templateComponents as any[]).some((c: any) => c?.parameters?.length > 0)

      console.log(`[smart-send] calling Meta template API: POST /${phoneNumberId}/messages`)
      console.log(`[smart-send] template="${templateUsed}" to=${cleanPhone} lang=${templateLanguage} hasComponents=${hasComponents}`)
      let result: any
      try {
        result = await sendTemplateMessage({
          phoneNumberId,
          accessToken,
          to: cleanPhone,
          templateName: templateUsed,
          languageCode: templateLanguage,
          components: hasComponents ? templateComponents : [],
        })
        console.log(`[smart-send] Meta template response status=200 body=`, JSON.stringify(result))
        messageId = result.messages?.[0]?.id || null
        method = 'template'
      } catch (sendErr: any) {
        const metaErr = sendErr?.response?.data || sendErr?.response || sendErr?.message
        console.error(`[smart-send] Meta template FAILED status=${sendErr?.response?.status} url=https://graph.facebook.com/v20.0/${phoneNumberId}/messages body=`, JSON.stringify(metaErr))
        throw sendErr
      }
    }

    console.log(`[smart-send] ✅ method=${method} template=${templateUsed || 'none'} messageId=${messageId}`)
  } catch (e: any) {
    error = e?.response?.data?.error?.message || e.message
    console.error(`[smart-send] ❌ FAILED: ${error}`)
  }

  // Save to messages table (no duplicate check)
  if (messageId) {
    // Check for duplicate wa_message_id before insert
    const { data: existing } = await db
      .from('messages')
      .select('id')
      .eq('wa_message_id', messageId)
      .maybeSingle()

    if (!existing) {
      const { error: insertErr } = await db.from('messages').insert({
        id: uuidv4(),
        user_id: userId,
        instance_id: instanceId,
        contact_id: contactId || null,
        wa_message_id: messageId,
        direction: 'outbound',
        type: messageType,
        content: text,
        status: 'sent',
        campaign_id: campaignId || null,
        meta: templateUsed ? { template: templateUsed, method } : { method },
      })
      if (insertErr) {
        console.error(`[smart-send] DB insert error: ${insertErr.message}`)
      }
    } else {
      console.log(`[smart-send] skip duplicate wa_message_id=${messageId}`)
    }
  }

  return { messageId, method, templateUsed, inWindow, error }
}

/** Send via WA Web (Baileys) — no window check needed, Baileys handles it */
export async function smartSendWAWeb(params: {
  userId: string
  instanceId: string
  to: string
  text: string
  contactId?: string | null
}): Promise<SmartSendResult> {
  // WA Web — no templates, no 24h window restriction
  const db = supabaseAdmin()
  const { userId, instanceId, to, text, contactId } = params
  const cleanPhone = to.replace(/[^0-9]/g, '')

  console.log(`[smart-send] START instance_id=${instanceId} instance_type=wa_web provider=WA_WEB phone=${cleanPhone} method=text`)
  try {
    const result = await sendWAWebMessage({ instanceId, to: cleanPhone, text })
    const messageId = result.messageId || null

    if (messageId) {
      const { data: existing } = await db.from('messages').select('id').eq('wa_message_id', messageId).maybeSingle()
      if (!existing) {
        await db.from('messages').insert({
          id: uuidv4(),
          user_id: userId,
          instance_id: instanceId,
          contact_id: contactId || null,
          wa_message_id: messageId,
          direction: 'outbound',
          type: 'text',
          content: text,
          status: 'sent',
        })
      }
    }

    return { messageId, method: 'wa_web', inWindow: true }
  } catch (e: any) {
    return { messageId: null, method: 'wa_web', inWindow: true, error: e.message }
  }
}
