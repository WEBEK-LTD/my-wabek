import React from 'react'
import Link from 'next/link'
import {
  PlayIcon, PauseIcon, TrashIcon, CalendarDaysIcon, UsersIcon, CheckBadgeIcon, ClockIcon, EllipsisHorizontalIcon, ChartBarIcon,
} from '@heroicons/react/24/outline'
import { Button, Card, Dropdown, StatusPill } from '@/components/ui'
import { fmtDate, fmtDateTime } from '@/components/settings/format'
import { DeliveryBar, funnel } from './DeliveryBar'
import { campaignStatus, fmtNum, pct } from './shared'
import { ForwardArrowIcon } from './icons'

export interface CampaignRowData {
  id: string
  name: string
  status: string
  total_contacts: number
  sent_count: number
  delivered_count: number
  read_count: number
  failed_count: number
  scheduled_at?: string | null
  created_at: string
  completed_at?: string | null
  template_name?: string | null
}

export function CampaignRow({ c, canWrite, busy, onAction, onDelete }: {
  c: CampaignRowData
  canWrite: boolean
  busy?: boolean
  onAction: (action: 'start' | 'pause') => void
  onDelete: () => void
}) {
  const st = campaignStatus(c.status)
  const f = funnel({ total: c.total_contacts, sent: c.sent_count, delivered: c.delivered_count, read: c.read_count, failed: c.failed_count })
  const progress = pct(f.sent + f.failed, f.total)
  const startable = ['draft', 'scheduled', 'paused'].includes(c.status)
  const running = c.status === 'running'
  const href = `/dashboard/campaigns/${c.id}`

  return (
    <Card as="article" padding="none" interactive className="group">
      <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 truncate text-[15px] font-semibold text-ink">
              <Link href={href} className="hover:text-link focus-visible:text-link">{c.name}</Link>
            </h3>
            <StatusPill status={c.status} tone={st.tone} pulse={running}>
              {st.label}{running && f.total > 0 ? ` · ${progress}%` : ''}
            </StatusPill>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <span className="flex items-center gap-1"><UsersIcon className="h-3.5 w-3.5" aria-hidden="true" /><span className="tabular">{fmtNum(c.total_contacts)}</span> مستلم</span>
            {c.status === 'scheduled' && c.scheduled_at ? (
              <span className="flex items-center gap-1 text-warning"><CalendarDaysIcon className="h-3.5 w-3.5" aria-hidden="true" />{fmtDateTime(c.scheduled_at)}</span>
            ) : (
              <span className="flex items-center gap-1"><ClockIcon className="h-3.5 w-3.5" aria-hidden="true" />{fmtDate(c.completed_at || c.created_at)}</span>
            )}
            {c.template_name && (
              <span className="flex min-w-0 items-center gap-1"><CheckBadgeIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span dir="ltr" className="truncate font-mono">{c.template_name}</span></span>
            )}
          </div>
        </div>

        <div className="w-full lg:w-[320px]">
          {f.total > 0 || f.sent > 0 ? (
            <>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-muted">وصلت <span className="font-semibold text-ink tabular">{pct(f.delivered, f.sent)}%</span> · قُرئت <span className="font-semibold text-ink tabular">{pct(f.read, f.sent)}%</span></span>
                <span className="text-muted tabular">{fmtNum(f.sent + f.failed)} / {fmtNum(f.total)}</span>
              </div>
              <DeliveryBar counts={{ total: c.total_contacts, sent: c.sent_count, delivered: c.delivered_count, read: c.read_count, failed: c.failed_count }} />
              {f.failed > 0 && <p className="mt-1 text-[11.5px] text-danger">فشلت <span className="tabular">{fmtNum(f.failed)}</span></p>}
            </>
          ) : (
            <p className="text-xs text-muted">لم يبدأ الإرسال بعد</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {canWrite && startable && (
            <Button size="sm" icon={PlayIcon} loading={busy} onClick={() => onAction('start')}>
              {c.status === 'paused' ? 'استئناف' : c.status === 'scheduled' ? 'ابدأ الآن' : 'ابدأ'}
            </Button>
          )}
          {canWrite && running && (
            <Button size="sm" variant="secondary" icon={PauseIcon} loading={busy} onClick={() => onAction('pause')}>إيقاف مؤقت</Button>
          )}
          <Button size="sm" variant="ghost" href={href} iconEnd={ForwardArrowIcon}>التفاصيل</Button>
          {canWrite && !running && (
            <Dropdown
              label="خيارات الحملة"
              align="end"
              trigger={<span className="flex h-8 w-8 items-center justify-center rounded-btn text-muted transition hover:bg-surface-3 hover:text-ink"><EllipsisHorizontalIcon className="h-5 w-5" aria-hidden="true" /></span>}
              items={[
                { label: 'عرض التقرير', icon: ChartBarIcon, href },
                { label: 'حذف الحملة', icon: TrashIcon, danger: true, divider: true, onClick: onDelete },
              ]}
            />
          )}
        </div>
      </div>
    </Card>
  )
}
