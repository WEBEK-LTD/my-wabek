/**
 * Opt-out / opt-in keywords on inbound messages (Cloud API webhook and
 * WA Web events), and the shared "contact subscribed state changed" side
 * effects (outgoing webhooks, opt_in automations).
 *
 * The whole message (trimmed, case-insensitive) must be a keyword:
 *   opt-out: STOP, UNSUBSCRIBE, إلغاء, الغاء, توقف, إيقاف
 *   opt-in : START, اشتراك
 */
import { supabaseAdmin } from './supabase'
import { smartSend, smartSendWAWeb, resolveProvider, phoneVariants } from './wa-smart-send'
import { emitWebhookEvent } from './outgoing-webhooks'

export const OPT_OUT_KEYWORDS = ['stop', 'unsubscribe', 'إلغاء', 'الغاء', 'توقف', 'إيقاف']
export const OPT_IN_KEYWORDS = ['start', 'اشتراك']

const CONFIRM = {
  opt_out: {
    ar: 'تم إلغاء اشتراكك، ولن تصلك منا رسائل بعد الآن. لإعادة الاشتراك أرسل «اشتراك».',
    en: 'You have been unsubscribed and will no longer receive messages from us. Reply START to subscribe again.',
  },
  opt_in: {
    ar: 'تمت إعادة اشتراكك بنجاح، وستصلك رسائلنا من جديد. لإلغاء الاشتراك أرسل «إلغاء».',
    en: 'You are subscribed again and will receive our messages. Reply STOP to unsubscribe.',
  },
} as const

function normalize(text: string): string {
  // Trim, lower-case, drop surrounding punctuation and Arabic tatweel
  return String(text || '').trim().toLowerCase().replace(/ـ/g, '').replace(/^[\s.!؟?،,]+|[\s.!؟?،,]+$/g, '')
}

export function matchOptKeyword(text: unknown): 'opt_out' | 'opt_in' | null {
  if (typeof text !== 'string' || text.length > 40) return null
  const t = normalize(text)
  if (!t) return null
  if (OPT_OUT_KEYWORDS.includes(t)) return 'opt_out'
  if (OPT_IN_KEYWORDS.includes(t)) return 'opt_in'
  return null
}

const isArabic = (s: string) => /[؀-ۿ]/.test(s)

/**
 * Fire the outgoing webhook (opt_out / opt_in) and, on opt-in, the `opt_in`
 * automation flows. Never throws.
 */
export async function onSubscriptionChanged(p: {
  userId: string
  phone: string
  contactId?: string | null
  optedOut: boolean
  source: 'keyword' | 'api' | 'dashboard'
  instanceId?: string | null
}): Promise<void> {
  try {
    await emitWebhookEvent(p.userId, p.optedOut ? 'opt_out' : 'opt_in', {
      phone: p.phone, contact_id: p.contactId || null, opted_out: p.optedOut, source: p.source,
      instance_id: p.instanceId || null,
    })
    if (!p.optedOut) {
      const { fireOptInAutomations } = await import('./automation-engine')
      await fireOptInAutomations({ userId: p.userId, phone: p.phone, instanceId: p.instanceId })
    }
  } catch (e) {
    console.error('[opt-out] side effects failed:', (e as Error)?.message)
  }
}

/**
 * Handle an inbound message that is exactly an opt-out / opt-in keyword:
 * update the contact, confirm once (only when the state actually changed),
 * fire webhooks / automations. Returns the keyword kind when handled — the
 * caller then skips chatbot / AI / automation replies for this message.
 */
export async function handleOptKeyword(p: {
  userId: string
  instance: Record<string, any>
  from: string
  text: unknown
  contactId: string | null
}): Promise<'opt_out' | 'opt_in' | null> {
  const kind = matchOptKeyword(p.text)
  if (!kind) return null
  const db = supabaseAdmin()
  const optedOut = kind === 'opt_out'
  try {
    const variants = phoneVariants(p.from)
    const { data: rows } = await db.from('contacts').select('id, opted_out')
      .eq('user_id', p.userId).in('phone', variants).limit(5)
    const ids = (rows || []).map(r => r.id)
    if (p.contactId && !ids.includes(p.contactId)) ids.push(p.contactId)
    const changed = !(rows || []).length || (rows || []).some(r => (r.opted_out === true) !== optedOut)
    if (ids.length) {
      const { error } = await db.from('contacts').update({ opted_out: optedOut, updated_at: new Date().toISOString() })
        .eq('user_id', p.userId).in('id', ids)
      if (error) {
        console.error('[opt-out] contact update failed:', error.message)
        return kind
      }
    }
    console.log(`[opt-out] ${kind} user=${p.userId} contact=${p.contactId || 'none'} changed=${changed}`)
    if (!changed) return kind

    // Confirmation — the one message sent to a contact who just opted out
    // (bypasses the opt-out guard for this reply only).
    const text = CONFIRM[kind][isArabic(String(p.text)) ? 'ar' : 'en']
    const inst = p.instance
    try {
      if (resolveProvider(inst) === 'wa_web') {
        await smartSendWAWeb({ userId: p.userId, instanceId: inst.id, to: p.from, text, contactId: p.contactId, source: 'notification', bypassLimits: true })
      } else {
        await smartSend({
          userId: p.userId, instanceId: inst.id, phoneNumberId: inst.phone_number_id, accessToken: inst.access_token,
          to: p.from, text, contactId: p.contactId, source: 'notification', bypassLimits: true,
        })
      }
    } catch (e) {
      console.error('[opt-out] confirmation failed:', (e as Error)?.message)
    }

    await onSubscriptionChanged({ userId: p.userId, phone: p.from, contactId: p.contactId, optedOut, source: 'keyword', instanceId: inst.id })
  } catch (e) {
    console.error('[opt-out] keyword handling failed:', (e as Error)?.message)
  }
  return kind
}
