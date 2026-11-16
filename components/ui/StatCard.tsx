import React from 'react'
import Link from 'next/link'
import { ArrowTrendingDownIcon, ArrowTrendingUpIcon } from '@heroicons/react/20/solid'
import { cn } from './utils'
import { Sparkline } from './Charts'
import { ProgressBar } from './ProgressBar'
import { Skeleton } from './Skeleton'

export interface StatCardProps {
  label: React.ReactNode
  value: React.ReactNode
  /** Secondary line under the value. */
  sub?: React.ReactNode
  /** Colour of the `sub` line. */
  subTone?: 'muted' | 'success' | 'warning' | 'danger' | 'brand'
  /** Heroicon shown in the chip tile at the end of the label row. */
  icon?: React.ElementType
  /** Change vs. previous period, in percent. Positive → green up arrow. */
  trend?: number
  /** Label after the trend, e.g. "عن الشهر الماضي". */
  trendLabel?: React.ReactNode
  /** Invert trend colours (e.g. for "failed messages" a rise is bad). */
  trendInverse?: boolean
  /** Mini trend line under the value. */
  sparkline?: number[]
  sparklineColor?: string
  /** Usage bar under the value (0–100, or with progressMax). */
  progress?: number
  progressMax?: number
  /** Turns the card into a link. */
  href?: string
  loading?: boolean
  className?: string
}

const subTones = {
  muted: 'text-muted',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  brand: 'text-link',
}

/**
 * StatCard — KPI tile from the dashboard mock.
 *
 *   <StatCard label="محادثات مفتوحة" value="128" sub="32 بانتظار الرد" subTone="warning" icon={InboxIcon} />
 *   <StatCard label="رسائل الشهر" value="48,210" sub="من 100,000 في باقتك" progress={48210} progressMax={100000} />
 *   <StatCard label="نسبة القراءة" value="84%" trend={3} trendLabel="عن الشهر الماضي" sparkline={[…]} />
 */
export function StatCard({
  label, value, sub, subTone = 'muted', icon: Icon, trend, trendLabel, trendInverse,
  sparkline, sparklineColor, progress, progressMax = 100, href, loading, className,
}: StatCardProps) {
  const good = trend === undefined ? null : trendInverse ? trend < 0 : trend >= 0
  const TrendIcon = trend !== undefined && trend < 0 ? ArrowTrendingDownIcon : ArrowTrendingUpIcon

  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] text-muted">{label}</span>
        {Icon && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-chip text-brand-ink">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
      {loading ? (
        <Skeleton className="h-9 w-28" />
      ) : (
        <span className="tabular text-[30px] font-bold leading-tight tracking-tight text-ink">{value}</span>
      )}
      {sparkline && sparkline.length > 1 && !loading && <Sparkline data={sparkline} color={sparklineColor} height={34} />}
      {progress !== undefined && !loading && <ProgressBar value={progress} max={progressMax} size="sm" aria-label={typeof label === 'string' ? label : undefined} />}
      {(sub || trend !== undefined) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {trend !== undefined && (
            <span className={cn('tabular inline-flex items-center gap-1 font-medium', good ? 'text-success' : 'text-danger')}>
              <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />
              <span dir="ltr">{trend > 0 ? '+' : ''}{trend}%</span>
              {trendLabel && <span className="font-normal text-muted">{trendLabel}</span>}
            </span>
          )}
          {sub && <span className={subTones[subTone]}>{sub}</span>}
        </div>
      )}
    </>
  )

  const classes = cn(
    'flex min-w-0 flex-col gap-2.5 rounded-card border border-line bg-surface p-5 shadow-card',
    href && 'transition-shadow hover:shadow-card-hover focus-visible:shadow-card-hover',
    className,
  )

  if (href) {
    return <Link href={href} className={cn(classes, 'text-inherit hover:text-inherit')}>{body}</Link>
  }
  return <div className={classes}>{body}</div>
}

export default StatCard
