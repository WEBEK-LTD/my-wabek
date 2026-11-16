import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_LANG, getStoredLang, isRtlLang, t as translate } from '@/lib/i18n'

/**
 * Language for public (signed-out) pages: the device choice in localStorage,
 * Arabic by default. Follows the `langchange` event that PublicNav and
 * PublicFooter dispatch, so every section re-renders in the new language.
 */
export function usePublicLang() {
  const [lang, setLang] = useState<string>(DEFAULT_LANG)

  useEffect(() => {
    setLang(getStoredLang())
    const onChange = (e: Event) => {
      const next = (e as CustomEvent<string>).detail
      if (typeof next === 'string') setLang(next)
    }
    window.addEventListener('langchange', onChange)
    return () => window.removeEventListener('langchange', onChange)
  }, [])

  const t = useCallback((key: string) => translate(lang, key), [lang])
  const isRTL = isRtlLang(lang)

  /** Pick a value from an inline `{ en, ar, fr, tr }` dictionary. */
  const pick = useCallback(
    (m: Record<string, string> | undefined | null) => (m ? m[lang] || m.en || '' : ''),
    [lang],
  )

  return { lang, setLang, t, pick, isRTL, dir: (isRTL ? 'rtl' : 'ltr') as 'rtl' | 'ltr' }
}

export default usePublicLang
