import React, { Fragment, useEffect, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import {
  ArrowPathIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, ClipboardDocumentIcon,
  ExclamationTriangleIcon, EyeIcon, EyeSlashIcon, KeyIcon, XMarkIcon,
} from '@heroicons/react/24/outline'
import { Badge, Button, Input, cn } from '@/components/ui'
import { useAdminT } from './i18n'

/* ── Secrets ─────────────────────────────────────────────── */

/** Prefix the admin APIs use for redacted secrets (lib/settings.ts REDACTED_PREFIX). */
export const MASK_PREFIX = '••••'
export const isMasked = (v: unknown): v is string => typeof v === 'string' && v.startsWith(MASK_PREFIX)

export interface SecretFieldProps {
  /** What the API returned: a mask ("••••1234") when a secret is stored, '' when unset. */
  stored: string | undefined | null
  /** Current form value. Equals `stored` while unchanged. */
  value: string | undefined | null
  /** Called with the value to save. An untouched or emptied field reports `stored`, so the API keeps the secret. */
  onChange: (v: string) => void
  placeholder?: string
  id?: string
  'aria-describedby'?: string
  mono?: boolean
}

/**
 * SecretField — shows "set · ••••1234" with a Change button for stored
 * secrets; the input only appears when the admin chooses to replace it.
 * Never sends a placeholder back unless it is unchanged.
 */
export function SecretField({ stored, value, onChange, placeholder, id, mono = true, ...aria }: SecretFieldProps) {
  const { tr } = useAdminT()
  const hasStored = isMasked(stored) || (!!stored && String(stored).length > 0)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [show, setShow] = useState(false)

  // Reset when fresh data arrives from the server.
  useEffect(() => { setEditing(false); setDraft('') }, [stored])

  if (hasStored && !editing) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-field border border-line bg-surface-2 px-3 py-2">
        <KeyIcon className="h-4 w-4 shrink-0 text-brand-ink" aria-hidden="true" />
        <Badge tone="success" size="sm" dot>{tr('محفوظ', 'Set')}</Badge>
        <span dir="ltr" className="font-mono text-sm text-muted">{isMasked(stored) ? stored : MASK_PREFIX}</span>
        <Button size="xs" variant="ghost" className="ms-auto" onClick={() => { setEditing(true); setDraft('') }} aria-describedby={aria['aria-describedby']}>
          {tr('تغيير', 'Change')}
        </Button>
      </div>
    )
  }

  const current = hasStored ? draft : (isMasked(value) ? '' : value || '')
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          dir="ltr"
          autoComplete="new-password"
          className={mono ? 'font-mono' : undefined}
          wrapperClassName="flex-1"
          value={current}
          placeholder={placeholder || (hasStored ? tr('أدخل القيمة الجديدة', 'Enter the new value') : '')}
          onChange={e => {
            const v = e.target.value
            if (hasStored) { setDraft(v); onChange(v || String(stored)) } else onChange(v)
          }}
          endAdornment={
            <button type="button" onClick={() => setShow(s => !s)} className="text-muted hover:text-ink" aria-label={show ? tr('إخفاء', 'Hide') : tr('إظهار', 'Show')}>
              {show ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
            </button>
          }
          {...aria}
        />
        {hasStored && (
          <Button variant="secondary" onClick={() => { setEditing(false); setDraft(''); onChange(String(stored)) }}>
            {tr('إلغاء', 'Cancel')}
          </Button>
        )}
      </div>
      {!hasStored && <span className="text-xs text-muted"><Badge tone="warning" size="sm">{tr('غير مضبوط', 'Not set')}</Badge></span>}
      {hasStored && <span className="text-xs text-muted">{tr('اترك الحقل فارغًا للإبقاء على القيمة المحفوظة.', 'Leave empty to keep the stored value.')}</span>}
    </div>
  )
}

/* ── Layout helpers ──────────────────────────────────────── */

/** A labelled setting row: text on the start side, control on the end side (stacks on phones). */
export function SettingRow({ label, description, children, stacked, htmlFor }: {
  label: React.ReactNode; description?: React.ReactNode; children: React.ReactNode; stacked?: boolean; htmlFor?: string
}) {
  return (
    <div className={cn('flex gap-3 border-b border-line-soft py-4 last:border-0', stacked ? 'flex-col' : 'flex-col sm:flex-row sm:items-center sm:justify-between')}>
      <div className="min-w-0 flex-1">
        {htmlFor ? <label htmlFor={htmlFor} className="text-sm font-medium text-ink">{label}</label> : <p className="text-sm font-medium text-ink">{label}</p>}
        {description && <p className="mt-0.5 text-xs leading-relaxed text-muted">{description}</p>}
      </div>
      <div className={cn('shrink-0', stacked ? 'w-full' : 'sm:max-w-[55%]')}>{children}</div>
    </div>
  )
}

