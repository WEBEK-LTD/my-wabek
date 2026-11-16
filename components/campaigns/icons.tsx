import React from 'react'
import { ArrowLeftIcon, ArrowRightIcon } from '@heroicons/react/24/outline'
import { cn } from '@/components/ui'

type IconProps = React.ComponentProps<'svg'>

/** "Back" arrow: points to the start side (right in RTL, left in LTR). */
export function BackArrowIcon({ className, ...p }: IconProps) {
  return <ArrowRightIcon {...p} className={cn(className, 'ltr:rotate-180')} />
}

/** "Forward" arrow: points to the end side (left in RTL, right in LTR). */
export function ForwardArrowIcon({ className, ...p }: IconProps) {
  return <ArrowLeftIcon {...p} className={cn(className, 'ltr:rotate-180')} />
}
