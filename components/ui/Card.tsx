import React from 'react'
import { cn } from './utils'

export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  /** Inner padding. Use "none" when the card holds a Table or a CardHeader + body. */
  padding?: 'none' | 'sm' | 'md' | 'lg'
  /** Adds hover elevation for clickable cards. */
  interactive?: boolean
  /** Visual style. "deep" = dark teal hero panel, "gradient" = brand gradient banner. */
  variant?: 'default' | 'muted' | 'deep' | 'gradient' | 'outline'
  as?: 'div' | 'section' | 'article' | 'aside' | 'li'
}

const paddings = { none: '', sm: 'p-4', md: 'p-5 sm:p-6', lg: 'p-6 sm:p-8' }
const variantClasses = {
  default:  'bg-surface border border-line shadow-card',
  muted:    'bg-surface-2 border border-line-soft',
  outline:  'bg-transparent border border-line',
  deep:     'bg-deep-hero border border-white/10 text-deep-ink',
  gradient: 'bg-brand-gradient-soft text-[#04282C] border border-transparent',
}

/**
 * Card — the base surface (radius 22px, hairline border, soft shadow).
 *
 *   <Card padding="none"><CardHeader title="آخر الحملات" action={<a href="…">الكل</a>} /> … </Card>
 */
export function Card({ padding = 'md', interactive, variant = 'default', as: Tag = 'div', className, children, ...rest }: CardProps) {
  return (
    <Tag
      className={cn(
        'relative min-w-0 rounded-panel',
        variantClasses[variant],
        paddings[padding],
        interactive && 'transition-shadow duration-200 hover:shadow-card-hover',
        className,
      )}
      {...(rest as React.HTMLAttributes<HTMLElement>)}
    >
      {children}
    </Tag>
  )
}

export interface CardHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Small icon tile shown before the title. */
  icon?: React.ElementType
  /** Right/left (end side) slot: link, button, dropdown… */
  action?: React.ReactNode
  /** Heading level for the title (default h2). */
  as?: 'h2' | 'h3' | 'h4'
  /** Draws a divider under the header. */
  divider?: boolean
}

export function CardHeader({ title, subtitle, icon: Icon, action, as: H = 'h2', divider, className, ...rest }: CardHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between gap-4 px-5 py-4 sm:px-[22px] sm:py-[18px]', divider && 'border-b border-line-soft', className)} {...rest}>
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-chip text-brand-ink">
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <H className="truncate text-[17px] font-semibold leading-snug text-ink">{title}</H>
          {subtitle && <p className="mt-0.5 truncate text-[13px] text-muted">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2 text-[13px]">{action}</div>}
    </div>
  )
}

export function CardBody({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 pb-5 sm:px-[22px] sm:pb-[22px]', className)} {...rest} />
}

export function CardFooter({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center justify-end gap-2 border-t border-line-soft px-5 py-3.5 sm:px-[22px]', className)} {...rest} />
}

export default Card
