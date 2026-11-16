/**
 * Segment rule vocabulary — mirrors what /api/segments and
 * /api/segments/preview understand (fields: tags, name, phone, opted_out,
 * is_blocked; one operator per field). Labels live in locales/dashboard/segments.
 */
import type messages from '@/locales/dashboard/segments'

export type SegmentField = 'tags' | 'name' | 'phone' | 'opted_out' | 'is_blocked'

export interface SegmentCondition { field: SegmentField | string; operator: string; value: string }

export interface Segment {
  id: string
  name: string
  description: string | null
  conditions: SegmentCondition[] | null
  operator: 'AND' | 'OR' | null
  contact_count: number | null
  created_at: string
}

type Key = keyof typeof messages.en
/** The `t` of useT(segments messages). */
export type SegmentT = (key: Key, vars?: Record<string, string | number | null | undefined>) => string

export const SEGMENT_FIELDS: Array<{ value: SegmentField; labelKey: Key; hintKey: Key }> = [
  { value: 'tags', labelKey: 'field_tags', hintKey: 'field_tags_hint' },
  { value: 'name', labelKey: 'field_name', hintKey: 'field_name_hint' },
  { value: 'phone', labelKey: 'field_phone', hintKey: 'field_phone_hint' },
  { value: 'opted_out', labelKey: 'field_opted_out', hintKey: 'field_opted_out_hint' },
  { value: 'is_blocked', labelKey: 'field_is_blocked', hintKey: 'field_is_blocked_hint' },
]

export const SEGMENT_OPERATORS: Record<string, Array<{ value: string; labelKey: Key }>> = {
  tags: [{ value: 'contains', labelKey: 'op_tags_contains' }],
  name: [{ value: 'contains', labelKey: 'op_contains' }],
  phone: [{ value: 'starts_with', labelKey: 'op_starts_with' }],
  opted_out: [{ value: 'equals', labelKey: 'op_is' }],
  is_blocked: [{ value: 'equals', labelKey: 'op_is' }],
}

export const booleanValues = (t: SegmentT) => [{ value: 'true', label: t('yes') }, { value: 'false', label: t('no') }]
export const isBooleanField = (field: string) => field === 'opted_out' || field === 'is_blocked'

export function defaultCondition(field: SegmentField = 'tags'): SegmentCondition {
  return { field, operator: SEGMENT_OPERATORS[field][0].value, value: isBooleanField(field) ? 'false' : '' }
}

const OPERATOR_FALLBACK: Record<string, Key> = { contains: 'op_contains', starts_with: 'op_starts_with', equals: 'op_equals' }

export const fieldLabel = (field: string, t: SegmentT) => {
  const f = SEGMENT_FIELDS.find(x => x.value === field)
  return f ? t(f.labelKey) : field
}
export const operatorLabel = (field: string, op: string, t: SegmentT) => {
  const o = SEGMENT_OPERATORS[field]?.find(x => x.value === op)
  if (o) return t(o.labelKey)
  return OPERATOR_FALLBACK[op] ? t(OPERATOR_FALLBACK[op]) : op
}
export function valueLabel(c: SegmentCondition, t: SegmentT) {
  if (isBooleanField(c.field)) return c.value === 'true' ? t('yes') : t('no')
  return c.value
}

/** A condition is complete when it has a value (boolean fields always do). */
export const isComplete = (c: SegmentCondition) => isBooleanField(c.field) || !!c.value.trim()

/**
 * Segments are rule-based, so contacts cannot be "put into" one directly.
 * When a segment is defined only by tags, adding those tags to contacts
 * makes them match it. Returns the tags to add, or null when the segment
 * also depends on other fields.
 */
export function segmentTags(seg: Pick<Segment, 'conditions' | 'operator'>): string[] | null {
  const conds = seg.conditions || []
  const tagConds = conds.filter(c => c.field === 'tags' && c.operator === 'contains' && c.value)
  if (!tagConds.length) return null
  if ((seg.operator || 'AND') === 'OR') return [tagConds[0].value]
  if (tagConds.length !== conds.length) return null
  return Array.from(new Set(tagConds.map(c => c.value)))
}
