import React, { useRef } from 'react'
import Link from 'next/link'
import { cn } from './utils'

export interface TabItem {
  id: string
  label: React.ReactNode
  icon?: React.ElementType
  /** Small counter pill after the label. */
  count?: number | string
  /** Renders the tab as a link (route-based tabs). */
  href?: string
  disabled?: boolean
  /** Show a lock / upgrade marker. */
  locked?: boolean
}

export interface TabsProps {
  tabs: TabItem[]
  /** Active tab id. */
  value: string
  onChange?: (id: string) => void
  /**
   * underline — page/section tabs (default)
   * pills     — soft pill buttons
   * segmented — compact segmented control (filters)
   */
  variant?: 'underline' | 'pills' | 'segmented'
  size?: 'sm' | 'md'
  /** Accessible name of the tab list. */
  'aria-label'?: string
  /** Prefix for generated tab/panel ids: tab = `${idPrefix}-tab-${id}`, panel = `${idPrefix}-panel-${id}`. */
  idPrefix?: string
  className?: string
  fullWidth?: boolean
}

/**
 * Tabs — accessible tab list (roving focus, arrow keys mirrored in RTL).
 * With `href` on items it becomes link navigation (role="navigation" semantics).
 *
 *   const [tab, setTab] = useState('all')
 *   <Tabs value={tab} onChange={setTab} tabs={[{ id: 'all', label: 'الكل', count: 12 }, { id: 'sent', label: 'مرسلة' }]} />
 *   <TabPanel idPrefix="campaigns" id="all" active={tab}>…</TabPanel>
 */
export function Tabs({ tabs, value, onChange, variant = 'underline', size = 'md', idPrefix = 'tabs', className, fullWidth, ...aria }: TabsProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const isLinks = tabs.some(t => t.href)

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (isLinks) return
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']
    if (!keys.includes(e.key)) return
    const enabled = tabs.filter(t => !t.disabled)
    const idx = enabled.findIndex(t => t.id === value)
    const rtl = typeof document !== 'undefined' && getComputedStyle(listRef.current || document.body).direction === 'rtl'
    let next = idx
    if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = enabled.length - 1
    else {
      const forward = (e.key === 'ArrowRight') !== rtl
      next = (idx + (forward ? 1 : -1) + enabled.length) % enabled.length
    }
    e.preventDefault()
    const t = enabled[next]
    if (t) {
      onChange?.(t.id)
      listRef.current?.querySelector<HTMLElement>(`[data-tab-id="${t.id}"]`)?.focus()
    }
  }

  const wrap = {
    underline: 'flex gap-1 overflow-x-auto scrollbar-none border-b border-line',
    pills: 'flex flex-wrap gap-1.5',
    segmented: 'inline-flex gap-1 rounded-[14px] border border-line bg-surface-2 p-1',
  }[variant]

  const item = (active: boolean, disabled?: boolean) => cn(
    'relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors',
    'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-teal',
    disabled && 'pointer-events-none opacity-50',
    fullWidth && 'flex-1',
    variant === 'underline' && cn(
      size === 'sm' ? 'px-3 py-2.5 text-[13px]' : 'px-3.5 py-3 text-sm',
      '-mb-px border-b-2 rounded-t-lg',
      active ? 'border-brand-teal text-ink' : 'border-transparent text-muted hover:text-ink hover:border-line-strong',
    ),
    variant === 'pills' && cn(
      size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-9 px-4 text-sm',
      'rounded-full border',
      active ? 'border-transparent bg-[#04282C] text-[#EAF7F5] dark:bg-[#EAF7F5] dark:text-[#04282C]' : 'border-line bg-surface text-body hover:border-line-strong hover:text-ink',
    ),
    variant === 'segmented' && cn(
      size === 'sm' ? 'h-7 px-3 text-xs' : 'h-8 px-3.5 text-[13px]',
      'rounded-[10px]',
      active ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink',
    ),
  )

  const inner = (t: TabItem, active: boolean) => (
    <>
      {t.icon && <t.icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
      <span>{t.label}</span>
      {t.count !== undefined && (
        <span className={cn('tabular rounded-full px-1.5 py-px text-2xs font-semibold', active ? 'bg-chip text-chip-ink' : 'bg-surface-3 text-muted')}>{t.count}</span>
      )}
      {t.locked && <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden="true" />}
    </>
  )

  if (isLinks) {
    return (
      <nav aria-label={aria['aria-label']} className={cn(wrap, className)}>
        {tabs.map(t => {
          const active = t.id === value
          return t.href ? (
            <Link key={t.id} href={t.href} aria-current={active ? 'page' : undefined} className={item(active, t.disabled)}>
              {inner(t, active)}
            </Link>
          ) : null
        })}
      </nav>
    )
  }

  return (
    <div ref={listRef} role="tablist" aria-label={aria['aria-label']} className={cn(wrap, className)} onKeyDown={onKeyDown}>
      {tabs.map(t => {
        const active = t.id === value
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${t.id}`}
            aria-controls={`${idPrefix}-panel-${t.id}`}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            disabled={t.disabled}
            data-tab-id={t.id}
            onClick={() => onChange?.(t.id)}
            className={item(active, t.disabled)}
          >
            {inner(t, active)}
          </button>
        )
      })}
    </div>
  )
}

export interface TabPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  id: string
  /** Currently active tab id; the panel renders only when it matches. */
  active: string
  idPrefix?: string
}

export function TabPanel({ id, active, idPrefix = 'tabs', className, children, ...rest }: TabPanelProps) {
  if (id !== active) return null
  return (
    <div role="tabpanel" id={`${idPrefix}-panel-${id}`} aria-labelledby={`${idPrefix}-tab-${id}`} tabIndex={0} className={cn('focus-visible:outline-none', className)} {...rest}>
      {children}
    </div>
  )
}

export default Tabs
