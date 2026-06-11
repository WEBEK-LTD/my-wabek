// @ts-nocheck
import { useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { useQuery } from 'react-query'
import axios from 'axios'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'

export default function AdminLogsPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery(
    ['admin-logs', search, page],
    () => axios.get(`/api/admin/logs?search=${encodeURIComponent(search)}&page=${page}`).then(r => r.data),
    { keepPreviousData: true }
  )
  const logs = data?.logs || []

  const actionColors: Record<string, string> = {
    login: 'badge-green', register: 'badge-green', login_failed: 'badge-red',
    create_instance: 'badge-yellow', delete_instance: 'badge-red',
    admin_update_user: 'badge-yellow', admin_suspend_user: 'badge-red',
  }

  return (
    <AdminLayout title="System Logs">
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Filter by action…" className="input pl-9" />
        </div>
        <div className="text-sm text-slate-400 flex items-center">{data?.total || 0} total entries</div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-[#F8FAFC]/50">
              <tr>
                <th className="table-head">Time</th>
                <th className="table-head">Action</th>
                <th className="table-head">User ID</th>
                <th className="table-head">Resource</th>
                <th className="table-head">IP Address</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-200">
                  {Array.from({ length: 5 }).map((_, j) => <td key={j} className="table-cell"><div className="h-4 skeleton rounded w-24" /></td>)}
                </tr>
              )) : logs.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-slate-500">No logs found</td></tr>
              ) : logs.map((log: { id: string; action: string; user_id: string | null; resource: string | null; resource_id: string | null; ip_address: string | null; created_at: string }) => (
                <tr key={log.id} className="table-row">
                  <td className="table-cell text-xs font-mono text-slate-400">{format(new Date(log.created_at), 'MMM d, HH:mm:ss')}</td>
                  <td className="table-cell">
                    <span className={actionColors[log.action] || 'badge-gray'}>{log.action}</span>
                  </td>
                  <td className="table-cell font-mono text-xs">{log.user_id ? log.user_id.slice(0, 12) + '…' : '—'}</td>
                  <td className="table-cell text-xs">
                    {log.resource ? <span className="text-slate-700">{log.resource}{log.resource_id ? `:${log.resource_id.slice(0, 8)}` : ''}</span> : '—'}
                  </td>
                  <td className="table-cell font-mono text-xs">{log.ip_address || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data?.total > 50 && (
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-50">Previous</button>
            <span className="text-sm text-slate-400">Page {page} of {Math.ceil((data?.total || 0) / 50)}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={logs.length < 50} className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-50">Next</button>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
