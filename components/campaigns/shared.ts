// Shared helpers for the campaigns, contact detail and integrations pages.
import { useAuthStore } from '@/lib/store'
import type { Tone } from '@/components/ui'
import { getStoredLang } from '@/lib/i18n'
import { localeFor, translate, useT } from '@/lib/i18n-local'
import common from '@/locales/dashboard/common-a'

/* ── Numbers ──────────────────────────────────────────────── */

const NF = new Intl.NumberFormat('en-US')
/** Locale-neutral fallback; in components prefer fmtNumber from useT(). */
export const fmtNum = (n: number | null | undefined) => NF.format(Number(n) || 0)
export const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0)

/* ── Language (for helpers called outside render) ─────────── */

const SUPPORTED_LANGS = ['en', 'ar', 'fr', 'tr']

/**
 * The current UI language, read imperatively (same priority as
 * useTranslation: profile language, then this device's choice). Used by the
 * message helpers below, which run in event handlers rather than in render.
 */
export function currentLang(): string {
  const u = useAuthStore.getState().user?.language
  if (u && SUPPORTED_LANGS.includes(u)) return u
  return getStoredLang()
}

export type CommonKey = keyof typeof common.en
type Vars = Record<string, string | number | null | undefined>
/** Translate a shared (common-a) key in the current language. */
export const tc = (key: CommonKey, vars?: Vars) => translate(common, currentLang(), key, vars)
const fmtN = (n: unknown) => {
  try { return new Intl.NumberFormat(localeFor(currentLang())).format(Number(n) || 0) } catch { return fmtNum(Number(n)) }
}

/* ── Team role ────────────────────────────────────────────── */

export type TeamArea = 'campaigns' | 'contacts' | 'integrations'

/**
 * Mirrors the server rule in lib/auth.ts (memberCan): owners and team admins
 * may write everywhere, agents only in contacts / inbox, viewers nowhere.
 * Used to hide write actions up front; the API still enforces it (403
 * `member_forbidden`), which friendlyError() explains.
 */
export function useTeamRole() {
  const role = useAuthStore(s => s.user?.member_role) || null
  const { t } = useT(common)
  const canWrite = (area: TeamArea) => {
    if (!role || role === 'admin') return true
    if (role === 'agent') return area === 'contacts'
    return false
  }
  const roleLabel = role === 'viewer' ? t('role_viewer') : role === 'agent' ? t('role_agent') : role === 'admin' ? t('role_admin') : t('role_owner')
  return { role, canWrite, roleLabel }
}

/* ── API errors → the UI language ─────────────────────────── */

const KNOWN: Array<[RegExp, CommonKey | ((m: RegExpMatchArray) => string)]> = [
  [/^Instance not connected \(status: (.+)\)$/i, m => tc('err_instance_not_connected', { status: m[1] })],
  [/^Instance not found$/i, 'err_instance_not_found'],
  [/^Segment not found$/i, 'err_segment_not_found'],
  [/^Invalid scheduled_at/i, 'err_invalid_scheduled_at'],
  [/^Cannot start$/i, 'err_cannot_start'],
  [/already running or cannot be started/i, 'err_already_running'],
  [/^Pause campaign before deleting$/i, 'err_pause_before_delete'],
  [/^Cannot edit running campaign$/i, 'err_cannot_edit_running'],
  [/^Campaign not found$/i, 'err_campaign_not_found'],
  [/^Contact not found$/i, 'err_contact_not_found'],
  [/^Invalid data$/i, 'err_invalid_data'],
  [/^target_url must be a public https URL$/i, 'err_target_url_public'],
  [/^target_url and event required$/i, 'err_target_url_event_required'],
  [/^Webhook not found$/i, 'err_webhook_not_found'],
  [/^Timeout$/i, 'err_timeout'],
  [/^HTTP (\d{3})$/i, m => tc('err_http_status', { code: m[1] })],
  [/outside the 24-hour/i, 'err_outside_window'],
  [/^Failed to load/i, 'err_failed_to_load'],
]

/** Known server message → translated text; unknown messages are returned as-is. */
export function translateServerMessage(msg: string): string {
  for (const [re, out] of KNOWN) {
    const m = msg.match(re)
    if (m) return typeof out === 'string' ? tc(out) : out(m)
  }
  return msg
}

export interface ApiErrBody { error?: string; message?: string; detail?: string; code?: string; upgrade_required?: boolean; limit?: number }

export function errorBody(e: unknown): ApiErrBody | undefined {
  return (e as { response?: { data?: ApiErrBody } })?.response?.data
}

export function errorStatus(e: unknown): number | undefined {
  return (e as { response?: { status?: number } })?.response?.status
}

export function isMemberForbidden(e: unknown) {
  return errorBody(e)?.code === 'member_forbidden'
}

