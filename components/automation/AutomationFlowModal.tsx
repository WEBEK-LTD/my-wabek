import { useEffect, useState } from 'react'
import {
  ArrowDownIcon, ArrowUpIcon, BoltIcon, ChatBubbleLeftEllipsisIcon, ClockIcon, PlusIcon, TagIcon, TrashIcon,
  QuestionMarkCircleIcon, InboxArrowDownIcon, KeyIcon, UserPlusIcon, CalendarDaysIcon,
} from '@heroicons/react/24/outline'
import { Button, Field, Input, Modal, Select, Textarea, cn, toneClasses } from '@/components/ui'
import type { Tone } from '@/components/ui'
import { KeywordInput } from './KeywordInput'

/**
 * Mirrors automationFlowSchema / automationNodeSchema in lib/automation-engine.ts
 * (kept in sync by hand — that module also imports server-only senders):
 *   trigger_type: keyword | message_received | opt_in | scheduled
 *   node: { id, type: send_message | delay | condition | tag_contact | end, data: Record<string, string>, next?, nextFalse? }
 * The engine runs nodes in order: send_message (data.text), delay (data.seconds,
 * capped at 10s), tag_contact (data.tag).
 */
export type AutomationTrigger = 'keyword' | 'message_received' | 'opt_in' | 'scheduled'
export type AutomationNodeType = 'send_message' | 'delay' | 'condition' | 'tag_contact' | 'end'
export interface AutomationNode { id: string; type: AutomationNodeType; data: Record<string, string>; next?: string; nextFalse?: string }
export interface AutomationDraft {
  id?: string
  name: string
  instance_id: string | null
  trigger_type: AutomationTrigger
  trigger_value: string | null
  nodes: AutomationNode[]
  is_active?: boolean
}

export const TRIGGERS: Record<AutomationTrigger, { label: string; desc: string; icon: React.ElementType }> = {
  keyword: { label: 'كلمة مفتاحية', desc: 'عندما تحتوي الرسالة على إحدى الكلمات', icon: KeyIcon },
  message_received: { label: 'أي رسالة واردة', desc: 'مع كل رسالة تصل إلى الرقم', icon: InboxArrowDownIcon },
  opt_in: { label: 'الاشتراك', desc: 'عند اشتراك جهة الاتصال', icon: UserPlusIcon },
  scheduled: { label: 'مجدول', desc: 'في وقت محدد', icon: CalendarDaysIcon },
}
const SELECTABLE_TRIGGERS: AutomationTrigger[] = ['keyword', 'message_received', 'opt_in']

const ACTIONS: Record<AutomationNodeType, { label: string; icon: React.ElementType; tone: Tone }> = {
  send_message: { label: 'إرسال رسالة', icon: ChatBubbleLeftEllipsisIcon, tone: 'brand' },
  delay: { label: 'انتظار', icon: ClockIcon, tone: 'neutral' },
  tag_contact: { label: 'إضافة وسم', icon: TagIcon, tone: 'success' },
  condition: { label: 'شرط', icon: QuestionMarkCircleIcon, tone: 'warning' },
  end: { label: 'إنهاء', icon: BoltIcon, tone: 'danger' },
}
const ADDABLE: AutomationNodeType[] = ['send_message', 'delay', 'tag_contact']
const MAX_NODES = 50
const MAX_DELAY = 10

const nid = () => `node_${Math.random().toString(36).slice(2, 9)}`
const defaults: Record<AutomationNodeType, Record<string, string>> = {
  send_message: { text: '' }, delay: { seconds: '2' }, tag_contact: { tag: '' }, condition: {}, end: {},
}

export const emptyAutomation = (): AutomationDraft => ({
  name: '', instance_id: null, trigger_type: 'keyword', trigger_value: '', nodes: [{ id: 'node1', type: 'send_message', data: { text: '' } }],
})

interface Props {
  open: boolean
  initial: AutomationDraft | null
  instances: Array<{ id: string; display_name?: string | null; phone_number?: string | null }>
  saving: boolean
  onClose: () => void
  onSave: (draft: AutomationDraft) => void
}

