import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import axios from 'axios'
import { CheckIcon, CreditCardIcon, ExclamationTriangleIcon, MinusIcon } from '@heroicons/react/24/outline'
import { Button, EmptyState, Skeleton, Table, THead, TBody, TR, TH, TD } from '@/components/ui'
import { cn } from '@/components/ui/utils'

/**
 * A row of the public `plans` table as returned by GET /api/plans.
 * Limit and feature columns are optional: they are rendered when the API
 * includes them (see pages/api/plans.ts).
 */
export interface PublicPlan {
  id: string
  name: string
  description?: string | null
  price_monthly: number | string | null
  price_yearly?: number | string | null
  features?: string[] | null
  is_popular?: boolean
  sort_order?: number
  [column: string]: unknown
}

export type Cycle = 'monthly' | 'yearly'

/** Loads the real plans from /api/plans. No fallback prices are ever shown. */
export function usePublicPlans() {
  const [plans, setPlans] = useState<PublicPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(false)
    axios.get('/api/plans')
      .then(r => setPlans(Array.isArray(r.data?.plans) ? r.data.plans : []))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])
  return { plans, loading, error, reload: load }
}

export const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
  return Number.isFinite(n) ? n : 0
}

export const hasYearly = (plans: PublicPlan[]) => plans.some(p => num(p.price_yearly) > 0)

export const formatPrice = (n: number) => {
  const rounded = Math.round(n * 100) / 100
  return '$' + (Number.isInteger(rounded) ? rounded.toLocaleString('en-US') : rounded.toFixed(2))
}

/** Largest yearly saving across plans, in whole percent (0 if none). */
export function maxYearlySaving(plans: PublicPlan[]): number {
  let best = 0
  for (const p of plans) {
    const m = num(p.price_monthly), y = num(p.price_yearly)
    if (m > 0 && y > 0 && y < m * 12) best = Math.max(best, Math.round((1 - y / (m * 12)) * 100))
  }
  return best
}

/** Which plan to emphasise: the one flagged popular, else none. */
const isFeatured = (p: PublicPlan) => !!p.is_popular

export interface PlanCardsProps {
  plans: PublicPlan[]
  loading: boolean
  error: boolean
  onRetry: () => void
  cycle?: Cycle
  t: (k: string) => string
  /** Show up to N features per card (default: all). */
  maxFeatures?: number
  /** Strings that differ between pages. */
  labels?: { cta?: string; ctaFree?: string; billedYearly?: (total: string) => string }
  className?: string
}

