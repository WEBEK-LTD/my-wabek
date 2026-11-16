import React from 'react'
import Link from 'next/link'
import {
  MegaphoneIcon, UserPlusIcon, CpuChipIcon, InboxIcon, SparklesIcon, DevicePhoneMobileIcon,
  ArrowUpRightIcon, PlusIcon,
} from '@heroicons/react/24/outline'
import {
  Button, Card, CardHeader, CardBody, Donut, EmptyState, ProgressBar, Skeleton, StatusPill,
  Table, THead, TBody, TR, TH, TD, Avatar, CHART_COLORS,
} from '@/components/ui'
import { cn } from '@/components/ui/utils'
import { useHomeCopy } from './copy'
import type { HomeCopyKey } from './copy'
import { localeTag } from '@/components/auth/makeCopy'

export const fmt = (n: number | null | undefined) => new Intl.NumberFormat('en-US').format(Number(n) || 0)
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)

/* ── Recent campaigns ──────────────────────────────────────── */

export interface CampaignRow { name: string; sent_count?: number; delivered_count?: number; read_count?: number; failed_count?: number; status?: string; created_at?: string }

const STATUS_KEYS: Record<string, HomeCopyKey> = {
  running: 's_running', sending: 's_sending', completed: 's_completed', sent: 's_sent', scheduled: 's_scheduled',
  draft: 's_draft', paused: 's_paused', failed: 's_failed', cancelled: 's_cancelled', canceled: 's_cancelled',
}