/** Translated message for a known API error `code`, or null. */
export function knownCodeMessage(d: ApiErrBody | undefined): string | null {
  if (!d?.code) return null
  switch (d.code) {
    case 'member_forbidden': return tc('err_member_forbidden')
    case 'plan_no_api': return tc('err_plan_no_api')
    case 'plan_limit': return typeof d.limit === 'number' && d.limit > 0 ? tc('err_plan_limit_n', { n: fmtN(d.limit) }) : tc('err_plan_limit')
    case 'outside_window': return tc('err_outside_window')
    case 'rate_limited': return tc('err_rate_limited')
    case 'opted_out': return tc('err_opted_out')
    case 'blocked': return tc('err_blocked')
    case 'no_instance': return tc('err_no_instance')
    default: return null
  }
}

/** Axios error → a clear message in the UI language (team role, plan gating, known API errors). */
export function friendlyError(e: unknown, fallback?: string): string {
  const fb = fallback ?? tc('err_unexpected')
  const d = errorBody(e)
  if (!d) return (e as Error)?.message === 'Network Error' ? tc('err_network') : fb
  const known = knownCodeMessage(d)
  if (known) return known
  if (d.upgrade_required) {
    const detail = d.detail || ''
    if (/not available on your current plan/i.test(detail)) return tc('err_campaigns_not_in_plan')
    const lim = detail.match(/limit \((\d+)\)/i)
    if (lim) return tc('err_campaign_limit', { n: lim[1] })
    return tc('err_plan_limit')
  }
  const msg = d.error || d.message
  return msg ? translateServerMessage(String(msg)) : fb
}

/* ── Campaign & message statuses ──────────────────────────── */

type Translator = (key: CommonKey, vars?: Vars) => string

const CAMPAIGN_STATUS: Record<string, { key: CommonKey; tone: Tone }> = {
  draft:     { key: 'cs_draft', tone: 'neutral' },
  scheduled: { key: 'cs_scheduled', tone: 'warning' },
  running:   { key: 'cs_running', tone: 'brand' },
  paused:    { key: 'cs_paused', tone: 'warning' },
  completed: { key: 'cs_completed', tone: 'success' },
  failed:    { key: 'cs_failed', tone: 'danger' },
}

/** Status label + tone; pass the `t` of useT(common). */
export const campaignStatus = (s: string | null | undefined, t: Translator) => {
  const st = CAMPAIGN_STATUS[s || '']
  return st ? { label: t(st.key), tone: st.tone } : { label: s || '—', tone: 'neutral' as Tone }
}

const MESSAGE_STATUS: Record<string, { key: CommonKey; tone: Tone }> = {
  sent:      { key: 'ms_sent', tone: 'brand' },
  delivered: { key: 'ms_delivered', tone: 'success' },
  read:      { key: 'ms_read', tone: 'success' },
  failed:    { key: 'ms_failed', tone: 'danger' },
  pending:   { key: 'ms_pending', tone: 'warning' },
  waiting:   { key: 'ms_pending', tone: 'warning' },
  received:  { key: 'ms_received', tone: 'neutral' },
}

/** Message status label + tone; pass the `t` of useT(common). */
export const messageStatus = (s: string | null | undefined, t: Translator) => {
  const st = MESSAGE_STATUS[s || '']
  return st ? { label: t(st.key), tone: st.tone } : { label: s || '—', tone: 'neutral' as Tone }
}

/** Series colours for the delivery bars (same in light and dark). */
export const DELIVERY_COLORS = {
  read: '#12B5BE',
  delivered: '#8BE07A',
  sent: '#7FD8D3',
  failed: '#F28B9B',
}

/** Result of POST /api/campaigns/[id] {action:'start'} → toast text + tone. */
export function startResultMessage(data: any): { ok: boolean; text: string } {
  if (!data) return { ok: true, text: tc('start_started') }
  if (data.success === false) return { ok: false, text: data.error === 'Campaign stopped due to an internal error' ? tc('err_campaign_internal_stop') : friendlyError({ response: { data } }) }
  if (data.message === 'No contacts found') return { ok: true, text: tc('start_no_contacts') }
  if (data.done) return { ok: true, text: data.failed ? tc('start_done_failed', { sent: fmtN(data.sent), failed: fmtN(data.failed) }) : tc('start_done', { sent: fmtN(data.sent) }) }
  if (data.status === 'paused') return { ok: true, text: tc('start_paused', { offset: fmtN(data.offset), total: fmtN(data.total) }) }
  if (data.status === 'failed') return { ok: true, text: tc('start_cancelled') }
  if (data.offset !== undefined) return { ok: true, text: tc('start_batch', { offset: fmtN(data.offset), total: fmtN(data.total) }) }
  return { ok: true, text: tc('start_started') }
}

/** Browser time zone and its UTC offset, e.g. { zone: 'Asia/Riyadh', offset: 'UTC+03:00' }. */
export function browserTimeZone(at: Date = new Date()): { zone: string; offset: string } {
  let zone = 'UTC'
  try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } catch { /* old browsers */ }
  const mins = -at.getTimezoneOffset()
  const sign = mins >= 0 ? '+' : '-'
  const abs = Math.abs(mins)
  const offset = `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`
  return { zone, offset }
}
