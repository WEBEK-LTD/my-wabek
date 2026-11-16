import React from 'react'
import { cn } from './utils'

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  max?: number
  size?: 'xs' | 'sm' | 'md' | 'lg'
  /** Fill style. "gradient" = brand teal→green (default). */
  tone?: 'gradient' | 'dark' | 'brand' | 'success' | 'warning' | 'danger' | 'on-gradient'
  /** Visible label above the bar (also used as the accessible name). */
  label?: React.ReactNode
  /** Accessible name when no visible label is shown. */
  'aria-label'?: string
  /** Show the percentage at the end of the label row (or next to the bar when no label). */
  showValue?: boolean
  /** Custom value text, e.g. "48,210 / 100,000". */
  valueText?: string
  trackClassName?: string
}

const heights = { xs: 'h-1', sm: 'h-1.5', md: 'h-2', lg: 'h-2.5' }
const fills = {
  gradient: 'bg-brand-gradient-x',
  dark: 'bg-[#04282C] dark:bg-[#EAF7F5]',
  brand: 'bg-brand-teal',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  'on-gradient': 'bg-[#04282C]',
}

/**
 * ProgressBar — gradient bar on a soft track. Fill grows from the start side (right in RTL).
 *
 *   <ProgressBar value={84} showValue aria-label="نسبة القراءة" />
 *   <ProgressBar label="رسائل الشهر" value={48210} max={100000} valueText="48,210 / 100,000" />
 */
export function ProgressBar({ value, max = 100, size = 'sm', tone = 'gradient', label, showValue, valueText, className, trackClassName, ...rest }: ProgressBarProps) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  const pctText = `${Math.round(pct)}%`
  const bar = (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText || pctText}
      aria-label={typeof label === 'string' ? label : rest['aria-label']}
      className={cn(
        'w-full overflow-hidden rounded-full',
        tone === 'on-gradient' ? 'bg-[rgba(4,40,44,0.15)]' : 'bg-track',
        heights[size],
        trackClassName,
      )}
    >
      <div className={cn('h-full rounded-full transition-[width] duration-500 ease-out', fills[tone])} style={{ width: `${pct}%` }} />
    </div>
  )

  if (!label && !showValue) return <div className={className} {...rest}>{bar}</div>

  if (!label) {
    return (
      <div className={cn('flex items-center gap-2.5', className)} {...rest}>
        <div className="min-w-0 flex-1">{bar}</div>
        <span className="tabular shrink-0 text-[13px] text-ink">{valueText || pctText}</span>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)} {...rest}>
      <div className="flex items-center justify-between gap-3 text-[13px]">
        <span className="text-muted">{label}</span>
        {showValue !== false && <span className="tabular font-medium text-ink">{valueText || pctText}</span>}
      </div>
      {bar}
    </div>
  )
}

export default ProgressBar
