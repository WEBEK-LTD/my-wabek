/**
 * WABEK Smart Send — Auto 24-hour window detection
 * Uses text messages inside window, templates outside
 *
 * This module is also the ONE place where tenant sends are checked against
 * the plan's monthly message limit and the recipient's opt-out / blocked
 * flags (see checkSendAllowed). Only platform system messages (OTP, password
 * reset, welcome) skip it, with `bypassLimits: true`.
 */
import { supabaseAdmin } from '@/lib/supabase'
import { sendTextMessage, sendTemplateMessage, sendMediaMessage } from '@/lib/whatsapp'
import { sendWAWebMessage, sendWAWebMedia } from '@/lib/wa-web'
import { insertMessage } from '@/lib/message-insert'
import { assertSafeMediaUrl } from '@/lib/media-storage'
import { checkPlanLimit } from '@/lib/middleware'
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

// ── Central send guard: plan limits + opt-out/blocked ─────────

export interface SendGuardResult {
  allowed: boolean
  code?: 'plan_limit' | 'opted_out' | 'blocked'
  error?: string
}

const planCache = new Map<string, { allowed: boolean; limit: number; current: number; exp: number }>()
const roleCache = new Map<string, { role: string; exp: number }>()

async function isPlatformAdmin(userId: string): Promise<boolean> {
  const hit = roleCache.get(userId)
  if (hit && hit.exp > Date.now()) return hit.role === 'admin'
  try {
    const { data } = await supabaseAdmin().from('users').select('role').eq('id', userId).maybeSingle()
    const role = String(data?.role || 'user')
    roleCache.set(userId, { role, exp: Date.now() + 60_000 })
    return role === 'admin'
  } catch {
    return false
  }
}

function phoneVariants(to: string): string[] {
  const digits = String(to || '').replace(/[^0-9]/g, '')
  const out = new Set<string>()
  if (to) out.add(String(to))
  if (digits) { out.add(digits); out.add(`+${digits}`) }
  return Array.from(out)
}

/**
 * Returns whether `userId` may send to `to` right now:
 *  - the recipient is not opted out / blocked in this tenant's contacts;
 *  - the tenant is under its plan's monthly message limit (platform admins
 *    are not plan-limited).
 * `bypassLimits` is for platform system messages only (OTP etc.).
 */
export async function checkSendAllowed(
  userId: string,
  to: string,
  opts: { bypassLimits?: boolean } = {}
): Promise<SendGuardResult> {
  if (opts.bypassLimits) return { allowed: true }
  if (!userId) return { allowed: false, code: 'plan_limit', error: 'Unknown sender' }

  // 1. Recipient opted out / blocked by this tenant
  try {
    const { data: rows, error } = await supabaseAdmin()
      .from('contacts')
      .select('opted_out, is_blocked')
      .eq('user_id', userId)
      .in('phone', phoneVariants(to))
      .limit(5)
    if (!error) {
      if (rows?.some(r => r.opted_out === true)) return { allowed: false, code: 'opted_out', error: 'Recipient has opted out' }
      if (rows?.some(r => r.is_blocked === true)) return { allowed: false, code: 'blocked', error: 'Recipient is blocked' }
    }
  } catch (e) {
    console.error('[send-guard] contact check failed (allowing):', e instanceof Error ? e.message : e)
  }

  // 2. Monthly message limit
  if (await isPlatformAdmin(userId)) return { allowed: true }
  const now = Date.now()
  let entry = planCache.get(userId)
  if (!entry || entry.exp <= now) {
    const r = await checkPlanLimit(userId, 'messages')
    entry = { allowed: r.allowed, limit: r.limit, current: r.current, exp: now + 30_000 }
    planCache.set(userId, entry)
  }
  if (!entry.allowed || (entry.limit > 0 && entry.current >= entry.limit)) {
    // MESSAGE_LIMIT_MODE=log: rollout switch — log only, do not block.
    if (process.env.MESSAGE_LIMIT_MODE === 'log') {
      console.warn(`[send-guard] user ${userId} is over the monthly message limit (${entry.current}/${entry.limit}) — not blocking (MESSAGE_LIMIT_MODE=log)`)
      return { allowed: true }
    }
    return { allowed: false, code: 'plan_limit', error: 'Monthly message limit reached for your plan' }
  }
  // Count this send locally until the cache refreshes
  entry.current += 1
  return { allowed: true }
}

/**
 * Plan check for CREATING a WhatsApp instance. Existing instances are never
 * affected — this only gates new ones. Platform admins are not limited.
 */
