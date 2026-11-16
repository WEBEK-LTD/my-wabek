// Shared security helpers. Server-side only.
import { NextApiRequest, NextApiResponse } from 'next'
import { createHmac, randomInt, timingSafeEqual } from 'crypto'
import { lookup } from 'dns/promises'
import net from 'net'

// ── Constant-time comparison ──────────────────────────────────────────────────
export function safeEqual(a: unknown, b: unknown): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

// ── Required env (fail closed) ────────────────────────────────────────────────
export function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required environment variable: ${name}`)
  return v
}

// ── JWT signing secret ────────────────────────────────────────────────────────
// Same resolution order as the code that is live today, so existing sessions
// stay valid: JWT_SECRET → SUPABASE_JWT_SECRET → SUPABASE_JWT_SECRET_KEY.
// There is deliberately NO hard-coded fallback: with none of them set every
// sign/verify fails closed.
export const JWT_SECRET_ENV_NAMES = ['JWT_SECRET', 'SUPABASE_JWT_SECRET', 'SUPABASE_JWT_SECRET_KEY'] as const

let _warnedJwtFallback = false
export function getJwtSecret(): string | null {
  for (const name of JWT_SECRET_ENV_NAMES) {
    const v = process.env[name]
    if (v) {
      if (name !== 'JWT_SECRET' && !_warnedJwtFallback) {
        _warnedJwtFallback = true
        console.warn(`[security] JWT_SECRET is not set — signing with ${name}. Set JWT_SECRET to the same value.`)
      }
      return v
    }
  }
  return null
}

/** The JWT signing secret, or throws (fail closed — callers turn this into a 500). */
export function requireJwtSecret(): string {
  const v = getJwtSecret()
  if (!v) throw new Error('Missing required environment variable: JWT_SECRET')
  return v
}

// ── Cron / internal system calls ──────────────────────────────────────────────
// Accepts the secret ONLY from a header (never the query string, which ends up
// in access logs). Uses CRON_SECRET; when it is not set, a stable secret is
// derived from the JWT signing secret: HMAC-SHA256(jwtSecret, 'wabek-cron-v1')
// in hex. The Netlify scheduled functions (netlify/functions/*.mts) derive
// the identical value in the same env, so cron keeps working; the raw JWT
// secret itself is never sent anywhere.
export const CRON_DERIVATION_LABEL = 'wabek-cron-v1'

let _warnedCronDerived = false
export function getCronSecret(): string | null {
  const explicit = process.env.CRON_SECRET
  if (explicit) return explicit
  const jwt = getJwtSecret()
  if (!jwt) return null
  if (!_warnedCronDerived) {
    _warnedCronDerived = true
    console.warn('[security] CRON_SECRET is not set — using a secret derived from the JWT signing secret. Set CRON_SECRET on Netlify and Railway.')
  }
  return createHmac('sha256', jwt).update(CRON_DERIVATION_LABEL).digest('hex')
}

export function getCronSecretFromReq(req: NextApiRequest): string | null {
  const h = req.headers['x-cron-secret']
  if (typeof h === 'string' && h) return h
  const auth = req.headers.authorization
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return null
}

export function isCronRequest(req: NextApiRequest): boolean {
  const expected = getCronSecret()
  if (!expected) return false
  return safeEqual(getCronSecretFromReq(req), expected)
}

export function requireCron(req: NextApiRequest, res: NextApiResponse): boolean {
  if (!getCronSecret()) {
    res.status(500).json({ error: 'CRON_SECRET is not configured' })
    return false
  }
  if (!isCronRequest(req)) {
    res.status(401).json({ error: 'Unauthorized' })
    return false
  }
  return true
}

// ── HTML escaping (emails, server-rendered snippets) ──────────────────────────
export function escapeHtml(input: unknown): string {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ── Secure random codes ───────────────────────────────────────────────────────
export function randomDigits(len = 6): string {
  let s = ''
  for (let i = 0; i < len; i++) s += String(randomInt(0, 10))
  return s
}

export function randomCode(len: number, alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'): string {
  let s = ''
  for (let i = 0; i < len; i++) s += alphabet[randomInt(0, alphabet.length)]
  return s
}

// ── Signed, expiring state for OAuth flows ────────────────────────────────────
function stateKey(): string {
  return process.env.OAUTH_STATE_SECRET || requireJwtSecret()
}

export function signState(payload: Record<string, unknown>, ttlSeconds = 600): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString('base64url')
  const sig = createHmac('sha256', stateKey()).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyState<T = Record<string, unknown>>(state: unknown): T | null {
  if (typeof state !== 'string' || !state.includes('.')) return null
  const [body, sig] = state.split('.', 2)
  let expected: string
  try {
    expected = createHmac('sha256', stateKey()).update(body).digest('base64url')
  } catch {
    return null // no signing secret configured → fail closed
  }
  if (!safeEqual(sig, expected)) return null
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (typeof data.exp !== 'number' || data.exp < Math.floor(Date.now() / 1000)) return null
    return data as T
  } catch {
    return null
  }
}

// ── SSRF protection ───────────────────────────────────────────────────────────
function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    )
  }
  const v6 = ip.toLowerCase()
  if (v6 === '::1' || v6 === '::') return true
  if (v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80')) return true
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isPrivateIp(mapped[1])
  return false
}

/** Throws unless `raw` is an http(s) URL whose host resolves only to public IPs. */
export async function assertPublicUrl(raw: string, opts: { httpsOnly?: boolean } = {}): Promise<URL> {
  let url: URL
  try { url = new URL(raw) } catch { throw new Error('Invalid URL') }
  const allowed = opts.httpsOnly ? ['https:'] : ['http:', 'https:']
  if (!allowed.includes(url.protocol)) throw new Error('URL scheme not allowed')
  if (url.username || url.password) throw new Error('Credentials in URL not allowed')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
    throw new Error('Host not allowed')
  }
  const addrs = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true })
  if (!addrs.length || addrs.some(a => isPrivateIp(a.address))) throw new Error('Host not allowed')
  return url
}

/** fetch() that re-validates every redirect hop, with a timeout and a body size cap. */
export async function safeFetch(
  raw: string,
  init: RequestInit & { timeoutMs?: number; maxBytes?: number; maxRedirects?: number; httpsOnly?: boolean } = {}
): Promise<{ status: number; headers: Headers; body: Buffer; url: string }> {
  const { timeoutMs = 10000, maxBytes = 5 * 1024 * 1024, maxRedirects = 3, httpsOnly, ...rest } = init
  let current = raw
  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertPublicUrl(current, { httpsOnly })
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const r = await fetch(current, { ...rest, redirect: 'manual', signal: ctrl.signal })
      if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
        current = new URL(r.headers.get('location')!, current).toString()
        continue
      }
      const reader = r.body?.getReader()
      const chunks: Buffer[] = []
      let size = 0
      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          size += value.byteLength
          if (size > maxBytes) { ctrl.abort(); throw new Error('Response too large') }
          chunks.push(Buffer.from(value))
        }
      }
      return { status: r.status, headers: r.headers, body: Buffer.concat(chunks), url: current }
    } finally {
      clearTimeout(t)
    }
  }
  throw new Error('Too many redirects')
}

// ── Mass-assignment guard ─────────────────────────────────────────────────────
export function pick<T extends Record<string, unknown>>(src: unknown, keys: readonly string[]): Partial<T> {
  const out: Record<string, unknown> = {}
  if (!src || typeof src !== 'object') return out as Partial<T>
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(src, k) && (src as Record<string, unknown>)[k] !== undefined) {
      out[k] = (src as Record<string, unknown>)[k]
    }
  }
  return out as Partial<T>
}

// ── PostgREST filter value escaping (for .or()/.ilike() search terms) ─────────
export function escapeFilterValue(s: unknown): string {
  return String(s ?? '').replace(/[,()*%\\:."]/g, ' ').trim().slice(0, 100)
}
