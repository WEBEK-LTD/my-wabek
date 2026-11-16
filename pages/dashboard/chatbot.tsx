import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  BeakerIcon, BoltIcon, CpuChipIcon, EllipsisHorizontalIcon, PencilSquareIcon, PlusIcon, Squares2X2Icon, TrashIcon, KeyIcon,
} from '@heroicons/react/24/outline'
import DashboardLayout from '@/components/layout/DashboardLayout'
import {
  Badge, Button, Card, ConfirmDialog, Dropdown, EmptyState, Modal, PageHeader, Skeleton, StatCard, Switch, cn, formatNumber,
} from '@/components/ui'
import { ChatbotFlowEditor, ChatbotFlowDraft, TRIGGER_TYPES } from '@/components/automation/ChatbotFlowEditor'
import { ChatPreview, ChatMessage } from '@/components/automation/ChatPreview'
import { FlowEdge, FlowNode } from '@/components/automation/chatbotNodes'
import { LoadError } from '@/components/analytics/LoadError'
import { apiError, formatDate } from '@/components/analytics/format'

interface Flow {
  id: string; name: string; trigger_type: string; trigger_keywords: string[] | null; instance_id: string | null
  nodes: FlowNode[] | null; edges: FlowEdge[] | null; is_active: boolean; trigger_count: number | null; created_at: string; updated_at?: string
}
interface TestTarget { id: string; name: string; nodes?: FlowNode[]; edges?: FlowEdge[]; trigger_keywords?: string[] }

const newDraft = (): ChatbotFlowDraft => ({
  name: '', trigger_type: 'keyword', trigger_keywords: [], instance_id: '',
  nodes: [{ id: 'start-1', type: 'start', data: {}, position: { x: 300, y: 60 } }], edges: [],
})

