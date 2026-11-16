import React from 'react'
import Link from 'next/link'
import { cn } from './utils'
import { BRAND_ASSETS, brandOverride } from '@/hooks/useWhiteLabel'

export interface LogoProps {
  /** Mark size in px (default 36). */
  size?: number
  /** Show the "WABEK" wordmark next to the mark (default true). */
  wordmark?: boolean
  /** Text colour: "light" for deep/hero backgrounds, "dark" for light surfaces, "auto" follows the theme ink. */
  tone?: 'light' | 'dark' | 'auto'
  /** White-label logo URL. When set (and not the legacy default), it replaces the mark. */
  src?: string | null
  /** White-label brand name (replaces the wordmark). */
  name?: string | null
  /** When a tenant logo is a full wordmark image, hide the text next to it. */
  imageOnly?: boolean
  /** Wrap in a link (e.g. "/" or "/dashboard"). */
  href?: string
  /** Use the 512px mark (hero sizes). */
  hiRes?: boolean
  /** Extra glow under the mark (landing hero). */
  glow?: boolean
  className?: string
  /** Decorative usage (no alt) — e.g. when the brand name is already announced. */
  decorative?: boolean
}

/**
 * Logo — the official WABEK mark (/brand/logo-mark.png) + wordmark.
 * Tenants on white-label domains can pass `src` / `name` from useWhiteLabel().
 *
 *   <Logo href="/" tone="light" />
 *   const { customLogo, brandName } = useWhiteLabel(); <Logo src={customLogo} name={brandName} />
 */
export function Logo({ size = 36, wordmark = true, tone = 'auto', src, name, imageOnly, href, hiRes, glow, className, decorative }: LogoProps) {
  const custom = brandOverride(src)
  const brand = name || BRAND_ASSETS.name
  const mark = custom || (hiRes || size > 64 ? BRAND_ASSETS.mark512 : BRAND_ASSETS.mark)
  const showText = wordmark && !(custom && imageOnly)
  const textColor = tone === 'light' ? 'text-[#EAF7F5]' : tone === 'dark' ? 'text-[#062326]' : 'text-ink'
  const isDefaultName = brand === BRAND_ASSETS.name

  const content = (
    <span className={cn('inline-flex shrink-0 items-center gap-2.5', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mark}
        alt={decorative || showText ? '' : brand}
        width={custom ? undefined : size}
        height={size}
        className={cn('shrink-0 object-contain', custom && 'w-auto max-w-[180px]')}
        style={{
          height: size,
          width: custom ? 'auto' : size,
          filter: glow ? 'drop-shadow(0 20px 60px rgba(139,224,122,0.45))' : undefined,
        }}
        decoding="async"
      />
      {showText && (
        <span
          className={cn('truncate font-bold leading-none', textColor, isDefaultName && 'tracking-[1px]')}
          style={{ fontSize: Math.max(14, Math.round(size * 0.53)) }}
          dir={isDefaultName ? 'ltr' : undefined}
        >
          {brand}
        </span>
      )}
    </span>
  )

  if (href) {
    return (
      <Link href={href} className="inline-flex rounded-lg text-inherit hover:text-inherit" aria-label={decorative ? undefined : brand}>
        {content}
      </Link>
    )
  }
  return content
}

export default Logo
