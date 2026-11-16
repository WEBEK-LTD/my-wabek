import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { setStoredLang } from '@/lib/i18n'
import { docsHref, type DocsLang } from './lib/manifest'

/** The language the visitor explicitly chose before (null when nothing is stored). */
function explicitStoredLang(): string | null {
  try { return localStorage.getItem('wabek_lang') || localStorage.getItem('lang') } catch { return null }
}

/** Store the language and tell the rest of the site (nav, footer, <html lang/dir>). */
export function rememberDocsLang(code: string) {
  setStoredLang(code)
  window.dispatchEvent(new CustomEvent('langchange', { detail: code }))
}

/**
 * The docs language comes from the URL (/docs = Arabic, /en/docs = English).
 * - A visitor who chose English (or French/Turkish) elsewhere on the site and lands on
 *   an Arabic docs URL is sent to the same page in English.
 * - Otherwise the site language follows the docs language, so the nav, footer and
 *   <html dir> match the page being read. French/Turkish stay as chosen on English docs.
 */
export function useDocsLangSync(lang: DocsLang, slug: string | null) {
  const router = useRouter()
  useEffect(() => {
    const stored = explicitStoredLang()
    if (lang === 'ar' && stored && stored !== 'ar') {
      router.replace(docsHref('en', slug) + window.location.hash)
      return
    }
    if (lang === 'en' && (stored === 'fr' || stored === 'tr')) return
    if (stored !== lang && !(lang === 'ar' && !stored)) rememberDocsLang(lang)
    // Only on language changes: navigating between pages keeps the choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])
}
