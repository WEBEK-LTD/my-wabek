// Shared building blocks for the settings, integrations, numbers and billing pages.
import React, { useState } from 'react'
import toast from 'react-hot-toast'
import {
  CheckIcon, ClipboardDocumentIcon, EyeIcon, EyeSlashIcon,
  ExclamationTriangleIcon, InformationCircleIcon, CheckCircleIcon, XCircleIcon, ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { Button, Card, Skeleton, Tooltip, cn } from '@/components/ui'
import DashboardLayout from '@/components/layout/DashboardLayout'
import UpgradeWall from '@/components/UpgradeWall'
import { usePlanGuard } from '@/hooks/usePlanFeature'
import { useT, translate } from '@/lib/i18n-local'
import common from '@/locales/dashboard/common-b'
import { copyText, currentLang } from './format'

/* ── Copy ─────────────────────────────────────────────────── */

export function CopyButton({ text, label, size = 'icon-sm', className, onCopied }: {
  text: string
  label?: string
  size?: 'icon-sm' | 'icon' | 'sm' | 'xs'
  className?: string
  onCopied?: () => void
}) {
  const { t } = useT(common)
  label = label ?? t('copy')
  const [done, setDone] = useState(false)
  const copy = async () => {
    const ok = await copyText(text)
    if (ok) {
      setDone(true)
      toast.success(t('copied'))
      onCopied?.()
      setTimeout(() => setDone(false), 1800)
    } else {
      toast.error(t('copyFailed'))
    }
  }
  if (size === 'sm' || size === 'xs') {
    return (
      <Button variant="secondary" size={size} icon={done ? CheckIcon : ClipboardDocumentIcon} onClick={copy} className={className}>
        {done ? t('copied') : label}
      </Button>
    )
  }
  return (
    <Tooltip content={done ? t('copied') : label}>
      <Button variant="ghost" size={size} icon={done ? CheckIcon : ClipboardDocumentIcon} onClick={copy} aria-label={label} className={cn(done && 'text-success', className)} />
    </Tooltip>
  )
}

/** Read-only LTR value (ID, URL, key prefix) with copy and optional reveal. */
export function CopyField({ value, label, secret, mono = true, className, copyable = true, placeholder }: {
  value: string
  label?: React.ReactNode
  secret?: boolean
  mono?: boolean
  className?: string
  copyable?: boolean
  placeholder?: string
}) {
  const { t } = useT(common)
  const [shown, setShown] = useState(!secret)
  return (
    <div className={cn('flex min-w-0 items-center gap-2 rounded-field border border-line bg-surface-2 py-1.5 pe-1.5 ps-3', className)}>
      {label && <span className="shrink-0 text-xs text-muted">{label}</span>}
      <code dir="ltr" className={cn('min-w-0 flex-1 truncate text-[13px] text-ink', mono && 'font-mono', label && 'text-end')}>
        {value ? (shown ? value : '•'.repeat(Math.min(32, Math.max(12, value.length)))) : (placeholder || '—')}
      </code>
      {secret && value && (
        <Button variant="ghost" size="icon-sm" icon={shown ? EyeSlashIcon : EyeIcon} onClick={() => setShown(v => !v)} aria-label={shown ? t('hide') : t('show')} />
      )}
      {copyable && value && <CopyButton text={value} />}
    </div>
  )
}

/** Code sample with a header label and a copy button. */
export function CodeBlock({ code, label, className }: { code: string; label?: React.ReactNode; className?: string }) {
  const { t } = useT(common)
  return (
    <div className={cn('overflow-hidden rounded-card border border-line bg-surface-2', className)}>
      <div className="flex items-center justify-between gap-2 border-b border-line-soft px-4 py-2">
        <span className="truncate text-xs font-medium text-muted" dir="ltr">{label}</span>
        <CopyButton text={code} label={t('copyCode')} />
      </div>
      <pre dir="ltr" className="overflow-x-auto px-4 py-3 text-start font-mono text-[12.5px] leading-relaxed text-ink scrollbar-none">
        <code>{code}</code>
      </pre>
    </div>
  )
}

/* ── Callouts ─────────────────────────────────────────────── */

const NOTICE_TONES = {
  info:    { cls: 'border-chip bg-chip/60 text-chip-ink', icon: InformationCircleIcon },
  warning: { cls: 'border-warning/20 bg-warning-bg text-warning', icon: ExclamationTriangleIcon },
  danger:  { cls: 'border-danger/20 bg-danger-bg text-danger', icon: XCircleIcon },
  success: { cls: 'border-success/20 bg-success-bg text-success', icon: CheckCircleIcon },
} as const

export function Notice({ tone = 'info', title, children, icon, action, className }: {
  tone?: keyof typeof NOTICE_TONES
  title?: React.ReactNode
  children?: React.ReactNode
  icon?: React.ElementType
  action?: React.ReactNode
  className?: string
}) {
  const t = NOTICE_TONES[tone]
  const Icon = icon || t.icon
  return (
    <div role={tone === 'danger' ? 'alert' : undefined} className={cn('flex items-start gap-3 rounded-card border px-4 py-3 text-sm', t.cls, className)}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5', 'opacity-95')}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/* ── Steps ────────────────────────────────────────────────── */

export interface Step { title: React.ReactNode; body?: React.ReactNode; done?: boolean }

/** Vertical numbered steps with a gradient rail. */
export function StepList({ steps, className }: { steps: Step[]; className?: string }) {
  return (
    <ol className={cn('relative flex flex-col', className)}>
      {steps.map((s, i) => (
        <li key={i} className="relative flex gap-4 pb-6 last:pb-0">
          {i < steps.length - 1 && (
            <span aria-hidden="true" className="absolute start-[15px] top-9 h-[calc(100%-2.25rem)] w-0.5 rounded-full bg-gradient-to-b from-brand-teal/50 to-brand-green/20" />
          )}
          <span className={cn(
            'relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular',
            s.done ? 'bg-success-bg text-success' : 'bg-brand-gradient text-[#04282C] shadow-[0_6px_16px_rgba(18,181,190,0.25)]',
          )}>
            {s.done ? <CheckIcon className="h-4 w-4" aria-hidden="true" /> : i + 1}
          </span>
          <div className="min-w-0 flex-1 pt-1">
            <p className="font-semibold text-ink">{s.title}</p>
            {s.body && <div className="mt-1 text-sm leading-relaxed text-muted">{s.body}</div>}
          </div>
        </li>
      ))}
    </ol>
  )
}

/* ── States ───────────────────────────────────────────────── */

export function ErrorState({ title, message, onRetry, className }: {
  title?: React.ReactNode
  message?: React.ReactNode
  onRetry?: () => void
  className?: string
}) {
  const { t } = useT(common)
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center gap-3 rounded-panel border border-danger/20 bg-danger-bg/50 px-6 py-10 text-center', className)}>
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-bg text-danger">
        <ExclamationTriangleIcon className="h-6 w-6" aria-hidden="true" />
      </span>
      <p className="font-semibold text-ink">{title ?? t('loadError')}</p>
      {message && <p className="max-w-md text-sm text-muted">{message}</p>}
      {onRetry && <Button variant="secondary" size="sm" icon={ArrowPathIcon} onClick={onRetry}>{t('retry')}</Button>}
    </div>
  )
}

export function CardsSkeleton({ count = 3, className = 'h-40' }: { count?: number; className?: string }) {
  const { t } = useT(common)
  return (
    <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr))]" aria-busy="true" aria-label={t('loading')}>
      {Array.from({ length: count }, (_, i) => <Skeleton key={i} className={cn('rounded-panel', className)} />)}
    </div>
  )
}

