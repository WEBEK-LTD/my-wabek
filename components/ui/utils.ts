import clsx from 'clsx'

/** Class-name joiner (clsx). */
export const cn = clsx

export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'violet' | 'danger' | 'info'

/** Tinted background + readable text for each tone (AA on its own background). */
export const toneClasses: Record<Tone, string> = {
  neutral: 'bg-surface-3 text-muted',
  brand:   'bg-chip text-chip-ink',
  info:    'bg-chip text-chip-ink',
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  violet:  'bg-violet-bg text-violet',
  danger:  'bg-danger-bg text-danger',
}

/** Solid dot colour per tone. */
export const toneDot: Record<Tone, string> = {
  neutral: 'bg-muted',
  brand:   'bg-brand-teal',
  info:    'bg-brand-teal',
  success: 'bg-success',
  warning: 'bg-warning',
  violet:  'bg-violet',
  danger:  'bg-danger',
}

/** Brand chart palette (works on light and dark surfaces). */
export const CHART_COLORS = ['#12B5BE', '#8BE07A', '#F5C26B', '#B59CF5', '#5FD6D0', '#F28B9B']

/** Format numbers with the current locale digits (Latin digits by default). */
export function formatNumber(n: number | string | null | undefined, opts?: Intl.NumberFormatOptions): string {
  if (n === null || n === undefined || n === '') return '—'
  const v = typeof n === 'string' ? Number(n) : n
  if (!Number.isFinite(v)) return String(n)
  return new Intl.NumberFormat('en-US', opts).format(v)
}