export default function ChatbotPage() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<ChatbotFlowDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [toDelete, setToDelete] = useState<Flow | null>(null)
  const [testFlow, setTestFlow] = useState<TestTarget | null>(null)
  const [testMessages, setTestMessages] = useState<ChatMessage[]>([])
  const [testInput, setTestInput] = useState('')
  const [testLoading, setTestLoading] = useState(false)

  const { data: flowsData, isLoading, isError, refetch } = useQuery<{ flows: Flow[] }>('chatbot-flows', () => axios.get('/api/chatbot').then(r => r.data))
  const { data: instData } = useQuery<{ instances: Array<{ id: string; status: string; display_name?: string; phone_number?: string }> }>('instances', () => axios.get('/api/whatsapp/instances').then(r => r.data))
  const { data: teamData } = useQuery<{ members: Array<{ id: string; user_id: string; name: string }> }>('team', () => axios.get('/api/team').then(r => r.data))

  const flows = flowsData?.flows || []
  const allInstances = instData?.instances || []
  const teamMembers = teamData?.members || []
  const activeCount = flows.filter(f => f.is_active).length
  const totalTriggers = flows.reduce((s, f) => s + (f.trigger_count || 0), 0)

  const toggleMut = useMutation(
    ({ id, is_active }: { id: string; is_active: boolean }) => axios.put(`/api/chatbot/${id}`, { is_active }),
    {
      onSuccess: (_r, v) => { qc.invalidateQueries('chatbot-flows'); toast.success(v.is_active ? 'فُعّل المسار' : 'أُوقف المسار') },
      onError: (e: unknown) => { toast.error(apiError(e, 'تعذّر تغيير الحالة')) },
    },
  )
  const deleteMut = useMutation(
    (id: string) => axios.delete(`/api/chatbot/${id}`),
    {
      onSuccess: () => { qc.invalidateQueries('chatbot-flows'); setToDelete(null); toast.success('حُذف المسار') },
      onError: (e: unknown) => { toast.error(apiError(e, 'تعذّر الحذف')) },
    },
  )

  const openBuilder = (flow?: Flow) => {
    setEditing(flow ? {
      id: flow.id, name: flow.name, trigger_type: flow.trigger_type, trigger_keywords: flow.trigger_keywords || [],
      instance_id: flow.instance_id || '', nodes: flow.nodes || [], edges: flow.edges || [],
    } : newDraft())
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 })
  }

  const saveFlow = async (d: ChatbotFlowDraft) => {
    setSaving(true)
    try {
      const payload = { name: d.name, trigger_type: d.trigger_type, trigger_keywords: d.trigger_keywords, instance_id: d.instance_id || null, nodes: d.nodes, edges: d.edges }
      if (d.id) await axios.put(`/api/chatbot/${d.id}`, payload)
      else await axios.post('/api/chatbot', payload)
      toast.success('حُفظ المسار')
      qc.invalidateQueries('chatbot-flows')
      setEditing(null)
    } catch (e) {
      toast.error(apiError(e, 'تعذّر الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  const openTest = (t: TestTarget) => { setTestFlow(t); setTestMessages([]); setTestInput('') }

  const runTest = async () => {
    if (!testInput.trim() || !testFlow) return
    const userMsg = testInput
    setTestInput('')
    setTestMessages(m => [...m, { role: 'user', text: userMsg }])
    setTestLoading(true)
    try {
      // From the editor the draft is sent; from the list only flow_id (the API loads the saved flow).
      const body = testFlow.nodes
        ? { flow_id: testFlow.id, message: userMsg, nodes: testFlow.nodes, edges: testFlow.edges, trigger_keywords: testFlow.trigger_keywords }
        : { flow_id: testFlow.id, message: userMsg }
      const { data } = await axios.post('/api/chatbot/test', body)
      setTestMessages(m => [...m, {
        role: 'bot', text: data.response || '(لا يوجد رد)',
        meta: data.triggered_nodes?.length ? `الخطوات: ${data.triggered_nodes.join(' ← ')}` : undefined,
      }])
    } catch (e) {
      setTestMessages(m => [...m, { role: 'bot', text: apiError(e, 'تعذّر اختبار المسار'), error: true }])
    }
    setTestLoading(false)
  }

  const instanceName = (id: string | null) => {
    if (!id) return 'كل الأرقام'
    const i = allInstances.find(x => x.id === id)
    return i?.display_name || i?.phone_number || 'رقم محدد'
  }

  return (
    <DashboardLayout title={editing ? (editing.id ? `Edit: ${editing.name}` : 'New Flow') : 'Chatbot Builder'}>
      {editing ? (
        <ChatbotFlowEditor
          key={editing.id || 'new'}
          initial={editing}
          instances={allInstances.filter(i => i.status === 'connected' || i.id === editing.instance_id)}
          teamMembers={teamMembers}
          saving={saving}
          onBack={() => setEditing(null)}
          onSave={saveFlow}
          onTest={d => openTest({ id: d.id || 'draft', name: d.name || 'مسار بلا اسم', nodes: d.nodes, edges: d.edges, trigger_keywords: d.trigger_type === 'keyword' ? d.trigger_keywords : [] })}
        />
      ) : (
        <div className="flex flex-col gap-6">
          <PageHeader
            eyebrow="الأتمتة والذكاء الاصطناعي"
            title="روبوت المحادثة"
            description="ابنِ مسارات محادثة ترد على عملائك على مدار الساعة: رسائل، أسئلة، أزرار، وتحويل للفريق."
            actions={<Button icon={PlusIcon} onClick={() => openBuilder()}>مسار جديد</Button>}
          />

          <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
            <StatCard loading={isLoading} label="المسارات" value={formatNumber(flows.length)} icon={Squares2X2Icon} />
            <StatCard loading={isLoading} label="مسارات نشطة" value={formatNumber(activeCount)} icon={CpuChipIcon} subTone="success" sub={flows.length ? `من ${formatNumber(flows.length)}` : undefined} />
            <StatCard loading={isLoading} label="مرات التشغيل" value={formatNumber(totalTriggers)} icon={BoltIcon} sub="لكل المسارات" />
          </div>

          {isError ? (
            <Card><LoadError onRetry={() => refetch()} /></Card>
          ) : isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(i => <Card key={i}><Skeleton lines={4} /></Card>)}</div>
          ) : flows.length === 0 ? (
            <EmptyState variant="card" icon={CpuChipIcon} title="لا توجد مسارات بعد"
              description="أنشئ مسارًا يرحّب بالعملاء ويجيب عن الأسئلة الشائعة ويجمع بياناتهم تلقائيًا."
              action={<Button icon={PlusIcon} onClick={() => openBuilder()}>إنشاء أول مسار</Button>} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {flows.map(flow => {
                const steps = (flow.nodes || []).filter(n => n.type !== 'start').length
                return (
                  <Card key={flow.id} as="article" padding="none" interactive className={cn('flex flex-col overflow-hidden', flow.is_active && 'border-brand-teal/40')}>
                    <div className={cn('h-1', flow.is_active ? 'bg-brand-gradient-x' : 'bg-track')} aria-hidden="true" />
                    <div className="flex flex-1 flex-col gap-4 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold text-ink">{flow.name}</h3>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            <Badge tone={flow.is_active ? 'success' : 'neutral'} dot pulse={flow.is_active}>{flow.is_active ? 'نشط' : 'متوقف'}</Badge>
                            <Badge tone="brand">{TRIGGER_TYPES[flow.trigger_type]?.label || flow.trigger_type}</Badge>
                          </div>
                        </div>
                        <Switch size="sm" checked={flow.is_active} aria-label={flow.is_active ? `إيقاف ${flow.name}` : `تفعيل ${flow.name}`}
                          disabled={toggleMut.isLoading && toggleMut.variables?.id === flow.id}
                          onChange={v => toggleMut.mutate({ id: flow.id, is_active: v })} />
                      </div>

                      {flow.trigger_type === 'keyword' && (flow.trigger_keywords || []).length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <KeyIcon className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                          {(flow.trigger_keywords || []).slice(0, 4).map(kw => <span key={kw} className="rounded-full bg-surface-3 px-2 py-0.5 text-xs text-ink">{kw}</span>)}
                          {(flow.trigger_keywords || []).length > 4 && <span dir="ltr" className="text-xs text-muted">+{(flow.trigger_keywords || []).length - 4}</span>}
                        </div>
                      )}

                      <dl className="grid grid-cols-3 gap-2 rounded-card bg-surface-2 p-3 text-center">
                        <div><dd className="tabular text-lg font-bold text-ink">{formatNumber(steps)}</dd><dt className="text-2xs text-muted">خطوة</dt></div>
                        <div><dd className="tabular text-lg font-bold text-ink">{formatNumber((flow.edges || []).length)}</dd><dt className="text-2xs text-muted">رابط</dt></div>
                        <div><dd className="tabular text-lg font-bold text-ink">{formatNumber(flow.trigger_count || 0)}</dd><dt className="text-2xs text-muted">تشغيل</dt></div>
                      </dl>

                      <p className="text-xs text-muted">{instanceName(flow.instance_id)} · أُنشئ {formatDate(flow.created_at)}</p>

                      <div className="mt-auto flex items-center gap-2">
                        <Button size="sm" variant="secondary" icon={PencilSquareIcon} className="flex-1" onClick={() => openBuilder(flow)}>تعديل</Button>
                        <Button size="sm" variant="ghost" icon={BeakerIcon} onClick={() => openTest({ id: flow.id, name: flow.name })}>اختبار</Button>
                        <Dropdown label={`خيارات ${flow.name}`} triggerClassName="h-9 w-9 justify-center text-muted hover:bg-surface-3 hover:text-ink"
                          trigger={<EllipsisHorizontalIcon className="h-5 w-5" />}
                          items={[{ label: 'حذف', icon: TrashIcon, danger: true, onClick: () => setToDelete(flow) }]} />
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      <Modal open={!!testFlow} onClose={() => setTestFlow(null)} size="md" icon={BeakerIcon} title={`اختبار: ${testFlow?.name || ''}`}
        description={testFlow?.nodes ? 'يُختبر المسار بنسخته الحالية في المحرر، قبل الحفظ.' : 'يُختبر المسار بنسخته المحفوظة.'}>
        <ChatPreview
          title={testFlow?.name || ''}
          subtitle="محاكاة لرد الروبوت"
          messages={testMessages}
          loading={testLoading}
          value={testInput}
          onChange={setTestInput}
          onSend={runTest}
          onReset={() => setTestMessages([])}
          placeholder="اكتب ما قد يرسله العميل…"
          emptyHint="أرسل رسالة تحتوي على إحدى الكلمات المفتاحية لتشغيل المسار."
          className="shadow-none"
        />
      </Modal>

      <ConfirmDialog destructive open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={() => { if (toDelete) deleteMut.mutate(toDelete.id) }}
        title="حذف المسار؟" description={toDelete ? `سيُحذف «${toDelete.name}» ولن يرد على العملاء بعد الآن.` : undefined}
        confirmLabel="حذف" loading={deleteMut.isLoading} />
    </DashboardLayout>
  )
}
