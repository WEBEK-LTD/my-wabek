import React from 'react'
import PublicNav from '@/components/PublicNav'
import PublicFooter from '@/components/PublicFooter'
import { cn } from '@/components/ui/utils'

export interface MarketingPageProps {
  /** Path highlighted in the nav (e.g. "/pricing"). */
  active?: string
  lang: string
  dir: 'rtl' | 'ltr'
  onLangChange?: (code: string) => void
  /**
   * Content of the deep-teal hero. When set, the nav sits transparently on top
   * of it (PublicNav variant="deep"); otherwise a light nav is used.
   */
  hero?: React.ReactNode
  /** Large decorative rings behind the hero (landing page). */
  rings?: boolean
  children?: React.ReactNode
  className?: string
}

/**
 * MarketingPage — frame for every public page: nav, optional deep hero, main, footer.
 *
 *   <MarketingPage active="/pricing" lang={lang} dir={dir} onLangChange={setLang}
 *     hero={<PageHero eyebrow="…" title="…" subtitle="…" />}>
 *     <Section …>…</Section>
 *   </MarketingPage>
 */
export function MarketingPage({ active, lang, dir, onLangChange, hero, rings, children, className }: MarketingPageProps) {
  return (
    <div dir={dir} lang={lang} className={cn('flex min-h-screen flex-col bg-canvas text-ink', className)}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-btn focus:bg-surface focus:px-4 focus:py-2 focus:text-ink focus:shadow-dropdown"
      >
        {dir === 'rtl' ? 'انتقل إلى المحتوى' : 'Skip to content'}
      </a>
      {hero ? (
        <div className="relative overflow-x-clip bg-deep-landing text-deep-ink print:hidden">
          {rings && (
            <>
              <div aria-hidden="true" className="pointer-events-none absolute start-1/2 top-[380px] h-[980px] w-[980px] -translate-x-1/2 rounded-full border border-white/[0.06] rtl:translate-x-1/2" />
              <div aria-hidden="true" className="pointer-events-none absolute start-1/2 top-[520px] h-[700px] w-[700px] -translate-x-1/2 rounded-full border border-white/[0.07] rtl:translate-x-1/2" />
            </>
          )}
          <PublicNav variant="deep" active={active} lang={lang} onLangChange={onLangChange || null} />
          {hero}
        </div>
      ) : (
        <div className="print:hidden">
          <PublicNav active={active} lang={lang} onLangChange={onLangChange || null} />
        </div>
      )}
      <main id="main" className="flex-1">
        {children}
      </main>
      <div className="print:hidden">
        <PublicFooter lang={lang} onLangChange={onLangChange || null} />
      </div>
    </div>
  )
}

export interface PageHeroProps {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  /** Extra content under the copy (toggles, search, meta). */
  children?: React.ReactNode
  align?: 'center' | 'start'
  className?: string
}

/** PageHero — the copy block inside the deep hero of an inner page. */
export function PageHero({ eyebrow, title, subtitle, actions, children, align = 'center', className }: PageHeroProps) {
  const center = align === 'center'
  return (
    <section className={cn('relative mx-auto max-w-[1280px] px-4 pb-16 pt-10 sm:px-8 sm:pb-20 sm:pt-14', className)}>
      <div className={cn('flex flex-col gap-5', center ? 'mx-auto max-w-3xl items-center text-center' : 'max-w-3xl items-start')}>
        {eyebrow && (
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-[13px] font-medium text-deep-muted">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-green" />
            {eyebrow}
          </span>
        )}
        <h1 className="whitespace-pre-line text-[34px] font-bold leading-[1.2] tracking-[-0.5px] text-deep-ink sm:text-5xl sm:leading-[1.15]">
          {title}
        </h1>
        {subtitle && <p className="max-w-2xl text-base font-light leading-[1.9] text-deep-muted sm:text-lg">{subtitle}</p>}
        {actions && <div className={cn('flex flex-wrap gap-3 pt-1', center && 'justify-center')}>{actions}</div>}
        {children}
      </div>
    </section>
  )
}

export interface SectionProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  eyebrow?: React.ReactNode
  title?: React.ReactNode
  subtitle?: React.ReactNode
  /** Right/left-aligned header action (e.g. "View all"). */
  action?: React.ReactNode
  align?: 'center' | 'start'
  /** Narrower reading width. */
  narrow?: boolean
  titleAs?: 'h2' | 'h3'
}

/** Section — page section with an optional centred header. */
export function Section({ eyebrow, title, subtitle, action, align = 'center', narrow, titleAs: H = 'h2', className, children, ...rest }: SectionProps) {
  const center = align === 'center'
  return (
    <section className={cn('mx-auto w-full px-4 py-16 sm:px-8 sm:py-20', narrow ? 'max-w-4xl' : 'max-w-[1280px]', className)} {...rest}>
      {(title || eyebrow) && (
        <div className={cn('mb-10 flex flex-col gap-3 sm:mb-12', center ? 'items-center text-center' : 'items-start sm:flex-row sm:items-end sm:justify-between')}>
          <div className={cn('flex flex-col gap-3', center && 'items-center')}>
            {eyebrow && <span className="text-sm font-semibold text-brand-ink">{eyebrow}</span>}
            {title && <H className="max-w-3xl whitespace-pre-line text-[28px] font-bold leading-[1.3] text-ink sm:text-[40px]">{title}</H>}
            {subtitle && <p className="max-w-2xl text-base font-light leading-[1.9] text-body sm:text-lg">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

export default MarketingPage
