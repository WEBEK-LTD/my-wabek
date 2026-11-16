import React, { useMemo, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import { useRouter } from 'next/router'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  ChatBubbleLeftRightIcon, PencilIcon, TrashIcon, TagIcon, PhoneIcon, EnvelopeIcon, XMarkIcon, PaperAirplaneIcon,
  NoSymbolIcon, SparklesIcon, BellSlashIcon, CalendarDaysIcon, UserCircleIcon, VariableIcon, PlusIcon,
  MegaphoneIcon, InboxIcon, EllipsisHorizontalIcon, LockClosedIcon, CheckBadgeIcon, ArrowDownLeftIcon, ArrowUpRightIcon,
} from '@heroicons/react/24/outline'
import { CheckIcon } from '@heroicons/react/20/solid'
import {
  Avatar, Badge, Button, Card, CardHeader, ConfirmDialog, Dropdown, EmptyState, Field, Input, Modal, PageHeader,
  Skeleton, StatusPill, Switch, Textarea, cn,
} from '@/components/ui'
import { Notice } from '@/components/settings/Shared'
import { LoadError } from '@/components/analytics/LoadError'
import { CopyButton } from '@/components/campaigns/copy'
import { rich } from '@/components/campaigns/rich'
import {
  campaignStatus, errorStatus, friendlyError, isMemberForbidden, messageStatus, useTeamRole,
} from '@/components/campaigns/shared'
import { useT } from '@/lib/i18n-local'
import dict from '@/locales/dashboard/contact-detail'
import common from '@/locales/dashboard/common-a'

type Key = keyof typeof dict.en
const TYPE_LABELS: Record<string, Key> = {
  image: 'type_image', video: 'type_video', audio: 'type_audio', document: 'type_document', sticker: 'type_sticker', location: 'type_location', template: 'type_template',
}

function dayLabel(d: Date, t: (k: Key) => string, fmtDate: (d: Date) => string) {
  const today = new Date()
  const yest = new Date(); yest.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return t('today')
  if (d.toDateString() === yest.toDateString()) return t('yesterday')
  return fmtDate(d)
}

/* ── Tags editor ─────────────────────────────────────────── */

function TagsEditor({ tags, onSave, saving, disabled }: { tags: string[]; onSave: (t: string[]) => void; saving?: boolean; disabled?: boolean }) {
  const { t } = useT(dict)
  const [draft, setDraft] = useState('')
  const add = () => {
    const next = draft.split(',').map(s => s.trim()).filter(Boolean).filter(s => !tags.includes(s))
    setDraft('')
    if (next.length) onSave([...tags, ...next].slice(0, 50))
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {tags.length === 0 && <span className="text-sm text-muted">{t('no_tags')}</span>}
        {tags.map(tag => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-chip py-1 pe-1 ps-2.5 text-xs font-medium text-chip-ink">
            {tag}
            {!disabled && (
              <button type="button" onClick={() => onSave(tags.filter(x => x !== tag))} disabled={saving}
                className="flex h-5 w-5 items-center justify-center rounded-full transition hover:bg-surface/70" aria-label={t('remove_tag', { tag })}>
                <XMarkIcon className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </span>
        ))}
      </div>
      {!disabled && (
        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); add() }}>
          <Input size="sm" icon={TagIcon} value={draft} onChange={e => setDraft(e.target.value)} placeholder={t('add_tag_ph')} aria-label={t('new_tag_aria')} maxLength={100} wrapperClassName="flex-1" />
          <Button type="submit" size="sm" variant="secondary" icon={PlusIcon} loading={saving} disabled={!draft.trim()}>{t('add')}</Button>
        </form>
      )}
    </div>
  )
}

/* ── Variables editor ────────────────────────────────────── */

