// Push notifications to the WABEK mobile app (Expo push service).
//
// Tokens live in public.mobile_push_tokens (migration 036). Sending never
// throws and never blocks a webhook for long: one request to Expo with a
// short timeout; tokens Expo reports as unregistered are removed.
import { supabaseAdmin } from './supabase'
import { isMissingDbObject, warnMissingOnce } from './db-compat'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

export type MobilePushKind = 'message' | 'number_disconnected' | 'number_connected' | 'campaign_done'
  // admins only (sendAdminPush)
  | 'support_ticket' | 'support_reply' | 'deletion_request'
  // the customer: support answered their ticket
  | 'support_answered'

type Vars = Record<string, string | number>

const TEXT: Record<'en' | 'ar', Record<MobilePushKind, { title: string; body: string }>> = {
  en: {
    message: { title: '{from}', body: '{preview}' },
    number_disconnected: { title: 'WhatsApp number disconnected', body: '{phone} is offline. Tap to reconnect.' },
    number_connected: { title: 'WhatsApp number connected', body: '{phone} is ready to send.' },
    campaign_done: { title: 'Campaign finished', body: '"{name}": {sent} sent, {failed} failed.' },
    support_ticket: { title: 'New support ticket #{number}', body: '{from}: {subject}' },
    support_reply: { title: 'Customer replied on #{number}', body: '{from}: {preview}' },
    deletion_request: { title: 'Account deletion requested', body: '{email} asked to delete their account.' },
    support_answered: { title: 'Support replied to #{number}', body: '{preview}' },
  },
  ar: {
    message: { title: '{from}', body: '{preview}' },
    number_disconnected: { title: 'رقم واتساب فصل', body: '{phone} غير متصل. اضغط لإعادة الربط.' },
    number_connected: { title: 'تم ربط رقم واتساب', body: '{phone} جاهز للإرسال.' },
    campaign_done: { title: 'الحملة خلصت', body: '«{name}»: اتبعت {sent}، وفشل {failed}.' },
    support_ticket: { title: 'تذكرة دعم جديدة #{number}', body: '{from}: {subject}' },
    support_reply: { title: 'رد العميل على #{number}', body: '{from}: {preview}' },
    deletion_request: { title: 'طلب حذف حساب', body: '{email} طلب حذف حسابه.' },
    support_answered: { title: 'الدعم رد على #{number}', body: '{preview}' },
  },
}

/** Screen the app opens when the notification is tapped. */
const ROUTE: Record<MobilePushKind, string> = {
  message: 'inbox',
  number_disconnected: 'numbers',
  number_connected: 'numbers',
  campaign_done: 'analytics',
  support_ticket: 'admin_support',
  support_reply: 'admin_support',
  deletion_request: 'admin_users',
  support_answered: 'support',
}

const PREF: Record<MobilePushKind, string> = {
  message: 'messages',
  number_disconnected: 'numbers',
  number_connected: 'numbers',
  campaign_done: 'campaigns',
  support_ticket: 'admin',
  support_reply: 'admin',
  deletion_request: 'admin',
  support_answered: 'messages',
}

const fill = (s: string, vars: Vars) => s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined ? m : String(vars[k])))

export function isExpoPushToken(t: unknown): t is string {
  return typeof t === 'string' && /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,200}\]$/.test(t)
}

interface TokenRow { token: string; locale: string | null; prefs: Record<string, unknown> | null }

/** Send one notification kind to every app install of an account. Never throws. */
export async function sendMobilePush(userId: string, kind: MobilePushKind, vars: Vars, extra: Record<string, string> = {}): Promise<void> {
  try {
    const db = supabaseAdmin()
    const { data, error } = await db.from('mobile_push_tokens').select('token, locale, prefs').eq('user_id', userId).limit(50)
    if (error) {
      if (isMissingDbObject(error)) warnMissingOnce('mobile_push_tokens (mobile app push)', error)
      return
    }
    const rows = ((data || []) as TokenRow[]).filter(r => isExpoPushToken(r.token) && (r.prefs?.[PREF[kind]] !== false))
    if (!rows.length) return

    const messages = rows.map(r => {
      const lang = r.locale === 'ar' ? 'ar' : 'en'
      const t = TEXT[lang][kind]
      return {
        to: r.token,
        title: fill(t.title, vars).slice(0, 120),
        body: fill(t.body, vars).slice(0, 240),
        sound: 'default',
        priority: 'high',
        channelId: kind === 'message' ? 'messages' : 'alerts',
        data: { route: ROUTE[kind], kind, ...extra },
      }
    })

    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 4000)
    let res: Response
    try {
      res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', Accept: 'application/json', 'Accept-Encoding': 'gzip, deflate',
          // Optional: with "Enhanced push security" on in Expo, only requests with this token are accepted.
          ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify(messages),
        signal: ctrl.signal,
      })
    } finally {
      clearTimeout(timer)
    }
    if (!res.ok) {
      console.error('[mobile-push] Expo returned', res.status)
      return
    }
    const json = (await res.json().catch(() => null)) as { data?: { status?: string; details?: { error?: string } }[] } | null
    const dead = (json?.data || [])
      .map((d, i) => (d?.status === 'error' && d.details?.error === 'DeviceNotRegistered' ? messages[i].to : null))
      .filter((t): t is string => !!t)
    if (dead.length) await db.from('mobile_push_tokens').delete().in('token', dead)
  } catch (e) {
    console.error('[mobile-push] send failed:', e instanceof Error ? e.message : e)
  }
}

/** Admin alerts (support tickets, deletion requests) to every admin's app. Never throws. */
export async function sendAdminPush(kind: Extract<MobilePushKind, 'support_ticket' | 'support_reply' | 'deletion_request'>, vars: Vars, extra: Record<string, string> = {}): Promise<void> {
  try {
    const { data } = await supabaseAdmin().from('users').select('id').eq('role', 'admin').eq('is_active', true).limit(20)
    await Promise.all((data || []).map(a => sendMobilePush(a.id as string, kind, vars, extra)))
  } catch (e) {
    console.error('[mobile-push] admin push failed:', e instanceof Error ? e.message : e)
  }
}
