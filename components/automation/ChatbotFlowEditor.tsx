import { useMemo, useState } from 'react'
import {
  ArrowRightIcon, BeakerIcon, CheckCircleIcon, ChevronDownIcon, PlusIcon, TrashIcon, XMarkIcon, ArrowTurnDownLeftIcon,
  ExclamationTriangleIcon, LinkSlashIcon,
} from '@heroicons/react/24/outline'
import { Badge, Button, Card, CardHeader, Dropdown, Field, Input, Select, Textarea, cn, toneClasses } from '@/components/ui'
import { KeywordInput } from './KeywordInput'
import {
  ADDABLE_TYPES, CONDITION_OPERATORS, FlowButton, FlowEdge, FlowNode, NODE_TYPES, NodeType, defaultData, orderNodes, slotsOf,
  summaryOf, typeInfo, uid,
} from './chatbotNodes'

export interface ChatbotFlowDraft {
  id?: string
  name: string
  trigger_type: string
  trigger_keywords: string[]
  instance_id: string
  nodes: FlowNode[]
  edges: FlowEdge[]
}

export const TRIGGER_TYPES: Record<string, { label: string; desc: string }> = {
  keyword: { label: 'كلمة مفتاحية', desc: 'يبدأ عندما تحتوي الرسالة على إحدى الكلمات' },
  any_message: { label: 'أي رسالة', desc: 'يبدأ مع كل رسالة واردة' },
  first_message: { label: 'أول رسالة', desc: 'يبدأ مع أول رسالة من عميل جديد' },
  opt_in: { label: 'الاشتراك', desc: 'عند اشتراك العميل' },
  button_reply: { label: 'رد زر', desc: 'عند الضغط على زر' },
}

interface Props {
  initial: ChatbotFlowDraft
  instances: Array<{ id: string; display_name?: string | null; phone_number?: string | null }>
  teamMembers: Array<{ id: string; user_id: string; name: string }>
  saving: boolean
  onBack: () => void
  onSave: (draft: ChatbotFlowDraft) => void
  onTest: (draft: ChatbotFlowDraft) => void
}