/** Small label/value tile. */
export function InfoTile({ label, value, className }: { label: React.ReactNode; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-line-soft bg-surface-2 px-3.5 py-3', className)}>
      <p className="text-xs text-muted">{label}</p>
      <div className="mt-1 text-sm font-medium text-ink">{value}</div>
    </div>
  )
}

/** Error state with retry. */
export function ErrorState({ title, description, onRetry, className }: {
  title?: React.ReactNode; description?: React.ReactNode; onRetry?: () => void; className?: string
}) {
  const { tr } = useAdminT()
  return (
    <div role="alert" className={cn('flex flex-col items-center gap-3 rounded-card border border-danger/20 bg-danger-bg/40 px-6 py-10 text-center', className)}>
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-bg text-danger">
        <ExclamationTriangleIcon className="h-6 w-6" aria-hidden="true" />
      </span>
      <p className="text-base font-semibold text-ink">{title || tr('تعذّر تحميل البيانات', 'Could not load data')}</p>
      {description && <p className="max-w-md text-sm text-muted">{description}</p>}
      {onRetry && <Button variant="secondary" size="sm" icon={ArrowPathIcon} onClick={onRetry}>{tr('إعادة المحاولة', 'Try again')}</Button>}
    </div>
  )
}

/** Inline notice (info / warning / danger / success). */
export function Notice({ tone = 'info', icon: Icon, title, children, className }: {
  tone?: 'info' | 'warning' | 'danger' | 'success' | 'violet'; icon?: React.ElementType; title?: React.ReactNode; children?: React.ReactNode; className?: string
}) {
  const tones = {
    info: 'border-brand-teal/25 bg-chip/60 text-chip-ink',
    warning: 'border-warning/25 bg-warning-bg text-warning',
    danger: 'border-danger/25 bg-danger-bg text-danger',
    success: 'border-success/25 bg-success-bg text-success',
    violet: 'border-violet/25 bg-violet-bg text-violet',
  }
  return (
    <div className={cn('flex gap-3 rounded-xl border px-4 py-3 text-sm', tones[tone], className)}>
      {Icon && <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />}
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn('leading-relaxed', title ? 'mt-0.5 opacity-90' : '')}>{children}</div>}
      </div>
    </div>
  )
}

/** Numbered step list. */
export function Steps({ items, className }: { items: React.ReactNode[]; className?: string }) {
  return (
    <ol className={cn('space-y-2.5', className)}>
      {items.map((s, i) => (
        <li key={i} className="flex gap-3 text-sm text-body">
          <span className="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-chip text-xs font-semibold text-chip-ink">{i + 1}</span>
          <span className="pt-0.5">{s}</span>
        </li>
      ))}
    </ol>
  )
}

/* ── Copy / JSON ─────────────────────────────────────────── */

export function CopyButton({ text, label, size = 'icon-sm', className }: { text: string; label?: string; size?: 'icon-sm' | 'xs' | 'sm'; className?: string }) {
  const { tr } = useAdminT()
  const [done, setDone] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(text) } catch { /* clipboard blocked */ }
    setDone(true)
    setTimeout(() => setDone(false), 1800)
  }
  const aria = label || tr('نسخ', 'Copy')
  if (size === 'icon-sm') {
    return <Button size="icon-sm" variant="ghost" icon={done ? CheckIcon : ClipboardDocumentIcon} onClick={copy} aria-label={aria} className={className} />
  }
  return <Button size={size} variant="secondary" icon={done ? CheckIcon : ClipboardDocumentIcon} onClick={copy} className={className}>{done ? tr('تم النسخ', 'Copied') : aria}</Button>
}

function highlightJson(json: string) {
  const esc = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (m) => {
      let cls = 'text-brand-ink'               // number
      if (m.startsWith('"')) cls = m.trim().endsWith(':') ? 'text-violet' : 'text-success'
      else if (/true|false/.test(m)) cls = 'text-warning'
      else if (/null/.test(m)) cls = 'text-muted'
      return `<span class="${cls}">${m}</span>`
    },
  )
}

/** Pretty JSON with syntax colours, copy button and a scroll cap. */
export function JsonViewer({ value, maxHeight = 320, className }: { value: unknown; maxHeight?: number; className?: string }) {
  const text = typeof value === 'string' ? (() => { try { return JSON.stringify(JSON.parse(value), null, 2) } catch { return value } })() : JSON.stringify(value, null, 2)
  return (
    <div className={cn('relative rounded-xl border border-line bg-surface-2', className)}>
      <div className="absolute end-2 top-2"><CopyButton text={text || ''} /></div>
      <pre
        dir="ltr"
        className="overflow-auto whitespace-pre-wrap break-all p-4 pe-12 text-start font-mono text-xs leading-relaxed text-body"
        style={{ maxHeight }}
        // Values are HTML-escaped in highlightJson before markup is added.
        dangerouslySetInnerHTML={{ __html: highlightJson(text || '') }}
      />
    </div>
  )
}