/** PlanCards — real plans as cards, with loading, empty and error states. */
export function PlanCards({ plans, loading, error, onRetry, cycle = 'monthly', t, maxFeatures, labels, className }: PlanCardsProps) {
  if (loading) {
    return (
      <div className={cn('grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]', className)} aria-busy="true">
        {[0, 1, 2].map(i => (
          <div key={i} className="flex flex-col gap-4 rounded-[26px] border border-line bg-surface p-8">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-10 w-32" />
            <Skeleton lines={3} />
            <Skeleton className="h-12 w-full" />
          </div>
        ))}
      </div>
    )
  }
  if (error) {
    return (
      <EmptyState
        variant="card"
        icon={ExclamationTriangleIcon}
        title={t('mk_plans_error')}
        action={<Button variant="secondary" onClick={onRetry}>{t('mk_retry')}</Button>}
        className={className}
      />
    )
  }
  if (!plans.length) {
    return (
      <EmptyState
        variant="card"
        icon={CreditCardIcon}
        title={t('mk_plans_empty')}
        action={<Button href="/auth/register">{t('pub_start_free')}</Button>}
        className={className}
      />
    )
  }

  return (
    <div className={cn('grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]', className)}>
      {plans.map(p => {
        const featured = isFeatured(p)
        const monthly = num(p.price_monthly)
        const yearly = num(p.price_yearly)
        const useYearly = cycle === 'yearly' && yearly > 0
        const free = monthly === 0 && (!useYearly || yearly === 0)
        const price = useYearly ? yearly : monthly
        const features = Array.isArray(p.features) ? p.features : []
        const shown = maxFeatures ? features.slice(0, maxFeatures) : features
        return (
          <article
            key={p.id}
            className={cn(
              'relative flex min-w-0 flex-col gap-5 rounded-[26px] p-7 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 sm:p-8',
              featured
                ? 'bg-[#04282C] text-deep-ink shadow-[0_30px_80px_rgba(4,40,44,0.3)] ring-1 ring-white/10'
                : 'border border-line bg-surface text-ink shadow-card hover:shadow-card-hover',
            )}
          >
            {featured && (
              <span className="absolute -top-3 start-7 rounded-full bg-brand-gradient px-3 py-1 text-xs font-semibold text-[#04282C] shadow-glow">
                {t('mk_most_popular')}
              </span>
            )}
            <h3 className={cn('text-xl font-semibold', featured ? 'text-deep-ink' : 'text-ink')}>{p.name}</h3>
            <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
              <span className="tabular text-[42px] font-bold leading-none" dir="ltr">{free ? t('mk_free') : formatPrice(price)}</span>
              {!free && <span className={cn('text-sm', featured ? 'text-deep-muted' : 'text-muted')}>{useYearly ? t('mk_per_year') : t('mk_per_month')}</span>}
            </div>
            {useYearly && !free && (
              <p className={cn('-mt-3 text-[13px]', featured ? 'text-deep-muted' : 'text-muted')}>
                <span dir="ltr">≈ {formatPrice(yearly / 12)}</span> {t('mk_per_month')}
              </p>
            )}
            {p.description && <p dir="auto" className={cn('text-[15px] leading-[1.8]', featured ? 'text-deep-muted' : 'text-body')}>{p.description}</p>}
            {shown.length > 0 && (
              <ul className={cn('flex flex-1 flex-col gap-2.5 border-t pt-5', featured ? 'border-white/10' : 'border-line-soft')}>
                {shown.map((f, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed">
                    <CheckIcon aria-hidden="true" className={cn('mt-0.5 h-4 w-4 shrink-0', featured ? 'text-brand-green' : 'text-brand-ink')} strokeWidth={2.6} />
                    <span dir="auto">{f}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-auto pt-1">
              <Button
                href="/auth/register"
                variant={featured ? 'primary' : 'secondary'}
                size="lg"
                fullWidth
                className="rounded-[14px]"
              >
                {free ? labels?.ctaFree || t('pub_start_free') : labels?.cta || t('plan_start_trial')}
              </Button>
            </div>
          </article>
        )
      })}
    </div>
  )
}

const LIMIT_COLUMNS = [
  'max_messages_month', 'max_contacts', 'max_instances', 'max_campaigns', 'max_team_members',
  'max_chatbot_flows', 'max_quick_replies', 'max_segments', 'max_links', 'max_sub_accounts', 'max_ai_replies',
]
const FEATURE_COLUMNS: [string, string][] = [
  ['allow_ai', 'mk_feature_allow_ai'],
  ['allow_chatbot', 'feature_allow_chatbot'],
  ['allow_automation', 'feature_allow_automation'],
  ['allow_analytics', 'feature_allow_analytics'],
  ['allow_api_access', 'feature_allow_api_access'],
  ['allow_white_label', 'feature_allow_white_label'],
  ['allow_sub_accounts', 'feature_allow_sub_accounts'],
  ['allow_reseller', 'feature_allow_reseller'],
]

type CompareRow = { label: string; cells: (boolean | string)[] }

/**
 * Builds the comparison rows from the plan columns themselves:
 * max_* limits (-1 = unlimited), allow_* flags, then the plans' feature lists.
 * Only columns present in the API response produce rows.
 */
export function buildComparison(plans: PublicPlan[], t: (k: string) => string): { limits: CompareRow[]; features: CompareRow[] } {
  const present = (col: string) => plans.some(p => p[col] !== undefined && p[col] !== null)
  const limits: CompareRow[] = LIMIT_COLUMNS.filter(present).map(col => ({
    label: t(`mk_limit_${col}`),
    cells: plans.map(p => {
      const v = p[col]
      if (v === undefined || v === null) return '—'
      const n = num(v)
      if (n < 0) return t('mk_limit_unlimited')
      if (n === 0) return '—'
      return n.toLocaleString('en-US')
    }),
  }))

  const features: CompareRow[] = FEATURE_COLUMNS.filter(([col]) => present(col)).map(([col, key]) => ({
    label: t(key),
    cells: plans.map(p => p[col] === true),
  }))

  // Feature lists written by the admin for each plan (union, in first-seen order).
  const seen = new Set<string>()
  const listed: string[] = []
  for (const p of plans) for (const f of Array.isArray(p.features) ? p.features : []) {
    const k = String(f).trim()
    if (k && !seen.has(k.toLowerCase())) { seen.add(k.toLowerCase()); listed.push(k) }
  }
  for (const f of listed) {
    features.push({ label: f, cells: plans.map(p => (Array.isArray(p.features) ? p.features : []).some(x => String(x).trim().toLowerCase() === f.toLowerCase())) })
  }
  return { limits, features }
}

/** PlanComparison — feature matrix built from the real plan data. */
export function PlanComparison({ plans, t, caption }: { plans: PublicPlan[]; t: (k: string) => string; caption: string }) {
  const { limits, features } = buildComparison(plans, t)
  if (!plans.length || (!limits.length && !features.length)) return null

  const cell = (v: boolean | string) =>
    typeof v === 'boolean'
      ? v
        ? <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-chip text-chip-ink"><CheckIcon className="h-4 w-4" strokeWidth={2.6} aria-hidden="true" /><span className="sr-only">{t('mk_included')}</span></span>
        : <span className="inline-flex h-7 w-7 items-center justify-center text-line-strong"><MinusIcon className="h-4 w-4" aria-hidden="true" /><span className="sr-only">{t('mk_not_included')}</span></span>
      : <span className="tabular font-medium text-ink" dir="ltr">{v}</span>

  const group = (title: string, rows: CompareRow[]) => rows.length > 0 && (
    <>
      <TR>
        <TD colSpan={plans.length + 1} className="bg-surface-2 py-2.5 text-xs font-semibold text-muted">{title}</TD>
      </TR>
      {rows.map((r, i) => (
        <TR key={title + i}>
          <TD className="font-medium text-ink"><span dir="auto">{r.label}</span></TD>
          {r.cells.map((c, ci) => <TD key={ci} align="center">{cell(c)}</TD>)}
        </TR>
      ))}
    </>
  )

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <Table minWidth={Math.max(560, 200 + plans.length * 140)} caption={caption}>
        <THead>
          <TR>
            <TH className="w-[34%]"><span className="sr-only">{t('price_feature')}</span></TH>
            {plans.map(p => (
              <TH key={p.id} align="center">
                <span className={cn('text-sm font-semibold', p.is_popular ? 'text-link' : 'text-ink')}>{p.name}</span>
              </TH>
            ))}
          </TR>
        </THead>
        <TBody>
          {group(t('mk_compare_limits'), limits)}
          {group(t('mk_compare_features'), features)}
        </TBody>
      </Table>
    </div>
  )
}

/** Small link used under pricing teasers. */
export function PricingLink({ children }: { children: React.ReactNode }) {
  return <Link href="/pricing" className="font-semibold text-link hover:text-link-hover">{children}</Link>
}
