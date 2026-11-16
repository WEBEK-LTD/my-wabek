// Campaign helpers shared by the campaign API (create / update / send).
import { z } from 'zod'
import { supabaseAdmin } from './supabase'
import { CampaignContactFilter, cleanSegmentConditions } from './segments'

const LANG = /^[a-z]{2,3}(_[A-Z]{2,4})?$/

export const campaignTemplateFields = {
  template_name: z.string().min(1).max(512).optional(),
  // The template's approved language as listed by Meta (e.g. "ar", "en_US").
  // Omitted → sending tries 'ar', 'en', 'en_US'.
  template_language: z.string().regex(LANG).optional(),
  // Body variable values in order ({{1}}, {{2}} …, or the named params in
  // template_param_names order). Per-contact placeholders: {name}, {phone},
  // {<contact variable>} (also {{name}} …).
  template_variables: z.array(z.string().max(1024)).max(20).optional(),
  // Named-parameter templates: the parameter names, aligned with template_variables.
  template_param_names: z.array(z.string().regex(/^[a-z0-9_]{1,64}$/)).max(20).optional(),
}

/**
 * Resolve a campaign audience filter: a segment id is turned into a copy of
 * that segment's rules (the segment must belong to the account).
 */
export async function resolveContactFilter(
  db: ReturnType<typeof supabaseAdmin>,
  userId: string,
  raw: { tags?: string[]; all?: boolean; segment_id?: string },
  segmentId?: string
): Promise<{ filter: CampaignContactFilter } | { error: string }> {
  const sid = segmentId || raw.segment_id
  if (sid) {
    const { data: seg } = await db.from('contact_segments').select('id, name, conditions, operator')
      .eq('id', sid).eq('user_id', userId).maybeSingle()
    if (!seg) return { error: 'Segment not found' }
    const conditions = cleanSegmentConditions(seg.conditions) || []
    return { filter: { segment_id: seg.id, conditions, operator: seg.operator === 'OR' ? 'OR' : 'AND' } }
  }
  const tags = (raw.tags || []).map(t => t.trim()).filter(Boolean)
  return { filter: tags.length ? { tags } : { all: true } }
}

export async function userTimeZone(db: ReturnType<typeof supabaseAdmin>, userId: string): Promise<string | null> {
  try {
    const { data } = await db.from('users').select('timezone').eq('id', userId).maybeSingle()
    return (data as { timezone?: string | null } | null)?.timezone || null
  } catch { return null }
}


// ── Scheduled time ────────────────────────────────────────────────────────────
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:?\d{2})$/i
const DATETIME_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/

function tzOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value || 0)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'))
  return asUtc - utcMs
}

function validTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz || tz.length > 64) return false
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true } catch { return false }
}

/**
 * Parse a campaign schedule time. Accepts an ISO timestamp with offset
 * ("2026-11-20T09:00:00.000Z", "...+03:00") or a `<input type=datetime-local>`
 * value ("2026-11-20T09:00"), which is read as wall time in `timeZone`
 * (the user's profile time zone) or UTC. Returns an ISO string, or null when
 * the value is not a valid time.
 */
export function parseScheduledAt(value: unknown, timeZone?: string | null): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  if (ISO_WITH_OFFSET.test(v)) {
    const t = Date.parse(v)
    return Number.isFinite(t) ? new Date(t).toISOString() : null
  }
  const m = v.match(DATETIME_LOCAL)
  if (!m) return null
  const [y, mo, d, h, mi, s] = [m[1], m[2], m[3], m[4], m[5], m[6] || '0'].map(Number)
  const wall = Date.UTC(y, mo - 1, d, h, mi, s)
  if (!Number.isFinite(wall)) return null
  if (!validTimeZone(timeZone) || timeZone === 'UTC') return new Date(wall).toISOString()
  // wall time in tz → UTC (second pass handles DST edges)
  let utc = wall - tzOffsetMs(wall, timeZone)
  utc = wall - tzOffsetMs(utc, timeZone)
  return new Date(utc).toISOString()
}

// ── Template variables ────────────────────────────────────────────────────────
export interface CampaignContactVars {
  name: string | null
  phone: string
  variables: Record<string, unknown> | null
}

/**
 * Per-contact substitution in a campaign text / template variable:
 * {name} / {{name}}, {phone} / {{phone}}, and any contact.variables key
 * ({city} / {{city}}). Unknown {{placeholders}} are removed; an unknown
 * {single} brace text is left as written.
 */
export function personalize(text: string, c: CampaignContactVars, fallbackName?: string): string {
  const vars: Record<string, string> = {}
  for (const [k, v] of Object.entries(c.variables || {})) {
    if (v !== null && v !== undefined) vars[k.toLowerCase()] = String(v)
  }
  vars.name = c.name || fallbackName || c.phone
  vars.phone = c.phone
  const has = (k: string) => Object.prototype.hasOwnProperty.call(vars, k)
  return String(text || '')
    .replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_m, a) => { const k = String(a).toLowerCase(); return has(k) ? vars[k] : '' })
    .replace(/\{([\w.-]+)\}/g, (m, b) => { const k = String(b).toLowerCase(); return has(k) ? vars[k] : m })
}

/** Meta template text parameters may not contain newlines/tabs or 4+ spaces. */
export function cleanTemplateParam(v: string): string {
  const out = String(v || '').replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim().slice(0, 1024)
  return out || '-'
}

/**
 * Build the template BODY parameters for one contact.
 *  - `paramNames` set (named-parameter template, e.g. {{customer_name}}):
 *    each value is sent as `parameter_name`.
 *  - otherwise positional: values[0] → {{1}}, values[1] → {{2}} ...
 */
export function buildTemplateBodyParams(values: string[], c: CampaignContactVars, paramNames?: string[] | null): Array<{ type: string; text: string; parameter_name?: string }> {
  return values.map((raw, i) => {
    const text = cleanTemplateParam(personalize(raw, c, 'Customer'))
    const name = paramNames?.[i]
    return name ? { type: 'text', parameter_name: name, text } : { type: 'text', text }
  })
}
