import Link from 'next/link'
import {
  RocketLaunchIcon, BookOpenIcon, PuzzlePieceIcon, CodeBracketIcon, ShieldCheckIcon,
  QuestionMarkCircleIcon, ClockIcon, DocumentTextIcon, MagnifyingGlassIcon, HomeIcon,
} from '@heroicons/react/24/outline'
import { cn } from '@/components/ui/utils'
import { docsHref, type DocsLang } from './lib/manifest'
import { docsStrings } from './lib/strings'
import type { NavSection } from './lib/types'
import DocsLangSwitch from './DocsLangSwitch'

export const SECTION_ICONS: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  'getting-started': RocketLaunchIcon,
  guides: BookOpenIcon,
  integrations: PuzzlePieceIcon,
  api: CodeBracketIcon,
  security: ShieldCheckIcon,
  faq: QuestionMarkCircleIcon,
  changelog: ClockIcon,
}
export const sectionIcon = (id: string) => SECTION_ICONS[id] || DocumentTextIcon

export interface DocsSidebarProps {
  lang: DocsLang
  nav: NavSection[]
  activeSlug?: string | null
  onSearch: () => void
  onNavigate?: () => void
  className?: string
}

export default function DocsSidebar({ lang, nav, activeSlug, onSearch, onNavigate, className }: DocsSidebarProps) {
  const s = docsStrings(lang)
  return (
    <div className={cn('flex flex-col gap-5', className)}>
      <button
        type="button"
        onClick={onSearch}
        className="group flex h-11 w-full items-center gap-2.5 rounded-btn border border-line bg-surface px-3.5 text-start text-sm text-muted shadow-card transition hover:border-line-strong hover:text-ink"
      >
        <MagnifyingGlassIcon className="h-[18px] w-[18px] flex-none text-brand-ink" aria-hidden="true" />
        <span className="flex-1 truncate">{s.searchPlaceholder}</span>
        <kbd dir="ltr" className="hidden rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-[11px] text-muted sm:inline">Ctrl K</kbd>
      </button>

      <DocsLangSwitch lang={lang} slug={activeSlug} />

      <nav aria-label={s.docsNav} className="flex flex-col gap-5 pb-6">
        <Link
          href={docsHref(lang)}
          onClick={onNavigate}
          aria-current={!activeSlug ? 'page' : undefined}
          className={cn(
            'flex items-center gap-2.5 rounded-btn px-2.5 py-2 text-[14px] transition-colors',
            !activeSlug ? 'bg-chip font-semibold text-chip-ink' : 'text-body hover:bg-surface-3 hover:text-ink',
          )}
        >
          <HomeIcon className="h-[18px] w-[18px]" aria-hidden="true" />
          {s.docsTitle}
        </Link>

        {nav.map(section => {
          const Icon = sectionIcon(section.id)
          const headingId = `docs-nav-${section.id}`
          const containsActive = section.pages.some(p => p.slug === activeSlug)
          return (
            <div key={section.id}>
              <h2 id={headingId} className="mb-1.5 flex items-center gap-2 px-2.5 text-[12.5px] font-semibold text-ink">
                <span className={cn('flex h-6 w-6 items-center justify-center rounded-lg', containsActive ? 'bg-brand-gradient text-[#04282C]' : 'bg-chip text-chip-ink')}>
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                {section.title}
              </h2>
              <ul aria-labelledby={headingId} className="relative ms-[22px] border-s border-line ps-2">
                {section.pages.map(page => {
                  const active = page.slug === activeSlug
                  return (
                    <li key={page.slug}>
                      <Link
                        href={docsHref(lang, page.slug)}
                        onClick={onNavigate}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'relative block rounded-[10px] px-2.5 py-[7px] text-[13.5px] leading-snug transition-colors',
                          active
                            ? 'bg-chip font-semibold text-chip-ink before:absolute before:-start-[9px] before:top-1.5 before:bottom-1.5 before:w-[2px] before:rounded-full before:bg-brand-gradient'
                            : 'text-muted hover:bg-surface-3 hover:text-ink',
                        )}
                      >
                        {page.title}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>
    </div>
  )
}
