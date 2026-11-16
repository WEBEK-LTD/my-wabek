import React, { Fragment } from 'react'
import Link from 'next/link'
import { Menu, Transition } from '@headlessui/react'
import { cn } from './utils'

export interface DropdownItem {
  label: React.ReactNode
  icon?: React.ElementType
  onClick?: () => void
  href?: string
  /** Secondary text (e.g. shortcut or description) at the end. */
  hint?: React.ReactNode
  danger?: boolean
  disabled?: boolean
  /** Render a divider before this item. */
  divider?: boolean
  /** Shows a check mark (single-select menus). */
  selected?: boolean
}

export interface DropdownProps {
  /** The trigger content; rendered inside a Menu.Button. */
  trigger: React.ReactNode
  /** Accessible name for icon-only triggers. */
  label?: string
  items?: DropdownItem[]
  /** Custom panel content (instead of/in addition to items). */
  children?: React.ReactNode
  /** Panel header (e.g. signed-in user). */
  header?: React.ReactNode
  /** Logical alignment of the panel with the trigger. */
  align?: 'start' | 'end'
  /** Open above the trigger. */
  placement?: 'bottom' | 'top'
  width?: string
  triggerClassName?: string
  className?: string
}

/**
 * Dropdown menu — headlessui Menu (keyboard navigation, typeahead, Esc).
 *
 *   <Dropdown label="خيارات" trigger={<EllipsisHorizontalIcon className="h-5 w-5" />}
 *     items={[{ label: 'تعديل', icon: PencilIcon, onClick: edit },
 *             { label: 'حذف', icon: TrashIcon, danger: true, divider: true, onClick: remove }]} />
 */
export function Dropdown({ trigger, label, items = [], children, header, align = 'end', placement = 'bottom', width = 'w-56', triggerClassName, className }: DropdownProps) {
  return (
    <Menu as="div" className={cn('relative inline-block text-start', className)}>
      <Menu.Button
        aria-label={label}
        className={cn(
          'inline-flex items-center gap-2 rounded-btn transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal',
          triggerClassName,
        )}
      >
        {trigger}
      </Menu.Button>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-150" enterFrom="opacity-0 scale-[0.97]" enterTo="opacity-100 scale-100"
        leave="transition ease-in duration-100" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-[0.97]"
      >
        <Menu.Items
          className={cn(
            'absolute z-overlay overflow-hidden rounded-2xl border border-line bg-surface p-1.5 text-ink shadow-dropdown focus:outline-none',
            align === 'end' ? 'end-0' : 'start-0',
            placement === 'top' ? 'bottom-full mb-2 origin-bottom' : 'top-full mt-2 origin-top',
            width,
          )}
        >
          {header && <div className="border-b border-line-soft px-3 pb-2.5 pt-1.5">{header}</div>}
          {items.map((it, i) => (
            <Fragment key={i}>
              {it.divider && <div className="my-1.5 h-px bg-line-soft" role="separator" />}
              <Menu.Item disabled={it.disabled}>
                {({ active }) => {
                  const cls = cn(
                    'flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-start text-sm transition-colors',
                    it.danger ? 'text-danger' : 'text-ink',
                    active && (it.danger ? 'bg-danger-bg' : 'bg-surface-3'),
                    it.disabled && 'cursor-not-allowed opacity-50',
                  )
                  const inner = (
                    <>
                      {it.icon && <it.icon className={cn('h-[18px] w-[18px] shrink-0', it.danger ? '' : 'text-muted')} aria-hidden="true" />}
                      <span className="min-w-0 flex-1 truncate">{it.label}</span>
                      {it.selected && <span className="h-1.5 w-1.5 rounded-full bg-brand-teal" aria-hidden="true" />}
                      {it.hint && <span className="shrink-0 text-xs text-muted">{it.hint}</span>}
                    </>
                  )
                  return it.href ? (
                    <Link href={it.href} className={cls} onClick={it.onClick} aria-current={it.selected ? 'true' : undefined}>{inner}</Link>
                  ) : (
                    <button type="button" className={cls} onClick={it.onClick} disabled={it.disabled} aria-pressed={it.selected ?? undefined}>{inner}</button>
                  )
                }}
              </Menu.Item>
            </Fragment>
          ))}
          {children}
        </Menu.Items>
      </Transition>
    </Menu>
  )
}

export default Dropdown
