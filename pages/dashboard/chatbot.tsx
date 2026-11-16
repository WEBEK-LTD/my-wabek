import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  BeakerIcon, BoltIcon, CpuChipIcon, EllipsisHorizontalIcon, PencilSquareIcon, PlusIcon, Squares2X2Icon, TrashIcon, KeyIcon,
} from '@heroicons/react/24/outline'
import DashboardLayout from '@/components/layout/DashboardLayout'
import {
  Badge, Button, Card, ConfirmDialog, Dropdown, EmptyState, Modal, PageHeader, Skeleton, StatCard, Switch, cn,
} from '@/components/ui'
import { ChatbotFlowEditor, ChatbotFlowDraft, TRIGGER_TYPES } from '@/components/automation/ChatbotFlowEditor'
import { ChatPreview, ChatMessage } from '@/components/automation/ChatPreview'
import { FlowEdge, FlowNode } from '@/components/automation/chatbotNodes'
import { LoadError } from '@/components/analytics/LoadError'
import { apiError } from '@/components/analytics/format'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/dashboard/chatbot'
import common from '@/locales/dashboard/common-a'
import type { ChatbotT } from '@/components/automation/chatbotNodes'

/** The tester (/api/chatbot/test) answers in English: translate its known lines, keep the rest. */
function testerLine(line: string, t: ChatbotT): string {
  const s = String(line || '')
  let m: RegExpMatchArray | null
  if (s === '(This flow has no nodes yet)') return t('tx_no_nodes')
  if (s.startsWith('(Flow triggered but produced no message')) return t('tx_no_message')
  if (s.startsWith('(Flow only has a Start node')) return t('tx_only_start')
  if (s.startsWith('(Start node has no connection')) return t('tx_start_unlinked')
  if ((m = s.match(/^No trigger matched\. This flow triggers on: (.*)$/))) return t('tx_no_trigger', { words: m[1] === 'any message' ? t('tx_any_message') : m[1] })
  if (s === 'End') return t('tl_end')
  if (s === 'Question (waits for reply)') return t('tl_question')
  if (s === 'Buttons (waits for reply)') return t('tl_buttons')
  if ((m = s.match(/^Delay (\d+)s$/))) return t('tl_delay', { n: m[1] })
  if ((m = s.match(/^Condition: (.*)$/))) return t('tl_condition', { expr: m[1] })
  if ((m = s.match(/^Tag: (.*)$/))) return t('tl_tag', { tags: m[1] })
  if ((m = s.match(/^Assign to: (.*)$/))) return t('tl_assign', { who: m[1] === '(unassigned)' ? t('tl_unassigned') : m[1] })
  if ((m = s.match(/^Answer saved as \{\{(.+)\}\}$/))) return t('tl_answer', { var: m[1] })
  if ((m = s.match(/^Button: (.*)$/))) return t('tl_button', { text: m[1] === '(no match)' ? t('tl_no_match') : m[1] })
  const node = ['start', 'message', 'question', 'buttons', 'condition', 'delay', 'tag', 'assign', 'end'].find(x => x === s)
  return node ? t(`n_${node}` as Parameters<ChatbotT>[0]) : s
}

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
  const { t, fmtNumber, fmtDate, isRTL } = useT(messages)
  const { t: tc } = useT(common)
  const formatNumber = (n: number) => fmtNumber(Number(n) || 0)
  const qc = useQueryClient()
  const [editing, setEditing] = useState<ChatbotFlowDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [toDelete, setToDelete] = useState<Flow | null>(null)
  const [testFlow, setTestFlow] = useState<TestTarget | null>(null)
  const [testMessages, setTestMessages] = useState<ChatMessage[]>([])
  const [testInput, setTestInput] = useState('')
  const [testLoading, setTestLoading] = useState(false)
  // Simulated session returned by the tester (paused question/buttons node + variables).
  const [testState, setTestState] = useState<unknown>(null)

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
      onSuccess: (_r, v) => { qc.invalidateQueries('chatbot-flows'); toast.success(v.is_active ? t('activated') : t('deactivated')) },
      onError: (e: unknown) => { toast.error(apiError(e, t('toggle_failed'))) },
    },
  )
  const deleteMut = useMutation(
    (id: string) => axios.delete(`/api/chatbot/${id}`),
    {
      onSuccess: () => { qc.invalidateQueries('chatbot-flows'); setToDelete(null); toast.success(t('deleted')) },
      onError: (e: unknown) => { toast.error(apiError(e, t('delete_failed'))) },
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
      toast.success(t('saved'))
      qc.invalidateQueries('chatbot-flows')
      setEditing(null)
    } catch (e) {
      toast.error(apiError(e, t('save_failed')))
    } finally {
      setSaving(false)
    }
  }

  const openTest = (t: TestTarget) => { setTestFlow(t); setTestMessages([]); setTestInput(''); setTestState(null) }

  const runTest = async () => {
    if (!testInput.trim() || !testFlow) return
    const userMsg = testInput
    setTestInput('')
    setTestMessages(m => [...m, { role: 'user', text: userMsg }])
    setTestLoading(true)
    try {
      // From the editor the draft is sent; from the list only flow_id (the API loads the saved flow).
      const body = testFlow.nodes
        ? { flow_id: testFlow.id, message: userMsg, nodes: testFlow.nodes, edges: testFlow.edges, trigger_keywords: testFlow.trigger_keywords, state: testState }
        : { flow_id: testFlow.id, message: userMsg, state: testState }
      const { data } = await axios.post('/api/chatbot/test', body)
      setTestState(data?.state || null)
      setTestMessages(m => [...m, {
        role: 'bot', text: data.response ? testerLine(data.response, t) : t('no_reply'),
        meta: data.triggered_nodes?.length ? t('steps_meta', { steps: data.triggered_nodes.map((x: string) => testerLine(x, t)).join(isRTL ? ' ← ' : ' → ') }) : undefined,
      }])
    } catch (e) {
      setTestMessages(m => [...m, { role: 'bot', text: apiError(e, t('test_failed')), error: true }])
    }
    setTestLoading(false)
  }

  const instanceName = (id: string | null) => {
    if (!id) return t('all_numbers')
    const i = allInstances.find(x => x.id === id)
    return i?.display_name || i?.phone_number || t('specific_number')
  }

  return (
    <DashboardLayout title={editing ? (editing.id ? t('page_title_edit', { name: editing.name }) : t('page_title_new')) : t('page_title')}>
      {editing ? (
        <ChatbotFlowEditor
          key={editing.id || 'new'}
          initial={editing}
          instances={allInstances.filter(i => i.status === 'connected' || i.id === editing.instance_id)}
          teamMembers={teamMembers}
          saving={saving}
          onBack={() => setEditing(null)}
          onSave={saveFlow}
          onTest={d => openTest({ id: d.id || 'draft', name: d.name || t('unnamed'), nodes: d.nodes, edges: d.edges, trigger_keywords: d.trigger_type === 'keyword' ? d.trigger_keywords : [] })}
        />
      ) : (
        <div className="flex flex-col gap-6">
          <PageHeader
            eyebrow={t('eyebrow')}
            title={t('title')}
            description={t('description')}
            actions={<Button icon={PlusIcon} onClick={() => openBuilder()}>{t('new_flow')}</Button>}
          />

          <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
            <StatCard loading={isLoading} label={t('stat_flows')} value={formatNumber(flows.length)} icon={Squares2X2Icon} />
            <StatCard loading={isLoading} label={t('stat_active')} value={formatNumber(activeCount)} icon={CpuChipIcon} subTone="success" sub={flows.length ? t('stat_of', { n: formatNumber(flows.length) }) : undefined} />
            <StatCard loading={isLoading} label={t('stat_runs')} value={formatNumber(totalTriggers)} icon={BoltIcon} sub={t('stat_all_flows')} />
          </div>

          {isError ? (
            <Card><LoadError onRetry={() => refetch()} /></Card>
          ) : isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(i => <Card key={i}><Skeleton lines={4} /></Card>)}</div>
          ) : flows.length === 0 ? (
            <EmptyState variant="card" icon={CpuChipIcon} title={t('empty_title')}
              description={t('empty_desc')}
              action={<Button icon={PlusIcon} onClick={() => openBuilder()}>{t('empty_action')}</Button>} />
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
                            <Badge tone={flow.is_active ? 'success' : 'neutral'} dot pulse={flow.is_active}>{flow.is_active ? t('active') : t('paused')}</Badge>
                            <Badge tone="brand">{TRIGGER_TYPES[flow.trigger_type] ? t(TRIGGER_TYPES[flow.trigger_type].label) : flow.trigger_type}</Badge>
                          </div>
                        </div>
                        <Switch size="sm" checked={flow.is_active} aria-label={flow.is_active ? t('pause_x', { name: flow.name }) : t('activate_x', { name: flow.name })}
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
                        <div><dd className="tabular text-lg font-bold text-ink">{formatNumber(steps)}</dd><dt className="text-2xs text-muted">{t('steps')}</dt></div>
                        <div><dd className="tabular text-lg font-bold text-ink">{formatNumber((flow.edges || []).length)}</dd><dt className="text-2xs text-muted">{t('links')}</dt></div>
                        <div><dd className="tabular text-lg font-bold text-ink">{formatNumber(flow.trigger_count || 0)}</dd><dt className="text-2xs text-muted">{t('runs')}</dt></div>
                      </dl>

                      <p className="text-xs text-muted">{instanceName(flow.instance_id)} · {t('created_on', { date: fmtDate(flow.created_at) })}</p>

                      <div className="mt-auto flex items-center gap-2">
                        <Button size="sm" variant="secondary" icon={PencilSquareIcon} className="flex-1" onClick={() => openBuilder(flow)}>{tc('edit')}</Button>
                        <Button size="sm" variant="ghost" icon={BeakerIcon} onClick={() => openTest({ id: flow.id, name: flow.name })}>{t('e_test')}</Button>
                        <Dropdown label={t('options_for', { name: flow.name })} triggerClassName="h-9 w-9 justify-center text-muted hover:bg-surface-3 hover:text-ink"
                          trigger={<EllipsisHorizontalIcon className="h-5 w-5" />}
                          items={[{ label: tc('delete'), icon: TrashIcon, danger: true, onClick: () => setToDelete(flow) }]} />
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      <Modal open={!!testFlow} onClose={() => setTestFlow(null)} size="md" icon={BeakerIcon} title={t('test_title', { name: testFlow?.name || '' })}
        description={testFlow?.nodes ? t('test_desc_draft') : t('test_desc_saved')}>
        <ChatPreview
          title={testFlow?.name || ''}
          subtitle={t('test_subtitle')}
          messages={testMessages}
          loading={testLoading}
          value={testInput}
          onChange={setTestInput}
          onSend={runTest}
          onReset={() => { setTestMessages([]); setTestState(null) }}
          placeholder={t('test_ph')}
          emptyHint={t('test_hint')}
          className="shadow-none"
        />
      </Modal>

      <ConfirmDialog destructive open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={() => { if (toDelete) deleteMut.mutate(toDelete.id) }}
        title={t('delete_title')} description={toDelete ? t('delete_desc', { name: toDelete.name }) : undefined}
        confirmLabel={tc('delete')} cancelLabel={tc('cancel')} loading={deleteMut.isLoading} />
    </DashboardLayout>
  )
}
