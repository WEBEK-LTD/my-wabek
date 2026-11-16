// API-key authentication for external integrations (/api/v1, /api/gateway,
// /api/webhooks/*, wix setup). Server-side only.
//
// Keys are accepted from headers: `X-API-Key: <key>` or
// `Authorization: Bearer <key>`. Query-string / body keys (`?api_key=`,
// `?key=`, body.api_key) are still accepted for existing WHMCS / WordPress /
// Digits / Wix-automation installs, with a deprecation warning, unless
// ALLOW_QUERY_API_KEY=0. New plugins use headers.

import { NextApiRequest } from 'next'
import { createHash } from 'crypto'
import { supabaseAdmin } from './supabase'
import { safeEqual } from './security'

export interface ApiKeyAuth {
  userId: string
  via: 'api_key' | 'legacy_user_key' | 'jwt'
  /** api_keys.id when authenticated with a key from Settings → API Keys */
  keyId?: string
  /** api_keys.permissions; null/empty = full access (legacy keys) */
  permissions?: string[] | null
}

// ── API key permissions ───────────────────────────────────────────────────────
// Names stored in api_keys.permissions. 'contacts' (the old default) grants
// both contacts:read and contacts:write; contacts:write implies read.
export const API_KEY_PERMISSIONS = ['send', 'contacts:read', 'contacts:write', 'otp'] as const
export type ApiKeyPermission = typeof API_KEY_PERMISSIONS[number]
export const LEGACY_API_KEY_PERMISSIONS = ['contacts'] as const

export function isValidApiKeyPermission(p: unknown): boolean {
  return typeof p === 'string' &&
    ((API_KEY_PERMISSIONS as readonly string[]).includes(p) || (LEGACY_API_KEY_PERMISSIONS as readonly string[]).includes(p))
}

/** Empty / missing permissions = full access (backward compatible). */
export function apiKeyHasPermission(auth: Pick<ApiKeyAuth, 'permissions'>, needed: ApiKeyPermission): boolean {
  const perms = Array.isArray(auth.permissions) ? auth.permissions.map(String) : []
  if (!perms.length) return true
  if (perms.includes('*') || perms.includes(needed)) return true
  if (needed.startsWith('contacts:') && perms.includes('contacts')) return true
  if (needed === 'contacts:read' && perms.includes('contacts:write')) return true
  return false
}

function headerKey(req: NextApiRequest): { key: string | null; bearer: string | null } {
  const x = req.headers['x-api-key']
  const auth = req.headers.authorization
  const bearer = typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7).trim() || null : null
  return { key: typeof x === 'string' && x.trim() ? x.trim() : null, bearer }
}

function legacyKey(req: NextApiRequest, allowBody: boolean): string | null {
  const q = req.query.api_key ?? req.query.key
  if (typeof q === 'string' && q.trim()) return q.trim()
  if (allowBody && req.body && typeof req.body === 'object') {
    const b = (req.body as Record<string, unknown>).api_key
    if (typeof b === 'string' && b.trim()) return b.trim()
  }
  return null
}

export function queryApiKeyAllowed(): boolean {
  return process.env.ALLOW_QUERY_API_KEY !== '0'
}

/** Look up an API key: api_keys.key_hash (sha256), then the legacy users.api_key column. */
export async function lookupApiKey(apiKey: string): Promise<ApiKeyAuth | null> {
  if (!apiKey || apiKey.length > 256) return null
  const db = supabaseAdmin()
  const keyHash = createHash('sha256').update(apiKey).digest('hex')

  const { data: rows } = await db
    .from('api_keys')
    .select('id, user_id, permissions')
    .eq('key_hash', keyHash)
    .eq('is_active', true)
    .limit(1)
  const keyRecord = rows?.[0]
  if (keyRecord?.user_id) {
    db.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyRecord.id).then(() => {}, () => {})
    return {
      userId: keyRecord.user_id, via: 'api_key', keyId: keyRecord.id,
      permissions: Array.isArray(keyRecord.permissions) ? keyRecord.permissions : null,
    }
  }

  // Legacy per-user key (not every user has an api_keys row yet). The value is
  // re-checked in constant time after the lookup.
  const { data: users } = await db
    .from('users')
    .select('id, api_key')
    .eq('api_key', apiKey)
    .eq('is_active', true)
    .limit(1)
  const u = users?.[0]
  if (u?.id && safeEqual(String(u.api_key || ''), apiKey)) return { userId: u.id, via: 'legacy_user_key' }
  return null
}

