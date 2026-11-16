import { useCallback, useMemo } from 'react'
import { useTranslation } from '@/hooks/useTranslation'

/**
 * Admin copy helper. The admin panel is Arabic-first; every other UI
 * language gets the English string. Keeps page copy next to the markup
 * instead of adding hundreds of admin-only keys to lib/i18n.ts.
 *
 *   const { tr, fmtDate } = useAdminT()
 *   tr('المستخدمون', 'Users')
 */
export function useAdminT() {
  const { lang, isRTL, dir, t } = useTranslation()
  const ar = lang === 'ar'
  const tr = useCallback((arText: string, enText: string) => (ar ? arText : enText), [ar])
  // Latin digits in every language (matches formatNumber in the UI kit).
  const locale = ar ? 'ar-u-nu-latn' : lang === 'en' ? 'en-GB' : lang

  const fmt = useMemo(() => {
    const make = (opts: Intl.DateTimeFormatOptions) => {
      try { return new Intl.DateTimeFormat(locale, opts) } catch { return new Intl.DateTimeFormat('en-GB', opts) }
    }
    return {
      date: make({ year: 'numeric', month: 'short', day: 'numeric' }),
      dateTime: make({ year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      time: make({ hour: '2-digit', minute: '2-digit' }),
      short: make({ month: 'short', day: 'numeric' }),
      weekday: make({ weekday: 'short', day: 'numeric' }),
    }
  }, [locale])

  const safe = (v: unknown, f: Intl.DateTimeFormat) => {
    if (!v) return '—'
    const d = v instanceof Date ? v : new Date(String(v))
    return isNaN(d.getTime()) ? '—' : f.format(d)
  }

  return {
    tr, lang, isRTL, dir, t, locale,
    fmtDate: (v: unknown) => safe(v, fmt.date),
    fmtDateTime: (v: unknown) => safe(v, fmt.dateTime),
    fmtTime: (v: unknown) => safe(v, fmt.time),
    fmtShort: (v: unknown) => safe(v, fmt.short),
    fmtWeekday: (v: unknown) => safe(v, fmt.weekday),
  }
}

export type AdminT = ReturnType<typeof useAdminT>['tr']

/** Error message from an axios error (API `{ error }` body), else the fallback. */
export function apiError(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: { error?: unknown; message?: unknown } }; message?: string }
  const msg = err?.response?.data?.error ?? err?.response?.data?.message
  return typeof msg === 'string' && msg ? msg : fallback
}

/** Money in USD with two decimals and Latin digits. */
export function usd(n: unknown, digits = 2): string {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return '$' + new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v)
}
