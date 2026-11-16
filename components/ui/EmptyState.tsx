import React from 'react'
import { cn } from './utils'

export interface EmptyStateProps {
  icon?: React.ElementType
  title: React.ReactNode
  description?: React.ReactNode
  /** Primary/secondary actions (Buttons). */
  action?: React.ReactNode
  /** "card" adds a dashed surface around it; "plain" for inside tables/cards. */
  variant?: 'plain' | 'card'
  size?: 'sm' | 'md'
  className?: string
}

/**
 * EmptyState — friendly zero-data state with a gradient icon tile.
 *
 *   <EmptyState icon={MegaphoneIcon} title="لا توجد حملات بعد"
 *     description="أنشئ حملتك الأولى وأرسلها إلى شريحة من جهات الاتصال."
 *     action={<Button href="/dashboard/campaigns?new=1" icon={PlusIcon}>حملة جديدة</Button>} />
 */
export function EmptyState({ icon: Icon, title, description, action, variant = 'plain', size = 'md', className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        size === 'sm' ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-14',
        variant === 'card' && 'rounded-panel border border-dashed border-line-strong bg-surface',
        className,
      )}
    >
      {Icon && (
        <span className={cn('relative mb-1 flex items-center justify-center rounded-2xl bg-brand-gradient text-[#04282C] shadow-glow', size === 'sm' ? 'h-11 w-11' : 'h-14 w-14')}>
          <Icon className={size === 'sm' ? 'h-5 w-5' : 'h-7 w-7'} aria-hidden="true" />
        </span>
      )}
      <h3 className={cn('font-semibold text-ink', size === 'sm' ? 'text-[15px]' : 'text-lg')}>{title}</h3>
      {description && <p className="max-w-md text-sm leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-2 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  )
}

export default EmptyState
