import React from 'react'
import { cn, Tone, toneClasses, toneDot } from './utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  size?: 'sm' | 'md'
  /** Leading coloured dot. `pulse` animates it (live states). */
  dot?: boolean
  pulse?: boolean
  icon?: React.ElementType
}

/**
 * Badge / pill. Tones: neutral · brand · info · success · warning · violet · danger.
 *
 *   <Badge tone="success">مكتملة</Badge>
 *   <Badge tone="brand" dot pulse>قيد الإرسال · 74%</Badge>
 */
export function Badge({ tone = 'neutral', size = 'md', dot, pulse, icon: Icon, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full font-medium leading-none',
        size === 'sm' ? 'px-2 py-[3px] text-[11px]' : 'px-2.5 py-1 text-xs',
        toneClasses[tone],
        className,
      )}
      {...rest}
    >
      {dot && (
        <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
          {pulse && <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', toneDot[tone])} />}
          <span className={cn('relative inline-flex h-2 w-2 rounded-full', toneDot[tone])} />
        </span>
      )}
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      <span className="truncate">{children}</span>
    </span>
  )
}

/** Map common backend statuses to a tone. Unknown → neutral. */
export function statusTone(status?: string | null): Tone {
  const s = (status || '').toLowerCase()
  if (['sending', 'running', 'active', 'connected', 'live', 'open', 'online', 'in_progress', 'processing'].includes(s)) return 'brand'
  if (['completed', 'done', 'sent', 'delivered', 'read', 'success', 'paid', 'approved', 'resolved', 'verified'].includes(s)) return 'success'
  if (['scheduled', 'pending', 'queued', 'waiting', 'paused', 'trial', 'expiring', 'warning', 'review'].includes(s)) return 'warning'
  if (['automated', 'automation', 'recurring', 'ai', 'bot'].includes(s)) return 'violet'
  if (['failed', 'error', 'rejected', 'cancelled', 'canceled', 'disconnected', 'expired', 'blocked', 'banned', 'overdue'].includes(s)) return 'danger'
  return 'neutral'
}

export interface StatusPillProps extends Omit<BadgeProps, 'tone'> {
  /** Backend status string — tone is derived with statusTone() unless `tone` is given. */
  status?: string | null
  tone?: Tone
}

/** StatusPill — Badge whose tone is derived from a status value; live tones get a pulsing dot. */
export function StatusPill({ status, tone, dot = true, pulse, children, ...rest }: StatusPillProps) {
  const resolved = tone || statusTone(status)
  return (
    <Badge tone={resolved} dot={dot} pulse={pulse ?? resolved === 'brand'} {...rest}>
      {children ?? status}
    </Badge>
  )
}

export default Badge
