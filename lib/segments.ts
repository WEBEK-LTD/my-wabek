// Contact segment rules — one implementation for the segment preview/count
// endpoints and for campaigns that target a segment.
import { escapeFilterValue } from './security'
import { supabaseAdmin } from './supabase'

export interface SegmentCondition { field: string; operator: string; value: string }

export const SEGMENT_FIELDS = ['tags', 'name', 'phone', 'opted_out', 'is_blocked'] as const

/** Validate raw conditions from a request body. Null = invalid. */
export function cleanSegmentConditions(raw: unknown): SegmentCondition[] | null {
  if (raw === undefined || raw === null) return []
  if (!Array.isArray(raw) || raw.length > 20) return null
  const out: SegmentCondition[] = []
  for (const c of raw) {
    if (!c || typeof c !== 'object' || !(SEGMENT_FIELDS as readonly string[]).includes((c as any).field)) return null
    out.push({
      field: String((c as any).field),
      operator: String((c as any).operator || '').slice(0, 20),
      value: String((c as any).value ?? '').slice(0, 100),
    })
  }
  return out
}

/** PostgREST `or=` fragment for one condition, or null when it has no effect. */
function orFragment(c: SegmentCondition): string | null {
  const v = escapeFilterValue(c.value)
  if (c.field === 'tags' && c.operator === 'contains' && v) return `tags.cs.{"${v}"}`
  if (c.field === 'name' && c.operator === 'contains' && v) return `name.ilike.*${v}*`
  if (c.field === 'phone' && c.operator === 'starts_with' && v) return `phone.like.${v}*`
  if (c.field === 'opted_out') return `opted_out.eq.${c.value === 'true'}`
  if (c.field === 'is_blocked') return `is_blocked.eq.${c.value === 'true'}`
  return null
}

/**
 * Apply segment conditions to a Supabase query on `contacts`.
 * `operator` 'AND' (default) requires every condition, 'OR' any of them.
 */
export function applySegmentConditions<Q>(query: Q, conditions: SegmentCondition[], operator: string = 'AND'): Q {
  const q: any = query
  if (!Array.isArray(conditions) || !conditions.length) return q
  if (operator === 'OR') {
    const parts = conditions.map(orFragment).filter(Boolean) as string[]
    return parts.length ? q.or(parts.join(',')) : q
  }
  let out = q
  for (const c of conditions) {
    if (c.field === 'tags' && c.operator === 'contains' && c.value) {
      out = out.contains('tags', [String(c.value).slice(0, 100)])
    } else if (c.field === 'name' && c.operator === 'contains' && c.value) {
      out = out.ilike('name', `%${escapeFilterValue(c.value)}%`)
    } else if (c.field === 'phone' && c.operator === 'starts_with' && c.value) {
      out = out.like('phone', `${escapeFilterValue(c.value)}%`)
    } else if (c.field === 'opted_out') {
      out = out.eq('opted_out', c.value === 'true')
    } else if (c.field === 'is_blocked') {
      out = out.eq('is_blocked', c.value === 'true')
    }
  }
  return out
}

/**
 * Campaign audience filter stored in campaigns.contact_filter:
 *   { all: true } | { tags: [...], tag_operator? } | { segment_id, conditions, operator }
 * tag_operator: 'any' (default — has at least one of the tags) or 'all'.
 * The segment's rules are copied in at creation so editing or deleting the
 * segment later does not silently change who a scheduled campaign targets.
 */
export interface CampaignContactFilter {
  all?: boolean
  tags?: string[]
  tag_operator?: 'any' | 'all'
  segment_id?: string
  conditions?: SegmentCondition[]
  operator?: 'AND' | 'OR'
}

export function applyCampaignFilter<Q>(query: Q, filter: CampaignContactFilter | null | undefined): Q {
  let q: any = query
  const f = filter || {}
  if (Array.isArray(f.tags) && f.tags.length) q = f.tag_operator === 'all' ? q.contains('tags', f.tags) : q.overlaps('tags', f.tags)
  if (Array.isArray(f.conditions) && f.conditions.length) q = applySegmentConditions(q, f.conditions, f.operator || 'AND')
  return q
}

/**
 * Exact number of recipients a campaign with this filter would target — the
 * same query the sender runs (blocked and opted-out contacts excluded).
 */
export async function countCampaignAudience(userId: string, filter: CampaignContactFilter): Promise<number> {
  const query = applyCampaignFilter(
    supabaseAdmin().from('contacts').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('is_blocked', false).eq('opted_out', false),
    filter)
  const { count, error } = await query
  if (error) throw new Error(error.message)
  return count || 0
}

export async function countSegmentContacts(userId: string, conditions: SegmentCondition[], operator: string): Promise<number> {
  const query = applySegmentConditions(
    supabaseAdmin().from('contacts').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    conditions, operator)
  const { count } = await query
  return count || 0
}
