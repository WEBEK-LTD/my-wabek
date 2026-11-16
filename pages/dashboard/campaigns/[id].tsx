import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/router'
import DashboardLayout from '@/components/layout/DashboardLayout'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  PlayIcon, PauseIcon, TrashIcon, UsersIcon, PaperAirplaneIcon, CheckCircleIcon, EyeIcon, XCircleIcon,
  MegaphoneIcon, ExclamationTriangleIcon, InboxIcon, CheckBadgeIcon, Cog6ToothIcon, ArrowPathIcon,
  ChatBubbleLeftEllipsisIcon, LockClosedIcon,
} from '@heroicons/react/24/outline'
import {
  Avatar, Badge, Button, Card, CardHeader, ConfirmDialog, EmptyState, PageHeader, SearchInput, Skeleton,
  StatCard, StatusPill, Table, TBody, TD, TH, THead, TR, Tabs,
} from '@/components/ui'
import { InfoRow, Notice } from '@/components/settings/Shared'
import { LoadError } from '@/components/analytics/LoadError'
import { DeliveryBar, funnel } from '@/components/campaigns/DeliveryBar'
import { Funnel } from '@/components/campaigns/Funnel'
import { WhatsAppPreview } from '@/components/campaigns/WhatsAppPreview'
import {
  DELIVERY_COLORS, campaignStatus, errorStatus, friendlyError, isMemberForbidden, messageStatus, pct,
  startResultMessage, translateServerMessage, useTeamRole,
} from '@/components/campaigns/shared'
import { useT } from '@/lib/i18n-local'
import dict from '@/locales/dashboard/campaign-detail'
import common from '@/locales/dashboard/common-a'
import componentMessages from '@/locales/dashboard/campaign-components'

const PAGE = 50

