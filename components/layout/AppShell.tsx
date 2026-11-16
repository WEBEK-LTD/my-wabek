import React, { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Dialog, Transition } from '@headlessui/react'
import {
  Bars3Icon, XMarkIcon, MagnifyingGlassIcon, LockClosedIcon, SunIcon, MoonIcon,
  LanguageIcon, ChevronUpDownIcon, ArrowTopRightOnSquareIcon, ChevronLeftIcon,
} from '@heroicons/react/24/outline'
import { cn } from '@/components/ui/utils'
import { Logo } from '@/components/ui/Logo'
import { Tabs } from '@/components/ui/Tabs'
import { Avatar } from '@/components/ui/Avatar'
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown'
import { useTheme } from '@/hooks/useTheme'
import { LANGUAGES } from '@/lib/i18n'
import { NavSection, NavItem, isItemActive, isItemLocked, isItemVisible } from './nav'

type T = (key: string, fallback?: string) => string

/* ══════════════════════════════════════════════════════════
   Sidebar (deep teal)
   ══════════════════════════════════════════════════════════ */

export interface SidebarProps {
  sections: NavSection[]
  activeSectionId?: string
  features?: Record<string, unknown>
  isWix?: boolean
  badges?: Partial<Record<NonNullable<NavSection['badge']>, number>>
  t: T
  logoSrc?: string | null
  brandName?: string | null
  homeHref: string
  /** Small label under the logo (e.g. "Admin"). */
  tag?: React.ReactNode
  /** Links between the nav and the account card. */
  extra?: React.ReactNode
  /** Account card at the bottom. */
  account?: React.ReactNode
  footer?: React.ReactNode
  onNavigate?: () => void
  onClose?: () => void
}

export function sectionHref(section: NavSection, ctx: { features?: Record<string, unknown>; isWix?: boolean }): string {
  const visible = section.items.filter(i => isItemVisible(i, ctx) && !i.external)
  return (visible.find(i => !isItemLocked(i, ctx)) || visible[0] || section.items[0]).href
}

