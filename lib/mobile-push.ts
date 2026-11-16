// Push notifications to the WABEK mobile app — sent straight to Apple (APNs)
// and Google (FCM v1), no third-party push service.
//
// Tokens live in public.mobile_push_tokens (migration 036). Sending never
// throws and never blocks a webhook for long (short timeouts); tokens that
// Apple / Google report as gone are removed.
//
// Netlify environment variables:
//   APNS_KEY_ID, APNS_TEAM_ID, APNS_KEY (the .p8 file contents),
//   APNS_BUNDLE_ID (default com.webek.wabek), APNS_SANDBOX=1 for development builds
//   FCM_SERVICE_ACCOUNT (the Firebase service-account JSON)
// A provider without its variables is skipped (logged once).
import http2 from 'node:http2'
import { SignJWT, importPKCS8 } from 'jose'
import { supabaseAdmin } from './supabase'
import { isMissingDbObject, warnMissingOnce } from './db-compat'

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

/** APNs device tokens are hex; FCM registration tokens are long URL-safe strings. */
export function isDevicePushToken(t: unknown, provider: unknown): t is string {
  if (typeof t !== 'string') return false
  if (provider === 'apns') return /^[0-9a-fA-F]{64,200}$/.test(t)
  if (provider === 'fcm') return /^[A-Za-z0-9:_\-.]{100,4096}$/.test(t)
  return false
}

interface TokenRow { token: string; provider: string | null; locale: string | null; prefs: Record<string, unknown> | null }
interface Msg { title: string; body: string; channel: string; data: Record<string, string> }

// ── Apple (APNs, token-based auth with the .p8 key) ─────────────────────────

let apnsJwt: { token: string; at: number } | null = null
async function apnsAuth(): Promise<string | null> {
  const keyId = process.env.APNS_KEY_ID, teamId = process.env.APNS_TEAM_ID, key = process.env.APNS_KEY
  if (!keyId || !teamId || !key) { warnMissingOnce('APNS_KEY_ID / APNS_TEAM_ID / APNS_KEY (iPhone push)'); return null }
  // Apple accepts a provider token for up to an hour; refresh after 50 minutes.
  if (apnsJwt && Date.now() - apnsJwt.at < 50 * 60 * 1000) return apnsJwt.token
  const pk = await importPKCS8(key.replace(/\\n/g, '\n'), 'ES256')
  const token = await new SignJWT({}).setProtectedHeader({ alg: 'ES256', kid: keyId }).setIssuer(teamId).setIssuedAt().sign(pk)
  apnsJwt = { token, at: Date.now() }
  return token
}

async function sendApns(tokens: { token: string; msg: Msg }[]): Promise<string[]> {
  if (!tokens.length) return []
  const auth = await apnsAuth()
  if (!auth) return []
  const host = process.env.APNS_SANDBOX === '1' ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com'
  const topic = process.env.APNS_BUNDLE_ID || 'com.webek.wabek'
  const dead: string[] = []
  const client = http2.connect(host)
  client.on('error', e => console.error('[mobile-push] APNs connection:', e.message))
  try {
    await Promise.all(tokens.map(({ token, msg }) => new Promise<void>(resolve => {
      const payload = JSON.stringify({
        aps: { alert: { title: msg.title, body: msg.body }, sound: 'default', 'thread-id': msg.channel },
        ...msg.data,
        body: msg.data, // read by expo-notifications as the notification's data
      })
      const req = client.request({
        ':method': 'POST', ':path': `/3/device/${token}`,
        authorization: `bearer ${auth}`, 'apns-topic': topic, 'apns-push-type': 'alert', 'apns-priority': '10',
        'content-type': 'application/json',
      })
      const timer = setTimeout(() => { req.close(); resolve() }, 4000)
      let status = 0
      let body = ''
      req.on('response', h => { status = Number(h[':status']) || 0 })
      req.on('data', c => { body += c })
      req.on('end', () => {
        clearTimeout(timer)
        if (status === 410 || (status === 400 && /BadDeviceToken|DeviceTokenNotForTopic/.test(body))) dead.push(token)
        else if (status >= 400) console.error('[mobile-push] APNs', status, body.slice(0, 200))
        resolve()
      })
      req.on('error', () => { clearTimeout(timer); resolve() })
      req.end(payload)
    })))
  } finally {
    client.close()
  }
  return dead
}

