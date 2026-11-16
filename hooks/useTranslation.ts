import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { translations, Language, TranslationKey, LANGUAGES, getStoredLang, DEFAULT_LANG } from '@/lib/i18n'

const SUPPORTED = LANGUAGES.map(l => l.code)

/**
 * Current UI language. Priority: the signed-in user's profile language, then
 * the language picked on this device (localStorage), then Arabic.
 */
export function useTranslation() {
  const userLang = useAuthStore(s => s.user?.language)
  const [deviceLang, setDeviceLang] = useState<string>(DEFAULT_LANG)

  useEffect(() => {
    setDeviceLang(getStoredLang())
    const onChange = (e: Event) => {
      const next = (e as CustomEvent<string>).detail
      if (typeof next === 'string') setDeviceLang(next)
    }
    window.addEventListener('langchange', onChange)
    return () => window.removeEventListener('langchange', onChange)
  }, [])

  const candidate = userLang && SUPPORTED.includes(userLang) ? userLang : deviceLang
  const lang = (SUPPORTED.includes(candidate) ? candidate : DEFAULT_LANG) as Language
  const isRTL = lang === 'ar'

  const t = (key: TranslationKey, fallback?: string): string => {
    return translations[lang]?.[key] || translations.en[key] || fallback || key
  }

  return { t, lang, isRTL, dir: (isRTL ? 'rtl' : 'ltr') as 'rtl' | 'ltr' }
}

export default useTranslation
