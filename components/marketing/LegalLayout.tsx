import React, { useEffect, useRef, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { CalendarDaysIcon, ChevronDownIcon, DocumentTextIcon, PrinterIcon, ScaleIcon } from '@heroicons/react/24/outline'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/public/marketing'
import { Button } from '@/components/ui'
import { cn } from '@/components/ui/utils'
import { MarketingPage } from './MarketingPage'

export const LEGAL_DOCS: { href: string; key: 'mk_legal_privacy' | 'mk_legal_terms' | 'mk_legal_refund' | 'mk_legal_license' | 'mk_legal_accessibility' }[] = [
  { href: '/legal/privacy', key: 'mk_legal_privacy' },
  { href: '/legal/terms', key: 'mk_legal_terms' },
  { href: '/legal/refund', key: 'mk_legal_refund' },
  { href: '/legal/license', key: 'mk_legal_license' },
  { href: '/legal/accessibility', key: 'mk_legal_accessibility' },
]

export interface LegalLayoutProps {
  lang: string
  dir: 'rtl' | 'ltr'
  onLangChange?: (code: string) => void
  /** Path of this document (highlights it in the document switcher). */
  active: string
  headTitle: string
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  /** e.g. "Last updated: January 1, 2025" */
  updated?: React.ReactNode
  /** Extra badges next to the date. */
  meta?: React.ReactNode
  /** Direction of the document text when it differs from the UI (English-only documents). */
  docDir?: 'rtl' | 'ltr'
  /** Labels for the section navigation, in heading order (the original "Table of contents" items). */
  toc?: string[]
  children: React.ReactNode
}

interface NavItem { id: string; text: string }

/**
 * LegalLayout — clean document layout for /legal/*: title block, document
 * switcher, sticky section navigation (built from the document's <h2>s),
 * print button and print-friendly styles.
 */
export function LegalLayout({ lang, dir, onLangChange, active, headTitle, eyebrow, title, description, updated, meta, docDir, toc, children }: LegalLayoutProps) {
  const { t } = useT(messages)
  const bodyRef = useRef<HTMLDivElement>(null)
  const [nav, setNav] = useState<NavItem[]>([])
  const [current, setCurrent] = useState('')

  // Build the section navigation from the rendered headings.
  useEffect(() => {
    const root = bodyRef.current
    if (!root) return
    const heads = Array.from(root.querySelectorAll<HTMLElement>('h2'))
    const items = heads.map((h, i) => {
      if (!h.id) h.id = `section-${i + 1}`
      return { id: h.id, text: (toc && toc[i]) || (h.textContent || '').trim() }
    })
    setNav(items)
    if (!items.length || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setCurrent((visible[0].target as HTMLElement).id)
      },
      { rootMargin: '-96px 0px -65% 0px', threshold: 0 },
    )
    heads.forEach(h => io.observe(h))
    return () => io.disconnect()
  }, [lang, children, toc])

  const navList = (onPick?: () => void) => (
    <ol className="flex flex-col gap-0.5">
      {nav.map(item => (
        <li key={item.id}>
          <a
            href={`#${item.id}`}
            onClick={onPick}
            aria-current={current === item.id ? 'true' : undefined}
            className={cn(
              'block rounded-lg border-s-2 px-3 py-1.5 text-[13px] leading-snug transition-colors',
              current === item.id ? 'border-brand-teal bg-chip/60 font-medium text-ink' : 'border-transparent text-muted hover:bg-surface-3 hover:text-ink',
            )}
          >
            {item.text}
          </a>
        </li>
      ))}
    </ol>
  )

  return (
    <>
      <Head>
        <link rel="icon" href="/brand/favicon-32.png" />
        <title>{headTitle}</title>
      </Head>
      <MarketingPage active={active} lang={lang} dir={dir} onLangChange={onLangChange}>
        {/* Title block */}
        <header className="border-b border-line bg-surface print:border-0 print:bg-transparent">
          <div className="mx-auto max-w-[1180px] px-4 pb-8 pt-10 sm:px-8 sm:pt-14">
            <nav aria-label={t('mk_legal_all')} className="mb-8 flex gap-2 overflow-x-auto pb-1 scrollbar-none print:hidden">
              <Link href="/legal" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line px-3.5 text-[13px] font-medium text-muted transition-colors hover:border-line-strong hover:text-ink">
                <ScaleIcon className="h-4 w-4" aria-hidden="true" />
                {t('pub_legal')}
              </Link>
              {LEGAL_DOCS.map(d => (
                <Link
                  key={d.href}
                  href={d.href}
                  aria-current={active === d.href ? 'page' : undefined}
                  className={cn(
                    'inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-[13px] font-medium transition-colors',
                    active === d.href ? 'bg-[#04282C] text-[#EAF7F5] dark:bg-[#EAF7F5] dark:text-[#04282C]' : 'border border-line text-muted hover:border-line-strong hover:text-ink',
                  )}
                >
                  {t(d.key)}
                </Link>
              ))}
            </nav>
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="flex min-w-0 max-w-3xl flex-col gap-3">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-ink">
                  <DocumentTextIcon className="h-[18px] w-[18px]" aria-hidden="true" />
                  {eyebrow || t('mk_legal_doc')}
                </span>
                <h1 className="text-[30px] font-bold leading-tight text-ink sm:text-[40px]">{title}</h1>
                {description && <p className="text-base leading-[1.85] text-body">{description}</p>}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {updated && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-3 px-3 py-1 text-xs font-medium text-muted">
                      <CalendarDaysIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      {updated}
                    </span>
                  )}
                  {meta}
                </div>
              </div>
              <Button variant="secondary" size="sm" icon={PrinterIcon} onClick={() => window.print()} className="print:hidden">
                {t('mk_print')}
              </Button>
            </div>
          </div>
        </header>

        <div className="mx-auto grid max-w-[1180px] gap-10 px-4 py-10 sm:px-8 lg:grid-cols-[250px_minmax(0,1fr)] lg:py-14">
          {/* Section navigation */}
          {nav.length > 1 && (
            <aside className="print:hidden">
              <details className="group rounded-card border border-line bg-surface lg:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-ink">
                  {toc ? t('toc_label') : t('mk_toc')}
                  <ChevronDownIcon className="h-4 w-4 text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="border-t border-line-soft p-2">{navList()}</div>
              </details>
              <nav aria-label={toc ? t('toc_label') : t('mk_toc')} className="sticky top-24 hidden max-h-[calc(100vh-7rem)] overflow-y-auto lg:block">
                <p className="mb-3 px-3 text-xs font-semibold text-muted">{toc ? t('toc_label') : t('mk_toc')}</p>
                {navList()}
              </nav>
            </aside>
          )}

          <article
            ref={bodyRef}
            dir={docDir}
            className={cn('legal-doc min-w-0 max-w-[780px]', nav.length <= 1 && 'lg:col-span-2 lg:mx-auto')}
          >
            {children}
          </article>
        </div>
      </MarketingPage>

      <style jsx global>{`
        .legal-doc { color: rgb(var(--body)); font-size: 15.5px; line-height: 1.95; }
        .legal-doc .sec, .legal-doc section { margin-bottom: 44px; }
        .legal-doc h2, .legal-doc .st {
          display: flex; align-items: center; gap: 12px;
          margin: 0 0 16px; padding-bottom: 12px; scroll-margin-top: 96px;
          border-bottom: 1px solid rgb(var(--line));
          font-size: 20px; font-weight: 700; line-height: 1.4; color: rgb(var(--ink));
        }
        .legal-doc h2::before, .legal-doc .st::before {
          content: ''; flex-shrink: 0; width: 4px; height: 20px; border-radius: 99px;
          background: linear-gradient(180deg, #12B5BE, #8BE07A);
        }
        .legal-doc h3, .legal-doc .sh { margin: 22px 0 8px; font-size: 15px; font-weight: 600; color: rgb(var(--ink)); }
        .legal-doc p { margin: 0 0 14px; }
        .legal-doc ul, .legal-doc ol { margin: 0 0 16px; padding-inline-start: 22px; list-style: disc; }
        .legal-doc ol { list-style: decimal; }
        .legal-doc li { margin-bottom: 6px; padding-inline-start: 2px; }
        .legal-doc li::marker { color: rgb(var(--brand-ink)); }
        .legal-doc strong { color: rgb(var(--ink)); font-weight: 600; }
        .legal-doc a { color: rgb(var(--link)); text-decoration: underline; text-underline-offset: 4px; }

        .legal-doc .icard, .legal-doc .wcard, .legal-doc .pcard {
          display: flex; gap: 14px; align-items: flex-start;
          margin: 18px 0; padding: 16px 18px; border-radius: 16px;
          background: rgb(var(--chip) / 0.55); border: 1px solid rgb(var(--brand-teal) / 0.25);
        }
        .legal-doc .wcard { background: rgb(var(--danger-bg)); border-color: rgb(var(--danger) / 0.25); }
        .legal-doc .pcard { background: rgb(var(--violet-bg)); border-color: rgb(var(--violet) / 0.25); }
        .legal-doc .icard p, .legal-doc .wcard p, .legal-doc .pcard p { margin: 0; font-size: 14px; line-height: 1.8; color: rgb(var(--ink)); }
        .legal-doc .icard-i, .legal-doc .wcard-i, .legal-doc .pcard-i, .legal-doc .owner-icon {
          display: flex; flex-shrink: 0; align-items: center; justify-content: center;
          width: 32px; height: 32px; border-radius: 10px; color: #04282C;
          background: linear-gradient(135deg, #12B5BE, #8BE07A);
        }
        .legal-doc .wcard-i { background: rgb(var(--danger-solid)); color: #fff; }
        .legal-doc .pcard-i { background: rgb(var(--violet)); color: rgb(var(--surface)); }

        .legal-doc .owner-box {
          margin: 0 0 40px; padding: 32px 24px; text-align: center; border-radius: 22px;
          background: radial-gradient(90% 120% at 100% 0%, #0E6C72, rgba(14,108,114,0) 65%), #04282C; color: #EAF7F5;
        }
        .legal-doc .owner-box .owner-icon { width: 52px; height: 52px; border-radius: 16px; margin: 0 auto 16px; }
        .legal-doc .owner-box p { color: #B5D3D0 !important; }
        .legal-doc .owner-box .owner-name { color: #EAF7F5 !important; }

        .legal-doc .ftable { margin: 20px 0; overflow-x: auto; border: 1px solid rgb(var(--line)); border-radius: 16px; background: rgb(var(--surface)); }
        .legal-doc .ftable table { width: 100%; min-width: 480px; border-collapse: collapse; font-size: 14px; }
        .legal-doc .ftable th { padding: 12px 16px; text-align: start; font-size: 12px; font-weight: 600; color: rgb(var(--muted)); background: rgb(var(--surface-2)); border-bottom: 1px solid rgb(var(--line)); }
        .legal-doc .ftable td { padding: 12px 16px; border-bottom: 1px solid rgb(var(--line-soft)); }
        .legal-doc .ftable tr:last-child td { border-bottom: 0; }
        .legal-doc .pr { display: inline-block; padding: 2px 10px; border-radius: 99px; font-size: 12px; font-weight: 600; }
        .legal-doc .pr-red { background: rgb(var(--danger-bg)); color: rgb(var(--danger)); }
        .legal-doc .pr-green { background: rgb(var(--success-bg)); color: rgb(var(--success)); }
        .legal-doc .pr-amber { background: rgb(var(--warning-bg)); color: rgb(var(--warning)); }

        .legal-doc .lfooter { margin-top: 48px; padding: 20px; text-align: center; border-radius: 16px; background: rgb(var(--surface-2)); border: 1px solid rgb(var(--line)); }
        .legal-doc .lfooter p { margin: 0 0 4px; }

        @media print {
          body { background: #fff !important; }
          .legal-doc { max-width: none; color: #000; font-size: 11.5pt; }
          .legal-doc h2, .legal-doc .st { color: #000; break-after: avoid; }
          .legal-doc .sec, .legal-doc section { break-inside: avoid-page; }
          .legal-doc .owner-box { background: none; color: #000; border: 1px solid #999; }
          .legal-doc .owner-box p, .legal-doc .owner-box .owner-name { color: #000 !important; }
          .legal-doc a { color: #000; }
        }
      `}</style>
    </>
  )
}

export default LegalLayout
