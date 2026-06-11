// @ts-nocheck
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useState } from 'react'
import { useQuery } from 'react-query'
import axios from 'axios'
import {
  Bar, Doughnut, Line
} from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, ArcElement,
  PointElement, LineElement, Tooltip, Legend, Filler,
} from 'chart.js'
// Official Google Material Symbols icons (outlined)
const MegaphoneIcon = () => <span dangerouslySetInnerHTML={{__html: `<svg width="22" height="22" fill="currentColor" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 -960 960 960"><path d="M730-450v-60h150v60H730Zm50 290-121-90 36-48 121 90-36 48Zm-82-503-36-48 118-89 36 48-118 89ZM210-200v-160h-70q-24.75 0-42.37-17.63Q80-395.25 80-420v-120q0-24.75 17.63-42.38Q115.25-600 140-600h180l200-120v480L320-360h-50v160h-60Zm250-146v-268l-124 74H140v120h196l124 74Zm100 0v-268q27 24 43.5 58.5T620-480q0 41-16.5 75.5T560-346ZM300-480Z"/></svg>`}} />
const CheckCircleIcon = () => <span dangerouslySetInnerHTML={{__html: `<svg width="22" height="22" fill="currentColor" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 -960 960 960"><path d="m421-298 283-283-46-45-237 237-120-120-45 45 165 166Zm59 218q-82 0-155-31.5t-127.5-86Q143-252 111.5-325T80-480q0-83 31.5-156t86-127Q252-817 325-848.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 82-31.5 155T763-197.5q-54 54.5-127 86T480-80Zm0-60q142 0 241-99.5T820-480q0-142-99-241t-241-99q-141 0-240.5 99T140-480q0 141 99.5 240.5T480-140Zm0-340Z"/></svg>`}} />
const ArrowTrendingUpIcon = () => <span dangerouslySetInnerHTML={{__html: `<svg width="22" height="22" fill="currentColor" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 -960 960 960"><path d="m123-240-43-43 292-291 167 167 241-241H653v-60h227v227h-59v-123L538-321 371-488 123-240Z"/></svg>`}} />
const ArrowTrendingDownIcon = () => <span dangerouslySetInnerHTML={{__html: `<svg width="22" height="22" fill="currentColor" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 -960 960 960"><path d="M653-240v-60h127L539-541 372-374 80-665l43-43 248 248 167-167 283 283v-123h59v227H653Z"/></svg>`}} />
const UserGroupIcon = () => <span dangerouslySetInnerHTML={{__html: `<svg width="22" height="22" fill="currentColor" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 -960 960 960"><path d="M38-160v-94q0-35 18-63.5t50-42.5q73-32 131.5-46T358-420q62 0 120 14t131 46q32 14 50.5 42.5T678-254v94H38Zm700 0v-94q0-63-32-103.5T622-423q69 8 130 23.5t99 35.5q33 19 52 47t19 63v94H738ZM250-523q-42-42-42-108t42-108q42-42 108-42t108 42q42 42 42 108t-42 108q-42 42-108 42t-108-42Zm426 0q-42 42-108 42-11 0-24.5-1.5T519-488q24-25 36.5-61.5T568-631q0-45-12.5-79.5T519-774q11-3 24.5-5t24.5-2q66 0 108 42t42 108q0 66-42 108ZM98-220h520v-34q0-16-9.5-31T585-306q-72-32-121-43t-106-11q-57 0-106.5 11T130-306q-14 6-23 21t-9 31v34Zm324.5-346.5Q448-592 448-631t-25.5-64.5Q397-721 358-721t-64.5 25.5Q268-670 268-631t25.5 64.5Q319-541 358-541t64.5-25.5ZM358-220Zm0-411Z"/></svg>`}} />
const ChatBubbleLeftRightIcon = () => <span dangerouslySetInnerHTML={{__html: `<svg width="22" height="22" fill="currentColor" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 -960 960 960"><path d="M240-399h313v-60H240v60Zm0-130h480v-60H240v60Zm0-130h480v-60H240v60ZM80-80v-740q0-24 18-42t42-18h680q24 0 42 18t18 42v520q0 24-18 42t-42 18H240L80-80Zm134-220h606v-520H140v600l74-80Zm-74 0v-520 520Z"/></svg>`}} />
const ClockIcon = () => <span dangerouslySetInnerHTML={{__html: `<svg width="22" height="22" fill="currentColor" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 -960 960 960"><path d="m627-287 45-45-159-160v-201h-60v225l174 181ZM480-80q-82 0-155-31.5t-127.5-86Q143-252 111.5-325T80-480q0-82 31.5-155t86-127.5Q252-817 325-848.5T480-880q82 0 155 31.5t127.5 86Q817-708 848.5-635T880-480q0 82-31.5 155t-86 127.5Q708-143 635-111.5T480-80Zm0-400Zm0 340q140 0 240-100t100-240q0-140-100-240T480-820q-140 0-240 100T140-480q0 140 100 240t240 100Z"/></svg>`}} />
const LinkIcon = () => <span dangerouslySetInnerHTML={{__html: `<svg width="22" height="22" fill="currentColor" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 -960 960 960"><path d="M450-280H280q-83 0-141.5-58.5T80-480q0-83 58.5-141.5T280-680h170v60H280q-58.33 0-99.17 40.76-40.83 40.77-40.83 99Q140-422 180.83-381q40.84 41 99.17 41h170v60ZM325-450v-60h310v60H325Zm185 170v-60h170q58.33 0 99.17-40.76 40.83-40.77 40.83-99Q820-538 779.17-579q-40.84-41-99.17-41H510v-60h170q83 0 141.5 58.5T880-480q0 83-58.5 141.5T680-280H510Z"/></svg>`}} />
const CpuChipIcon = () => <span dangerouslySetInnerHTML={{__html: `<svg width="22" height="22" fill="currentColor" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 -960 960 960"><path d="M377-377v-205h205v205H377Zm60-60h85v-85h-85v85Zm-77 317v-80H260q-24 0-42-18t-18-42v-100h-80v-60h80v-124h-80v-60h80v-100q0-24 18-42t42-18h100v-76h60v76h124v-76h60v76h100q24 0 42 18t18 42v100h76v60h-76v124h76v60h-76v100q0 24-18 42t-42 18H604v80h-60v-80H420v80h-60Zm344-140v-444H260v444h444ZM480-480Z"/></svg>`}} />
const BoltIcon = () => <span dangerouslySetInnerHTML={{__html: `<svg width="22" height="22" fill="currentColor" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 -960 960 960"><path d="m393-165 279-335H492l36-286-253 366h154l-36 255Zm-73 85 40-280H160l360-520h80l-40 320h240L400-80h-80Zm154-396Z"/></svg>`}} />
const ArrowUpIcon = () => <span dangerouslySetInnerHTML={{__html: `<svg width="12" height="12" fill="currentColor" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 -960 960 960"><path d="M450-160v-526L202-438l-42-42 320-320 320 320-42 42-248-248v526h-60Z"/></svg>`}} />
const ArrowDownIcon = () => <span dangerouslySetInnerHTML={{__html: `<svg width="12" height="12" fill="currentColor" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 -960 960 960"><path d="M450-800v526L202-522l-42 42 320 320 320-320-42-42-248 248v-526h-60Z"/></svg>`}} />
import clsx from 'clsx'

