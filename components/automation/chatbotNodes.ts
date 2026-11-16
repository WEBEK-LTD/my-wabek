import {
  ArrowRightStartOnRectangleIcon, ChatBubbleLeftEllipsisIcon, QuestionMarkCircleIcon, QueueListIcon, ArrowsRightLeftIcon,
  ClockIcon, TagIcon, UserPlusIcon, StopCircleIcon,
} from '@heroicons/react/24/outline'
import type { Tone } from '@/components/ui'

/**
 * Chatbot flow data model (stored as-is in chatbot_flows.nodes / .edges and
 * walked by lib/chatbot-engine.ts):
 *   node  { id, type, data, position: { x, y } }
 *   edge  { id, source, target, label }  — label is a button's text for
 *         "buttons" nodes, 'true' / 'false' for "condition", null otherwise.
 */
export type NodeType = 'start' | 'message' | 'question' | 'buttons' | 'condition' | 'delay' | 'tag' | 'assign' | 'end'

export interface FlowButton { id: string; text: string }
export interface FlowNode {
  id: string
  type: NodeType | string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>
  position?: { x: number; y: number }
}
export interface FlowEdge { id: string; source: string; target: string; label: string | null }

export const NODE_TYPES: Record<NodeType, { label: string; desc: string; icon: React.ElementType; tone: Tone }> = {
  start:     { label: 'البداية',        desc: 'نقطة دخول المسار',            icon: ArrowRightStartOnRectangleIcon, tone: 'brand' },
  message:   { label: 'إرسال رسالة',    desc: 'يرسل نصًا للعميل',             icon: ChatBubbleLeftEllipsisIcon, tone: 'brand' },
  question:  { label: 'طرح سؤال',       desc: 'يسأل ويحفظ الإجابة في متغير',  icon: QuestionMarkCircleIcon, tone: 'warning' },
  buttons:   { label: 'أزرار اختيار',   desc: 'يعرض خيارات يختار منها العميل', icon: QueueListIcon, tone: 'violet' },
  condition: { label: 'شرط',            desc: 'يتفرّع حسب قيمة متغير',        icon: ArrowsRightLeftIcon, tone: 'warning' },
  delay:     { label: 'انتظار',         desc: 'ينتظر قبل الخطوة التالية',     icon: ClockIcon, tone: 'neutral' },
  tag:       { label: 'إضافة وسم',      desc: 'يضيف وسمًا لجهة الاتصال',      icon: TagIcon, tone: 'success' },
  assign:    { label: 'تعيين لموظف',    desc: 'يحوّل المحادثة لعضو في الفريق', icon: UserPlusIcon, tone: 'info' },
  end:       { label: 'إنهاء',          desc: 'ينهي المحادثة',                icon: StopCircleIcon, tone: 'danger' },
}

export const ADDABLE_TYPES = (Object.keys(NODE_TYPES) as NodeType[]).filter(t => t !== 'start')

export const typeInfo = (type: string) => NODE_TYPES[type as NodeType] || NODE_TYPES.message

export function uid() { return Math.random().toString(36).slice(2, 10) }

export function defaultData(type: NodeType): FlowNode['data'] {
  switch (type) {
    case 'message': return { text: 'مرحبًا {{name}}! كيف يمكننا مساعدتك؟' }
    case 'question': return { question: 'ما اسمك؟', variable: 'name' }
    case 'buttons': return { text: 'اختر من فضلك:', buttons: [{ id: uid(), text: 'الخيار 1' }, { id: uid(), text: 'الخيار 2' }] }
    case 'condition': return { variable: 'answer', operator: 'equals', value: '' }
    case 'delay': return { seconds: 2 }
    case 'tag': return { tags: ['lead'] }
    case 'assign': return { assigned_to: '' }
    case 'end': return { message: 'شكرًا لتواصلك معنا!' }
    default: return {}
  }
}

export const CONDITION_OPERATORS = [
  { value: 'equals', label: 'يساوي' },
  { value: 'contains', label: 'يحتوي على' },
  { value: 'starts_with', label: 'يبدأ بـ' },
  { value: 'not_empty', label: 'ليس فارغًا' },
]

/** Outgoing connection slots for a node: each slot holds at most one edge. */
export function slotsOf(node: FlowNode): Array<{ label: string | null; title: string }> {
  if (node.type === 'end') return []
  if (node.type === 'condition') return [{ label: 'true', title: 'إذا تحقق الشرط' }, { label: 'false', title: 'إذا لم يتحقق' }]
  if (node.type === 'buttons') {
    const buttons: FlowButton[] = node.data.buttons || []
    return buttons.filter(b => b.text).map(b => ({ label: b.text, title: `عند اختيار «${b.text}»` }))
  }
  if (node.type === 'question') return [{ label: null, title: 'بعد إجابة العميل' }]
  return [{ label: null, title: 'ثم' }]
}

/** One-line summary of a node for cards and selects. */
export function summaryOf(node: FlowNode, teamName?: (id: string) => string | undefined): string {
  const d = node.data || {}
  switch (node.type) {
    case 'start': return 'تبدأ المحادثة هنا'
    case 'message': return d.text || ''
    case 'question': return d.question ? `${d.question}${d.variable ? ` ← {{${d.variable}}}` : ''}` : ''
    case 'buttons': return d.text || ''
    case 'condition': {
      const op = CONDITION_OPERATORS.find(o => o.value === d.operator)?.label || d.operator
      return `إذا كان {{${d.variable || '?'}}} ${op}${d.operator === 'not_empty' ? '' : ` «${d.value || ''}»`}`
    }
    case 'delay': return `${d.seconds || 1} ثانية`
    case 'tag': return (d.tags || []).join('، ')
    case 'assign': return d.assigned_to ? (teamName?.(d.assigned_to) || 'عضو في الفريق') : 'بدون تعيين'
    case 'end': return d.message || ''
    default: return ''
  }
}

/**
 * Order nodes for the step list: breadth-first from the start node,
 * following slots in order; nodes nothing points to come last.
 */
export function orderNodes(nodes: FlowNode[], edges: FlowEdge[]): { ordered: FlowNode[]; unreachable: FlowNode[] } {
  const start = nodes.find(n => n.type === 'start') || nodes[0]
  if (!start) return { ordered: [], unreachable: [] }
  const seen = new Set<string>([start.id])
  const ordered: FlowNode[] = []
  const queue = [start]
  while (queue.length) {
    const n = queue.shift() as FlowNode
    ordered.push(n)
    const out = edges.filter(e => e.source === n.id)
    const slots = slotsOf(n).map(s => s.label)
    out.sort((a, b) => slots.indexOf(a.label ?? null) - slots.indexOf(b.label ?? null))
    for (const e of out) {
      const t = nodes.find(x => x.id === e.target)
      if (t && !seen.has(t.id)) { seen.add(t.id); queue.push(t) }
    }
  }
  return { ordered, unreachable: nodes.filter(n => !seen.has(n.id)) }
}