// ── Google (FCM HTTP v1, OAuth with the service account) ────────────────────

let fcmAuth: { token: string; exp: number; project: string } | null = null
async function fcmAccess(): Promise<{ token: string; project: string } | null> {
  const raw = process.env.FCM_SERVICE_ACCOUNT
  if (!raw) { warnMissingOnce('FCM_SERVICE_ACCOUNT (Android push)'); return null }
  if (fcmAuth && Date.now() < fcmAuth.exp - 60_000) return fcmAuth
  let sa: { client_email?: string; private_key?: string; project_id?: string }
  try { sa = JSON.parse(raw) } catch { console.error('[mobile-push] FCM_SERVICE_ACCOUNT is not valid JSON'); return null }
  if (!sa.client_email || !sa.private_key || !sa.project_id) return null
  const pk = await importPKCS8(sa.private_key.replace(/\\n/g, '\n'), 'RS256')
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/firebase.messaging' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(sa.client_email).setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt().setExpirationTime('1h').sign(pk)
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    signal: AbortSignal.timeout(4000),
  })
  const j = (await r.json().catch(() => ({}))) as { access_token?: string; expires_in?: number }
  if (!r.ok || !j.access_token) { console.error('[mobile-push] FCM auth failed', r.status); return null }
  fcmAuth = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000, project: sa.project_id }
  return fcmAuth
}

async function sendFcm(tokens: { token: string; msg: Msg }[]): Promise<string[]> {
  if (!tokens.length) return []
  const auth = await fcmAccess()
  if (!auth) return []
  const dead: string[] = []
  await Promise.all(tokens.map(async ({ token, msg }) => {
    try {
      const r = await fetch(`https://fcm.googleapis.com/v1/projects/${auth.project}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: msg.title, body: msg.body },
            data: { ...msg.data, body: JSON.stringify(msg.data) },
            android: { priority: 'HIGH', notification: { channel_id: msg.channel, sound: 'default' } },
          },
        }),
        signal: AbortSignal.timeout(4000),
      })
      if (r.status === 404 || r.status === 400) {
        const t = await r.text()
        if (/UNREGISTERED|registration-token-not-registered|INVALID_ARGUMENT.*token/i.test(t)) dead.push(token)
        else console.error('[mobile-push] FCM', r.status, t.slice(0, 200))
      } else if (!r.ok) {
        console.error('[mobile-push] FCM', r.status)
      }
    } catch { /* timeout / network: skip this one */ }
  }))
  return dead
}

/** Send one notification kind to every app install of an account. Never throws. */
export async function sendMobilePush(userId: string, kind: MobilePushKind, vars: Vars, extra: Record<string, string> = {}): Promise<void> {
  try {
    const db = supabaseAdmin()
    const { data, error } = await db.from('mobile_push_tokens').select('token, provider, locale, prefs').eq('user_id', userId).limit(50)
    if (error) {
      if (isMissingDbObject(error)) warnMissingOnce('mobile_push_tokens (mobile app push)', error)
      return
    }
    const rows = ((data || []) as TokenRow[]).filter(r => isDevicePushToken(r.token, r.provider) && r.prefs?.[PREF[kind]] !== false)
    if (!rows.length) return

    const build = (r: TokenRow) => {
      const lang = r.locale === 'ar' ? 'ar' : 'en'
      const t = TEXT[lang][kind]
      const msg: Msg = {
        title: fill(t.title, vars).slice(0, 120),
        body: fill(t.body, vars).slice(0, 240),
        channel: kind === 'message' ? 'messages' : 'alerts',
        data: { route: ROUTE[kind], kind, ...extra },
      }
      return { token: r.token, msg }
    }
    const [deadA, deadF] = await Promise.all([
      sendApns(rows.filter(r => r.provider === 'apns').map(build)),
      sendFcm(rows.filter(r => r.provider === 'fcm').map(build)),
    ])
    const dead = [...deadA, ...deadF]
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
