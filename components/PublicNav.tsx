import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Bars3Icon, XMarkIcon, LanguageIcon } from '@heroicons/react/24/outline'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import { useAuthStore } from '@/lib/store'
import { LANGUAGES, getStoredLang, setStoredLang, t, isRtlLang } from '@/lib/i18n'
import { Logo } from '@/components/ui/Logo'
import { Button } from '@/components/ui/Button'
import { Dropdown } from '@/components/ui/Dropdown'
import { cn } from '@/components/ui/utils'

export interface PublicNavProps {
  /** Path of the current page, highlighted in the nav (e.g. "/pricing"). */
  active?: string
  /** Controlled language (optional — defaults to the stored language). */
  lang?: string
  /** Called after the visitor picks a language. */
  onLangChange?: ((code: string) => void) | null
  /**
   * light — white bar on light pages (default)
   * deep  — transparent bar for the deep-teal hero (wrap header + hero in `.bg-deep-landing`)
   */
  variant?: 'light' | 'deep'
}

export default function PublicNav({ active = '', lang: langProp = '', onLangChange = null, variant = 'light' }: PublicNavProps) {
  const router = useRouter()
  const { brandName, customLogo } = useWhiteLabel()
  const user = useAuthStore(s => s.user)
  // The page's language wins when it passes one; derived during render so the
  // nav switches language in the same render as the page (no extra frame).
  const [ownLang, setLang] = useState('ar')
  const lang = langProp || ownLang
  const [mounted, setMounted] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => { setMounted(true); setLang(getStoredLang()) }, [])
  useEffect(() => {
    const onChange = (e: Event) => { const d = (e as CustomEvent<string>).detail; if (typeof d === 'string') setLang(d) }
    window.addEventListener('langchange', onChange)
    return () => window.removeEventListener('langchange', onChange)
  }, [])
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => {
    const close = () => setMenuOpen(false)
    router.events.on('routeChangeStart', close)
    return () => router.events.off('routeChangeStart', close)
  }, [router.events])
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const changeLang = (code: string) => {
    setLang(code)
    setStoredLang(code)
    onLangChange?.(code)
    window.dispatchEvent(new CustomEvent('langchange', { detail: code }))
  }

  const deep = variant === 'deep'
  const dir = isRtlLang(lang) ? 'rtl' : 'ltr'
  const current = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0]
  const signedIn = mounted && !!user

  const links: [string, string][] = [
    [t(lang, 'home'), '/'],
    [t(lang, 'pub_product'), '/features'],
    [t(lang, 'integrations'), '/integrations'],
    [t(lang, 'pricing'), '/pricing'],
    [t(lang, 'pub_docs'), '/docs'],
  ]
  const isActive = (href: string) => active === href || (href !== '/' && active.startsWith(href + '/'))

  return (
    <header
      dir={dir}
      className={cn(
        'sticky top-0 z-40 transition-[background-color,box-shadow,border-color] duration-200',
        deep
          ? cn('text-[#EAF7F5]', scrolled || menuOpen ? 'bg-[#04282C]/90 shadow-[0_10px_40px_rgba(0,0,0,0.25)] backdrop-blur-md' : 'bg-transparent')
          : cn('border-b bg-surface/90 text-ink backdrop-blur-md', scrolled ? 'border-line shadow-card' : 'border-transparent'),
      )}
    >
      <div className="mx-auto flex h-[76px] max-w-[1280px] items-center justify-between gap-5 px-4 sm:px-8">
        <Logo href="/" src={customLogo} name={brandName} tone={deep ? 'light' : 'auto'} size={42} />

        <nav aria-label={t(lang, 'shell_main_nav')} className="hidden items-center gap-[30px] text-[15px] lg:flex">
          {links.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? 'page' : undefined}
              className={cn(
                'relative py-2 transition-colors',
                deep
                  ? isActive(href) ? 'text-white' : 'text-[#B5D3D0] hover:text-white'
                  : isActive(href) ? 'font-medium text-ink' : 'text-muted hover:text-ink',
                isActive(href) && 'after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-brand-gradient',
              )}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2.5 lg:flex">
          <Dropdown
            label={`${t(lang, 'shell_language')}: ${current.name}`}
            width="w-44"
            triggerClassName={cn('h-10 px-3 text-sm', deep ? 'text-[#EAF7F5] hover:bg-white/10' : 'text-body hover:bg-surface-3 hover:text-ink')}
            trigger={<><LanguageIcon className="h-5 w-5" aria-hidden="true" /><span dir="ltr" className="text-xs font-semibold">{current.label}</span></>}
            items={LANGUAGES.map(l => ({
              label: <span lang={l.code} dir={l.code === 'ar' ? 'rtl' : 'ltr'}>{l.name}</span>,
              hint: <span dir="ltr">{l.label}</span>,
              selected: l.code === lang,
              onClick: () => changeLang(l.code),
            }))}
          />
          {signedIn ? (
            <Button href="/dashboard" variant={deep ? 'on-deep' : 'dark'} size="md" className="rounded-[14px] px-[22px]">
              {t(lang, 'pub_dashboard')}
            </Button>
          ) : (
            <>
              <Link href="/auth/login" className={cn('px-3.5 py-2.5 text-[15px] transition-colors', deep ? 'text-[#EAF7F5] hover:text-white' : 'text-ink hover:text-link')}>
                {t(lang, 'pub_sign_in')}
              </Link>
              <Button href="/auth/register" variant={deep ? 'on-deep' : 'primary'} size="md" className="rounded-[14px] px-[22px] text-[15px]">
                {t(lang, 'pub_start_free')}
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen(o => !o)}
          className={cn('flex h-11 w-11 items-center justify-center rounded-btn lg:hidden', deep ? 'text-[#EAF7F5] hover:bg-white/10' : 'text-ink hover:bg-surface-3')}
          aria-expanded={menuOpen}
          aria-controls="public-mobile-menu"
          aria-label={menuOpen ? t(lang, 'shell_close_menu') : t(lang, 'shell_open_menu')}
        >
          {menuOpen ? <XMarkIcon className="h-6 w-6" aria-hidden="true" /> : <Bars3Icon className="h-6 w-6" aria-hidden="true" />}
        </button>
      </div>

      {menuOpen && (
        <div
          id="public-mobile-menu"
          className={cn(
            'border-t px-4 pb-6 pt-3 sm:px-8 lg:hidden',
            deep ? 'border-white/10 bg-[#04282C] text-[#EAF7F5]' : 'border-line bg-surface text-ink',
          )}
        >
          <nav aria-label={t(lang, 'shell_main_nav')} className="flex flex-col">
            {links.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? 'page' : undefined}
                className={cn(
                  'border-b py-3.5 text-base',
                  deep ? 'border-white/10 text-[#EAF7F5] hover:text-white' : 'border-line-soft text-ink hover:text-link',
                  isActive(href) && 'font-semibold',
                )}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="mt-5 flex flex-col gap-2.5">
            {signedIn ? (
              <Button href="/dashboard" variant={deep ? 'on-deep' : 'dark'} size="lg" fullWidth>{t(lang, 'pub_dashboard')}</Button>
            ) : (
              <>
                <Button href="/auth/register" variant="primary" size="lg" fullWidth>{t(lang, 'pub_start_free')}</Button>
                <Button href="/auth/login" variant={deep ? 'on-deep-ghost' : 'secondary'} size="lg" fullWidth>{t(lang, 'pub_sign_in')}</Button>
              </>
            )}
          </div>
          <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label={t(lang, 'shell_language')}>
            {LANGUAGES.map(l => (
              <button
                key={l.code}
                type="button"
                onClick={() => changeLang(l.code)}
                aria-pressed={l.code === lang}
                className={cn(
                  'h-9 rounded-full px-4 text-sm font-medium transition-colors',
                  l.code === lang
                    ? 'bg-brand-gradient text-[#04282C]'
                    : deep ? 'border border-white/15 text-[#EAF7F5] hover:bg-white/10' : 'border border-line text-body hover:border-line-strong',
                )}
              >
                <span lang={l.code}>{l.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  )
}
