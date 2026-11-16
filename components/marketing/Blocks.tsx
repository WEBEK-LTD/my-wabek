import React, { useEffect, useId, useRef, useState } from 'react'
import { CheckIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import { cn } from '@/components/ui/utils'

/** CheckItem — a feature bullet with the brand check tile. */
export function CheckItem({ children, tone = 'light', className }: { children: React.ReactNode; tone?: 'light' | 'deep'; className?: string }) {
  return (
    <li className={cn('flex items-start gap-2.5 text-[15px] leading-relaxed', tone === 'deep' ? 'text-deep-ink' : 'text-ink', className)}>
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg',
          tone === 'deep' ? 'bg-white/10 text-brand-green' : 'bg-chip text-chip-ink',
        )}
      >
        <CheckIcon className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
      <span className="min-w-0">{children}</span>
    </li>
  )
}

export interface FaqItem { q: React.ReactNode; a: React.ReactNode }

/** FaqList — accessible accordion (one panel open at a time). */
export function FaqList({ items, className }: { items: FaqItem[]; className?: string }) {
  const [open, setOpen] = useState<number | null>(0)
  const uid = useId().replace(/:/g, '')
  return (
    <div className={cn('divide-y divide-line-soft overflow-hidden rounded-card border border-line bg-surface shadow-card', className)}>
      {items.map((f, i) => {
        const isOpen = open === i
        const btnId = `${uid}-q-${i}`
        const panelId = `${uid}-a-${i}`
        return (
          <div key={i}>
            <h3 className="m-0 text-base">
              <button
                type="button"
                id={btnId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-start text-[15px] font-semibold text-ink transition-colors hover:bg-surface-2 sm:px-6 sm:py-5"
              >
                <span>{f.q}</span>
                <span
                  aria-hidden="true"
                  className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-3 text-muted transition-transform duration-200', isOpen && 'rotate-180 bg-chip text-chip-ink')}
                >
                  <ChevronDownIcon className="h-4 w-4" strokeWidth={2.2} />
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={btnId}
              hidden={!isOpen}
              className="px-5 pb-5 text-[15px] leading-[1.9] text-body sm:px-6"
            >
              {f.a}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** CtaBand — the deep rounded call-to-action panel that closes a page. */
export function CtaBand({ eyebrow, title, subtitle, actions, note, className }: { eyebrow?: React.ReactNode; title: React.ReactNode; subtitle?: React.ReactNode; actions: React.ReactNode; note?: React.ReactNode; className?: string }) {
  return (
    <section className={cn('mx-auto w-full max-w-[1280px] px-4 pb-20 pt-6 sm:px-8 sm:pb-24 print:hidden', className)}>
      <div className="relative flex flex-wrap items-center justify-between gap-7 overflow-hidden rounded-[34px] bg-[#04282C] px-6 py-12 text-deep-ink sm:px-14 sm:py-16">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_120%_at_100%_0%,#0E6C72,rgba(14,108,114,0)_60%)] ltr:bg-[radial-gradient(80%_120%_at_0%_0%,#0E6C72,rgba(14,108,114,0)_60%)]" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 end-[-60px] h-72 w-72 rounded-full bg-brand-green/10 blur-3xl" />
        <div className="relative flex min-w-0 flex-[1_1_420px] flex-col gap-3">
          {eyebrow && <span className="text-sm font-semibold text-brand-green">{eyebrow}</span>}
          <h2 className="text-[28px] font-bold leading-[1.3] text-deep-ink sm:text-[40px]">{title}</h2>
          {subtitle && <p className="text-base font-light text-deep-muted sm:text-lg">{subtitle}</p>}
        </div>
        <div className="relative flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">{actions}</div>
          {note && <div className="text-[13px] text-deep-muted">{note}</div>}
        </div>
      </div>
    </section>
  )
}

/** IconTile — rounded icon square used on feature and channel cards. */
export function IconTile({ icon: Icon, tone = 'brand', size = 'md', className }: { icon: React.ElementType; tone?: 'brand' | 'violet' | 'warning' | 'success' | 'deep'; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const tones = {
    brand: 'bg-chip text-chip-ink',
    violet: 'bg-violet-bg text-violet',
    warning: 'bg-warning-bg text-warning',
    success: 'bg-success-bg text-success',
    deep: 'bg-white/10 text-brand-green',
  }
  const sizes = { sm: 'h-9 w-9 rounded-[10px]', md: 'h-11 w-11 rounded-xl', lg: 'h-14 w-14 rounded-2xl' }
  const icon = { sm: 'h-[18px] w-[18px]', md: 'h-[22px] w-[22px]', lg: 'h-7 w-7' }
  return (
    <span aria-hidden="true" className={cn('flex shrink-0 items-center justify-center', tones[tone], sizes[size], className)}>
      <Icon className={icon[size]} />
    </span>
  )
}

export interface MiniRow { color: string; label: React.ReactNode; value: React.ReactNode; mono?: boolean }

/** MiniUiCard — small product-UI card used in feature rows (illustrative). */
export function MiniUiCard({ title, tag, rows, note, mono }: { title: React.ReactNode; tag: React.ReactNode; rows: MiniRow[]; note?: React.ReactNode; mono?: boolean }) {
  return (
    <div className="w-full max-w-[420px] rounded-card bg-surface p-5 text-ink shadow-hero ring-1 ring-black/5 transition-transform duration-300 group-hover:-translate-y-1">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className={cn('text-[15px] font-semibold', mono && 'font-mono text-[13px]')} dir={mono ? 'ltr' : undefined}>{title}</span>
        <span className="rounded-full bg-chip px-2.5 py-0.5 text-[11px] font-medium text-chip-ink" dir={mono ? 'ltr' : undefined}>{tag}</span>
      </div>
      <ul className="flex flex-col gap-2.5">
        {rows.map((r, i) => (
          <li key={i} className="flex items-center gap-3 rounded-xl bg-canvas px-3 py-2.5">
            <span aria-hidden="true" className="h-[30px] w-[30px] shrink-0 rounded-full" style={{ background: r.color }} />
            <span className={cn('min-w-0 flex-1 truncate text-[13px]', r.mono && 'font-mono text-[12px]')} dir={r.mono ? 'ltr' : undefined}>{r.label}</span>
            <span className="tabular text-xs text-muted" dir="ltr">{r.value}</span>
          </li>
        ))}
      </ul>
      {note && <p className="mt-3 text-[11px] text-muted">{note}</p>}
    </div>
  )
}

export interface FeatureRowProps {
  kicker: React.ReactNode
  title: React.ReactNode
  description: React.ReactNode
  points: React.ReactNode[]
  visual: React.ReactNode
  /** Background of the visual panel (a logo-derived gradient). */
  panel: string
  reverse?: boolean
  action?: React.ReactNode
}

/** FeatureRow — copy on one side, a mini UI card on a gradient panel on the other. */
export function FeatureRow({ kicker, title, description, points, visual, panel, reverse, action }: FeatureRowProps) {
  return (
    <div className={cn('group flex flex-col items-center gap-10 lg:gap-14', reverse ? 'lg:flex-row-reverse' : 'lg:flex-row')}>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <span className="text-sm font-semibold text-brand-ink">{kicker}</span>
        <h3 className="text-[26px] font-bold leading-[1.35] text-ink sm:text-[36px]">{title}</h3>
        <p className="text-base font-light leading-[1.9] text-body sm:text-lg">{description}</p>
        <ul className="flex flex-col gap-2.5 pt-1.5">
          {points.map((p, i) => <CheckItem key={i}>{p}</CheckItem>)}
        </ul>
        {action && <div className="pt-2">{action}</div>}
      </div>
      <div
        className="relative flex min-h-[300px] w-full min-w-0 flex-1 items-center justify-center overflow-hidden rounded-[30px] p-6 sm:p-8"
        style={{ background: panel }}
      >
        <div aria-hidden="true" className="pointer-events-none absolute -end-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="relative w-full flex justify-center">{visual}</div>
      </div>
    </div>
  )
}

export interface StatItem {
  /** Target value (e.g. 10, 99.9). */
  value: number
  /** Decimal places shown while counting. */
  decimals?: number
  prefix?: string
  suffix?: string
  label: React.ReactNode
  /** Count-up duration in ms. */
  duration?: number
}

/** CountUp — animates from 0 to `value` once it scrolls into view (static when reduced motion is on). */
export function CountUp({ value, decimals = 0, prefix = '', suffix = '', duration = 1800, locale }: Omit<StatItem, 'label'> & { locale: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(value)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    setShown(0)
    let raf = 0, started = false
    const start = () => {
      if (started) return
      started = true
      io.disconnect()
      window.removeEventListener('scroll', onScroll)
      const t0 = performance.now()
      const step = (now: number) => {
        const p = Math.min((now - t0) / duration, 1)
        const ease = p === 1 ? 1 : 1 - Math.pow(2, -10 * p)
        setShown(value * ease)
        if (p < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }
    // Also start when the figure was scrolled past without being observed (fast scroll / jump links).
    const onScroll = () => { if (el.getBoundingClientRect().top < window.innerHeight) start() }
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) start() }, { threshold: 0.2 })
    io.observe(el)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { io.disconnect(); window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [value, duration])
  let text: string
  try {
    text = new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(decimals ? shown : Math.floor(shown))
  } catch {
    text = decimals ? shown.toFixed(decimals) : String(Math.floor(shown))
  }
  return <span ref={ref} className="tabular" dir="ltr">{prefix}{text}{suffix}</span>
}

/** StatsBand — four big figures with a count-up animation. */
export function StatsBand({ items, locale, label, className }: { items: StatItem[]; locale: string; label?: string; className?: string }) {
  return (
    <section aria-label={label} className={cn('mx-auto w-full max-w-[1280px] px-4 pt-14 sm:px-8 sm:pt-16', className)}>
      <dl className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {items.map((s, i) => (
          <div key={i} className="group relative flex flex-col items-center gap-2 overflow-hidden rounded-card border border-line bg-surface px-4 py-7 text-center shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-card-hover sm:py-9">
            <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-brand-gradient opacity-80" />
            <dt className="order-2 text-sm text-muted">{s.label}</dt>
            <dd className="order-1 text-[34px] font-bold leading-none text-ink sm:text-[44px]">
              <CountUp value={s.value} decimals={s.decimals} prefix={s.prefix} suffix={s.suffix} duration={s.duration} locale={locale} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/** LogoStrip — partner / integration names as chips in a slow, pausable marquee. */
export function LogoStrip({ title, names, className }: { title: React.ReactNode; names: string[]; className?: string }) {
  const chip = (n: string, i: number, hidden?: boolean) => (
    <li key={(hidden ? 'b' : 'a') + i} aria-hidden={hidden || undefined} className="shrink-0">
      <span dir="ltr" className="inline-flex items-center gap-2 rounded-[14px] border border-line bg-surface px-5 py-3 text-[15px] font-medium text-body shadow-card">
        <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-lg bg-chip text-[11px] font-bold text-chip-ink">{n.slice(0, 1)}</span>
        {n}
      </span>
    </li>
  )
  return (
    <section className={cn('mx-auto max-w-[1280px] px-4 pb-2 pt-14 sm:px-8 sm:pt-[60px]', className)}>
      <h2 className="mb-6 text-center text-sm font-medium text-muted">{title}</h2>
      <div className="group relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]" dir="ltr">
        <ul className="flex w-max gap-3 py-1 motion-safe:animate-[marquee_40s_linear_infinite] group-hover:[animation-play-state:paused] sm:gap-3.5">
          {names.map((n, i) => chip(n, i))}
          {names.map((n, i) => chip(n, i, true))}
        </ul>
      </div>
      <style jsx global>{`
        @keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
      `}</style>
    </section>
  )
}
