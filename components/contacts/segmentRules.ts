/**
 * Segment rule vocabulary — mirrors what /api/segments and
 * /api/segments/preview understand (fields: tags, name, phone, opted_out,
 * is_blocked; one operator per field).
 */
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

export const SEGMENT_FIELDS: Array<{ value: SegmentField; label: string; hint: string }> = [
  { value: 'tags', label: 'الوسم', hint: 'جهات الاتصال التي تحمل وسمًا معيّنًا' },
  { value: 'name', label: 'الاسم', hint: 'يحتوي الاسم على نص' },
  { value: 'phone', label: 'رقم الهاتف', hint: 'يبدأ الرقم بمقدمة دولة أو مشغّل' },
  { value: 'opted_out', label: 'إلغاء الاشتراك', hint: 'من طلبوا إيقاف الرسائل' },
  { value: 'is_blocked', label: 'الحظر', hint: 'جهات الاتصال المحظورة' },
]

export const SEGMENT_OPERATORS: Record<string, Array<{ value: string; label: string }>> = {
  tags: [{ value: 'contains', label: 'يتضمن' }],
  name: [{ value: 'contains', label: 'يحتوي على' }],
  phone: [{ value: 'starts_with', label: 'يبدأ بـ' }],
  opted_out: [{ value: 'equals', label: 'هو' }],
  is_blocked: [{ value: 'equals', label: 'هو' }],
}

export const BOOLEAN_VALUES = [{ value: 'true', label: 'نعم' }, { value: 'false', label: 'لا' }]
export const isBooleanField = (field: string) => field === 'opted_out' || field === 'is_blocked'

export function defaultCondition(field: SegmentField = 'tags'): SegmentCondition {
  return { field, operator: SEGMENT_OPERATORS[field][0].value, value: isBooleanField(field) ? 'false' : '' }
}

export const fieldLabel = (field: string) => SEGMENT_FIELDS.find(f => f.value === field)?.label || field
export const operatorLabel = (field: string, op: string) => SEGMENT_OPERATORS[field]?.find(o => o.value === op)?.label || op
export function valueLabel(c: SegmentCondition) {
  if (isBooleanField(c.field)) return c.value === 'true' ? 'نعم' : 'لا'
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
