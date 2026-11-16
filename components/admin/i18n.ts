import { useCallback, useMemo } from 'react'
import { useT, type LocaleDict, type Messages } from '@/lib/i18n-local'

type Vars = Record<string, string | number | null | undefined>

/** Keys that come in plural pairs: `foo_one` + `foo_other` → `foo`. */
type PluralBase<M> = { [K in keyof M]: K extends `${infer B}_other` ? B : never }[keyof M]

/**
 * Admin wrapper around `useT` (see lib/i18n-local.ts). Copy lives in
 * `locales/admin/*.ts`; this adds the date formats the admin tables use,
 * tolerant of invalid / unknown input, and `tn` for plural forms.
 *
 *   import messages from '@/locales/admin/users'
 *   const { t, tn, fmtDate } = useAdminT(messages)
 *   t('title')  tn('userCount', n, { n: fmtNumber(n) })
 */
export function useAdminT<M extends Messages>(messages: LocaleDict<M>) {
  const base = useT(messages)
  const { locale, t } = base

  const fmt = useMemo(() => {
    const make = (opts: Intl.DateTimeFormatOptions) => {
      try { return new Intl.DateTimeFormat(locale, opts) } catch { return new Intl.DateTimeFormat('en-GB', opts) }
    }
    let plural: Intl.PluralRules
    try { plural = new Intl.PluralRules(locale) } catch { plural = new Intl.PluralRules('en-GB') }
    return {
      plural,
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

  /** Plural-aware lookup: picks `${base}_one` when the language's rule says "one", else `${base}_other`. */
  const tn = useCallback((key: PluralBase<M>, n: number, vars?: Vars) => {
    const form = fmt.plural.select(n) === 'one' ? 'one' : 'other'
    return t(`${String(key)}_${form}` as keyof M, vars)
  }, [fmt, t])

  return {
    ...base,
    tn,
    fmtDate: (v: unknown) => safe(v, fmt.date),
    fmtDateTime: (v: unknown) => safe(v, fmt.dateTime),
    fmtTime: (v: unknown) => safe(v, fmt.time),
    fmtShort: (v: unknown) => safe(v, fmt.short),
    fmtWeekday: (v: unknown) => safe(v, fmt.weekday),
  }
}

/** Translate function returned by `useAdminT` for a given dictionary. */
export type AdminT<M extends Messages> = ReturnType<typeof useAdminT<M>>['t']

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