function VariablesEditor({ variables, onSave, saving, disabled }: {
  variables: Record<string, string>
  onSave: (v: Record<string, string>) => void
  saving?: boolean
  disabled?: boolean
}) {
  const { t } = useT(dict)
  const { t: tc } = useT(common)
  const entries = Object.entries(variables || {})
  const [editing, setEditing] = useState(false)
  const [rows, setRows] = useState<Array<{ k: string; v: string }>>([])
  const start = () => { setRows(entries.length ? entries.map(([k, v]) => ({ k, v: String(v ?? '') })) : [{ k: '', v: '' }]); setEditing(true) }
  const save = () => {
    const out: Record<string, string> = {}
    for (const r of rows) if (r.k.trim()) out[r.k.trim()] = r.v.slice(0, 1000)
    onSave(out)
    setEditing(false)
  }

  if (!editing) return (
    <div className="space-y-3">
      {entries.length === 0 ? (
        <p className="text-sm text-muted">{rich(t('vars_empty'), { code: <code dir="ltr" className="font-mono">{'{city}'}</code> })}</p>
      ) : (
        <dl className="divide-y divide-line-soft rounded-card border border-line-soft">
          {entries.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
              <dt><code dir="ltr" className="font-mono text-[12.5px] text-chip-ink">{`{${k}}`}</code></dt>
              <dd dir="auto" className="min-w-0 truncate text-end text-ink">{String(v ?? '') || '—'}</dd>
            </div>
          ))}
        </dl>
      )}
      {!disabled && <Button size="sm" variant="secondary" icon={PencilIcon} onClick={start}>{entries.length ? t('edit_vars') : t('add_var')}</Button>}
    </div>
  )

  return (
    <div className="space-y-2.5">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input size="sm" dir="ltr" value={r.k} placeholder="city" aria-label={t('var_name_aria')} className="font-mono"
            onChange={e => setRows(rs => rs.map((x, j) => (j === i ? { ...x, k: e.target.value.replace(/[^\w.-]/g, '') } : x)))} wrapperClassName="w-32 shrink-0" />
          <Input size="sm" dir="auto" value={r.v} placeholder={t('var_value_ph')} aria-label={t('var_value_aria')} maxLength={1000}
            onChange={e => setRows(rs => rs.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))} wrapperClassName="min-w-0 flex-1" />
          <Button size="icon-sm" variant="ghost" icon={XMarkIcon} aria-label={t('remove_var')} onClick={() => setRows(rs => rs.filter((_, j) => j !== i))} />
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button size="xs" variant="ghost" icon={PlusIcon} onClick={() => setRows(rs => [...rs, { k: '', v: '' }])}>{t('new_row')}</Button>
        <span className="flex-1" />
        <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>{tc('cancel')}</Button>
        <Button size="sm" loading={saving} onClick={save}>{tc('save')}</Button>
      </div>
    </div>
  )
}

/* ── Page ────────────────────────────────────────────────── */