export async function checkInstanceCreateAllowed(userId: string): Promise<{ allowed: boolean; error?: string }> {
  if (await isPlatformAdmin(userId)) return { allowed: true }
  const r = await checkPlanLimit(userId, 'instances')
  if (r.allowed) return { allowed: true }
  return { allowed: false, error: `Your plan allows ${r.limit} WhatsApp number(s). Upgrade your plan to add more.` }
}

interface SmartSendParams {
  userId: string
  instanceId: string
  phoneNumberId: string
  accessToken: string
  to: string
  text: string
  contactId?: string | null
  templateKey?: TemplateKey
  templateNameOverride?: string
  templateComponents?: unknown[]
  templateLanguage?: string
  forceTemplate?: boolean
  messageType?: string
  source?: 'support_reply' | 'campaign' | 'ai_assistant' | 'chatbot' | 'flow' | 'automation' | 'api' | 'notification' | 'live_chat'
  campaignId?: string
  ticketId?: string
  flowId?: string
  sentBy?: string  // actualUserId of the team member who sent (for performance tracking)
  bypassLimits?: boolean  // platform system messages only (OTP etc.)
}

export interface SmartSendResult {
  messageId: string | null
  method: 'text' | 'template' | 'wa_web' | 'media'
  templateUsed?: string
  inWindow: boolean
  error?: string
  blocked?: SendGuardResult['code']
}

/**
 * Check if a recipient is within the 24-hour messaging window.
 * The window is per recipient number AND per sending instance: only a
 * message from THIS number to THIS instance opens it.
 */
