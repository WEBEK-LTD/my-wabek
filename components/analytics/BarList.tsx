import React from 'react'
import Link from 'next/link'
import { cn } from '@/components/ui'
import { useT } from '@/lib/i18n-local'
import common from '@/locales/dashboard/common-a'

export interface BarListItem {
  key: string
  label: React.ReactNode
  /** Muted second line / prefix. */
  sub?: React.ReactNode
  value: number
  href?: string
  /** Small status dot before the label. */
  dot?: 'on' | 'off'
}

export interface BarListProps {
  items: BarListItem[]
  /** Unit shown after the value, e.g. "clicks". */
  unit?: string
  color?: string
  ranked?: boolean
  className?: string
  ariaLabel?: string
}

/**
 * BarList — ranked horizontal bars (top links, busiest chatbots). The bar
 * width is relative to the largest value in the list.
 */
export function BarList({ items, unit, color = '#12B5BE', ranked, className, ariaLabel }: BarListProps) {
  const { fmtNumber } = useT(common)
  const max = Math.max(1, ...items.map(i => i.value || 0))
  return (
    <ol className={cn('flex flex-col gap-3.5', className)} aria-label={ariaLabel}>
      {items.map((item, i) => {
        const width = Math.max(2, Math.round(((item.value || 0) / max) * 100))
        const body = (
          <>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                {ranked && <span className="tabular w-4 shrink-0 text-xs text-muted">{i + 1}</span>}
                {item.dot && <span className={cn('h-2 w-2 shrink-0 rounded-full', item.dot === 'on' ? 'bg-success' : 'bg-line-strong')} aria-hidden="true" />}
                <span className="truncate text-sm font-medium text-ink">{item.label}</span>
                {item.sub && <span className="hidden truncate text-xs text-muted sm:inline">{item.sub}</span>}
              </div>
              <span className="tabular shrink-0 text-xs font-semibold text-ink">
                {fmtNumber(item.value || 0)}{unit && <span className="ms-1 font-normal text-muted">{unit}</span>}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-track">
              <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${width}%`, background: color }} />
            </div>
          </>
        )
        return (
          <li key={item.key}>
            {item.href ? <Link href={item.href} className="block rounded-lg transition hover:opacity-80">{body}</Link> : body}
          </li>
        )
      })}
    </ol>
  )
}

export default BarList
