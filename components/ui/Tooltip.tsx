import React, { useId, useState } from 'react'
import { cn } from './utils'

export interface TooltipProps {
  /** Tooltip text (keep it short; it is also the accessible description). */
  content: React.ReactNode
  /** A single focusable element (button, link…). */
  children: React.ReactElement
  side?: 'top' | 'bottom' | 'start' | 'end'
  className?: string
  /** Disable without unmounting. */
  disabled?: boolean
}

const sides = {
  top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
  bottom: 'top-full left-1/2 mt-2 -translate-x-1/2',
  start: 'end-full top-1/2 me-2 -translate-y-1/2',
  end: 'start-full top-1/2 ms-2 -translate-y-1/2',
}

/**
 * Tooltip — shows on hover and keyboard focus, hides on Esc. Wires
 * aria-describedby onto the child. Dependency-free.
 *
 *   <Tooltip content="نسخ المفتاح"><Button size="icon" variant="ghost" icon={ClipboardIcon} aria-label="نسخ" /></Tooltip>
 */
export function Tooltip({ content, children, side = 'top', className, disabled }: TooltipProps) {
  const id = `tt${useId().replace(/:/g, '')}`
  const [open, setOpen] = useState(false)
  if (disabled) return children

  const child = React.cloneElement(children, {
    'aria-describedby': cn(children.props['aria-describedby'], open && id) || undefined,
  })

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}
    >
      {child}
      <span
        id={id}
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-toast w-max max-w-[240px] rounded-lg bg-[#04282C] px-2.5 py-1.5 text-xs font-medium leading-snug text-[#EAF7F5] shadow-dropdown transition-opacity duration-100 dark:bg-[#EAF7F5] dark:text-[#04282C]',
          sides[side],
          open ? 'opacity-100' : 'invisible opacity-0',
          className,
        )}
      >
        {content}
      </span>
    </span>
  )
}

export default Tooltip