export async function isInWindow(userId: string, phone: string, instanceId?: string): Promise<boolean> {
  const db = supabaseAdmin()
  const cleanPhone = phone.replace(/[^0-9]/g, '')

  // WhatsApp's 24-hour window belongs to one business number: only a message
  // the customer sent TO the sending instance opens it. When we know the
  // instance, count only its inbound messages and never the account-wide
  // contact.last_seen (a message to another number, or a WA Web chat, would
  // make us send plain text that Meta later rejects with 131047).
  const scoped = Boolean(instanceId)

  // Find contact(s) by phone — tolerate duplicates and a stored "+" prefix
  const { data: contactRows } = await db
    .from('contacts')
    .select('id, last_seen')
    .eq('user_id', userId)
    .in('phone', [cleanPhone, `+${cleanPhone}`])
    .limit(5)
  const contact = contactRows?.[0] || null
  const contactIds = (contactRows || []).map(c => c.id).filter(Boolean)

  // Check last inbound message specifically from this contact
  // Try contact_id first (most reliable)
  let lastInbound: string | null = null

  if (contactIds.length) {
    let query = db
      .from('messages')
      .select('created_at')
      .eq('user_id', userId)
      .in('contact_id', contactIds)
      .eq('direction', 'inbound')
    if (scoped) query = query.eq('instance_id', instanceId as string)
    const { data: msg } = await query
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (msg?.created_at) lastInbound = msg.created_at
  }

  // Fallback: check wa_from column if it exists
  if (!lastInbound) {
    let query = db
      .from('messages')
      .select('created_at')
      .eq('user_id', userId)
      .eq('direction', 'inbound')
      .eq('wa_from', cleanPhone)
    if (scoped) query = query.eq('instance_id', instanceId as string)
    const { data: msg } = await query
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (msg?.created_at) lastInbound = msg.created_at
  }

  // Last resort (only when the instance is unknown): contact last_seen
  const lastActivity = lastInbound || (scoped ? null : contact?.last_seen) || null
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
    contactId, templateKey, templateNameOverride, templateComponents: templateComponentsInput = [], templateLanguage = 'en',
    forceTemplate = false, messageType = 'text', sentBy, bypassLimits,
  } = params
  let templateComponents: unknown[] = templateComponentsInput

  const cleanPhone = to.replace(/[^0-9]/g, '')

  // Full send context log
  const {
    source = 'api',
    campaignId = null,
    ticketId = null,
  } = params

  // Plan limit / opt-out (OTP codes are platform system messages)
  const guard = await checkSendAllowed(userId, cleanPhone, { bypassLimits: bypassLimits || templateKey === 'OTP' })
  if (!guard.allowed) {
    console.log(`[SEND] blocked source=${source} instance_id=${instanceId} reason=${guard.code}`)
    return { messageId: null, method: 'text', inWindow: false, error: guard.error, blocked: guard.code }
  }

  // Check 24h window — per recipient: only THIS number's last inbound
  // message to THIS instance opens it (never another contact's message).
  let inWindow = false
  if (!forceTemplate) {
    inWindow = await isInWindow(userId, cleanPhone, instanceId)
  }

  const windowDecision = forceTemplate ? 'FORCE_TEMPLATE' : inWindow ? 'IN_WINDOW' : 'OUTSIDE_WINDOW'

  const decidedMethod = (inWindow && !forceTemplate) ? 'text' : 'template'
  const templateName = templateNameOverride || (templateKey ? await getTemplateName(templateKey as TemplateKey) : 'none')
  console.log(`[SEND] source=${source} instance_id=${instanceId} provider=CLOUD_API phone=${cleanPhone} method=${decidedMethod} inWindow=${inWindow} window=${windowDecision} template=${templateName} campaign_id=${campaignId || 'none'} ticket_id=${ticketId || 'none'}`)

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
        messageId = result.messages?.[0]?.id || null
        method = 'text'
      } catch (sendErr: any) {
        const metaErr = sendErr?.response?.data || sendErr?.message
        console.error(`[smart-send] Meta text FAILED status=${sendErr?.response?.status} body=`, JSON.stringify(metaErr))
        throw sendErr
      }
    } else {
      // Outside 24h window — use template
      // Use provided templateKey OR fallback to broadcast_notification (safe default - only needs customer_name)
      const fallbackKey = (templateKey || 'BROADCAST') as TemplateKey
      templateUsed = templateNameOverride || await getTemplateName(fallbackKey) || 'broadcast_notification'

      // If using fallback template and no components provided, add customer_name
      if (!templateKey && (!templateComponents || (templateComponents as any[]).length === 0)) {
        templateComponents = [{ type: 'body', parameters: [{ type: 'text', parameter_name: 'customer_name', text: 'Customer' }] }]
      }

      console.log(`[smart-send] OUTSIDE WINDOW → template "${templateUsed}" to ${cleanPhone}`)

      // Only send components if they have actual parameters
      const hasComponents = Array.isArray(templateComponents) && templateComponents.length > 0 &&
        (templateComponents as any[]).some((c: any) => c?.parameters?.length > 0)

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
        messageId = result.messages?.[0]?.id || null
        method = 'template'
      } catch (sendErr: any) {
        const metaErr = sendErr?.response?.data || sendErr?.message
        console.error(`[smart-send] Meta template FAILED status=${sendErr?.response?.status} phone_number_id=${phoneNumberId} body=`, JSON.stringify(metaErr))
        throw sendErr
      }
    }

    console.log(`[smart-send] ✅ method=${method} template=${templateUsed || 'none'} messageId=${messageId}`)
  } catch (e: any) {
    // Meta's own error message is actionable for the tenant; internal errors are not exposed.
    error = e?.response?.data?.error?.message || 'Send failed'
    console.error(`[smart-send] ❌ FAILED: ${e?.response?.data?.error?.message || e?.message}`)
  }

  // Save to messages table (skip if this wa_message_id is already stored)
  if (messageId) {
    const { data: existing } = await db
      .from('messages')
      .select('id')
      .eq('wa_message_id', messageId)
      .eq('instance_id', instanceId)
      .limit(1)
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
        meta: { method, source, ...(templateUsed ? { template: templateUsed } : {}), ...(sentBy ? { sent_by: sentBy } : {}) },
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
  source?: string
  sentBy?: string  // actualUserId of the team member who sent (for performance tracking)
  bypassLimits?: boolean  // platform system messages only (OTP etc.)
}): Promise<SmartSendResult> {
  // WA Web — no templates, no 24h window restriction
  const db = supabaseAdmin()
  const { userId, instanceId, to, text, contactId, source = 'api', sentBy } = params
  // Preserve full JID for @lid/@g.us/@s.whatsapp.net contacts — stripping
  // to digits-only and re-appending the default suffix server-side sends
  // to the WRONG (non-existent) JID for @lid contacts, causing send errors.
  const isJid = /@(lid|g\.us|s\.whatsapp\.net|broadcast)$/.test(to)
  const cleanPhone = isJid ? to : to.replace(/[^0-9]/g, '')

  const guard = await checkSendAllowed(userId, cleanPhone, { bypassLimits: params.bypassLimits })
  if (!guard.allowed) {
    console.log(`[SEND] blocked source=${source} instance_id=${instanceId} provider=WA_WEB reason=${guard.code}`)
    return { messageId: null, method: 'wa_web', inWindow: true, error: guard.error, blocked: guard.code }
  }

  console.log(`[smart-send] START instance_id=${instanceId} instance_type=wa_web provider=WA_WEB phone=${cleanPhone} method=text`)
  try {
    const result = await sendWAWebMessage({ instanceId, to: cleanPhone, text })
    const messageId = result.messageId || null
    console.log(`[smart-send] WA Web send result: messageId=${messageId}`)

    // Save to DB regardless of messageId — if messageId is null we still
    // need the message persisted so it survives a page refresh.
    // Only skip if an identical wa_message_id already exists (dedup).
    let shouldInsert = true
    if (messageId) {
      const { data: existing } = await db.from('messages').select('id').eq('wa_message_id', messageId).eq('instance_id', instanceId).limit(1).maybeSingle()
      if (existing) {
        console.log(`[smart-send] message ${messageId} already in DB, skipping insert`)
        shouldInsert = false
      }
    }

    if (shouldInsert) {
      const { error: insertErr } = await insertMessage({
        user_id: userId,
        instance_id: instanceId,
        contact_id: contactId || null,
        wa_message_id: messageId,
        direction: 'outbound',
        type: 'text',
        content: text,
        status: 'sent',
        meta: { method: 'text', source, ...(sentBy ? { sent_by: sentBy } : {}) },
      })
      if (insertErr) {
        console.error(`[smart-send] DB insert error:`, insertErr)
      } else {
        console.log(`[smart-send] ✅ message saved to DB wa_message_id=${messageId}`)
      }
    }

    return { messageId, method: 'wa_web', inWindow: true }
  } catch (e: any) {
    console.error(`[smart-send] WA Web error:`, e?.message)
    return { messageId: null, method: 'wa_web', inWindow: true, error: 'Send failed (WhatsApp Web)' }
  }
}

