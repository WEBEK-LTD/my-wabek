import React, { useState } from 'react'
import { cn } from './utils'

/** Warm/cool pastel palette from the mocks — text on all of them is #04282C (AA). */
export const AVATAR_COLORS = ['#F5C26B', '#5FD6D0', '#B59CF5', '#8BE07A', '#F59E9E', '#7FB8F5', '#F3A6D8', '#A8D8A0']

function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** First letter of the first two words (Arabic-aware: one letter for single words). */
export function initials(name?: string | null): string {
  const n = (name || '').trim()
  if (!n) return '?'
  if (n.includes('@')) return n[0].toUpperCase()
  const parts = n.split(/\s+/).filter(Boolean)
  const first = Array.from(parts[0])[0] || ''
  const second = parts.length > 1 ? Array.from(parts[1])[0] || '' : ''
  // Arabic initials read better as a single letter (as in the mock).
  if (/[\u0600-\u06FF]/.test(first)) return first
  return (first + second).toUpperCase()
}

export function avatarColor(seed?: string | null): string {
  return AVATAR_COLORS[hash(seed || '?') % AVATAR_COLORS.length]
}

export interface AvatarProps {
  name?: string | null
  src?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  /** Override the generated background colour. */
  color?: string
  /** Presence dot. */
  status?: 'online' | 'away' | 'offline'
  /** Rounded square instead of circle (for businesses / tenants). */
  square?: boolean
  className?: string
}

const sizes = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-11 w-11 text-base',
  xl: 'h-14 w-14 text-lg',
}

/**
 * Avatar — image, or initials on a colour derived from the name.
 *
 *   <Avatar name="سارة محمود" />           // "س" on a stable pastel colour
 *   <Avatar name={user.name} src={user.avatar_url} status="online" />
 */
export function Avatar({ name, src, size = 'md', color, status, square, className }: AvatarProps) {
  const [broken, setBroken] = useState(false)
  const showImg = src && !broken
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <span
        className={cn(
          'inline-flex items-center justify-center overflow-hidden font-bold text-[#04282C] select-none',
          square ? 'rounded-[10px]' : 'rounded-full',
          sizes[size],
        )}
        style={showImg ? undefined : { background: color || avatarColor(name) }}
        role="img"
        aria-label={name || undefined}
      >
        {showImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src as string} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} />
        ) : (
          <span aria-hidden="true">{initials(name)}</span>
        )}
      </span>
      {status && (
        <span
          className={cn(
            'absolute bottom-0 end-0 block h-2.5 w-2.5 rounded-full ring-2 ring-surface',
            status === 'online' ? 'bg-[#22C55E]' : status === 'away' ? 'bg-[#F5C26B]' : 'bg-line-strong',
          )}
          aria-hidden="true"
        />
      )}
    </span>
  )
}

export interface AvatarGroupProps {
  people: { name?: string | null; src?: string | null }[]
  max?: number
  size?: AvatarProps['size']
  className?: string
}

export function AvatarGroup({ people, max = 4, size = 'sm', className }: AvatarGroupProps) {
  const shown = people.slice(0, max)
  const rest = people.length - shown.length
  return (
    <div className={cn('flex items-center -space-x-2 rtl:space-x-reverse', className)}>
      {shown.map((p, i) => <Avatar key={i} name={p.name} src={p.src} size={size} className="rounded-full ring-2 ring-surface" />)}
      {rest > 0 && (
        <span className={cn('inline-flex items-center justify-center rounded-full bg-surface-3 font-semibold text-muted ring-2 ring-surface', sizes[size])}>+{rest}</span>
      )}
    </div>
  )
}

export default Avatar
