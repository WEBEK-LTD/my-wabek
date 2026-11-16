import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { Dialog, Transition } from '@headlessui/react'
import {
  MagnifyingGlassIcon, XMarkIcon, DocumentTextIcon, HashtagIcon, ArrowTurnDownLeftIcon,
} from '@heroicons/react/24/outline'
import { cn } from '@/components/ui/utils'
import { docsHref, type DocsLang } from './lib/manifest'
import { docsStrings } from './lib/strings'
import { searchDocs, highlightParts, type SearchResult } from './lib/search'
import type { SearchEntry } from './lib/types'

function Highlight({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightParts(text, query).map((p, i) =>
        p.match ? <mark key={i} className="rounded-[4px] bg-brand-teal/20 px-0.5 text-inherit dark:bg-brand-teal/30">{p.text}</mark> : <Fragment key={i}>{p.text}</Fragment>,
      )}
    </>
  )
}

const SUGGESTED = ['getting-started/overview', 'getting-started/connect-number', 'getting-started/messaging-window', 'api/authentication', 'api/send-message', 'faq/troubleshooting']

export interface DocsSearchProps {
  lang: DocsLang
  index: SearchEntry[]
  open: boolean
  onClose: () => void
}

export default function DocsSearch({ lang, index, open, onClose }: DocsSearchProps) {
  const s = docsStrings(lang)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const dir = lang === 'ar' ? 'rtl' : 'ltr'

  const results: SearchResult[] = useMemo(() => {
    if (query.trim()) return searchDocs(index, query, 14)
    return SUGGESTED
      .map(slug => index.find(e => e.s === slug))
      .filter((e): e is SearchEntry => !!e)
      .map(e => ({ slug: e.s, hash: null, title: e.t, context: e.c, snippet: e.d, score: 0 }))
  }, [index, query])

  useEffect(() => { setActive(0) }, [query])
  useEffect(() => { if (!open) setQuery('') }, [open])
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const go = (r: SearchResult) => {
    onClose()
    router.push(docsHref(lang, r.slug, r.hash || undefined))
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter' && results[active]) { e.preventDefault(); go(results[active]) }
  }

  const optionId = (i: number) => `docs-search-opt-${i}`
  const hasQuery = !!query.trim()

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-modal" onClose={onClose} initialFocus={inputRef} dir={dir} lang={lang}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-overlay/55 backdrop-blur-[3px]" aria-hidden="true" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto p-3 pt-[8vh] sm:p-6 sm:pt-[12vh]">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200" enterFrom="opacity-0 scale-[0.98] -translate-y-2" enterTo="opacity-100 scale-100 translate-y-0"
            leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-[0.98]"
          >
            <Dialog.Panel className="mx-auto flex max-h-[80vh] w-full max-w-[640px] flex-col overflow-hidden rounded-panel border border-line bg-surface text-ink shadow-dropdown">
              <Dialog.Title className="sr-only">{s.searchDocs}</Dialog.Title>
              <div className="flex items-center gap-3 border-b border-line px-4 sm:px-5">
                <MagnifyingGlassIcon className="h-5 w-5 flex-none text-brand-ink" aria-hidden="true" />
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={s.searchPlaceholder}
                  aria-label={s.searchDocs}
                  role="combobox"
                  aria-expanded={results.length > 0}
                  aria-controls="docs-search-list"
                  aria-activedescendant={results[active] ? optionId(active) : undefined}
                  aria-autocomplete="list"
                  autoComplete="off"
                  spellCheck={false}
                  className="h-[60px] min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
                />
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={s.closeSearch}
                  className="flex h-9 w-9 flex-none items-center justify-center rounded-btn text-muted transition hover:bg-surface-3 hover:text-ink"
                >
                  <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-3">
                {results.length > 0 ? (
                  <>
                    <p className="px-3 pb-1.5 pt-1 text-[12px] font-medium text-muted">{hasQuery ? s.results : s.suggested}</p>
                    <ul id="docs-search-list" ref={listRef} role="listbox" aria-label={hasQuery ? s.results : s.suggested} className="flex flex-col gap-0.5">
                      {results.map((r, i) => {
                        const Icon = r.hash ? HashtagIcon : DocumentTextIcon
                        const selected = i === active
                        return (
                          <li
                            key={`${r.slug}#${r.hash || ''}`}
                            id={optionId(i)}
                            data-idx={i}
                            role="option"
                            aria-selected={selected}
                            onMouseMove={() => setActive(i)}
                            onClick={() => go(r)}
                            className={cn(
                              'flex cursor-pointer items-start gap-3 rounded-[14px] px-3 py-2.5 transition-colors',
                              selected ? 'bg-chip' : 'hover:bg-surface-2',
                            )}
                          >
                            <span className={cn('mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-[10px]', selected ? 'bg-surface text-brand-ink' : 'bg-surface-3 text-muted')}>
                              <Icon className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={cn('block truncate text-[14.5px] font-medium', selected ? 'text-chip-ink' : 'text-ink')}>
                                <Highlight text={r.title} query={query} />
                              </span>
                              <span className="mt-0.5 block truncate text-[12.5px] text-muted">
                                {r.context}
                                {r.snippet && <> · <Highlight text={r.snippet} query={query} /></>}
                              </span>
                            </span>
                            {selected && <ArrowTurnDownLeftIcon className="mt-2 h-4 w-4 flex-none text-chip-ink rtl:-scale-x-100" aria-hidden="true" />}
                          </li>
                        )
                      })}
                    </ul>
                  </>
                ) : (
                  <div className="flex flex-col items-center px-6 py-12 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-chip text-brand-ink">
                      <MagnifyingGlassIcon className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <p className="mt-4 text-[15px] font-semibold text-ink" role="status">{s.noResults}</p>
                    <p className="mt-1 max-w-sm text-sm text-muted">{s.noResultsHint}</p>
                  </div>
                )}
              </div>

              <div className="hidden items-center gap-4 border-t border-line bg-surface-2 px-5 py-2.5 text-[12px] text-muted sm:flex">
                <span className="flex items-center gap-1.5"><kbd className="rounded border border-line bg-surface px-1.5 font-sans">↑</kbd><kbd className="rounded border border-line bg-surface px-1.5 font-sans">↓</kbd>{s.navigate}</span>
                <span className="flex items-center gap-1.5"><kbd className="rounded border border-line bg-surface px-1.5 font-sans">Enter</kbd>{s.open}</span>
                <span className="flex items-center gap-1.5"><kbd className="rounded border border-line bg-surface px-1.5 font-sans">Esc</kbd>{s.close}</span>
                <span className="ms-auto hidden md:inline">{s.searchHint}</span>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  )
}

/** Opens the search on Ctrl/⌘+K or "/" (outside text fields). */
export function useSearchHotkey(open: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); open() }
      else if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); open() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
}