ChartJS.register(
  CategoryScale, LinearScale, BarElement, ArcElement,
  PointElement, LineElement, Tooltip, Legend, Filler
)

const RANGES = [
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
]

function StatCard({ label, value, sub, icon: Icon, color, trend, trendVal }) {
  // Map text color → light bg
  const bgMap: Record<string,string> = {
    'text-blue-600':   'bg-blue-50',
    'text-green-600':  'bg-green-50',
    'text-purple-600': 'bg-purple-50',
    'text-orange-600': 'bg-orange-50',
    'text-red-600':    'bg-red-50',
    'text-pink-600':   'bg-pink-50',
    'text-teal-600':   'bg-teal-50',
    'text-indigo-600': 'bg-indigo-50',
    'text-cyan-600':   'bg-cyan-50',
    'text-amber-600':  'bg-amber-50',
  }
  const iconBg = bgMap[color] || 'bg-slate-100'
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon />
        </div>
        {trendVal !== undefined && (
          <div className={clsx('flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full',
            trendVal > 0 ? 'text-green-700 bg-green-50 border border-green-200' :
            trendVal < 0 ? 'text-red-700 bg-red-50 border border-red-200' :
            'text-slate-500 bg-slate-100 border border-slate-200')}>
            {trendVal > 0 ? <ArrowUpIcon /> : trendVal < 0 ? <ArrowDownIcon /> : null}
            {trendVal > 0 ? '+' : ''}{trendVal}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900 mb-0.5 tabular-nums">{value}</p>
      <p className="text-sm font-medium text-slate-600">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function AnalyticsPage() {
  const [range, setRange] = useState(30)

  const { data, isLoading } = useQuery(
    ['analytics-stats', range],
    () => axios.get('/api/dashboard/stats').then(r => r.data),
    { staleTime: 60000 }
  )

  const stats = data?.stats || {}

  const exportCSV = () => {
    const rows = [
      ['Date', 'Sent', 'Delivered', 'Received'],
      ...chart.map(d => [d.date, d.sent || 0, d.delivered || 0, d.received || 0])
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `wabek-analytics-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportCampaignsCSV = () => {
    const rows = [
      ['Campaign', 'Status', 'Sent', 'Delivered', 'Read', 'Failed', 'Delivery Rate'],
      ...campaigns.map(c => {
        const rate = c.sent_count > 0 ? Math.round(((c.delivered_count || 0) / c.sent_count) * 100) : 0
        return [c.name, c.status, c.sent_count || 0, c.delivered_count || 0, c.read_count || 0, c.failed_count || 0, rate + '%']
      })
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `wabek-campaigns-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
  const sb = data?.status_breakdown || {}
  const rawChart = data?.daily_chart || []
  const campaigns = data?.recent_campaigns || []
  const chatbots = data?.chatbot_stats || []
  const topLinks = data?.top_links || []
  const instances = data?.instances || []

  // Slice chart by range
  const chart = rawChart.slice(-range)

  // Chart colors
  const brandGreen = '#00D46A'
  const blue = '#3B82F6'
  const purple = '#A855F7'
  const yellow = '#F59E0B'

  // Line chart — messages over time
  const lineData = {
    labels: chart.map(d => {
      const dt = new Date(d.date)
      return dt.toLocaleDateString('en', { month: 'short', day: 'numeric' })
    }),
    datasets: [
      {
        label: 'Sent',
        data: chart.map(d => d.sent || 0),
        borderColor: brandGreen,
        backgroundColor: `${brandGreen}15`,
        borderWidth: 2,
        pointRadius: range <= 7 ? 4 : 2,
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Received',
        data: chart.map(d => d.received || 0),
        borderColor: blue,
        backgroundColor: `${blue}10`,
        borderWidth: 2,
        pointRadius: range <= 7 ? 4 : 2,
        tension: 0.4,
        fill: true,
      },
    ],
  }

  // Bar chart — sent vs delivered
  const barData = {
    labels: chart.slice(-14).map(d => new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })),
    datasets: [
      { label: 'Sent', data: chart.slice(-14).map(d => d.sent || 0), backgroundColor: `${brandGreen}90`, borderRadius: 4 },
      { label: 'Delivered', data: chart.slice(-14).map(d => d.delivered || 0), backgroundColor: `${blue}90`, borderRadius: 4 },
    ],
  }

  // Doughnut
  const total = (sb.sent || 0) + (sb.delivered || 0) + (sb.read || 0) + (sb.failed || 0)
  const doughnutData = {
    labels: ['Sent', 'Delivered', 'Read', 'Failed'],
    datasets: [{
      data: [sb.sent || 0, sb.delivered || 0, sb.read || 0, sb.failed || 0],
      backgroundColor: [blue, brandGreen, purple, '#EF4444'],
      borderWidth: 0,
      hoverOffset: 4,
    }],
  }

  const gridColor = '#F8FAFC20'
  const tickColor = '#6B7280'
  const baseOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#FFFFFF',
        titleColor: '#F9FAFB',
        bodyColor: '#9CA3AF',
        borderColor: '#F8FAFC',
        borderWidth: 1,
        padding: 10,
      },
    },
    scales: {
      x: { grid: { color: gridColor }, ticks: { color: tickColor, maxTicksLimit: 7 } },
      y: { grid: { color: gridColor }, ticks: { color: tickColor }, beginAtZero: true },
    },
  }

  const statCards = [
    {
      label: 'Sent This Month',
      value: (stats.sent_this_month || 0).toLocaleString(),
      sub: `vs ${(stats.sent_last_month || 0).toLocaleString()} last month`,
      icon: MegaphoneIcon,
      color: 'text-blue-600',
      trendVal: stats.mom_growth,
    },
    {
      label: 'Delivery Rate',
      value: `${stats.delivery_rate || 0}%`,
      sub: `${(sb.delivered || 0) + (sb.read || 0)} delivered`,
      icon: CheckCircleIcon,
      color: 'text-green-600',
    },
    {
      label: 'Read Rate',
      value: `${stats.read_rate || 0}%`,
      sub: `${(sb.read || 0).toLocaleString()} read`,
      icon: ArrowTrendingUpIcon,
      color: 'text-purple-600',
    },
    {
      label: 'Total Contacts',
      value: (stats.total_contacts || 0).toLocaleString(),
      sub: `+${stats.new_contacts_this_month || 0} this month`,
      icon: UserGroupIcon,
      color: 'text-blue-600',
    },
    {
      label: 'Inbound Messages',
      value: (stats.inbound_this_month || 0).toLocaleString(),
      sub: 'received this month',
      icon: ChatBubbleLeftRightIcon,
      color: 'text-cyan-600',
    },
    {
      label: 'Open Conversations',
      value: stats.open_conversations || 0,
      sub: 'awaiting reply',
      icon: ClockIcon,
      color: 'text-amber-600',
    },
    {
      label: 'Link Clicks',
      value: (stats.link_clicks_total || 0).toLocaleString(),
      sub: 'all time',
      icon: LinkIcon,
      color: 'text-orange-600',
    },
    {
      label: 'Active Chatbots',
      value: stats.active_chatbots || 0,
      sub: `${stats.active_campaigns || 0} campaigns running`,
      icon: CpuChipIcon,
      color: 'text-pink-600',
    },
    {
      label: 'AI Replies This Month',
      value: (stats.ai_replies_this_month || 0).toLocaleString(),
      sub: 'auto-replied by GPT',
      icon: CpuChipIcon,
      color: 'text-purple-600',
    },
  ]

  return (
    <DashboardLayout title="Analytics">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-sm text-slate-500 mt-0.5">Your platform performance overview</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="btn-secondary text-xs py-1.5 px-3">⬇️ Export CSV</button>
          <div className="flex bg-[#F8FAFC] rounded-xl p-1 gap-1">
            {RANGES.map(r => (
              <button key={r.days} onClick={() => setRange(r.days)} className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors', range === r.days ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-700')}>{r.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {statCards.map(s => (
          isLoading
            ? <div key={s.label} className="card h-28 skeleton" />
            : <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Line Chart — Messages Over Time */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-slate-900">Messages Over Time</h3>
          <div className="flex gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 rounded" style={{ backgroundColor: brandGreen }} />
              <span className="text-slate-400">Sent</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 rounded" style={{ backgroundColor: blue }} />
              <span className="text-slate-400">Received</span>
            </div>
          </div>
        </div>
        <div className="h-64">
          {isLoading
            ? <div className="w-full h-full skeleton rounded-xl" />
            : <Line data={lineData} options={baseOpts} />
          }
        </div>
      </div>

      {/* 2-col: Bar + Doughnut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Bar Chart */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-slate-900">Sent vs Delivered (last 14 days)</h3>
            <div className="flex gap-3 text-xs">
              <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded" style={{ backgroundColor: `${brandGreen}90` }} /><span className="text-slate-400">Sent</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded" style={{ backgroundColor: `${blue}90` }} /><span className="text-slate-400">Delivered</span></div>
            </div>
          </div>
          <div className="h-56">
            {isLoading
              ? <div className="w-full h-full skeleton rounded-xl" />
              : <Bar data={barData} options={baseOpts} />
            }
          </div>
        </div>

        {/* Doughnut */}
        <div className="card">
          <h3 className="font-display font-semibold text-slate-900 mb-1">Status Breakdown</h3>
          <p className="text-xs text-slate-500 mb-3">This month</p>
          <div className="h-36 flex items-center justify-center">
            {isLoading
              ? <div className="w-36 h-36 skeleton rounded-full" />
              : total > 0
                ? <Doughnut data={doughnutData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#FFFFFF', titleColor: '#F9FAFB', bodyColor: '#9CA3AF', borderColor: '#F8FAFC', borderWidth: 1 } }, cutout: '68%' }} />
                : <p className="text-slate-600 text-sm">No data yet</p>
            }
          </div>
          <div className="space-y-2 mt-4">
            {[
              { label: 'Sent', value: sb.sent || 0, color: blue, pct: total > 0 ? Math.round((sb.sent / total) * 100) : 0 },
              { label: 'Delivered', value: sb.delivered || 0, color: brandGreen, pct: total > 0 ? Math.round((sb.delivered / total) * 100) : 0 },
              { label: 'Read', value: sb.read || 0, color: purple, pct: total > 0 ? Math.round((sb.read / total) * 100) : 0 },
              { label: 'Failed', value: sb.failed || 0, color: '#EF4444', pct: total > 0 ? Math.round((sb.failed / total) * 100) : 0 },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-2 text-xs">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                <span className="text-slate-400 flex-1">{s.label}</span>
                <span className="text-slate-500">{s.pct}%</span>
                <span className="text-slate-900 font-medium w-16 text-right">{s.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 2-col: Campaigns + WhatsApp Instances */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Campaign Performance */}
        <div className="card">
          <h3 className="font-display font-semibold text-slate-900 mb-4">📢 Campaign Performance</h3>
          {isLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-8 skeleton rounded" />)}</div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-8">
              <MegaphoneIcon className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <p className="text-slate-600 text-sm">No campaigns yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map(c => {
                const rate = c.sent_count > 0 ? Math.round(((c.delivered_count || 0) / c.sent_count) * 100) : 0
                const readRate = c.sent_count > 0 ? Math.round(((c.read_count || 0) / c.sent_count) * 100) : 0
                return (
                  <div key={c.name} className="p-3 bg-[#F8FAFC] rounded-xl border border-slate-200/50 hover:border-slate-200 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-slate-900 truncate flex-1 mr-2">{c.name}</p>
                      <span className={clsx('text-xs px-2 py-0.5 rounded-full flex-shrink-0',
                        c.status === 'completed' ? 'badge-green' :
                        c.status === 'running' ? 'badge-yellow' : 'badge-gray')}>
                        {c.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>📤 {(c.sent_count || 0).toLocaleString()} sent</span>
                      <span>✅ {rate}% delivered</span>
                      <span>👁️ {readRate}% read</span>
                    </div>
                    <div className="mt-2 h-1.5 bg-[#F8FAFC] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${rate}%`, backgroundColor: brandGreen }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* WhatsApp Instances */}
        <div className="card">
          <h3 className="font-display font-semibold text-slate-900 mb-4">📱 WhatsApp Instances</h3>
          {isLoading ? (
            <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-12 skeleton rounded" />)}</div>
          ) : instances.length === 0 ? (
            <div className="text-center py-8">
              <ChatBubbleLeftRightIcon className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <p className="text-slate-600 text-sm">No instances connected</p>
            </div>
          ) : (
            <div className="space-y-2">
              {instances.map(inst => (
                <div key={inst.id} className="flex items-center gap-3 p-3 bg-[#F8FAFC] rounded-xl border border-slate-200/50">
                  <div className={clsx('w-2.5 h-2.5 rounded-full flex-shrink-0',
                    inst.status === 'connected' ? 'bg-green-400' :
                    inst.status === 'qr_pending' ? 'bg-yellow-400 animate-pulse' : 'bg-slate-200')
                  } />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{inst.display_name || inst.phone_number || 'Instance'}</p>
                    <p className="text-xs text-slate-500">{inst.phone_number || '—'} · {inst.type === 'cloud_api' ? 'Cloud API' : 'WhatsApp Web'}</p>
                  </div>
                  <span className={clsx('text-xs px-2 py-0.5 rounded-full',
                    inst.status === 'connected' ? 'badge-green' :
                    inst.status === 'qr_pending' ? 'badge-yellow' : 'badge-gray')}>
                    {inst.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2-col: Chatbots + Top Links */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chatbot Performance */}
        <div className="card">
          <h3 className="font-display font-semibold text-slate-900 mb-4">🤖 Chatbot Performance</h3>
          {isLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-8 skeleton rounded" />)}</div>
          ) : chatbots.length === 0 ? (
            <div className="text-center py-8">
              <CpuChipIcon className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <p className="text-slate-600 text-sm">No chatbots active</p>
            </div>
          ) : (
            <div className="space-y-3">
              {chatbots.map((flow, i) => {
                const maxTriggers = Math.max(...chatbots.map(f => f.trigger_count || 0), 1)
                const pct = Math.round(((flow.trigger_count || 0) / maxTriggers) * 100)
                return (
                  <div key={flow.name}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className={clsx('w-2 h-2 rounded-full', flow.is_active ? 'bg-green-400' : 'bg-slate-200')} />
                        <span className="text-sm text-slate-700 truncate max-w-48">{flow.name}</span>
                      </div>
                      <span className="text-xs text-slate-500">{(flow.trigger_count || 0).toLocaleString()} triggers</span>
                    </div>
                    <div className="h-1.5 bg-[#F8FAFC] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: purple }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Top Tracked Links */}
        <div className="card">
          <h3 className="font-display font-semibold text-slate-900 mb-4">🔗 Top Tracked Links</h3>
          {isLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-8 skeleton rounded" />)}</div>
          ) : topLinks.length === 0 ? (
            <div className="text-center py-8">
              <LinkIcon className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <p className="text-slate-600 text-sm">No tracked links yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topLinks.map((link, i) => {
                const maxClicks = Math.max(...topLinks.map(l => l.click_count || 0), 1)
                const pct = Math.round(((link.click_count || 0) / maxClicks) * 100)
                return (
                  <div key={link.short_code}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-slate-600 w-4">{i + 1}</span>
                        <span className="text-sm text-blue-600 font-mono text-slate-800">/{link.short_code}</span>
                        <span className="text-xs text-slate-600 truncate hidden sm:block">{link.original_url?.replace(/^https?:\/\//, '').slice(0, 30)}</span>
                      </div>
                      <span className="text-xs text-slate-900 font-medium ml-2 flex-shrink-0">{(link.click_count || 0).toLocaleString()} clicks</span>
                    </div>
                    <div className="h-1.5 bg-[#F8FAFC] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: yellow }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

    </DashboardLayout>
  )
}
