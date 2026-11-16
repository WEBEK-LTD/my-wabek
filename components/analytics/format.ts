import Papa from 'papaparse'
import { localeFor } from '@/lib/i18n-local'
import { currentLang, errorBody, knownCodeMessage, tc, translateServerMessage } from '@/components/campaigns/shared'

/**
 * Date helpers for the analytics-style pages. Pass `locale` from useT(); when
 * it is omitted the current UI language is used (Latin digits in Arabic).
 */
export function formatDate(value: string | number | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }, locale?: string): string {
  if (!value) return '—'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  const loc = locale || localeFor(currentLang())
  try { return new Intl.DateTimeFormat(loc, opts).format(d) } catch { return new Intl.DateTimeFormat('en-GB', opts).format(d) }
}

/** "7 Nov" — short day label for chart axes. */
export function formatDay(value: string | Date, locale?: string): string {
  return formatDate(value, { day: 'numeric', month: 'short' }, locale)
}

export function formatDateTime(value: string | Date | null | undefined, locale?: string): string {
  return formatDate(value, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }, locale)
}

/** Percentage helper that never divides by zero. */
export function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0
}

/** Download rows as a UTF-8 CSV (with BOM so Excel shows Arabic correctly). */
export function downloadCSV(filename: string, rows: Array<Array<string | number | null | undefined>>) {
  const csv = Papa.unparse(rows.map(r => r.map(v => (v === null || v === undefined ? '' : v))))
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Readable message from an axios error, in the UI language: known error
 * codes (member_forbidden, plan_limit, …) and messages are translated; other
 * server text is shown as-is, then `fallback`.
 */
export function apiError(e: unknown, fallback?: string): string {
  const data = errorBody(e)
  const known = knownCodeMessage(data)
  if (known) return known
  if (data?.detail) return data.detail
  if (data?.error) return translateServerMessage(String(data.error))
  if (!data && (e as Error)?.message === 'Network Error') return tc('err_network')
  return fallback ?? tc('err_unexpected')
}

export const todayStamp = () => new Date().toISOString().split('T')[0]