function NodeFields({ node, teamMembers, onChange }: { node: FlowNode; teamMembers: Props['teamMembers']; onChange: (data: FlowNode['data']) => void }) {
  const d = node.data || {}
  const upd = (k: string, v: unknown) => onChange({ ...d, [k]: v })
  const vars = <p className="text-xs text-muted">المتغيرات: <code dir="ltr" className="font-mono">{'{{name}}'}</code> <code dir="ltr" className="font-mono">{'{{phone}}'}</code> <code dir="ltr" className="font-mono">{'{{answer}}'}</code></p>

  switch (node.type) {
    case 'message':
      return <Field label="نص الرسالة"><Textarea rows={3} value={d.text || ''} onChange={e => upd('text', e.target.value)} placeholder="مرحبًا {{name}}!" />{vars}</Field>
    case 'question':
      return (
        <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
          <Field label="السؤال"><Textarea rows={2} value={d.question || ''} onChange={e => upd('question', e.target.value)} /></Field>
          <Field label="احفظ الإجابة في المتغير"><Input dir="ltr" className="font-mono" value={d.variable || ''} onChange={e => upd('variable', e.target.value)} placeholder="name" /></Field>
        </div>
      )
    case 'buttons': {
      const buttons: FlowButton[] = d.buttons || []
      return (
        <div className="flex flex-col gap-3">
          <Field label="نص الرسالة"><Textarea rows={2} value={d.text || ''} onChange={e => upd('text', e.target.value)} /></Field>
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">الأزرار</p>
            <div className="flex flex-col gap-2">
              {buttons.map((b, i) => (
                <div key={b.id} className="flex items-center gap-2">
                  <span className="tabular flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-bg text-xs font-bold text-violet">{i + 1}</span>
                  <Input size="sm" value={b.text} maxLength={20} placeholder={`الخيار ${i + 1}`} aria-label={`نص الزر ${i + 1}`}
                    onChange={e => upd('buttons', buttons.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
                  <Button size="icon-sm" variant="ghost" icon={XMarkIcon} aria-label={`حذف الزر ${i + 1}`} onClick={() => upd('buttons', buttons.filter((_, j) => j !== i))} />
                </div>
              ))}
            </div>
            <Button size="sm" variant="secondary" icon={PlusIcon} className="mt-2" onClick={() => upd('buttons', [...buttons, { id: uid(), text: '' }])}>إضافة زر</Button>
          </div>
        </div>
      )
    }
    case 'condition':
      return (
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="المتغير"><Input dir="ltr" className="font-mono" value={d.variable || ''} onChange={e => upd('variable', e.target.value)} placeholder="answer" /></Field>
          <Field label="العامل"><Select value={d.operator || 'equals'} onChange={e => upd('operator', e.target.value)} options={CONDITION_OPERATORS} /></Field>
          {d.operator !== 'not_empty' && <Field label="القيمة"><Input value={d.value || ''} onChange={e => upd('value', e.target.value)} /></Field>}
        </div>
      )
    case 'delay':
      return (
        <Field label="مدة الانتظار" hint="من 1 إلى 60 ثانية">
          <Input type="number" min={1} max={60} value={d.seconds || 2} endAdornment="ثانية" className="max-w-[160px]"
            onChange={e => upd('seconds', Math.max(1, Math.min(60, parseInt(e.target.value, 10) || 1)))} />
        </Field>
      )
    case 'tag':
      return <Field label="الوسوم"><KeywordInput value={d.tags || []} onChange={v => upd('tags', v)} placeholder="vip، lead…" /></Field>
    case 'assign':
      return (
        <Field label="تعيين المحادثة إلى">
          <Select value={d.assigned_to || ''} onChange={e => upd('assigned_to', e.target.value)}
            options={[{ value: '', label: 'بدون تعيين' }, ...teamMembers.map(m => ({ value: m.user_id, label: m.name }))]} />
        </Field>
      )
    case 'end':
      return <Field label="رسالة ختامية" hint="اختيارية"><Textarea rows={2} value={d.message || ''} onChange={e => upd('message', e.target.value)} placeholder="شكرًا لك!" /></Field>
    default:
      return <p className="text-sm text-muted">لا توجد إعدادات لهذه الخطوة.</p>
  }
}

/**
 * Chatbot flow editor as an ordered list of steps. Each step shows where it
 * leads next (one picker per branch) instead of a free canvas; node
 * positions are kept so the stored data model is unchanged.
 */
export function ChatbotFlowEditor({ initial, instances, teamMembers, saving, onBack, onSave, onTest }: Props) {
  const [name, setName] = useState(initial.name)
  const [triggerType, setTriggerType] = useState(initial.trigger_type || 'keyword')
  const [keywords, setKeywords] = useState<string[]>(initial.trigger_keywords || [])
  const [instanceId, setInstanceId] = useState(initial.instance_id || '')
  const [nodes, setNodes] = useState<FlowNode[]>(initial.nodes)
  const [edges, setEdges] = useState<FlowEdge[]>(initial.edges)
  const [openId, setOpenId] = useState<string | null>(null)
  const [nameError, setNameError] = useState(false)

  const { ordered, unreachable } = useMemo(() => orderNodes(nodes, edges), [nodes, edges])
  const all = [...ordered, ...unreachable]
  const number = (id: string) => all.findIndex(n => n.id === id) + 1
  const teamName = (id: string) => teamMembers.find(m => m.user_id === id)?.name

  const draft = (): ChatbotFlowDraft => ({ id: initial.id, name: name.trim(), trigger_type: triggerType, trigger_keywords: keywords, instance_id: instanceId, nodes, edges })

  const targetOf = (source: string, label: string | null) => edges.find(e => e.source === source && (e.label ?? null) === label)?.target || ''
  const connect = (source: string, label: string | null, target: string) => {
    setEdges(prev => {
      const rest = prev.filter(e => !(e.source === source && (e.label ?? null) === label))
      return target ? [...rest, { id: uid(), source, target, label }] : rest
    })
  }

  const newNode = (type: NodeType): FlowNode => {
    const maxY = nodes.reduce((m, n) => Math.max(m, (n.position?.y || 0) + 130), 60)
    return { id: uid(), type, data: defaultData(type), position: { x: 60 + (nodes.length % 4) * 230, y: maxY + 10 } }
  }

  /** Add a step; link it from `from`'s slot, or from the last step's free default slot. */
  const addNode = (type: NodeType, from?: { source: string; label: string | null }) => {
    const n = newNode(type)
    setNodes(p => [...p, n])
    let link = from
    if (!link) {
      const last = ordered[ordered.length - 1]
      const slot = last && slotsOf(last).find(s => s.label === null)
      if (last && slot && !targetOf(last.id, null)) link = { source: last.id, label: null }
    }
    if (link) connect(link.source, link.label, n.id)
    setOpenId(n.id)
  }

  const updateData = (node: FlowNode, data: FlowNode['data']) => {
    // Keep button branches attached when a button is renamed.
    if (node.type === 'buttons') {
      const before: FlowButton[] = node.data.buttons || []
      const after: FlowButton[] = data.buttons || []
      setEdges(prev => prev.flatMap(e => {
        if (e.source !== node.id || e.label == null) return [e]
        const old = before.find(b => b.text === e.label)
        if (!old) return [e]
        const now = after.find(b => b.id === old.id)
        if (!now) return []
        return [{ ...e, label: now.text }]
      }))
    }
    setNodes(p => p.map(n => (n.id === node.id ? { ...n, data } : n)))
  }

  const removeNode = (id: string) => {
    setNodes(p => p.filter(n => n.id !== id))
    setEdges(p => p.filter(e => e.source !== id && e.target !== id))
    if (openId === id) setOpenId(null)
  }

  const save = () => {
    if (!name.trim()) { setNameError(true); window.scrollTo({ top: 0, behavior: 'smooth' }); return }
    onSave(draft())
  }

  const triggerOptions = ['keyword', 'any_message', 'first_message', ...(TRIGGER_TYPES[triggerType] && !['keyword', 'any_message', 'first_message'].includes(triggerType) ? [triggerType] : [])]

  const renderStep = (node: FlowNode, detached = false) => {
    const info = typeInfo(node.type)
    const Icon = info.icon
    const open = openId === node.id
    const slots = slotsOf(node)
    // Older flows may have an unlabelled edge out of a branching step; the engine uses it as the fallback.
    if ((node.type === 'buttons' || node.type === 'condition') && edges.some(e => e.source === node.id && e.label == null)) {
      slots.push({ label: null, title: 'في أي حالة أخرى' })
    }
    const summary = summaryOf(node, teamName)
    const otherNodes = all.filter(n => n.id !== node.id && n.type !== 'start')

    return (
      <li key={node.id} className="group relative">
        <div className={cn('rounded-card border bg-surface transition-shadow', open ? 'border-brand-teal shadow-card-hover' : 'border-line shadow-card hover:shadow-card-hover', detached && 'border-dashed')}>
          <div className="flex items-center gap-3 p-3.5 sm:p-4">
            <span className="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-2xs font-bold text-muted">{number(node.id)}</span>
            <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', toneClasses[info.tone])}><Icon className="h-5 w-5" aria-hidden="true" /></span>
            <button type="button" className="min-w-0 flex-1 text-start" onClick={() => setOpenId(open ? null : node.id)} aria-expanded={open} disabled={node.type === 'start'}>
              <p className="text-sm font-semibold text-ink">{info.label}</p>
              <p className="truncate text-xs text-muted" dir="auto">{summary || info.desc}</p>
            </button>
            {node.type === 'buttons' && !open && (
              <div className="hidden flex-wrap gap-1 md:flex">{(node.data.buttons || []).slice(0, 3).map((b: FlowButton) => <Badge key={b.id} tone="violet" size="sm">{b.text || '—'}</Badge>)}</div>
            )}
            {node.type !== 'start' && (
              <>
                <Button size="icon-sm" variant="ghost" icon={ChevronDownIcon} aria-label={open ? 'طي الخطوة' : 'تعديل الخطوة'} onClick={() => setOpenId(open ? null : node.id)} className={cn('transition-transform', open && 'rotate-180')} />
                <Button size="icon-sm" variant="ghost" icon={TrashIcon} aria-label={`حذف الخطوة ${number(node.id)}`} onClick={() => removeNode(node.id)} className="hover:text-danger" />
              </>
            )}
          </div>

          {open && (
            <div className="border-t border-line-soft p-4">
              <NodeFields node={node} teamMembers={teamMembers} onChange={data => updateData(node, data)} />
            </div>
          )}

          {slots.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-line-soft bg-surface-2/60 px-4 py-3">
              {slots.map(slot => {
                const target = targetOf(node.id, slot.label)
                return (
                  <div key={slot.label ?? '_'} className="flex flex-wrap items-center gap-2">
                    <ArrowTurnDownLeftIcon className="h-4 w-4 shrink-0 text-muted ltr:-scale-x-100" aria-hidden="true" />
                    <span className={cn('text-xs font-medium', slot.label === 'true' ? 'text-success' : slot.label === 'false' ? 'text-danger' : 'text-muted')}>{slot.title}</span>
                    <div className="min-w-[200px] flex-1 sm:max-w-xs">
                      <Select size="sm" aria-label={`${slot.title} — الخطوة التالية`} value={target}
                        onChange={e => {
                          const v = e.target.value
                          if (v.startsWith('new:')) addNode(v.slice(4) as NodeType, { source: node.id, label: slot.label })
                          else connect(node.id, slot.label, v)
                        }}>
                        <option value="">{node.type === 'question' || node.type === 'buttons' ? 'انتظار رد العميل ثم التوقف' : 'التوقف هنا'}</option>
                        {otherNodes.length > 0 && (
                          <optgroup label="الانتقال إلى">
                            {otherNodes.map(n => <option key={n.id} value={n.id}>{`${number(n.id)} · ${typeInfo(n.type).label}${summaryOf(n, teamName) ? ` — ${summaryOf(n, teamName).slice(0, 40)}` : ''}`}</option>)}
                          </optgroup>
                        )}
                        <optgroup label="خطوة جديدة">
                          {ADDABLE_TYPES.map(t => <option key={t} value={`new:${t}`}>{`+ ${NODE_TYPES[t].label}`}</option>)}
                        </optgroup>
                      </Select>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <span className="mx-auto block h-4 w-px bg-line-strong group-last:hidden" aria-hidden="true" />
      </li>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" icon={ArrowRightIcon} onClick={onBack} className="[&>svg]:ltr:rotate-180">كل المسارات</Button>
        <div className="min-w-[200px] flex-1">
          <Input value={name} size="lg" maxLength={200} placeholder="اسم المسار، مثل: ترحيب العملاء" aria-label="اسم المسار" invalid={nameError}
            className="text-lg font-semibold" onChange={e => { setName(e.target.value); setNameError(false) }} />
        </div>
        <Button variant="secondary" icon={BeakerIcon} onClick={() => onTest(draft())}>اختبار</Button>
        <Button icon={CheckCircleIcon} loading={saving} onClick={save}>حفظ المسار</Button>
      </div>
      {nameError && <p role="alert" className="-mt-3 text-xs font-medium text-danger">اسم المسار مطلوب.</p>}

      <div className="grid items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Trigger */}
        <Card padding="lg" className="lg:sticky lg:top-24">
          <CardHeader title="متى يبدأ المسار؟" />
          <div className="mt-4 flex flex-col gap-2" role="radiogroup" aria-label="نوع المشغّل">
            {triggerOptions.map(t => (
              <button key={t} type="button" role="radio" aria-checked={triggerType === t} onClick={() => setTriggerType(t)}
                className={cn('rounded-card border p-3 text-start transition', triggerType === t ? 'border-brand-teal bg-chip/50 shadow-ring' : 'border-line hover:border-line-strong')}>
                <p className="text-sm font-semibold text-ink">{TRIGGER_TYPES[t]?.label || t}</p>
                <p className="text-xs text-muted">{TRIGGER_TYPES[t]?.desc}</p>
              </button>
            ))}
          </div>
          {triggerType === 'keyword' && (
            <Field label="الكلمات المفتاحية" hint="يبدأ المسار إذا احتوت الرسالة على أيٍّ منها." className="mt-4">
              <KeywordInput value={keywords} onChange={setKeywords} placeholder="مرحبا، أسعار، start…" />
            </Field>
          )}
          <Field label="رقم واتساب" className="mt-4">
            <Select value={instanceId} onChange={e => setInstanceId(e.target.value)}
              options={[{ value: '', label: 'كل الأرقام' }, ...instances.map(i => ({ value: i.id, label: i.display_name || i.phone_number || i.id }))]} />
          </Field>
        </Card>

        {/* Steps */}
        <div className="flex flex-col gap-4">
          <ol className="flex flex-col" aria-label="خطوات المسار">
            {ordered.map(n => renderStep(n))}
          </ol>

          <div className="flex justify-center">
            <Dropdown label="إضافة خطوة" align="start" width="w-64"
              triggerClassName="h-11 border border-dashed border-line-strong bg-surface px-4 text-sm font-medium text-ink hover:border-brand-teal hover:bg-chip/40"
              trigger={<><PlusIcon className="h-[18px] w-[18px]" aria-hidden="true" />إضافة خطوة</>}
              items={ADDABLE_TYPES.map(t => ({ label: NODE_TYPES[t].label, hint: NODE_TYPES[t].desc.slice(0, 18), icon: NODE_TYPES[t].icon, onClick: () => addNode(t) }))} />
          </div>

          {unreachable.length > 0 && (
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm">
                <LinkSlashIcon className="h-4 w-4 text-warning" aria-hidden="true" />
                <span className="font-medium text-ink">خطوات غير متصلة</span>
                <span className="text-muted">— لن تُنفَّذ حتى تربطها بخطوة أخرى.</span>
              </div>
              <ol className="flex flex-col">{unreachable.map(n => renderStep(n, true))}</ol>
            </section>
          )}

          {ordered.length <= 1 && (
            <div className="flex items-start gap-2 rounded-card bg-warning-bg p-3 text-sm text-warning">
              <ExclamationTriangleIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
              أضف خطوة «إرسال رسالة» على الأقل ليرد المسار على العملاء.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ChatbotFlowEditor