/* ── Pagination ──────────────────────────────────────────── */

export function Pagination({ page, total, pageSize, onChange, className }: {
  page: number; total: number; pageSize: number; onChange: (p: number) => void; className?: string
}) {
  const { tr } = useAdminT()
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) return null
  return (
    <nav aria-label={tr('التنقل بين الصفحات', 'Pagination')} className={cn('flex items-center justify-between gap-3 border-t border-line-soft px-4 py-3', className)}>
      <Button size="sm" variant="secondary" icon={ChevronRightIcon} className="[&_svg]:ltr:rotate-180" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        {tr('السابق', 'Previous')}
      </Button>
      <span className="tabular text-sm text-muted">{tr(`صفحة ${page} من ${pages}`, `Page ${page} of ${pages}`)}</span>
      <Button size="sm" variant="secondary" iconEnd={ChevronLeftIcon} className="[&_svg]:ltr:rotate-180" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        {tr('التالي', 'Next')}
      </Button>
    </nav>
  )
}

/* ── Drawer ──────────────────────────────────────────────── */

export interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: React.ReactNode
  description?: React.ReactNode
  footer?: React.ReactNode
  children?: React.ReactNode
  width?: 'md' | 'lg'
}

/** Side sheet on the reading-end edge (full-width on phones). */
export function Drawer({ open, onClose, title, description, footer, children, width = 'md' }: DrawerProps) {
  const { tr, dir } = useAdminT()
  const fromX = dir === 'rtl' ? '-translate-x-full' : 'translate-x-full'
  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-modal" onClose={onClose} dir={dir}>
        <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-overlay/55 backdrop-blur-[3px]" aria-hidden="true" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-hidden">
          <div className="pointer-events-none fixed inset-y-0 end-0 flex max-w-full">
            <Transition.Child
              as={Fragment}
              enter="transform transition ease-out duration-250" enterFrom={fromX} enterTo="translate-x-0"
              leave="transform transition ease-in duration-200" leaveFrom="translate-x-0" leaveTo={fromX}
            >
              <Dialog.Panel className={cn('pointer-events-auto flex h-full w-screen flex-col border-s border-line bg-surface text-ink shadow-hero', width === 'lg' ? 'max-w-2xl' : 'max-w-lg')}>
                <div className="flex items-start gap-3 border-b border-line-soft px-5 py-4 sm:px-6">
                  <div className="min-w-0 flex-1">
                    {title && <Dialog.Title className="text-lg font-semibold text-ink">{title}</Dialog.Title>}
                    {description && <Dialog.Description className="mt-0.5 truncate text-sm text-muted">{description}</Dialog.Description>}
                  </div>
                  <button type="button" onClick={onClose} className="-me-1.5 flex h-9 w-9 items-center justify-center rounded-xl text-muted transition hover:bg-surface-3 hover:text-ink" aria-label={tr('إغلاق', 'Close')}>
                    <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
                {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line-soft px-5 py-4 sm:px-6">{footer}</div>}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

/* ── Scores ──────────────────────────────────────────────── */

export type ScoreTone = 'success' | 'warning' | 'danger' | 'neutral'
export const scoreTone = (n: number | null | undefined, good = 80, fair = 60): ScoreTone =>
  n == null || !Number.isFinite(Number(n)) ? 'neutral' : n >= good ? 'success' : n >= fair ? 'warning' : 'danger'

const ringColor: Record<ScoreTone, string> = { success: 'stroke-success', warning: 'stroke-warning', danger: 'stroke-danger', neutral: 'stroke-muted' }
const textColor: Record<ScoreTone, string> = { success: 'text-success', warning: 'text-warning', danger: 'text-danger', neutral: 'text-muted' }

/** Circular score (0–100). */
export function ScoreRing({ value, size = 56, label, good, fair }: { value: number | null | undefined; size?: number; label?: string; good?: number; fair?: number }) {
  const tone = scoreTone(value, good, fair)
  const v = Math.max(0, Math.min(100, Number(value) || 0))
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${label ? label + ': ' : ''}${value ?? '—'}/100`}>
      <svg viewBox="0 0 40 40" className="h-full w-full -rotate-90">
        <circle cx="20" cy="20" r="15.9155" fill="none" className="stroke-track" strokeWidth="3.5" />
        <circle cx="20" cy="20" r="15.9155" fill="none" className={cn(ringColor[tone], 'transition-all duration-500')} strokeWidth="3.5" strokeDasharray={`${v} 100`} strokeLinecap="round" />
      </svg>
      <span className={cn('tabular absolute inset-0 flex items-center justify-center font-bold', textColor[tone], size >= 56 ? 'text-base' : 'text-xs')}>
        {value == null ? '—' : Math.round(v)}
      </span>
    </div>
  )
}

export const scoreText = textColor
