// Shared helpers for the campaigns, contact detail and integrations pages.
import { useAuthStore } from '@/lib/store'
import type { Tone } from '@/components/ui'

/* ── Numbers ──────────────────────────────────────────────── */

const NF = new Intl.NumberFormat('en-US')
export const fmtNum = (n: number | null | undefined) => NF.format(Number(n) || 0)
export const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0)

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
  const canWrite = (area: TeamArea) => {
    if (!role || role === 'admin') return true
    if (role === 'agent') return area === 'contacts'
    return false
  }
  const roleLabel = role === 'viewer' ? 'مشاهد' : role === 'agent' ? 'موظف دعم' : role === 'admin' ? 'مسؤول' : 'المالك'
  return { role, canWrite, roleLabel }
}

/* ── API errors → فصحى ────────────────────────────────────── */

export const MEMBER_FORBIDDEN_MSG = 'لا يسمح دورك في الفريق بهذا الإجراء. اطلب من مالك الحساب أو مسؤول الفريق تنفيذه أو تعديل صلاحياتك.'
export const PLAN_NO_API_MSG = 'باقتك الحالية لا تتضمن الوصول إلى واجهة API. رقِّ باقتك لاستخدام هذه الميزة.'

const KNOWN: Array<[RegExp, string | ((m: RegExpMatchArray) => string)]> = [
  [/^Instance not connected \(status: (.+)\)$/i, m => `رقم واتساب غير متصل (الحالة: ${m[1]}). أعد ربطه من صفحة الأرقام ثم حاول مجددًا.`],
  [/^Instance not found$/i, 'لم يُعثر على رقم واتساب المحدد في حسابك.'],
  [/^Segment not found$/i, 'لم يُعثر على الشريحة المحددة.'],
  [/^Invalid scheduled_at/i, 'موعد الإرسال غير صالح.'],
  [/^Cannot start$/i, 'لا يمكن بدء هذه الحملة في حالتها الحالية.'],
  [/already running or cannot be started/i, 'الحملة قيد الإرسال بالفعل أو لا يمكن بدؤها الآن.'],
  [/^Pause campaign before deleting$/i, 'أوقف الحملة مؤقتًا قبل حذفها.'],
  [/^Cannot edit running campaign$/i, 'لا يمكن تعديل حملة قيد الإرسال.'],
  [/^Campaign not found$/i, 'لم يُعثر على الحملة.'],
  [/^Contact not found$/i, 'لم يُعثر على جهة الاتصال.'],
  [/^Invalid data$/i, 'بعض البيانات المدخلة غير صالحة. راجع الحقول وحاول مجددًا.'],
  [/^target_url must be a public https URL$/i, 'يجب أن يكون الرابط عنوان https عامًّا يمكن الوصول إليه من الإنترنت.'],
  [/^target_url and event required$/i, 'أدخل الرابط واختر حدثًا واحدًا على الأقل.'],
  [/^Webhook not found$/i, 'لم يُعثر على هذا الـ Webhook.'],
  [/^Timeout$/i, 'انتهت المهلة (5 ثوانٍ) دون رد من الرابط.'],
  [/^HTTP (\d{3})$/i, m => `أجاب الرابط بالرمز ${m[1]} بدل رمز نجاح 2xx.`],
  [/outside the 24-hour/i, 'المستلم خارج نافذة الـ 24 ساعة؛ لا يمكن إرسال نص حر إليه. استخدم قالبًا معتمدًا.'],
  [/^Failed to load/i, 'تعذّر تحميل البيانات.'],
]

function translate(msg: string): string {
  for (const [re, out] of KNOWN) {
    const m = msg.match(re)
    if (m) return typeof out === 'string' ? out : out(m)
  }
  return msg
}

interface ApiErrBody { error?: string; message?: string; detail?: string; code?: string; upgrade_required?: boolean }

export function errorBody(e: unknown): ApiErrBody | undefined {
  return (e as { response?: { data?: ApiErrBody } })?.response?.data
}

export function errorStatus(e: unknown): number | undefined {
  return (e as { response?: { status?: number } })?.response?.status
}

export function isMemberForbidden(e: unknown) {
  return errorBody(e)?.code === 'member_forbidden'
}

