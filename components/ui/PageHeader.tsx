import React from 'react'
import Link from 'next/link'
import { ArrowRightIcon } from '@heroicons/react/20/solid'
import { cn } from './utils'

export interface PageHeaderProps {
  /** Small label above the title (section name), e.g. "نظرة عامة". */
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  /** Buttons at the end side (wrap on mobile). */
  actions?: React.ReactNode
  /** Back link shown before the eyebrow. */
  back?: { href: string; label: React.ReactNode }
  /** Content under the header row (tabs, filters, KPIs…). */
  children?: React.ReactNode
  className?: string
}

/**
 * PageHeader — eyebrow + h1 + actions, as in the dashboard mock.
 *
 *   <PageHeader eyebrow="نظرة عامة" title="الرئيسية"
 *     actions={<><Button variant="secondary">استيراد جهات اتصال</Button><Button variant="dark" icon={PlusIcon}>حملة جديدة</Button></>} />
 */
export function PageHeader({ eyebrow, title, description, actions, back, children, className }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          {(back || eyebrow) && (
            <div className="flex items-center gap-2 text-[13px] text-muted">
              {back && (
                <Link href={back.href} className="inline-flex items-center gap-1 text-link hover:text-link-hover">
                  <ArrowRightIcon className="h-4 w-4 ltr:rotate-180" aria-hidden="true" />
                  {back.label}
                </Link>
              )}
              {back && eyebrow && <span aria-hidden="true">·</span>}
              {eyebrow && <span>{eyebrow}</span>}
            </div>
          )}
          <h1 className="text-2xl font-bold leading-tight text-ink sm:text-[28px]">{title}</h1>
          {description && <p className="max-w-2xl text-sm leading-relaxed text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
      </div>
      {children}
    </header>
  )
}

export default PageHeader
