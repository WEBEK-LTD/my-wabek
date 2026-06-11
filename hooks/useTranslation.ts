import { useAuthStore } from '@/lib/store'
import { translations, Language, TranslationKey } from '@/lib/i18n'

export function useTranslation() {
  const lang = (useAuthStore(s => s.user?.language) || 'en') as Language
  const isRTL = lang === 'ar'

  const t = (key: TranslationKey, fallback?: string): string => {
    return translations[lang]?.[key] || translations.en[key] || fallback || key
  }

  return { t, lang, isRTL }
}

export default useTranslation
