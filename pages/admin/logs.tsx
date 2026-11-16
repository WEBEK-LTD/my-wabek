import React, { useEffect, useRef, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { useQuery } from 'react-query'
import axios from 'axios'
import {
  ClipboardDocumentListIcon, CodeBracketIcon, ComputerDesktopIcon, MagnifyingGlassIcon, UserIcon, XMarkIcon,
} from '@heroicons/react/24/outline'
import {
  Avatar, Badge, Button, Card, DataTable, EmptyState, Input, PageHeader, SearchInput, Select, Tabs, cn,
} from '@/components/ui'
import type { Column, Tone } from '@/components/ui'
import { useAdminT } from '@/components/admin/i18n'
import { Drawer, ErrorState, InfoTile, JsonViewer, Pagination } from '@/components/admin/shared'
import type { AdminLog } from '@/components/admin/useAdminStats'
import messages from '@/locales/admin/logs'

const PAGE = 50
type PickedUser = { id: string; name: string | null; email: string }

function actionTone(a: string): Tone {
  if (/fail|delete|suspend|disconnect|revoke|reject|error/.test(a)) return 'danger'
  if (/^admin_/.test(a)) return 'violet'
  if (/login|register|connect|approve|create/.test(a)) return 'success'
  if (/update|change|send|record/.test(a)) return 'warning'
  return 'neutral'
}

export default function AdminLogsPage() {
  const { t, fmtDateTime, fmtNumber, tn } = useAdminT(messages)
  const [mode, setMode] = useState<'system' | 'user'>('system')
  const [search, setSearch] = useState('')
  const [dSearch, setDSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [selectedUser, setSelectedUser] = useState<PickedUser | null>(null)
  const [showSuggest, setShowSuggest] = useState(false)
  const [detail, setDetail] = useState<AdminLog | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  const handleSearch = (v: string) => {
    setSearch(v)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => { setDSearch(v); setPage(1) }, 400)
  }
  useEffect(() => () => clearTimeout(timer.current), [])

  const params: Record<string, string> = { mode, page: String(page), search: dSearch, action_filter: actionFilter }
  if (dateFrom) params.date_from = dateFrom
  if (dateTo) params.date_to = dateTo
  if (mode === 'user' && selectedUser) params.user_id = selectedUser.id

  const { data, isLoading, isError, refetch, isFetching } = useQuery<{ logs: AdminLog[]; total: number; actions: string[]; userSuggestions: PickedUser[] }>(
    ['admin-logs', mode, dSearch, actionFilter, dateFrom, dateTo, page, selectedUser?.id],
    () => axios.get('/api/admin/logs', { params }).then(r => r.data),
    { keepPreviousData: true },
  )
  const logs = data?.logs || []
  const actions = data?.actions || []
  const suggestions = data?.userSuggestions || []

  const clearFilters = () => { setSearch(''); setDSearch(''); setActionFilter('all'); setDateFrom(''); setDateTo(''); setSelectedUser(null); setPage(1) }
  const hasFilters = !!(dSearch || actionFilter !== 'all' || dateFrom || dateTo || selectedUser)
  const switchMode = (m: string) => { setMode(m as 'system' | 'user'); setPage(1); setSelectedUser(null); setSearch(''); setDSearch('') }

  const cols: Column<AdminLog>[] = [
    { key: 'time', header: t('time'), cell: l => <span className="tabular whitespace-nowrap font-mono text-xs text-muted" dir="ltr">{fmtDateTime(l.created_at)}</span> },
    { key: 'action', header: t('action'), cell: l => <Badge tone={actionTone(l.action)} size="sm"><span dir="ltr" className="font-mono">{l.action}</span></Badge> },
    {
      key: 'user', header: t('user'),
      cell: l => l.users ? (
        <div className="min-w-0"><p className="max-w-[160px] truncate text-xs font-medium text-ink">{l.users.name || '—'}</p><p dir="ltr" className="max-w-[160px] truncate text-start text-2xs text-muted">{l.users.email}</p></div>
      ) : <span className="text-xs text-muted">{t('system')}</span>,
    },
    {
      key: 'res', header: t('resource'), hideBelow: 'md',
      cell: l => l.resource ? <span className="text-xs text-body">{l.resource}{l.resource_id && <span dir="ltr" className="font-mono text-muted"> :{l.resource_id.slice(0, 8)}</span>}</span> : <span className="text-muted">—</span>,
    },
    { key: 'ip', header: 'IP', hideBelow: 'lg', cell: l => <span dir="ltr" className="font-mono text-xs text-muted">{l.ip_address || '—'}</span> },
    { key: 'd', header: <span className="sr-only">{t('details')}</span>, align: 'end', cell: l => l.details ? <CodeBracketIcon className="ms-auto h-4 w-4 text-brand-ink" aria-label={t('hasDetails')} /> : null },
  ]

  return (
    <AdminLayout title={t('logs')}>
      <PageHeader className="mb-6"
        eyebrow={t('monitoring')}
        title={t('systemLogs')}
        description={t('everySignificantActionPlatform')}
        actions={<Badge tone="neutral" className="tabular">{tn('entryCount', data?.total ?? 0, { n: fmtNumber(data?.total ?? 0) })}</Badge>}
      >
        <Tabs idPrefix="logs" value={mode} onChange={switchMode} tabs={[
          { id: 'system', label: t('systemLogs'), icon: ComputerDesktopIcon },
          { id: 'user', label: t('userActivity'), icon: UserIcon },
        ]} />
      </PageHeader>

      <Card padding="none">
        <div className="flex flex-col gap-3 border-b border-line-soft p-4 xl:flex-row xl:items-center">
          <div className="relative xl:w-80">
            {mode === 'system' ? (
              <SearchInput size="sm" value={search} onChange={handleSearch} placeholder={t('searchActionIpResource')} />
            ) : selectedUser ? (
              <div className="flex h-9 items-center gap-2 rounded-field border border-brand-teal/40 bg-chip/40 px-2.5">
                <Avatar name={selectedUser.name || selectedUser.email} size="xs" />
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{selectedUser.name || selectedUser.email}</span>
                <button type="button" className="text-muted hover:text-ink" aria-label={t('clearUser')} onClick={() => { setSelectedUser(null); setSearch(''); setDSearch('') }}><XMarkIcon className="h-4 w-4" /></button>
              </div>
            ) : (
              <>
                <Input size="sm" icon={MagnifyingGlassIcon} value={search} role="combobox" aria-expanded={showSuggest && suggestions.length > 0} aria-controls="log-user-suggest" aria-autocomplete="list"
                  onChange={e => { handleSearch(e.target.value); setShowSuggest(true) }} onFocus={() => setShowSuggest(true)} onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
                  placeholder={t('findUserNameEmail')} aria-label={t('findUser')} />
                {showSuggest && suggestions.length > 0 && (
                  <ul id="log-user-suggest" role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-line bg-surface shadow-dropdown">
                    {suggestions.map(u => (
                      <li key={u.id} role="option" aria-selected={false}>
                        <button type="button" className="flex w-full items-center gap-2.5 px-3 py-2.5 text-start hover:bg-surface-2"
                          onMouseDown={e => e.preventDefault()} onClick={() => { setSelectedUser(u); setSearch(''); setDSearch(''); setShowSuggest(false); setPage(1) }}>
                          <Avatar name={u.name || u.email} size="xs" />
                          <span className="min-w-0"><span className="block truncate text-sm text-ink">{u.name || '—'}</span><span dir="ltr" className="block truncate text-start text-xs text-muted">{u.email}</span></span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select size="sm" aria-label={t('filterAction')} value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1) }} className="min-w-[170px]"
              options={[{ value: 'all', label: t('allActions') }, ...actions.map(a => ({ value: a, label: a }))]} />
            <Input size="sm" type="date" dir="ltr" aria-label={t('date')} value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }} wrapperClassName="w-40" />
            <span className="text-xs text-muted">—</span>
            <Input size="sm" type="date" dir="ltr" aria-label={t('date2')} value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }} wrapperClassName="w-40" />
            {hasFilters && <Button size="sm" variant="ghost" icon={XMarkIcon} onClick={clearFilters}>{t('clear')}</Button>}
          </div>
        </div>

        {mode === 'user' && selectedUser && (
          <div className="flex items-center gap-3 border-b border-line-soft bg-chip/30 px-4 py-3">
            <Avatar name={selectedUser.name || selectedUser.email} size="sm" />
            <div className="min-w-0 flex-1"><p className="text-sm font-medium text-ink">{selectedUser.name || '—'}</p><p dir="ltr" className="text-start text-xs text-muted">{selectedUser.email}</p></div>
            <Badge tone="brand" className="tabular">{tn('recordCount', data?.total ?? 0, { n: fmtNumber(data?.total ?? 0) })}</Badge>
          </div>
        )}

        {isError ? <div className="p-4"><ErrorState onRetry={() => refetch()} /></div> : (
          <div className={cn('transition-opacity', isFetching && !isLoading && 'opacity-70')}>
            <DataTable rows={logs} loading={isLoading} skeletonRows={10} rowKey={l => l.id} columns={cols} minWidth={720} dense caption={t('logs')}
              onRowClick={l => setDetail(l)}
              empty={<EmptyState size="sm" icon={mode === 'user' && !selectedUser ? UserIcon : ClipboardDocumentListIcon}
                title={mode === 'user' && !selectedUser ? t('searchUserSeeTheir') : t('noLogsFound')}
                action={hasFilters ? <Button size="sm" variant="secondary" onClick={clearFilters}>{t('clearFilters')}</Button> : undefined} />} />
          </div>
        )}
        <Pagination page={page} total={data?.total || 0} pageSize={PAGE} onChange={setPage} />
      </Card>

      <Drawer open={!!detail} onClose={() => setDetail(null)} width="lg" title={t('logEntry')}
        description={detail ? <span dir="ltr" className="font-mono">{detail.action}</span> : undefined}>
        {detail && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-2.5">
              <InfoTile label={t('time')} value={<span dir="ltr" className="tabular">{fmtDateTime(detail.created_at)}</span>} />
              <InfoTile label={t('action')} value={<Badge tone={actionTone(detail.action)} size="sm"><span dir="ltr" className="font-mono">{detail.action}</span></Badge>} />
              <InfoTile label={t('user')} value={detail.users ? <span>{detail.users.name || '—'} <span dir="ltr" className="block text-xs text-muted">{detail.users.email}</span></span> : t('system')} />
              <InfoTile label="IP" value={<span dir="ltr" className="font-mono text-xs">{detail.ip_address || '—'}</span>} />
              <InfoTile className="col-span-2" label={t('resource')} value={<span dir="ltr" className="break-all font-mono text-xs">{detail.resource || '—'}{detail.resource_id ? ` : ${detail.resource_id}` : ''}</span>} />
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-ink">{t('detailsJson')}</p>
              {detail.details ? <JsonViewer value={detail.details} maxHeight={480} /> : <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-sm text-muted">{t('noExtraDetails')}</p>}
            </div>
            {mode === 'system' && detail.users && (
              <Button variant="secondary" size="sm" icon={UserIcon} onClick={() => { const u = detail.users!; setMode('user'); setSelectedUser({ id: u.id, name: u.name, email: u.email }); setPage(1); setSearch(''); setDSearch(''); setDetail(null) }}>
                {t('showAllActivityUser')}
              </Button>
            )}
          </div>
        )}
      </Drawer>
    </AdminLayout>
  )
}