export default function ContactDetailPage() {
  const { t, fmtNumber, fmtDate, fmtDateTime, fmtRelative, fmtTime } = useT(dict)
  const { t: tc } = useT(common)
  const fmtNum = (n: number | null | undefined) => fmtNumber(Number(n) || 0)
  const router = useRouter()
  const { id } = router.query
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({ name: '', email: '', tags: '' })
  const [quickMsg, setQuickMsg] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const { canWrite, roleLabel, role } = useTeamRole()
  const canEdit = canWrite('contacts')
  const canSend = role !== 'viewer'

  const { data, isLoading, isError, error, refetch } = useQuery(
    ['contact', id],
    () => axios.get(`/api/contacts/${id}`).then(r => r.data),
    { enabled: !!id, retry: false, onSuccess: (d: any) => setEditData({ name: d.contact.name || '', email: d.contact.email || '', tags: d.contact.tags?.join(', ') || '' }) }
  )
  const { data: instancesData } = useQuery('instances', () => axios.get('/api/whatsapp/instances').then(r => r.data))
  const { data: campData } = useQuery('campaigns', () => axios.get('/api/campaigns').then(r => r.data), { retry: false })

  const contact = data?.contact
  const messages: any[] = data?.messages || []
  const instances: any[] = instancesData?.instances || []
  const connectedInstance = instances.find(i => i.status === 'connected')

  const updateMut = useMutation(
    (body: any) => axios.put(`/api/contacts/${id}`, body),
    {
      onSuccess: () => { qc.invalidateQueries(['contact', id]); setEditing(false); toast.success(t('saved_contact')) },
      onError: (e: any) => { toast.error(friendlyError(e, t('save_failed'))) },
    }
  )
  // Tags / variables saved inline
  const patchMut = useMutation(
    (body: any) => axios.put(`/api/contacts/${id}`, body),
    {
      onSuccess: () => { qc.invalidateQueries(['contact', id]); toast.success(t('saved')) },
      onError: (e: any) => { toast.error(friendlyError(e, t('save_failed_short'))) },
    }
  )

  const deleteMut = useMutation(
    () => axios.delete(`/api/contacts/${id}`),
    {
      onSuccess: () => { toast.success(t('deleted')); router.push('/dashboard/contacts') },
      onError: (e: any) => { toast.error(friendlyError(e, t('delete_failed'))) },
    }
  )

  const blockMut = useMutation(
    (blocked: boolean) => axios.put(`/api/contacts/${id}`, { is_blocked: blocked }),
    {
      onSuccess: (_r, blocked) => { qc.invalidateQueries(['contact', id]); toast.success(blocked ? t('blocked_toast') : t('unblocked_toast')) },
      onError: (e: any) => { toast.error(friendlyError(e, t('block_failed'))) },
    }
  )

  const optOutMut = useMutation(
    (optedOut: boolean) => axios.put(`/api/contacts/${id}`, { opted_out: optedOut }),
    {
      onSuccess: (_r, optedOut) => { qc.invalidateQueries(['contact', id]); toast.success(optedOut ? t('opted_out_toast') : t('resubscribed_toast')) },
      onError: (e: any) => { toast.error(friendlyError(e, t('optout_failed'))) },
    }
  )

  const toggleAi = async () => {
    setAiBusy(true)
    try {
      await axios.post('/api/ai/opt-out', { contact_id: contact.id, opted_out: !contact.ai_opted_out })
      toast.success(contact.ai_opted_out ? t('ai_on_toast') : t('ai_off_toast'))
      qc.invalidateQueries(['contact', id])
    } catch (e) {
      toast.error(friendlyError(e, t('ai_failed')))
    } finally { setAiBusy(false) }
  }

  const sendMsg = async () => {
    if (!quickMsg.trim() || !connectedInstance) return
    setSendingMsg(true)
    try {
      await axios.post('/api/whatsapp/send', { instance_id: connectedInstance.id, to: contact.phone, type: 'text', text: quickMsg.trim() })
      setQuickMsg('')
      qc.invalidateQueries(['contact', id])
      toast.success(t('sent_toast'))
    } catch (e) {
      toast.error(friendlyError(e, t('send_failed')))
    } finally { setSendingMsg(false) }
  }

  // Timeline: oldest → newest, grouped by day
  const timeline = useMemo(() => {
    const sorted = [...messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    const groups: Array<{ day: string; items: any[] }> = []
    for (const m of sorted) {
      const label = dayLabel(new Date(m.created_at), t, fmtDate)
      const last = groups[groups.length - 1]
      if (last && last.day === label) last.items.push(m)
      else groups.push({ day: label, items: [m] })
    }
    return groups
  }, [messages, t, fmtDate])

  const campaignsById = useMemo(() => {
    const map = new Map<string, any>()
    for (const c of campData?.campaigns || []) map.set(c.id, c)
    return map
  }, [campData])

  const received = useMemo(() => {
    const map = new Map<string, { id: string; count: number; last: string; status: string }>()
    for (const m of messages) {
      if (!m.campaign_id) continue
      const cur = map.get(m.campaign_id)
      if (!cur) map.set(m.campaign_id, { id: m.campaign_id, count: 1, last: m.created_at, status: m.status })
      else { cur.count++; if (m.created_at > cur.last) { cur.last = m.created_at; cur.status = m.status } }
    }
    return Array.from(map.values()).sort((a, b) => (a.last < b.last ? 1 : -1))
  }, [messages])

  const inbound = messages.filter(m => m.direction !== 'outbound').length
  const outbound = messages.length - inbound

  if (isLoading || !id) return (
    <DashboardLayout title={t('page_title')}>
      <div className="space-y-5" aria-busy="true" aria-label={t('loading')}>
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
          <div className="space-y-4"><Skeleton className="h-72 rounded-panel" /><Skeleton className="h-40 rounded-panel" /></div>
          <div className="space-y-4"><Skeleton className="h-32 rounded-panel" /><Skeleton className="h-96 rounded-panel" /></div>
        </div>
      </div>
    </DashboardLayout>
  )

  if (!contact) return (
    <DashboardLayout title={t('not_found_title')}>
      <div className="space-y-6">
        <PageHeader back={{ href: '/dashboard/contacts', label: t('back') }} title={t('page_title')} />
        {isError && errorStatus(error) !== 404 ? (
          <LoadError
            title={isMemberForbidden(error) ? t('forbidden_title') : t('load_failed')}
            description={isMemberForbidden(error) ? tc('err_member_forbidden') : friendlyError(error)}
            onRetry={() => refetch()}
          />
        ) : (
          <EmptyState variant="card" icon={UserCircleIcon} title={t('not_found_title')}
            description={t('not_found_desc')}
            action={<Button href="/dashboard/contacts">{t('back_to_list')}</Button>} />
        )}
      </div>
    </DashboardLayout>
  )

  const displayName = contact.name || contact.phone
  const state = contact.is_blocked ? { label: t('st_blocked'), tone: 'danger' as const } : contact.opted_out ? { label: t('st_opted_out'), tone: 'warning' as const } : { label: t('st_active'), tone: 'success' as const }
  const lastActivity = messages[0]?.created_at

  return (
    <DashboardLayout title={displayName}>
      <div className="space-y-6">
        <PageHeader
          back={{ href: '/dashboard/contacts', label: t('back') }}
          eyebrow={t('eyebrow')}
          title={contact.name || <span dir="ltr">{contact.phone}</span>}
          actions={
            <>
              <Button icon={ChatBubbleLeftRightIcon} href={`/dashboard/chat?contact=${id}`}>{t('open_chat')}</Button>
              {canEdit && <Button variant="secondary" icon={PencilIcon} onClick={() => setEditing(true)}>{tc('edit')}</Button>}
              {canEdit && (
                <Dropdown label={t('more_actions')} align="end"
                  trigger={<span className="flex h-11 w-11 items-center justify-center rounded-btn border border-line bg-surface text-muted transition hover:text-ink"><EllipsisHorizontalIcon className="h-5 w-5" aria-hidden="true" /></span>}
                  items={[
                    { label: contact.is_blocked ? t('unblock') : t('block_contact'), icon: NoSymbolIcon, onClick: () => blockMut.mutate(!contact.is_blocked) },
                    { label: t('delete_contact'), icon: TrashIcon, danger: true, divider: true, onClick: () => setConfirmDelete(true) },
                  ]} />
              )}
            </>
          }
        />

        {!canEdit && (
          <Notice tone="info" icon={LockClosedIcon}>{t('role_note', { role: roleLabel })}</Notice>
        )}
        {contact.is_blocked && (
          <Notice tone="danger" icon={NoSymbolIcon} title={t('blocked_title')}
            action={canEdit ? <Button size="sm" variant="secondary" loading={blockMut.isLoading} onClick={() => blockMut.mutate(false)}>{t('unblock')}</Button> : undefined}>
            {t('blocked_body')}
          </Notice>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
          {/* ── Profile column ─────────────────────────── */}
          <div className="space-y-4">
            <Card padding="none" className="overflow-hidden">
              <div className="relative h-20 bg-deep-hero" aria-hidden="true">
                <div className="absolute -end-8 -top-10 h-32 w-32 rounded-full bg-brand-green/25 blur-2xl" />
              </div>
              <div className="-mt-10 px-5 pb-5">
                <div className="rounded-full ring-4 ring-surface w-fit">
                  <Avatar name={displayName} size="xl" />
                </div>
                <h2 className="mt-3 text-lg font-bold text-ink">{contact.name || t('no_name')}</h2>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <StatusPill tone={state.tone}>{state.label}</StatusPill>
                  {contact.ai_opted_out && <Badge tone="violet" icon={SparklesIcon}>{t('ai_paused')}</Badge>}
                </div>
                <dl className="mt-4 space-y-2.5 text-sm">
                  <div className="flex items-center gap-2.5">
                    <PhoneIcon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                    <dt className="sr-only">{t('phone')}</dt>
                    <dd dir="ltr" className="min-w-0 flex-1 truncate text-start font-mono text-[13px] text-ink">{contact.phone}</dd>
                    <CopyButton text={contact.phone} label={t('copy_number')} />
                  </div>
                  <div className="flex items-center gap-2.5">
                    <EnvelopeIcon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                    <dt className="sr-only">{t('email')}</dt>
                    <dd dir="ltr" className={cn('min-w-0 flex-1 truncate text-start text-[13px]', contact.email ? 'text-ink' : 'text-muted')}>{contact.email || '—'}</dd>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CalendarDaysIcon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                    <dt className="sr-only">{t('added_on')}</dt>
                    <dd className="text-[13px] text-muted">{t('added_line', { date: fmtDate(contact.created_at) })}{lastActivity ? t('last_activity', { when: fmtRelative(lastActivity) }) : ''}</dd>
                  </div>
                </dl>
                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line-soft pt-4 text-center">
                  <div className="rounded-card bg-surface-2 py-2.5">
                    <p className="flex items-center justify-center gap-1 text-lg font-bold text-ink tabular"><ArrowDownLeftIcon className="h-4 w-4 text-brand-ink" aria-hidden="true" />{fmtNum(inbound)}</p>
                    <p className="text-[11.5px] text-muted">{t('inbound')}</p>
                  </div>
                  <div className="rounded-card bg-surface-2 py-2.5">
                    <p className="flex items-center justify-center gap-1 text-lg font-bold text-ink tabular"><ArrowUpRightIcon className="h-4 w-4 text-brand-ink" aria-hidden="true" />{fmtNum(outbound)}</p>
                    <p className="text-[11.5px] text-muted">{t('outbound')}</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader title={t('messaging_status')} icon={BellSlashIcon} />
              <div className="mt-4 space-y-4">
                <Switch
                  checked={!contact.opted_out}
                  onChange={v => optOutMut.mutate(!v)}
                  disabled={!canEdit || optOutMut.isLoading}
                  label={t('subscribed')}
                  description={contact.opted_out ? t('subscribed_off_desc') : t('subscribed_on_desc')}
                />
                <Switch
                  checked={!!contact.is_blocked}
                  onChange={v => blockMut.mutate(v)}
                  disabled={!canEdit || blockMut.isLoading}
                  label={t('blocked_switch')}
                  description={t('blocked_switch_desc')}
                />
                <Switch
                  checked={!contact.ai_opted_out}
                  onChange={() => toggleAi()}
                  disabled={!canEdit || aiBusy}
                  label={t('ai_switch')}
                  description={t('ai_switch_desc')}
                />
              </div>
            </Card>

            <Card>
              <CardHeader title={t('tags_title')} icon={TagIcon} subtitle={t('tags_sub')} />
              <div className="mt-4">
                <TagsEditor tags={contact.tags || []} saving={patchMut.isLoading} disabled={!canEdit} onSave={tags => patchMut.mutate({ tags })} />
              </div>
            </Card>

            <Card>
              <CardHeader title={t('vars_title')} icon={VariableIcon} subtitle={t('vars_sub')} />
              <div className="mt-4">
                <VariablesEditor key={JSON.stringify(contact.variables || {})} variables={contact.variables || {}} saving={patchMut.isLoading} disabled={!canEdit}
                  onSave={variables => patchMut.mutate({ variables })} />
              </div>
            </Card>
          </div>

          {/* ── Activity column ────────────────────────── */}
          <div className="min-w-0 space-y-4">
            <Card>
              <CardHeader title={t('quick_title')} icon={PaperAirplaneIcon}
                subtitle={connectedInstance ? t('quick_from', { name: connectedInstance.display_name || connectedInstance.phone_number }) : undefined} />
              <div className="mt-4">
                {!connectedInstance ? (
                  <Notice tone="warning" action={<Button size="sm" variant="secondary" href="/dashboard/instances">{t('connect_number')}</Button>}>{t('no_number')}</Notice>
                ) : contact.is_blocked ? (
                  <p className="text-sm text-muted">{t('cant_blocked')}</p>
                ) : contact.opted_out ? (
                  <p className="text-sm text-muted">{t('cant_opted_out')}</p>
                ) : !canSend ? (
                  <p className="text-sm text-muted">{t('cant_role')}</p>
                ) : (
                  <div className="flex items-end gap-2">
                    <div className="min-w-0 flex-1">
                      <Textarea rows={2} value={quickMsg} onChange={e => setQuickMsg(e.target.value)} className="w-full resize-none"
                        placeholder={t('msg_ph', { name: displayName })} aria-label={t('msg_aria')}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg() } }} />
                    </div>
                    <Button size="icon" icon={PaperAirplaneIcon} loading={sendingMsg} disabled={!quickMsg.trim()} onClick={sendMsg} aria-label={t('send')} className="rtl:-scale-x-100" />
                  </div>
                )}
                {connectedInstance && !contact.is_blocked && !contact.opted_out && canSend && (
                  <p className="mt-2 text-xs text-muted">{t('send_hint')}</p>
                )}
              </div>
            </Card>

            <Card padding="none">
              <CardHeader className="px-5 pt-5 sm:px-6" title={t('history_title')} icon={InboxIcon}
                subtitle={messages.length ? t('history_sub', { n: fmtNum(messages.length) }) : undefined}
                action={messages.length ? <Button size="sm" variant="ghost" href={`/dashboard/chat?contact=${id}`}>{t('full_chat')}</Button> : undefined} />
              <div className="mt-4 max-h-[560px] overflow-y-auto border-t border-line-soft bg-surface-2/50 px-4 py-4 sm:px-6">
                {messages.length === 0 ? (
                  <EmptyState size="sm" icon={ChatBubbleLeftRightIcon} title={t('no_messages_title')}
                    description={t('no_messages_desc')} />
                ) : (
                  <ol className="space-y-4">
                    {timeline.map(g => (
                      <li key={g.day}>
                        <p className="mb-3 flex justify-center"><span className="rounded-full bg-surface px-3 py-1 text-[11px] text-muted shadow-sm">{g.day}</span></p>
                        <ul className="space-y-2">
                          {g.items.map(msg => {
                            const out = msg.direction === 'outbound'
                            const camp = msg.campaign_id ? campaignsById.get(msg.campaign_id) : null
                            const typeLabel = msg.type && msg.type !== 'text' ? (TYPE_LABELS[msg.type] ? t(TYPE_LABELS[msg.type]) : msg.type) : null
                            return (
                              <li key={msg.id} className={cn('flex', out ? 'justify-end' : 'justify-start')}>
                                <div className={cn('max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm sm:max-w-[70%]',
                                  out ? 'rounded-se-md bg-chip text-ink' : 'rounded-ss-md bg-surface text-ink',
                                  msg.status === 'failed' && 'ring-1 ring-danger/40')}>
                                  {(camp || msg.campaign_id) && (
                                    <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-chip-ink">
                                      <MegaphoneIcon className="h-3.5 w-3.5" aria-hidden="true" />{camp?.name || t('campaign')}
                                    </p>
                                  )}
                                  {typeLabel && <p className="mb-0.5 text-[11px] text-muted">{typeLabel}</p>}
                                  <p dir="auto" className="whitespace-pre-wrap break-words">{msg.content || (typeLabel ? '' : '—')}</p>
                                  <p className="mt-1 flex items-center justify-end gap-1 text-[10.5px] text-muted">
                                    <span className="tabular">{fmtTime(msg.created_at)}</span>
                                    {out && (msg.status === 'read' ? (
                                      <span className="flex -space-x-1.5 text-brand-ink rtl:space-x-reverse" aria-label={tc('ms_read')}><CheckIcon className="h-3.5 w-3.5" /><CheckIcon className="h-3.5 w-3.5" /></span>
                                    ) : msg.status === 'delivered' ? (
                                      <span className="flex -space-x-1.5 rtl:space-x-reverse" aria-label={tc('ms_delivered')}><CheckIcon className="h-3.5 w-3.5" /><CheckIcon className="h-3.5 w-3.5" /></span>
                                    ) : msg.status === 'sent' ? (
                                      <CheckIcon className="h-3.5 w-3.5" aria-label={tc('ms_sent')} />
                                    ) : msg.status === 'failed' ? (
                                      <span className="text-danger">{tc('ms_failed')}</span>
                                    ) : msg.status ? <span>{messageStatus(msg.status, tc).label}</span> : null)}
                                  </p>
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </Card>

            <Card padding="none">
              <CardHeader className="px-5 pt-5 sm:px-6" title={t('received_title')} icon={MegaphoneIcon}
                subtitle={received.length ? t('received_sub', { n: fmtNum(received.length) }) : undefined} />
              <div className="mt-3">
                {received.length === 0 ? (
                  <EmptyState size="sm" icon={MegaphoneIcon} title={t('received_empty_title')}
                    description={t('received_empty_desc')} />
                ) : (
                  <ul className="divide-y divide-line-soft border-t border-line-soft">
                    {received.map(r => {
                      const camp = campaignsById.get(r.id)
                      const cs = campaignStatus(camp?.status, tc)
                      return (
                        <li key={r.id}>
                          <Link href={`/dashboard/campaigns/${r.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-surface-2 sm:px-6">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-chip text-brand-ink">
                              {camp?.template_name ? <CheckBadgeIcon className="h-[18px] w-[18px]" aria-hidden="true" /> : <MegaphoneIcon className="h-[18px] w-[18px]" aria-hidden="true" />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-ink">{camp?.name || t('deleted_campaign')}</span>
                              <span className="block text-xs text-muted">{fmtDateTime(r.last)}{r.count > 1 ? ` · ${t('n_messages', { n: fmtNum(r.count) })}` : ''}</span>
                            </span>
                            <span className="flex shrink-0 flex-col items-end gap-1">
                              <StatusPill status={r.status} tone={r.status === 'failed' ? 'danger' : r.status === 'read' || r.status === 'delivered' ? 'success' : 'brand'}>
                                {r.status === 'read' ? tc('ms_read') : r.status === 'delivered' ? tc('ms_delivered') : r.status === 'failed' ? tc('ms_failed') : tc('ms_sent')}
                              </StatusPill>
                              {camp && <span className="text-[11px] text-muted">{cs.label}</span>}
                            </span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Edit modal */}
      <Modal open={editing} onClose={() => setEditing(false)} title={t('edit_title')} icon={PencilIcon}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(false)}>{tc('cancel')}</Button>
            <Button loading={updateMut.isLoading}
              onClick={() => updateMut.mutate({ name: editData.name, email: editData.email, tags: editData.tags.split(',').map(s => s.trim()).filter(Boolean) })}>
              {tc('save')}
            </Button>
          </>
        }>
        <div className="space-y-4">
          <Field label={t('f_name')}><Input value={editData.name} onChange={e => setEditData(d => ({ ...d, name: e.target.value }))} maxLength={200} /></Field>
          <Field label={t('f_email')}><Input type="email" dir="ltr" value={editData.email} onChange={e => setEditData(d => ({ ...d, email: e.target.value }))} placeholder="name@company.com" /></Field>
          <Field label={t('f_tags')} hint={t('f_tags_hint')}><Input value={editData.tags} onChange={e => setEditData(d => ({ ...d, tags: e.target.value }))} placeholder={t('f_tags_ph')} /></Field>
        </div>
      </Modal>

      <ConfirmDialog
        destructive
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => deleteMut.mutate()}
        loading={deleteMut.isLoading}
        title={t('delete_title')}
        description={t('delete_desc', { name: displayName })}
        confirmLabel={tc('delete')}
        cancelLabel={tc('cancel')}
      />
    </DashboardLayout>
  )
}
