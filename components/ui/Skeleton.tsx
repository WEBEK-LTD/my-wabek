import React from 'react'
import { cn } from './utils'

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Render N stacked text lines (last one shorter). */
  lines?: number
  circle?: boolean
}

/**
 * Skeleton — shimmering placeholder. Size it with Tailwind classes.
 *
 *   <Skeleton className="h-9 w-28" />
 *   <Skeleton lines={3} />
 *   <Skeleton circle className="h-10 w-10" />
 */
export function Skeleton({ lines, circle, className, ...rest }: SkeletonProps) {
  if (lines && lines > 0) {
    return (
      <div className={cn('flex flex-col gap-2', className)} aria-hidden="true" {...rest}>
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className={cn('skeleton h-3.5', i === lines - 1 && lines > 1 ? 'w-2/3' : 'w-full')} />
        ))}
      </div>
    )
  }
  return <div className={cn('skeleton', circle ? 'rounded-full' : 'rounded-lg', className || 'h-4 w-full')} aria-hidden="true" {...rest} />
}

export default Skeleton
