import React, { useEffect, useMemo, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { useMutation, useQuery, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  CheckCircleIcon, EllipsisHorizontalIcon, EyeIcon, FunnelIcon, NoSymbolIcon, ShieldCheckIcon, UserGroupIcon, XMarkIcon,
} from '@heroicons/react/24/outline'
import {
  Avatar, Badge, Button, Card, ConfirmDialog, DataTable, Dropdown, EmptyState, PageHeader, SearchInput, Select, StatusPill,
} from '@/components/ui'
import type { Column } from '@/components/ui'
import { useAuthStore } from '@/lib/store'
import { useApiError, useAdminT } from '@/components/admin/i18n'
import { ErrorState, Pagination } from '@/components/admin/shared'
import { UserDrawer } from '@/components/admin/users/UserDrawer'
import type { AdminPlanRef, AdminUser, UserUpdateBody } from '@/components/admin/users/types'
import messages from '@/locales/admin/users'

const PAGE = 20

function useDebounced<T>(value: T, delay = 400) {
  const [v, setV] = useState(value)
  useEffect(() => { const id = setTimeout(() => setV(value), delay); return () => clearTimeout(id) }, [value, delay])
  return v
}

export default function AdminUsersPage() {
  const { t, fmtDate, fmtNumber, tn } = useAdminT(messages)
  const apiError = useApiError()
  const qc = useQueryClient()
  const me = useAuthStore(s => s.user)
  const [rawSearch, setRawSearch] = useState('')
  const search = useDebounced(rawSearch)
  const [page, setPage] = useState(1)
  const [planF, setPlanF] = useState('all')
  const [statusF, setStatusF] = useState('all')
  const [roleF, setRoleF] = useState('all')
  const [selected, setSelected] = useState<AdminUser | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [quick, setQuick] = useState<null | { user: AdminUser; action: 'suspend' | 'activate' }>(null)

  useEffect(() => { setPage(1) }, [search, planF, statusF, roleF])
  const filtering = planF !== 'all' || statusF !== 'all' || roleF !== 'all'
  const limit = PAGE

  // Search, filters and pagination all run on the server.
  const { data, isLoading, isError, refetch, isFetching } = useQuery<{ users: AdminUser[]; total: number }>(
    ['admin-users', search, planF, statusF, roleF, page, limit],
    () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (search) params.set('q', search)
      if (planF !== 'all') params.set('plan_id', planF)
      if (statusF !== 'all') params.set('status', statusF)
      if (roleF !== 'all') params.set('role', roleF)
      return axios.get(`/api/admin/users?${params.toString()}`).then(r => r.data)
    },
    { keepPreviousData: true },
  )
  const { data: plansData } = useQuery<{ plans: AdminPlanRef[] }>('admin-plans-list', () => axios.get('/api/admin/plans').then(r => r.data))
  const plans = plansData?.plans || []

  const rows = useMemo(() => data?.users || [], [data])

  const updateMut = useMutation(
    ({ id, body }: { id: string; body: UserUpdateBody; label: string }) => axios.put(`/api/admin/users/${id}`, body).then(r => r.data as { user?: Partial<AdminUser>; notes?: string[] }),
    {
      onMutate: () => setSaveError(null),
      onSuccess: (res, vars) => {
        qc.invalidateQueries('admin-users')
        qc.invalidateQueries(['admin-user-detail', vars.id])
        toast.success(vars.label)
        for (const n of res?.notes || []) toast(n)
        if (res?.user && selected?.id === vars.id) {
          const merged = { ...selected, ...res.user } as AdminUser
          merged.plans = merged.plan_id ? (plans.find(p => p.id === merged.plan_id) || selected.plans || null) : null
          setSelected(merged)
        }
      },
      onError: (e) => {
        const msg = apiError(e, t('updateFailed'))
        setSaveError(msg)
        toast.error(msg)
      },
    },
  )
  const save = (id: string, body: UserUpdateBody, label: string) => updateMut.mutateAsync({ id, body, label })

  const planOptions = [
    { value: 'all', label: t('allPlans') },
    { value: 'free', label: t('free') },
    ...plans.map(p => ({ value: p.id, label: p.name })),
  ]

  const columns: Column<AdminUser>[] = [
    {
      key: 'user', header: t('user'),
      cell: u => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={u.name || u.email} size="sm" />
          <div className="min-w-0">
            <p className="max-w-[220px] truncate font-medium text-ink">{u.name || '—'}</p>
            <p dir="ltr" className="max-w-[220px] truncate text-start text-xs text-muted">{u.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'plan', header: t('plan'), cell: u => <Badge tone={u.plans?.name ? 'brand' : 'neutral'}>{u.plans?.name || t('free')}</Badge> },
    { key: 'expires', header: t('expires'), hideBelow: 'md', cell: u => <span className="tabular text-xs text-muted">{u.plan_expires_at ? fmtDate(u.plan_expires_at) : '—'}</span> },
    {
      key: 'role', header: t('role'), hideBelow: 'sm',
      cell: u => <Badge tone={u.role === 'admin' ? 'violet' : 'neutral'} icon={u.role === 'admin' ? ShieldCheckIcon : undefined}>{u.role === 'admin' ? t('admin') : t('user2')}</Badge>,
    },
    { key: 'status', header: t('status'), cell: u => <StatusPill status={u.is_active !== false ? 'active' : 'blocked'}>{u.is_active !== false ? t('active') : t('suspended')}</StatusPill> },
    { key: 'joined', header: t('joined'), hideBelow: 'lg', cell: u => <span className="tabular text-xs text-muted">{fmtDate(u.created_at)}</span> },
    {
      key: 'actions', header: <span className="sr-only">{t('actions')}</span>, align: 'end',
      cell: u => (
        <div onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
          <Dropdown
            label={t('actions2', { email: u.email })}
            triggerClassName="h-9 w-9 justify-center rounded-xl hover:bg-surface-3"
            trigger={<EllipsisHorizontalIcon className="h-5 w-5" />}
            items={[
              { label: t('viewEdit'), icon: EyeIcon, onClick: () => { setSaveError(null); setSelected(u) } },
              u.is_active !== false
                ? { label: t('suspend'), icon: NoSymbolIcon, danger: true, divider: true, disabled: u.id === me?.id, onClick: () => setQuick({ user: u, action: 'suspend' }) }
                : { label: t('activate'), icon: CheckCircleIcon, divider: true, onClick: () => setQuick({ user: u, action: 'activate' }) },
            ]}
          />
        </div>
      ),
    },
  ]

  const clearFilters = () => { setPlanF('all'); setStatusF('all'); setRoleF('all') }

  return (
    <AdminLayout title={t('usersAlt')}>
      <PageHeader className="mb-6"
        eyebrow={t('administration')}
        title={t('usersAlt')}
        description={t('findAnyAccountAssign')}
        actions={<Badge tone="neutral" size="md" className="tabular">{tn('userCount', data?.total ?? 0, { n: fmtNumber(data?.total ?? 0) })}</Badge>}
      />

      <Card padding="none">
        <div className="flex flex-col gap-3 border-b border-line-soft p-4 lg:flex-row lg:items-center">
          <SearchInput value={rawSearch} onChange={setRawSearch} placeholder={t('searchNameEmail')} size="sm" wrapperClassName="lg:max-w-sm lg:flex-1" />
          <div className="flex flex-wrap items-center gap-2">
            <FunnelIcon className="hidden h-4 w-4 text-muted sm:block" aria-hidden="true" />
            <Select size="sm" aria-label={t('filterPlan')} value={planF} onChange={e => setPlanF(e.target.value)} options={planOptions} className="min-w-[140px]" />
            <Select size="sm" aria-label={t('filterStatus')} value={statusF} onChange={e => setStatusF(e.target.value)} className="min-w-[120px]"
              options={[{ value: 'all', label: t('allStatuses') }, { value: 'active', label: t('active') }, { value: 'suspended', label: t('suspended') }]} />
            <Select size="sm" aria-label={t('filterRole')} value={roleF} onChange={e => setRoleF(e.target.value)} className="min-w-[120px]"
              options={[{ value: 'all', label: t('allRoles') }, { value: 'user', label: t('user2') }, { value: 'admin', label: t('admin') }]} />
            {filtering && <Button size="sm" variant="ghost" icon={XMarkIcon} onClick={clearFilters}>{t('clear')}</Button>}
          </div>
        </div>

        {isError ? <div className="p-4"><ErrorState onRetry={() => refetch()} /></div> : (
          <div className={isFetching && !isLoading ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
            <DataTable
              rows={rows}
              loading={isLoading}
              skeletonRows={8}
              rowKey={u => u.id}
              columns={columns}
              minWidth={720}
              caption={t('usersList')}
              onRowClick={u => { setSaveError(null); setSelected(u) }}
              empty={<EmptyState size="sm" icon={UserGroupIcon}
                title={search || filtering ? t('noMatchingUsers') : t('noUsersYet')}
                description={search || filtering ? t('tryAnotherSearchClear') : undefined}
                action={(search || filtering) ? <Button size="sm" variant="secondary" onClick={() => { setRawSearch(''); clearFilters() }}>{t('clearSearch')}</Button> : undefined} />}
            />
          </div>
        )}
        <Pagination page={page} total={data?.total || 0} pageSize={limit} onChange={setPage} />
      </Card>

      <UserDrawer
        user={selected}
        plans={plans}
        onClose={() => setSelected(null)}
        onSave={save}
        saving={updateMut.isLoading}
        error={saveError}
        isSelf={!!selected && selected.id === me?.id}
      />

      <ConfirmDialog
        open={!!quick}
        destructive={quick?.action === 'suspend'}
        onClose={() => setQuick(null)}
        loading={updateMut.isLoading}
        title={quick?.action === 'suspend' ? t('suspendUser') : t('activateUser')}
        description={quick ? (quick.action === 'suspend'
          ? t('willBlockedSigningSigned', { email: quick.user.email })
          : quick.user.email) : undefined}
        confirmLabel={quick?.action === 'suspend' ? t('suspend2') : t('activate2')}
        onConfirm={() => {
          if (!quick) return
          const active = quick.action === 'activate'
          save(quick.user.id, { is_active: active }, active ? t('userActivated') : t('userSuspended'))
            .then(() => setQuick(null), () => setQuick(null))
        }}
      />
    </AdminLayout>
  )
}
