import React, { useId, useMemo, useRef, useState } from 'react'
import { cn, CHART_COLORS, formatNumber } from './utils'

/* ── Geometry helpers ─────────────────────────────────────── */

type Pt = [number, number]

/** Smooth path through points (Catmull-Rom → cubic Bézier), clamped to [minY, maxY]. */
function smoothPath(pts: Pt[], minY: number, maxY: number): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M${pts[0][0]} ${pts[0][1]}`
  const clamp = (y: number) => Math.max(minY, Math.min(maxY, y))
  let d = `M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] || p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = clamp(p1[1] + (p2[1] - p0[1]) / 6)
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = clamp(p2[1] - (p3[1] - p1[1]) / 6)
    d += ` C${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`
  }
  return d
}

function linePath(pts: Pt[]): string {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ')
}

/** A "nice" axis maximum (1, 2, 2.5, 5 × 10^n). */
function niceMax(v: number): number {
  if (v <= 0) return 1
  const exp = Math.pow(10, Math.floor(Math.log10(v)))
  const f = v / exp
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return nf * exp
}

function compact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `${+(n / 1_000).toFixed(1)}K`
  return formatNumber(n)
}

const safeId = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, '')

/* ── Sparkline ────────────────────────────────────────────── */

export interface SparklineProps {
  data: number[]
  /** Stroke colour (default brand teal). */
  color?: string
  /** Fill the area under the line with a fading gradient. */
  fill?: boolean
  height?: number
  /** Width in px; omit to stretch to the container. */
  width?: number
  strokeWidth?: number
  smooth?: boolean
  ariaLabel?: string
  className?: string
}

/**
 * Sparkline — tiny trend line for StatCards and tables.
 *
 *   <Sparkline data={[4, 6, 5, 9, 12, 11, 15]} />
 */
export function Sparkline({ data, color = '#12B5BE', fill = true, height = 36, width, strokeWidth = 2, smooth = true, ariaLabel, className }: SparklineProps) {
  const gid = safeId(`spark${useId()}`)
  const W = 100
  const H = 32
  const { line, area } = useMemo(() => {
    if (!data.length) return { line: '', area: '' }
    const max = Math.max(...data)
    const min = Math.min(...data)
    const span = max - min || 1
    const pts: Pt[] = data.map((v, i) => [data.length === 1 ? W / 2 : (i / (data.length - 1)) * W, H - 2 - ((v - min) / span) * (H - 4)])
    const l = smooth ? smoothPath(pts, 0, H) : linePath(pts)
    return { line: l, area: `${l} L${W} ${H} L0 ${H} Z` }
  }, [data, smooth])

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      width={width || '100%'}
      height={height}
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      className={cn('block overflow-visible', className)}
    >
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && area && <path d={area} fill={`url(#${gid})`} />}
      {line && <path d={line} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
    </svg>
  )
}

/* ── AreaChart ────────────────────────────────────────────── */

export interface ChartSeries {
  name: string
  data: number[]
  color?: string
  /** Fill under the line (default: true for the first series only). */
  fill?: boolean
}

export interface AreaChartProps {
  series: ChartSeries[]
  /** X-axis labels, one per data point. */
  labels?: string[]
  height?: number
  /** Number of horizontal grid lines (default 4). */
  gridLines?: number
  showYAxis?: boolean
  showLegend?: boolean
  /** Show crosshair + tooltip on hover/focus (default true). */
  interactive?: boolean
  smooth?: boolean
  formatValue?: (v: number) => string
  /** Accessible summary; a data table is also rendered for screen readers. */
  ariaLabel?: string
  className?: string
}

/**
 * AreaChart — responsive multi-series line/area chart in plain SVG, with
 * hover crosshair and tooltip. Time flows left→right in every language.
 *
 *   <AreaChart
 *     labels={['السبت', 'الأحد', …]}
 *     series={[{ name: 'أُرسلت', data: [...] }, { name: 'قُرئت', data: [...], color: '#8BE07A' }]}
 *   />
 */
