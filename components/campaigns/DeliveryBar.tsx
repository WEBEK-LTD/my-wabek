import React from 'react'
import { cn } from '@/components/ui'
import { DELIVERY_COLORS, fmtNum, pct } from './shared'

export interface DeliveryCounts {
  total: number
  sent: number
  delivered: number
  read: number
  failed: number
}

/**
 * Normalises raw counters into a funnel (read ≤ delivered ≤ sent). Counters
 * from the campaign row are updated independently, so a read message may or
 * may not also be counted as delivered — clamp instead of trusting either.
 */
export function funnel({ total, sent, delivered, read, failed }: DeliveryCounts) {
  const s = Math.max(0, sent || 0)
  const r = Math.min(Math.max(0, read || 0), s || Infinity)
  const d = Math.min(Math.max(delivered || 0, r), s || Infinity)
  const f = Math.max(0, failed || 0)
  const t = Math.max(total || 0, s + f)
  return { total: t, sent: s, delivered: d, read: r, failed: f }
}

/**
 * Layered delivery bar: read | delivered (not read) | sent (not delivered) | failed,
 * proportional to the audience. Grows from the start side.
 */
export function DeliveryBar({ counts, size = 'md', legend = false, className, trackClassName = 'bg-track' }: {
  counts: DeliveryCounts
  size?: 'sm' | 'md' | 'lg'
  legend?: boolean
  className?: string
  trackClassName?: string
}) {
  const f = funnel(counts)
  const base = f.total || 1
  const segs = [
    { key: 'read', label: 'قُرئت', value: f.read, color: DELIVERY_COLORS.read },
    { key: 'delivered', label: 'وصلت', value: f.delivered - f.read, color: DELIVERY_COLORS.delivered },
    { key: 'sent', label: 'أُرسلت', value: f.sent - f.delivered, color: DELIVERY_COLORS.sent },
    { key: 'failed', label: 'فشلت', value: f.failed, color: DELIVERY_COLORS.failed },
  ]
  const h = size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2'
  const processed = f.sent + f.failed
  const summary = `تمت معالجة ${fmtNum(processed)} من ${fmtNum(f.total)}: قُرئت ${fmtNum(f.read)}، وصلت ${fmtNum(f.delivered)}، أُرسلت ${fmtNum(f.sent)}، فشلت ${fmtNum(f.failed)}`
  return (
    <div className={className}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={f.total}
        aria-valuenow={processed}
        aria-valuetext={summary}
        aria-label="تقدّم الإرسال"
        className={cn('flex w-full overflow-hidden rounded-full', trackClassName, h)}
      >
        {segs.map(s => s.value > 0 && (
          <span
            key={s.key}
            className="h-full transition-[width] duration-700 ease-out first:rounded-s-full"
            style={{ width: `${(s.value / base) * 100}%`, background: s.color }}
          />
        ))}
      </div>
      {legend && (
        <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
          {[
            { label: 'قُرئت', value: f.read, color: DELIVERY_COLORS.read },
            { label: 'وصلت', value: f.delivered, color: DELIVERY_COLORS.delivered },
            { label: 'أُرسلت', value: f.sent, color: DELIVERY_COLORS.sent },
            { label: 'فشلت', value: f.failed, color: DELIVERY_COLORS.failed },
          ].map(s => (
            <li key={s.label} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-[3px]" style={{ background: s.color }} aria-hidden="true" />
              <span>{s.label}</span>
              <span className="font-semibold text-ink tabular">{fmtNum(s.value)}</span>
              {f.total > 0 && <span className="tabular">({pct(s.value, f.total)}%)</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
