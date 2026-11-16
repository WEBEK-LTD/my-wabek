import type { AuthCopyKey } from './copy'

/** Stable per-browser fingerprint (used for "trust this device"). */
export function getDeviceFingerprint(): string {
  if (typeof window === 'undefined') return 'server'
  try {
    const stored = localStorage.getItem('wabek_device_fp')
    if (stored) return stored
  } catch {}
  const raw = [navigator.userAgent, navigator.language, screen.width, screen.height, new Date().getTimezoneOffset()].join('|')
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i)
    hash = hash & hash
  }
  const fp = Math.abs(hash).toString(36)
  try { localStorage.setItem('wabek_device_fp', fp) } catch {}
  return fp
}

/** Only same-site relative paths (no protocol-relative //evil.com or /\evil.com). */
export function safeRedirect(v: unknown, fallback = '/dashboard'): string {
  return typeof v === 'string' && /^\/(?![\/\\])[^\\\s]*$/.test(v) ? v : fallback
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateEmail(email: string): AuthCopyKey | null {
  if (!email.trim()) return 'err_email_required'
  if (!EMAIL_RE.test(email.trim())) return 'err_email_invalid'
  return null
}

export type AuthErrorView = { title?: AuthCopyKey; body: AuthCopyKey; vars?: Record<string, string | number>; tone: 'danger' | 'warning'; raw?: string }

/** Turn a server auth error into localized copy (unknown messages are shown as-is). */
export function describeAuthError(err: any): AuthErrorView {
  if (!err?.response) return { body: 'err_network', tone: 'danger' }
  const status: number = err.response.status
  const msg: string = String(err.response.data?.error || err.response.data?.details || '')
  if (/suspended/i.test(msg)) return { title: 'err_suspended_t', body: 'err_suspended_d', tone: 'danger' }
  const locked = msg.match(/locked\. Try again in (\d+)/i)
  if (locked) return { title: 'err_locked_t', body: 'err_locked_d', vars: { mins: Number(locked[1]) }, tone: 'warning' }
  if (/locked/i.test(msg)) return { title: 'err_locked_t', body: 'err_locked_d_generic', tone: 'warning' }
  if (status === 429 || /too many/i.test(msg)) return { title: 'err_rate_t', body: 'err_rate_d', tone: 'warning' }
  if (/invalid email or password/i.test(msg)) return { body: 'err_invalid', tone: 'danger' }
  if (/could not send your verification code/i.test(msg)) return { body: 'err_otp_unavailable', tone: 'danger' }
  if ((/expired/i.test(msg) && /code/i.test(msg)) || /already used/i.test(msg)) return { body: 'err_otp_expired', tone: 'danger' }
  if (/invalid (verification )?code|incorrect code|wrong code|invalid otp/i.test(msg)) return { body: 'err_otp_invalid', tone: 'danger' }
  if (msg && !/failed$/i.test(msg)) return { body: 'err_generic', tone: 'danger', raw: msg }
  return { body: 'err_generic', tone: 'danger' }
}

/** Messages for `?error=` on the login page (OAuth / magic link failures). */
export function describeQueryError(code: unknown): AuthErrorView | null {
  if (typeof code !== 'string' || !code) return null
  if (code === 'invalid_link') return { body: 'err_magic', tone: 'danger' }
  if (/suspended/i.test(code)) return { title: 'err_suspended_t', body: 'err_suspended_d', tone: 'danger' }
  return { body: 'err_oauth', tone: 'danger' }
}