/** Key/value row used in summary cards. */
export function InfoRow({ label, children, className }: { label: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between gap-4 border-b border-line-soft py-3 text-sm last:border-0', className)}>
      <span className="text-muted">{label}</span>
      <span className="min-w-0 truncate text-end font-medium text-ink">{children}</span>
    </div>
  )
}

/** Decorative deep hero header for a page (gradient glow + icon). */
export function HeroPanel({ icon: Icon, eyebrow, title, description, actions, children, className }: {
  icon?: React.ElementType
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <Card variant="deep" padding="none" className={cn('overflow-hidden', className)}>
      <div aria-hidden="true" className="pointer-events-none absolute -end-16 -top-20 h-56 w-56 rounded-full bg-brand-green/20 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 start-10 h-56 w-56 rounded-full bg-brand-teal/25 blur-3xl" />
      <div className="relative flex flex-col gap-5 p-6 sm:p-7 md:flex-row md:items-center">
        {Icon && (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-[#04282C] shadow-glow">
            <Icon className="h-7 w-7" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          {eyebrow && <p className="text-[13px] text-deep-muted">{eyebrow}</p>}
          <h2 className="mt-0.5 text-xl font-bold text-deep-ink sm:text-2xl">{title}</h2>
          {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-deep-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div>}
      </div>
      {children && <div className="relative border-t border-white/10 px-6 py-4 sm:px-7">{children}</div>}
    </Card>
  )
}

/* ── Plan gate ────────────────────────────────────────────── */

/**
 * Keeps the page-level plan check the old pages had (usePlanGuard) without
 * calling hooks after an early return. The layout also gates by nav feature.
 */
export function PlanGate({ feature, children }: { feature: string; children: React.ReactNode }) {
  const { blocked, isLoading } = usePlanGuard(feature)
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-5" aria-busy="true">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-40 w-full rounded-panel" />
          <Skeleton className="h-64 w-full rounded-panel" />
        </div>
      </DashboardLayout>
    )
  }
  if (blocked) return <DashboardLayout><UpgradeWall feature={feature} /></DashboardLayout>
  return <>{children}</>
}

/** Icon tile + title + subtitle for use inside a padded Card. */
export function SectionTitle({ icon: Icon, title, subtitle, action, className }: {
  icon?: React.ElementType
  title: React.ReactNode
  subtitle?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-4 flex items-center gap-3', className)}>
      {Icon && (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-chip text-brand-ink">
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h2 className="text-[17px] font-semibold leading-snug text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

const KNOWN_ERROR_CODES = new Set([
  'member_forbidden', 'plan_no_api', 'plan_limit', 'permission_denied',
  'rate_limited', 'account_suspended', 'wix_not_configured', 'server_error',
])

/**
 * Axios error → message string in the UI language. Known API error codes
 * (member_forbidden, plan_no_api, plan_limit, …) map to translated text; any
 * other server message is shown as-is, then the (translated) fallback.
 */
export function apiError(e: unknown, fallback?: string): string {
  const err = e as { response?: { data?: { error?: string; message?: string; code?: string } }; message?: string }
  const data = err?.response?.data
  const lang = currentLang()
  const raw = String(data?.code || '').toLowerCase()
  const code = raw === 'internal' ? 'server_error' : raw
  if (code && KNOWN_ERROR_CODES.has(code)) return translate(common, lang, `err_${code}` as keyof typeof common.en)
  return data?.error || data?.message || fallback || translate(common, lang, 'genericError')
}

export function apiStatus(e: unknown): number | undefined {
  return (e as { response?: { status?: number } })?.response?.status
}

/**
 * Fill `{name}` placeholders of a translated string with React nodes
 * (links, <code>, <strong>) — `rich(t('key'), { link: <a …/> })`.
 */
export function rich(template: string, parts: Record<string, React.ReactNode>): React.ReactNode {
  const out = template.split(/\{(\w+)\}/g)
  return out.map((seg, i) => (i % 2 === 1
    ? <React.Fragment key={i}>{seg in parts ? parts[seg] : `{${seg}}`}</React.Fragment>
    : seg))
}
