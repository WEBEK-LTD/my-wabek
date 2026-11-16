import React, { Fragment, useCallback, useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useQuery } from 'react-query'
import axios from 'axios'
import { formatDistanceToNow } from 'date-fns'
import { ar as arLocale, enUS, fr as frLocale, tr as trLocale } from 'date-fns/locale'
import { Popover, Transition } from '@headlessui/react'
import {
  BellIcon, ChatBubbleLeftRightIcon, CheckCircleIcon, Cog6ToothIcon, CreditCardIcon,
  ExclamationTriangleIcon, InformationCircleIcon, MegaphoneIcon, PlusIcon,
  ShieldCheckIcon, ArrowRightOnRectangleIcon, ClockIcon, BookOpenIcon,
} from '@heroicons/react/24/outline'
import { useAuthStore } from '@/lib/store'
import { useAuth } from '@/hooks/useAuth'
import SessionLoading from './SessionLoading'
import { getPushStatus } from '@/lib/push-client'
import { setStoredLang } from '@/lib/i18n'
import { useTranslation } from '@/hooks/useTranslation'
import { useWhiteLabel, BRAND_ASSETS } from '@/hooks/useWhiteLabel'
import UpgradeWall from '@/components/UpgradeWall'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/utils'
import { DASHBOARD_SECTIONS, findActive, isItemLocked } from './nav'
import {
  AccountCard, CommandPalette, LanguageMenu, ShellFrame, Sidebar, SubNav,
  ThemeToggle, Topbar, sectionHref, useCommandShortcut,
} from './AppShell'

export interface DashboardLayoutProps {
  children: React.ReactNode
  /** Page title: browser tab + breadcrumb in the top bar. */
  title?: string
  /** Full-bleed content area (no max width) for full-height tools like the inbox. */
  bleed?: boolean
  /** Hide the section tab bar (e.g. focused editors). */
  hideSubnav?: boolean
}

/** Legacy full-height pages that offset the content padding themselves (-m-6). */
const BLEED_ROUTES = ['/dashboard/chat', '/dashboard/docs']

const DATE_LOCALES = { ar: arLocale, en: enUS, fr: frLocale, tr: trLocale } as const

const notifIcons: Record<string, React.ElementType> = {
  success: CheckCircleIcon,
  warning: ExclamationTriangleIcon,
  error: ExclamationTriangleIcon,
  info: InformationCircleIcon,
  message: ChatBubbleLeftRightIcon,
  campaign: MegaphoneIcon,
  system: Cog6ToothIcon,
}
const notifTone: Record<string, string> = {
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  error: 'bg-danger-bg text-danger',
  message: 'bg-violet-bg text-violet',
}

interface NotificationRow {
  id: string
  type?: string
  title: string
  body?: string
  link?: string
  is_read?: boolean
  created_at: string
}

