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
import { ErrorState, Notice } from '@/components/settings/Shared'
import { CampaignWizard } from '@/components/campaigns/CampaignWizard'
import { CampaignRow, CampaignRowData } from '@/components/campaigns/CampaignRow'
import { fmtNum, friendlyError, isMemberForbidden, pct, startResultMessage, useTeamRole, MEMBER_FORBIDDEN_MSG } from '@/components/campaigns/shared'

const FILTERS = [
  { id: 'all', label: 'الكل' },
  { id: 'running', label: 'قيد الإرسال' },
  { id: 'scheduled', label: 'مجدولة' },
  { id: 'draft', label: 'مسودات' },
  { id: 'paused', label: 'متوقفة' },
  { id: 'completed', label: 'مكتملة' },
  { id: 'failed', label: 'فشلت' },
]

export default function CampaignsPage() {
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
        if (action === 'pause') { toast.success('أُوقفت الحملة مؤقتًا'); return }
        const m = startResultMessage(r?.data)
        ;(m.ok ? toast.success : toast.error)(m.text)
      },
      onError: (e: any) => { qc.invalidateQueries('campaigns'); toast.error(friendlyError(e, 'تعذّر تنفيذ الإجراء')) },
    }
  )

  const deleteMut = useMutation(
    (id: string) => axios.delete(`/api/campaigns/${id}`),
    {
      onSuccess: () => { qc.invalidateQueries('campaigns'); setToDelete(null); toast.success('حُذفت الحملة') },
      onError: (e: any) => { toast.error(friendlyError(e, 'تعذّر حذف الحملة')) },
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
    <DashboardLayout title="Campaign Builder">
      <CampaignWizard onClose={() => {
        setView('list')
        if (router.query.new) router.replace('/dashboard/campaigns', undefined, { shallow: true })
      }} />
    </DashboardLayout>
  )

  const openBuilder = () => setView('builder')

  return (
    <DashboardLayout title="Campaigns">
      <div className="space-y-6">
        <PageHeader
          eyebrow="الحملات"
          title="الحملات"
          description="أرسل رسالة واحدة إلى جمهور كامل أو شريحة محددة، وتابع وصولها وقراءتها لحظة بلحظة."
          actions={canManage ? <Button variant="dark" icon={PlusIcon} onClick={openBuilder}>حملة جديدة</Button> : undefined}
        />

        {!canManage && (
          <Notice tone="info" icon={LockClosedIcon} title={`صلاحيتك في الفريق: ${roleLabel}`}>
            يمكنك متابعة الحملات وتقاريرها، أما إنشاؤها وبدؤها وإيقافها فيقتصر على مالك الحساب ومسؤولي الفريق.
          </Notice>
        )}

        {isLoading ? (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-3.5">
              {[0, 1, 2, 3].map(i => <StatCard key={i} label="" value="" loading />)}
            </div>
            <div className="space-y-3" aria-busy="true" aria-label="جارٍ تحميل الحملات">
              {[0, 1, 2].map(i => <Skeleton key={i} className="h-24 w-full rounded-panel" />)}
            </div>
          </>
        ) : isError ? (
          <ErrorState
            title={isMemberForbidden(error) ? 'لا يمكنك عرض الحملات' : 'تعذّر تحميل الحملات'}
            message={isMemberForbidden(error) ? MEMBER_FORBIDDEN_MSG : friendlyError(error)}
            onRetry={() => refetch()}
          />
        ) : campaigns.length === 0 ? (
          <EmptyState
            variant="card"
            icon={MegaphoneIcon}
            title="لا توجد حملات بعد"
            description="أنشئ حملتك الأولى في أربع خطوات: اختر الجمهور، واكتب الرسالة أو اختر قالبًا معتمدًا، وحدّد الموعد، ثم راجع وأرسل."
            action={canManage ? <Button icon={PlusIcon} onClick={openBuilder}>إنشاء أول حملة</Button> : undefined}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-3.5">
              <StatCard label="الحملات" value={fmtNum(campaigns.length)} icon={MegaphoneIcon}
                sub={counts.running ? `${fmtNum(counts.running)} قيد الإرسال الآن` : counts.scheduled ? `${fmtNum(counts.scheduled)} مجدولة` : 'لا يوجد إرسال جارٍ'}
                subTone={counts.running ? 'brand' : counts.scheduled ? 'warning' : 'muted'} />
              <StatCard label="الرسائل المرسلة" value={fmtNum(totals.sent)} icon={PaperAirplaneIcon}
                sub={totals.failed ? `${fmtNum(totals.failed)} فشلت` : 'بلا إخفاقات'} subTone={totals.failed ? 'danger' : 'success'} />
              <StatCard label="نسبة الوصول" value={`${pct(totals.delivered, totals.sent)}%`} icon={CheckCircleIcon}
                progress={pct(totals.delivered, totals.sent)} sub={`${fmtNum(totals.delivered)} رسالة وصلت`} />
              <StatCard label="نسبة القراءة" value={`${pct(totals.read, totals.sent)}%`} icon={EyeIcon}
                progress={pct(totals.read, totals.sent)} sub={`${fmtNum(totals.read)} رسالة قُرئت`} />
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="-mx-1 overflow-x-auto px-1 scrollbar-none">
                <Tabs variant="pills" size="sm" value={filter} onChange={setFilter} aria-label="تصفية حسب الحالة"
                  tabs={FILTERS.filter(f => f.id === 'all' || counts[f.id]).map(f => ({ ...f, count: counts[f.id] || 0 }))} />
              </div>
              <SearchInput size="sm" value={search} onChange={setSearch} placeholder="ابحث باسم الحملة" className="lg:w-72" />
            </div>

            {counts.failed > 0 && filter === 'all' && (
              <Notice tone="danger" icon={ExclamationTriangleIcon}
                action={<Button size="sm" variant="secondary" onClick={() => setFilter('failed')}>عرضها</Button>}>
                {fmtNum(counts.failed)} حملة توقفت بسبب خطأ. افتح تقريرها لمعرفة أسباب الفشل.
              </Notice>
            )}

            {shown.length === 0 ? (
              <EmptyState size="sm" variant="card" icon={MagnifyingGlassIcon} title="لا توجد حملات مطابقة"
                description="غيّر عامل التصفية أو كلمة البحث."
                action={<Button size="sm" variant="secondary" onClick={() => { setFilter('all'); setSearch('') }}>عرض الكل</Button>} />
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
                تتحدّث الأرقام تلقائيًا كل 3 ثوانٍ أثناء الإرسال.
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
        title="حذف الحملة؟"
        description={toDelete ? `ستُحذف حملة «${toDelete.name}» وتقريرها نهائيًا. لا يمكن التراجع عن هذا الإجراء.` : undefined}
        confirmLabel="حذف"
      />
    </DashboardLayout>
  )
}
