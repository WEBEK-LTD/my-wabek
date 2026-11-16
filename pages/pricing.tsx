import React, { useState } from 'react'
import Head from 'next/head'
import { CheckIcon, CreditCardIcon, LockClosedIcon, MinusIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import { Button, Table, THead, TBody, TR, TH, TD } from '@/components/ui'
import { cn } from '@/components/ui/utils'
import { MarketingPage, PageHero, Section } from '@/components/marketing/MarketingPage'
import { CtaBand, FaqList } from '@/components/marketing/Blocks'
import { Cycle, PlanCards, PlanComparison, fallbackPlans, hasYearly, maxYearlySaving, usePublicPlans } from '@/components/marketing/plans'
import planMessages from '@/locales/public/plans'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/public/pricing'

const LOGO = '/brand/favicon-32.png'

type Key = keyof typeof messages.en
type Cell = boolean | string

const FAQS = [1, 2, 3, 4, 5, 6] as const

// Original "Compare all features" table (four tiers, in plan order).
const COMPARE_ROWS: { key: Key; values: Cell[] }[] = [
  { key: 'cmp1', values: ['500', '50,000', 'unlimited', 'unlimited'] },
  { key: 'cmp2', values: ['1', '5', '30', 'unlimited'] },
  { key: 'cmp3', values: [true, true, true, true] },
  { key: 'cmp4', values: [false, true, true, true] },
  { key: 'cmp5', values: [true, true, true, true] },
  { key: 'cmp6', values: [false, true, true, true] },
  { key: 'cmp7', values: [false, false, true, true] },
  { key: 'cmp8', values: [true, true, true, true] },
  { key: 'cmp9', values: [false, true, true, true] },
  { key: 'cmp10', values: [false, false, false, true] },
]

const TRUST: { n: string; k: Key }[] = [
  { n: '10,000+', k: 'trust1' },
  { n: '500M+', k: 'trust2' },
  { n: '99.9%', k: 'trust3' },
  { n: '4.9★', k: 'trust4' },
]

export default function PricingPage() {
  const { brandName } = useWhiteLabel()
  const name = brandName || 'WABEK'
  const { t, lang, dir, fmtNumber } = useT(messages)
  const [cycle, setCycle] = useState<Cycle>('monthly')
  const plans = usePublicPlans()
  const { t: tp } = useT(planMessages)
  // The original comparison table describes the four standard tiers.
  const tiers = fallbackPlans(tp)
  const T = (key: Key) => t(key, { name })
  const yearly = hasYearly(plans.plans)
  const saving = maxYearlySaving(plans.plans)

  const toggle = yearly && (
    <div role="radiogroup" aria-label={T('billing')} className="mt-2 inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.06] p-1">
      {(['monthly', 'yearly'] as Cycle[]).map(c => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={cycle === c}
          onClick={() => setCycle(c)}
          className={cn(
            'inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors',
            cycle === c ? 'bg-[#EAF7F5] text-[#04282C]' : 'text-deep-muted hover:text-white',
          )}
        >
          {c === 'monthly' ? T('monthly') : T('annual')}
          {c === 'yearly' && saving > 0 && (
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', cycle === c ? 'bg-brand-gradient text-[#04282C]' : 'bg-brand-green/20 text-brand-green')}>
              {saving === 20 ? T('save_20') : t('save', { n: fmtNumber(saving) })}
            </span>
          )}
        </button>
      ))}
    </div>
  )

  return (
    <>
      <Head>
        <link rel="icon" href={LOGO} />
        <title>{`${T('title')} | ${name}`}</title>
        <meta name="description" content={T('subtitle')} />
      </Head>
      <MarketingPage
        active="/pricing"
        lang={lang}
        dir={dir}
        hero={<PageHero eyebrow={T('pricing')} title={T('title')} subtitle={T('subtitle')} className="pb-28 sm:pb-32">{toggle}</PageHero>}
      >
        <section aria-label={T('pricing')} className="relative mx-auto -mt-20 max-w-[1280px] px-4 sm:px-8">
          <PlanCards {...plans} onRetry={plans.reload} cycle={cycle} notes labels={{ cta: T('get_started'), ctaFree: T('get_started') }} />
          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted">
            <li className="inline-flex items-center gap-2"><ShieldCheckIcon className="h-5 w-5 text-brand-ink" aria-hidden="true" />{T('trial')}</li>
            <li className="inline-flex items-center gap-2"><CreditCardIcon className="h-5 w-5 text-brand-ink" aria-hidden="true" />{T('no_card')}</li>
            <li className="inline-flex items-center gap-2"><LockClosedIcon className="h-5 w-5 text-brand-ink" aria-hidden="true" />{T('stripe')}</li>
          </ul>
        </section>

        {/* Trust badges */}
        <Section title={T('trust_title')} className="pb-4">
          <dl className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {TRUST.map(b => (
              <div key={b.k} className="flex flex-col items-center gap-1.5 rounded-card border border-line bg-surface px-4 py-6 text-center shadow-card">
                <dt className="order-2 text-sm text-muted">{T(b.k)}</dt>
                <dd className="tabular order-1 text-[30px] font-bold text-ink sm:text-[34px]" dir="ltr">{b.n}</dd>
              </div>
            ))}
          </dl>
        </Section>

        {/* Compare all features (original table) */}
        <Section title={T('compare')}>
          <div className="relative overflow-hidden rounded-card border border-line bg-surface shadow-card">
            <Table minWidth={640} caption={T('compare_plans')}>
              <THead>
                <TR>
                  <TH className="w-[34%]"><span className="sr-only">{T('compare_plans')}</span></TH>
                  {tiers.map(p => (
                    <TH key={p.id} align="center">
                      <span className={cn('block text-sm font-semibold', p.is_popular ? 'text-link' : 'text-ink')}>{p.name}</span>
                      {p.is_popular && <span className="mt-1 inline-flex rounded-full bg-chip px-2 py-0.5 text-[10px] font-semibold text-chip-ink">{t('popular_badge')}</span>}
                    </TH>
                  ))}
                </TR>
              </THead>
              <TBody>
                {COMPARE_ROWS.map(row => (
                  <TR key={row.key}>
                    <TD className="font-medium text-ink">{T(row.key)}</TD>
                    {row.values.map((v, vi) => (
                      <TD key={vi} align="center">
                        {typeof v === 'boolean'
                          ? v
                            ? <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-chip text-chip-ink"><CheckIcon className="h-4 w-4" strokeWidth={2.6} aria-hidden="true" /><span className="sr-only">{T('included')}</span></span>
                            : <span className="inline-flex h-7 w-7 items-center justify-center text-line-strong"><MinusIcon className="h-4 w-4" aria-hidden="true" /><span className="sr-only">{T('not_included')}</span></span>
                          : <span className="tabular font-medium text-ink" dir="auto">{v === 'unlimited' ? T('unlimited') : fmtNumber(Number(v.replace(/,/g, '')))}</span>}
                      </TD>
                    ))}
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </Section>

        {/* Limits from the live plan data (redesign) */}
        {!plans.loading && !plans.isFallback && plans.plans.length > 0 && (
          <Section title={T('compare_live')} subtitle={T('compare_sub')} className="pt-0">
            <PlanComparison plans={plans.plans} caption={T('compare_live')} />
          </Section>
        )}

        <Section title={T('faq_title')} subtitle={T('faq_sub')} narrow>
          <FaqList items={FAQS.map(n => ({ q: T(`faq${n}_q`), a: T(`faq${n}_a`) }))} />
        </Section>

        <CtaBand
          title={T('cta_title')}
          subtitle={T('cta_sub')}
          note={`${T('no_card')} · ${T('trial')}`}
          actions={
            <>
              <Button href="/auth/register" size="xl" className="rounded-2xl px-8 text-lg font-bold">{T('get_started')}</Button>
              <Button href="/support#contact" variant="on-deep-ghost" size="xl" className="rounded-2xl px-7">{T('contact')}</Button>
            </>
          }
        />
      </MarketingPage>
    </>
  )
}
