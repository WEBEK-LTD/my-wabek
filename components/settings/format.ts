// Formatting helpers for the settings / billing / numbers pages.
// Language-aware: every helper formats for the current UI language (the
// signed-in user's profile language, else the device language) unless an
// explicit `lang` is passed. Arabic keeps Latin digits (matches the dashboard).
import { formatDistanceToNow, type Locale } from 'date-fns'
import { ar, enGB, fr, tr } from 'date-fns/locale'
import { useAuthStore } from '@/lib/store'
import { LANGUAGES, getStoredLang } from '@/lib/i18n'
import { localeFor, translate } from '@/lib/i18n-local'
import common from '@/locales/dashboard/common-b'

const SUPPORTED = LANGUAGES.map(l => l.code)
const DATE_FNS_LOCALES: Record<string, Locale> = { ar, en: enGB, fr, tr }

/** Current UI language, resolved the same way as useTranslation(). */
export function currentLang(): string {
  const userLang = useAuthStore.getState().user?.language
  if (userLang && SUPPORTED.includes(userLang)) return userLang
  return getStoredLang()
}

function toDate(v: string | number | Date | null | undefined): Date | null {
  if (v === null || v === undefined || v === '') return null
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

/** "16 Nov 2026" / "16 نوفمبر 2026" */
export function fmtDate(v: string | number | Date | null | undefined, fallback = '—', lang = currentLang()): string {
  const d = toDate(v)
  if (!d) return fallback
  return d.toLocaleDateString(localeFor(lang), { day: 'numeric', month: 'short', year: 'numeric' })
}

/** "16 Nov 2026, 14:05" */
export function fmtDateTime(v: string | number | Date | null | undefined, fallback = '—', lang = currentLang()): string {
  const d = toDate(v)
  if (!d) return fallback
  return d.toLocaleString(localeFor(lang), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** "14:05" */
export function fmtTime(v: string | number | Date | null | undefined, lang = currentLang()): string {
  const d = toDate(v)
  if (!d) return ''
  return d.toLocaleTimeString(localeFor(lang), { hour: '2-digit', minute: '2-digit' })
}

/** "3 hours ago" / "منذ 3 ساعات" */
export function fmtRelative(v: string | number | Date | null | undefined, fallback = '—', lang = currentLang()): string {
  const d = toDate(v)
  if (!d) return fallback
  return formatDistanceToNow(d, { addSuffix: true, locale: DATE_FNS_LOCALES[lang] || enGB })
}

/** Plain number in the UI language: "1,234". */
export function fmtNumber(n: number | null | undefined, lang = currentLang()): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat(localeFor(lang)).format(n)
}

/** Money with up to two decimals: "$12.50" (currency placement follows the UI language). */
export function fmtMoney(n: number | string | null | undefined, currency = 'USD', lang = currentLang()): string {
  const v = Number(n || 0)
  return new Intl.NumberFormat(localeFor(lang), { style: 'currency', currency: (currency || 'USD').toUpperCase(), maximumFractionDigits: 2 }).format(Number.isFinite(v) ? v : 0)
}

/** Plan limit: -1 → "Unlimited" / "غير محدود". */
export function fmtLimit(n: number | null | undefined, lang = currentLang()): string {
  if (n === -1) return translate(common, lang, 'unlimited')
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat(localeFor(lang)).format(n)
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
