import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeftIcon, ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { cn } from '@/components/ui/utils'
import { docsHref } from './lib/manifest'
import { docsStrings } from './lib/strings'
import type { DocPageProps, PagerLink } from './lib/types'
import DocsShell from './DocsShell'
import DocsSidebar, { sectionIcon } from './DocsSidebar'
import DocsToc, { DocsTocInline } from './DocsToc'
import DocContent from './DocContent'
import DocsSeo from './DocsSeo'

function PagerCard({ link, kind, lang }: { link: PagerLink; kind: 'prev' | 'next'; lang: DocPageProps['lang'] }) {
  const s = docsStrings(lang)
  const rtl = lang === 'ar'
  // "Previous" points back along the reading direction, "next" forward.
  const Arrow = kind === 'prev' ? (rtl ? ArrowRightIcon : ArrowLeftIcon) : (rtl ? ArrowLeftIcon : ArrowRightIcon)
  return (
    <Link
      href={docsHref(lang, link.slug)}
      rel={kind}
      className={cn(
        'group flex min-w-0 flex-1 items-center gap-3 rounded-card border border-line bg-surface p-4 shadow-card transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card-hover sm:p-5',
        kind === 'next' && 'flex-row-reverse text-end',
      )}
    >
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-chip text-chip-ink transition group-hover:bg-brand-gradient group-hover:text-[#04282C]">
        <Arrow className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] text-muted">{kind === 'prev' ? s.previous : s.next} · {link.section}</span>
        <span className="mt-0.5 block truncate text-[15px] font-semibold text-ink">{link.title}</span>
      </span>
    </Link>
  )
}

export default function DocPage({ lang, nav, search, page, prev, next }: DocPageProps) {
  const s = docsStrings(lang)
  const Chevron = lang === 'ar' ? ChevronLeftIcon : ChevronRightIcon
  const SectionIcon = sectionIcon(page.sectionId)
  const sectionFirst = nav.find(n => n.id === page.sectionId)?.pages[0]?.slug || page.slug
  const sidebarRef = useRef<HTMLDivElement>(null)

  // Keep the current page visible in the (independently scrolling) sidebar.
  useEffect(() => {
    const box = sidebarRef.current
    const link = box?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!box || !link) return
    const b = box.getBoundingClientRect()
    const l = link.getBoundingClientRect()
    if (l.top < b.top + 60 || l.bottom > b.bottom - 20) box.scrollTop += l.top - b.top - b.height / 3
  }, [page.slug])

  return (
    <>
      <DocsSeo
        lang={lang}
        slug={page.slug}
        title={page.title}
        description={page.description}
        trail={[{ name: page.sectionTitle, slug: sectionFirst }, { name: page.title, slug: page.slug }]}
      />
      <DocsShell lang={lang} nav={nav} search={search} slug={page.slug} barTitle={page.title}>
        {({ openSearch }) => (
          <div className="mx-auto grid max-w-[1440px] gap-8 px-4 pb-20 pt-6 sm:px-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10 lg:pt-8 xl:grid-cols-[260px_minmax(0,1fr)_220px]">
            <aside className="hidden lg:block">
              <div ref={sidebarRef} className="sticky top-[92px] max-h-[calc(100vh-108px)] overflow-y-auto pe-2 [scrollbar-width:thin]">
                <DocsSidebar lang={lang} nav={nav} activeSlug={page.slug} onSearch={openSearch} />
              </div>
            </aside>

            <main id="main" className="min-w-0">
              <article className="mx-auto max-w-[780px]">
                <nav aria-label={s.breadcrumb} className="mb-4">
                  <ol className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
                    <li><Link href={docsHref(lang)} className="text-muted hover:text-ink">{s.docs}</Link></li>
                    <li aria-hidden="true"><Chevron className="h-3.5 w-3.5" /></li>
                    <li><Link href={docsHref(lang, sectionFirst)} className="text-muted hover:text-ink">{page.sectionTitle}</Link></li>
                  </ol>
                </nav>

                <header className="relative mb-8 overflow-hidden rounded-hero border border-line bg-surface p-6 shadow-card sm:p-8">
                  {/* Soft brand glow in the corner */}
                  <div aria-hidden="true" className="pointer-events-none absolute -top-24 end-[-60px] h-56 w-56 rounded-full bg-brand-gradient opacity-[0.14] blur-3xl" />
                  <div className="relative">
                    <span className="inline-flex items-center gap-2 rounded-full bg-chip px-3 py-1 text-[12.5px] font-medium text-chip-ink">
                      <SectionIcon className="h-4 w-4" aria-hidden="true" />
                      {page.sectionTitle}
                    </span>
                    <h1 className="mt-4 text-[28px] font-bold leading-tight tracking-[-0.01em] text-ink sm:text-[34px]">{page.title}</h1>
                    {page.description && <p className="mt-3 max-w-[640px] text-[16px] leading-relaxed text-body">{page.description}</p>}
                  </div>
                </header>

                <div className="mb-8">
                  <DocsTocInline lang={lang} toc={page.toc} />
                </div>

                <DocContent html={page.html} lang={lang} />

                {(prev || next) && (
                  <nav aria-label={`${s.previous} / ${s.next}`} className="mt-14 flex flex-col gap-3 border-t border-line pt-8 sm:flex-row">
                    {prev ? <PagerCard link={prev} kind="prev" lang={lang} /> : <span className="hidden flex-1 sm:block" />}
                    {next ? <PagerCard link={next} kind="next" lang={lang} /> : <span className="hidden flex-1 sm:block" />}
                  </nav>
                )}
              </article>
            </main>

            <aside className="hidden xl:block">
              <div className="sticky top-[92px] max-h-[calc(100vh-108px)] overflow-y-auto">
                <DocsToc lang={lang} toc={page.toc} />
              </div>
            </aside>
          </div>
        )}
      </DocsShell>
    </>
  )
}
