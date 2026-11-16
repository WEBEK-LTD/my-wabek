import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  BoltIcon, ChatBubbleLeftEllipsisIcon, ClockIcon, EllipsisHorizontalIcon, PencilSquareIcon, PlusIcon, TagIcon, TrashIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline'
import DashboardLayout from '@/components/layout/DashboardLayout'
import {
  Badge, Button, Card, ConfirmDialog, Dropdown, EmptyState, PageHeader, Skeleton, StatCard, Switch, cn, formatNumber,
} from '@/components/ui'
import {
  AutomationDraft, AutomationFlowModal, AutomationNode, AutomationTrigger, TRIGGERS,
} from '@/components/automation/AutomationFlowModal'
import { LoadError } from '@/components/analytics/LoadError'
import { apiError, formatDate } from '@/components/analytics/format'

interface Flow {
  id: string; name: string; instance_id: string | null; trigger_type: AutomationTrigger; trigger_value: string | null
  is_active: boolean; trigger_count: number | null; nodes: AutomationNode[] | null; created_at: string
}

const NODE_ICON: Record<string, React.ElementType> = { send_message: ChatBubbleLeftEllipsisIcon, delay: ClockIcon, tag_contact: TagIcon }

function ActionStrip({ nodes }: { nodes: AutomationNode[] }) {
  if (!nodes.length) return <p className="text-xs text-muted">لا توجد إجراءات</p>
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {nodes.slice(0, 5).map((n, i) => {
        const Icon = NODE_ICON[n.type] || BoltIcon
        const label = n.type === 'send_message' ? (n.data?.text || '').slice(0, 24) || 'رسالة'
          : n.type === 'delay' ? `${n.data?.seconds || 1} ث`
            : n.type === 'tag_contact' ? n.data?.tag || 'وسم' : n.type
        return (
          <span key={n.id || i} className="contents">
            {i > 0 && <ArrowLeftIcon className="h-3 w-3 text-muted ltr:rotate-180" aria-hidden="true" />}
            <span className="inline-flex max-w-[160px] items-center gap-1 rounded-full bg-surface-3 px-2 py-0.5 text-xs text-ink">
              <Icon className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" /><span className="truncate" dir="auto">{label}</span>
            </span>
          </span>
        )
      })}
      {nodes.length > 5 && <span className="text-xs text-muted">+{nodes.length - 5}</span>}
    </div>
  )
}

