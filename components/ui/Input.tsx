import React, { forwardRef } from 'react'
import { Switch as HSwitch } from '@headlessui/react'
import { CheckIcon, ChevronDownIcon } from '@heroicons/react/20/solid'
import { cn } from './utils'
import { useFieldControlProps } from './Field'

type ControlSize = 'sm' | 'md' | 'lg'

const controlBase =
  'block w-full rounded-field border bg-surface text-ink outline-none transition-[border-color,box-shadow] duration-150 ' +
  'placeholder:text-muted/80 hover:border-muted/50 ' +
  'focus:border-brand-teal focus:shadow-ring ' +
  'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted read-only:bg-surface-2'
const okBorder = 'border-line-strong'
const badBorder = 'border-danger focus:border-danger focus:shadow-[0_0_0_4px_rgb(var(--danger)/0.15)]'
const inputSizes: Record<ControlSize, string> = {
  sm: 'h-9 px-3 text-[13px]',
  md: 'h-11 px-3.5 text-sm',
  lg: 'h-12 px-4 text-[15px]',
}

/* ── Input ─────────────────────────────────────────────────── */

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: ControlSize
  invalid?: boolean
  /** Icon at the start side (right in RTL). */
  icon?: React.ElementType
  /** Content inside the control at the start (e.g. "+20") or end (e.g. a unit or button). */
  startAdornment?: React.ReactNode
  endAdornment?: React.ReactNode
  /** Classes for the outer wrapper (when icon/adornments are used). */
  wrapperClassName?: string
}

/**
 * Input — text field. Inside <Field> it picks up id / aria wiring automatically.
 *
 *   <Input placeholder="name@company.com" type="email" />
 *   <Input icon={PhoneIcon} startAdornment="+20" dir="ltr" />
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = 'md', icon: Icon, startAdornment, endAdornment, wrapperClassName, className, ...props },
  ref,
) {
  const { isInvalid, controlProps } = useFieldControlProps(props)
  const hasStart = !!Icon || startAdornment !== undefined
  const hasEnd = endAdornment !== undefined
  const input = (
    <input
      ref={ref}
      className={cn(
        controlBase,
        isInvalid ? badBorder : okBorder,
        inputSizes[size],
        hasStart && (Icon && startAdornment ? 'ps-[4.5rem]' : 'ps-10'),
        hasEnd && 'pe-12',
        className,
      )}
      {...controlProps}
    />
  )
  if (!hasStart && !hasEnd) return input
  return (
    <div className={cn('relative', wrapperClassName)}>
      {hasStart && (
        <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center gap-1.5 ps-3.5 text-muted">
          {Icon && <Icon className="h-[18px] w-[18px]" aria-hidden="true" />}
          {startAdornment !== undefined && <span className="text-sm">{startAdornment}</span>}
        </span>
      )}
      {input}
      {hasEnd && <span className="absolute inset-y-0 end-0 flex items-center pe-3 text-sm text-muted">{endAdornment}</span>}
    </div>
  )
})

/* ── Textarea ──────────────────────────────────────────────── */

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
  /** Shows "used / max" under the field when maxLength is set. */
  showCount?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ className, showCount, rows = 4, ...props }, ref) {
  const { isInvalid, controlProps } = useFieldControlProps(props)
  const len = typeof controlProps.value === 'string' ? controlProps.value.length : undefined
  return (
    <div className="relative">
      <textarea
        ref={ref}
        rows={rows}
        className={cn(controlBase, isInvalid ? badBorder : okBorder, 'min-h-[88px] resize-y px-3.5 py-3 text-sm leading-relaxed', className)}
        {...controlProps}
      />
      {showCount && props.maxLength && len !== undefined && (
        <span className="tabular pointer-events-none absolute bottom-2 end-3 text-2xs text-muted" aria-hidden="true">
          {len}/{props.maxLength}
        </span>
      )}
    </div>
  )
})

/* ── Select (native) ───────────────────────────────────────── */

