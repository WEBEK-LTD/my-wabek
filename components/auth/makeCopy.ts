import { useTranslation } from '@/hooks/useTranslation'

type Vars = Record<string, string | number | null | undefined>

/**
 * Page-local copy tables that follow the app language (profile → device →
 * Arabic, via useTranslation). Keeps large page copy out of lib/i18n.ts;
 * French and Turkish fall back to English for keys they don't define.
 *
 *   const useCopy = makeCopy({ en: { hi: 'Hello {name}' }, ar: { hi: 'مرحبًا {name}' } })
 *   const { c } = useCopy();  c('hi', { name })
 */
export function makeCopy<T extends Record<string, string>>(dict: { en: T; ar: { [K in keyof T]: string }; fr?: Partial<T>; tr?: Partial<T> }) {
  return function useCopy() {
    const tr = useTranslation()
    const table = (dict as Record<string, Partial<Record<keyof T, string>>>)[tr.lang] || {}
    const c = (key: keyof T, vars?: Vars): string => {
      let s = table[key] ?? dict.en[key] ?? String(key)
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(v == null ? '' : String(v))
      return s
    }
    return { c, ...tr }
  }
}

/** Locale tag for Intl / toLocaleString (Arabic digits stay Latin for data). */
export function localeTag(lang: string): string {
  return lang === 'ar' ? 'ar-EG-u-nu-latn' : lang === 'fr' ? 'fr-FR' : lang === 'tr' ? 'tr-TR' : 'en-US'
}
