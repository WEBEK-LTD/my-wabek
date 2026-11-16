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
    .select('id, user_id')
    .eq('key_hash', keyHash)
    .eq('is_active', true)
    .limit(1)
  const keyRecord = rows?.[0]
  if (keyRecord?.user_id) {
    db.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyRecord.id).then(() => {}, () => {})
    return { userId: keyRecord.user_id, via: 'api_key' }
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
