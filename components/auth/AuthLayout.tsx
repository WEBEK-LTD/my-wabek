import React, { useEffect } from 'react'
import axios from 'axios'
import Head from 'next/head'
import Link from 'next/link'
import {
  ChatBubbleLeftRightIcon, SparklesIcon, ChartBarIcon, ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import { Logo } from '@/components/ui'
import { cn } from '@/components/ui/utils'
import { LanguageMenu, ThemeToggle } from '@/components/layout/AppShell'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import { useAuthStore } from '@/lib/store'
import { setStoredLang } from '@/lib/i18n'
import { useTranslation } from '@/hooks/useTranslation'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/auth'

export interface AuthLayoutProps {
  /** Browser tab title. */
  title: string
  children: React.ReactNode
  /** Narrow (default) or wide form column. */
  width?: 'sm' | 'md'
}

const POINTS = [
  { icon: ChatBubbleLeftRightIcon, t: 'point_inbox_t', d: 'point_inbox_d' },
  { icon: SparklesIcon, t: 'point_ai_t', d: 'point_ai_d' },
  { icon: ChartBarIcon, t: 'point_campaigns_t', d: 'point_campaigns_d' },
  { icon: ShieldCheckIcon, t: 'point_secure_t', d: 'point_secure_d' },
] as const

/**
 * Split auth layout: deep-teal brand panel (logo + value points) on the start
 * side, the form on the other. Single column under `lg`.
 */
export function AuthLayout({ title, children, width = 'sm' }: AuthLayoutProps) {
  const { t, lang, dir } = useT(messages)
  const { t: tShell } = useTranslation()
  const { brandName, customLogo } = useWhiteLabel()
  const brand = brandName || 'WABEK'

  // A signed-in visitor's profile language wins over the device choice, so
  // the switcher updates the profile too (same as the dashboard switcher).
  const user = useAuthStore(s => s.user)
  const setUser = useAuthStore(s => s.setUser)
  const changeLang = (code: string) => {
    setStoredLang(code)
    window.dispatchEvent(new CustomEvent('langchange', { detail: code }))
    if (user) {
      setUser({ ...user, language: code })
      axios.put('/api/settings/profile', { language: code }).catch(() => {})
    }
  }

  // Keep <html lang/dir> on the effective language (profile → device).
  useEffect(() => {
    const root = document.documentElement
    root.lang = lang
    root.dir = dir
  }, [lang, dir])

  return (
    <>
      <Head><title>{`${title} | ${brand}`}</title></Head>
      <div dir={dir} lang={lang} className="min-h-[100dvh] bg-canvas text-ink lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        {/* Brand panel */}
        <aside className="relative hidden overflow-hidden bg-deep-landing lg:sticky lg:top-0 lg:flex lg:h-[100dvh] lg:flex-col lg:justify-between lg:p-10 xl:p-14" aria-label={brand}>
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 -bottom-64 mx-auto h-[640px] w-[640px] rounded-full border border-white/[0.07]" />
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 -bottom-40 mx-auto h-[420px] w-[420px] rounded-full border border-white/[0.08]" />
          <span aria-hidden="true" className="pointer-events-none absolute -top-24 end-[-120px] h-[340px] w-[340px] rounded-full bg-brand-green/10 blur-3xl" />

          <div className="relative">
            <Logo href="/" tone="light" size={40} src={customLogo} name={brandName} />
          </div>

          <div className="relative max-w-[460px]">
            <h2 className="text-[30px] font-bold leading-[1.35] text-deep-ink xl:text-[34px]">
              {t('brand_tagline')}
            </h2>
            <ul className="mt-9 flex flex-col gap-5">
              {POINTS.map(p => (
                <li key={p.t} className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-brand-green">
                    <p.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="text-[15px] font-semibold text-deep-ink">{t(p.t)}</span>
                    <span className="text-sm leading-relaxed text-deep-muted">{t(p.d)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-deep-muted">
            <span className="tabular">© {new Date().getFullYear()} {brand}</span>
            <Link href="/legal/terms" className="text-deep-muted hover:text-white">{t('terms')}</Link>
            <Link href="/legal/privacy" className="text-deep-muted hover:text-white">{t('privacy')}</Link>
            <Link href="/status" className="text-deep-muted hover:text-white">{t('status')}</Link>
          </div>
        </aside>

        {/* Form column */}
        <main className="relative flex min-h-[100dvh] flex-col">
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-brand-gradient-x lg:hidden" />
          <div className="flex items-center justify-between gap-3 px-4 pt-5 sm:px-8">
            <div className="lg:invisible">
              <Logo href="/" size={34} src={customLogo} name={brandName} />
            </div>
            <div className="flex items-center gap-1">
              <LanguageMenu t={tShell} lang={lang} onChange={changeLang} />
              <ThemeToggle t={tShell} />
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8">
            <div className={cn('w-full', width === 'md' ? 'max-w-[480px]' : 'max-w-[420px]')}>
              {children}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 pb-6 text-xs text-muted lg:hidden">
            <Link href="/legal/terms" className="text-muted hover:text-ink">{t('terms')}</Link>
            <Link href="/legal/privacy" className="text-muted hover:text-ink">{t('privacy')}</Link>
            <Link href="/status" className="text-muted hover:text-ink">{t('status')}</Link>
          </div>
        </main>
      </div>
    </>
  )
}

/** Card heading block used at the top of every auth form. */
export function AuthHeading({ icon: Icon, title, subtitle, children }: { icon?: React.ElementType; title: React.ReactNode; subtitle?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-2">
      {Icon && (
        <span className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-chip text-chip-ink shadow-[inset_0_0_0_1px_rgb(var(--brand-teal)/0.15)]">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
      )}
      <h1 className="text-[26px] font-bold leading-tight text-ink sm:text-[28px]">{title}</h1>
      {subtitle && <p className="text-[15px] leading-relaxed text-muted">{subtitle}</p>}
      {children}
    </div>
  )
}

export default AuthLayout
