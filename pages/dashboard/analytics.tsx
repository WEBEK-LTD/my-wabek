import { useMemo, useState } from 'react'
import { useQuery } from 'react-query'
import axios from 'axios'
import {
  ArrowDownTrayIcon, ChatBubbleLeftRightIcon, CheckCircleIcon, ClockIcon, CpuChipIcon, DevicePhoneMobileIcon,
  EyeIcon, LinkIcon, MegaphoneIcon, PaperAirplaneIcon, SparklesIcon, UserGroupIcon, ChartBarIcon,
} from '@heroicons/react/24/outline'
import DashboardLayout from '@/components/layout/DashboardLayout'
import {
  AreaChart, Badge, Button, Card, CardHeader, Donut, Dropdown, EmptyState, PageHeader, ProgressBar, Skeleton,
  StatCard, StatusPill, Table, TBody, TD, TH, THead, TR, Tabs, CHART_COLORS,
} from '@/components/ui'
import { BarList } from '@/components/analytics/BarList'
import { LoadError } from '@/components/analytics/LoadError'
import { downloadCSV, formatDay, pct, todayStamp } from '@/components/analytics/format'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/dashboard/analytics'

type Key = keyof typeof messages.en

interface DayPoint { date: string; sent: number; delivered: number; received: number }
interface CampaignRow { name: string; status: string; sent_count: number; delivered_count: number; read_count: number; failed_count: number; created_at: string }
interface StatsResponse {
  stats: {
    total_messages: number; sent_this_month: number; sent_last_month: number; mom_growth: number
    total_contacts: number; new_contacts_this_month: number; active_campaigns: number; active_chatbots: number
    link_clicks_total: number; open_conversations: number; ai_replies_this_month: number; inbound_this_month: number
    delivery_rate: number; read_rate: number
  }
  status_breakdown: { sent: number; delivered: number; read: number; failed: number }
  daily_chart: DayPoint[]
  recent_campaigns: CampaignRow[]
  chatbot_stats: Array<{ name: string; trigger_count: number; is_active: boolean }>
  top_links: Array<{ short_code: string; original_url: string; click_count: number }>
  instances: Array<{ id: string; display_name: string | null; phone_number: string | null; status: string; type: string }>
}

const RANGES: Array<{ id: string; key: Key }> = [
  { id: '7', key: 'r7' },
  { id: '14', key: 'r14' },
  { id: '30', key: 'r30' },
]

const CAMPAIGN_STATUS: Record<string, Key> = {
  draft: 'cs_draft', scheduled: 'cs_scheduled', running: 'cs_running', sending: 'cs_running', completed: 'cs_completed',
  paused: 'cs_paused', failed: 'cs_failed', cancelled: 'cs_cancelled',
}
const INSTANCE_STATUS: Record<string, Key> = {
  connected: 'is_connected', qr_pending: 'is_qr_pending', disconnected: 'is_disconnected', connecting: 'is_connecting',
}

