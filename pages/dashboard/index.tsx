// @ts-nocheck
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useQuery } from 'react-query'
import axios from 'axios'
import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js'
import { ChatBubbleLeftRightIcon, UserGroupIcon, MegaphoneIcon, BoltIcon, LinkIcon, CpuChipIcon, InboxIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { format } from 'date-fns'
import clsx from 'clsx'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

export default function DashboardPage() {
  const { data, isLoading } = useQuery('dashboard-stats', () => axios.get('/api/dashboard/stats').then(r => r.data), { refetchInterval: 30000 })
  const stats = data?.stats || {}
  const chart = data?.daily_chart || []
  const campaigns = data?.recent_campaigns || []
  const chatbotStats = data?.chatbot_stats || []
  const instances = data?.instances || []

  const barData = {
    labels: chart.map(d => d.date?.slice(5) || ''),
    datasets: [
      { label: 'Sent', data: chart.map(d => d.sent || 0), backgroundColor: 'rgba(0,212,106,0.8)', borderRadius: 4 },
      { label: 'Delivered', data: chart.map(d => d.delivered || 0), backgroundColor: 'rgba(59,130,246,0.6)', borderRadius: 4 },
    ],
  }

  const statCards = [
    { label: 'Messages Sent', value: (stats.sent_this_month || 0).toLocaleString(), sub: 'this month', icon: ChatBubbleLeftRightIcon, color: 'text-blue-600', href: '/dashboard/analytics' },
    { label: 'Total Contacts', value: (stats.total_contacts || 0).toLocaleString(), sub: 'in database', icon: UserGroupIcon, color: 'text-blue-400', href: '/dashboard/contacts' },
    { label: 'Active Campaigns', value: stats.active_campaigns || 0, sub: 'running now', icon: MegaphoneIcon, color: 'text-purple-400', href: '/dashboard/campaigns' },
    { label: 'Open Conversations', value: stats.open_conversations || 0, sub: 'awaiting reply', icon: InboxIcon, color: 'text-yellow-400', href: '/dashboard/chat' },
    { label: 'Active Automations', value: stats.active_flows || 0, sub: 'flows running', icon: BoltIcon, color: 'text-orange-400', href: '/dashboard/automation' },
    { label: 'Active Chatbots', value: stats.active_chatbots || 0, sub: 'flows active', icon: CpuChipIcon, color: 'text-pink-400', href: '/dashboard/chatbot' },
    { label: 'Link Clicks', value: (stats.link_clicks_total || 0).toLocaleString(), sub: 'total tracked', icon: LinkIcon, color: 'text-cyan-400', href: '/dashboard/links' },
    { label: 'Total Messages', value: (stats.total_messages || 0).toLocaleString(), sub: 'all time', icon: CheckCircleIcon, color: 'text-slate-400', href: '/dashboard/analytics' },
  ]

  return (
    <DashboardLayout title="Overview">
      {/* Stat grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {statCards.map(s => (
          <Link key={s.label} href={s.href} className="stat-card hover:border-wabek-muted transition-colors group">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={clsx('w-4 h-4', s.color)} />
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
            <p className="text-2xl font-display font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{isLoading ? '—' : s.value}</p>
            <p className="text-xs text-slate-600 mt-0.5">{s.sub}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* Bar chart */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-slate-900">Messages — Last 7 Days</h3>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-brand-500 inline-block" />Sent</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-blue-500 inline-block" />Delivered</span>
            </div>
          </div>
          <div className="h-48">
            {!isLoading && <Bar data={barData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: '#E2E8F0' }, ticks: { color: '#64748B' } }, y: { grid: { color: '#E2E8F0' }, ticks: { color: '#64748B' }, beginAtZero: true } } }} />}
            {isLoading && <div className="skeleton w-full h-full rounded-lg" />}
          </div>
        </div>

        {/* WhatsApp instances */}
        <div className="card">
          <h3 className="font-display font-semibold text-slate-900 mb-3">WhatsApp Connections</h3>
          {instances.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-slate-500 text-sm mb-3">No instances connected</p>
              <Link href="/dashboard/instances" className="btn-primary text-sm justify-center">Connect Now</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {instances.map(inst => (
                <div key={inst.id} className="flex items-center gap-3 py-2 border-b border-slate-200/50 last:border-0">
                  <div className={clsx('w-2 h-2 rounded-full flex-shrink-0', inst.status === 'connected' ? 'bg-brand-500' : 'bg-slate-200')} />
                  <div className="min-w-0">
                    <p className="text-sm text-slate-900 truncate">{inst.display_name || inst.phone_number}</p>
                    <p className="text-xs text-slate-500">{inst.instance_type === 'wa_web' ? '📱 WA Web' : '☁️ Cloud API'}</p>
                  </div>
                  <span className={clsx('text-xs ml-auto flex-shrink-0', inst.status === 'connected' ? 'text-blue-600' : 'text-slate-500')}>{inst.status}</span>
                </div>
              ))}
              <Link href="/dashboard/instances" className="text-xs text-blue-600 hover:text-blue-500 block text-center mt-2">Manage →</Link>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Campaigns */}
        {campaigns.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-slate-900">Recent Campaigns</h3>
              <Link href="/dashboard/campaigns" className="text-xs text-blue-600 hover:text-blue-500">View all →</Link>
            </div>
            <div className="space-y-3">
              {campaigns.map(c => {
                const rate = c.sent_count > 0 ? Math.round((c.delivered_count / c.sent_count) * 100) : 0
                return (
                  <div key={c.name} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900 truncate">{c.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="h-1.5 bg-[#F8FAFC] rounded-full w-20">
                          <div className="h-full bg-brand-500 rounded-full" style={{ width: `${rate}%` }} />
                        </div>
                        <span className="text-xs text-slate-500">{rate}% delivered</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-medium text-slate-900">{c.sent_count.toLocaleString()}</p>
                      <p className="text-xs text-slate-500">sent</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Chatbot stats */}
        {chatbotStats.length > 0 ? (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-slate-900">🤖 Chatbot Performance</h3>
              <Link href="/dashboard/chatbot" className="text-xs text-blue-600 hover:text-blue-500">Manage →</Link>
            </div>
            <div className="space-y-3">
              {chatbotStats.map(flow => {
                const max = Math.max(...chatbotStats.map(f => f.trigger_count), 1)
                return (
                  <div key={flow.name} className="flex items-center gap-3">
                    <div className={clsx('w-2 h-2 rounded-full flex-shrink-0', flow.is_active ? 'bg-brand-500' : 'bg-slate-200')} />
                    <p className="text-sm text-slate-700 flex-1 truncate">{flow.name}</p>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 bg-[#F8FAFC] rounded-full w-16">
                        <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(flow.trigger_count / max) * 100}%` }} />
                      </div>
                      <span className="text-xs text-slate-400 w-16 text-right">{flow.trigger_count} triggers</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="card">
            <h3 className="font-display font-semibold text-slate-900 mb-3">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: '/dashboard/campaigns', icon: '📢', label: 'New Campaign' },
                { href: '/dashboard/contacts', icon: '👥', label: 'Add Contacts' },
                { href: '/dashboard/chatbot', icon: '🤖', label: 'Build Chatbot' },
                { href: '/dashboard/instances', icon: '📱', label: 'Connect WA' },
              ].map(a => (
                <Link key={a.href} href={a.href} className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 hover:border-blue-200 hover:bg-blue-50/10 transition-colors">
                  <span className="text-xl">{a.icon}</span>
                  <span className="text-sm text-slate-700">{a.label}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
