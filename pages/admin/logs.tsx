// @ts-nocheck
import { useState, useRef } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { useQuery } from 'react-query'
import axios from 'axios'
import { MagnifyingGlassIcon, XMarkIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import clsx from 'clsx'

const ACTION_COLORS: Record<string, string> = {
  login:               'badge-green',
  register:            'badge-green',
  login_failed:        'badge-red',
  logout:              'badge-gray',
  create_instance:     'badge-yellow',
  delete_instance:     'badge-red',
  connect_instance:    'badge-green',
  disconnect_instance: 'badge-red',
  send_message:        'badge-yellow',
  create_campaign:     'badge-yellow',
  delete_campaign:     'badge-red',
  create_contact:      'badge-yellow',
  delete_contact:      'badge-red',
  create_chatbot:      'badge-yellow',
  admin_update_user:   'badge-yellow',
  admin_suspend_user:  'badge-red',
  update_profile:      'badge-gray',
  change_password:     'badge-yellow',
  update_otp:          'badge-yellow',
}

// Debounce hook
function useDebounce(delay = 400) {
  const timer = useRef<any>(null)
  return (fn: () => void) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(fn, delay)
  }
}

export default function AdminLogsPage() {
  const [mode, setMode]               = useState<'system' | 'user'>('system')
  const [search, setSearch]           = useState('')
  const [dSearch, setDSearch]         = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [dateFrom, setDateFrom]       = useState('')
  const [dateTo, setDateTo]           = useState('')
  const [page, setPage]               = useState(1)
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string | null; email: string } | null>(null)
  const [showUserSuggest, setShowUserSuggest] = useState(false)
  const [expandedLog, setExpandedLog] = useState<string | null>(null)
  const debounce = useDebounce(400)

  const handleSearch = (v: string) => {
    setSearch(v)
    debounce(() => { setDSearch(v); setPage(1) })
  }

  const params: Record<string, string> = {
    mode,
    page: String(page),
    search: dSearch,
    action_filter: actionFilter,
  }
  if (dateFrom)              params.date_from = dateFrom
  if (dateTo)                params.date_to   = dateTo
  if (mode === 'user' && selectedUser) params.user_id = selectedUser.id

  const { data, isLoading } = useQuery(
    ['admin-logs', mode, dSearch, actionFilter, dateFrom, dateTo, page, selectedUser?.id],
    () => axios.get('/api/admin/logs', { params }).then(r => r.data),
    { keepPreviousData: true }
  )

  const logs            = data?.logs || []
  const actions         = data?.actions || []
  const userSuggestions = data?.userSuggestions || []

  const clearFilters = () => {
    setSearch(''); setDSearch(''); setActionFilter('all')
    setDateFrom(''); setDateTo(''); setSelectedUser(null); setPage(1)
  }

  const hasFilters = dSearch || actionFilter !== 'all' || dateFrom || dateTo || selectedUser

  return (
    <AdminLayout title="Logs">

      {/* Mode Tabs */}
      <div className="flex gap-1 p-1 bg-[#F8FAFC] rounded-xl border border-slate-200 w-fit mb-5">
        {[
          { id: 'system', label: '🖥️ System Logs' },
          { id: 'user',   label: '👤 User Activity' },
        ].map(t => (
          <button key={t.id} onClick={() => { setMode(t.id as any); setPage(1); setSelectedUser(null); setSearch(''); setDSearch('') }}
            className={clsx('px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              mode === t.id ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-900'
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">

        {/* Search / User picker */}
        <div className="relative flex-1 min-w-48 max-w-xs">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          {mode === 'system' ? (
            <input value={search} onChange={e => handleSearch(e.target.value)}
              placeholder="Search action, IP, resource…" className="input pl-9 w-full" />
          ) : selectedUser ? (
            <div className="input pl-9 flex items-center justify-between">
              <span className="text-sm truncate">{selectedUser.name || selectedUser.email}</span>
              <button onClick={() => { setSelectedUser(null); setSearch(''); setDSearch('') }} className="ml-2 text-slate-400 hover:text-slate-700">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <input value={search} onChange={e => { handleSearch(e.target.value); setShowUserSuggest(true) }}
                onFocus={() => setShowUserSuggest(true)}
                placeholder="Search user by name or email…" className="input pl-9 w-full" />
              {showUserSuggest && userSuggestions.length > 0 && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg z-20">
                  {userSuggestions.map(u => (
                    <button key={u.id} onClick={() => { setSelectedUser(u); setSearch(''); setDSearch(''); setShowUserSuggest(false); setPage(1) }}
                      className="w-full text-left px-4 py-2.5 hover:bg-[#F8FAFC] text-sm border-b border-slate-100 last:border-0">
                      <p className="font-medium text-slate-900">{u.name || '—'}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Action filter */}
        <div className="relative">
          <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1) }}
            className="input pr-8 appearance-none min-w-36">
            <option value="all">All actions</option>
            {actions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <ChevronDownIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>

        {/* Date range */}
        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }}
          className="input text-sm" placeholder="From" />
        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }}
          className="input text-sm" placeholder="To" />

        {/* Clear */}
        {hasFilters && (
          <button onClick={clearFilters} className="btn-secondary text-sm flex items-center gap-1.5">
            <XMarkIcon className="w-4 h-4" /> Clear
          </button>
        )}

        <div className="text-sm text-slate-400 flex items-center ml-auto">{data?.total || 0} entries</div>
      </div>

      {/* Selected user banner */}
      {mode === 'user' && selectedUser && (
        <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600">
            {(selectedUser.name || selectedUser.email)[0].toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">{selectedUser.name || '—'}</p>
            <p className="text-xs text-slate-500">{selectedUser.email}</p>
          </div>
          <span className="ml-auto text-xs text-blue-500">{data?.total || 0} activity records</span>
        </div>
      )}

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-[#F8FAFC]/50">
              <tr>
                <th className="table-head">Time</th>
                <th className="table-head">Action</th>
                {mode === 'system' && <th className="table-head">User</th>}
                <th className="table-head">Resource</th>
                <th className="table-head">IP</th>
                <th className="table-head w-8"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-200">
                  {Array.from({ length: mode === 'system' ? 6 : 5 }).map((_, j) => (
                    <td key={j} className="table-cell"><div className="h-4 skeleton rounded w-24" /></td>
                  ))}
                </tr>
              )) : logs.length === 0 ? (
                <tr><td colSpan={mode === 'system' ? 6 : 5} className="text-center py-12 text-slate-500">
                  {mode === 'user' && !selectedUser ? 'Search for a user to see their activity' : 'No logs found'}
                </td></tr>
              ) : logs.map(log => (
                <>
                  <tr key={log.id} className={clsx('table-row cursor-pointer', expandedLog === log.id && 'bg-blue-50/20')}
                    onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}>
                    <td className="table-cell text-xs font-mono text-slate-400 whitespace-nowrap">
                      {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                    </td>
                    <td className="table-cell">
                      <span className={clsx('text-xs px-2 py-0.5 rounded font-medium', ACTION_COLORS[log.action] || 'badge-gray')}>
                        {log.action}
                      </span>
                    </td>
                    {mode === 'system' && (
                      <td className="table-cell">
                        {log.users ? (
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-700 truncate max-w-28">{log.users.name || '—'}</p>
                            <p className="text-[10px] text-slate-400 truncate max-w-28">{log.users.email}</p>
                          </div>
                        ) : <span className="text-xs text-slate-300">System</span>}
                      </td>
                    )}
                    <td className="table-cell text-xs text-slate-500">
                      {log.resource
                        ? <span>{log.resource}{log.resource_id ? <span className="text-slate-300 font-mono"> :{log.resource_id.slice(0, 8)}</span> : ''}</span>
                        : '—'}
                    </td>
                    <td className="table-cell font-mono text-xs text-slate-400">{log.ip_address || '—'}</td>
                    <td className="table-cell text-slate-300 text-xs">{log.details ? '▾' : ''}</td>
                  </tr>
                  {/* Expanded details row */}
                  {expandedLog === log.id && log.details && (
                    <tr key={log.id + '-detail'} className="bg-slate-50 border-b border-slate-200">
                      <td colSpan={mode === 'system' ? 6 : 5} className="px-4 py-3">
                        <pre className="text-xs text-slate-600 font-mono whitespace-pre-wrap break-all bg-white border border-slate-200 rounded-lg p-3 max-h-40 overflow-y-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {(data?.total || 0) > 50 && (
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-50">← Previous</button>
            <span className="text-sm text-slate-400">Page {page} of {Math.ceil((data?.total || 0) / 50)}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={logs.length < 50}
              className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-50">Next →</button>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