export default function DashboardLayout({ children, title: titleProp, bleed, hideSubnav }: DashboardLayoutProps) {
  const { user, logout, setUser } = useAuthStore()
  const router = useRouter()
  const { t, lang, dir } = useTranslation()
  const [searchOpen, setSearchOpen] = useState(false)
  // Waits for the cookie session check before rendering or redirecting.
  const { ready } = useAuth({ required: true })

  // White label (tenants on their own domain keep their logo / colours / favicon)
  const { brandName, customLogo, favIcon, hidePoweredBy, customCss, customFooter } = useWhiteLabel()

  /* ── Push notifications ───────────────────────────────── */
  useEffect(() => {
    // Load VAPID key and check subscription state
    fetch('/api/admin/seo').then(r => r.json()).then(d => {
      if (d.push?.vapid_public) getPushStatus().catch(() => {})
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) return
    const requestPushPermission = async () => {
      if (Notification.permission === 'granted') return
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') return
      try {
        const reg = await navigator.serviceWorker.ready
        const { data: seoData } = await axios.get('/api/admin/seo').catch(() => ({ data: {} as any }))
        const vapidKey = seoData?.push?.vapid_public || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (!vapidKey) return
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey })
        await axios.post('/api/push/subscribe', { subscription: sub.toJSON() })
      } catch (e) { console.error('Push subscribe error:', e) }
    }
    const timer = setTimeout(() => {
      if (Notification.permission === 'default') requestPushPermission()
    }, 5000)
    return () => clearTimeout(timer)
  }, [])

  /* ── Data ─────────────────────────────────────────────── */
  const { data: notifData, refetch: refetchNotifs } = useQuery('notifications',
    () => axios.get('/api/notifications?limit=10').then(r => r.data),
    { refetchInterval: 30000, retry: false, enabled: ready },
  )
  const notifications: NotificationRow[] = notifData?.notifications || []
  const unreadCount = notifications.filter(n => !n.is_read).length

  // Plan features — drive locked nav items and the upgrade wall
  const { data: planData } = useQuery('plan-features',
    () => axios.get('/api/billing/plan-features').then(r => r.data),
    { staleTime: 60000, retry: false, enabled: ready },
  )
  const features: Record<string, unknown> = planData?.features || {}
  const planName: string = planData?.plan?.name || ''

  // Session (auth guard + plan expiry + Wix + team role)
  const { data: meData, error: meError } = useQuery('me', () => axios.get('/api/auth/me').then(r => r.data), {
    staleTime: 300000,
    enabled: ready,
    retry: (count, err: any) => err?.response?.status !== 401 && count < 1,
  })
  useEffect(() => {
    if ((meError as any)?.response?.status === 401) {
      router.replace(`/auth/login?redirect=${encodeURIComponent(router.asPath)}`)
    }
  }, [meError, router])
  useEffect(() => {
    // Cookie sessions (OAuth, Wix) may arrive without a persisted store user.
    if (meData?.user && !user) setUser(meData.user)
  }, [meData, user, setUser])

  const me = meData?.user || user
  const isWix = !!meData?.user?.wix_instance_id
  const planExpiresAt = meData?.user?.plan_expires_at
  const daysLeft = planExpiresAt ? Math.ceil((new Date(planExpiresAt).getTime() - Date.now()) / 86400000) : null
  const planExpired = daysLeft !== null && daysLeft <= 0
  const planExpiringSoon = daysLeft !== null && daysLeft > 0 && daysLeft <= 7

  // Unread conversations badge on "المحادثات"
  const { data: inboxData } = useQuery('shell-inbox-unread',
    () => axios.get('/api/inbox/inboxes').then(r => r.data),
    { refetchInterval: 60000, staleTime: 30000, retry: false, enabled: ready },
  )
  const inboxUnread = (inboxData?.inboxes || []).reduce((s: number, i: { unread?: number }) => s + (i.unread || 0), 0)

  /* ── Navigation state ─────────────────────────────────── */
  const { section: activeSection, item: activeItem } = findActive(DASHBOARD_SECTIONS, router.pathname)
  const ctx = { features, isWix }
  const locked = activeItem ? isItemLocked(activeItem, ctx) : false
  // Top-level pages use the translated nav label; nested pages (e.g. a
  // contact or campaign detail) append the page's own `title`.
  const itemLabel = activeItem ? t(activeItem.labelKey) : activeSection ? t(activeSection.labelKey) : t('nav_home')
  const nested = !!activeItem && !activeItem.exact && router.pathname.startsWith(activeItem.href + '/')
  const title = nested && titleProp ? titleProp : itemLabel
  const crumbs = [
    ...(activeSection ? [{ label: t(activeSection.labelKey), href: sectionHref(activeSection, ctx) }] : []),
    ...(activeItem ? [{ label: itemLabel, href: activeItem.external ? undefined : activeItem.href }] : []),
    ...(nested && titleProp ? [{ label: titleProp }] : []),
  ]
  const isBleed = bleed ?? BLEED_ROUTES.some(r => router.pathname === r || router.pathname.startsWith(r + '/'))

  const openSearch = useCallback(() => setSearchOpen(true), [])
  useCommandShortcut(openSearch)

  const changeLang = (code: string) => {
    setStoredLang(code)
    window.dispatchEvent(new CustomEvent('langchange', { detail: code }))
    if (user) setUser({ ...user, language: code })
    axios.put('/api/settings/profile', { language: code }).catch(() => {})
  }

  const markAllRead = async () => {
    await axios.put('/api/notifications', { action: 'mark_all_read' }).catch(() => {})
    refetchNotifs()
  }

  /* ── Account card ─────────────────────────────────────── */
  const memberRole = me?.member_role as string | null | undefined
  const roleLabel = me?.role === 'admin'
    ? t('shell_role_platform_admin')
    : memberRole ? t(`shell_role_${memberRole}`, memberRole) : t('shell_role_owner')
  const planLabel = planName ? `${t('shell_plan')} ${planName}` : t('shell_free_plan')
  const displayName = me?.name || me?.email || '—'

  const accountItems = [
    { label: t('sub_account'), icon: Cog6ToothIcon, href: '/dashboard/settings' },
    ...(!isWix ? [{ label: t('sub_billing'), icon: CreditCardIcon, href: '/dashboard/billing' }] : []),
    ...(me?.role === 'admin' ? [{ label: t('shell_admin_panel'), icon: ShieldCheckIcon, href: '/admin' }] : []),
    { label: t('sub_docs'), icon: BookOpenIcon, href: '/docs' },
    { label: t('shell_sign_out'), icon: ArrowRightOnRectangleIcon, onClick: () => { logout() }, danger: true, divider: true },
  ]

  const sidebar = (mode: 'static' | 'drawer', close: () => void) => (
    <Sidebar
      sections={DASHBOARD_SECTIONS}
      activeSectionId={activeSection?.id}
      features={features}
      isWix={isWix}
      badges={{ inbox: inboxUnread }}
      t={t}
      logoSrc={customLogo}
      brandName={brandName}
      homeHref="/dashboard"
      onNavigate={mode === 'drawer' ? close : undefined}
      onClose={mode === 'drawer' ? close : undefined}
      account={
        <AccountCard
          label={t('shell_account_menu')}
          name={displayName}
          email={me?.email}
          avatarSrc={(me as any)?.avatar_url}
          subtitle={`${roleLabel} · ${planLabel}`}
          items={accountItems}
        />
      }
      footer={
        <div className="flex flex-col items-center gap-1 px-2 text-[11px] text-deep-muted">
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
            <Link href="/legal/terms" className="text-deep-muted hover:text-white">{t('terms')}</Link>
            <Link href="/legal/privacy" className="text-deep-muted hover:text-white">{t('privacy')}</Link>
            <Link href="/status" className="text-deep-muted hover:text-white">{t('pub_status')}</Link>
          </div>
          {!hidePoweredBy && <p className="text-center opacity-80">{customFooter || `${t('shell_powered_by')} ${brandName || 'webek.org'}`}</p>}
        </div>
      }
    />
  )

  const banner = (planExpired || planExpiringSoon) && !isWix ? (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5 text-sm sm:px-6 lg:px-9', planExpired ? 'border-danger/20 bg-danger-bg text-danger' : 'border-warning/20 bg-warning-bg text-warning')} role="status">
      <span className="flex items-center gap-2">
        {planExpired ? <ExclamationTriangleIcon className="h-5 w-5 shrink-0" aria-hidden="true" /> : <ClockIcon className="h-5 w-5 shrink-0" aria-hidden="true" />}
        {planExpired ? t('shell_plan_expired') : t('shell_plan_expiring').replace('{n}', String(daysLeft))}
      </span>
      <Link href="/dashboard/billing" className="font-semibold text-inherit underline-offset-4 hover:text-inherit hover:underline">{t('shell_renew')}</Link>
    </div>
  ) : null

  if (!ready) {
    return (
      <>
        <Head><title>{`${title} | ${brandName || BRAND_ASSETS.name}`}</title></Head>
        <SessionLoading label={t('ui_loading')} dir={dir} />
      </>
    )
  }

  return (
    <>
      <Head>
        <title>{`${title} | ${brandName || BRAND_ASSETS.name}`}</title>
        <link key="favicon" rel="icon" href={favIcon || BRAND_ASSETS.favicon} />
        {customCss && <style>{customCss}</style>}
      </Head>

      <ShellFrame
        dir={dir}
        lang={lang}
        t={t}
        bleed={isBleed}
        sidebar={sidebar}
        subnav={!hideSubnav && !isBleed ? <SubNav section={activeSection} activeItem={activeItem} features={features} isWix={isWix} t={t} /> : null}
        banner={banner}
        topbar={(openMenu) => (
          <Topbar
            t={t}
            onOpenMenu={openMenu}
            onOpenSearch={openSearch}
            crumbs={crumbs.length ? crumbs : [{ label: title }]}
          >
            <LanguageMenu t={t} lang={lang} onChange={changeLang} className="hidden sm:inline-block" />
            <ThemeToggle t={t} />
            <NotificationsMenu
              t={t}
              lang={lang}
              items={notifications}
              unread={unreadCount}
              onMarkAllRead={markAllRead}
            />
            {memberRole !== 'viewer' && (
              <Button variant="dark" size="sm" href="/dashboard/campaigns" icon={PlusIcon} className="ms-1 h-10 px-3 sm:px-4" aria-label={t('shell_new_campaign')}>
                <span className="hidden sm:inline">{t('shell_new_campaign')}</span>
              </Button>
            )}
          </Topbar>
        )}
      >
        {locked && activeItem?.feature ? <UpgradeWall feature={activeItem.feature} /> : children}
      </ShellFrame>

      <CommandPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        sections={DASHBOARD_SECTIONS}
        features={features}
        isWix={isWix}
        t={t}
        dir={dir}
      />
    </>
  )
}

