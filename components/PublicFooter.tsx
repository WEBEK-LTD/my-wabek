import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import { LANGUAGES, getStoredLang, setStoredLang, t, isRtlLang } from '@/lib/i18n'
import { Logo } from '@/components/ui/Logo'
import { cn } from '@/components/ui/utils'

export interface PublicFooterProps {
  lang?: string
  onLangChange?: ((code: string) => void) | null
  /** light (default) on the canvas background, deep on a deep-teal section. */
  variant?: 'light' | 'deep'
}

export default function PublicFooter({ lang: langProp = '', onLangChange = null, variant = 'light' }: PublicFooterProps) {
  const { brandName, customLogo, hidePoweredBy } = useWhiteLabel()
  const name = brandName || 'WABEK'
  const [lang, setLang] = useState(langProp || 'ar')
  const [year, setYear] = useState<number | null>(null)

  useEffect(() => {
    setYear(new Date().getFullYear())
    setLang(langProp || getStoredLang())
    const handler = (e: Event) => { const d = (e as CustomEvent<string>).detail; if (typeof d === 'string') setLang(d) }
    window.addEventListener('langchange', handler)
    return () => window.removeEventListener('langchange', handler)
  }, [langProp])

  const changeLang = (code: string) => {
    setLang(code)
    setStoredLang(code)
    onLangChange?.(code)
    window.dispatchEvent(new CustomEvent('langchange', { detail: code }))
  }

  const deep = variant === 'deep'
  const muted = deep ? 'text-[#B5D3D0] hover:text-white' : 'text-muted hover:text-ink'

  const primary: [string, string][] = [
    [t(lang, 'pub_docs'), '/docs'],
    [t(lang, 'pub_status'), '/status'],
    [t(lang, 'pub_legal'), '/legal'],
  ]
  const secondary: [string, string][] = [
    [t(lang, 'pub_product'), '/features'],
    [t(lang, 'integrations'), '/integrations'],
    [t(lang, 'pricing'), '/pricing'],
    [t(lang, 'blog'), '/blog'],
    [t(lang, 'about'), '/about'],
    [t(lang, 'support'), '/support'],
  ]

  return (
    <footer dir={isRtlLang(lang) ? 'rtl' : 'ltr'} className={cn(deep ? 'bg-[#04282C] text-[#EAF7F5]' : 'bg-canvas text-muted')}>
      <div className={cn('mx-auto max-w-[1280px] border-t px-4 pb-11 pt-7 sm:px-8', deep ? 'border-white/10' : 'border-line')}>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 text-sm">
          <div className="flex items-center gap-2.5">
            <Logo src={customLogo} name={brandName} size={24} wordmark={false} decorative={!customLogo} />
            <span className={deep ? 'text-[#B5D3D0]' : 'text-muted'}>
              © {year ?? ''} {name}{!brandName && <> · <span dir="ltr">webek.org</span></>}
            </span>
          </div>
          <nav aria-label={t(lang, 'footer_legal')} className="flex flex-wrap gap-x-6 gap-y-2">
            {primary.map(([label, href]) => (
              <Link key={href} href={href} className={cn('transition-colors', muted)}>{label}</Link>
            ))}
          </nav>
        </div>

        <div className={cn('mt-5 flex flex-wrap items-center justify-between gap-4 border-t pt-5 text-[13px]', deep ? 'border-white/10' : 'border-line-soft')}>
          <nav aria-label={t(lang, 'footer_product')} className="flex flex-wrap gap-x-5 gap-y-2">
            {secondary.map(([label, href]) => (
              <Link key={href} href={href} className={cn('transition-colors', muted)}>{label}</Link>
            ))}
          </nav>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t(lang, 'shell_language')}>
            {LANGUAGES.map(l => (
              <button
                key={l.code}
                type="button"
                onClick={() => changeLang(l.code)}
                aria-pressed={l.code === lang}
                lang={l.code}
                className={cn(
                  'h-8 rounded-full px-3 text-xs font-medium transition-colors',
                  l.code === lang
                    ? deep ? 'bg-[#EAF7F5] text-[#04282C]' : 'bg-[#04282C] text-[#EAF7F5] dark:bg-[#EAF7F5] dark:text-[#04282C]'
                    : deep ? 'text-[#B5D3D0] hover:bg-white/10 hover:text-white' : 'text-muted hover:bg-surface-3 hover:text-ink',
                )}
              >
                {l.name}
              </button>
            ))}
          </div>
        </div>

        {!hidePoweredBy && (
          <p className={cn('mt-4 text-xs', deep ? 'text-[#B5D3D0]' : 'text-muted')}>
            {t(lang, 'footer_rights')} {t(lang, 'footer_proprietary')}
          </p>
        )}
      </div>
    </footer>
  )
}
