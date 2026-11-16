import React from 'react'
import { CheckIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { Badge, Button, cn } from '@/components/ui'
import { fmtLimit } from '@/components/settings/format'

export interface Plan {
  id: string
  name: string
  description?: string | null
  price_monthly: number
  price_yearly?: number | null
  stripe_price_id_monthly?: string | null
  stripe_price_id_yearly?: string | null
  sort_order?: number
  max_messages_month?: number
  max_contacts?: number
  max_instances?: number
  max_team_members?: number
  max_sub_accounts?: number
  allow_api_access?: boolean
  allow_chatbot?: boolean
  allow_automation?: boolean
  allow_white_label?: boolean
  allow_sub_accounts?: boolean
  allow_reseller?: boolean
  features?: string[] | null
  reseller_id?: string
  reseller_plan_id?: string
  currency?: string
}

export function planFeatures(plan: Plan): string[] {
  return [
    `${fmtLimit(plan.max_messages_month)} رسالة شهريًا`,
    `${fmtLimit(plan.max_contacts)} جهة اتصال`,
    `${plan.max_instances ?? 1} ${(plan.max_instances ?? 1) > 1 ? 'أرقام' : 'رقم'} واتساب`,
    (plan.max_team_members ?? 0) > 1 ? `${plan.max_team_members} أعضاء في الفريق` : null,
    plan.allow_api_access ? 'الوصول إلى REST API' : null,
    plan.allow_chatbot ? 'منشئ روبوت المحادثة' : null,
    plan.allow_automation ? 'مسارات الأتمتة' : null,
    plan.allow_white_label ? 'العلامة البيضاء والنطاق المخصص' : null,
    plan.allow_sub_accounts && (plan.max_sub_accounts ?? 0) > 0 ? `${plan.max_sub_accounts} حسابات فرعية` : null,
    plan.allow_reseller ? 'نظام الموزّعين' : null,
    ...(plan.features || []),
  ].filter(Boolean) as string[]
}

/** Yearly saving vs 12 × monthly, in whole percent (0 when not cheaper). */
export function yearlySaving(plan: Plan): number {
  const m = Number(plan.price_monthly || 0)
  const y = Number(plan.price_yearly || 0)
  if (!(m > 0) || !(y > 0)) return 0
  const pct = Math.round((1 - y / (m * 12)) * 100)
  return pct > 0 ? pct : 0
}

export function PlanCard({ plan, cycle, isCurrent, isPopular, hasSub, onChoose, choosing }: {
  plan: Plan
  cycle: 'monthly' | 'yearly'
  isCurrent: boolean
  isPopular: boolean
  hasSub: boolean
  onChoose: (priceId: string) => void
  choosing?: boolean
}) {
  const yearly = cycle === 'yearly' && Number(plan.price_yearly) > 0
  const price = yearly ? Number(plan.price_yearly) : Number(plan.price_monthly)
  const priceId = cycle === 'yearly' && plan.stripe_price_id_yearly ? plan.stripe_price_id_yearly : plan.stripe_price_id_monthly
  const features = planFeatures(plan)
  const saving = yearly ? yearlySaving(plan) : 0
  const currency = (plan.currency || 'USD').toUpperCase()
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n)

  return (
    <article className={cn(
      'relative flex flex-col rounded-panel bg-surface p-6 transition duration-200 hover:-translate-y-0.5 hover:shadow-card-hover',
      isCurrent ? 'border-2 border-brand-teal shadow-ring' : isPopular ? 'border-2 border-brand-teal/60 shadow-hero' : 'border border-line shadow-card',
    )}>
      {(isCurrent || isPopular) && (
        <span className="absolute -top-3 start-6">
          {isCurrent
            ? <Badge tone="brand" className="shadow-card">باقتك الحالية</Badge>
            : <span className="inline-flex items-center gap-1 rounded-full bg-brand-gradient px-3 py-1 text-xs font-semibold text-[#04282C] shadow-glow"><SparklesIcon className="h-3.5 w-3.5" aria-hidden="true" />الأكثر طلبًا</span>}
        </span>
      )}
      <h3 className="text-lg font-bold text-ink">{plan.name}</h3>
      {plan.description && <p className="mt-1 text-sm text-muted">{plan.description}</p>}

      <div className="mt-5 flex items-end gap-1.5">
        {price === 0 ? (
          <span className="text-4xl font-bold text-ink">مجانية</span>
        ) : (
          <>
            <span className="text-4xl font-bold text-ink tabular" dir="ltr">{fmt(price)}</span>
            <span className="mb-1.5 text-sm text-muted">/ {yearly ? 'سنة' : 'شهر'}</span>
          </>
        )}
      </div>
      <p className="mt-1 h-5 text-xs text-success">{saving > 0 ? `توفّر ${saving}% مقارنة بالدفع الشهري` : ''}</p>

      <ul className="mt-5 flex-1 space-y-2.5">
        {features.slice(0, 9).map(f => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-body">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-chip text-chip-ink"><CheckIcon className="h-3 w-3" aria-hidden="true" /></span>
            {f}
          </li>
        ))}
      </ul>

      <div className="mt-6">
        {isCurrent ? (
          <Button variant="secondary" fullWidth disabled icon={CheckIcon}>باقتك الحالية</Button>
        ) : price === 0 ? (
          <Button variant="secondary" fullWidth disabled>الباقة المجانية</Button>
        ) : !priceId ? (
          <Button variant="secondary" fullWidth disabled>قريبًا</Button>
        ) : (
          <Button variant={isPopular ? 'primary' : 'dark'} fullWidth loading={choosing} onClick={() => onChoose(priceId)}>
            {hasSub ? 'التبديل إلى هذه الباقة' : 'ابدأ الآن'}
          </Button>
        )}
      </div>
    </article>
  )
}
