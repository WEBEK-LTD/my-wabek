import { supabaseAdmin } from './supabase'

let cache: Record<string, unknown> = {}
let cacheTime = 0
const CACHE_TTL = 60 * 1000 // 1 minute

// ── Keys that are internal state, not configuration ──────────────────────────
// One-time login tokens, OAuth state/tokens: never cached, never listed, and
// never writable through the generic admin settings endpoint.
const RESERVED_PREFIXES = ['magic_login_', 'meta_oauth_']
const RESERVED_KEYS = new Set(['gsc_oauth'])

export function isReservedSettingKey(key: string): boolean {
  return RESERVED_KEYS.has(key) || RESERVED_PREFIXES.some(p => key.startsWith(p))
}

export async function getSetting(key: string, defaultValue: unknown = null): Promise<unknown> {
  if (isReservedSettingKey(key)) return defaultValue
  const now = Date.now()
  if (now - cacheTime > CACHE_TTL) {
    try {
      const db = supabaseAdmin()
      let q = db.from('system_settings').select('key, value')
      for (const p of RESERVED_PREFIXES) q = q.not('key', 'like', `${p}%`)
      const { data } = await q
      cache = {}
      for (const row of data || []) {
        if (isReservedSettingKey(row.key)) continue
        try { cache[row.key] = JSON.parse(row.value) } catch { cache[row.key] = row.value }
      }
      cacheTime = now
    } catch { return defaultValue }
  }
  return key in cache ? cache[key] : defaultValue
}

export async function getSettings(keys: string[]): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {}
  for (const key of keys) result[key] = await getSetting(key)
  return result
}

// ── Secret redaction for values sent to the browser ──────────────────────────
export const REDACTED_PREFIX = '••••'

const SECRET_NAME = /(password|passwd|secret|token|api_?key|private|_key$|^key$|credential)/i

export function isSecretFieldName(name: string): boolean {
  return SECRET_NAME.test(name)
}

export function maskSecret(v: unknown): string {
  const s = typeof v === 'string' ? v : JSON.stringify(v ?? '')
  if (!s) return ''
  return REDACTED_PREFIX + (s.length > 8 ? s.slice(-4) : '')
}

export function isRedactedPlaceholder(v: unknown): boolean {
  return typeof v === 'string' && v.startsWith(REDACTED_PREFIX)
}

/** Deep-copies `value`, replacing every secret-named field with a mask. */
export function redactSecrets(value: unknown, keyName = ''): unknown {
  // Booleans/numbers under secret-ish names (e.g. require_strong_password) are
  // flags, not secrets.
  if (keyName && isSecretFieldName(keyName) &&
      ((typeof value === 'string' && value !== '') || (value && typeof value === 'object'))) {
    return maskSecret(value)
  }
  if (Array.isArray(value)) return value.map(v => redactSecrets(v))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = redactSecrets(v, k)
    return out
  }
  return value
}

/**
 * Reverses redaction on an incoming value: wherever the client sent back a
 * mask placeholder, the previously stored value is kept.
 */
export function restoreRedacted(incoming: unknown, existing: unknown): unknown {
  if (isRedactedPlaceholder(incoming)) return existing
  if (incoming && typeof incoming === 'object' && !Array.isArray(incoming)) {
    const prev = (existing && typeof existing === 'object' ? existing : {}) as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(incoming as Record<string, unknown>)) out[k] = restoreRedacted(v, prev[k])
    return out
  }
  return incoming
}