export function AreaChart({
  series,
  labels,
  height = 220,
  gridLines = 4,
  showYAxis = true,
  showLegend = true,
  interactive = true,
  smooth = true,
  formatValue = (v) => formatNumber(v),
  ariaLabel,
  className,
}: AreaChartProps) {
  const uid = safeId(`area${useId()}`)
  const boxRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const W = 1000
  const H = 300
  const n = Math.max(0, ...series.map(s => s.data.length))
  const max = niceMax(Math.max(0, ...series.flatMap(s => s.data)))

  const resolved = useMemo(() => series.map((s, i) => {
    const color = s.color || CHART_COLORS[i % CHART_COLORS.length]
    const pts: Pt[] = s.data.map((v, j) => [n <= 1 ? W / 2 : (j / (n - 1)) * W, H - (Math.max(0, v) / max) * H])
    const line = smooth ? smoothPath(pts, 0, H) : linePath(pts)
    return { ...s, color, pts, line, area: pts.length ? `${line} L${pts[pts.length - 1][0]} ${H} L${pts[0][0]} ${H} Z` : '', fill: s.fill ?? i === 0 }
  }), [series, n, max, smooth])

  const ticks = Array.from({ length: gridLines + 1 }, (_, i) => (max / gridLines) * (gridLines - i))

  const onMove = (clientX: number) => {
    const el = boxRef.current
    if (!el || n === 0) return
    const r = el.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (clientX - r.left) / r.width))
    setHover(Math.round(x * (n - 1)))
  }

  const hoverX = hover !== null && n > 1 ? (hover / (n - 1)) * 100 : 50
  const summary = ariaLabel || series.map(s => s.name).join('، ')

  return (
    <div className={cn('w-full', className)} dir="ltr">
      {showLegend && series.length > 1 && (
        <ul className="mb-3 flex flex-wrap items-center justify-end gap-4" dir="auto">
          {resolved.map(s => (
            <li key={s.name} className="flex items-center gap-2 text-[13px] text-muted">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} aria-hidden="true" />
              {s.name}
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        {showYAxis && (
          <div className="relative w-9 shrink-0 text-end text-2xs text-muted" style={{ height }} aria-hidden="true">
            {ticks.map((tk, i) => (
              <span key={i} className="tabular absolute end-0 -translate-y-1/2" style={{ top: `${(i / gridLines) * 100}%` }}>{compact(tk)}</span>
            ))}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div
            ref={boxRef}
            className="relative"
            style={{ height }}
            onMouseMove={interactive ? (e) => onMove(e.clientX) : undefined}
            onMouseLeave={interactive ? () => setHover(null) : undefined}
            onTouchMove={interactive ? (e) => onMove(e.touches[0].clientX) : undefined}
            onTouchEnd={interactive ? () => setHover(null) : undefined}
            tabIndex={interactive && n > 0 ? 0 : undefined}
            onKeyDown={interactive ? (e) => {
              if (e.key === 'ArrowRight') { e.preventDefault(); setHover(h => Math.min(n - 1, (h ?? -1) + 1)) }
              if (e.key === 'ArrowLeft') { e.preventDefault(); setHover(h => Math.max(0, (h ?? n) - 1)) }
              if (e.key === 'Escape') setHover(null)
            } : undefined}
            onBlur={() => setHover(null)}
            role="img"
            aria-label={summary}
          >
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
              <defs>
                {resolved.map((s, i) => (
                  <linearGradient key={i} id={`${uid}-${i}`} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor={s.color} stopOpacity="0.32" />
                    <stop offset="1" stopColor={s.color} stopOpacity="0" />
                  </linearGradient>
                ))}
              </defs>
              {ticks.map((_, i) => (
                <line key={i} x1="0" x2={W} y1={(i / gridLines) * H} y2={(i / gridLines) * H} stroke="rgb(var(--line-soft))" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray={i === gridLines ? undefined : '4 4'} />
              ))}
              {resolved.map((s, i) => s.fill && s.area ? <path key={`a${i}`} d={s.area} fill={`url(#${uid}-${i})`} /> : null)}
              {resolved.map((s, i) => (
                <path key={`l${i}`} d={s.line} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              ))}
            </svg>

            {interactive && hover !== null && (
              <>
                <div className="pointer-events-none absolute inset-y-0 w-px bg-line-strong" style={{ left: `${hoverX}%` }} aria-hidden="true" />
                {resolved.map((s, i) => {
                  const v = s.data[hover]
                  if (v === undefined) return null
                  return (
                    <span
                      key={i}
                      className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface shadow"
                      style={{ left: `${hoverX}%`, top: `${100 - (Math.max(0, v) / max) * 100}%`, background: s.color }}
                      aria-hidden="true"
                    />
                  )
                })}
                <div
                  className={cn(
                    'pointer-events-none absolute top-2 z-10 min-w-[140px] rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-dropdown',
                    hoverX > 60 ? '-translate-x-[calc(100%+12px)]' : 'translate-x-3',
                  )}
                  style={{ left: `${hoverX}%` }}
                  dir="auto"
                >
                  {labels?.[hover] && <div className="mb-1 font-medium text-ink">{labels[hover]}</div>}
                  {resolved.map((s, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 py-0.5">
                      <span className="flex items-center gap-1.5 text-muted">
                        <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                        {s.name}
                      </span>
                      <span className="tabular font-semibold text-ink">{s.data[hover] !== undefined ? formatValue(s.data[hover]) : '—'}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          {labels && labels.length > 0 && (
            <div className="relative mt-2 h-4 text-2xs text-muted" aria-hidden="true">
              {labels.map((l, i) => {
                const step = Math.ceil(labels.length / 8)
                if (i % step !== 0 && i !== labels.length - 1) return null
                const left = labels.length <= 1 ? 50 : (i / (labels.length - 1)) * 100
                return (
                  <span key={i} className={cn('absolute whitespace-nowrap', i === 0 ? '' : i === labels.length - 1 ? '-translate-x-full' : '-translate-x-1/2')} style={{ left: `${left}%` }}>
                    {l}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Screen-reader data table */}
      <table className="sr-only">
        <caption>{summary}</caption>
        <thead><tr><th scope="col">#</th>{series.map(s => <th key={s.name} scope="col">{s.name}</th>)}</tr></thead>
        <tbody>
          {Array.from({ length: n }, (_, j) => (
            <tr key={j}><th scope="row">{labels?.[j] ?? j + 1}</th>{series.map(s => <td key={s.name}>{s.data[j] ?? ''}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default AreaChart
