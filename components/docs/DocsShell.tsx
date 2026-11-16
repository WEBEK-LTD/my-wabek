import { Fragment, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Dialog, Transition } from '@headlessui/react'
import { Bars3BottomLeftIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import PublicNav from '@/components/PublicNav'
import PublicFooter from '@/components/PublicFooter'
import { cn } from '@/components/ui/utils'
import { docsHref, docsLangFor, type DocsLang } from './lib/manifest'
import { docsStrings } from './lib/strings'
import type { NavSection, SearchEntry } from './lib/types'
import DocsSidebar from './DocsSidebar'
import DocsSearch, { useSearchHotkey } from './DocsSearch'
import { useDocsLangSync } from './useDocsLang'

export interface DocsShellProps {
  lang: DocsLang
  nav: NavSection[]
  search: SearchEntry[]
  /** Current page slug; null on the docs home. */
  slug: string | null
  /** Title shown in the mobile docs bar. */
  barTitle?: string
  /** Render the sidebar column (pages) — the home page uses a full-width layout. */
  withSidebar?: boolean
  children: (api: { openSearch: () => void }) => React.ReactNode
}

export default function DocsShell({ lang, nav, search, slug, barTitle, withSidebar = true, children }: DocsShellProps) {
  const s = docsStrings(lang)
  const router = useRouter()
  const dir = lang === 'ar' ? 'rtl' : 'ltr'
  const [searchOpen, setSearchOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useDocsLangSync(lang, slug)

  const openSearch = useCallback(() => { setDrawerOpen(false); setSearchOpen(true) }, [])
  useSearchHotkey(openSearch)

  useEffect(() => {
    const close = () => setDrawerOpen(false)
    router.events.on('routeChangeStart', close)
    return () => router.events.off('routeChangeStart', close)
  }, [router.events])

  // Show the current page when the drawer opens.
  useEffect(() => {
    if (!drawerOpen) return
    const id = window.setTimeout(() => {
      document.querySelector<HTMLElement>('#docs-drawer [aria-current="page"]')?.scrollIntoView({ block: 'center' })
    }, 60)
    return () => window.clearTimeout(id)
  }, [drawerOpen])

  // The site-wide language menu maps onto the docs: Arabic → /docs, anything else → /en/docs.
  const onLangChange = (code: string) => {
    const target = docsLangFor(code)
    if (target !== lang) router.push(docsHref(target, slug) + window.location.hash)
  }

  return (
    <div dir={dir} lang={lang} className="min-h-screen bg-canvas text-ink">
      <PublicNav active="/docs" lang={lang} onLangChange={onLangChange} />

      {withSidebar && (
        // Mobile / tablet docs bar: menu drawer + search.
        <div className="sticky top-[76px] z-30 border-b border-line bg-surface/90 backdrop-blur-md lg:hidden">
          <div className="mx-auto flex h-[52px] max-w-[1440px] items-center gap-2 px-4 sm:px-8">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label={s.openMenu}
              aria-expanded={drawerOpen}
              className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-btn px-2 text-start text-[14px] text-ink transition hover:bg-surface-3"
            >
              <Bars3BottomLeftIcon className="h-5 w-5 flex-none text-brand-ink rtl:-scale-x-100" aria-hidden="true" />
              <span className="truncate font-medium">{barTitle || s.menu}</span>
            </button>
            <button
              type="button"
              onClick={openSearch}
              aria-label={s.searchDocs}
              className="flex h-10 w-10 flex-none items-center justify-center rounded-btn text-ink transition hover:bg-surface-3"
            >
              <MagnifyingGlassIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {children({ openSearch })}

      <PublicFooter lang={lang} onLangChange={onLangChange} />

      <DocsSearch lang={lang} index={search} open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Mobile drawer */}
      <Transition show={drawerOpen} as={Fragment}>
        <Dialog as="div" className="relative z-modal lg:hidden" onClose={setDrawerOpen} dir={dir} lang={lang}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
            leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-overlay/55 backdrop-blur-[2px]" aria-hidden="true" />
          </Transition.Child>
          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transition ease-out duration-200"
              enterFrom={cn(dir === 'rtl' ? 'translate-x-full' : '-translate-x-full')}
              enterTo="translate-x-0"
              leave="transition ease-in duration-150"
              leaveFrom="translate-x-0"
              leaveTo={cn(dir === 'rtl' ? 'translate-x-full' : '-translate-x-full')}
            >
              <Dialog.Panel className="flex h-full w-[86vw] max-w-[340px] flex-col border-e border-line bg-canvas shadow-dropdown">
                <div className="flex h-[60px] flex-none items-center justify-between border-b border-line bg-surface px-4">
                  <Dialog.Title className="text-[15px] font-semibold text-ink">{s.menu}</Dialog.Title>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    aria-label={s.closeMenu}
                    className="flex h-10 w-10 items-center justify-center rounded-btn text-muted transition hover:bg-surface-3 hover:text-ink"
                  >
                    <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
                <div id="docs-drawer" className="min-h-0 flex-1 overflow-y-auto px-4 pt-4">
                  <DocsSidebar lang={lang} nav={nav} activeSlug={slug} onSearch={openSearch} onNavigate={() => setDrawerOpen(false)} />
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </div>
  )
}
