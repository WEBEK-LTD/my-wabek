import { useEffect, useMemo, useState } from 'react'
import { useQuery } from 'react-query'
import axios from 'axios'
import {
  InboxIcon, PaperAirplaneIcon, EyeIcon, UserGroupIcon, MegaphoneIcon, CpuChipIcon, SparklesIcon,
  ArrowDownTrayIcon, LinkIcon, ChatBubbleLeftRightIcon, PlusIcon, ArrowPathIcon, ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import DashboardLayout from '@/components/layout/DashboardLayout'
import {
  AreaChart, Button, Card, CardHeader, CardBody, EmptyState, PageHeader, Skeleton, StatCard, Tabs, CHART_COLORS,
} from '@/components/ui'
import { useAuthStore } from '@/lib/store'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import { useHomeCopy } from '@/components/home/copy'
import { SetupChecklist } from '@/components/home/SetupChecklist'
import type { SetupStep } from '@/components/home/SetupChecklist'
import {
  ChatbotCard, DeliveryCard, MiniStats, NumbersCard, QuickActions, RecentCampaigns, RepliesCard, fmt,
} from '@/components/home/HomeWidgets'
import { localeTag } from '@/components/auth/makeCopy'

export default function DashboardPage() {
  const { c, lang } = useHomeCopy()
  const user = useAuthStore(s => s.user)
  const { brandName } = useWhiteLabel()
  const brand = brandName || 'WABEK'
  const isOwner = !!user && !user.sub_account_of
  const [range, setRange] = useState<'7d' | '30d'>('30d')
  // Phones: 30 daily labels don't fit, start on the 7-day view.
  useEffect(() => { if (window.matchMedia('(max-width: 639px)').matches) setRange('7d') }, [])

  const { data, isLoading, isError, refetch, isFetching } = useQuery('dashboard-stats',
    () => axios.get('/api/dashboard/stats').then(r => r.data),
    { refetchInterval: 30000 })
  const { data: planData } = useQuery('plan-features',
    () => axios.get('/api/billing/plan-features').then(r => r.data),
    { staleTime: 60000, retry: false })

  // Checklist sources (owner only): AI auto-reply settings and team members.
  const aiQ = useQuery('home-ai-settings', () => axios.get('/api/ai/settings').then(r => r.data), { enabled: isOwner, staleTime: 60000, retry: false })
  const teamQ = useQuery('home-team', () => axios.get('/api/team').then(r => r.data), { enabled: isOwner, staleTime: 60000, retry: false })
  const perfQ = useQuery('home-team-performance', () => axios.get('/api/team/performance', { params: { range: '30d' } }).then(r => r.data), { enabled: isOwner, staleTime: 120000, retry: false })

  const stats = data?.stats || {}
  const chart: { date: string; sent: number; delivered: number; received: number }[] = data?.daily_chart || []
  const campaigns = data?.recent_campaigns || []
  const chatbotStats = data?.chatbot_stats || []
  const instances = data?.instances || []
  const breakdown = data?.status_breakdown || { sent: 0, delivered: 0, read: 0, failed: 0 }

  /* Setup checklist — real state only; unknown steps are left out. */
  const steps: SetupStep[] = useMemo(() => {
    if (!data || !isOwner) return []
    const list: SetupStep[] = [
      { id: 'number', label: 'step_number', href: '/dashboard/instances', done: instances.some((i: any) => i.status === 'connected') },
      { id: 'contacts', label: 'step_contacts', href: '/dashboard/contacts', done: (stats.total_contacts || 0) > 0 },
    ]
    if (aiQ.isSuccess || (stats.active_chatbots || 0) > 0) {
      const aiOn = (aiQ.data?.settings || []).some((s: any) => s?.is_enabled)
      list.push({ id: 'autoreply', label: 'step_autoreply', href: '/dashboard/ai', done: aiOn || (stats.active_chatbots || 0) > 0 })
    }
    if (teamQ.isSuccess) {
      list.push({ id: 'team', label: 'step_team', href: '/dashboard/team', done: (teamQ.data?.members || []).length > 0 })
    }
    return list
  }, [data, isOwner, aiQ.isSuccess, aiQ.data, teamQ.isSuccess, teamQ.data])
  const checklistReady = !isOwner || (!aiQ.isLoading && !teamQ.isLoading)

  /* Chart */
  const days = range === '7d' ? chart.slice(-7) : chart
  const dateFmt = new Intl.DateTimeFormat(localeTag(lang), { day: 'numeric', month: 'short' })
  const chartLabels = days.map(d => { try { return dateFmt.format(new Date(d.date + 'T12:00:00')) } catch { return d.date?.slice(5) || '' } })
  const chartHasData = days.some(d => d.sent || d.received || d.delivered)

  /* KPIs */
  const maxMonth = Number(planData?.features?.max_messages_month)
  const hasPlanCap = Number.isFinite(maxMonth) && maxMonth > 0
  const sentSpark = chart.slice(-14).map(d => d.sent || 0)

  /* Who replies: AI (this month) vs team (30 days), only when data exists */
  const teamRows: { name: string; messages: number }[] = perfQ.data?.mode === 'team'
    ? [
        ...(perfQ.data.owner ? [{ name: user?.name || perfQ.data.owner.name, messages: perfQ.data.owner.messages_sent || 0 }] : []),
        ...((perfQ.data.members || []) as any[]).map(m => ({ name: m.name || m.email, messages: m.messages_sent || 0 })),
      ].filter(m => m.messages > 0).sort((a, b) => b.messages - a.messages)
    : []
  const aiReplies = stats.ai_replies_this_month || 0
  const showReplies = aiReplies + teamRows.reduce((s, m) => s + m.messages, 0) > 0
  const hasDelivery = breakdown.sent + breakdown.delivered + breakdown.read + breakdown.failed > 0

  const firstName = (user?.name || '').trim().split(/\s+/)[0]

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-5">
        <PageHeader
          eyebrow={c('eyebrow')}
          title={c('title')}
          description={firstName ? c('greeting', { name: firstName }) : c('greeting_anon')}
          actions={
            <>
              <Button variant="secondary" icon={ArrowDownTrayIcon} href="/dashboard/contacts">{c('import_contacts')}</Button>
              <Button variant="dark" icon={PlusIcon} href="/dashboard/campaigns">{c('new_campaign')}</Button>
            </>
          }
        />

        {isError && !data ? (
          <EmptyState
            variant="card"
            icon={ExclamationTriangleIcon}
            title={c('error_title')}
            description={c('error_d')}
            action={<Button variant="secondary" icon={ArrowPathIcon} loading={isFetching} onClick={() => refetch()}>{c('retry')}</Button>}
          />
        ) : (
          <>
            {checklistReady && <SetupChecklist steps={steps} brand={brand} />}

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3 sm:gap-3.5 xl:grid-cols-4">
              <StatCard
                loading={isLoading}
                label={c('kpi_open')}
                value={fmt(stats.open_conversations)}
                sub={c('kpi_open_sub')}
                subTone={(stats.open_conversations || 0) > 0 ? 'warning' : 'muted'}
                icon={InboxIcon}
                href="/dashboard/chat"
              />
              <StatCard
                loading={isLoading}
                label={c('kpi_month')}
                value={fmt(stats.sent_this_month)}
                icon={PaperAirplaneIcon}
                href="/dashboard/analytics"
                {...(hasPlanCap
                  ? { sub: c('kpi_month_plan', { max: fmt(maxMonth) }), progress: Math.min(stats.sent_this_month || 0, maxMonth), progressMax: maxMonth }
                  : (stats.sent_last_month || 0) > 0
                    ? { trend: stats.mom_growth || 0, trendLabel: c('kpi_month_vs') }
                    : { sparkline: sentSpark.some(Boolean) ? sentSpark : undefined })}
              />
              <StatCard
                loading={isLoading}
                label={c('kpi_read')}
                value={`${stats.read_rate || 0}%`}
                sub={c('kpi_read_sub', { rate: stats.delivery_rate || 0 })}
                icon={EyeIcon}
                href="/dashboard/analytics"
              />
              <StatCard
                loading={isLoading}
                label={c('kpi_contacts')}
                value={fmt(stats.total_contacts)}
                sub={(stats.new_contacts_this_month || 0) > 0 ? c('kpi_contacts_sub', { n: fmt(stats.new_contacts_this_month) }) : undefined}
                subTone="success"
                icon={UserGroupIcon}
                href="/dashboard/contacts"
              />
            </div>

            <MiniStats
              loading={isLoading}
              items={[
                { label: c('mini_campaigns'), value: stats.active_campaigns || 0, href: '/dashboard/campaigns', icon: MegaphoneIcon },
                { label: c('mini_chatbots'), value: stats.active_chatbots || 0, href: '/dashboard/chatbot', icon: CpuChipIcon },
                { label: c('mini_ai'), value: aiReplies, href: '/dashboard/ai', icon: SparklesIcon },
                { label: c('mini_inbound'), value: stats.inbound_this_month || 0, href: '/dashboard/chat', icon: ChatBubbleLeftRightIcon },
                { label: c('mini_clicks'), value: stats.link_clicks_total || 0, href: '/dashboard/links', icon: LinkIcon },
                { label: c('mini_total'), value: stats.total_messages || 0, href: '/dashboard/analytics', icon: PaperAirplaneIcon },
              ]}
            />

            {/* Chart + numbers */}
            <div className="grid gap-3.5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <Card padding="none" className="min-w-0">
                <CardHeader
                  title={c('chart_title')}
                  subtitle={c('chart_sub')}
                  action={
                    <Tabs
                      variant="segmented" size="sm" value={range} onChange={v => setRange(v as '7d' | '30d')}
                      aria-label={c('chart_title')}
                      tabs={[{ id: '7d', label: c('range_7') }, { id: '30d', label: c('range_30') }]}
                    />
                  }
                />
                <CardBody>
                  {isLoading ? (
                    <Skeleton className="h-[230px] w-full rounded-2xl" />
                  ) : chartHasData ? (
                    <AreaChart
                      height={230}
                      labels={chartLabels}
                      formatValue={v => fmt(v)}
                      series={[
                        { name: c('chart_received'), data: days.map(d => d.received || 0), color: CHART_COLORS[0] },
                        { name: c('chart_sent'), data: days.map(d => d.sent || 0), color: CHART_COLORS[1] },
                      ]}
                    />
                  ) : (
                    <EmptyState size="sm" icon={ChatBubbleLeftRightIcon} title={c('chart_empty')} className="h-[230px] justify-center" />
                  )}
                </CardBody>
              </Card>
              <div className="flex min-w-0 flex-col gap-3.5">
                <NumbersCard instances={instances} loading={isLoading} />
                <QuickActions />
              </div>
            </div>

            {/* Campaigns + replies */}
            <div className="grid gap-3.5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <RecentCampaigns campaigns={campaigns} loading={isLoading} />
              <div className="flex min-w-0 flex-col gap-3.5">
                {showReplies ? <RepliesCard ai={aiReplies} team={teamRows} /> : hasDelivery ? <DeliveryCard breakdown={breakdown} /> : null}
                {chatbotStats.length > 0 && <ChatbotCard flows={chatbotStats} />}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
