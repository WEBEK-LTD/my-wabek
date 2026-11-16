import {
  ArrowRightStartOnRectangleIcon, ChatBubbleLeftEllipsisIcon, QuestionMarkCircleIcon, QueueListIcon, ArrowsRightLeftIcon,
  ClockIcon, TagIcon, UserPlusIcon, StopCircleIcon,
} from '@heroicons/react/24/outline'
import type { Tone } from '@/components/ui'
import type messages from '@/locales/dashboard/chatbot'

type Key = keyof typeof messages.en
/** The `t` of useT(chatbot messages). */
export type ChatbotT = (key: Key, vars?: Record<string, string | number | null | undefined>) => string

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

/** Start icon: the arrow points into the flow (end side) in both directions. */
function StartIcon({ className, ...p }: React.ComponentProps<'svg'>) {
  return <ArrowRightStartOnRectangleIcon {...p} className={[className, 'rtl:rotate-180'].filter(Boolean).join(' ')} />
}

export const NODE_TYPES: Record<NodeType, { label: Key; desc: Key; icon: React.ElementType; tone: Tone }> = {
  start:     { label: 'n_start',     desc: 'n_start_desc',     icon: StartIcon, tone: 'brand' },
  message:   { label: 'n_message',   desc: 'n_message_desc',   icon: ChatBubbleLeftEllipsisIcon, tone: 'brand' },
  question:  { label: 'n_question',  desc: 'n_question_desc',  icon: QuestionMarkCircleIcon, tone: 'warning' },
  buttons:   { label: 'n_buttons',   desc: 'n_buttons_desc',   icon: QueueListIcon, tone: 'violet' },
  condition: { label: 'n_condition', desc: 'n_condition_desc', icon: ArrowsRightLeftIcon, tone: 'warning' },
  delay:     { label: 'n_delay',     desc: 'n_delay_desc',     icon: ClockIcon, tone: 'neutral' },
  tag:       { label: 'n_tag',       desc: 'n_tag_desc',       icon: TagIcon, tone: 'success' },
  assign:    { label: 'n_assign',    desc: 'n_assign_desc',    icon: UserPlusIcon, tone: 'info' },
  end:       { label: 'n_end',       desc: 'n_end_desc',       icon: StopCircleIcon, tone: 'danger' },
}

export const ADDABLE_TYPES = (Object.keys(NODE_TYPES) as NodeType[]).filter(t => t !== 'start')

export const typeInfo = (type: string) => NODE_TYPES[type as NodeType] || NODE_TYPES.message

export function uid() { return Math.random().toString(36).slice(2, 10) }

/** Default content of a new step, in the UI language (the user edits it). */
export function defaultData(type: NodeType, t: ChatbotT): FlowNode['data'] {
  switch (type) {
    case 'message': return { text: t('d_message') }
    case 'question': return { question: t('d_question'), variable: 'name' }
    case 'buttons': return { text: t('d_buttons'), buttons: [{ id: uid(), text: t('d_option_n', { n: 1 }) }, { id: uid(), text: t('d_option_n', { n: 2 }) }] }
    case 'condition': return { variable: 'answer', operator: 'equals', value: '' }
    case 'delay': return { seconds: 2 }
    case 'tag': return { tags: ['lead'] }
    case 'assign': return { assigned_to: '' }
    case 'end': return { message: t('d_end') }
    default: return {}
  }
}

export const CONDITION_OPERATORS: Array<{ value: string; label: Key }> = [
  { value: 'equals', label: 'op_equals' },
  { value: 'contains', label: 'op_contains' },
  { value: 'starts_with', label: 'op_starts_with' },
  { value: 'not_empty', label: 'op_not_empty' },
]

/** Edge labels of a node's outgoing slots (each slot holds at most one edge). */
export function slotLabels(node: FlowNode): Array<string | null> {
  if (node.type === 'end') return []
  if (node.type === 'condition') return ['true', 'false']
  if (node.type === 'buttons') return ((node.data.buttons || []) as FlowButton[]).filter(b => b.text).map(b => b.text)
  return [null]
}

/** Outgoing connection slots for a node, with a translated title. */
export function slotsOf(node: FlowNode, t: ChatbotT): Array<{ label: string | null; title: string }> {
  if (node.type === 'end') return []
  if (node.type === 'condition') return [{ label: 'true', title: t('slot_true') }, { label: 'false', title: t('slot_false') }]
  if (node.type === 'buttons') {
    const buttons: FlowButton[] = node.data.buttons || []
    return buttons.filter(b => b.text).map(b => ({ label: b.text, title: t('slot_button', { text: b.text }) }))
  }
  if (node.type === 'question') return [{ label: null, title: t('slot_after_answer') }]
  return [{ label: null, title: t('slot_then') }]
}

/** One-line summary of a node for cards and selects. */
export function summaryOf(node: FlowNode, t: ChatbotT, teamName?: (id: string) => string | undefined): string {
  const d = node.data || {}
  switch (node.type) {
    case 'start': return t('sum_start')
    case 'message': return d.text || ''
    case 'question': return d.question ? `${d.question}${d.variable ? ` ← {{${d.variable}}}` : ''}` : ''
    case 'buttons': return d.text || ''
    case 'condition': {
      const opKey = CONDITION_OPERATORS.find(o => o.value === d.operator)?.label
      const op = opKey ? t(opKey) : d.operator
      const v = d.variable || '?'
      return d.operator === 'not_empty' ? t('sum_condition', { var: v, op }) : t('sum_condition_value', { var: v, op, value: d.value || '' })
    }
    case 'delay': return t('sum_seconds', { n: d.seconds || 1 })
    case 'tag': return (d.tags || []).join(t('list_sep'))
    case 'assign': return d.assigned_to ? (teamName?.(d.assigned_to) || t('sum_team_member')) : t('sum_unassigned')
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
    const slots = slotLabels(n)
    out.sort((a, b) => slots.indexOf(a.label ?? null) - slots.indexOf(b.label ?? null))
    for (const e of out) {
      const t = nodes.find(x => x.id === e.target)
      if (t && !seen.has(t.id)) { seen.add(t.id); queue.push(t) }
    }
  }
  return { ordered, unreachable: nodes.filter(n => !seen.has(n.id)) }
}