export interface SelectOption {
  value: string | number
  label: React.ReactNode
  disabled?: boolean
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: ControlSize
  invalid?: boolean
  options?: SelectOption[]
  placeholder?: string
}

/**
 * Select — native <select> styled like Input (best for forms & mobile).
 *
 *   <Select options={[{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }]} />
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ size = 'md', options, placeholder, className, children, ...props }, ref) {
  const { isInvalid, controlProps } = useFieldControlProps(props)
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(controlBase, isInvalid ? badBorder : okBorder, inputSizes[size], 'cursor-pointer appearance-none pe-10', className)}
        {...controlProps}
      >
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options?.map(o => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label as string}</option>)}
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute end-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden="true" />
    </div>
  )
})

/* ── Checkbox ──────────────────────────────────────────────── */

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode
  description?: React.ReactNode
}

/**
 * Checkbox — native input (keyboard + forms work as usual) with a custom box.
 *
 *   <Checkbox label="أوافق على الشروط" checked={v} onChange={e => setV(e.target.checked)} />
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox({ label, description, className, id, ...props }, ref) {
  const auto = React.useId().replace(/:/g, '')
  const cid = id || `cb${auto}`
  const descId = description ? `${cid}-desc` : undefined
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <span className="relative mt-0.5 flex h-5 w-5 shrink-0">
        <input
          ref={ref}
          id={cid}
          type="checkbox"
          aria-describedby={descId}
          className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-line-strong bg-surface transition checked:border-transparent checked:bg-brand-teal hover:border-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal disabled:cursor-not-allowed disabled:opacity-50"
          {...props}
        />
        <CheckIcon className="pointer-events-none absolute inset-0 m-auto h-3.5 w-3.5 text-[#04282C] opacity-0 peer-checked:opacity-100" aria-hidden="true" />
      </span>
      {(label || description) && (
        <span className="flex flex-col">
          {label && <label htmlFor={cid} className="cursor-pointer text-sm font-medium text-ink">{label}</label>}
          {description && <span id={descId} className="text-xs text-muted">{description}</span>}
        </span>
      )}
    </div>
  )
})

/* ── Switch ────────────────────────────────────────────────── */

export interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: React.ReactNode
  description?: React.ReactNode
  disabled?: boolean
  size?: 'sm' | 'md'
  /** Accessible name when there is no visible label. */
  'aria-label'?: string
  className?: string
  name?: string
}

/**
 * Switch — on/off toggle (headlessui, role="switch").
 *
 *   <Switch checked={enabled} onChange={setEnabled} label="تفعيل الرد الآلي" />
 */
export function Switch({ checked, onChange, label, description, disabled, size = 'md', className, name, ...aria }: SwitchProps) {
  const dims = size === 'sm' ? { track: 'h-5 w-9', knob: 'h-4 w-4', on: 'translate-x-4 rtl:-translate-x-4' } : { track: 'h-6 w-11', knob: 'h-5 w-5', on: 'translate-x-5 rtl:-translate-x-5' }
  const control = (
    <HSwitch
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      name={name}
      aria-label={aria['aria-label']}
      className={cn(
        'relative inline-flex shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-200',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-brand-gradient' : 'bg-line-strong',
        dims.track,
      )}
    >
      <span
        aria-hidden="true"
        className={cn('pointer-events-none inline-block rounded-full bg-white shadow-sm ring-0 transition-transform duration-200', dims.knob, checked ? dims.on : 'translate-x-0')}
      />
    </HSwitch>
  )
  if (!label && !description) return <span className={className}>{control}</span>
  return (
    <HSwitch.Group as="div" className={cn('flex items-center justify-between gap-4', className)}>
      <span className="flex min-w-0 flex-col">
        {label && <HSwitch.Label className="cursor-pointer text-sm font-medium text-ink">{label}</HSwitch.Label>}
        {description && <HSwitch.Description className="text-xs text-muted">{description}</HSwitch.Description>}
      </span>
      {control}
    </HSwitch.Group>
  )
}

export default Input