export function Sidebar({ sections, activeSectionId, features, isWix, badges, t, logoSrc, brandName, homeHref, tag, extra, account, footer, onNavigate, onClose }: SidebarProps) {
  const ctx = { features, isWix }
  return (
    <div className="bg-deep-hero flex h-full flex-col gap-6 px-3.5 py-[22px]">
      <div className="flex items-center justify-between gap-2 px-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <Logo href={homeHref} src={logoSrc} name={brandName} tone="light" size={36} />
          {tag && <span className="rounded-full bg-[#8BE07A] px-2 py-0.5 text-2xs font-semibold text-[#04282C]">{tag}</span>}
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl text-deep-muted hover:bg-white/10 hover:text-white" aria-label={t('shell_close_menu')}>
            <XMarkIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>

      <nav aria-label={t('shell_main_nav')} className="-mx-1 flex min-h-0 flex-1 flex-col gap-[3px] overflow-y-auto px-1 scrollbar-none">
        {sections.map(section => {
          const visible = section.items.filter(i => isItemVisible(i, ctx))
          if (!visible.length) return null
          const active = section.id === activeSectionId
          const allLocked = visible.every(i => isItemLocked(i, ctx))
          const count = section.badge ? badges?.[section.badge] : undefined
          const Icon = section.icon
          return (
            <Link
              key={section.id}
              href={sectionHref(section, ctx)}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group flex items-center gap-3 rounded-btn px-3 py-[11px] text-[14.5px] transition-colors',
                active ? 'bg-white/[0.12] font-semibold text-white hover:text-white' : 'text-deep-muted hover:bg-white/[0.06] hover:text-white',
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{t(section.labelKey)}</span>
              {allLocked && <LockClosedIcon className="h-4 w-4 shrink-0 opacity-70" aria-label={t('shell_locked')} />}
              {!!count && count > 0 && (
                <span className="tabular rounded-full bg-[#8BE07A] px-2 py-0.5 text-[11px] font-semibold text-[#04282C]">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {extra}
      {account}
      {footer}
    </div>
  )
}

/* ── Account card (sidebar bottom) ───────────────────────── */

export interface AccountCardProps {
  name: string
  email?: string
  subtitle: React.ReactNode
  avatarSrc?: string | null
  items: DropdownItem[]
  label: string
}

export function AccountCard({ name, email, subtitle, avatarSrc, items, label }: AccountCardProps) {
  return (
    <Dropdown
      label={label}
      placement="top"
      align="start"
      width="w-[238px]"
      className="w-full"
      triggerClassName="w-full rounded-[14px] border border-white/10 bg-white/[0.07] p-3 text-start transition-colors hover:bg-white/[0.11] focus-visible:outline-[#8BE07A]"
      header={
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{name}</p>
          {email && <p className="truncate text-xs text-muted" dir="ltr">{email}</p>}
        </div>
      }
      items={items}
      trigger={
        <>
          <Avatar name={name} src={avatarSrc} size="md" />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-sm text-[#EAF7F5]">{name}</span>
            <span className="truncate text-xs text-deep-muted">{subtitle}</span>
          </span>
          <ChevronUpDownIcon className="h-4 w-4 shrink-0 text-deep-muted" aria-hidden="true" />
        </>
      }
    />
  )
}

/* ══════════════════════════════════════════════════════════
   Top bar
   ══════════════════════════════════════════════════════════ */

export interface Crumb {
  label: string
  href?: string
}

export interface TopbarProps {
  t: T
  onOpenMenu: () => void
  onOpenSearch: () => void
  /** Breadcrumb trail; the last crumb is the current page. */
  crumbs: Crumb[]
  /** End-side actions (language, theme, notifications, CTA…). */
  children?: React.ReactNode
  /** Small tag before the breadcrumb (e.g. Admin). */
  tag?: React.ReactNode
}

export function Topbar({ t, onOpenMenu, onOpenSearch, crumbs, children, tag }: TopbarProps) {
  const [isMac, setIsMac] = useState(false)
  useEffect(() => { setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) }, [])
  const trail = crumbs.filter((c, i) => c.label && (i === 0 || c.label !== crumbs[i - 1].label))
  return (
    <header className="sticky top-0 z-30 flex h-topbar shrink-0 items-center gap-2 border-b border-line bg-surface/85 px-3 backdrop-blur-md sm:gap-3 sm:px-5 lg:px-8">
      <button
        type="button"
        onClick={onOpenMenu}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-btn text-body hover:bg-surface-3 hover:text-ink lg:hidden"
        aria-label={t('shell_open_menu')}
      >
        <Bars3Icon className="h-6 w-6" aria-hidden="true" />
      </button>

      <nav aria-label={t('shell_breadcrumb')} className="flex min-w-0 flex-1 items-center gap-2">
        {tag}
        <ol className="flex min-w-0 items-center gap-1.5 text-sm">
          {trail.map((c, i) => {
            const last = i === trail.length - 1
            return (
              <li key={i} className={cn('flex min-w-0 items-center gap-1.5', !last && 'hidden shrink-0 sm:flex')}>
                {last ? (
                  <span className="truncate font-semibold text-ink" aria-current="page">{c.label}</span>
                ) : c.href ? (
                  <Link href={c.href} className="whitespace-nowrap text-muted hover:text-ink">{c.label}</Link>
                ) : (
                  <span className="whitespace-nowrap text-muted">{c.label}</span>
                )}
                {!last && <ChevronLeftIcon className="h-3.5 w-3.5 shrink-0 text-muted ltr:rotate-180" aria-hidden="true" />}
              </li>
            )
          })}
        </ol>
      </nav>

      <button
        type="button"
        onClick={onOpenSearch}
        className="hidden h-10 w-[260px] shrink items-center gap-2 rounded-btn border border-line bg-surface-2 px-3 text-sm text-muted transition hover:border-line-strong hover:text-ink md:flex xl:w-[320px]"
        aria-label={t('shell_search')}
        aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}
      >
        <MagnifyingGlassIcon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
        <span className="flex-1 truncate text-start">{t('shell_search')}</span>
        <kbd aria-hidden="true" dir="ltr">{isMac ? '⌘' : 'Ctrl'} K</kbd>
      </button>
      <button
        type="button"
        onClick={onOpenSearch}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-btn text-body hover:bg-surface-3 hover:text-ink md:hidden"
        aria-label={t('shell_search')}
      >
        <MagnifyingGlassIcon className="h-5 w-5" aria-hidden="true" />
      </button>

      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">{children}</div>
    </header>
  )
}

/* ── Topbar controls ─────────────────────────────────────── */

export function ThemeToggle({ t, className }: { t: T; className?: string }) {
  const { isDark, toggle } = useTheme()
  const label = isDark ? t('shell_theme_light') : t('shell_theme_dark')
  return (
    <button
      type="button"
      onClick={toggle}
      className={cn('flex h-10 w-10 items-center justify-center rounded-btn text-body transition hover:bg-surface-3 hover:text-ink', className)}
      aria-label={label}
      title={label}
    >
      {isDark ? <SunIcon className="h-5 w-5" aria-hidden="true" /> : <MoonIcon className="h-5 w-5" aria-hidden="true" />}
    </button>
  )
}

export function LanguageMenu({ t, lang, onChange, className }: { t: T; lang: string; onChange: (code: string) => void; className?: string }) {
  const current = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0]
  return (
    <Dropdown
      label={`${t('shell_language')}: ${current.name}`}
      className={className}
      width="w-44"
      triggerClassName="h-10 px-2.5 text-body hover:bg-surface-3 hover:text-ink"
      trigger={
        <>
          <LanguageIcon className="h-5 w-5" aria-hidden="true" />
          <span className="hidden text-xs font-semibold sm:inline" dir="ltr">{current.label}</span>
        </>
      }
      items={LANGUAGES.map(l => ({
        label: <span lang={l.code} dir={l.code === 'ar' ? 'rtl' : 'ltr'}>{l.name}</span>,
        hint: <span dir="ltr">{l.label}</span>,
        selected: l.code === lang,
        onClick: () => onChange(l.code),
      }))}
    />
  )
}

/* ══════════════════════════════════════════════════════════
   Section sub-navigation (secondary tab bar)
   ══════════════════════════════════════════════════════════ */

export function SubNav({ section, activeItem, features, isWix, t }: {
  section?: NavSection
  activeItem?: NavItem
  features?: Record<string, unknown>
  isWix?: boolean
  t: T
}) {
  if (!section) return null
  const ctx = { features, isWix }
  const items = section.items.filter(i => isItemVisible(i, ctx))
  if (items.length < 2) return null
  return (
    <div className="sticky top-0 z-20 border-b border-line bg-canvas/90 px-3 backdrop-blur-md sm:px-5 lg:px-8">
      <Tabs
        aria-label={t('shell_section_nav')}
        value={activeItem?.href || ''}
        className="border-b-0"
        tabs={items.map(i => ({
          id: i.href,
          href: i.href,
          label: (
            <span className="inline-flex items-center gap-1.5">
              {t(i.labelKey)}
              {i.external && <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />}
              {isItemLocked(i, ctx) && <LockClosedIcon className="h-3.5 w-3.5 text-warning" aria-label={t('shell_locked')} />}
            </span>
          ),
        }))}
      />
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   Command palette (⌘K / Ctrl+K)
   ══════════════════════════════════════════════════════════ */

export function CommandPalette({ open, onClose, sections, features, isWix, t, dir }: {
  open: boolean
  onClose: () => void
  sections: NavSection[]
  features?: Record<string, unknown>
  isWix?: boolean
  t: T
  dir: 'rtl' | 'ltr'
}) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = 'cmdk-list'

  const all = useMemo(() => {
    const ctx = { features, isWix }
    return sections.flatMap(s => s.items.filter(i => isItemVisible(i, ctx)).map(i => ({
      key: i.href,
      href: i.href,
      external: i.external,
      locked: isItemLocked(i, ctx),
      label: t(i.labelKey),
      section: t(s.labelKey),
      Icon: s.icon,
    })))
  }, [sections, features, isWix, t])

  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return all
    return all.filter(r => `${r.label} ${r.section} ${r.href}`.toLowerCase().includes(term))
  }, [all, q])

  useEffect(() => { if (open) { setQ(''); setIdx(0) } }, [open])
  useEffect(() => { setIdx(0) }, [q])

  const go = (r?: typeof results[number]) => {
    if (!r) return
    onClose()
    if (r.external) window.open(r.href, '_blank', 'noopener')
    else router.push(r.href)
  }

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-modal" onClose={onClose} initialFocus={inputRef} dir={dir}>
        <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-overlay/50 backdrop-blur-[3px]" aria-hidden="true" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto p-4 pt-[10vh]">
          <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 scale-[0.98]" enterTo="opacity-100 scale-100" leave="ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-[0.98]">
            <Dialog.Panel className="mx-auto w-full max-w-xl overflow-hidden rounded-panel border border-line bg-surface text-ink shadow-dropdown">
              <Dialog.Title className="sr-only">{t('shell_search')}</Dialog.Title>
              <div className="flex items-center gap-3 border-b border-line-soft px-4">
                <MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
                <input
                  ref={inputRef}
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(results.length - 1, i + 1)) }
                    if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(0, i - 1)) }
                    if (e.key === 'Enter') { e.preventDefault(); go(results[idx]) }
                  }}
                  placeholder={t('shell_search')}
                  className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
                  role="combobox"
                  aria-expanded="true"
                  aria-controls={listId}
                  aria-activedescendant={results[idx] ? `cmdk-${idx}` : undefined}
                  aria-autocomplete="list"
                />
                <kbd aria-hidden="true">Esc</kbd>
              </div>
              <ul id={listId} role="listbox" className="max-h-[min(420px,60vh)] overflow-y-auto p-2">
                {results.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted">{t('shell_no_results')}</li>}
                {results.map((r, i) => (
                  <li
                    key={r.key}
                    id={`cmdk-${i}`}
                    role="option"
                    aria-selected={i === idx}
                    onMouseEnter={() => setIdx(i)}
                    onClick={() => go(r)}
                    className={cn('flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm', i === idx ? 'bg-surface-3' : '')}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-chip text-brand-ink">
                      <r.Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium text-ink">{r.label}</span>
                      <span className="truncate text-xs text-muted">{r.section}</span>
                    </span>
                    {r.locked && <LockClosedIcon className="h-4 w-4 text-warning" aria-label={t('shell_locked')} />}
                    {r.external && <ArrowTopRightOnSquareIcon className="h-4 w-4 text-muted" aria-hidden="true" />}
                  </li>
                ))}
              </ul>
              <div className="border-t border-line-soft px-4 py-2.5 text-xs text-muted">{t('shell_search_hint')}</div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  )
}