export function RecentCampaigns({ campaigns, loading }: { campaigns: CampaignRow[]; loading?: boolean }) {
  const { c, lang } = useHomeCopy()
  const dateFmt = new Intl.DateTimeFormat(localeTag(lang), { day: 'numeric', month: 'short' })
  return (
    <Card padding="none" className="flex min-w-0 flex-col">
      <CardHeader
        title={c('campaigns_title')}
        action={<Link href="/dashboard/campaigns" className="text-[13px] font-medium text-link hover:text-link-hover">{c('campaigns_all')}</Link>}
      />
      {loading ? (
        <div className="flex flex-col gap-3 p-5 sm:p-6">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : campaigns.length === 0 ? (
        <EmptyState
          size="sm"
          icon={MegaphoneIcon}
          title={c('campaigns_empty')}
          description={c('campaigns_empty_d')}
          action={<Button size="sm" icon={PlusIcon} href="/dashboard/campaigns">{c('new_campaign')}</Button>}
          className="py-10"
        />
      ) : (
        <Table minWidth={620} caption={c('campaigns_title')} >
          <THead>
            <TR>
              <TH>{c('col_campaign')}</TH>
              <TH>{c('col_status')}</TH>
              <TH align="end">{c('col_sent')}</TH>
              <TH>{c('col_delivered')}</TH>
              <TH>{c('col_read')}</TH>
            </TR>
          </THead>
          <TBody>
            {campaigns.map((cm, i) => {
              const sent = cm.sent_count || 0
              const delivered = pct(cm.delivered_count || 0, sent)
              const read = pct(cm.read_count || 0, sent)
              const status = (cm.status || '').toLowerCase()
              return (
                <TR key={`${cm.name}-${i}`}>
                  <TD sub={cm.created_at ? dateFmt.format(new Date(cm.created_at)) : undefined}>
                    <span className="font-medium text-ink">{cm.name}</span>
                  </TD>
                  <TD><StatusPill status={status}>{STATUS_KEYS[status] ? c(STATUS_KEYS[status]) : cm.status}</StatusPill></TD>
                  <TD align="end" className="tabular">{sent ? fmt(sent) : '—'}</TD>
                  <TD><ProgressBar value={delivered} showValue tone="brand" className="w-28" aria-label={`${c('col_delivered')} · ${cm.name}`} /></TD>
                  <TD><ProgressBar value={read} showValue className="w-28" aria-label={`${c('col_read')} · ${cm.name}`} /></TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      )}
    </Card>
  )
}

/* ── Who replies (AI vs team) ──────────────────────────────── */

export function RepliesCard({ ai, team }: { ai: number; team: { name: string; messages: number }[] }) {
  const { c } = useHomeCopy()
  const teamTotal = team.reduce((s, m) => s + m.messages, 0)
  const total = ai + teamTotal
  const aiPct = pct(ai, total)
  return (
    <Card padding="none" className="flex min-w-0 flex-col">
      <CardHeader title={c('replies_title')} subtitle={c('replies_sub')} />
      <CardBody className="flex flex-col gap-4">
      <Donut
        size={124}
        legend="side"
        centerLabel={`${aiPct}%`}
        centerSub={c('replies_center')}
        formatValue={(s, p) => `${Math.round(p)}%`}
        segments={[
          { label: c('replies_ai'), value: ai, color: CHART_COLORS[0] },
          { label: c('replies_team'), value: teamTotal, color: CHART_COLORS[1] },
        ]}
      />
      {team.length > 0 && (
        <ul className="flex flex-col gap-2.5 border-t border-line-soft pt-4">
          {team.slice(0, 4).map(m => (
            <li key={m.name} className="flex items-center gap-2.5">
              <Avatar name={m.name} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{m.name}</span>
              <span className="tabular text-[13px] text-muted">{c('replies_n', { n: fmt(m.messages) })}</span>
            </li>
          ))}
        </ul>
      )}
      </CardBody>
    </Card>
  )
}

/* ── Delivery breakdown (fallback when there are no reply stats) ── */

export function DeliveryCard({ breakdown }: { breakdown: { sent: number; delivered: number; read: number; failed: number } }) {
  const { c } = useHomeCopy()
  const total = breakdown.sent + breakdown.delivered + breakdown.read + breakdown.failed
  return (
    <Card padding="none" className="flex min-w-0 flex-col">
      <CardHeader title={c('delivery_title')} />
      <CardBody>
      <Donut
        size={124}
        legend="side"
        centerLabel={`${pct(breakdown.read, total)}%`}
        centerSub={c('delivery_center')}
        formatValue={s => fmt(s.value)}
        segments={[
          { label: c('delivery_read'), value: breakdown.read, color: CHART_COLORS[1] },
          { label: c('delivery_delivered'), value: breakdown.delivered, color: CHART_COLORS[0] },
          { label: c('delivery_sent'), value: breakdown.sent, color: CHART_COLORS[4] },
          { label: c('delivery_failed'), value: breakdown.failed, color: CHART_COLORS[5] },
        ]}
      />
      </CardBody>
    </Card>
  )
}

/* ── WhatsApp numbers ──────────────────────────────────────── */

export interface InstanceRow { id: string; display_name?: string | null; phone_number?: string | null; status?: string; type?: string | null; instance_type?: string | null }

export function NumbersCard({ instances, loading }: { instances: InstanceRow[]; loading?: boolean }) {
  const { c } = useHomeCopy()
  return (
    <Card padding="none" className="flex min-w-0 flex-col">
      <CardHeader
        title={c('numbers_title')}
        icon={DevicePhoneMobileIcon}
        action={instances.length > 0 ? <Link href="/dashboard/instances" className="text-[13px] font-medium text-link hover:text-link-hover">{c('numbers_manage')}</Link> : undefined}
      />
      <CardBody>
      {loading ? (
        <div className="flex flex-col gap-2">{[0, 1].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : instances.length === 0 ? (
        <EmptyState
          size="sm"
          icon={DevicePhoneMobileIcon}
          title={c('numbers_empty')}
          description={c('numbers_empty_d')}
          action={<Button size="sm" href="/dashboard/instances" icon={PlusIcon}>{c('numbers_connect')}</Button>}
        />
      ) : (
        <ul className="flex flex-col divide-y divide-line-soft">
          {instances.map(inst => {
            const connected = inst.status === 'connected'
            const disconnected = inst.status === 'disconnected'
            const kind = (inst.type || inst.instance_type) === 'wa_web' ? 'type_wa_web' : 'type_cloud'
            return (
              <li key={inst.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className={cn('relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', connected ? 'bg-chip text-chip-ink' : 'bg-surface-3 text-muted')}>
                  <DevicePhoneMobileIcon className="h-[18px] w-[18px]" aria-hidden="true" />
                  <span className={cn('absolute -end-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-surface', connected ? 'bg-brand-green' : disconnected ? 'bg-danger-solid' : 'bg-[#F5A524]')} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{inst.display_name || <bdi dir="ltr">{inst.phone_number}</bdi>}</p>
                  <p className="truncate text-xs text-muted">
                    {c(kind)}{inst.display_name && inst.phone_number ? <> · <bdi dir="ltr">{inst.phone_number}</bdi></> : null}
                  </p>
                </div>
                <StatusPill status={inst.status} size="sm">{connected ? c('st_connected') : disconnected ? c('st_disconnected') : c('st_other')}</StatusPill>
              </li>
            )
          })}
        </ul>
      )}
      </CardBody>
    </Card>
  )
}

/* ── Chatbot activity ──────────────────────────────────────── */

export function ChatbotCard({ flows }: { flows: { name: string; trigger_count: number; is_active: boolean }[] }) {
  const { c } = useHomeCopy()
  const max = Math.max(...flows.map(f => f.trigger_count || 0), 1)
  return (
    <Card padding="none" className="flex min-w-0 flex-col">
      <CardHeader
        title={c('chatbots_title')}
        icon={CpuChipIcon}
        action={<Link href="/dashboard/chatbot" className="text-[13px] font-medium text-link hover:text-link-hover">{c('chatbots_manage')}</Link>}
      />
      <CardBody>
      <ul className="flex flex-col gap-3">
        {flows.map(f => (
          <li key={f.name} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className={cn('h-2 w-2 shrink-0 rounded-full', f.is_active ? 'bg-brand-green' : 'bg-line-strong')} aria-hidden="true" />
                <span className="truncate text-ink">{f.name}</span>
              </span>
              <span className="tabular shrink-0 text-xs text-muted">{c('chatbot_triggers', { n: fmt(f.trigger_count) })}</span>
            </div>
            <ProgressBar value={f.trigger_count || 0} max={max} size="xs" tone="brand" aria-label={f.name} />
          </li>
        ))}
      </ul>
      </CardBody>
    </Card>
  )
}

/* ── Quick actions ─────────────────────────────────────────── */

const ACTIONS: { href: string; label: HomeCopyKey; icon: React.ElementType; tone: string }[] = [
  { href: '/dashboard/campaigns', label: 'qa_campaign', icon: MegaphoneIcon, tone: 'bg-chip text-chip-ink' },
  { href: '/dashboard/chat', label: 'qa_inbox', icon: InboxIcon, tone: 'bg-success-bg text-success' },
  { href: '/dashboard/contacts', label: 'qa_contacts', icon: UserPlusIcon, tone: 'bg-warning-bg text-warning' },
  { href: '/dashboard/chatbot', label: 'qa_chatbot', icon: CpuChipIcon, tone: 'bg-violet-bg text-violet' },
  { href: '/dashboard/ai', label: 'qa_ai', icon: SparklesIcon, tone: 'bg-violet-bg text-violet' },
  { href: '/dashboard/instances', label: 'qa_number', icon: DevicePhoneMobileIcon, tone: 'bg-chip text-chip-ink' },
]

export function QuickActions() {
  const { c } = useHomeCopy()
  return (
    <Card padding="none" className="flex min-w-0 flex-col">
      <CardHeader title={c('quick_title')} />
      <CardBody>
      <div className="grid grid-cols-2 gap-2">
        {ACTIONS.map(a => (
          <Link
            key={a.href}
            href={a.href}
            className="group flex items-center gap-2.5 rounded-2xl border border-line bg-surface p-3 text-sm font-medium text-ink transition hover:-translate-y-0.5 hover:border-line-strong hover:text-ink hover:shadow-card-hover"
          >
            <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', a.tone)}>
              <a.icon className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1 truncate">{c(a.label)}</span>
            <ArrowUpRightIcon className="h-4 w-4 shrink-0 text-muted opacity-0 transition group-hover:opacity-100 rtl:-scale-x-100" aria-hidden="true" />
          </Link>
        ))}
      </div>
      </CardBody>
    </Card>
  )
}

/* ── Secondary metrics strip ───────────────────────────────── */

export function MiniStats({ items, loading }: { items: { label: string; value: number; href: string; icon: React.ElementType }[]; loading?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-3 xl:grid-cols-6">
      {items.map(it => (
        <Link key={it.label} href={it.href} className="group flex items-center gap-3 bg-surface px-4 py-3.5 text-ink transition hover:bg-surface-2 hover:text-ink">
          <it.icon className="h-5 w-5 shrink-0 text-brand-ink" aria-hidden="true" />
          <span className="flex min-w-0 flex-col">
            {loading ? <Skeleton className="h-5 w-12" /> : <span className="tabular text-[17px] font-bold leading-tight">{fmt(it.value)}</span>}
            <span className="truncate text-xs text-muted">{it.label}</span>
          </span>
        </Link>
      ))}
    </div>
  )
}
