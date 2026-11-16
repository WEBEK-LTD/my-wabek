// Minimal Wix REST client for webhook processing (server-side only).
//
// Token: the installation's stored access token if any, else (or when Wix
// answers 401/403 with it) a fresh app token from the client-credentials
// grant (WIX_APP_ID / WIX_APP_SECRET + instance id) — the same token logic
// /api/wix/webhook always used. Every call has a short timeout so a webhook
// stays within its processing budget.

import { requireEnv } from './security'
import { contactPhoneAndName, parseJsonish, type WixEventInfo } from './wix-events'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Obj = Record<string, any>

const WIX_API = 'https://www.wixapis.com'
const DEFAULT_TIMEOUT_MS = 2500

export interface WixApiResult { ok: boolean; status: number; data: Obj | null }

export interface WixApiClient {
  get(path: string, opts?: { timeoutMs?: number }): Promise<WixApiResult>
  post(path: string, body: unknown, opts?: { timeoutMs?: number }): Promise<WixApiResult>
  /** Whether a token is (or can be made) available. */
  canCall(): boolean
}

function appConfigured(): boolean {
  return !!(process.env.WIX_APP_ID && process.env.WIX_APP_SECRET)
}

async function mintAppToken(instanceId: string): Promise<string> {
  try {
    const tokenRes = await fetchWithTimeout(`${WIX_API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type:    'client_credentials',
        client_id:     requireEnv('WIX_APP_ID'),
        client_secret: requireEnv('WIX_APP_SECRET'),
        instance_id:   instanceId,
      }),
    }, DEFAULT_TIMEOUT_MS)
    const td = await tokenRes.json().catch(() => ({}))
    console.log('[wix api] token status:', tokenRes.status, 'hasToken:', !!td.access_token)
    return td.access_token || ''
  } catch (e) {
    console.log('[wix api] token error:', (e as Error)?.message)
    return ''
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

export function createWixApiClient(p: { instanceId: string; storedToken?: string | null; metaSiteId?: string | null }): WixApiClient {
  let token = p.storedToken || ''
  let minted = false
  let warned = false

  async function ensureToken(): Promise<string> {
    if (token) return token
    if (!appConfigured()) {
      if (!warned) console.error('[wix api] Wix app not configured (WIX_APP_ID / WIX_APP_SECRET) — using the webhook data only')
      warned = true
      return ''
    }
    if (minted) return ''
    minted = true
    token = await mintAppToken(p.instanceId)
    return token
  }

  async function call(method: 'GET' | 'POST', path: string, body: unknown, timeoutMs: number): Promise<WixApiResult> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const tk = await ensureToken()
      if (!tk) return { ok: false, status: 0, data: null }
      const headers: Record<string, string> = { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' }
      if (p.metaSiteId) headers['wix-site-id'] = p.metaSiteId
      try {
        const r = await fetchWithTimeout(`${WIX_API}${path}`, {
          method, headers, body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
        }, timeoutMs)
        const data = await r.json().catch(() => null)
        // A stored install token may have expired: retry once with a fresh app token.
        if ((r.status === 401 || r.status === 403) && !minted && appConfigured()) {
          console.log('[wix api] stored token refused (', r.status, ') — minting an app token')
          token = ''
          continue
        }
        return { ok: r.ok, status: r.status, data }
      } catch (e) {
        console.log('[wix api] request failed:', method, path.split('?')[0], (e as Error)?.name === 'AbortError' ? 'timeout' : (e as Error)?.message)
        return { ok: false, status: 0, data: null }
      }
    }
    return { ok: false, status: 0, data: null }
  }

  return {
    get: (path, opts) => call('GET', path, undefined, opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    post: (path, body, opts) => call('POST', path, body, opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    canCall: () => !!token || appConfigured(),
  }
}

/** Phone (E.164 when Wix has it) + first name of a Wix contact. */
export async function fetchWixContact(api: WixApiClient, contactId: string): Promise<{ phone: string; firstName: string } | null> {
  if (!contactId || !api.canCall()) return null
  const r = await api.get(`/contacts/v4/contacts/${encodeURIComponent(contactId)}`)
  if (!r.ok) { console.log('[wix api] contact lookup failed:', r.status); return null }
  return contactPhoneAndName(r.data?.contact || null)
}

/** Phone + first name of a site member (via its contact). */
export async function fetchWixMemberContact(api: WixApiClient, memberId: string): Promise<{ phone: string; firstName: string; contactId: string } | null> {
  if (!memberId || !api.canCall()) return null
  const r = await api.get(`/members/v1/members/${encodeURIComponent(memberId)}?fieldsets=FULL`)
  if (!r.ok) { console.log('[wix api] member lookup failed:', r.status); return null }
  const m = r.data?.member || {}
  const own = contactPhoneAndName({ contact: { phones: m.contact?.phones, firstName: m.contact?.firstName }, profile: m.profile })
  return { ...own, contactId: String(m.contactId || m.contact?.contactId || '') }
}

/** Title + start of a Wix event (Events v3, then v1). */
export async function fetchWixEventInfo(api: WixApiClient, eventId: string): Promise<WixEventInfo | null> {
  if (!eventId || !api.canCall()) return null
  const v3 = await api.get(`/events/v3/events/${encodeURIComponent(eventId)}`, { timeoutMs: 2000 })
  const e3 = v3.ok ? parseJsonish(v3.data?.event) : null
  if (e3?.title) {
    return { title: String(e3.title), startDate: String(e3.dateAndTimeSettings?.startDate || ''), timeZone: String(e3.dateAndTimeSettings?.timeZoneId || '') }
  }
  const v1 = await api.get(`/events/v1/events/${encodeURIComponent(eventId)}`, { timeoutMs: 2000 })
  const e1 = v1.ok ? parseJsonish(v1.data?.event) : null
  if (e1?.title) {
    return { title: String(e1.title), startDate: String(e1.scheduling?.config?.startDate || ''), timeZone: String(e1.scheduling?.config?.timeZoneId || '') }
  }
  console.log('[wix api] event lookup failed:', v3.status, v1.status)
  return null
}

/** The Wix site's language (Site Properties v4), '' if unknown. */
export async function fetchWixSiteLanguage(api: WixApiClient): Promise<string> {
  if (!api.canCall()) return ''
  const r = await api.get('/site-properties/v4/properties?fields.paths=language', { timeoutMs: 1500 })
  return r.ok ? String(r.data?.properties?.language || '') : ''
}