/** Opens the palette on ⌘K / Ctrl+K. */
export function useCommandShortcut(onOpen: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); onOpen() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onOpen])
}

/* ══════════════════════════════════════════════════════════
   Frame: static sidebar ≥1024px, drawer below
   ══════════════════════════════════════════════════════════ */

export interface ShellFrameProps {
  dir: 'rtl' | 'ltr'
  lang: string
  t: T
  /** Render prop so the drawer copy can close itself on navigation. */
  sidebar: (mode: 'static' | 'drawer', close: () => void) => React.ReactNode
  topbar: (openMenu: () => void) => React.ReactNode
  subnav?: React.ReactNode
  banner?: React.ReactNode
  /** Remove content padding (full-height pages such as the inbox). */
  bleed?: boolean
  children: React.ReactNode
}

export function ShellFrame({ dir, lang, t, sidebar, topbar, subnav, banner, bleed, children }: ShellFrameProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const close = () => setOpen(false)
    router.events.on('routeChangeStart', close)
    return () => router.events.off('routeChangeStart', close)
  }, [router.events])

  // Keep <html lang/dir> in sync with the shell language.
  useEffect(() => {
    const root = document.documentElement
    root.lang = lang
    root.dir = dir
  }, [lang, dir])

  return (
    <div dir={dir} lang={lang} className="flex h-screen overflow-hidden bg-canvas text-ink">
      <a href="#main-content" className="sr-only z-toast rounded-btn bg-surface px-4 py-2 text-ink shadow-dropdown focus:not-sr-only focus:fixed focus:start-4 focus:top-4">
        {t('shell_skip')}
      </a>

      <aside className="hidden w-sidebar shrink-0 lg:block">{sidebar('static', () => {})}</aside>

      <Transition show={open} as={Fragment}>
        <Dialog as="div" className="relative z-overlay lg:hidden" onClose={setOpen} dir={dir}>
          <Transition.Child as={Fragment} enter="transition-opacity duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="transition-opacity duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-overlay/60 backdrop-blur-[2px]" aria-hidden="true" />
          </Transition.Child>
          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transition-transform duration-300 ease-out"
              enterFrom={dir === 'rtl' ? 'translate-x-full' : '-translate-x-full'}
              enterTo="translate-x-0"
              leave="transition-transform duration-200 ease-in"
              leaveFrom="translate-x-0"
              leaveTo={dir === 'rtl' ? 'translate-x-full' : '-translate-x-full'}
            >
              <Dialog.Panel className="relative h-full w-[min(86vw,300px)] shadow-dropdown">
                <Dialog.Title className="sr-only">{t('shell_main_nav')}</Dialog.Title>
                {sidebar('drawer', () => setOpen(false))}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {topbar(() => setOpen(true))}
        <main id="main-content" tabIndex={-1} className="relative flex-1 overflow-y-auto focus:outline-none">
          {subnav}
          {banner}
          <div className={cn(bleed ? 'p-4 md:p-6' : 'mx-auto w-full max-w-content px-4 py-6 sm:px-6 lg:px-9 lg:py-7')}>{children}</div>
        </main>
      </div>
    </div>
  )
}
