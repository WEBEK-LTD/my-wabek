import React, { forwardRef } from 'react'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/20/solid'
import { cn } from './utils'
import { useFieldControlProps } from './Field'
import { useTranslation } from '@/hooks/useTranslation'

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'onChange' | 'value'> {
  value: string
  onChange: (value: string) => void
  /** Called when the clear button is pressed (defaults to onChange('')). */
  onClear?: () => void
  /** Keyboard hint shown at the end, e.g. "⌘K". */
  shortcut?: string
  size?: 'sm' | 'md'
  wrapperClassName?: string
}

/**
 * SearchInput — controlled search field with icon, clear button and optional shortcut hint.
 *
 *   <SearchInput value={q} onChange={setQ} placeholder="ابحث بالاسم أو الرقم" />
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { value, onChange, onClear, shortcut, size = 'md', className, wrapperClassName, placeholder, ...props },
  ref,
) {
  const { t } = useTranslation()
  const { controlProps } = useFieldControlProps(props)
  return (
    <div className={cn('relative', wrapperClassName)} role="search">
      <MagnifyingGlassIcon className="pointer-events-none absolute start-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" aria-hidden="true" />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Escape' && value) { e.preventDefault(); (onClear || (() => onChange('')))() } }}
        placeholder={placeholder ?? t('ui_search')}
        aria-label={controlProps.id ? undefined : (props['aria-label'] || placeholder || t('ui_search'))}
        className={cn(
          'block w-full rounded-field border border-line bg-surface ps-10 text-ink outline-none transition placeholder:text-muted/80',
          'hover:border-line-strong focus:border-brand-teal focus:shadow-ring [&::-webkit-search-cancel-button]:appearance-none',
          size === 'sm' ? 'h-9 text-[13px]' : 'h-11 text-sm',
          value || shortcut ? 'pe-14' : 'pe-3',
          className,
        )}
        {...controlProps}
      />
      <span className="absolute inset-y-0 end-2 flex items-center gap-1">
        {value ? (
          <button
            type="button"
            onClick={() => (onClear ? onClear() : onChange(''))}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface-3 hover:text-ink"
            aria-label={t('ui_clear')}
          >
            <XMarkIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : shortcut ? (
          <kbd className="pointer-events-none me-1" aria-hidden="true">{shortcut}</kbd>
        ) : null}
      </span>
    </div>
  )
})

export default SearchInput
