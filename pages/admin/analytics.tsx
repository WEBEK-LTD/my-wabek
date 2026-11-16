import React from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import {
  ChatBubbleLeftRightIcon, CpuChipIcon, CreditCardIcon, DevicePhoneMobileIcon, MegaphoneIcon, UserGroupIcon, UserPlusIcon,
} from '@heroicons/react/24/outline'
import {
  AreaChart, Badge, Card, CardHeader, Donut, EmptyState, PageHeader, ProgressBar, Skeleton, StatCard, CHART_COLORS, formatNumber,
} from '@/components/ui'
import { useAdminT, usd } from '@/components/admin/i18n'
import { ErrorState } from '@/components/admin/shared'
import { pct, useAdminStats } from '@/components/admin/useAdminStats'

export default function AdminAnalyticsPage() {
  const { tr, fmtWeekday } = useAdminT()
  const { data, isLoading, isError, refetch } = useAdminStats()
  const s = data?.stats
  const signups = data?.daily_signups || []
  const planDist = data?.plan_distribution || []
  const planTotal = planDist.reduce((a, p) => a + p.count, 0)
  const week = signups.reduce((a, d) => a + d.count, 0)
  const peak = signups.reduce((m, d) => (d.count > (m?.count ?? -1) ? d : m), undefined as undefined | { date: string; count: number })
  const arpu = s && s.active_subscriptions > 0 ? s.mrr / s.active_subscriptions : null
  const monthShare = s ? pct(s.messages_this_month, s.total_messages) : 0

  return (
    <AdminLayout title={tr('التحليلات', 'Analytics')}>
      <PageHeader
        eyebrow={tr('نظرة عامة', 'Overview')}
        title={tr('تحليلات المنصة', 'Platform analytics')}
        description={tr('أرقام فعلية من قاعدة البيانات: النمو والإيراد والاستخدام.', 'Live figures from the database: growth, revenue and usage.')}
      />

      {isError ? <ErrorState onRetry={() => refetch()} /> : (
        <div className="space-y-5">
          <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]">
            <StatCard loading={isLoading} icon={UserGroupIcon} label={tr('إجمالي المستخدمين', 'Total users')} value={formatNumber(s?.total_users ?? 0)}
              sub={tr(`${formatNumber(s?.new_users_this_month ?? 0)} جديد هذا الشهر`, `${formatNumber(s?.new_users_this_month ?? 0)} new this month`)}
              sparkline={signups.length > 1 ? signups.map(d => d.count) : undefined} />
            <StatCard loading={isLoading} icon={CreditCardIcon} label="MRR" value={<span dir="ltr">{usd(s?.mrr || 0, 0)}</span>}
              sub={tr(`${formatNumber(s?.active_subscriptions ?? 0)} اشتراك مدفوع نشط`, `${formatNumber(s?.active_subscriptions ?? 0)} active paid subscriptions`)} subTone="brand" />
            <StatCard loading={isLoading} icon={ChatBubbleLeftRightIcon} label={tr('رسائل هذا الشهر', 'Messages this month')} value={formatNumber(s?.messages_this_month ?? 0)}
              sub={tr(`${formatNumber(s?.total_messages ?? 0)} إجمالًا`, `${formatNumber(s?.total_messages ?? 0)} total`)} />
            <StatCard loading={isLoading} icon={DevicePhoneMobileIcon} label={tr('أرقام واتساب', 'WhatsApp numbers')}
              value={<span dir="ltr">{formatNumber(s?.connected_instances ?? 0)}<span className="text-lg text-muted"> / {formatNumber(s?.total_instances ?? 0)}</span></span>}
              progress={s?.connected_instances ?? 0} progressMax={Math.max(1, s?.total_instances ?? 0)} sub={tr('متصلة / الإجمالي', 'connected / total')} />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card padding="none" className="lg:col-span-2">
              <CardHeader className="px-5 pt-5 sm:px-6" icon={UserPlusIcon} title={tr('التسجيلات الجديدة', 'New sign-ups')} subtitle={tr('آخر 7 أيام', 'Last 7 days')} />
              <div className="grid grid-cols-3 gap-2 px-5 pt-4 sm:px-6">
                {[
                  { k: tr('هذا الأسبوع', 'This week'), v: formatNumber(week) },
                  { k: tr('المتوسط اليومي', 'Daily average'), v: signups.length ? (week / signups.length).toFixed(1) : '—' },
                  { k: tr('أعلى يوم', 'Best day'), v: peak && peak.count > 0 ? `${fmtWeekday(peak.date)} · ${peak.count}` : '—' },
                ].map(x => (
                  <div key={x.k} className="rounded-xl bg-surface-2 px-3 py-2.5">
                    <p className="text-2xs text-muted">{x.k}</p>
                    <p className="tabular mt-0.5 text-base font-semibold text-ink">{isLoading ? '—' : x.v}</p>
                  </div>
                ))}
              </div>
              <div className="px-3 pb-4 pt-2 sm:px-4">
                {isLoading ? <Skeleton className="m-2 h-[240px]" /> : (
                  <AreaChart height={240} labels={signups.map(d => fmtWeekday(d.date))}
                    series={[{ name: tr('تسجيلات', 'Sign-ups'), data: signups.map(d => d.count) }]}
                    ariaLabel={tr('التسجيلات اليومية', 'Daily sign-ups')} />
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title={tr('توزيع الباقات', 'Plan distribution')} subtitle={tr('عدد المستخدمين في كل باقة نشطة', 'Users on each active plan')} />
              <div className="mt-4 space-y-4">
                {isLoading ? <Skeleton circle className="mx-auto h-32 w-32" /> : planTotal === 0 ? (
                  <EmptyState size="sm" icon={CreditCardIcon} title={tr('لا يوجد مستخدمون على الباقات', 'No users on plans')} />
                ) : (
                  <>
                    <Donut size={132} centerLabel={formatNumber(planTotal)} centerSub={tr('مستخدم', 'users')}
                      segments={planDist.map((p, i) => ({ label: p.plan, value: p.count, color: CHART_COLORS[i % CHART_COLORS.length] }))} className="mx-auto" />
                    <ul className="space-y-2.5">
                      {planDist.map((p, i) => (
                        <li key={p.plan} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2 text-body">
                              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} aria-hidden="true" />{p.plan}
                            </span>
                            <span className="tabular font-medium text-ink">{formatNumber(p.count)} <span className="text-xs text-muted">· {pct(p.count, planTotal)}%</span></span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-track">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct(p.count, planTotal)}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="space-y-4">
              <CardHeader title={tr('الإيراد والاستخدام', 'Revenue & usage')} />
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-surface-2 p-3.5">
                  <p className="text-xs text-muted">{tr('متوسط الإيراد لكل اشتراك', 'Revenue per subscription')}</p>
                  <p className="tabular mt-1 text-xl font-semibold text-ink" dir="ltr">{isLoading ? '—' : arpu == null ? '—' : usd(arpu)}</p>
                </div>
                <div className="rounded-xl bg-surface-2 p-3.5">
                  <p className="text-xs text-muted">{tr('نسبة الاشتراك المدفوع', 'Paid conversion')}</p>
                  <p className="tabular mt-1 text-xl font-semibold text-ink">{isLoading ? '—' : `${pct(s?.active_subscriptions ?? 0, s?.total_users ?? 0)}%`}</p>
                </div>
              </div>
              <ProgressBar size="md" label={tr('رسائل هذا الشهر من الإجمالي', 'This month’s share of all messages')} value={monthShare} showValue />
              <ProgressBar size="md" label={tr('المستخدمون النشطون', 'Active users')} value={s?.active_users ?? 0} max={Math.max(1, s?.total_users ?? 0)}
                valueText={isLoading ? '—' : `${formatNumber(s?.active_users ?? 0)} · ${pct(s?.active_users ?? 0, s?.total_users ?? 0)}%`} tone="success" />
            </Card>

            <Card className="space-y-4">
              <CardHeader title={tr('إجماليات المنصة', 'Platform totals')} action={<Badge tone="neutral">{tr('منذ الإطلاق', 'All time')}</Badge>} />
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: UserGroupIcon, k: tr('جهات الاتصال', 'Contacts'), v: s?.total_contacts },
                  { icon: MegaphoneIcon, k: tr('الحملات', 'Campaigns'), v: s?.total_campaigns },
                  { icon: CpuChipIcon, k: tr('تدفقات الروبوت', 'Chatbot flows'), v: s?.total_chatbots },
                  { icon: ChatBubbleLeftRightIcon, k: tr('الرسائل', 'Messages'), v: s?.total_messages },
                ].map(x => (
                  <div key={x.k} className="flex items-center gap-3 rounded-xl border border-line-soft p-3.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-chip text-brand-ink"><x.icon className="h-4 w-4" aria-hidden="true" /></span>
                    <div>
                      <p className="text-xs text-muted">{x.k}</p>
                      <p className="tabular text-lg font-semibold text-ink">{isLoading ? '—' : formatNumber(x.v ?? 0)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
