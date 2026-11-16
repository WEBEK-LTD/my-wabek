import { useEffect, useMemo, useState } from 'react'
import { ArrowUpIcon, ListBulletIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import { cn } from '@/components/ui/utils'
import type { DocsLang } from './lib/manifest'
import { docsStrings } from './lib/strings'
import type { TocItem } from './lib/types'

/** Id of the heading currently at the top of the viewport. */
function useActiveHeading(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(ids[0] || null)
  useEffect(() => {
    if (!ids.length) return
    const els = ids.map(id => document.getElementById(id)).filter((e): e is HTMLElement => !!e)
    const update = () => {
      const offset = 120
      let current: string | null = els[0]?.id || null
      for (const el of els) {
        if (el.getBoundingClientRect().top - offset <= 0) current = el.id
        else break
      }
      // At the very bottom, highlight the last heading.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = els[els.length - 1]?.id || current
      setActive(current)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [ids])
  return active
}

function TocList({ toc, active, onPick }: { toc: TocItem[]; active: string | null; onPick?: () => void }) {
  return (
    <ul className="flex flex-col border-s border-line">
      {toc.map(item => {
        const on = item.id === active
        return (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              onClick={onPick}
              aria-current={on ? 'location' : undefined}
              className={cn(
                '-ms-px block border-s-2 py-1.5 text-[13px] leading-snug transition-colors',
                item.depth === 3 ? 'ps-6' : 'ps-3.5',
                on ? 'border-brand-teal font-medium text-ink' : 'border-transparent text-muted hover:text-ink',
              )}
            >
              {item.text}
            </a>
          </li>
        )
      })}
    </ul>
  )
}

/** Sticky "On this page" column (xl and up). */
export default function DocsToc({ lang, toc }: { lang: DocsLang; toc: TocItem[] }) {
  const s = docsStrings(lang)
  const ids = useIds(toc)
  const active = useActiveHeading(ids)
  if (!toc.length) return null
  return (
    <nav aria-labelledby="docs-toc-title" className="flex flex-col gap-3">
      <h2 id="docs-toc-title" className="flex items-center gap-2 text-[12.5px] font-semibold text-ink">
        <ListBulletIcon className="h-4 w-4 text-brand-ink" aria-hidden="true" />
        {s.onThisPage}
      </h2>
      <TocList toc={toc} active={active} />
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="mt-2 flex items-center gap-1.5 self-start rounded-btn px-1 py-1 text-[12.5px] text-muted transition hover:text-ink"
      >
        <ArrowUpIcon className="h-3.5 w-3.5" aria-hidden="true" />
        {s.backToTop}
      </button>
    </nav>
  )
}

/** Collapsible table of contents shown above the article below xl. */
export function DocsTocInline({ lang, toc }: { lang: DocsLang; toc: TocItem[] }) {
  const s = docsStrings(lang)
  const [open, setOpen] = useState(false)
  const ids = useIds(toc)
  const active = useActiveHeading(ids)
  if (toc.length < 2) return null
  return (
    <div className="rounded-card border border-line bg-surface shadow-card xl:hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls="docs-toc-inline"
        className="flex w-full items-center gap-2 px-4 py-3 text-start text-[13.5px] font-semibold text-ink"
      >
        <ListBulletIcon className="h-4 w-4 text-brand-ink" aria-hidden="true" />
        <span className="flex-1">{s.onThisPage}</span>
        <ChevronDownIcon className={cn('h-4 w-4 text-muted transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      <div id="docs-toc-inline" hidden={!open} className="px-4 pb-4">
        <TocList toc={toc} active={active} onPick={() => setOpen(false)} />
      </div>
    </div>
  )
}

function useIds(toc: TocItem[]): string[] {
  const key = toc.map(t => t.id).join('|')
  return useMemo(() => key.split('|').filter(Boolean), [key])
}
