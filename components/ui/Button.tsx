import React, { forwardRef } from 'react'
import Link from 'next/link'
import { cn } from './utils'
import { Spinner } from './Spinner'

export type ButtonVariant =
  | 'primary'    // brand gradient, deep text — the main CTA
  | 'gradient'   // alias of primary
  | 'dark'       // deep teal (#04282C) — strong secondary CTA, e.g. "+ حملة جديدة"
  | 'secondary'  // white surface + border
  | 'outline'    // alias of secondary
  | 'ghost'      // text only, tinted on hover
  | 'danger'     // destructive
  | 'danger-soft'// destructive, tinted
  | 'on-deep'    // light button for deep/hero backgrounds
  | 'on-deep-ghost'

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'icon' | 'icon-sm'

const base =
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-150 ' +
  'disabled:pointer-events-none disabled:opacity-55 aria-disabled:pointer-events-none aria-disabled:opacity-55 ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal'

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-gradient text-[#04282C] font-semibold shadow-[0_8px_24px_rgba(18,181,190,0.22)] hover:brightness-[1.04] hover:shadow-[0_12px_30px_rgba(18,181,190,0.32)] active:brightness-95',
  gradient:
    'bg-brand-gradient text-[#04282C] font-semibold shadow-[0_8px_24px_rgba(18,181,190,0.22)] hover:brightness-[1.04] hover:shadow-[0_12px_30px_rgba(18,181,190,0.32)] active:brightness-95',
  dark:
    'bg-[#04282C] text-[#EAF7F5] font-semibold hover:bg-[#0A3A3F] dark:bg-[#EAF7F5] dark:text-[#04282C] dark:hover:bg-white',
  secondary:
    'bg-surface text-ink border border-line hover:border-line-strong hover:bg-surface-2',
  outline:
    'bg-surface text-ink border border-line hover:border-line-strong hover:bg-surface-2',
  ghost:
    'text-body hover:bg-surface-3 hover:text-ink',
  danger:
    'bg-danger-solid text-white font-semibold hover:brightness-110',
  'danger-soft':
    'bg-danger-bg text-danger hover:brightness-[0.97]',
  'on-deep':
    'bg-[#EAF7F5] text-[#04282C] font-semibold hover:bg-white',
  'on-deep-ghost':
    'text-[#EAF7F5] border border-[rgba(234,247,245,0.22)] bg-[rgba(234,247,245,0.05)] hover:bg-[rgba(234,247,245,0.12)]',
}

const sizes: Record<ButtonSize, string> = {
  xs:  'h-7 px-2.5 text-xs rounded-[10px]',
  sm:  'h-9 px-3.5 text-[13px] rounded-btn',
  md:  'h-11 px-4 text-sm rounded-btn',
  lg:  'h-12 px-6 text-[15px] rounded-[14px]',
  xl:  'h-14 px-8 text-[17px] rounded-2xl',
  icon: 'h-10 w-10 rounded-btn',
  'icon-sm': 'h-8 w-8 rounded-[10px]',
}

type CommonProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Shows a spinner, disables the button and sets aria-busy. */
  loading?: boolean
  /** Icon rendered before the label (start side — right in RTL). */
  icon?: React.ElementType
  /** Icon rendered after the label (end side). */
  iconEnd?: React.ElementType
  fullWidth?: boolean
  className?: string
  children?: React.ReactNode
}

export type ButtonProps = CommonProps &
  (
    | ({ href?: undefined } & React.ButtonHTMLAttributes<HTMLButtonElement>)
    | ({ href: string; external?: boolean; disabled?: boolean } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>)
  )

export function buttonClasses({ variant = 'primary', size = 'md', fullWidth, className }: Pick<CommonProps, 'variant' | 'size' | 'fullWidth' | 'className'> = {}) {
  return cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)
}

/**
 * Button — renders a <button>, or a Next <Link> when `href` is given.
 *
 *   <Button icon={PlusIcon}>حملة جديدة</Button>
 *   <Button variant="secondary" href="/dashboard/contacts">جهات الاتصال</Button>
 *   <Button size="icon" variant="ghost" aria-label="إغلاق" icon={XMarkIcon} />
 */
export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(function Button(props, ref) {
  const { variant = 'primary', size = 'md', loading = false, icon: Icon, iconEnd: IconEnd, fullWidth, className, children, ...rest } = props
  const iconSize = size === 'xs' || size === 'sm' || size === 'icon-sm' ? 'h-4 w-4' : 'h-[18px] w-[18px]'
  const content = (
    <>
      {loading ? <Spinner className={iconSize} /> : Icon ? <Icon className={cn(iconSize, 'shrink-0')} aria-hidden="true" /> : null}
      {children}
      {IconEnd && !loading ? <IconEnd className={cn(iconSize, 'shrink-0')} aria-hidden="true" /> : null}
    </>
  )
  const classes = buttonClasses({ variant, size, fullWidth, className })

  if ('href' in rest && rest.href !== undefined) {
    const { href, external, disabled, ...anchorProps } = rest as { href: string; external?: boolean; disabled?: boolean } & React.AnchorHTMLAttributes<HTMLAnchorElement>
    const isDisabled = disabled || loading
    if (external || /^https?:\/\//.test(href)) {
      return (
        <a ref={ref as React.Ref<HTMLAnchorElement>} href={href} target="_blank" rel="noopener noreferrer" className={classes} aria-disabled={isDisabled || undefined} {...anchorProps}>
          {content}
        </a>
      )
    }
    return (
      <Link ref={ref as React.Ref<HTMLAnchorElement>} href={href} className={classes} aria-disabled={isDisabled || undefined} {...anchorProps}>
        {content}
      </Link>
    )
  }

  const { type = 'button', disabled, ...buttonProps } = rest as React.ButtonHTMLAttributes<HTMLButtonElement>
  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classes}
      {...buttonProps}
    >
      {content}
    </button>
  )
})

export default Button
