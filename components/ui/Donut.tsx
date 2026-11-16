import React from 'react'
import { cn, CHART_COLORS, formatNumber } from './utils'

export interface DonutSegment {
  label: string
  value: number
  color?: string
}

export interface DonutProps {
  segments: DonutSegment[]
  /** Pixel size of the ring. */
  size?: number
  /** Ring thickness in viewBox units (ring radius ≈ 16). */
  thickness?: number
  /** Big text in the centre, e.g. "64%". */
  centerLabel?: React.ReactNode
  /** Small text under the centre label. */
  centerSub?: React.ReactNode
  /** Render a legend next to the ring. */
  legend?: boolean | 'bottom' | 'side'
  /** Format legend values. Defaults to the percentage share. */
  formatValue?: (segment: DonutSegment, pct: number) => React.ReactNode
  /** Accessible description; generated from segments when omitted. */
  ariaLabel?: string
  className?: string
}

const R = 15.9155 // circumference = 100

/**
 * Donut — lightweight SVG ring chart (no dependencies).
 *
 *   <Donut legend segments={[{ label: 'المساعد الذكي', value: 64 }, { label: 'الفريق', value: 36 }]} />
 */
export function Donut({ segments, size = 120, thickness = 6, centerLabel, centerSub, legend, formatValue, ariaLabel, className }: DonutProps) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0)
  const items = segments.map((s, i) => ({
    ...s,
    color: s.color || CHART_COLORS[i % CHART_COLORS.length],
    pct: total > 0 ? (Math.max(0, s.value) / total) * 100 : 0,
  }))
  let offset = 0
  const label = ariaLabel || items.map(s => `${s.label} ${Math.round(s.pct)}%`).join('، ')
  const layout = legend === 'bottom' ? 'flex-col items-center' : 'flex-row items-center flex-wrap'

  return (
    <div className={cn('flex gap-5', layout, className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 42 42" role="img" aria-label={label}>
          <circle cx="21" cy="21" r={R} fill="none" stroke="rgb(var(--track))" strokeWidth={thickness} />
          {items.map((s) => {
            if (s.pct <= 0) return null
            const el = (
              <circle
                key={s.label}
                cx="21"
                cy="21"
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${s.pct} ${100 - s.pct}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 21 21)"
                className="transition-[stroke-dasharray] duration-500"
              />
            )
            offset += s.pct
            return el
          })}
        </svg>
        {(centerLabel || centerSub) && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center" aria-hidden="true">
            {centerLabel && <span className="tabular text-lg font-bold leading-tight text-ink">{centerLabel}</span>}
            {centerSub && <span className="text-2xs text-muted">{centerSub}</span>}
          </div>
        )}
      </div>
      {legend && (
        <ul className="flex min-w-0 flex-col gap-2.5">
          {items.map(s => (
            <li key={s.label} className="flex items-center gap-2 text-sm text-ink">
              <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} aria-hidden="true" />
              <span className="truncate">{s.label}</span>
              <span className="tabular text-muted">· {formatValue ? formatValue(s, s.pct) : `${formatNumber(Math.round(s.pct))}%`}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default Donut