export default function CampaignDetailPage() {
  const { t, fmtNumber, fmtDate, fmtDateTime, fmtTime } = useT(dict)
  const { t: tc } = useT(common)
  const { t: tcomp } = useT(componentMessages)
  const fmtNum = (n: number | null | undefined) => fmtNumber(Number(n) || 0)
  const router = useRouter()
  const { id } = router.query
  const [campaign, setCampaign] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<unknown>(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const [busy, setBusy] = useState<'start' | 'pause' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { canWrite, roleLabel } = useTeamRole()
  const canManage = canWrite('campaigns')

  useEffect(() => {
    if (!id) return
    load()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (campaign?.status !== 'running') return
    const interval = setInterval(load, 3000)
    return () => clearInterval(interval)
  }, [campaign?.status, id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    try {
      const [cRes, mRes] = await Promise.all([
        axios.get(`/api/campaigns?id=${id}`),
        axios.get(`/api/campaigns/${id}/messages`),
      ])
      const camp = (cRes.data.campaigns || []).find((c: any) => c.id === id) || cRes.data.campaign
      setCampaign(camp)
      setMessages(mRes.data.messages || [])
      setLoadError(null)
    } catch (e) {
      setLoadError(e)
    }
    setLoading(false)
  }

  const stats = useMemo(() => ({
    total:     messages.length,
    sent:      messages.filter(m => ['sent', 'delivered', 'read'].includes(m.status)).length,
    delivered: messages.filter(m => m.status === 'delivered').length,
    read:      messages.filter(m => m.status === 'read').length,
    failed:    messages.filter(m => m.status === 'failed').length,
    pending:   messages.filter(m => ['pending', 'waiting'].includes(m.status)).length,
  }), [messages])

  const matchesFilter = (m: any) =>
    filter === 'all' ? true :
    filter === 'read' ? m.status === 'read' :
    filter === 'delivered' ? m.status === 'delivered' :
    filter === 'failed' ? m.status === 'failed' :
    filter === 'sent' ? ['sent', 'delivered', 'read'].includes(m.status) :
    filter === 'pending' ? ['pending', 'waiting'].includes(m.status) :
    true
  const q = search.trim().toLowerCase()
  const filtered = messages.filter(m => matchesFilter(m) &&
    (!q || `${m.contacts?.name || ''} ${m.contacts?.phone || ''}`.toLowerCase().includes(q)))

  // Failure reasons, most frequent first (null reason = unknown, labelled at render)
  const reasons = useMemo(() => {
    const map = new Map<string, { reason: string | null; code?: string | number; count: number }>()
    for (const m of messages) {
      if (m.status !== 'failed') continue
      const raw = m.meta?.error || m.meta?.error_msg
      const reason = raw ? String(raw) : null
      const code = m.meta?.code
      const key = `${code || ''}|${reason || ''}`
      const cur = map.get(key)
      if (cur) cur.count++
      else map.set(key, { reason, code, count: 1 })
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  }, [messages])

  const runAction = async (action: 'start' | 'pause') => {
    setBusy(action)
    // A start keeps the request open while the batch is sent: refresh early
    // so the page switches to "running" and polls the progress.
    const early = action === 'start' ? setTimeout(load, 1500) : null
    try {
      const r = await axios.post(`/api/campaigns/${id}`, { action })
      if (action === 'pause') toast.success(t('paused_toast'))
      else { const m = startResultMessage(r.data); (m.ok ? toast.success : toast.error)(m.text) }
    } catch (e) {
      toast.error(friendlyError(e, t('action_failed')))
    } finally {
      if (early) clearTimeout(early)
      setBusy(null)
      load()
    }
  }

  const remove = async () => {
    setDeleting(true)
    try {
      await axios.delete(`/api/campaigns/${id}`)
      toast.success(t('deleted_toast'))
      router.push('/dashboard/campaigns')
    } catch (e) {
      toast.error(friendlyError(e, t('delete_failed')))
      setDeleting(false)
    }
  }

  if (loading) return (
    <DashboardLayout title={t('page_title')}>
      <div className="space-y-5" aria-busy="true" aria-label={t('loading')}>
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-40 w-full rounded-panel" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5 xl:gap-3.5">
          {[0, 1, 2, 3, 4].map(i => <StatCard key={i} label="" value="" loading />)}
        </div>
        <Skeleton className="h-72 w-full rounded-panel" />
      </div>
    </DashboardLayout>
  )

  if (!campaign) return (
    <DashboardLayout title={t('page_title')}>
      <div className="space-y-6">
        <PageHeader back={{ href: '/dashboard/campaigns', label: t('back') }} title={t('details_title')} />
        {loadError && errorStatus(loadError) !== 404 ? (
          <LoadError
            title={isMemberForbidden(loadError) ? t('forbidden_title') : t('load_failed')}
            description={isMemberForbidden(loadError) ? tc('err_member_forbidden') : friendlyError(loadError)}
            onRetry={() => { setLoading(true); load() }}
          />
        ) : (
          <EmptyState variant="card" icon={MegaphoneIcon} title={t('not_found_title')}
            description={t('not_found_desc')}
            action={<Button href="/dashboard/campaigns">{t('back_to_list')}</Button>} />
        )}
      </div>
    </DashboardLayout>
  )

  const st = campaignStatus(campaign.status, tc)
  const running = campaign.status === 'running'
  const startable = ['draft', 'scheduled', 'paused'].includes(campaign.status)
  const total = Math.max(campaign.total_contacts || 0, stats.total)
  const f = funnel({ total, sent: stats.sent, delivered: stats.delivered + stats.read, read: stats.read, failed: stats.failed })
  const processed = f.sent + f.failed
  const progress = pct(processed, f.total)
  const meta = campaign.meta || {}
  const filterInfo = campaign.contact_filter || {}
  const audience = filterInfo.segment_id ? (Array.isArray(filterInfo.conditions) ? t('aud_segment_rules', { n: fmtNum(filterInfo.conditions.length) }) : t('aud_segment'))
    : Array.isArray(filterInfo.tags) && filterInfo.tags.length ? t('aud_tags', { tags: filterInfo.tags.join(t('list_sep')) }) : t('aud_all')
  const visible = filtered.slice(0, limit)
  const tplLabel = `${campaign.template_name}${campaign.template_language ? ` · ${campaign.template_language}` : ''}`

  const tabs = [
    { id: 'all', label: t('tab_all'), count: stats.total },
    { id: 'sent', label: tc('ms_sent'), count: stats.sent },
    { id: 'delivered', label: tc('ms_delivered'), count: stats.delivered },
    { id: 'read', label: tc('ms_read'), count: stats.read },
    { id: 'failed', label: tc('ms_failed'), count: stats.failed },
    ...(stats.pending ? [{ id: 'pending', label: tc('ms_pending'), count: stats.pending }] : []),
  ]

  return (
    <DashboardLayout title={campaign.name || t('page_title')}>
      <div className="space-y-6">
        <PageHeader
          back={{ href: '/dashboard/campaigns', label: t('back') }}
          eyebrow={t('eyebrow')}
          title={<span className="flex flex-wrap items-center gap-3">{campaign.name}<StatusPill status={campaign.status} tone={st.tone} pulse={running}>{st.label}</StatusPill></span>}
          description={
            <span className="flex flex-wrap gap-x-4 gap-y-1">
              <span>{t('created_on', { date: fmtDate(campaign.created_at) })}</span>
              {campaign.template_name && <span className="flex items-center gap-1"><CheckBadgeIcon className="h-4 w-4" aria-hidden="true" /><span dir="ltr" className="font-mono text-[13px]">{tplLabel}</span></span>}
              {campaign.status === 'scheduled' && campaign.scheduled_at && <span className="text-warning">{t('scheduled_for', { date: fmtDateTime(campaign.scheduled_at) })}</span>}
            </span>
          }
          actions={canManage ? (
            <>
              {startable && (
                <Button icon={PlayIcon} loading={busy === 'start'} disabled={!!busy} onClick={() => runAction('start')}>
                  {campaign.status === 'paused' ? t('resume') : campaign.status === 'scheduled' ? t('start_now') : t('start')}
                </Button>
              )}
              {running && (
                <Button variant="secondary" icon={PauseIcon} loading={busy === 'pause'} disabled={!!busy} onClick={() => runAction('pause')}>{t('pause')}</Button>
              )}
              {!running && (
                <Button variant="danger-soft" icon={TrashIcon} onClick={() => setConfirmDelete(true)}>{tc('delete')}</Button>
              )}
            </>
          ) : undefined}
        />

        {!canManage && (
          <Notice tone="info" icon={LockClosedIcon}>
            {t('role_note', { role: roleLabel })}
          </Notice>
        )}
        {loadError && <Notice tone="warning">{t('stale_note', { error: friendlyError(loadError) })}</Notice>}
        {meta.error && <Notice tone="danger" title={t('stopped_title')}>{meta.error === 'Campaign stopped due to an internal error' ? t('stopped_internal') : translateServerMessage(String(meta.error))}</Notice>}
        {campaign.status === 'paused' && processed > 0 && (
          <Notice tone="warning" icon={PauseIcon}>{t('paused_note', { done: fmtNum(processed), total: fmtNum(f.total) })}</Notice>
        )}

        {/* Progress hero */}
        <Card variant="deep" padding="lg" className="overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute -end-16 -top-20 h-56 w-56 rounded-full bg-brand-green/20 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 start-10 h-56 w-56 rounded-full bg-brand-teal/25 blur-3xl" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-end">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-deep-muted">{running ? t('hero_running') : campaign.status === 'completed' ? t('hero_completed') : t('hero_progress')}</p>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="text-4xl font-bold tabular text-deep-ink">{progress}%</span>
                <span className="text-sm text-deep-muted tabular">{t('hero_processed', { done: fmtNum(processed), total: fmtNum(f.total) })}</span>
                {running && <ArrowPathIcon className="h-4 w-4 animate-spin text-deep-muted" aria-label={t('auto_updating')} />}
              </p>
              <DeliveryBar className="mt-4" size="lg" counts={f} trackClassName="bg-white/15" />
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-deep-muted">
                {[
                  { label: tc('ms_read'), v: f.read, c: DELIVERY_COLORS.read },
                  { label: tc('ms_delivered'), v: f.delivered, c: DELIVERY_COLORS.delivered },
                  { label: tc('ms_sent'), v: f.sent, c: DELIVERY_COLORS.sent },
                  { label: tc('ms_failed'), v: f.failed, c: DELIVERY_COLORS.failed },
                ].map(s => (
                  <li key={s.label} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-[3px]" style={{ background: s.c }} aria-hidden="true" />{s.label}
                    <span className="font-semibold text-deep-ink tabular">{fmtNum(s.v)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <dl className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-2 text-sm md:text-end">
              <dt className="text-deep-muted">{t('started')}</dt><dd className="text-deep-ink">{campaign.started_at ? fmtDateTime(campaign.started_at) : '—'}</dd>
              <dt className="text-deep-muted">{t('ended')}</dt><dd className="text-deep-ink">{campaign.completed_at ? fmtDateTime(campaign.completed_at) : '—'}</dd>
            </dl>
          </div>
        </Card>

        {/* Funnel stat cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5 xl:gap-3.5">
          <StatCard label={t('stat_targeted')} value={fmtNum(f.total)} icon={UsersIcon} sub={t('stat_logged', { n: fmtNum(stats.total) })} />
          <StatCard label={tc('ms_sent')} value={fmtNum(f.sent)} icon={PaperAirplaneIcon} progress={pct(f.sent, f.total)} sub={t('stat_of_targeted', { p: pct(f.sent, f.total) })} />
          <StatCard label={tc('ms_delivered')} value={fmtNum(f.delivered)} icon={CheckCircleIcon} progress={pct(f.delivered, f.sent)} sub={t('stat_of_sent', { p: pct(f.delivered, f.sent) })} subTone="success" />
          <StatCard label={tc('ms_read')} value={fmtNum(f.read)} icon={EyeIcon} progress={pct(f.read, f.sent)} sub={t('stat_of_sent', { p: pct(f.read, f.sent) })} subTone="brand" />
          <StatCard label={tc('ms_failed')} value={fmtNum(f.failed)} icon={XCircleIcon} sub={f.failed ? t('stat_of_processed', { p: pct(f.failed, processed) }) : t('stat_no_failures')} subTone={f.failed ? 'danger' : 'success'} />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Card>
            <CardHeader title={t('funnel_title')} subtitle={t('funnel_sub')} icon={MegaphoneIcon} />
            <div className="mt-5">
              <Funnel ariaLabel={tcomp('funnel_aria')} stages={[
                { label: t('stat_targeted'), value: f.total, color: '#B59CF5' },
                { label: tc('ms_sent'), value: f.sent, color: DELIVERY_COLORS.sent },
                { label: tc('ms_delivered'), value: f.delivered, color: DELIVERY_COLORS.delivered },
                { label: tc('ms_read'), value: f.read, color: DELIVERY_COLORS.read },
              ]} />
            </div>
          </Card>

          <Card>
            <CardHeader title={t('reasons_title')} icon={ExclamationTriangleIcon}
              subtitle={reasons.length ? (reasons.length === 1 ? t('reasons_sub_one', { n: fmtNum(stats.failed) }) : t('reasons_sub_other', { n: fmtNum(stats.failed), r: fmtNum(reasons.length) })) : undefined} />
            <div className="mt-4">
              {Number(meta.reengagement_blocked) > 0 && (
                <Notice tone="warning" className="mb-3" title={t('reengagement_title', { n: fmtNum(meta.reengagement_blocked) })}>
                  {t('reengagement_body')}
                </Notice>
              )}
              {reasons.length === 0 ? (
                <EmptyState size="sm" icon={CheckCircleIcon} title={t('no_failures_title')} description={t('no_failures_desc')} />
              ) : (
                <ul className="space-y-2.5">
                  {reasons.slice(0, 6).map(r => (
                    <li key={`${r.code}|${r.reason}`} className="rounded-card border border-line-soft bg-surface-2 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p dir="auto" className="min-w-0 break-words text-[13px] text-ink">{r.reason ? translateServerMessage(r.reason) : t('unknown_reason')}</p>
                        <Badge tone="danger" size="sm" className="shrink-0"><span className="tabular">{fmtNum(r.count)}</span></Badge>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        {r.code && <code dir="ltr" className="font-mono text-[11px] text-muted">#{r.code}</code>}
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-track" aria-hidden="true">
                          <div className="h-full rounded-full bg-danger/70" style={{ width: `${pct(r.count, stats.failed)}%` }} />
                        </div>
                        <span className="text-[11px] text-muted tabular">{pct(r.count, stats.failed)}%</span>
                      </div>
                    </li>
                  ))}
                  {reasons.length > 6 && (
                    <li><Button size="xs" variant="ghost" onClick={() => setFilter('failed')}>{t('show_all_failed')}</Button></li>
                  )}
                </ul>
              )}
            </div>
          </Card>
        </div>

        {/* Recipients */}
        <Card padding="none">
          <CardHeader className="px-5 pt-5 sm:px-6" title={t('recipients_title')} icon={InboxIcon}
            subtitle={filter !== 'all' || q ? t('recipients_sub_match', { n: fmtNum(filtered.length) }) : t('recipients_sub', { n: fmtNum(filtered.length) })} />
          <div className="flex flex-col gap-3 px-5 pb-4 pt-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="-mx-1 overflow-x-auto px-1 scrollbar-none">
              <Tabs variant="segmented" size="sm" value={filter} onChange={v => { setFilter(v); setLimit(PAGE) }} aria-label={t('msg_filter_aria')} tabs={tabs} />
            </div>
            <SearchInput size="sm" value={search} onChange={v => { setSearch(v); setLimit(PAGE) }} placeholder={t('search_ph')} className="lg:w-64" />
          </div>
          {messages.length === 0 ? (
            <EmptyState size="sm" icon={PaperAirplaneIcon} title={t('no_messages_title')}
              description={startable ? t('no_messages_startable') : t('no_messages_desc')} />
          ) : filtered.length === 0 ? (
            <EmptyState size="sm" icon={InboxIcon} title={t('no_match_title')} description={t('no_match_desc')} />
          ) : (
            <>
              <Table minWidth={760} caption={t('table_caption')}>
                <THead>
                  <TR>
                    <TH>{t('th_contact')}</TH>
                    <TH>{t('th_status')}</TH>
                    <TH>{t('th_msg_id')}</TH>
                    <TH>{t('th_time')}</TH>
                    <TH>{t('th_error')}</TH>
                  </TR>
                </THead>
                <TBody>
                  {visible.map((msg: any) => {
                    const ms = messageStatus(msg.status, tc)
                    const errMsg = msg.meta?.error || msg.meta?.error_msg || ''
                    const errText = errMsg ? translateServerMessage(String(errMsg)) : ''
                    const name = msg.contacts?.name || ''
                    const phone = msg.contacts?.phone || ''
                    return (
                      <TR key={msg.id}>
                        <TD>
                          <div className="flex items-center gap-2.5">
                            <Avatar name={name || phone || '?'} size="sm" />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-ink">{name || '—'}</p>
                              <p dir="ltr" className="text-start font-mono text-xs text-muted">{phone || '—'}</p>
                            </div>
                          </div>
                        </TD>
                        <TD><StatusPill status={msg.status} tone={ms.tone}>{ms.label}</StatusPill></TD>
                        <TD>
                          <code dir="ltr" className="font-mono text-xs text-muted" title={msg.wa_message_id || undefined}>
                            {msg.wa_message_id ? '…' + msg.wa_message_id.slice(-10) : '—'}
                          </code>
                        </TD>
                        <TD sub={fmtDate(msg.created_at)}><span className="tabular">{fmtTime(msg.created_at)}</span></TD>
                        <TD>
                          {errText ? <span dir="auto" className="block max-w-[220px] truncate text-xs text-danger" title={errText}>{errText}</span> : <span className="text-muted">—</span>}
                        </TD>
                      </TR>
                    )
                  })}
                </TBody>
              </Table>
              {filtered.length > limit && (
                <div className="flex items-center justify-center gap-3 border-t border-line-soft p-4">
                  <span className="text-xs text-muted">{t('shown_of', { n: fmtNum(limit), total: fmtNum(filtered.length) })}</span>
                  <Button size="sm" variant="secondary" onClick={() => setLimit(l => l + PAGE * 2)}>{t('show_more')}</Button>
                </div>
              )}
            </>
          )}
        </Card>

        {/* Settings + message */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title={t('settings_title')} icon={Cog6ToothIcon} />
            <div className="mt-3">
              <InfoRow label={t('r_audience')}>{audience}</InfoRow>
              <InfoRow label={t('r_send_type')}>{campaign.template_name ? t('approved_tpl') : t('free_text')}</InfoRow>
              {campaign.template_name && <InfoRow label={t('r_template')}><span dir="ltr" className="font-mono text-[13px]">{tplLabel}</span></InfoRow>}
              {Array.isArray(campaign.template_variables) && campaign.template_variables.length > 0 && (
                <InfoRow label={t('r_vars')}><span dir="ltr" className="font-mono text-[13px]">{campaign.template_variables.map((v: string) => v || '∅').join(' · ')}</span></InfoRow>
              )}
              <InfoRow label={t('r_when')}>{campaign.scheduled_at ? fmtDateTime(campaign.scheduled_at) : t('when_immediate')}</InfoRow>
              <InfoRow label={t('r_delay')}><span className="tabular">{t('delay_value', { n: fmtNum(campaign.delay_seconds || 3) })}</span></InfoRow>
            </div>
          </Card>
          <Card>
            <CardHeader title={t('message_title')} icon={ChatBubbleLeftEllipsisIcon}
              subtitle={campaign.template_name ? t('message_sub_tpl') : t('message_sub_text')} />
            <WhatsAppPreview className="mt-4" message={campaign.message || ''} contactName={tcomp('preview_contact')} />
          </Card>
        </div>
      </div>

      <ConfirmDialog
        destructive
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        loading={deleting}
        title={t('delete_title')}
        description={t('delete_desc', { name: campaign.name })}
        confirmLabel={tc('delete')}
        cancelLabel={tc('cancel')}
      />
    </DashboardLayout>
  )
}