/**
 * Authenticate an integration request.
 * - allowJwt: a valid WABEK session JWT in `Authorization: Bearer` is accepted (dashboard calls).
 * - allowBody: also read `api_key` from the body (legacy, gated like the query string).
 */
export async function authenticateApiKey(
  req: NextApiRequest,
  opts: { allowJwt?: boolean; allowBody?: boolean; route?: string } = {}
): Promise<ApiKeyAuth | null> {
  const { key, bearer } = headerKey(req)

  if (bearer && opts.allowJwt && bearer.split('.').length === 3) {
    // Full session check (suspended users, revoked token_version, team
    // membership → owner's account) — same rules as requireAuth.
    const { getAuthUser } = await import('./auth')
    const r = await getAuthUser(req)
    if (r.ok) return { userId: r.payload.userId, via: 'jwt' }
    return null
  }

  const headerCandidate = key || bearer
  if (headerCandidate) return lookupApiKey(headerCandidate)

  const legacy = legacyKey(req, !!opts.allowBody)
  if (!legacy) return null
  if (!queryApiKeyAllowed()) return null
  console.warn(`[api-key] DEPRECATED: API key sent in the query string/body on ${opts.route || req.url?.split('?')[0]} — send it in the X-API-Key header instead`)
  return lookupApiKey(legacy)
}

const _apiLogAt = new Map<string, number>()

/**
 * Plan gate for the integration API (/api/v1, /api/gateway): the account's
 * plan must have `allow_api_access`. Platform admins and dashboard (JWT)
 * calls are not gated. Only enforced with API_ACCESS_MODE=enforce; the
 * default is log-only (rollout switch).
 */
export async function apiPlanAllowed(auth: ApiKeyAuth): Promise<boolean> {
  if (auth.via === 'jwt') return true
  const db = supabaseAdmin()
  try {
    const { data } = await db.from('users').select('role').eq('id', auth.userId).maybeSingle()
    if (data?.role === 'admin') return true
  } catch { /* fall through to the plan check */ }
  const { checkPlanFeature } = await import('./middleware')
  const ok = await checkPlanFeature(auth.userId, 'allow_api_access')
  // Rollout switch: LOG-ONLY unless API_ACCESS_MODE=enforce, so existing
  // integrations (WordPress / WHMCS plugins, Zapier, custom code) keep working
  // on the day this ships.
  if (!ok && process.env.API_ACCESS_MODE !== 'enforce') {
    const now = Date.now()
    if ((_apiLogAt.get(auth.userId) || 0) < now - 60 * 60 * 1000) {
      _apiLogAt.set(auth.userId, now)
      if (_apiLogAt.size > 5000) _apiLogAt.clear()
      console.warn(`[api-key] user ${auth.userId} has no allow_api_access on its plan — not blocking (API_ACCESS_MODE is not 'enforce')`)
    }
    return true
  }
  return ok
}

export const PLAN_NO_API_ERROR = {
  error: 'Your plan does not include API access. Upgrade your plan to use the WABEK API.',
  code: 'plan_no_api',
  upgrade_required: true,
} as const

export function permissionDeniedError(perm: ApiKeyPermission) {
  return {
    error: `This API key does not have the "${perm}" permission`,
    code: 'permission_denied',
    required: perm,
  }
}
