import React, { useEffect, useRef, useState } from 'react'
import { CheckBadgeIcon, ChevronLeftIcon, ChevronRightIcon, StarIcon } from '@heroicons/react/24/solid'
import { Avatar } from '@/components/ui'
import { cn } from '@/components/ui/utils'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/public/testimonials'

type Key = keyof typeof messages.en

// The 24 reviews of the original site (text in locales/public/testimonials.ts).
const REVIEWS = [
  { id: 1, verified: true, daysAgo: 2 }, { id: 2, verified: true, daysAgo: 5 }, { id: 3, verified: true, daysAgo: 1 },
  { id: 4, verified: true, daysAgo: 8 }, { id: 5, verified: false, daysAgo: 3 }, { id: 6, verified: true, daysAgo: 11 },
  { id: 7, verified: true, daysAgo: 4 }, { id: 8, verified: true, daysAgo: 7 }, { id: 9, verified: true, daysAgo: 2 },
  { id: 10, verified: true, daysAgo: 9 }, { id: 11, verified: true, daysAgo: 6 }, { id: 12, verified: false, daysAgo: 14 },
  { id: 13, verified: true, daysAgo: 3 }, { id: 14, verified: true, daysAgo: 10 }, { id: 15, verified: true, daysAgo: 1 },
  { id: 16, verified: true, daysAgo: 5 }, { id: 17, verified: false, daysAgo: 8 }, { id: 18, verified: true, daysAgo: 2 },
  { id: 19, verified: true, daysAgo: 13 }, { id: 20, verified: true, daysAgo: 4 }, { id: 21, verified: true, daysAgo: 7 },
  { id: 22, verified: false, daysAgo: 16 }, { id: 23, verified: true, daysAgo: 6 }, { id: 24, verified: true, daysAgo: 3 },
]
type Review = (typeof REVIEWS)[number]

// Deterministic daily shuffle: the same order for everyone on the same day.
function dailySeed(): number {
  const now = new Date()
  return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate()
}
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr]
  let s = seed
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const DAY = 86400000

/** TestimonialsSection — "Businesses love {name}": live counter, rotating "just connected" note and a review carousel. */
export default function TestimonialsSection({ name }: { name: string }) {
  const { t, fmtNumber, fmtRelative, isRTL } = useT(messages)
  const [reviews, setReviews] = useState<Review[]>(REVIEWS)
  const [joined, setJoined] = useState<number | null>(null)
  const [live, setLive] = useState<Review | null>(null)
  const track = useRef<HTMLUListElement>(null)

  const field = (r: Review, f: 'name' | 'country' | 'role' | 'text') => t(`r${r.id}_${f}` as Key)
  const ago = (days: number) => fmtRelative(Date.now() - days * DAY)

  // Client-only (date based), so the server render stays stable.
  useEffect(() => {
    const seed = dailySeed()
    const shuffled = seededShuffle(REVIEWS, seed)
    setReviews(shuffled)
    setJoined(34 + (Math.abs(seed * 1664525) % 28))
    const queue = seededShuffle(shuffled, seed + 7)
    let idx = 0
    const next = () => { setLive(queue[idx % queue.length]); idx++ }
    next()
    const timer = setInterval(next, 7000)
    return () => clearInterval(timer)
  }, [])

  const scroll = (dirSign: 1 | -1) => {
    const el = track.current
    if (!el) return
    const step = Math.min(el.clientWidth * 0.9, 760)
    el.scrollBy({ left: dirSign * (isRTL ? -step : step), behavior: 'smooth' })
  }

  return (
    <section aria-labelledby="testimonials-title" className="relative mx-auto w-full max-w-[1280px] px-4 py-16 sm:px-8 sm:py-20">
      <div className="mb-10 flex flex-col items-center gap-4 text-center sm:mb-12">
        <h2 id="testimonials-title" className="max-w-3xl text-[28px] font-bold leading-[1.3] text-ink sm:text-[40px]">{t('title', { name })}</h2>
        <div className="flex w-full flex-wrap items-center justify-center gap-2.5">
          {joined !== null && (
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-1.5 text-sm text-body shadow-card">
              <span aria-hidden="true" className="relative flex h-2.5 w-2.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-brand-green opacity-60" />
                <span className="relative h-2.5 w-2.5 rounded-full bg-brand-green" />
              </span>
              <strong className="tabular font-semibold text-ink">{fmtNumber(joined)}</strong> {t('week')}
            </span>
          )}
          {live && (
            <span aria-live="polite" className="inline-flex max-w-full items-center gap-2 overflow-hidden rounded-full bg-chip px-3.5 py-1.5 text-[13px] text-chip-ink">
              <span className="block min-w-0 truncate"><strong className="font-semibold">{field(live, 'name')}</strong> · {field(live, 'country')} — {t('just_connected')} · {ago(live.daysAgo)}</span>
            </span>
          )}
        </div>
      </div>

      <div className="relative">
        <ul
          ref={track}
          className="relative flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-4 scrollbar-none [scroll-padding-inline:4px]"
        >
          {reviews.map(r => (
            <li key={r.id} className="w-[290px] shrink-0 snap-start sm:w-[340px]">
              <figure className="flex h-full flex-col gap-4 rounded-card border border-line bg-surface p-6 shadow-card">
                <div className="flex text-[#F5C26B]" role="img" aria-label={t('rating')}>
                  {[0, 1, 2, 3, 4].map(i => <StarIcon key={i} className="h-4 w-4" aria-hidden="true" />)}
                </div>
                <blockquote className="flex-1 text-[15px] leading-[1.85] text-body">“{field(r, 'text')}”</blockquote>
                <figcaption className="flex items-center gap-3 border-t border-line-soft pt-4">
                  <Avatar name={field(r, 'name')} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                      <span className="truncate">{field(r, 'name')}</span>
                      {r.verified && (
                        <span className="inline-flex shrink-0 items-center text-brand-ink" title={t('verified')}>
                          <CheckBadgeIcon className="h-4 w-4" aria-hidden="true" />
                          <span className="sr-only">{t('verified')}</span>
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted">{field(r, 'role')} · {field(r, 'country')}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted">{ago(r.daysAgo)}</span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-center gap-2">
          <button type="button" onClick={() => scroll(-1)} aria-label={t('prev')} className={cn('flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-card transition-colors hover:border-line-strong')}>
            <ChevronLeftIcon className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => scroll(1)} aria-label={t('next')} className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-card transition-colors hover:border-line-strong">
            <ChevronRightIcon className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  )
}
