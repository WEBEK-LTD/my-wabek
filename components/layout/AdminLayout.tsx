import React, { useCallback, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import axios from 'axios'
import { ArrowRightOnRectangleIcon, ArrowUturnLeftIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '@/lib/store'
import { useAdminAuth } from '@/hooks/useAuth'
import { useTranslation } from '@/hooks/useTranslation'
import { BRAND_ASSETS } from '@/hooks/useWhiteLabel'
import { setStoredLang } from '@/lib/i18n'
import { ADMIN_SECTIONS, findActive } from './nav'
import {
  AccountCard, CommandPalette, LanguageMenu, ShellFrame, Sidebar, SubNav,
  ThemeToggle, Topbar, sectionHref, useCommandShortcut,
} from './AppShell'

export interface AdminLayoutProps {
  children: React.ReactNode
  /** Page title (browser tab; appended to the breadcrumb on nested pages). */
  title?: string
  bleed?: boolean
}

/**
 * AdminLayout — platform-admin shell. Same Lagoon frame as the dashboard,
 * with its own sections and an "Admin" tag. Guarded by useAdminAuth().
 */
export default function AdminLayout({ children, title: titleProp, bleed }: AdminLayoutProps) {
  const { user, logout, setUser } = useAuthStore()
  const router = useRouter()
  const { t, lang, dir } = useTranslation()
  const [searchOpen, setSearchOpen] = useState(false)
  useAdminAuth()

  const { section, item } = findActive(ADMIN_SECTIONS, router.pathname)
  const itemLabel = item ? t(item.labelKey) : t('admin_overview')
  const nested = !!item && !item.exact && router.pathname.startsWith(item.href + '/')
  const title = nested && titleProp ? titleProp : itemLabel
  const crumbs = [
    ...(section ? [{ label: t(section.labelKey), href: sectionHref(section, {}) }] : []),
    ...(item ? [{ label: itemLabel, href: item.href }] : []),
    ...(nested && titleProp ? [{ label: titleProp }] : []),
  ]

  const openSearch = useCallback(() => setSearchOpen(true), [])
  useCommandShortcut(openSearch)

  const changeLang = (code: string) => {
    setStoredLang(code)
    window.dispatchEvent(new CustomEvent('langchange', { detail: code }))
    if (user) setUser({ ...user, language: code })
    axios.put('/api/settings/profile', { language: code }).catch(() => {})
  }

  const tag = <span className="rounded-full bg-violet-bg px-2 py-0.5 text-2xs font-semibold text-violet">{t('shell_admin_badge')}</span>

  const sidebar = (mode: 'static' | 'drawer', close: () => void) => (
    <Sidebar
      sections={ADMIN_SECTIONS}
      activeSectionId={section?.id}
      t={t}
      homeHref="/admin"
      tag={t('shell_admin_badge')}
      onNavigate={mode === 'drawer' ? close : undefined}
      onClose={mode === 'drawer' ? close : undefined}
      extra={
        <Link
          href="/dashboard"
          className="flex items-center gap-3 rounded-btn border border-white/10 px-3 py-2.5 text-[14px] text-deep-muted transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <ArrowUturnLeftIcon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          {t('shell_back_to_app')}
        </Link>
      }
      account={
        <AccountCard
          label={t('shell_account_menu')}
          name={user?.name || user?.email || '—'}
          email={user?.email}
          subtitle={t('shell_role_platform_admin')}
          items={[
            { label: t('shell_back_to_app'), icon: ArrowUturnLeftIcon, href: '/dashboard' },
            { label: t('admin_platform'), icon: ShieldCheckIcon, href: '/admin/settings' },
            { label: t('shell_sign_out'), icon: ArrowRightOnRectangleIcon, onClick: () => { logout() }, danger: true, divider: true },
          ]}
        />
      }
    />
  )

  return (
    <>
      <Head>
        <title>{`${title} | ${BRAND_ASSETS.name} Admin`}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <ShellFrame
        dir={dir}
        lang={lang}
        t={t}
        bleed={bleed}
        sidebar={sidebar}
        subnav={<SubNav section={section} activeItem={item} t={t} />}
        topbar={(openMenu) => (
          <Topbar t={t} onOpenMenu={openMenu} onOpenSearch={openSearch} crumbs={crumbs.length ? crumbs : [{ label: title }]} tag={tag}>
            <LanguageMenu t={t} lang={lang} onChange={changeLang} className="hidden sm:inline-block" />
            <ThemeToggle t={t} />
          </Topbar>
        )}
      >
        {children}
      </ShellFrame>
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} sections={ADMIN_SECTIONS} t={t} dir={dir} />
    </>
  )
}
