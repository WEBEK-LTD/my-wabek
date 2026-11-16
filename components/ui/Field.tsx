import React, { createContext, useContext, useId } from 'react'
import { ExclamationCircleIcon } from '@heroicons/react/20/solid'
import { cn } from './utils'

interface FieldContextValue {
  id: string
  describedBy?: string
  invalid: boolean
  required?: boolean
}

const FieldContext = createContext<FieldContextValue | null>(null)

/** Read the surrounding <Field>'s ids (used by Input, Textarea, Select, SearchInput). */
export function useField() {
  return useContext(FieldContext)
}

/**
 * Merge Field context into a control's props: id, aria-describedby,
 * aria-invalid and required. Explicit props on the control win.
 */
export function useFieldControlProps<T extends { id?: string; 'aria-describedby'?: string; 'aria-invalid'?: React.AriaAttributes['aria-invalid']; required?: boolean; invalid?: boolean }>(props: T) {
  const field = useField()
  const { invalid, ...rest } = props
  const isInvalid = !!(invalid ?? field?.invalid)
  return {
    isInvalid,
    controlProps: {
      ...rest,
      id: rest.id ?? field?.id,
      required: rest.required ?? field?.required,
      'aria-describedby': cn(field?.describedBy, rest['aria-describedby']) || undefined,
      'aria-invalid': rest['aria-invalid'] ?? (isInvalid || undefined),
    },
  }
}

export interface FieldProps {
  label?: React.ReactNode
  /** Helper text under the control. */
  hint?: React.ReactNode
  /** Error message; marks the control invalid and is announced. */
  error?: React.ReactNode
  required?: boolean
  /** Optional explicit id for the control; generated otherwise. */
  id?: string
  /** Extra content at the end of the label row (e.g. a "forgot password" link). */
  labelAction?: React.ReactNode
  /** Hide the label visually (kept for screen readers). */
  srOnlyLabel?: boolean
  className?: string
  children: React.ReactNode
}

/**
 * Field — label + control + hint + error, with accessible wiring.
 *
 *   <Field label="اسم الحملة" hint="يظهر لفريقك فقط" error={errors.name?.message} required>
 *     <Input {...register('name')} />
 *   </Field>
 */
export function Field({ label, hint, error, required, id, labelAction, srOnlyLabel, className, children }: FieldProps) {
  const auto = useId()
  const controlId = id || `f${auto.replace(/:/g, '')}`
  const hintId = hint ? `${controlId}-hint` : undefined
  const errorId = error ? `${controlId}-error` : undefined

  return (
    <FieldContext.Provider value={{ id: controlId, describedBy: cn(hintId, errorId) || undefined, invalid: !!error, required }}>
      <div className={cn('flex flex-col', className)}>
        {(label || labelAction) && (
          <div className={cn('mb-1.5 flex items-center justify-between gap-3', srOnlyLabel && 'sr-only')}>
            {label && (
              <label htmlFor={controlId} className="text-sm font-medium text-ink">
                {label}
                {required && <span className="ms-0.5 text-danger" aria-hidden="true">*</span>}
              </label>
            )}
            {labelAction && <div className="text-[13px]">{labelAction}</div>}
          </div>
        )}
        {children}
        {hint && !error && <p id={hintId} className="mt-1.5 text-xs text-muted">{hint}</p>}
        {hint && error && <p id={hintId} className="sr-only">{hint}</p>}
        {error && (
          <p id={errorId} role="alert" className="mt-1.5 flex items-center gap-1 text-xs font-medium text-danger">
            <ExclamationCircleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  )
}

export default Field
