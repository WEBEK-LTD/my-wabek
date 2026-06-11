// @ts-nocheck
import { useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { BellIcon, CheckCircleIcon, TrashIcon } from '@heroicons/react/24/outline'
import { formatDistanceToNow } from 'date-fns'
import clsx from 'clsx'

const TYPE_CONFIG = {
  info:      { icon: 'ℹ️', color: 'text-blue-400',   bg: 'bg-blue-900/20' },
  success:   { icon: '✅', color: 'text-blue-600',  bg: 'bg-blue-50/20' },
  warning:   { icon: '⚠️', color: 'text-yellow-400', bg: 'bg-yellow-900/20' },
  error:     { icon: '❌', color: 'text-red-400',    bg: 'bg-red-900/20' },
  message:   { icon: '💬', color: 'text-purple-400', bg: 'bg-purple-900/20' },
  campaign:  { icon: '📢', color: 'text-orange-400', bg: 'bg-orange-900/20' },
  system:    { icon: '⚙️', color: 'text-slate-400',   bg: 'bg-[#F8FAFC]/20' },
}

export default function NotificationsPage() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState('all')

  const { data, isLoading } = useQuery('notifications-all',
    () => axios.get('/api/notifications?limit=100').then(r => r.data))
  const notifications = data?.notifications || []

  const markAllMut = useMutation(
    () => axios.put('/api/notifications', { action: 'mark_all_read' }),
    { onSuccess: () => { qc.invalidateQueries('notifications-all'); qc.invalidateQueries('notifications'); toast.success('All marked as read') } }
  )

  const markOneMut = useMutation(
    (id) => axios.put(`/api/notifications`, { action: 'mark_read', id }),
    { onSuccess: () => { qc.invalidateQueries('notifications-all'); qc.invalidateQueries('notifications') } }
  )

  const filtered = filter === 'unread'
    ? notifications.filter(n => !n.is_read)
    : filter === 'all' ? notifications
    : notifications.filter(n => n.type === filter)

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <DashboardLayout title="Notifications">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <p className="text-slate-400 text-sm">{unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={() => markAllMut.mutate()} disabled={markAllMut.isLoading}
            className="btn-secondary text-sm">
            <CheckCircleIcon className="w-4 h-4" /> Mark all as read
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { key: 'all', label: 'All' },
          { key: 'unread', label: `Unread (${unreadCount})` },
          { key: 'message', label: '💬 Messages' },
          { key: 'campaign', label: '📢 Campaigns' },
          { key: 'success', label: '✅ Success' },
          { key: 'warning', label: '⚠️ Warnings' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={clsx('text-xs px-3 py-1.5 rounded-lg transition-colors font-medium',
              filter === f.key ? 'bg-brand-500 text-white' : 'bg-[#F8FAFC] text-slate-400 hover:text-white')}>
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <BellIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-900 font-semibold mb-1">No notifications</p>
          <p className="text-slate-500 text-sm">You're all caught up!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(n => {
            const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.info
            return (
              <div key={n.id} onClick={() => { if (!n.is_read) markOneMut.mutate(n.id); if (n.link) window.location.href = n.link }}
                className={clsx('card cursor-pointer hover:border-wabek-muted transition-all flex items-start gap-3',
                  !n.is_read && 'border-l-2 border-l-brand-500')}>
                <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm', cfg.bg)}>
                  {cfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={clsx('text-sm font-medium', n.is_read ? 'text-slate-700' : 'text-slate-900')}>{n.title}</p>
                    <span className="text-xs text-slate-500 flex-shrink-0">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  {n.body && <p className="text-xs text-slate-500 mt-0.5 truncate">{n.body}</p>}
                </div>
                {!n.is_read && <div className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0 mt-1.5" />}
              </div>
            )
          })}
        </div>
      )}
    </DashboardLayout>
  )
}
