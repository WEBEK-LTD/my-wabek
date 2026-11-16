import React from 'react'
import Link from 'next/link'
import AdminLayout from '@/components/layout/AdminLayout'
import {
  ArrowLeftIcon, ChartBarIcon, ChatBubbleLeftRightIcon, ClipboardDocumentListIcon, CpuChipIcon,
  CreditCardIcon, DevicePhoneMobileIcon, MegaphoneIcon, UserGroupIcon, UsersIcon,
} from '@heroicons/react/24/outline'
import {
  AreaChart, Badge, Button, Card, CardHeader, Donut, EmptyState, PageHeader, ProgressBar, Skeleton, StatCard,
  Table, TBody, TD, TH, THead, TR, CHART_COLORS, formatNumber,
} from '@/components/ui'
import { useAdminT, usd } from '@/components/admin/i18n'
import { ErrorState } from '@/components/admin/shared'
import { pct, useAdminStats } from '@/components/admin/useAdminStats'

export default function AdminDashboard() {
  const { tr, fmtDateTime, fmtWeekday } = useAdminT()
  const { data, isLoading, isError, refetch } = useAdminStats()
  const s = data?.stats
  const signups = data?.daily_signups || []
  const planDist = data?.plan_distribution || []
  const logs = (data?.recent_logs || []).slice(0, 8)
  const signupsWeek = signups.reduce((a, d) => a + (d.count || 0), 0)

  return (
    <AdminLayout title={tr('لوحة الإدارة', 'Admin dashboard')}>
      <PageHeader className="mb-6"
        eyebrow={tr('نظرة عامة', 'Overview')}
        title={tr('لوحة الإدارة', 'Admin dashboard')}
        description={tr('صحة المنصة في لمحة: المستخدمون والاشتراكات والرسائل وأرقام واتساب.', 'Platform health at a glance: users, subscriptions, messages and WhatsApp numbers.')}
        actions={<>
          <Button variant="secondary" icon={ChartBarIcon} href="/admin/analytics">{tr('التحليلات', 'Analytics')}</Button>
          <Button variant="dark" icon={UsersIcon} href="/admin/users">{tr('إدارة المستخدمين', 'Manage users')}</Button>
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
                <p className="text-sm text-deep-muted">{tr('الإيراد الشهري المتكرر (MRR)', 'Monthly recurring revenue (MRR)')}</p>
                {isLoading ? <Skeleton className="h-12 w-44 opacity-30" /> : (
                  <p className="tabular text-[44px] font-bold leading-none tracking-tight text-white" dir="ltr">{usd(s?.mrr || 0, 0)}</p>
                )}
                <p className="text-sm text-deep-muted">
                  {tr('محسوب من أسعار الباقات الشهرية للاشتراكات النشطة.', 'Computed from the monthly price of active subscriptions.')}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  { k: tr('اشتراكات نشطة', 'Active subscriptions'), v: s?.active_subscriptions },
                  { k: tr('مستخدمون جدد هذا الشهر', 'New users this month'), v: s?.new_users_this_month },
                  { k: tr('تسجيلات آخر 7 أيام', 'Sign-ups, last 7 days'), v: signupsWeek },
                ].map(x => (
                  <div key={x.k} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                    <dt className="text-xs text-deep-muted">{x.k}</dt>
                    <dd className="tabular mt-1 text-2xl font-semibold text-white">{isLoading ? '—' : formatNumber(x.v ?? 0)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Card>

          {/* KPIs */}
          <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]">
            <StatCard loading={isLoading} icon={UserGroupIcon} label={tr('إجمالي المستخدمين', 'Total users')}
              value={formatNumber(s?.total_users ?? 0)}
              sub={tr(`${formatNumber(s?.new_users_this_month ?? 0)} جديد هذا الشهر`, `${formatNumber(s?.new_users_this_month ?? 0)} new this month`)}
              sparkline={signups.length > 1 ? signups.map(d => d.count) : undefined} href="/admin/users" />
            <StatCard loading={isLoading} icon={CreditCardIcon} label={tr('اشتراكات نشطة', 'Active subscriptions')}
              value={formatNumber(s?.active_subscriptions ?? 0)}
              sub={tr(`MRR ${usd(s?.mrr || 0, 0)}`, `MRR ${usd(s?.mrr || 0, 0)}`)} subTone="brand" href="/admin/plans" />
            <StatCard loading={isLoading} icon={ChatBubbleLeftRightIcon} label={tr('رسائل هذا الشهر', 'Messages this month')}
              value={formatNumber(s?.messages_this_month ?? 0)}
              sub={tr(`${formatNumber(s?.total_messages ?? 0)} منذ البداية`, `${formatNumber(s?.total_messages ?? 0)} all time`)} />
            <StatCard loading={isLoading} icon={DevicePhoneMobileIcon} label={tr('أرقام واتساب متصلة', 'Connected WhatsApp numbers')}
              value={<span dir="ltr">{formatNumber(s?.connected_instances ?? 0)}<span className="text-lg text-muted"> / {formatNumber(s?.total_instances ?? 0)}</span></span>}
              progress={s?.connected_instances ?? 0} progressMax={Math.max(1, s?.total_instances ?? 0)}
              sub={tr(`${pct(s?.connected_instances ?? 0, s?.total_instances ?? 0)}% نسبة الاتصال`, `${pct(s?.connected_instances ?? 0, s?.total_instances ?? 0)}% connected`)} />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card padding="none" className="lg:col-span-2">
              <CardHeader className="px-5 pt-5 sm:px-6" title={tr('التسجيلات الجديدة', 'New sign-ups')} subtitle={tr('آخر 7 أيام', 'Last 7 days')}
                action={<Badge tone="brand">{tr(`${formatNumber(signupsWeek)} مستخدم`, `${formatNumber(signupsWeek)} users`)}</Badge>} />
              <div className="px-3 pb-4 sm:px-4">
                {isLoading ? <Skeleton className="m-2 h-[220px]" /> : (
                  <AreaChart height={220} labels={signups.map(d => fmtWeekday(d.date))}
                    series={[{ name: tr('تسجيلات', 'Sign-ups'), data: signups.map(d => d.count) }]}
                    ariaLabel={tr('التسجيلات اليومية خلال آخر 7 أيام', 'Daily sign-ups over the last 7 days')} />
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title={tr('توزيع الباقات', 'Plan distribution')} subtitle={tr('المستخدمون حسب الباقة النشطة', 'Users per active plan')} />
              <div className="mt-4">
                {isLoading ? <Skeleton circle className="mx-auto h-32 w-32" /> : planDist.length === 0 || planDist.every(p => !p.count) ? (
                  <EmptyState size="sm" icon={CreditCardIcon} title={tr('لا توجد اشتراكات في الباقات بعد', 'No users on plans yet')}
                    action={<Button size="sm" variant="secondary" href="/admin/plans">{tr('إدارة الباقات', 'Manage plans')}</Button>} />
                ) : (
                  <Donut legend="bottom" size={140}
                    centerLabel={formatNumber(planDist.reduce((a, p) => a + p.count, 0))} centerSub={tr('مستخدم', 'users')}
                    segments={planDist.map((p, i) => ({ label: p.plan, value: p.count, color: CHART_COLORS[i % CHART_COLORS.length] }))}
                    formatValue={(seg) => formatNumber(seg.value)} />
                )}
              </div>
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="space-y-4">
              <CardHeader title={tr('نشاط المنصة', 'Platform activity')} />
              {[
                { label: tr('المستخدمون النشطون', 'Active users'), a: s?.active_users ?? 0, b: s?.total_users ?? 0 },
                { label: tr('الأرقام المتصلة', 'Connected numbers'), a: s?.connected_instances ?? 0, b: s?.total_instances ?? 0 },
              ].map(r => (
                <ProgressBar key={r.label} label={r.label} value={r.a} max={Math.max(1, r.b)} size="md"
                  valueText={isLoading ? '—' : `${formatNumber(r.a)} / ${formatNumber(r.b)}`} />
              ))}
              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  { icon: UserGroupIcon, label: tr('جهات اتصال', 'Contacts'), v: s?.total_contacts },
                  { icon: MegaphoneIcon, label: tr('حملات', 'Campaigns'), v: s?.total_campaigns },
                  { icon: CpuChipIcon, label: tr('روبوتات', 'Chatbots'), v: s?.total_chatbots },
                ].map(x => (
                  <div key={x.label} className="rounded-xl bg-surface-2 p-3 text-center">
                    <x.icon className="mx-auto h-4 w-4 text-brand-ink" aria-hidden="true" />
                    <p className="tabular mt-1.5 text-lg font-semibold text-ink">{isLoading ? '—' : formatNumber(x.v ?? 0)}</p>
                    <p className="text-2xs text-muted">{x.label}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card padding="none" className="lg:col-span-2">
              <CardHeader className="px-5 pt-5 sm:px-6" icon={ClipboardDocumentListIcon} title={tr('آخر النشاطات', 'Recent activity')}
                action={<Link href="/admin/logs" className="inline-flex items-center gap-1 text-sm font-medium text-link hover:text-link-hover">
                  {tr('جميع السجلات', 'All logs')}<ArrowLeftIcon className="h-4 w-4 ltr:rotate-180" aria-hidden="true" />
                </Link>} />
              <div className="mt-3">
                {isLoading ? (
                  <div className="space-y-2 px-5 pb-5">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-9" />)}</div>
                ) : logs.length === 0 ? (
                  <EmptyState size="sm" icon={ClipboardDocumentListIcon} title={tr('لا يوجد نشاط مسجّل بعد', 'No activity recorded yet')} />
                ) : (
                  <Table minWidth={520} caption={tr('آخر النشاطات', 'Recent activity')} dense>
                    <THead><TR>
                      <TH>{tr('الإجراء', 'Action')}</TH><TH>{tr('المستخدم', 'User')}</TH><TH>{tr('المورد', 'Resource')}</TH><TH align="end">{tr('الوقت', 'Time')}</TH>
                    </TR></THead>
                    <TBody>
                      {logs.map(log => (
                        <TR key={log.id}>
                          <TD><code dir="ltr" className="rounded-md bg-surface-3 px-1.5 py-0.5 font-mono text-xs text-ink">{log.action}</code></TD>
                          <TD><span dir="ltr" className="font-mono text-xs text-muted">{log.user_id ? `${log.user_id.slice(0, 8)}…` : tr('النظام', 'System')}</span></TD>
                          <TD className="text-xs text-muted">{log.resource || '—'}</TD>
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
