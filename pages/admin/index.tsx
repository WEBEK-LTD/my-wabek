import React from 'react'
import Link from 'next/link'
import AdminLayout from '@/components/layout/AdminLayout'
import {
  ArrowLeftIcon, ChartBarIcon, ChatBubbleLeftRightIcon, ClipboardDocumentListIcon, CpuChipIcon,
  CreditCardIcon, DevicePhoneMobileIcon, MegaphoneIcon, UserGroupIcon, UsersIcon,
} from '@heroicons/react/24/outline'
import {
  AreaChart, Badge, Button, Card, CardHeader, Donut, EmptyState, PageHeader, ProgressBar, Skeleton, StatCard,
  Table, TBody, TD, TH, THead, TR, CHART_COLORS,
} from '@/components/ui'
import { useAdminT, useEnumLabel, usd } from '@/components/admin/i18n'
import { ErrorState } from '@/components/admin/shared'
import { pct, useAdminStats } from '@/components/admin/useAdminStats'
import messages from '@/locales/admin/dashboard'

export default function AdminDashboard() {
  const { t, fmtDateTime, fmtWeekday, fmtNumber, tn } = useAdminT(messages)
  const label = useEnumLabel()
  const { data, isLoading, isError, refetch } = useAdminStats()
  const s = data?.stats
  const signups = data?.daily_signups || []
  const planDist = data?.plan_distribution || []
  const logs = (data?.recent_logs || []).slice(0, 8)
  const signupsWeek = signups.reduce((a, d) => a + (d.count || 0), 0)

  return (
    <AdminLayout title={t('adminDashboard')}>
      <PageHeader className="mb-6"
        eyebrow={t('overview')}
        title={t('adminDashboard')}
        description={t('platformHealthGlanceUsers')}
        actions={<>
          <Button variant="secondary" icon={ChartBarIcon} href="/admin/analytics">{t('analytics')}</Button>
          <Button variant="dark" icon={UsersIcon} href="/admin/users">{t('manageUsers')}</Button>
        </>}
      />

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <div className="space-y-5">
          {/* Revenue hero */}
          <Card variant="deep" padding="lg" className="relative overflow-hidden">
            <div aria-hidden="true" className="pointer-events-none absolute -end-16 -top-24 h-64 w-64 rounded-full bg-brand-gradient opacity-25 blur-3xl" />
            <div className="relative flex flex-wrap items-end justify-between gap-6">
              <div className="space-y-2">
                <p className="text-sm text-deep-muted">{t('monthlyRecurringRevenueMrr')}</p>
                {isLoading ? <Skeleton className="h-12 w-44 opacity-30" /> : (
                  <p className="tabular text-[44px] font-bold leading-none tracking-tight text-white" dir="ltr">{usd(s?.mrr || 0, 0)}</p>
                )}
                <p className="text-sm text-deep-muted">
                  {t('computedMonthlyPriceActive')}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  { k: t('activeSubscriptions'), v: s?.active_subscriptions },
                  { k: t('newUsersMonth'), v: s?.new_users_this_month },
                  { k: t('signUpsLast7'), v: signupsWeek },
                ].map(x => (
                  <div key={x.k} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                    <dt className="text-xs text-deep-muted">{x.k}</dt>
                    <dd className="tabular mt-1 text-2xl font-semibold text-white">{isLoading ? '—' : fmtNumber(x.v ?? 0)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Card>

          {/* KPIs */}
          <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]">
            <StatCard loading={isLoading} icon={UserGroupIcon} label={t('totalUsers')}
              value={fmtNumber(s?.total_users ?? 0)}
              sub={t('newMonth', { v: fmtNumber(s?.new_users_this_month ?? 0) })}
              sparkline={signups.length > 1 ? signups.map(d => d.count) : undefined} href="/admin/users" />
            <StatCard loading={isLoading} icon={CreditCardIcon} label={t('activeSubscriptions')}
              value={fmtNumber(s?.active_subscriptions ?? 0)}
              sub={t('mrr', { v: usd(s?.mrr || 0, 0) })} subTone="brand" href="/admin/plans" />
            <StatCard loading={isLoading} icon={ChatBubbleLeftRightIcon} label={t('messagesMonth')}
              value={fmtNumber(s?.messages_this_month ?? 0)}
              sub={t('allTime', { v: fmtNumber(s?.total_messages ?? 0) })} />
            <StatCard loading={isLoading} icon={DevicePhoneMobileIcon} label={t('connectedWhatsappNumbers')}
              value={<span dir="ltr">{fmtNumber(s?.connected_instances ?? 0)}<span className="text-lg text-muted"> / {fmtNumber(s?.total_instances ?? 0)}</span></span>}
              progress={s?.connected_instances ?? 0} progressMax={Math.max(1, s?.total_instances ?? 0)}
              sub={t('connectedAlt', { v: pct(s?.connected_instances ?? 0, s?.total_instances ?? 0) })} />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card padding="none" className="lg:col-span-2">
              <CardHeader className="px-5 pt-5 sm:px-6" title={t('newSignUps')} subtitle={t('last7Days')}
                action={<Badge tone="brand">{tn('userCount', signupsWeek, { n: fmtNumber(signupsWeek) })}</Badge>} />
              <div className="px-3 pb-4 sm:px-4">
                {isLoading ? <Skeleton className="m-2 h-[220px]" /> : (
                  <AreaChart height={220} labels={signups.map(d => fmtWeekday(d.date))}
                    series={[{ name: t('signUps'), data: signups.map(d => d.count) }]}
                    ariaLabel={t('dailySignUpsOver')} />
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title={t('planDistribution')} subtitle={t('usersPerActivePlan')} />
              <div className="mt-4">
                {isLoading ? <Skeleton circle className="mx-auto h-32 w-32" /> : planDist.length === 0 || planDist.every(p => !p.count) ? (
                  <EmptyState size="sm" icon={CreditCardIcon} title={t('noUsersPlansYet')}
                    action={<Button size="sm" variant="secondary" href="/admin/plans">{t('managePlans')}</Button>} />
                ) : (
                  <Donut legend="bottom" size={140} ariaLabel={t('planDistribution')}
                    centerLabel={fmtNumber(planDist.reduce((a, p) => a + p.count, 0))} centerSub={t('users')}
                    segments={planDist.map((p, i) => ({ label: p.plan, value: p.count, color: CHART_COLORS[i % CHART_COLORS.length] }))}
                    formatValue={(seg) => fmtNumber(seg.value)} />
                )}
              </div>
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="space-y-4">
              <CardHeader title={t('platformActivity')} />
              {[
                { label: t('activeUsers'), a: s?.active_users ?? 0, b: s?.total_users ?? 0 },
                { label: t('connectedNumbers'), a: s?.connected_instances ?? 0, b: s?.total_instances ?? 0 },
              ].map(r => (
                <ProgressBar key={r.label} label={r.label} value={r.a} max={Math.max(1, r.b)} size="md"
                  valueText={isLoading ? '—' : `${fmtNumber(r.a)} / ${fmtNumber(r.b)}`} />
              ))}
              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  { icon: UserGroupIcon, label: t('contactsAlt'), v: s?.total_contacts },
                  { icon: MegaphoneIcon, label: t('campaignsAlt'), v: s?.total_campaigns },
                  { icon: CpuChipIcon, label: t('chatbots'), v: s?.total_chatbots },
                ].map(x => (
                  <div key={x.label} className="rounded-xl bg-surface-2 p-3 text-center">
                    <x.icon className="mx-auto h-4 w-4 text-brand-ink" aria-hidden="true" />
                    <p className="tabular mt-1.5 text-lg font-semibold text-ink">{isLoading ? '—' : fmtNumber(x.v ?? 0)}</p>
                    <p className="text-2xs text-muted">{x.label}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card padding="none" className="lg:col-span-2">
              <CardHeader className="px-5 pt-5 sm:px-6" icon={ClipboardDocumentListIcon} title={t('recentActivity')}
                action={<Link href="/admin/logs" className="inline-flex items-center gap-1 text-sm font-medium text-link hover:text-link-hover">
                  {t('allLogs')}<ArrowLeftIcon className="h-4 w-4 ltr:rotate-180" aria-hidden="true" />
                </Link>} />
              <div className="mt-3">
                {isLoading ? (
                  <div className="space-y-2 px-5 pb-5">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-9" />)}</div>
                ) : logs.length === 0 ? (
                  <EmptyState size="sm" icon={ClipboardDocumentListIcon} title={t('noActivityRecordedYet')} />
                ) : (
                  <Table minWidth={520} caption={t('recentActivity')} dense>
                    <THead><TR>
                      <TH>{t('action')}</TH><TH>{t('user')}</TH><TH>{t('resource')}</TH><TH align="end">{t('time')}</TH>
                    </TR></THead>
                    <TBody>
                      {logs.map(log => (
                        <TR key={log.id}>
                          <TD><span className="text-xs font-medium text-ink" title={log.action}>{label('action', log.action)}</span></TD>
                          <TD><span dir="ltr" className="font-mono text-xs text-muted">{log.user_id ? `${log.user_id.slice(0, 8)}…` : t('system')}</span></TD>
                          <TD className="text-xs text-muted">{label('resource', log.resource)}</TD>
                          <TD align="end" className="tabular whitespace-nowrap text-xs text-muted">{fmtDateTime(log.created_at)}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
