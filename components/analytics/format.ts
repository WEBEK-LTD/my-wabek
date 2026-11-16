import Papa from 'papaparse'

/** Arabic month names with Latin digits, as in the dashboard mock ("7 نوفمبر"). */
const LOCALE = 'ar-u-nu-latn'

export function formatDate(value: string | number | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
  if (!value) return '—'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat(LOCALE, opts).format(d)
}

/** "7 نوفمبر" — short day label for chart axes. */
export function formatDay(value: string | Date): string {
  return formatDate(value, { day: 'numeric', month: 'short' })
}

export function formatDateTime(value: string | Date | null | undefined): string {
  return formatDate(value, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
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

/** Readable message from an axios error. */
export function apiError(e: unknown, fallback = 'حدث خطأ غير متوقع'): string {
  const data = (e as { response?: { data?: { error?: string; detail?: string } } })?.response?.data
  if (data?.detail) return data.detail
  return data?.error || fallback
}

export const todayStamp = () => new Date().toISOString().split('T')[0]
