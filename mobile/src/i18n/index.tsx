import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { I18nManager, Platform } from 'react-native'
import * as Updates from 'expo-updates'
import en, { type Key } from './en'
import ar from './ar'
import { getItem, setItem, KEYS } from '@/lib/storage'

export type Lang = 'en' | 'ar'
export type { Key }
type Vars = Record<string, string | number | null | undefined>

const DICTS: Record<Lang, Record<Key, string>> = { en, ar }

export function translate(lang: Lang, key: Key, vars?: Vars): string {
  const s = DICTS[lang][key] ?? en[key] ?? String(key)
  if (!vars) return s
  return s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined || vars[k] === null ? m : String(vars[k])))
}

/** BCP-47 locale for Intl. Arabic keeps Latin digits, like the web app. */
export const localeOf = (lang: Lang) => (lang === 'ar' ? 'ar-u-nu-latn' : 'en-GB')

interface I18nValue {
  lang: Lang
  isRTL: boolean
  ready: boolean
  t: (key: Key, vars?: Vars) => string
  setLang: (lang: Lang) => Promise<void>
  fmtNumber: (n: number | null | undefined, opts?: Intl.NumberFormatOptions) => string
  fmtDate: (v: string | number | Date | null | undefined, opts?: Intl.DateTimeFormatOptions) => string
  fmtTime: (v: string | number | Date | null | undefined) => string
  fmtRelative: (v: string | number | Date | null | undefined) => string
}

const Ctx = createContext<I18nValue | null>(null)

/** Native layout direction must match the language; changing it needs a reload. */
function applyNativeDirection(rtl: boolean): boolean {
  if (Platform.OS === 'web') return false
  I18nManager.allowRTL(true)
  if (I18nManager.isRTL !== rtl) {
    I18nManager.forceRTL(rtl)
    return true
  }
  return false
}

async function reloadApp() {
  try {
    await Updates.reloadAsync()
  } catch {
    // Development client: the direction applies on the next launch.
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    ;(async () => {
      const stored = await getItem(KEYS.lang)
      const l: Lang = stored === 'ar' ? 'ar' : 'en' // English is the primary language
      setLangState(l)
      if (applyNativeDirection(l === 'ar')) await reloadApp()
      setReady(true)
    })()
  }, [])

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.lang = lang
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    }
  }, [lang])

  const setLang = useCallback(async (l: Lang) => {
    await setItem(KEYS.lang, l)
    setLangState(l)
    if (applyNativeDirection(l === 'ar')) await reloadApp()
  }, [])

  const value = useMemo<I18nValue>(() => {
    const locale = localeOf(lang)
    const nf = (opts?: Intl.NumberFormatOptions) => {
      try { return new Intl.NumberFormat(locale, opts) } catch { return new Intl.NumberFormat('en-GB', opts) }
    }
    const df = (opts: Intl.DateTimeFormatOptions) => {
      try { return new Intl.DateTimeFormat(locale, opts) } catch { return new Intl.DateTimeFormat('en-GB', opts) }
    }
    const toDate = (v: string | number | Date) => (v instanceof Date ? v : new Date(v))
    const t = (key: Key, vars?: Vars) => translate(lang, key, vars)
    return {
      lang,
      isRTL: lang === 'ar',
      ready,
      t,
      setLang,
      fmtNumber: (n, opts) => (n === null || n === undefined || Number.isNaN(n) ? '—' : nf(opts).format(n)),
      fmtDate: (v, opts) => (v ? df(opts || { day: 'numeric', month: 'short', year: 'numeric' }).format(toDate(v)) : '—'),
      fmtTime: v => (v ? df({ hour: '2-digit', minute: '2-digit' }).format(toDate(v)) : ''),
      fmtRelative: v => {
        if (!v) return ''
        const d = toDate(v)
        const diff = (Date.now() - d.getTime()) / 1000
        if (diff < 60) return t('just_now')
        if (diff < 3600) return t('minutes_ago', { n: Math.floor(diff / 60) })
        const sameDay = new Date().toDateString() === d.toDateString()
        if (sameDay) return df({ hour: '2-digit', minute: '2-digit' }).format(d)
        const y = new Date(Date.now() - 86400000)
        if (y.toDateString() === d.toDateString()) return t('yesterday')
        return df({ day: 'numeric', month: 'short' }).format(d)
      },
    }
  }, [lang, ready, setLang])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useI18n(): I18nValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useI18n outside I18nProvider')
  return v
}