export default function AutomationPage() {
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<AutomationDraft | null>(null)
  const [toDelete, setToDelete] = useState<Flow | null>(null)

  const { data: fData, isLoading, isError, refetch } = useQuery<{ flows: Flow[] }>('flows', () => axios.get('/api/automation').then(r => r.data))
  const { data: iData } = useQuery<{ instances: Array<{ id: string; status: string; display_name?: string; phone_number?: string }> }>('instances', () => axios.get('/api/whatsapp/instances').then(r => r.data))
  const flows = fData?.flows || []
  const allInstances = iData?.instances || []
  const active = flows.filter(f => f.is_active).length
  const triggered = flows.reduce((s, f) => s + (f.trigger_count || 0), 0)

  const saveMut = useMutation(
    (d: AutomationDraft) => {
      const body = { name: d.name, instance_id: d.instance_id || null, trigger_type: d.trigger_type, trigger_value: d.trigger_value || null, nodes: d.nodes }
      return d.id ? axios.put(`/api/automation/${d.id}`, body) : axios.post('/api/automation', { ...body, is_active: true })
    },
    {
      onSuccess: (_r, d) => { qc.invalidateQueries('flows'); setModalOpen(false); toast.success(d.id ? 'حُفظت التغييرات' : 'أُنشئت الأتمتة') },
      onError: (e: unknown) => { toast.error(apiError(e, 'تعذّر الحفظ')) },
    },
  )

  const toggleMut = useMutation(
    ({ id, is_active }: { id: string; is_active: boolean }) => axios.put(`/api/automation/${id}`, { is_active }),
    {
      onSuccess: (_r, v) => { qc.invalidateQueries('flows'); toast.success(v.is_active ? 'فُعّلت الأتمتة' : 'أُوقفت الأتمتة') },
      onError: (e: unknown) => { toast.error(apiError(e, 'تعذّر تغيير الحالة')) },
    },
  )

  const deleteMut = useMutation(
    (id: string) => axios.delete(`/api/automation/${id}`),
    {
      onSuccess: () => { qc.invalidateQueries('flows'); setToDelete(null); toast.success('حُذفت الأتمتة') },
      onError: (e: unknown) => { toast.error(apiError(e, 'تعذّر الحذف')) },
    },
  )

  const openNew = () => { setEditing(null); setModalOpen(true) }
  const openEdit = (f: Flow) => {
    setEditing({ id: f.id, name: f.name, instance_id: f.instance_id, trigger_type: f.trigger_type, trigger_value: f.trigger_value, nodes: f.nodes || [] })
    setModalOpen(true)
  }
  const instanceName = (id: string | null) => {
    if (!id) return 'كل الأرقام'
    const i = allInstances.find(x => x.id === id)
    return i?.display_name || i?.phone_number || 'رقم محدد'
  }

  return (
    <DashboardLayout title="Automation">
      <div className="flex flex-col gap-6">
        <PageHeader
          eyebrow="الأتمتة والذكاء الاصطناعي"
          title="الأتمتة"
          description="ردود وإجراءات تلقائية: عندما تصل رسالة أو كلمة معيّنة، أرسل ردًا وأضف وسمًا دون تدخل."
          actions={<Button icon={PlusIcon} onClick={openNew}>أتمتة جديدة</Button>}
        />

        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
          <StatCard loading={isLoading} label="الأتمتات" value={formatNumber(flows.length)} icon={BoltIcon} />
          <StatCard loading={isLoading} label="نشطة الآن" value={formatNumber(active)} icon={BoltIcon} sub={flows.length ? `من ${formatNumber(flows.length)}` : undefined} subTone="success" />
          <StatCard loading={isLoading} label="مرات التنفيذ" value={formatNumber(triggered)} icon={ChatBubbleLeftEllipsisIcon} sub="لكل الأتمتات" />
        </div>

        {isError ? (
          <Card><LoadError onRetry={() => refetch()} /></Card>
        ) : isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(i => <Card key={i}><Skeleton lines={4} /></Card>)}</div>
        ) : flows.length === 0 ? (
          <EmptyState variant="card" icon={BoltIcon} title="لا توجد أتمتات بعد"
            description="ابدأ برسالة ترحيب تلقائية، أو رد على كلمات مثل «الأسعار» و«العنوان»."
            action={<Button icon={PlusIcon} onClick={openNew}>إنشاء أتمتة</Button>} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {flows.map(f => {
              const T = TRIGGERS[f.trigger_type] || TRIGGERS.keyword
              return (
                <Card key={f.id} as="article" padding="none" interactive className="flex flex-col overflow-hidden">
                  <div className={cn('h-1', f.is_active ? 'bg-brand-gradient-x' : 'bg-track')} aria-hidden="true" />
                  <div className="flex flex-1 flex-col gap-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-chip text-brand-ink"><T.icon className="h-5 w-5" aria-hidden="true" /></span>
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold text-ink">{f.name}</h3>
                          <p className="text-xs text-muted">{T.label}</p>
                        </div>
                      </div>
                      <Switch size="sm" checked={f.is_active} aria-label={f.is_active ? `إيقاف ${f.name}` : `تفعيل ${f.name}`}
                        disabled={toggleMut.isLoading && toggleMut.variables?.id === f.id}
                        onChange={v => toggleMut.mutate({ id: f.id, is_active: v })} />
                    </div>

                    {f.trigger_value && (
                      <div className="rounded-card bg-surface-2 px-3 py-2 text-xs">
                        <span className="text-muted">الكلمات: </span><span className="font-medium text-ink" dir="auto">{f.trigger_value}</span>
                      </div>
                    )}

                    <ActionStrip nodes={f.nodes || []} />

                    <div className="mt-auto flex items-center justify-between gap-2 border-t border-line-soft pt-3">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                        <Badge tone={f.is_active ? 'success' : 'neutral'} dot>{f.is_active ? 'نشطة' : 'متوقفة'}</Badge>
                        <span className="tabular">{formatNumber(f.trigger_count || 0)} تنفيذ</span>
                        <span aria-hidden="true">·</span>
                        <span>{instanceName(f.instance_id)}</span>
                      </div>
                      <div className="flex items-center">
                        <Button size="icon-sm" variant="ghost" icon={PencilSquareIcon} aria-label={`تعديل ${f.name}`} onClick={() => openEdit(f)} />
                        <Dropdown label={`خيارات ${f.name}`} triggerClassName="h-8 w-8 justify-center text-muted hover:bg-surface-3 hover:text-ink"
                          trigger={<EllipsisHorizontalIcon className="h-5 w-5" />}
                          items={[
                            { label: 'تعديل', icon: PencilSquareIcon, onClick: () => openEdit(f) },
                            { label: 'حذف', icon: TrashIcon, danger: true, divider: true, onClick: () => setToDelete(f) },
                          ]} />
                      </div>
                    </div>
                    <p className="-mt-2 text-2xs text-muted">أُنشئت {formatDate(f.created_at)}</p>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <AutomationFlowModal open={modalOpen} initial={editing} instances={allInstances} saving={saveMut.isLoading}
        onClose={() => setModalOpen(false)} onSave={d => saveMut.mutate(d)} />

      <ConfirmDialog destructive open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={() => { if (toDelete) deleteMut.mutate(toDelete.id) }}
        title="حذف الأتمتة؟" description={toDelete ? `ستُحذف «${toDelete.name}» نهائيًا.` : undefined} confirmLabel="حذف" loading={deleteMut.isLoading} />
    </DashboardLayout>
  )
}
