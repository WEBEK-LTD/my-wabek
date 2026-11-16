import { useState } from 'react'
import Link from 'next/link'
import {
  MagnifyingGlassIcon, ChevronLeftIcon, ChevronRightIcon, ArrowLeftIcon, ArrowRightIcon,
  ClipboardDocumentIcon, CheckIcon, LifebuoyIcon, WrenchScrewdriverIcon, KeyIcon, CommandLineIcon,
} from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/utils'
import { docsHref } from './lib/manifest'
import { docsStrings } from './lib/strings'
import type { DocsHomeProps } from './lib/types'
import DocsShell from './DocsShell'
import DocsLangSwitch from './DocsLangSwitch'
import { sectionIcon } from './DocsSidebar'
import DocsSeo from './DocsSeo'
import styles from './docs.module.css'

const POPULAR = ['getting-started/overview', 'getting-started/connect-number', 'api/authentication', 'api/send-message', 'integrations/wordpress']
const BASE_URL = 'https://waabek.com'

function CopyInline({ text, label, done }: { text: string; label: string; done: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      aria-label={label}
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1800) } catch {}
      }}
      className="flex h-9 flex-none items-center gap-1.5 rounded-[10px] px-3 text-[12.5px] text-muted transition hover:bg-surface-3 hover:text-ink"
    >
      {copied ? <CheckIcon className="h-4 w-4 text-success" aria-hidden="true" /> : <ClipboardDocumentIcon className="h-4 w-4" aria-hidden="true" />}
      <span aria-live="polite">{copied ? done : label}</span>
    </button>
  )
}

