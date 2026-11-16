import React, { useEffect, useMemo, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { useMutation, useQuery, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  CheckCircleIcon, EllipsisHorizontalIcon, EyeIcon, FunnelIcon, NoSymbolIcon, ShieldCheckIcon, UserGroupIcon, XMarkIcon,
} from '@heroicons/react/24/outline'
import {
  Avatar, Badge, Button, Card, ConfirmDialog, DataTable, Dropdown, EmptyState, PageHeader, SearchInput, Select, StatusPill, formatNumber,
} from '@/components/ui'
import type { Column } from '@/components/ui'
import { useAuthStore } from '@/lib/store'
import { apiError, useAdminT } from '@/components/admin/i18n'
import { ErrorState, Pagination } from '@/components/admin/shared'
import { UserDrawer } from '@/components/admin/users/UserDrawer'
import type { AdminPlanRef, AdminUser, UserUpdateBody } from '@/components/admin/users/types'

const PAGE = 20

function useDebounced<T>(value: T, delay = 400) {
  const [v, setV] = useState(value)
  useEffect(() => { const id = setTimeout(() => setV(value), delay); return () => clearTimeout(id) }, [value, delay])
  return v
}

export default function AdminUsersPage() {
  const { tr, fmtDate } = useAdminT()
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

  useEffect(() => { setPage(1) }, [search])
  const filtering = planF !== 'all' || statusF !== 'all' || roleF !== 'all'
  // The list API filters by search only; with other filters on, load a larger page and filter it here.
  const limit = filtering ? 100 : PAGE

  const { data, isLoading, isError, refetch, isFetching } = useQuery<{ users: AdminUser[]; total: number }>(
    ['admin-users', search, page, limit],
    () => axios.get(`/api/admin/users?search=${encodeURIComponent(search)}&page=${page}&limit=${limit}`).then(r => r.data),
    { keepPreviousData: true },
  )
  const { data: plansData } = useQuery<{ plans: AdminPlanRef[] }>('admin-plans-list', () => axios.get('/api/admin/plans').then(r => r.data))
  const plans = plansData?.plans || []

  const rows = useMemo(() => (data?.users || []).filter(u =>
    (planF === 'all' || (planF === 'free' ? !u.plan_id : u.plan_id === planF)) &&
    (statusF === 'all' || (statusF === 'active' ? u.is_active : !u.is_active)) &&
    (roleF === 'all' || u.role === roleF),
  ), [data, planF, statusF, roleF])

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
        const msg = apiError(e, tr('تعذّر تحديث المستخدم', 'Update failed'))
        setSaveError(msg)
        toast.error(msg)
      },
    },
  )
  const save = (id: string, body: UserUpdateBody, label: string) => updateMut.mutateAsync({ id, body, label })

  const planOptions = [
    { value: 'all', label: tr('كل الباقات', 'All plans') },
    { value: 'free', label: tr('مجانية', 'Free') },
    ...plans.map(p => ({ value: p.id, label: p.name })),
  ]

  const columns: Column<AdminUser>[] = [
    {
      key: 'user', header: tr('المستخدم', 'User'),
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
    { key: 'plan', header: tr('الباقة', 'Plan'), cell: u => <Badge tone={u.plans?.name ? 'brand' : 'neutral'}>{u.plans?.name || tr('مجانية', 'Free')}</Badge> },
    { key: 'expires', header: tr('تنتهي', 'Expires'), hideBelow: 'md', cell: u => <span className="tabular text-xs text-muted">{u.plan_expires_at ? fmtDate(u.plan_expires_at) : '—'}</span> },
    {
      key: 'role', header: tr('الدور', 'Role'), hideBelow: 'sm',
      cell: u => <Badge tone={u.role === 'admin' ? 'violet' : 'neutral'} icon={u.role === 'admin' ? ShieldCheckIcon : undefined}>{u.role === 'admin' ? tr('مدير', 'Admin') : tr('مستخدم', 'User')}</Badge>,
    },
    { key: 'status', header: tr('الحالة', 'Status'), cell: u => <StatusPill status={u.is_active ? 'active' : 'blocked'}>{u.is_active ? tr('نشط', 'Active') : tr('موقوف', 'Suspended')}</StatusPill> },
    { key: 'joined', header: tr('انضم', 'Joined'), hideBelow: 'lg', cell: u => <span className="tabular text-xs text-muted">{fmtDate(u.created_at)}</span> },
    {
      key: 'actions', header: <span className="sr-only">{tr('إجراءات', 'Actions')}</span>, align: 'end',
      cell: u => (
        <div onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
          <Dropdown
            label={tr(`إجراءات ${u.email}`, `Actions for ${u.email}`)}
            triggerClassName="h-9 w-9 justify-center rounded-xl hover:bg-surface-3"
            trigger={<EllipsisHorizontalIcon className="h-5 w-5" />}
            items={[
              { label: tr('عرض وتعديل', 'View & edit'), icon: EyeIcon, onClick: () => { setSaveError(null); setSelected(u) } },
              u.is_active
                ? { label: tr('إيقاف الحساب', 'Suspend'), icon: NoSymbolIcon, danger: true, divider: true, disabled: u.id === me?.id, onClick: () => setQuick({ user: u, action: 'suspend' }) }
                : { label: tr('تفعيل الحساب', 'Activate'), icon: CheckCircleIcon, divider: true, onClick: () => setQuick({ user: u, action: 'activate' }) },
            ]}
          />
        </div>
      ),
    },
  ]

  const clearFilters = () => { setPlanF('all'); setStatusF('all'); setRoleF('all') }

  return (
    <AdminLayout title={tr('المستخدمون', 'Users')}>
      <PageHeader className="mb-6"
        eyebrow={tr('الإدارة', 'Administration')}
        title={tr('المستخدمون', 'Users')}
        description={tr('ابحث عن أي حساب، وعيّن الباقات، وغيّر الأدوار، وأوقف الحسابات أو فعّلها.', 'Find any account, assign plans, change roles, and suspend or activate accounts.')}
        actions={<Badge tone="neutral" size="md" className="tabular">{tr(`${formatNumber(data?.total ?? 0)} مستخدم`, `${formatNumber(data?.total ?? 0)} users`)}</Badge>}
      />

      <Card padding="none">
        <div className="flex flex-col gap-3 border-b border-line-soft p-4 lg:flex-row lg:items-center">
          <SearchInput value={rawSearch} onChange={setRawSearch} placeholder={tr('ابحث بالاسم أو البريد الإلكتروني', 'Search by name or email')} size="sm" wrapperClassName="lg:max-w-sm lg:flex-1" />
          <div className="flex flex-wrap items-center gap-2">
            <FunnelIcon className="hidden h-4 w-4 text-muted sm:block" aria-hidden="true" />
            <Select size="sm" aria-label={tr('تصفية حسب الباقة', 'Filter by plan')} value={planF} onChange={e => setPlanF(e.target.value)} options={planOptions} className="min-w-[140px]" />
            <Select size="sm" aria-label={tr('تصفية حسب الحالة', 'Filter by status')} value={statusF} onChange={e => setStatusF(e.target.value)} className="min-w-[120px]"
              options={[{ value: 'all', label: tr('كل الحالات', 'All statuses') }, { value: 'active', label: tr('نشط', 'Active') }, { value: 'suspended', label: tr('موقوف', 'Suspended') }]} />
            <Select size="sm" aria-label={tr('تصفية حسب الدور', 'Filter by role')} value={roleF} onChange={e => setRoleF(e.target.value)} className="min-w-[120px]"
              options={[{ value: 'all', label: tr('كل الأدوار', 'All roles') }, { value: 'user', label: tr('مستخدم', 'User') }, { value: 'admin', label: tr('مدير', 'Admin') }]} />
            {filtering && <Button size="sm" variant="ghost" icon={XMarkIcon} onClick={clearFilters}>{tr('مسح', 'Clear')}</Button>}
          </div>
        </div>
        {filtering && (
          <p className="border-b border-line-soft bg-surface-2 px-4 py-2 text-xs text-muted">
            {tr(`تُطبَّق عوامل التصفية على ${formatNumber(data?.users?.length ?? 0)} نتيجة محمّلة — ${formatNumber(rows.length)} مطابقة.`,
              `Filters apply to the ${formatNumber(data?.users?.length ?? 0)} loaded results — ${formatNumber(rows.length)} match.`)}
          </p>
        )}

        {isError ? <div className="p-4"><ErrorState onRetry={() => refetch()} /></div> : (
          <div className={isFetching && !isLoading ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
            <DataTable
              rows={rows}
              loading={isLoading}
              skeletonRows={8}
              rowKey={u => u.id}
              columns={columns}
              minWidth={720}
              caption={tr('قائمة المستخدمين', 'Users list')}
              onRowClick={u => { setSaveError(null); setSelected(u) }}
              empty={<EmptyState size="sm" icon={UserGroupIcon}
                title={search || filtering ? tr('لا توجد نتائج مطابقة', 'No matching users') : tr('لا يوجد مستخدمون بعد', 'No users yet')}
                description={search || filtering ? tr('جرّب كلمة بحث أخرى أو امسح عوامل التصفية.', 'Try another search or clear the filters.') : undefined}
                action={(search || filtering) ? <Button size="sm" variant="secondary" onClick={() => { setRawSearch(''); clearFilters() }}>{tr('مسح البحث', 'Clear search')}</Button> : undefined} />}
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
        title={quick?.action === 'suspend' ? tr('إيقاف هذا المستخدم؟', 'Suspend this user?') : tr('تفعيل هذا المستخدم؟', 'Activate this user?')}
        description={quick ? (quick.action === 'suspend'
          ? tr(`سيُمنع ${quick.user.email} من الدخول وتنتهي جلساته الحالية.`, `${quick.user.email} will be blocked from signing in and signed out everywhere.`)
          : quick.user.email) : undefined}
        confirmLabel={quick?.action === 'suspend' ? tr('إيقاف', 'Suspend') : tr('تفعيل', 'Activate')}
        onConfirm={() => {
          if (!quick) return
          const active = quick.action === 'activate'
          save(quick.user.id, { is_active: active }, active ? tr('تم تفعيل المستخدم', 'User activated') : tr('تم إيقاف المستخدم', 'User suspended'))
            .then(() => setQuick(null), () => setQuick(null))
        }}
      />
    </AdminLayout>
  )
}
