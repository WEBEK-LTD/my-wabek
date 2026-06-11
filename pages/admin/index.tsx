// @ts-nocheck
import AdminLayout from '@/components/layout/AdminLayout'
import { useQuery } from 'react-query'
import axios from 'axios'
import { Bar, Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend } from 'chart.js'
import { UserGroupIcon, ChatBubbleLeftRightIcon, CreditCardIcon, DevicePhoneMobileIcon, CpuChipIcon, MegaphoneIcon } from '@heroicons/react/24/outline'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend)

export default function AdminDashboard() {
  const { data, isLoading } = useQuery('admin-stats', () => axios.get('/api/admin/stats').then(r => r.data))
  const stats = data?.stats || {}
  const planDist = data?.plan_distribution || []
  const signups = data?.daily_signups || []

  const statCards = [
    { label: 'Total Users', value: (stats.total_users || 0).toLocaleString(), sub: `${stats.new_users_this_month || 0} new this month`, icon: UserGroupIcon, color: 'text-blue-600' },
    { label: 'MRR', value: `$${(stats.mrr || 0).toLocaleString()}`, sub: `${stats.active_subscriptions || 0} active subs`, icon: CreditCardIcon, color: 'text-yellow-400' },
    { label: 'Messages', value: (stats.total_messages || 0).toLocaleString(), sub: `${(stats.messages_this_month || 0).toLocaleString()} this month`, icon: ChatBubbleLeftRightIcon, color: 'text-blue-400' },
    { label: 'WA Instances', value: `${stats.connected_instances || 0}/${stats.total_instances || 0}`, sub: 'connected/total', icon: DevicePhoneMobileIcon, color: 'text-green-400' },
    { label: 'Total Contacts', value: (stats.total_contacts || 0).toLocaleString(), sub: 'across all users', icon: UserGroupIcon, color: 'text-purple-400' },
    { label: 'Campaigns', value: (stats.total_campaigns || 0).toLocaleString(), sub: 'created total', icon: MegaphoneIcon, color: 'text-orange-400' },
    { label: 'Chatbot Flows', value: (stats.total_chatbots || 0).toLocaleString(), sub: 'total created', icon: CpuChipIcon, color: 'text-pink-400' },
    { label: 'Active Users', value: (stats.active_users || 0).toLocaleString(), sub: `${Math.round((stats.active_users / Math.max(stats.total_users, 1)) * 100)}% of total`, icon: UserGroupIcon, color: 'text-cyan-400' },
  ]

  const barData = {
    labels: signups.map(d => d.date?.slice(5) || ''),
    datasets: [{ label: 'Signups', data: signups.map(d => d.count), backgroundColor: 'rgba(0,212,106,0.7)', borderRadius: 4 }],
  }

  const doughnutData = {
    labels: planDist.map(p => p.plan),
    datasets: [{ data: planDist.map(p => p.count), backgroundColor: ['#00D46A', '#3B82F6', '#A855F7', '#F59E0B'], borderWidth: 0 }],
  }

  return (
    <AdminLayout title="Dashboard">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {statCards.map(s => (
          <div key={s.label} className="stat-card">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
            <p className="text-2xl font-display font-bold text-slate-900">{isLoading ? '—' : s.value}</p>
            <p className="text-xs text-slate-600 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* Signups chart */}
        <div className="lg:col-span-2 card">
          <h3 className="font-display font-semibold text-slate-900 mb-4">New Signups — Last 7 Days</h3>
          <div className="h-48">
            {!isLoading && <Bar data={barData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: '#E2E8F0' }, ticks: { color: '#64748B' } }, y: { grid: { color: '#E2E8F0' }, ticks: { color: '#64748B' }, beginAtZero: true } } }} />}
            {isLoading && <div className="skeleton w-full h-full rounded-lg" />}
          </div>
        </div>

        {/* Plan distribution */}
        <div className="card">
          <h3 className="font-display font-semibold text-slate-900 mb-4">Plan Distribution</h3>
          <div className="h-36 flex items-center justify-center">
            {!isLoading && planDist.length > 0 && <Doughnut data={doughnutData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: '65%' }} />}
          </div>
          <div className="mt-3 space-y-1">
            {planDist.map((p, i) => (
              <div key={p.plan} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: ['#00D46A','#3B82F6','#A855F7','#F59E0B'][i] }} />
                  <span className="text-slate-400">{p.plan}</span>
                </div>
                <span className="text-slate-900 font-medium">{p.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent logs */}
      {data?.recent_logs?.length > 0 && (
        <div className="card">
          <h3 className="font-display font-semibold text-slate-900 mb-4">Recent Activity</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-slate-200">
                {['Action', 'User', 'Time'].map(h => <th key={h} className="table-head">{h}</th>)}
              </tr></thead>
              <tbody>
                {data.recent_logs.slice(0, 10).map(log => (
                  <tr key={log.id} className="table-row">
                    <td className="table-cell"><span className="badge-gray text-xs">{log.action}</span></td>
                    <td className="table-cell text-slate-400 font-mono text-xs">{log.user_id?.slice(0, 8)}…</td>
                    <td className="table-cell text-slate-500 text-xs">{new Date(log.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
