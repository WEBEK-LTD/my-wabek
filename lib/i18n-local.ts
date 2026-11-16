// Per-page / per-component translations.
//
// Every user-visible string in pages/ and components/ lives in a dictionary
// file under `locales/` (never inline in JSX). A dictionary has the full set of
// keys in English and Arabic (enforced by TypeScript), and French/Turkish where
// available — missing fr/tr keys fall back to English.
//
//   // locales/dashboard/contacts.ts
//   import { defineMessages } from '@/lib/i18n-local'
//   export default defineMessages({
//     en: { title: 'Contacts', count: '{n} contacts' },
//     ar: { title: 'جهات الاتصال', count: '{n} جهة اتصال' },
//     fr: { title: 'Contacts', count: '{n} contacts' },
//     tr: { title: 'Kişiler', count: '{n} kişi' },
//   })
//
//   // pages/dashboard/contacts/index.tsx
//   import messages from '@/locales/dashboard/contacts'
//   const { t, fmtNumber, fmtDate } = useT(messages)
//   <h1>{t('title')}</h1>  <p>{t('count', { n: fmtNumber(total) })}</p>
//
// Dates and numbers must be formatted with fmtDate / fmtNumber (or `locale`),
// never with a hard-coded 'ar' locale.
import { useCallback, useMemo } from 'react'
import { useTranslation } from '@/hooks/useTranslation'

export type Messages = Record<string, string>
export type LocaleDict<M extends Messages> = {
  en: M
  ar: { [K in keyof M]: string }
  fr?: Partial<{ [K in keyof M]: string }>
  tr?: Partial<{ [K in keyof M]: string }>
}

export function defineMessages<M extends Messages>(dict: LocaleDict<M>): LocaleDict<M> {
  return dict
}

type Vars = Record<string, string | number | null | undefined>

function interpolate(s: string, vars?: Vars): string {
  if (!vars) return s
  return s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined || vars[k] === null ? m : String(vars[k])))
}

/** BCP-47 locale for Intl APIs. Arabic keeps Latin digits (matches the UI kit). */
export function localeFor(lang: string): string {
  if (lang === 'ar') return 'ar-u-nu-latn'
  if (lang === 'en') return 'en-GB'
  return lang
}

export function translate<M extends Messages>(dict: LocaleDict<M>, lang: string, key: keyof M, vars?: Vars): string {
  const table = (dict as Record<string, Partial<Record<keyof M, string>> | undefined>)[lang]
  const s = table?.[key] ?? dict.en[key] ?? String(key)
  return interpolate(s, vars)
}

export function useT<M extends Messages>(dict: LocaleDict<M>) {
  const { lang, dir, isRTL } = useTranslation()
  const locale = localeFor(lang)

  const t = useCallback((key: keyof M, vars?: Vars) => translate(dict, lang, key, vars), [dict, lang])

  const fmt = useMemo(() => {
    const safe = <T,>(make: () => T, fallback: () => T): T => { try { return make() } catch { return fallback() } }
    const nf = safe(() => new Intl.NumberFormat(locale), () => new Intl.NumberFormat('en-GB'))
    const df = (opts: Intl.DateTimeFormatOptions) => safe(() => new Intl.DateTimeFormat(locale, opts), () => new Intl.DateTimeFormat('en-GB', opts))
    const date = df({ year: 'numeric', month: 'short', day: 'numeric' })
    const dateTime = df({ year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    const time = df({ hour: '2-digit', minute: '2-digit' })
    const rtf = safe(() => new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }), () => new Intl.RelativeTimeFormat('en', { numeric: 'auto' }))
    const toDate = (v: string | number | Date) => (v instanceof Date ? v : new Date(v))
    return {
      fmtNumber: (n: number | null | undefined) => (n === null || n === undefined || Number.isNaN(n) ? '—' : nf.format(n)),
      fmtDate: (v: string | number | Date | null | undefined) => (v ? date.format(toDate(v)) : '—'),
      fmtDateTime: (v: string | number | Date | null | undefined) => (v ? dateTime.format(toDate(v)) : '—'),
      fmtTime: (v: string | number | Date | null | undefined) => (v ? time.format(toDate(v)) : '—'),
      /** "3 minutes ago" / "منذ 3 دقائق" */
      fmtRelative: (v: string | number | Date | null | undefined) => {
        if (!v) return '—'
        const diff = (toDate(v).getTime() - Date.now()) / 1000
        const abs = Math.abs(diff)
        if (abs < 60) return rtf.format(Math.round(diff), 'second')
        if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
        if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
        if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day')
        return date.format(toDate(v))
      },
    }
  }, [locale])

  return { t, lang, dir, isRTL, locale, ...fmt }
}
