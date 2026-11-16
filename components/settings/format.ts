// Formatting helpers for the settings / billing / numbers pages.
// Arabic copy with Latin digits (matches the rest of the dashboard).
import { formatDistanceToNow } from 'date-fns'
import { ar } from 'date-fns/locale'

const LOCALE = 'ar-u-nu-latn'

function toDate(v: string | number | Date | null | undefined): Date | null {
  if (v === null || v === undefined || v === '') return null
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

/** "16 نوفمبر 2026" */
export function fmtDate(v: string | number | Date | null | undefined, fallback = '—'): string {
  const d = toDate(v)
  if (!d) return fallback
  return d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** "16 نوفمبر 2026، 14:05" */
export function fmtDateTime(v: string | number | Date | null | undefined, fallback = '—'): string {
  const d = toDate(v)
  if (!d) return fallback
  return d.toLocaleString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** "14:05" */
export function fmtTime(v: string | number | Date | null | undefined): string {
  const d = toDate(v)
  if (!d) return ''
  return d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' })
}

/** "منذ 3 ساعات" */
export function fmtRelative(v: string | number | Date | null | undefined, fallback = '—'): string {
  const d = toDate(v)
  if (!d) return fallback
  return formatDistanceToNow(d, { addSuffix: true, locale: ar })
}

/** Money with two decimals: "$12.50". */
export function fmtMoney(n: number | string | null | undefined, currency = 'USD'): string {
  const v = Number(n || 0)
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: (currency || 'USD').toUpperCase(), maximumFractionDigits: 2 }).format(Number.isFinite(v) ? v : 0)
}

/** Plan limit: -1 → "غير محدود". */
export function fmtLimit(n: number | null | undefined): string {
  if (n === -1) return 'غير محدود'
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('en-US').format(n)
}

/** Clipboard write that never throws. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