/**
 * Media send for both providers (Cloud API + WA Web), behind the same send
 * guard and the SSRF check. Cloud API media is only deliverable inside the
 * 24h window; the caller gets `error: 'outside_window'` otherwise. Inserts
 * the outbound message row.
 */
export async function smartSendMedia(params: {
  userId: string
  instance: { id: string; instance_type?: string; type?: string; phone_number_id?: string | null; access_token?: string | null }
  to: string
  mediaUrl: string
  mediaType: string
  caption?: string
  mimeType?: string
  filename?: string
  contactId?: string | null
  source?: string
  sentBy?: string
}): Promise<SmartSendResult> {
  const { userId, instance, to, caption, contactId, source = 'api', sentBy } = params
  const provider = resolveProvider(instance)
  const isJid = /@(lid|g\.us|s\.whatsapp\.net|broadcast)$/.test(to)
  const cleanPhone = isJid ? to : to.replace(/[^0-9]/g, '')
  const mediaType = params.mediaType || 'document'

  let mediaUrl: string
  try {
    mediaUrl = await assertSafeMediaUrl(params.mediaUrl)
  } catch {
    return { messageId: null, method: 'media', inWindow: false, error: 'Media URL not allowed' }
  }

  const guard = await checkSendAllowed(userId, cleanPhone)
  if (!guard.allowed) {
    return { messageId: null, method: 'media', inWindow: false, error: guard.error, blocked: guard.code }
  }

  let messageId: string | null = null
  let inWindow = true
  try {
    if (provider === 'wa_web') {
      const r = await sendWAWebMedia({
        instanceId: instance.id, to: cleanPhone, mediaUrl, mediaType,
        caption: caption || undefined, filename: params.filename || undefined, mimetype: params.mimeType || undefined,
      })
      messageId = r.messageId || null
    } else {
      inWindow = await isInWindow(userId, cleanPhone, instance.id)
      if (!inWindow) return { messageId: null, method: 'media', inWindow: false, error: 'outside_window' }
      // Cloud API has no "ptt" send type — voice notes go as regular audio.
      const sendType = (mediaType === 'ptt' ? 'audio' : mediaType) as 'image' | 'document' | 'audio' | 'video' | 'sticker'
      const result = await sendMediaMessage({
        phoneNumberId: String(instance.phone_number_id || ''),
        accessToken: String(instance.access_token || ''),
        to: cleanPhone,
        type: sendType,
        mediaUrl,
        caption: caption || undefined,
        filename: sendType === 'document' ? (params.filename || undefined) : undefined,
      })
      messageId = result?.messages?.[0]?.id || null
    }
  } catch (e: any) {
    console.error(`[smart-send] media send failed provider=${provider}:`, e?.response?.data || e?.message)
    return { messageId: null, method: 'media', inWindow, error: e?.response?.data?.error?.message || 'Media send failed' }
  }

  const { error: insertErr } = await insertMessage({
    user_id: userId, instance_id: instance.id, contact_id: contactId || null,
    wa_message_id: messageId, direction: 'outbound',
    type: mediaType, content: caption || '',
    media_url: mediaUrl, media_mime_type: params.mimeType || null, media_filename: params.filename || null,
    status: 'sent', meta: { method: 'media', source, ...(sentBy ? { sent_by: sentBy } : {}) },
  })
  if (insertErr) console.error('[smart-send] media DB insert error:', insertErr)

  return { messageId, method: 'media', inWindow }
}