export function AutomationFlowModal({ open, initial, instances, saving, onClose, onSave }: Props) {
  const [d, setD] = useState<AutomationDraft>(initial || emptyAutomation())
  const [touched, setTouched] = useState(false)
  useEffect(() => { if (open) { setD(initial || emptyAutomation()); setTouched(false) } }, [open, initial])

  const keywords = (d.trigger_value || '').split(',').map(k => k.trim()).filter(Boolean)
  const setNode = (i: number, data: Record<string, string>) => setD(x => ({ ...x, nodes: x.nodes.map((n, j) => (j === i ? { ...n, data: { ...n.data, ...data } } : n)) }))
  const move = (i: number, dir: -1 | 1) => setD(x => {
    const nodes = [...x.nodes]
    const j = i + dir
    if (j < 0 || j >= nodes.length) return x
    ;[nodes[i], nodes[j]] = [nodes[j], nodes[i]]
    return { ...x, nodes }
  })
  const add = (type: AutomationNodeType) => setD(x => ({ ...x, nodes: [...x.nodes, { id: nid(), type, data: { ...defaults[type] } }] }))
  const remove = (i: number) => setD(x => ({ ...x, nodes: x.nodes.filter((_, j) => j !== i) }))

  const errors = {
    name: !d.name.trim() ? 'اسم الأتمتة مطلوب' : '',
    keywords: d.trigger_type === 'keyword' && !keywords.length ? 'أضف كلمة مفتاحية واحدة على الأقل' : '',
    nodes: d.nodes.some(n => (n.type === 'send_message' && !n.data.text?.trim()) || (n.type === 'tag_contact' && !n.data.tag?.trim())) ? 'أكمل كل الإجراءات أو احذف الفارغ منها' : '',
  }
  const valid = !errors.name && !errors.keywords && !errors.nodes

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!valid) return
    onSave({ ...d, name: d.name.trim(), trigger_value: d.trigger_type === 'keyword' ? keywords.join(', ') : (d.trigger_value || null) })
  }

  const triggerChoices = SELECTABLE_TRIGGERS.includes(d.trigger_type) ? SELECTABLE_TRIGGERS : [...SELECTABLE_TRIGGERS, d.trigger_type]

  return (
    <Modal open={open} onClose={onClose} size="lg" icon={BoltIcon} title={initial?.id ? 'تعديل الأتمتة' : 'أتمتة جديدة'}
      description="عندما يحدث المشغّل، تُنفَّذ الإجراءات بالترتيب."
      footer={<><Button variant="secondary" onClick={onClose}>إلغاء</Button><Button type="submit" form="automation-form" loading={saving}>{initial?.id ? 'حفظ التغييرات' : 'إنشاء الأتمتة'}</Button></>}>
      <form id="automation-form" onSubmit={submit} className="flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="الاسم" required error={touched ? errors.name || undefined : undefined}>
            <Input value={d.name} maxLength={200} placeholder="رسالة ترحيب" onChange={e => setD(x => ({ ...x, name: e.target.value }))} />
          </Field>
          <Field label="رقم واتساب">
            <Select value={d.instance_id || ''} onChange={e => setD(x => ({ ...x, instance_id: e.target.value || null }))}
              options={[{ value: '', label: 'كل الأرقام' }, ...instances.map(i => ({ value: i.id, label: i.display_name || i.phone_number || i.id }))]} />
          </Field>
        </div>

        {/* Trigger */}
        <section>
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink"><span className="rounded-full bg-chip px-2 py-0.5 text-2xs font-bold text-chip-ink">عندما</span>المشغّل</p>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="المشغّل">
            {triggerChoices.map(t => {
              const T = TRIGGERS[t]
              const on = d.trigger_type === t
              return (
                <button key={t} type="button" role="radio" aria-checked={on} onClick={() => setD(x => ({ ...x, trigger_type: t }))}
                  className={cn('flex items-start gap-2.5 rounded-card border p-3 text-start transition', on ? 'border-brand-teal bg-chip/50 shadow-ring' : 'border-line hover:border-line-strong')}>
                  <T.icon className={cn('mt-0.5 h-5 w-5 shrink-0', on ? 'text-brand-ink' : 'text-muted')} aria-hidden="true" />
                  <span><span className="block text-sm font-semibold text-ink">{T.label}</span><span className="block text-xs text-muted">{T.desc}</span></span>
                </button>
              )
            })}
          </div>
          {d.trigger_type === 'keyword' && (
            <Field label="الكلمات المفتاحية" className="mt-3" error={touched ? errors.keywords || undefined : undefined}>
              <KeywordInput value={keywords} onChange={v => setD(x => ({ ...x, trigger_value: v.join(', ') }))} placeholder="مرحبا، hello، start…" />
            </Field>
          )}
        </section>

        {/* Actions */}
        <section>
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink"><span className="rounded-full bg-violet-bg px-2 py-0.5 text-2xs font-bold text-violet">نفّذ</span>الإجراءات</p>
          <ol className="flex flex-col gap-2">
            {d.nodes.map((n, i) => {
              const A = ACTIONS[n.type] || ACTIONS.send_message
              const supported = ADDABLE.includes(n.type)
              return (
                <li key={n.id} className="rounded-card border border-line bg-surface-2 p-3">
                  <div className="flex items-center gap-2.5">
                    <span className="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface text-2xs font-bold text-muted">{i + 1}</span>
                    <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', toneClasses[A.tone])}><A.icon className="h-[18px] w-[18px]" aria-hidden="true" /></span>
                    <span className="flex-1 text-sm font-semibold text-ink">{A.label}</span>
                    <Button type="button" size="icon-sm" variant="ghost" icon={ArrowUpIcon} aria-label="نقل لأعلى" disabled={i === 0} onClick={() => move(i, -1)} />
                    <Button type="button" size="icon-sm" variant="ghost" icon={ArrowDownIcon} aria-label="نقل لأسفل" disabled={i === d.nodes.length - 1} onClick={() => move(i, 1)} />
                    <Button type="button" size="icon-sm" variant="ghost" icon={TrashIcon} aria-label={`حذف الإجراء ${i + 1}`} className="hover:text-danger" onClick={() => remove(i)} />
                  </div>
                  <div className="mt-3 ps-[4.25rem]">
                    {n.type === 'send_message' && (
                      <Textarea rows={3} maxLength={4096} aria-label={`نص الرسالة ${i + 1}`} value={n.data.text || ''}
                        placeholder={'مرحبًا! شكرًا لتواصلك معنا.\n\nكيف يمكننا مساعدتك؟'} onChange={e => setNode(i, { text: e.target.value })} />
                    )}
                    {n.type === 'delay' && (
                      <div className="flex items-center gap-2">
                        <Input type="number" min={1} max={MAX_DELAY} aria-label={`مدة الانتظار ${i + 1}`} className="max-w-[120px]" value={n.data.seconds || '2'}
                          onChange={e => setNode(i, { seconds: String(Math.max(1, Math.min(MAX_DELAY, parseInt(e.target.value, 10) || 1))) })} />
                        <span className="text-sm text-muted">ثانية (حتى {MAX_DELAY} ثوانٍ)</span>
                      </div>
                    )}
                    {n.type === 'tag_contact' && (
                      <Input aria-label={`الوسم ${i + 1}`} maxLength={100} value={n.data.tag || ''} placeholder="lead" onChange={e => setNode(i, { tag: e.target.value })} />
                    )}
                    {!supported && <p className="text-xs text-muted">هذا الإجراء محفوظ من إصدار سابق ولا ينفّذه المحرك حاليًا.</p>}
                  </div>
                </li>
              )
            })}
          </ol>
          {touched && errors.nodes && <p role="alert" className="mt-2 text-xs font-medium text-danger">{errors.nodes}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {ADDABLE.map(t => {
              const A = ACTIONS[t]
              return <Button key={t} type="button" size="sm" variant="secondary" icon={PlusIcon} disabled={d.nodes.length >= MAX_NODES} onClick={() => add(t)}>{A.label}</Button>
            })}
          </div>
        </section>
      </form>
    </Modal>
  )
}

export default AutomationFlowModal
