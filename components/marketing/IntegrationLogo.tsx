import React from 'react'
import { CodeBracketIcon } from '@heroicons/react/24/outline'
import { cn } from '@/components/ui/utils'

/** Official logos of the platforms WABEK integrates with (public/brand/integrations, see the notes in each SVG). */
export type IntegrationLogoKey = 'wix' | 'wordpress' | 'woocommerce' | 'zapier' | 'whmcs' | 'meta' | 'api'

const SIZES = {
  xs: 'h-7 w-7 rounded-lg p-1',
  badge: 'h-8 w-8 rounded-xl p-1.5',
  sm: 'h-12 w-12 rounded-2xl p-2.5',
  md: 'h-14 w-14 rounded-2xl p-3',
} as const

/**
 * A white tile with the platform's logo in its own colours (readable on the dark
 * and light sections alike). `api` shows a code icon instead of a brand logo.
 */
export function IntegrationLogo({ logo, size = 'sm', className }: { logo: IntegrationLogoKey; size?: keyof typeof SIZES; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center ring-1',
        SIZES[size],
        size !== 'xs' && 'shadow-card',
        logo === 'api' ? 'bg-[#04282C] text-brand-green ring-white/10' : 'bg-white ring-black/5',
        className,
      )}
    >
      {logo === 'api'
        ? <CodeBracketIcon className="h-full w-full" />
        // eslint-disable-next-line @next/next/no-img-element
        : <img src={`/brand/integrations/${logo}.svg`} alt="" width={32} height={32} loading="lazy" decoding="async" className="h-full w-full object-contain" />}
    </span>
  )
}
