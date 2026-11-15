// Wix authentication helpers. Server-side only.
//
// 1. verifyWixInstance(): the `instance` query parameter Wix passes to app
//    pages in the site dashboard is `<signature>.<payload>` where
//    payload = base64url(JSON) and signature = base64url(HMAC-SHA256(payload,
//    WIX_APP_SECRET)). Only a correctly signed instance proves the caller is
//    an admin of that Wix site. Plain instance UUIDs prove nothing.
// 2. verifyWixWebhook(): Wix app webhooks are JWTs signed RS256 with the
//    app's private key; we verify them with WIX_PUBLIC_KEY.
// 3. resolveWixCaller(): API routes used by the Wix app page accept either a
//    signed Wix instance (x-wix-instance header / `instance` param) or a
//    logged-in WABEK user (requireAuth). The WABEK user id is always derived
//    server-side, never taken from the request.

import { NextApiRequest, NextApiResponse } from 'next'
import { createHmac } from 'crypto'
import { importSPKI, jwtVerify, KeyLike, JWTPayload as JoseJWTPayload } from 'jose'
import { safeEqual, requireEnv } from './security'
import { supabaseAdmin } from './supabase'
import { requireAuth } from './auth'

export interface WixInstance {
  instanceId: string
  uid?: string
  permissions?: string
  signDate?: string
  vendorProductId?: string
  siteOwnerId?: string
  [k: string]: unknown
}

function toBase64Url(s: string): string {
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Signed instances older than this are refused (Wix re-signs on every page load).
const MAX_INSTANCE_AGE_MS = (Number(process.env.WIX_INSTANCE_MAX_AGE_HOURS) || 48) * 3600 * 1000

/** Verify a Wix `instance` parameter. Returns its payload, or null if unsigned/invalid/expired. */
export function verifyWixInstance(instance: unknown): WixInstance | null {
  if (typeof instance !== 'string') return null
  const raw = instance.split('#')[0].trim()
  const dot = raw.indexOf('.')
  if (dot <= 0 || dot === raw.length - 1) return null
  const signature = raw.slice(0, dot)
  const payload = raw.slice(dot + 1)

  const secret = process.env.WIX_APP_SECRET
  if (!secret) {
    console.error('[wix-auth] WIX_APP_SECRET is not set — cannot verify Wix instances')
    return null
  }
  const expected = createHmac('sha256', secret).update(payload).digest('base64url')
  if (!safeEqual(toBase64Url(signature), expected)) return null

  let data: WixInstance
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (!data || typeof data.instanceId !== 'string' || !data.instanceId) return null

  const now = Date.now()
  if (typeof data.expirationDate === 'string' && new Date(data.expirationDate).getTime() < now) return null
  if (typeof data.signDate === 'string') {
    const signed = new Date(data.signDate).getTime()
    if (!Number.isNaN(signed) && now - signed > MAX_INSTANCE_AGE_MS) return null
  }
  return data
}

/** The signed instance from the request: x-wix-instance header, then `instance` in body/query. */
export function getWixInstanceParam(req: NextApiRequest): string | null {
  const h = req.headers['x-wix-instance']
  if (typeof h === 'string' && h) return h
  const b = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>).instance : undefined
  if (typeof b === 'string' && b) return b
  const q = req.query.instance
  if (typeof q === 'string' && q) return q
  return null
}

/** WABEK user linked to a Wix instance id (oldest link wins if several exist). */
export async function getLinkedUserId(wixInstanceId: string): Promise<string | null> {
  const { data } = await supabaseAdmin()
    .from('wix_user_links')
    .select('user_id, connected_at')
    .eq('wix_instance_id', wixInstanceId)
    .order('connected_at', { ascending: true })
    .limit(1)
  return data?.[0]?.user_id || null
}

export interface WixCaller {
  userId: string
  /** Set when the caller proved a Wix site via a signed instance. */
  wixInstanceId?: string
  wix?: WixInstance
  via: 'wix' | 'session'
}

/**
 * Authenticate an /api/wix/* request. A signed Wix instance wins; otherwise
 * falls back to the WABEK session (requireAuth). Sends 401 and returns null
 * when neither is present/valid.
 */
export async function resolveWixCaller(req: NextApiRequest, res: NextApiResponse): Promise<WixCaller | null> {
  const param = getWixInstanceParam(req)
  if (param) {
    const wix = verifyWixInstance(param)
    if (!wix) {
      res.status(401).json({ error: 'Invalid or expired Wix session. Please reopen the app from your Wix dashboard.' })
      return null
    }
    const userId = await getLinkedUserId(wix.instanceId)
    if (!userId) {
      res.status(401).json({ error: 'Store not connected. Please open the app from your Wix dashboard.' })
      return null
    }
    return { userId, wixInstanceId: wix.instanceId, wix, via: 'wix' }
  }
  const user = await requireAuth(req, res)
  if (!user) return null
  return { userId: user.userId, via: 'session' }
}

// ── Webhooks ──────────────────────────────────────────────────────────────────
let publicKeyPromise: Promise<KeyLike> | null = null

function wixPublicKey(): Promise<KeyLike> {
  if (!publicKeyPromise) {
    let pem = requireEnv('WIX_PUBLIC_KEY').replace(/\\n/g, '\n').trim()
    if (!pem.includes('BEGIN PUBLIC KEY')) {
      const body = pem.replace(/\s+/g, '').match(/.{1,64}/g)?.join('\n') || ''
      pem = `-----BEGIN PUBLIC KEY-----\n${body}\n-----END PUBLIC KEY-----`
    }
    const pending = importSPKI(pem, 'RS256')
    pending.catch(() => { publicKeyPromise = null })
    publicKeyPromise = pending
    return pending
  }
  return publicKeyPromise
}

/** Verify a Wix webhook body (a JWT). Throws if WIX_PUBLIC_KEY is missing; returns null if invalid. */
export async function verifyWixWebhook(rawBody: string): Promise<JoseJWTPayload | null> {
  const key = await wixPublicKey()
  try {
    const { payload } = await jwtVerify(rawBody.trim(), key, { algorithms: ['RS256'] })
    return payload
  } catch {
    return null
  }
}

/** Parse a field that Wix may send as a JSON string or an object. */
export function parseMaybeJson(v: unknown): Record<string, any> | null {
  if (!v) return null
  if (typeof v === 'object') return v as Record<string, any>
  if (typeof v === 'string') {
    try { return JSON.parse(v) } catch { return null }
  }
  return null
}
