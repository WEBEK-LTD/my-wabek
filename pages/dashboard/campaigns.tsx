import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  PlusIcon, MegaphoneIcon, PaperAirplaneIcon, CheckCircleIcon, EyeIcon, BoltIcon, LockClosedIcon,
  MagnifyingGlassIcon, ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { Button, ConfirmDialog, EmptyState, PageHeader, SearchInput, Skeleton, StatCard, Tabs } from '@/components/ui'
import { Notice } from '@/components/settings/Shared'
import { LoadError } from '@/components/analytics/LoadError'
import { CampaignWizard } from '@/components/campaigns/CampaignWizard'
import { CampaignRow, CampaignRowData } from '@/components/campaigns/CampaignRow'
import { friendlyError, isMemberForbidden, pct, startResultMessage, useTeamRole } from '@/components/campaigns/shared'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/dashboard/campaigns'
import common from '@/locales/dashboard/common-a'

const FILTERS = [
  { id: 'all', key: 'f_all' },
  { id: 'running', key: 'f_running' },
  { id: 'scheduled', key: 'f_scheduled' },
  { id: 'draft', key: 'f_draft' },
  { id: 'paused', key: 'f_paused' },
  { id: 'completed', key: 'f_completed' },
  { id: 'failed', key: 'f_failed' },
] as const

