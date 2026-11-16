import { useCallback, useMemo } from 'react'
import { useT, type LocaleDict, type Messages } from '@/lib/i18n-local'
import enumMessages from '@/locales/admin/enums'
import apiErrorMessages from '@/locales/admin/api-errors'

type Vars = Record<string, string | number | null | undefined>

/** Keys that come in plural pairs: `foo_one` + `foo_other` → `foo`. */
type PluralBase<M> = { [K in keyof M]: K extends `${infer B}_other` ? B : never }[keyof M]

/**
 * Admin wrapper around `useT` (see lib/i18n-local.ts). Copy lives in
 * `locales/admin/*.ts`; this adds the date formats the admin tables use,
 * tolerant of invalid / unknown input, and `tn` for plural forms.
 *
 *   import messages from '@/locales/admin/users'
 *   const { t, tn, fmtDate } = useAdminT(messages)
 *   t('title')  tn('userCount', n, { n: fmtNumber(n) })
 */
export function useAdminT<M extends Messages>(messages: LocaleDict<M>) {
  const base = useT(messages)
  const { locale, t } = base

  const fmt = useMemo(() => {
    const make = (opts: Intl.DateTimeFormatOptions) => {
      try { return new Intl.DateTimeFormat(locale, opts) } catch { return new Intl.DateTimeFormat('en-GB', opts) }
    }
    let plural: Intl.PluralRules
    try { plural = new Intl.PluralRules(locale) } catch { plural = new Intl.PluralRules('en-GB') }
    return {
      plural,
      date: make({ year: 'numeric', month: 'short', day: 'numeric' }),
      dateTime: make({ year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      time: make({ hour: '2-digit', minute: '2-digit' }),
      short: make({ month: 'short', day: 'numeric' }),
      weekday: make({ weekday: 'short', day: 'numeric' }),
    }
  }, [locale])

  const safe = (v: unknown, f: Intl.DateTimeFormat) => {
    if (!v) return '—'
    const d = v instanceof Date ? v : new Date(String(v))
    return isNaN(d.getTime()) ? '—' : f.format(d)
  }

  /**
   * Plural-aware lookup. Uses the language's plural category when the
   * dictionary has that form (e.g. Arabic `_two` / `_few` / `_many`),
   * otherwise `${base}_one` for "one" and `${base}_other` for the rest.
   */
  const { lang } = base
  const tn = useCallback((key: PluralBase<M>, n: number, vars?: Vars) => {
    const cat = fmt.plural.select(n)
    const table = ((messages as unknown as Record<string, Record<string, string> | undefined>)[lang]) || {}
    const exact = `${String(key)}_${cat}`
    if (cat !== 'one' && cat !== 'other' && exact in table) return t(exact as keyof M, vars)
    return t(`${String(key)}_${cat === 'one' ? 'one' : 'other'}` as keyof M, vars)
  }, [fmt, t, lang, messages])

  return {
    ...base,
    tn,
    fmtDate: (v: unknown) => safe(v, fmt.date),
    fmtDateTime: (v: unknown) => safe(v, fmt.dateTime),
    fmtTime: (v: unknown) => safe(v, fmt.time),
    fmtShort: (v: unknown) => safe(v, fmt.short),
    fmtWeekday: (v: unknown) => safe(v, fmt.weekday),
  }
}

type EnumKey = keyof typeof enumMessages.en
type EnumGroup = EnumKey extends `${infer G}.${string}` ? G : never

/**
 * Label for a backend enum value (status, method, log event…):
 *   const label = useEnumLabel(); label('instance', inst.status)
 * Unknown values come back as-is (or `fallback`), so new server values still show.
 */
export function useEnumLabel() {
  const { t } = useT(enumMessages)
  return useCallback((group: EnumGroup, value: string | null | undefined, fallback?: string) => {
    if (!value) return fallback ?? '—'
    const key = `${group}.${value}`
    return key in enumMessages.en ? t(key as EnumKey) : (fallback ?? value)
  }, [t])
}

/** Translate function returned by `useAdminT` for a given dictionary. */
export type AdminT<M extends Messages> = ReturnType<typeof useAdminT<M>>['t']

/** Raw server message from an axios error (API `{ error }` body), if any. */
function serverMessage(e: unknown): string | null {
  const err = e as { response?: { data?: { error?: unknown; message?: unknown } }; message?: string }
  const msg = err?.response?.data?.error ?? err?.response?.data?.message
  return typeof msg === 'string' && msg ? msg : null
}

type ApiErrorKey = keyof typeof apiErrorMessages.en
/** Known English server messages → dictionary key (exact match, case-insensitive). */
const API_ERRORS: Record<string, ApiErrorKey> = {
  'method not allowed': 'methodNotAllowed',
  'invalid type': 'invalidData', 'invalid status': 'invalidData', 'invalid role': 'invalidData', 'invalid field': 'invalidData',
  'invalid data': 'invalidData', 'invalid input': 'invalidData', 'is_active must be boolean': 'invalidData', 'type must be email or phone': 'invalidData',
  'invalid email': 'invalidEmail', 'invalid phone number': 'invalidPhone', 'invalid image data': 'invalidImage',
  'only png, jpeg, webp, gif or ico images are allowed': 'imageType',
  'must be a valid https:// url': 'httpsUrl',
  'value too long': 'tooLong', 'input too long': 'tooLong', 'reply is too long': 'tooLong',
  'nothing to update': 'nothingToUpdate',
  'failed to save': 'failedSave', 'failed to save settings': 'failedSave',
  'user not found': 'userNotFound', 'plan not found': 'planNotFound', 'reseller not found': 'resellerNotFound',
  'ticket not found': 'ticketNotFound', 'instance not found': 'instanceNotFound',
  'failed to create instance': 'failedCreateInstance', 'failed to load instances': 'failedLoadInstances',
  'failed to update reseller': 'failedUpdateReseller', 'failed to record payout': 'failedRecordPayout', 'failed to create plan': 'failedCreatePlan',
  'amount must be greater than 0': 'amountPositive', 'commission_pct must be between 0 and 100': 'commissionRange',
  'duration_days must be at most 30': 'durationMax30',
  'your plan does not include gift invites': 'noGiftInvites', 'not enough invite credits': 'notEnoughCredits',
  'you can only gift your own plan': 'giftOwnPlan',
  'you cannot suspend your own account': 'cannotSuspendSelf', 'you cannot suspend or demote your own account': 'cannotSuspendSelf',
  'this user has an active stripe subscription. change the plan in stripe, or remove the plan first (which cancels the subscription).': 'activeStripeSub',
  'wa_web_server_url not configured in netlify': 'waWebNotConfigured',
  'vapid keys not configured': 'vapidNotConfigured', 'stripe_secret_key not configured': 'stripeNotConfigured',
  'unknown template key': 'unknownTemplate',
  'too many messages. please try again later.': 'tooManyMessages',
  'no otp instance configured. choose one in settings → security & otp.': 'otpNoInstance',
  'the configured otp instance is not connected': 'otpInstanceNotConnected',
  'this instance is wa web (baileys) — otp is sent as plain text, no meta template needed.': 'otpWaWebNote',
  'support tables not found. run migration 012_support_tickets.sql in supabase sql editor.': 'supportTablesMissing',
  'run migration 012_support_tickets.sql first': 'supportTablesMissing',
  'smtp host is not allowed': 'smtpHostNotAllowed',
  'smtp connection failed. check host, port, encryption and credentials.': 'smtpConnectionFailed',
  'port must be 25, 465, 587 or 2525': 'smtpPort',
  'refresh failed': 'refreshFailed',
  'not connected to google search console': 'gscNotConnected',
  'no api key configured': 'aiNoKey', 'could not reach the ai provider': 'aiUnreachable',
}

/**
 * Translates messages coming from the admin APIs (which answer in English).
 *   const apiError = useApiError()
 *   toast.error(apiError(e, t('failedSave')))   // axios error → known message translated, else server text, else fallback
 *   apiError.text(res.note)                     // a plain server string
 */
export function useApiError() {
  const { t } = useT(apiErrorMessages)
  return useMemo(() => {
    const text = (msg: string | null | undefined): string => {
      if (!msg) return ''
      const m = msg.trim()
      const lower = m.toLowerCase()
      const key = API_ERRORS[lower]
      if (key) return t(key)
      if (lower.startsWith('no otp template name configured')) return t('otpNoTemplate')
      const api = /^api error: (\d+)$/.exec(lower)
      if (api) return t('aiApiError', { status: api[1] })
      if (/^[\w ,]+ (is |are )?required$/.test(lower)) return t('required')
      return m
    }
    const fromError = (e: unknown, fallback: string) => text(serverMessage(e)) || fallback
    return Object.assign(fromError, { text })
  }, [t])
}

/** Money in USD with two decimals and Latin digits. */
export function usd(n: unknown, digits = 2): string {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return '$' + new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v)
}
