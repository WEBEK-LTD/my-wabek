import React from 'react'
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/20/solid'
import { Badge, Card, CardHeader, cn } from '@/components/ui'
import type { Tone } from '@/components/ui'
import { useAdminT } from '../i18n'
import { scoreTone } from '../shared'

export function SeoCard({ title, subtitle, icon, action, children, className, padding, headerClassName }: {
  title: React.ReactNode; subtitle?: React.ReactNode; icon?: React.ElementType; action?: React.ReactNode; children?: React.ReactNode; className?: string; padding?: 'none' | 'sm' | 'md' | 'lg'; headerClassName?: string
}) {
  return (
    <Card padding={padding} className={cn('space-y-4', className)}>
      <CardHeader title={title} subtitle={subtitle} icon={icon} action={action} className={headerClassName} />
      {children}
    </Card>
  )
}

export function ScoreBadge({ score }: { score: number | null | undefined }) {
  const { tr } = useAdminT()
  const t = scoreTone(score)
  const label = t === 'success' ? tr('جيد', 'Good') : t === 'warning' ? tr('مقبول', 'Fair') : t === 'danger' ? tr('ضعيف', 'Poor') : '—'
  return <Badge tone={t as Tone} size="sm">{label}</Badge>
}

export function PriorityBadge({ p }: { p: string }) {
  const { tr } = useAdminT()
  const up = String(p).toUpperCase()
  const tone: Tone = up === 'HIGH' ? 'danger' : up === 'MEDIUM' ? 'warning' : 'neutral'
  const label = up === 'HIGH' ? tr('عالية', 'High') : up === 'MEDIUM' ? tr('متوسطة', 'Medium') : tr('منخفضة', 'Low')
  return <Badge tone={tone} size="sm">{label}</Badge>
}

export function Check({ ok, label }: { ok: boolean; label: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2">
      {ok ? <CheckCircleIcon className="h-4 w-4 shrink-0 text-success" aria-hidden="true" /> : <XCircleIcon className="h-4 w-4 shrink-0 text-danger" aria-hidden="true" />}
      <span className="text-xs text-body">{label}</span>
      <span className="sr-only">{ok ? '✓' : '✗'}</span>
    </div>
  )
}

/** Mini horizontal meter for a 0–100 metric. */
export function Meter({ label, value, detail }: { label: React.ReactNode; value: number | null | undefined; detail?: React.ReactNode }) {
  const t = scoreTone(value)
  const v = Math.max(0, Math.min(100, Number(value) || 0))
  const bar = { success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger', neutral: 'bg-muted' }[t]
  const text = { success: 'text-success', warning: 'text-warning', danger: 'text-danger', neutral: 'text-muted' }[t]
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xs text-muted">{label}</span>
        <span className={cn('tabular text-sm font-bold', text)}>{value == null ? '—' : `${Math.round(v)}%`}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-track"><div className={cn('h-full rounded-full transition-all duration-500', bar)} style={{ width: `${v}%` }} /></div>
      {detail && <p className="mt-1.5 text-2xs text-muted">{detail}</p>}
    </div>
  )
}

/** Google result preview. Always light, like the real SERP. */
export function SerpPreview({ title, url, description }: { title?: string; url: string; description?: string }) {
  const { tr } = useAdminT()
  return (
    <div className="rounded-xl border border-line bg-white p-4 text-start" dir="ltr">
      <p className="text-[11px] text-[#1e6b3a]">{url}</p>
      <p className="truncate text-[15px] font-medium text-[#1a0dab]">{title || tr('(بلا عنوان)', '(no title)')}</p>
      <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-[#4d5156]">{description || tr('سيظهر وصف Meta هنا…', 'Your meta description will appear here…')}</p>
    </div>
  )
}

export function CharCount({ n, max }: { n: number; max: number }) {
  return <span className={cn('tabular text-xs', n > max ? 'text-danger' : 'text-muted')} dir="ltr">{n}/{max}</span>
}

/** Small list row used by checklists and guides. */
export function ListRow({ children, end, className }: { children: React.ReactNode; end?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5', className)}>
      <div className="min-w-0 flex-1">{children}</div>
      {end && <div className="shrink-0">{end}</div>}
    </div>
  )
}