export default function DocsHome({ lang, nav, search, sections, sampleHtml }: DocsHomeProps) {
  const s = docsStrings(lang)
  const rtl = lang === 'ar'
  const Chevron = rtl ? ChevronLeftIcon : ChevronRightIcon
  const Forward = rtl ? ArrowLeftIcon : ArrowRightIcon
  const titles = new Map(nav.flatMap(sec => sec.pages.map(p => [p.slug, p.title] as const)))
  const popular = POPULAR.filter(slug => titles.has(slug))

  return (
    <>
      <DocsSeo lang={lang} slug={null} title={s.docsTitle} description={s.homeDescription} />
      <DocsShell lang={lang} nav={nav} search={search} slug={null} withSidebar={false}>
        {({ openSearch }) => (
          <main id="main" className="pb-20">
            {/* Hero */}
            <section className="mx-auto max-w-[1280px] px-4 pt-6 sm:px-8 sm:pt-8">
              <div className="relative overflow-hidden rounded-hero bg-deep-landing shadow-hero">
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(#EAF7F5_1px,transparent_1px)] [background-size:22px_22px]" />
                <div className="relative grid gap-10 p-6 sm:p-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-12 lg:p-14">
                  <div>
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-[13px] text-[#B5D3D0]">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-green" aria-hidden="true" />
                      {s.docsTitle}
                    </span>
                    <h1 className="mt-5 text-[30px] font-bold leading-[1.25] tracking-[-0.01em] text-[#EAF7F5] sm:text-[42px]">
                      {s.homeTitle}
                    </h1>
                    <p className="mt-4 max-w-[560px] text-[16px] leading-relaxed text-[#B5D3D0] sm:text-[17px]">{s.homeLead}</p>

                    <button
                      type="button"
                      onClick={openSearch}
                      className="group mt-7 flex h-14 w-full max-w-[520px] items-center gap-3 rounded-[16px] border border-white/15 bg-[#EAF7F5] px-4 text-start text-[15px] text-[#4A6668] shadow-[0_18px_40px_rgba(0,0,0,0.25)] transition hover:bg-white"
                    >
                      <MagnifyingGlassIcon className="h-5 w-5 flex-none text-[#0B8A92]" aria-hidden="true" />
                      <span className="flex-1 truncate">{s.searchPlaceholder}</span>
                      <kbd dir="ltr" className="hidden rounded-md border border-[#C9DAD7] bg-white px-2 py-0.5 font-sans text-[11.5px] text-[#4A6668] sm:inline">Ctrl K</kbd>
                    </button>

                    {popular.length > 0 && (
                      <div className="mt-5 flex flex-wrap items-center gap-2 text-[13px]">
                        <span className="text-[#B5D3D0]">{s.popular}</span>
                        {popular.map(slug => (
                          <Link
                            key={slug}
                            href={docsHref(lang, slug)}
                            className="rounded-full border border-white/15 bg-white/[0.05] px-3 py-1 text-[#EAF7F5] transition hover:border-white/30 hover:bg-white/10 hover:text-white"
                          >
                            {titles.get(slug)}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Request sample, built from the docs content */}
                  <div className="min-w-0" dir="ltr">
                    <div className="overflow-hidden rounded-[20px] border border-white/10 bg-[#021A1D]/80 shadow-[0_30px_70px_rgba(0,0,0,0.35)] backdrop-blur">
                      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
                        <span className="rounded-md bg-[#8BE07A]/15 px-2 py-0.5 font-mono text-[11.5px] font-semibold text-[#8BE07A]">POST</span>
                        <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-[#EAF7F5]">/api/v1/send</code>
                        <span className="font-mono text-[11.5px] text-[#B5D3D0]">cURL</span>
                      </div>
                      <div className={styles.sample} dangerouslySetInnerHTML={{ __html: sampleHtml }} />
                      <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3" dir={rtl ? 'rtl' : 'ltr'}>
                        <span className="flex items-center gap-2 text-[13px] text-[#B5D3D0]">
                          <CommandLineIcon className="h-4 w-4" aria-hidden="true" />
                          {s.sampleLabel}
                        </span>
                        <Link href={docsHref(lang, 'api/send-message')} className="flex items-center gap-1 text-[13px] font-medium text-[#5FD6D0] hover:text-[#8BE07A]">
                          {s.apiRef}
                          <Chevron className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Sections */}
            <section aria-labelledby="docs-sections" className="mx-auto mt-14 max-w-[1280px] px-4 sm:px-8">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 id="docs-sections" className="text-[24px] font-bold text-ink">{s.browseSections}</h2>
                  <p className="mt-1 text-[15px] text-muted">{s.browseLead}</p>
                </div>
                <DocsLangSwitch lang={lang} slug={null} className="w-full max-w-[240px]" />
              </div>

              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sections.map(sec => {
                  const Icon = sectionIcon(sec.id)
                  // Getting started and the API reference get wide cards: 7 sections fill 3 rows evenly.
                  const wide = sec.id === 'getting-started' || sec.id === 'api'
                  return (
                    <li key={sec.id} className={cn(wide && 'sm:col-span-2', sec.id === 'changelog' && 'sm:col-span-2 lg:col-span-1')}>
                      <article className="group flex h-full flex-col rounded-card border border-line bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card-hover sm:p-6">
                        <div className="flex items-center justify-between gap-3">
                          <span className={cn(
                            'flex h-11 w-11 items-center justify-center rounded-[14px]',
                            wide ? 'bg-brand-gradient text-[#04282C] shadow-glow' : 'bg-chip text-chip-ink',
                          )}>
                            <Icon className="h-[22px] w-[22px]" aria-hidden="true" />
                          </span>
                          <span className="rounded-full bg-surface-3 px-2.5 py-1 text-[12px] font-medium text-muted">{s.pagesCount(sec.pages.length)}</span>
                        </div>
                        <h3 className="mt-4 text-[17px] font-semibold text-ink">
                          <Link href={docsHref(lang, sec.firstSlug)} className="text-ink hover:text-link">{sec.title}</Link>
                        </h3>
                        <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{s.sectionDescriptions[sec.id] || ''}</p>
                        <ul className={cn('mt-4 grid gap-0.5 border-t border-line-soft pt-3', wide && 'md:grid-cols-2 md:gap-x-4')}>
                          {sec.pages.slice(0, wide ? 6 : 4).map(p => (
                            <li key={p.slug}>
                              <Link href={docsHref(lang, p.slug)} className="flex items-center gap-2 rounded-[10px] px-2 py-1.5 text-[13.5px] text-body transition hover:bg-surface-2 hover:text-ink">
                                <Chevron className="h-3.5 w-3.5 flex-none text-brand-ink" aria-hidden="true" />
                                <span className="truncate">{p.title}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-auto pt-3">
                          <Link href={docsHref(lang, sec.firstSlug)} className="inline-flex items-center gap-1.5 px-2 text-[13.5px] font-medium text-link hover:text-link-hover">
                            {s.viewSection}
                            <Forward className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" aria-hidden="true" />
                          </Link>
                        </div>
                      </article>
                    </li>
                  )
                })}
              </ul>
            </section>

            {/* Base URL + help */}
            <section className="mx-auto mt-10 grid max-w-[1280px] gap-4 px-4 sm:px-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <div className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-chip text-chip-ink"><KeyIcon className="h-5 w-5" aria-hidden="true" /></span>
                  <div className="min-w-0">
                    <h2 className="text-[16px] font-semibold text-ink">{s.baseUrl}</h2>
                    <p className="mt-1 text-[14px] text-muted">{s.baseUrlLead}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 rounded-[14px] border border-line bg-surface-2 py-1.5 pe-1.5 ps-4" dir="ltr">
                  <code className="min-w-0 flex-1 truncate font-mono text-[14px] text-ink">{BASE_URL}</code>
                  <CopyInline text={BASE_URL} label={s.copy} done={s.copied} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <Button href={docsHref(lang, 'api/authentication')} size="sm" iconEnd={Forward}>{s.apiCta}</Button>
                  <Button href={docsHref(lang, 'api/send-message')} size="sm" variant="secondary">{s.apiRef}</Button>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
                <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 end-[-40px] h-48 w-48 rounded-full bg-brand-gradient opacity-[0.12] blur-3xl" />
                <div className="relative flex items-start gap-3">
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-chip text-chip-ink"><LifebuoyIcon className="h-5 w-5" aria-hidden="true" /></span>
                  <div className="min-w-0">
                    <h2 className="text-[16px] font-semibold text-ink">{s.helpTitle}</h2>
                    <p className="mt-1 text-[14px] text-muted">{s.helpLead}</p>
                  </div>
                </div>
                <div className="relative mt-5 flex flex-wrap gap-2.5">
                  <Button href={docsHref(lang, 'faq/troubleshooting')} size="sm" variant="secondary" icon={WrenchScrewdriverIcon}>{s.troubleshooting}</Button>
                  <Button href="/support" size="sm" variant="ghost">{s.contactSupport}</Button>
                </div>
              </div>
            </section>
          </main>
        )}
      </DocsShell>
    </>
  )
}