export default function CampaignsPage() {
  const { t, fmtNumber } = useT(messages)
  const { t: tc } = useT(common)
  const fmtNum = (n: number | null | undefined) => fmtNumber(Number(n) || 0)
  const qc = useQueryClient()
  const router = useRouter()
  const [view, setView] = useState<'list' | 'builder'>('list')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [toDelete, setToDelete] = useState<CampaignRowData | null>(null)
  const { canWrite, roleLabel } = useTeamRole()
  const canManage = canWrite('campaigns')

  // /dashboard/campaigns?new=1 opens the builder directly
  useEffect(() => {
    if (router.isReady && router.query.new && canManage) setView('builder')
  }, [router.isReady, router.query.new, canManage])

  const { data: cData, isLoading, isError, error, refetch } = useQuery('campaigns', () => axios.get('/api/campaigns').then(r => r.data), {
    refetchInterval: (data: any) => {
      // Poll every 3s while any campaign is running
      const hasRunning = data?.campaigns?.some((c: any) => c.status === 'running')
      return hasRunning ? 3000 : false
    },
  })
  const campaigns: CampaignRowData[] = cData?.campaigns || []

  const actionMut = useMutation(
    ({ id, action }: { id: string; action: 'start' | 'pause' }) => axios.post(`/api/campaigns/${id}`, { action }),
    {
      // A start request keeps sending for up to ~20s: refresh early so the
      // row switches to "running" and the progress polling kicks in.
      onMutate: ({ action }) => { if (action === 'start') setTimeout(() => qc.invalidateQueries('campaigns'), 1500) },
      onSuccess: (r: any, { action }) => {
        qc.invalidateQueries('campaigns')
        if (action === 'pause') { toast.success(t('paused_toast')); return }
        const m = startResultMessage(r?.data)
        ;(m.ok ? toast.success : toast.error)(m.text)
      },
      onError: (e: any) => { qc.invalidateQueries('campaigns'); toast.error(friendlyError(e, t('action_failed'))) },
    }
  )

  const deleteMut = useMutation(
    (id: string) => axios.delete(`/api/campaigns/${id}`),
    {
      onSuccess: () => { qc.invalidateQueries('campaigns'); setToDelete(null); toast.success(t('deleted_toast')) },
      onError: (e: any) => { toast.error(friendlyError(e, t('delete_failed'))) },
    }
  )

  const counts = useMemo(() => {
    const out: Record<string, number> = { all: campaigns.length }
    for (const c of campaigns) out[c.status] = (out[c.status] || 0) + 1
    return out
  }, [campaigns])

  const totals = useMemo(() => campaigns.reduce((a, c) => ({
    sent: a.sent + (c.sent_count || 0),
    delivered: a.delivered + Math.max(c.delivered_count || 0, c.read_count || 0),
    read: a.read + (c.read_count || 0),
    failed: a.failed + (c.failed_count || 0),
  }), { sent: 0, delivered: 0, read: 0, failed: 0 }), [campaigns])

  const shown = campaigns.filter(c =>
    (filter === 'all' || c.status === filter) &&
    (!search || c.name.toLowerCase().includes(search.trim().toLowerCase())))

  if (view === 'builder') return (
    <DashboardLayout title={t('builder_title')}>
      <CampaignWizard onClose={() => {
        setView('list')
        if (router.query.new) router.replace('/dashboard/campaigns', undefined, { shallow: true })
      }} />
    </DashboardLayout>
  )

  const openBuilder = () => setView('builder')

  return (
    <DashboardLayout title={t('page_title')}>
      <div className="space-y-6">
        <PageHeader
          eyebrow={t('eyebrow')}
          title={t('title')}
          description={t('description')}
          actions={canManage ? <Button variant="dark" icon={PlusIcon} onClick={openBuilder}>{t('new_campaign')}</Button> : undefined}
        />

        {!canManage && (
          <Notice tone="info" icon={LockClosedIcon} title={t('role_title', { role: roleLabel })}>
            {t('role_body')}
          </Notice>
        )}

        {isLoading ? (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-3.5">
              {[0, 1, 2, 3].map(i => <StatCard key={i} label="" value="" loading />)}
            </div>
            <div className="space-y-3" aria-busy="true" aria-label={t('loading')}>
              {[0, 1, 2].map(i => <Skeleton key={i} className="h-24 w-full rounded-panel" />)}
            </div>
          </>
        ) : isError ? (
          <LoadError
            title={isMemberForbidden(error) ? t('forbidden_title') : t('load_failed')}
            description={isMemberForbidden(error) ? tc('err_member_forbidden') : friendlyError(error)}
            onRetry={() => refetch()}
          />
        ) : campaigns.length === 0 ? (
          <EmptyState
            variant="card"
            icon={MegaphoneIcon}
            title={t('empty_title')}
            description={t('empty_desc')}
            action={canManage ? <Button icon={PlusIcon} onClick={openBuilder}>{t('empty_action')}</Button> : undefined}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-3.5">
              <StatCard label={t('stat_campaigns')} value={fmtNum(campaigns.length)} icon={MegaphoneIcon}
                sub={counts.running ? t('stat_running_now', { n: fmtNum(counts.running) }) : counts.scheduled ? t('stat_scheduled', { n: fmtNum(counts.scheduled) }) : t('stat_idle')}
                subTone={counts.running ? 'brand' : counts.scheduled ? 'warning' : 'muted'} />
              <StatCard label={t('stat_sent')} value={fmtNum(totals.sent)} icon={PaperAirplaneIcon}
                sub={totals.failed ? t('stat_failed', { n: fmtNum(totals.failed) }) : t('stat_no_failures')} subTone={totals.failed ? 'danger' : 'success'} />
              <StatCard label={t('stat_delivery')} value={`${pct(totals.delivered, totals.sent)}%`} icon={CheckCircleIcon}
                progress={pct(totals.delivered, totals.sent)} sub={t('stat_delivered', { n: fmtNum(totals.delivered) })} />
              <StatCard label={t('stat_read_rate')} value={`${pct(totals.read, totals.sent)}%`} icon={EyeIcon}
                progress={pct(totals.read, totals.sent)} sub={t('stat_read', { n: fmtNum(totals.read) })} />
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="-mx-1 overflow-x-auto px-1 scrollbar-none">
                <Tabs variant="pills" size="sm" value={filter} onChange={setFilter} aria-label={t('filter_aria')}
                  tabs={FILTERS.filter(f => f.id === 'all' || counts[f.id]).map(f => ({ id: f.id, label: t(f.key), count: counts[f.id] || 0 }))} />
              </div>
              <SearchInput size="sm" value={search} onChange={setSearch} placeholder={t('search_ph')} className="lg:w-72" />
            </div>

            {counts.failed > 0 && filter === 'all' && (
              <Notice tone="danger" icon={ExclamationTriangleIcon}
                action={<Button size="sm" variant="secondary" onClick={() => setFilter('failed')}>{t('show_them')}</Button>}>
                {counts.failed === 1 ? t('failed_notice_one') : t('failed_notice', { n: fmtNum(counts.failed) })}
              </Notice>
            )}

            {shown.length === 0 ? (
              <EmptyState size="sm" variant="card" icon={MagnifyingGlassIcon} title={t('no_match_title')}
                description={t('no_match_desc')}
                action={<Button size="sm" variant="secondary" onClick={() => { setFilter('all'); setSearch('') }}>{t('show_all')}</Button>} />
            ) : (
              <div className="space-y-3">
                {shown.map(c => (
                  <CampaignRow
                    key={c.id}
                    c={c}
                    canWrite={canManage}
                    busy={actionMut.isLoading && actionMut.variables?.id === c.id}
                    onAction={action => actionMut.mutate({ id: c.id, action })}
                    onDelete={() => setToDelete(c)}
                  />
                ))}
              </div>
            )}

            {counts.running > 0 && (
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <BoltIcon className="h-4 w-4 text-brand-ink" aria-hidden="true" />
                {t('auto_refresh')}
              </p>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        destructive
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => { if (toDelete) deleteMut.mutate(toDelete.id) }}
        loading={deleteMut.isLoading}
        title={t('delete_title')}
        description={toDelete ? t('delete_desc', { name: toDelete.name }) : undefined}
        confirmLabel={tc('delete')}
        cancelLabel={tc('cancel')}
      />
    </DashboardLayout>
  )
}