export default function AnalyticsPage() {
  const { t, fmtNumber, locale } = useT(messages)
  const formatNumber = (n: number | null | undefined) => fmtNumber(n === null || n === undefined ? n : Number(n))
  const rangeTabs = RANGES.map(r => ({ id: r.id, label: t(r.key) }))
  const [range, setRange] = useState('30')

  const { data, isLoading, isError, refetch } = useQuery<StatsResponse>(
    'analytics-stats',
    () => axios.get('/api/dashboard/stats').then(r => r.data),
    { staleTime: 60000 },
  )

  const stats = data?.stats
  const sb = data?.status_breakdown || { sent: 0, delivered: 0, read: 0, failed: 0 }
  const campaigns = data?.recent_campaigns || []
  const chatbots = data?.chatbot_stats || []
  const topLinks = data?.top_links || []
  const instances = data?.instances || []

  // The API returns the last 30 days; the range control slices it.
  const chart = useMemo(() => (data?.daily_chart || []).slice(-Number(range)), [data, range])
  const rangeTotals = useMemo(() => chart.reduce(
    (t, d) => ({ sent: t.sent + (d.sent || 0), delivered: t.delivered + (d.delivered || 0), received: t.received + (d.received || 0) }),
    { sent: 0, delivered: 0, received: 0 },
  ), [chart])
  const sentSpark = chart.map(d => d.sent || 0)
  const receivedSpark = chart.map(d => d.received || 0)
  const statusTotal = sb.sent + sb.delivered + sb.read + sb.failed

  const exportDaily = () => downloadCSV(`wabek-analytics-${todayStamp()}.csv`, [
    ['Date', 'Sent', 'Delivered', 'Received'],
    ...chart.map(d => [d.date, d.sent || 0, d.delivered || 0, d.received || 0]),
  ])
  const exportCampaigns = () => downloadCSV(`wabek-campaigns-${todayStamp()}.csv`, [
    ['Campaign', 'Status', 'Sent', 'Delivered', 'Read', 'Failed', 'Delivery Rate'],
    ...campaigns.map(c => [c.name, c.status, c.sent_count || 0, c.delivered_count || 0, c.read_count || 0, c.failed_count || 0, `${pct(c.delivered_count || 0, c.sent_count || 0)}%`]),
  ])

  return (
    <DashboardLayout title={t('page_title')}>
      <div className="flex flex-col gap-6">
        <PageHeader
          eyebrow={t('eyebrow')}
          title={t('title')}
          description={t('description')}
          actions={(
            <>
              <Tabs variant="segmented" size="sm" value={range} onChange={setRange} tabs={rangeTabs} aria-label={t('range_aria')} />
              <Dropdown
                label={t('export')}
                align="end"
                triggerClassName="h-9 border border-line-strong bg-surface px-3.5 text-[13px] font-medium text-ink hover:bg-surface-2"
                trigger={<><ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" />{t('export')}</>}
                items={[
                  { label: t('export_daily'), icon: ChartBarIcon, onClick: exportDaily, disabled: !chart.length },
                  { label: t('export_campaigns'), icon: MegaphoneIcon, onClick: exportCampaigns, disabled: !campaigns.length },
                ]}
              />
            </>
          )}
        />

        {isError ? (
          <Card><LoadError onRetry={() => refetch()} /></Card>
        ) : (
          <>
            {/* KPI row */}
            <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]">
              <StatCard loading={isLoading} label={t('k_sent')} icon={PaperAirplaneIcon}
                value={formatNumber(stats?.sent_this_month)}
                trend={stats && stats.sent_last_month > 0 ? stats.mom_growth : undefined}
                trendLabel={t('k_vs_last')}
                sub={stats && stats.sent_last_month === 0 ? t('k_no_last') : undefined}
                sparkline={sentSpark.length > 1 ? sentSpark : undefined} />
              <StatCard loading={isLoading} label={t('k_delivery')} icon={CheckCircleIcon}
                value={`${stats?.delivery_rate ?? 0}%`}
                sub={t('k_delivered_n', { n: formatNumber(sb.delivered + sb.read) })}
                progress={stats?.delivery_rate ?? 0} progressMax={100} />
              <StatCard loading={isLoading} label={t('k_read')} icon={EyeIcon}
                value={`${stats?.read_rate ?? 0}%`}
                sub={t('k_read_n', { n: formatNumber(sb.read) })}
                progress={stats?.read_rate ?? 0} progressMax={100} />
              <StatCard loading={isLoading} label={t('k_inbound')} icon={ChatBubbleLeftRightIcon}
                value={formatNumber(stats?.inbound_this_month)}
                sparkline={receivedSpark.length > 1 ? receivedSpark : undefined} sparklineColor="#8BE07A" />
            </div>

            <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
              <StatCard loading={isLoading} label={t('k_contacts')} icon={UserGroupIcon} href="/dashboard/contacts"
                value={formatNumber(stats?.total_contacts)} sub={t('k_new_month', { n: formatNumber(stats?.new_contacts_this_month || 0) })} subTone="success" />
              <StatCard loading={isLoading} label={t('k_open')} icon={ClockIcon} href="/dashboard/chat"
                value={formatNumber(stats?.open_conversations)} sub={t('k_awaiting')} subTone={stats?.open_conversations ? 'warning' : 'muted'} />
              <StatCard loading={isLoading} label={t('k_clicks')} icon={LinkIcon} href="/dashboard/links"
                value={formatNumber(stats?.link_clicks_total)} sub={t('k_since_start')} />
              <StatCard loading={isLoading} label={t('k_bots')} icon={CpuChipIcon} href="/dashboard/chatbot"
                value={formatNumber(stats?.active_chatbots)} sub={t('k_campaigns_running', { n: formatNumber(stats?.active_campaigns || 0) })} />
              <StatCard loading={isLoading} label={t('k_ai')} icon={SparklesIcon} href="/dashboard/ai"
                value={formatNumber(stats?.ai_replies_this_month)} sub={t('k_this_month')} />
            </div>

            {/* Messages over time + status donut */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <Card padding="lg" className="lg:col-span-2">
                <CardHeader className="!p-0"
                  title={t('chart_title')}
                  subtitle={t('chart_sub', { range: rangeTabs.find(r => r.id === range)?.label })}
                  action={!isLoading && (
                    <dl className="hidden items-center gap-5 text-xs sm:flex">
                      <div><dt className="text-muted">{t('sent')}</dt><dd className="tabular text-base font-semibold text-ink">{formatNumber(rangeTotals.sent)}</dd></div>
                      <div><dt className="text-muted">{t('delivered')}</dt><dd className="tabular text-base font-semibold text-ink">{formatNumber(rangeTotals.delivered)}</dd></div>
                      <div><dt className="text-muted">{t('received')}</dt><dd className="tabular text-base font-semibold text-ink">{formatNumber(rangeTotals.received)}</dd></div>
                    </dl>
                  )}
                />
                <div className="mt-4">
                  {isLoading ? <Skeleton className="h-[240px] w-full rounded-xl" /> : chart.length === 0 || rangeTotals.sent + rangeTotals.received === 0 ? (
                    <EmptyState size="sm" icon={ChartBarIcon} title={t('chart_empty_title')} description={t('chart_empty_desc')} action={<Button size="sm" href="/dashboard/campaigns">{t('create_campaign')}</Button>} />
                  ) : (
                    <AreaChart
                      height={240}
                      labels={chart.map(d => formatDay(d.date, locale))}
                      series={[
                        { name: t('sent'), data: chart.map(d => d.sent || 0), color: CHART_COLORS[0] },
                        { name: t('delivered'), data: chart.map(d => d.delivered || 0), color: CHART_COLORS[1], fill: false },
                        { name: t('received'), data: chart.map(d => d.received || 0), color: CHART_COLORS[3], fill: false },
                      ]}
                      ariaLabel={t('chart_aria')}
                    />
                  )}
                </div>
              </Card>

              <Card padding="lg">
                <CardHeader className="!p-0" title={t('status_title')} subtitle={t('status_sub')} />
                <div className="mt-5 flex justify-center">
                  {isLoading ? <Skeleton circle className="h-36 w-36" /> : statusTotal === 0 ? (
                    <EmptyState size="sm" icon={PaperAirplaneIcon} title={t('status_empty')} />
                  ) : (
                    <Donut
                      size={150}
                      legend="bottom"
                      centerLabel={`${stats?.delivery_rate ?? 0}%`}
                      centerSub={t('delivery_short')}
                      segments={[
                        { label: t('sent'), value: sb.sent, color: CHART_COLORS[4] },
                        { label: t('delivered'), value: sb.delivered, color: CHART_COLORS[1] },
                        { label: t('read'), value: sb.read, color: CHART_COLORS[0] },
                        { label: t('failed'), value: sb.failed, color: CHART_COLORS[5] },
                      ]}
                      formatValue={(s, p) => `${formatNumber(s.value)} · ${Math.round(p)}%`}
                    />
                  )}
                </div>
              </Card>
            </div>

            {/* Campaign performance */}
            <Card padding="none">
              <div className="px-5 pt-5 sm:px-6">
                <CardHeader className="!p-0" title={t('perf_title')} subtitle={t('perf_sub')} icon={MegaphoneIcon}
                  action={<Button variant="ghost" size="sm" href="/dashboard/campaigns">{t('all_campaigns')}</Button>} />
              </div>
              <div className="mt-4">
                {isLoading ? (
                  <div className="flex flex-col gap-3 px-6 pb-6">{[0, 1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : campaigns.length === 0 ? (
                  <EmptyState size="sm" icon={MegaphoneIcon} title={t('no_campaigns')} description={t('no_campaigns_desc')} action={<Button size="sm" href="/dashboard/campaigns">{t('new_campaign')}</Button>} />
                ) : (
                  <Table minWidth={640} caption={t('perf_title')}>
                    <THead><TR><TH>{t('th_campaign')}</TH><TH>{t('th_status')}</TH><TH align="end">{t('th_sent')}</TH><TH>{t('th_delivery')}</TH><TH>{t('th_read')}</TH><TH align="end">{t('th_failed')}</TH></TR></THead>
                    <TBody>
                      {campaigns.map((c, i) => {
                        const delivered = pct(c.delivered_count || 0, c.sent_count || 0)
                        const read = pct(c.read_count || 0, c.sent_count || 0)
                        return (
                          <TR key={`${c.name}-${i}`}>
                            <TD className="max-w-[220px] truncate font-medium">{c.name}</TD>
                            <TD><StatusPill status={c.status}>{CAMPAIGN_STATUS[c.status] ? t(CAMPAIGN_STATUS[c.status]) : c.status}</StatusPill></TD>
                            <TD align="end" className="tabular">{formatNumber(c.sent_count || 0)}</TD>
                            <TD><ProgressBar value={delivered} showValue className="w-32" aria-label={t('delivery_aria', { p: delivered })} /></TD>
                            <TD><ProgressBar value={read} showValue tone="brand" className="w-32" aria-label={t('read_aria', { p: read })} /></TD>
                            <TD align="end" className={c.failed_count ? 'tabular text-danger' : 'tabular text-muted'}>{formatNumber(c.failed_count || 0)}</TD>
                          </TR>
                        )
                      })}
                    </TBody>
                  </Table>
                )}
              </div>
            </Card>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <Card padding="lg">
                <CardHeader className="!p-0" title={t('bots_title')} subtitle={t('bots_sub')} icon={CpuChipIcon} />
                <div className="mt-5">
                  {isLoading ? <Skeleton lines={4} /> : chatbots.length === 0 ? (
                    <EmptyState size="sm" title={t('no_bots')} action={<Button size="sm" variant="secondary" href="/dashboard/chatbot">{t('create_bot')}</Button>} />
                  ) : (
                    <BarList unit={t('runs_unit')} color={CHART_COLORS[3]}
                      items={chatbots.map(f => ({ key: f.name, label: f.name, value: f.trigger_count || 0, dot: f.is_active ? 'on' : 'off' }))} />
                  )}
                </div>
              </Card>

              <Card padding="lg">
                <CardHeader className="!p-0" title={t('links_title')} subtitle={t('links_sub')} icon={LinkIcon}
                  action={<Button variant="ghost" size="xs" href="/dashboard/links">{t('all')}</Button>} />
                <div className="mt-5">
                  {isLoading ? <Skeleton lines={4} /> : topLinks.length === 0 ? (
                    <EmptyState size="sm" title={t('no_links')} action={<Button size="sm" variant="secondary" href="/dashboard/links">{t('create_link')}</Button>} />
                  ) : (
                    <BarList ranked unit={t('clicks_unit')} color={CHART_COLORS[2]}
                      items={topLinks.map(l => ({ key: l.short_code, label: <span dir="ltr" className="font-mono">/{l.short_code}</span>, sub: <span dir="ltr">{l.original_url?.replace(/^https?:\/\//, '').slice(0, 32)}</span>, value: l.click_count || 0 }))} />
                  )}
                </div>
              </Card>

              <Card padding="lg">
                <CardHeader className="!p-0" title={t('numbers_title')} icon={DevicePhoneMobileIcon}
                  action={<Button variant="ghost" size="xs" href="/dashboard/instances">{t('manage')}</Button>} />
                <div className="mt-4">
                  {isLoading ? <Skeleton lines={3} /> : instances.length === 0 ? (
                    <EmptyState size="sm" title={t('no_numbers')} action={<Button size="sm" href="/dashboard/instances">{t('connect_number')}</Button>} />
                  ) : (
                    <ul className="flex flex-col divide-y divide-line-soft">
                      {instances.map(inst => (
                        <li key={inst.id} className="flex items-center gap-3 py-3">
                          <span className={inst.status === 'connected' ? 'h-2.5 w-2.5 shrink-0 rounded-full bg-success' : inst.status === 'qr_pending' ? 'h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-warning' : 'h-2.5 w-2.5 shrink-0 rounded-full bg-line-strong'} aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-ink">{inst.display_name || inst.phone_number || t('wa_number')}</p>
                            <p className="text-xs text-muted"><span dir="ltr">{inst.phone_number || '—'}</span> · {inst.type === 'cloud_api' ? 'Cloud API' : 'WhatsApp Web'}</p>
                          </div>
                          <Badge tone={inst.status === 'connected' ? 'success' : inst.status === 'qr_pending' ? 'warning' : 'neutral'}>{INSTANCE_STATUS[inst.status] ? t(INSTANCE_STATUS[inst.status]) : inst.status}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