/** Axios error → a clear Arabic message (team role, plan gating, known API errors). */
export function friendlyError(e: unknown, fallback = 'حدث خطأ غير متوقع، حاول مرة أخرى.'): string {
  const d = errorBody(e)
  if (!d) return (e as Error)?.message === 'Network Error' ? 'تعذّر الاتصال بالخادم. تحقّق من اتصالك بالإنترنت.' : fallback
  if (d.code === 'member_forbidden') return MEMBER_FORBIDDEN_MSG
  if (d.code === 'plan_no_api') return PLAN_NO_API_MSG
  if (d.upgrade_required) {
    const detail = d.detail || ''
    if (/not available on your current plan/i.test(detail)) return 'الحملات غير متاحة في باقتك الحالية. رقِّ باقتك لإنشاء الحملات.'
    const lim = detail.match(/limit \((\d+)\)/i)
    if (lim) return `بلغت الحد الشهري للحملات في باقتك (${lim[1]}). رقِّ باقتك لإنشاء المزيد.`
    return 'بلغت حدًّا من حدود باقتك. رقِّ باقتك للمتابعة.'
  }
  const msg = d.error || d.message
  return msg ? translate(String(msg)) : fallback
}

/* ── Campaign & message statuses ──────────────────────────── */

export const CAMPAIGN_STATUS: Record<string, { label: string; tone: Tone }> = {
  draft:     { label: 'مسودة', tone: 'neutral' },
  scheduled: { label: 'مجدولة', tone: 'warning' },
  running:   { label: 'قيد الإرسال', tone: 'brand' },
  paused:    { label: 'متوقفة مؤقتًا', tone: 'warning' },
  completed: { label: 'مكتملة', tone: 'success' },
  failed:    { label: 'فشلت', tone: 'danger' },
}

export const campaignStatus = (s?: string | null) => CAMPAIGN_STATUS[s || ''] || { label: s || '—', tone: 'neutral' as Tone }

export const MESSAGE_STATUS: Record<string, { label: string; tone: Tone }> = {
  sent:      { label: 'أُرسلت', tone: 'brand' },
  delivered: { label: 'وصلت', tone: 'success' },
  read:      { label: 'قُرئت', tone: 'success' },
  failed:    { label: 'فشلت', tone: 'danger' },
  pending:   { label: 'قيد الانتظار', tone: 'warning' },
  waiting:   { label: 'قيد الانتظار', tone: 'warning' },
  received:  { label: 'مستلمة', tone: 'neutral' },
}

export const messageStatus = (s?: string | null) => MESSAGE_STATUS[s || ''] || { label: s || '—', tone: 'neutral' as Tone }

/** Series colours for the delivery bars (same in light and dark). */
export const DELIVERY_COLORS = {
  read: '#12B5BE',
  delivered: '#8BE07A',
  sent: '#7FD8D3',
  failed: '#F28B9B',
}

/** Result of POST /api/campaigns/[id] {action:'start'} → toast text + tone. */
export function startResultMessage(data: any): { ok: boolean; text: string } {
  if (!data) return { ok: true, text: 'بدأ إرسال الحملة' }
  if (data.success === false) return { ok: false, text: data.error === 'Campaign stopped due to an internal error' ? 'توقفت الحملة بسبب خطأ داخلي.' : friendlyError({ response: { data } }) }
  if (data.message === 'No contacts found') return { ok: true, text: 'لا توجد جهات اتصال مطابقة؛ اكتملت الحملة دون إرسال.' }
  if (data.done) return { ok: true, text: `اكتملت الحملة: أُرسلت إلى ${fmtNum(data.sent)}${data.failed ? ` وفشلت ${fmtNum(data.failed)}` : ''}.` }
  if (data.status === 'paused') return { ok: true, text: `أُوقفت الحملة مؤقتًا وحُفظ التقدم عند ${fmtNum(data.offset)} من ${fmtNum(data.total)}.` }
  if (data.status === 'failed') return { ok: true, text: 'أُلغيت الحملة وحُفظ التقدم.' }
  if (data.offset !== undefined) return { ok: true, text: `أُرسلت دفعة (${fmtNum(data.offset)} من ${fmtNum(data.total)}) وسيُستكمل الإرسال تلقائيًا.` }
  return { ok: true, text: 'بدأ إرسال الحملة' }
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