/* ── Notifications bell ─────────────────────────────────── */

function NotificationsMenu({ t, lang, items, unread, onMarkAllRead }: {
  t: (k: string, f?: string) => string
  lang: string
  items: NotificationRow[]
  unread: number
  onMarkAllRead: () => void
}) {
  const locale = DATE_LOCALES[lang as keyof typeof DATE_LOCALES] || enUS
  const label = unread > 0 ? `${t('shell_notifications')} (${unread})` : t('shell_notifications')
  return (
    <Popover className="relative">
      <Popover.Button
        className="relative flex h-10 w-10 items-center justify-center rounded-btn text-body transition hover:bg-surface-3 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal"
        aria-label={label}
      >
        <BellIcon className="h-5 w-5" aria-hidden="true" />
        {unread > 0 && (
          <span className="tabular absolute end-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-gradient px-1 text-[10px] font-bold text-[#04282C] ring-2 ring-surface" aria-hidden="true">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Popover.Button>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-150" enterFrom="opacity-0 translate-y-1" enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-100" leaveFrom="opacity-100 translate-y-0" leaveTo="opacity-0 translate-y-1"
      >
        <Popover.Panel className="fixed inset-x-3 top-[60px] z-overlay overflow-hidden rounded-2xl border border-line bg-surface shadow-dropdown sm:absolute sm:inset-x-auto sm:end-0 sm:top-12 sm:w-[360px]">
          {({ close }) => (
            <>
              <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
                <p className="text-sm font-semibold text-ink">{t('shell_notifications')}</p>
                {unread > 0 && (
                  <button type="button" onClick={onMarkAllRead} className="text-xs font-medium text-link hover:text-link-hover">
                    {t('shell_mark_all_read')}
                  </button>
                )}
              </div>
              <div className="max-h-[360px] overflow-y-auto">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-chip text-brand-ink"><BellIcon className="h-5 w-5" aria-hidden="true" /></span>
                    <p className="text-sm text-muted">{t('shell_no_notifications')}</p>
                  </div>
                ) : items.map(n => {
                  const Icon = notifIcons[n.type || ''] || InformationCircleIcon
                  return (
                    <Link
                      key={n.id}
                      href={n.link || '/dashboard/notifications'}
                      onClick={() => close()}
                      className={cn('flex items-start gap-3 border-b border-line-soft px-4 py-3 text-ink transition-colors last:border-0 hover:bg-surface-2 hover:text-ink', !n.is_read && 'bg-chip/40')}
                    >
                      <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]', notifTone[n.type || ''] || 'bg-chip text-chip-ink')}>
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold">{n.title}</span>
                        {n.body && <span className="block truncate text-xs text-muted">{n.body}</span>}
                        <span className="mt-0.5 block text-[11px] text-muted">
                          {(() => { try { return formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale }) } catch { return '' } })()}
                        </span>
                      </span>
                      {!n.is_read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-teal" aria-hidden="true" />}
                    </Link>
                  )
                })}
              </div>
              <div className="border-t border-line-soft px-4 py-2.5 text-center">
                <Link href="/dashboard/notifications" onClick={() => close()} className="text-xs font-medium text-link hover:text-link-hover">
                  {t('shell_view_all')}
                </Link>
              </div>
            </>
          )}
        </Popover.Panel>
      </Transition>
    </Popover>
  )
}
