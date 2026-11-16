// Campaign builder: audience → message → schedule → review.
// The request built in handleCreate() is the one from the functional fixes
// (segment_id, template_language / variables / param names, ISO schedule).
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  UsersIcon, ChatBubbleLeftEllipsisIcon, CalendarDaysIcon, RocketLaunchIcon, XMarkIcon,
  DevicePhoneMobileIcon, FunnelIcon, TagIcon, GlobeAltIcon,
  DocumentTextIcon, CheckBadgeIcon, PencilSquareIcon, ClockIcon, BoltIcon, ExclamationTriangleIcon,
  InformationCircleIcon, ArrowPathIcon, PlayIcon, BookmarkIcon,
} from '@heroicons/react/24/outline'
import {
  AvatarGroup, Badge, Button, Card, CardHeader, EmptyState, Field, Input, SearchInput, Select, Skeleton, cn,
} from '@/components/ui'
import { usePlanFeature } from '@/hooks/usePlanFeature'
import { useAuthStore } from '@/lib/store'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/dashboard/campaign-wizard'
import composerMessages from '@/locales/dashboard/message-composer'
import componentMessages from '@/locales/dashboard/campaign-components'
import common from '@/locales/dashboard/common-a'
import { Notice, InfoRow } from '@/components/settings/Shared'
import { Stepper, WizardStep } from './Stepper'
import { BackArrowIcon, ForwardArrowIcon } from './icons'
import { WhatsAppPreview, fillSample } from './WhatsAppPreview'
import { AIGenerator, BlockEditor, Block, defaultBlocks, StarterLibrary, buildMessage } from './MessageComposer'
import { browserTimeZone, friendlyError, startResultMessage } from './shared'
import { rich } from './rich'

type AudienceMode = 'all' | 'segment' | 'tags'
type MessageMode = 'text' | 'template'

interface WizardForm {
  name: string
  instance_id: string
  tags: string
  segment_id: string
  delay_seconds: string
  scheduled_at: string
  template_name: string
  template_language: string
  template_variables: string[]
  template_param_names: string[]
}

const EMPTY_FORM: WizardForm = { name: '', instance_id: '', tags: '', segment_id: '', delay_seconds: '3', scheduled_at: '', template_name: '', template_language: '', template_variables: [] as string[], template_param_names: [] as string[] }

const isWaWeb = (inst: any) => (inst?.instance_type || inst?.type) === 'wa_web'

/** datetime-local value for "now + minutes" in the browser's time zone. */
function localInputValue(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Option card used for the audience / message / schedule choices. */
function ChoiceCard({ selected, onSelect, icon: Icon, title, description, disabled, badge, name, value }: {
  selected: boolean
  onSelect: () => void
  icon: React.ElementType
  title: React.ReactNode
  description?: React.ReactNode
  disabled?: boolean
  badge?: React.ReactNode
  name: string
  value: string
}) {
  return (
    <label className={cn(
      'relative flex cursor-pointer items-start gap-3 rounded-card border p-4 transition',
      selected ? 'border-brand-teal bg-chip/50 shadow-ring' : 'border-line bg-surface hover:border-line-strong',
      disabled && 'cursor-not-allowed opacity-60',
    )}>
      <input type="radio" name={name} value={value} checked={selected} disabled={disabled} onChange={onSelect} className="sr-only" />
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', selected ? 'bg-brand-gradient text-[#04282C]' : 'bg-surface-3 text-brand-ink')}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2 font-semibold text-ink">{title}{badge}</span>
        {description && <span className="mt-0.5 block text-[13px] leading-relaxed text-muted">{description}</span>}
      </span>
      <span aria-hidden="true" className={cn('mt-1 h-4 w-4 shrink-0 rounded-full border-2', selected ? 'border-brand-teal bg-brand-teal shadow-[inset_0_0_0_2px_rgb(var(--surface))]' : 'border-line-strong')} />
    </label>
  )
}

/** Fill a template body with the variable values (placeholders like {name} stay for the server). */
function templateText(body: string, values: string[], names: string[]) {
  let out = String(body || '')
  values.forEach((v, i) => {
    const key = names[i] || String(i + 1)
    out = out.replace(new RegExp(`\\{\\{\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\}\\}`, 'g'), v)
  })
  return out
}

export function CampaignWizard({ onClose }: { onClose: () => void }) {
  const { t, fmtNumber, fmtDateTime, locale, lang } = useT(messages)
  const { t: tm } = useT(composerMessages)
  const { t: tcomp } = useT(componentMessages)
  const { t: tc } = useT(common)
  const fmtNum = (n: number | null | undefined) => fmtNumber(Number(n) || 0)

  const STEPS: WizardStep[] = [
    { id: 1, label: t('step_audience'), icon: UsersIcon },
    { id: 2, label: t('step_message'), icon: ChatBubbleLeftEllipsisIcon },
    { id: 3, label: t('step_schedule'), icon: CalendarDaysIcon },
    { id: 4, label: t('step_review'), icon: RocketLaunchIcon },
  ]

  const qc = useQueryClient()
  const [step, setStep] = useState(1)
  const [maxReached, setMaxReached] = useState(1)
  // null = untouched: the default message (and preview name) follow the UI language
  const [blocksState, setBlocksState] = useState<Block[] | null>(null)
  const blocks = blocksState ?? defaultBlocks(tm)
  const setBlocks: React.Dispatch<React.SetStateAction<Block[]>> = v =>
    setBlocksState(prev => (typeof v === 'function' ? v(prev ?? defaultBlocks(tm)) : v))
  const [previewContactState, setPreviewContact] = useState<string | null>(null)
  const previewContact = previewContactState ?? tcomp('sample_name')
  const [form, setForm] = useState<WizardForm>(EMPTY_FORM)
  const [audienceMode, setAudienceMode] = useState<AudienceMode>('all')
  const [messageMode, setMessageMode] = useState<MessageMode>('text')
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now')
  const [tplSearch, setTplSearch] = useState('')
  const [debouncedTags, setDebouncedTags] = useState('')
  const startAfterCreate = useRef(false)
  const topRef = useRef<HTMLDivElement>(null)
  const profileTz = useAuthStore(s => s.user?.timezone) || null

  const { data: segData, isLoading: segLoading } = useQuery('segments', () => axios.get('/api/segments').then(r => r.data))
  const segments: any[] = segData?.segments || []
  const { data: iData, isLoading: instLoading } = useQuery('instances', () => axios.get('/api/whatsapp/instances').then(r => r.data))
  const { data: tplData, isLoading: tplLoading, error: tplError, refetch: refetchTpl } = useQuery(
    ['wa-templates', form.instance_id],
    () => axios.get(`/api/whatsapp/templates?instance_id=${form.instance_id}`).then(r => r.data),
    { enabled: !!form.instance_id }
  )
  const allTemplates: any[] = tplData?.templates || []
  const approvedTemplates = allTemplates.filter((t: any) => t.status === 'APPROVED')
  const otherTemplates = allTemplates.length - approvedTemplates.length
  const instances: any[] = (iData?.instances || []).filter((i: any) => i.status === 'connected')
  const instance = instances.find(i => i.id === form.instance_id)
  const waWeb = isWaWeb(instance)

  // Contact variable keys (for the variable chips) — read from the first contacts page
  const { data: varData } = useQuery('contact-variable-keys',
    () => axios.get('/api/contacts?limit=100').then(r => r.data), { staleTime: 5 * 60_000, retry: false })
  const contactVarKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const c of varData?.contacts || []) for (const k of Object.keys(c?.variables || {})) if (/^[\w.-]{1,40}$/.test(k)) keys.add(k)
    return Array.from(keys).slice(0, 12)
  }, [varData])

  const { features } = usePlanFeature()
  const { data: statsData } = useQuery('billing-usage', () => axios.get('/api/dashboard/stats').then(r => r.data), { staleTime: 60000, retry: false })
  const { data: cData } = useQuery('campaigns', () => axios.get('/api/campaigns').then(r => r.data))

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTags(form.tags), 350)
    return () => clearTimeout(t)
  }, [form.tags])

  // WA Web numbers do not use Meta templates
  useEffect(() => { if (waWeb && messageMode === 'template') setMessageMode('text') }, [waWeb, messageMode])

  /* ── Live recipient count (segments preview API) ─────────── */
  const segment = segments.find(s => s.id === form.segment_id)
  const tagList = debouncedTags.split(',').map(t => t.trim()).filter(Boolean)
  // Exact count from the same filter the campaign sender uses
  // (excludes blocked and opted-out contacts).
  const audienceQuery = useMemo(() => {
    if (audienceMode === 'segment') {
      if (!segment) return null
      return { audience: 'segment' as const, segment_id: segment.id }
    }
    if (audienceMode === 'tags') {
      if (!tagList.length) return null
      return { audience: 'tags' as const, tags: tagList.slice(0, 20), tag_operator: 'any' as const }
    }
    return { audience: 'all' as const }
  }, [audienceMode, segment, tagList.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  const { data: audData, isFetching: audLoading, isError: audError } = useQuery(
    ['campaign-audience', audienceQuery],
    () => axios.post('/api/campaigns/audience-count', audienceQuery).then(r => r.data),
    { enabled: !!audienceQuery, keepPreviousData: true, staleTime: 30_000, retry: false }
  )
  const recipientCount: number | null = audienceQuery && audData ? Number(audData.count || 0) : null
  const recipientExact = true

  /* ── Message ─────────────────────────────────────────────── */
  const selectedTemplate = approvedTemplates.find((t: any) => t.name === form.template_name && t.language === form.template_language)
  const usingTemplate = messageMode === 'template' && !!form.template_name
  const blocksMessage = buildMessage(blocks)
  const message = usingTemplate
    ? (templateText(selectedTemplate?.body || '', form.template_variables, form.template_param_names).trim() || form.template_name)
    : blocksMessage
  const emptyVars = usingTemplate ? form.template_variables.filter(v => !v.trim()).length : 0

  const pickTemplate = (value: string) => {
    const [name, language] = value.split('|')
    const t = approvedTemplates.find((x: any) => x.name === name && x.language === language)
    const count = t?.variableCount || 0
    setForm(d => ({
      ...d, template_name: name || '', template_language: language || '',
      // Defaults: first variable = contact name; edit below
      template_variables: Array.from({ length: count }, (_, i) => (i === 0 ? '{name}' : '')),
      template_param_names: t?.parameterFormat === 'NAMED' ? (t.paramNames || []) : [],
    }))
  }
  const clearTemplate = () => setForm(d => ({ ...d, template_name: '', template_language: '', template_variables: [], template_param_names: [] }))

  const shownTemplates = approvedTemplates.filter((t: any) => !tplSearch || `${t.name} ${t.body}`.toLowerCase().includes(tplSearch.toLowerCase()))

  /* ── Schedule ────────────────────────────────────────────── */
  const tz = browserTimeZone(form.scheduled_at ? new Date(form.scheduled_at) : new Date())
  const scheduledDate = form.scheduled_at ? new Date(form.scheduled_at) : null
  const scheduleInPast = !!scheduledDate && scheduledDate.getTime() < Date.now() - 60_000
  const profileTzDiffers = !!profileTz && profileTz !== tz.zone
  const fmtInZone = (d: Date, zone: string) => {
    try { return d.toLocaleString(locale, { timeZone: zone, day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return fmtDateTime(d) }
  }

  /* ── Plan limits (only when the plan data is there) ──────── */
  const maxMsgs = Number(features?.max_messages_month)
  const sentThisMonth = statsData?.stats ? Number(statsData.stats.sent_this_month || 0) : null
  const msgsLeft = Number.isFinite(maxMsgs) && maxMsgs > 0 && sentThisMonth !== null ? Math.max(0, maxMsgs - sentThisMonth) : null
  const maxCampaigns = Number(features?.max_campaigns)
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
  const campaignsThisMonth = cData?.campaigns ? cData.campaigns.filter((c: any) => new Date(c.created_at).getTime() >= monthStart).length : null

  /* ── Create ──────────────────────────────────────────────── */
  const createMut = useMutation(
    (body: any) => axios.post('/api/campaigns', body),
    {
      onSuccess: (r: any) => {
        qc.invalidateQueries('campaigns')
        setStep(1)
        setBlocksState(null)
        const id = r?.data?.campaign?.id
        if (startAfterCreate.current && id) {
          toast.success(t('created_started'))
          setTimeout(() => qc.invalidateQueries('campaigns'), 1500)
          axios.post(`/api/campaigns/${id}`, { action: 'start' })
            .then(res => { const m = startResultMessage(res.data); (m.ok ? toast.success : toast.error)(m.text) })
            .catch(e => toast.error(friendlyError(e, t('start_failed'))))
            .finally(() => qc.invalidateQueries('campaigns'))
        } else {
          toast.success(r?.data?.campaign?.status === 'scheduled' ? t('scheduled_toast') : t('draft_toast'))
        }
        onClose()
      },
      onError: (e: any) => { toast.error(friendlyError(e, t('create_failed'))) },
    }
  )

  const handleCreate = (start = false) => {
    if (!form.name) { toast.error(t('need_name')); return }
    if (!form.instance_id) { toast.error(t('need_sender')); return }
    if (!message.trim()) { toast.error(t('need_message')); return }
    startAfterCreate.current = start
    const tplName = usingTemplate ? form.template_name : ''
    createMut.mutate({
      name: form.name,
      instance_id: form.instance_id,
      message,
      template_name: tplName || undefined,
      // The selected template's approved language (from Meta)
      template_language: tplName && form.template_language ? form.template_language : undefined,
      ...(tplName ? {
        template_variables: form.template_variables,
        ...(form.template_param_names.length ? { template_param_names: form.template_param_names } : {}),
      } : {}),
      segment_id: form.segment_id || undefined,
      contact_filter: form.segment_id ? { segment_id: form.segment_id }
        : form.tags ? { tags: form.tags.split(',').map(t => t.trim()).filter(Boolean), tag_operator: 'any' } : { all: true },
      delay_seconds: parseInt(form.delay_seconds) || 3,
      // datetime-local is the browser's local time → send an ISO instant
      scheduled_at: scheduleMode === 'later' && form.scheduled_at ? new Date(form.scheduled_at).toISOString() : undefined,
    })
  }

  /* ── Navigation ──────────────────────────────────────────── */
  const stepValid = (s: number) => {
    if (s === 1) return !!form.name.trim() && !!form.instance_id && (audienceMode !== 'segment' || !!form.segment_id) && (audienceMode !== 'tags' || !!form.tags.trim())
    if (s === 2) return messageMode === 'template' ? !!form.template_name : !!blocksMessage.trim()
    if (s === 3) return scheduleMode === 'now' || (!!form.scheduled_at && !scheduleInPast)
    return true
  }
  const go = (s: number) => {
    setStep(s)
    setMaxReached(m => Math.max(m, s))
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const next = () => { if (stepValid(step)) go(step + 1) }

  const audienceLabel = audienceMode === 'segment' ? (segment?.name || '—') : audienceMode === 'tags' ? t('aud_label_tags', { tags: form.tags }) : t('aud_all_title')
  const delaySecs = parseInt(form.delay_seconds) || 3

  const previewNode = (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">{t('preview')}</h3>
        <label className="flex items-center gap-2 text-xs text-muted">
          <span>{t('preview_name')}</span>
          <Input size="sm" value={previewContact} onChange={e => setPreviewContact(e.target.value)} className="w-28" aria-label={t('preview_name_aria')} />
        </label>
      </div>
      <WhatsAppPreview
        message={fillSample(message, previewContact, {}, lang)}
        contactName={previewContact}
        header={usingTemplate ? <p className="mb-2 text-center"><Badge tone="neutral" size="sm" icon={CheckBadgeIcon}>{t('tpl_choice_title')} · <span dir="ltr">{form.template_language}</span></Badge></p> : undefined}
      />
      <p className="text-xs text-muted">
        {t('chars_note', { n: fmtNum(message.length) })}
      </p>
    </div>
  )

  return (
    <div className="scroll-mt-28 space-y-5" ref={topRef}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] text-muted">{t('crumb')}</p>
          <h1 className="text-2xl font-bold text-ink">{t('title')}</h1>
        </div>
        <Button variant="secondary" icon={XMarkIcon} onClick={onClose}>{tc('cancel')}</Button>
      </div>

      <Stepper steps={STEPS} current={step} maxReached={maxReached} onGo={go} />

      {/* ── Step 1: audience ─────────────────────────────── */}
      {step === 1 && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <Card>
              <CardHeader title={t('basics_title')} subtitle={t('basics_sub')} icon={PencilSquareIcon} />
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label={t('name_label')} required>
                  <Input value={form.name} onChange={e => setForm(d => ({ ...d, name: e.target.value }))} placeholder={t('name_ph')} maxLength={200} />
                </Field>
                <Field label={t('sender_label')} required hint={instance ? (waWeb ? t('sender_hint_web') : t('sender_hint_cloud')) : undefined}>
                  {instLoading ? <Skeleton className="h-11 w-full" /> : (
                    <Select value={form.instance_id} onChange={e => setForm(d => ({ ...d, instance_id: e.target.value }))}
                      placeholder={instances.length ? t('sender_ph') : t('sender_none')}
                      options={instances.map(i => ({ value: i.id, label: `${i.display_name || i.phone_number} · ${isWaWeb(i) ? t('wa_web') : 'Cloud API'}` }))} />
                  )}
                </Field>
              </div>
              {!instLoading && instances.length === 0 && (
                <Notice tone="warning" className="mt-4" title={t('no_number_title')}
                  action={<Button size="sm" variant="secondary" href="/dashboard/instances" icon={DevicePhoneMobileIcon}>{t('connect_number')}</Button>}>
                  {t('no_number_body')}
                </Notice>
              )}
            </Card>

            <Card>
              <CardHeader title={t('audience_title')} subtitle={t('audience_sub')} icon={UsersIcon} />
              <div className="mt-4 grid gap-3" role="radiogroup" aria-label={t('step_audience')}>
                <ChoiceCard name="audience" value="all" selected={audienceMode === 'all'} icon={GlobeAltIcon}
                  title={t('aud_all_title')} description={t('aud_all_desc')}
                  onSelect={() => { setAudienceMode('all'); setForm(d => ({ ...d, segment_id: '', tags: '' })) }} />
                <ChoiceCard name="audience" value="segment" selected={audienceMode === 'segment'} icon={FunnelIcon}
                  title={t('aud_segment_title')} description={t('aud_segment_desc')}
                  badge={segments.length ? <Badge size="sm" tone="neutral">{fmtNum(segments.length)}</Badge> : undefined}
                  onSelect={() => { setAudienceMode('segment'); setForm(d => ({ ...d, tags: '' })) }} />
                <ChoiceCard name="audience" value="tags" selected={audienceMode === 'tags'} icon={TagIcon}
                  title={t('aud_tags_title')} description={t('aud_tags_desc')}
                  onSelect={() => { setAudienceMode('tags'); setForm(d => ({ ...d, segment_id: '' })) }} />
              </div>

              {audienceMode === 'segment' && (
                <div className="mt-4">
                  {segLoading ? <Skeleton className="h-11 w-full" /> : segments.length === 0 ? (
                    <EmptyState size="sm" variant="card" icon={FunnelIcon} title={t('no_segments_title')}
                      description={t('no_segments_desc')}
                      action={<Button size="sm" variant="secondary" href="/dashboard/segments">{t('create_segment')}</Button>} />
                  ) : (
                    <Field label={t('segment_label')} required>
                      <Select value={form.segment_id || ''} onChange={e => setForm(d => ({ ...d, segment_id: e.target.value, tags: '' }))}
                        placeholder={t('segment_ph')}
                        options={segments.map(s => ({ value: s.id, label: t('segment_option', { name: s.name, n: fmtNum(s.contact_count) }) }))} />
                    </Field>
                  )}
                </div>
              )}
              {audienceMode === 'tags' && (
                <div className="mt-4">
                  <Field label={t('tags_label')} hint={t('tags_hint')} required>
                    <Input icon={TagIcon} value={form.tags} onChange={e => setForm(d => ({ ...d, tags: e.target.value, segment_id: '' }))} placeholder={t('tags_ph')} />
                  </Field>
                </div>
              )}
            </Card>
          </div>

          {/* Live recipients */}
          <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
            <Card variant="deep" padding="lg" className="overflow-hidden">
              <div aria-hidden="true" className="pointer-events-none absolute -end-12 -top-16 h-44 w-44 rounded-full bg-brand-green/20 blur-3xl" />
              <div className="relative">
                <p className="text-[13px] text-deep-muted">{t('expected_recipients')}</p>
                <div className="mt-1 flex items-end gap-2" aria-live="polite">
                  {!audienceQuery ? (
                    <span className="text-3xl font-bold text-deep-ink">—</span>
                  ) : audLoading && recipientCount === null ? (
                    <Skeleton className="h-10 w-28 bg-white/10" />
                  ) : audError ? (
                    <span className="text-sm text-deep-muted">{t('count_error')}</span>
                  ) : (
                    <>
                      {!recipientExact && <span className="pb-1 text-sm text-deep-muted">{t('up_to')}</span>}
                      <span className="text-4xl font-bold tabular text-deep-ink">{fmtNum(recipientCount)}</span>
                      <span className="pb-1 text-sm text-deep-muted">{t('contacts_unit')}</span>
                      {audLoading && <ArrowPathIcon className="mb-2 h-4 w-4 animate-spin text-deep-muted" aria-label={t('updating')} />}
                    </>
                  )}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-deep-muted">
                  {audienceMode === 'all' ? t('aud_note_all')
                    : audienceMode === 'segment' ? (segment ? (recipientExact ? t('aud_note_segment', { name: segment.name }) : t('aud_note_segment_any', { name: segment.name })) : t('aud_note_pick_segment'))
                    : tagList.length ? t('aud_note_tags') : t('aud_note_need_tag')}
                </p>
                {audData?.contacts?.length > 0 && audienceQuery && (
                  <div className="mt-4 flex items-center gap-3 border-t border-white/10 pt-4">
                    <AvatarGroup people={audData.contacts.slice(0, 5).map((c: any) => ({ name: c.name || c.phone }))} max={5} />
                    <span className="min-w-0 truncate text-xs text-deep-muted">{audData.contacts.slice(0, 3).map((c: any) => c.name || c.phone).join(t('list_sep'))}…</span>
                  </div>
                )}
              </div>
            </Card>
            {recipientCount === 0 && !audLoading && (
              <Notice tone="warning">{t('no_match_audience')}</Notice>
            )}
          </aside>
        </div>
      )}

      {/* ── Step 2: message ─────────────────────────────── */}
      {step === 2 && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-5">
            <Card>
              <CardHeader title={t('msg_type_title')} icon={ChatBubbleLeftEllipsisIcon}
                subtitle={waWeb ? t('msg_type_sub_web') : t('msg_type_sub_cloud')} />
              <div className="mt-4 grid gap-3 md:grid-cols-2" role="radiogroup" aria-label={t('msg_type_title')}>
                <ChoiceCard name="msgmode" value="template" selected={messageMode === 'template'} icon={CheckBadgeIcon}
                  title={t('tpl_choice_title')} disabled={waWeb}
                  badge={!waWeb ? <Badge tone="success" size="sm">{t('recommended')}</Badge> : undefined}
                  description={waWeb ? t('tpl_choice_desc_web') : t('tpl_choice_desc')}
                  onSelect={() => setMessageMode('template')} />
                <ChoiceCard name="msgmode" value="text" selected={messageMode === 'text'} icon={DocumentTextIcon}
                  title={t('text_choice_title')}
                  description={waWeb ? t('text_choice_desc_web') : t('text_choice_desc_cloud')}
                  onSelect={() => { setMessageMode('text') }} />
              </div>
            </Card>

            {messageMode === 'template' && !waWeb && (
              <Card padding="none">
                <CardHeader className="px-5 pt-5 sm:px-6" title={t('pick_tpl_title')} icon={CheckBadgeIcon}
                  subtitle={approvedTemplates.length ? t('pick_tpl_sub_n', { n: fmtNum(approvedTemplates.length) }) : t('pick_tpl_sub')}
                  action={<Button size="icon-sm" variant="ghost" icon={ArrowPathIcon} onClick={() => refetchTpl()} aria-label={t('refresh_tpl')} />} />
                <div className="space-y-3 p-5 sm:p-6">
                  {tplLoading ? (
                    <div className="space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-16 w-full rounded-card" />)}</div>
                  ) : tplError ? (
                    <Notice tone="danger" title={t('tpl_load_error_title')}>
                      {friendlyError(tplError, t('tpl_load_error_fb'))} {t('tpl_load_error_tail')}
                    </Notice>
                  ) : tplData?.error ? (
                    <Notice tone="warning" title={t('no_waba_title')}>
                      {t('no_waba_body')}
                    </Notice>
                  ) : approvedTemplates.length === 0 ? (
                    <EmptyState size="sm" icon={DocumentTextIcon} title={t('no_tpl_title')}
                      description={`${t('no_tpl_desc')}${otherTemplates ? t('no_tpl_desc_other', { n: fmtNum(otherTemplates) }) : ''}`}
                      action={<Button size="sm" variant="secondary" icon={ArrowPathIcon} onClick={() => refetchTpl()}>{tc('refresh')}</Button>} />
                  ) : (
                    <>
                      {approvedTemplates.length > 5 && (
                        <SearchInput size="sm" value={tplSearch} onChange={setTplSearch} placeholder={t('tpl_search_ph')} />
                      )}
                      <div className="grid max-h-[420px] gap-2 overflow-y-auto pe-1" role="radiogroup" aria-label={t('approved_tpls_aria')}>
                        {shownTemplates.map((tp: any) => {
                          const sel = tp.name === form.template_name && tp.language === form.template_language
                          return (
                            <label key={`${tp.name}_${tp.language}`} className={cn(
                              'flex cursor-pointer flex-col gap-1.5 rounded-card border p-3.5 transition',
                              sel ? 'border-brand-teal bg-chip/50 shadow-ring' : 'border-line bg-surface hover:border-line-strong',
                            )}>
                              <input type="radio" name="tpl" className="sr-only" checked={sel} onChange={() => pickTemplate(`${tp.name}|${tp.language}`)} />
                              <span className="flex flex-wrap items-center gap-2">
                                <code dir="ltr" className="font-mono text-[13px] font-semibold text-ink">{tp.name}</code>
                                <Badge size="sm" tone="brand"><span dir="ltr">{tp.language}</span></Badge>
                                {tp.category && <Badge size="sm" tone="neutral"><span dir="ltr">{tp.category}</span></Badge>}
                                <Badge size="sm" tone="violet">{t(tp.variableCount === 1 ? 'tpl_vars_one' : 'tpl_vars_other', { n: fmtNum(tp.variableCount) })}</Badge>
                                {tp.hasButtons && <Badge size="sm" tone="neutral">{t('tpl_buttons')}</Badge>}
                              </span>
                              {tp.body && <span dir="auto" className="line-clamp-2 whitespace-pre-wrap text-[13px] text-muted">{tp.body}</span>}
                            </label>
                          )
                        })}
                        {shownTemplates.length === 0 && <p className="py-4 text-center text-sm text-muted">{t('no_tpl_match')}</p>}
                      </div>
                      {otherTemplates > 0 && <p className="text-xs text-muted">{t('other_tpls_hidden', { n: fmtNum(otherTemplates) })}</p>}
                    </>
                  )}

                  {form.template_name && (
                    <div className="space-y-3 rounded-card border border-line-soft bg-surface-2 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-ink">{t('tpl_vars_title')}</p>
                        <Button size="xs" variant="ghost" icon={XMarkIcon} onClick={clearTemplate}>{t('clear_selection')}</Button>
                      </div>
                      {form.template_variables.length === 0 ? (
                        <p className="text-xs text-muted">{t('tpl_no_vars')}</p>
                      ) : (
                        <>
                          {form.template_variables.map((v, i) => {
                            const label = `{{${form.template_param_names[i] || i + 1}}}`
                            const setVal = (val: string) => setForm(d => ({ ...d, template_variables: d.template_variables.map((x, j) => (j === i ? val : x)) }))
                            return (
                              <Field key={i} label={<span dir="ltr" className="font-mono">{label}</span>}>
                                <div className="space-y-1.5">
                                  <Input value={v} dir="auto" className="font-mono text-sm"
                                    placeholder={t('var_ph', { label })}
                                    onChange={e => setVal(e.target.value)} />
                                  <div className="flex flex-wrap gap-1">
                                    {['{name}', '{phone}', ...contactVarKeys.map(k => `{${k}}`)].map(chip => (
                                      <button key={chip} type="button" dir="ltr" onClick={() => setVal(v ? `${v} ${chip}` : chip)}
                                        className="rounded-md border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px] text-chip-ink hover:border-brand-teal">{chip}</button>
                                    ))}
                                  </div>
                                </div>
                              </Field>
                            )
                          })}
                          <p className="text-xs leading-relaxed text-muted">
                            {rich(t('tpl_vars_help'), {
                              c1: <code dir="ltr" className="font-mono">{'{name}'}</code>,
                              c2: <code dir="ltr" className="font-mono">{'{phone}'}</code>,
                            })}
                          </p>
                          {emptyVars > 0 && <Notice tone="warning">{t('empty_vars_warn', { n: fmtNum(emptyVars) })}</Notice>}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            )}

            {messageMode === 'text' && (
              <>
                {!waWeb && instance && (
                  <Notice tone="info" title={t('cloud_text_title')}>
                    {rich(t('cloud_text_body'), { code: <code dir="ltr" className="mx-1 font-mono">marketing_offer</code> })}
                  </Notice>
                )}
                <AIGenerator onGenerate={setBlocks} />
                <StarterLibrary onPick={(b, name) => { setBlocks(b); toast.success(t('starter_loaded', { name })) }} />
                <Card>
                  <CardHeader title={t('editor_title')} subtitle={t('editor_sub')} icon={PencilSquareIcon} />
                  <div className="mt-4"><BlockEditor blocks={blocks} setBlocks={setBlocks} extraVariables={contactVarKeys} /></div>
                </Card>
              </>
            )}
          </div>
          <aside className="xl:sticky xl:top-20 xl:self-start">
            <Card>{previewNode}</Card>
          </aside>
        </div>
      )}

      {/* ── Step 3: schedule ────────────────────────────── */}
      {step === 3 && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card>
            <CardHeader title={t('when_title')} icon={CalendarDaysIcon} subtitle={t('tz_sub', { zone: tz.zone, offset: tz.offset })} />
            <div className="mt-4 grid gap-3 md:grid-cols-2" role="radiogroup" aria-label={t('when_aria')}>
              <ChoiceCard name="when" value="now" selected={scheduleMode === 'now'} icon={BoltIcon}
                title={t('now_title')} description={t('now_desc')}
                onSelect={() => setScheduleMode('now')} />
              <ChoiceCard name="when" value="later" selected={scheduleMode === 'later'} icon={ClockIcon}
                title={t('later_title')} description={t('later_desc')}
                onSelect={() => {
                  setScheduleMode('later')
                  if (!form.scheduled_at) setForm(d => ({ ...d, scheduled_at: localInputValue(new Date(Date.now() + 60 * 60_000)) }))
                }} />
            </div>

            {scheduleMode === 'later' && (
              <div className="mt-5 space-y-3">
                <Field label={t('datetime_label')} required hint={t('datetime_hint', { zone: tz.zone, offset: tz.offset })} error={scheduleInPast ? t('pick_future') : undefined}>
                  <Input type="datetime-local" dir="ltr" value={form.scheduled_at} min={localInputValue(new Date())}
                    onChange={e => setForm(d => ({ ...d, scheduled_at: e.target.value }))} className="max-w-xs" />
                </Field>
                {scheduledDate && !scheduleInPast && (
                  <p className="text-sm text-ink">
                    {rich(t('starts_at'), { time: <strong className="font-semibold">{fmtInZone(scheduledDate, tz.zone)}</strong> })}
                    {profileTzDiffers && <span className="text-muted">{t('profile_tz_note', { time: fmtInZone(scheduledDate, profileTz!), zone: profileTz })}</span>}
                  </p>
                )}
                {profileTzDiffers && (
                  <Notice tone="info">
                    {t('profile_tz_differs', { zone: profileTz })}
                  </Notice>
                )}
              </div>
            )}

            <div className="mt-6 border-t border-line-soft pt-5">
              <Field label={t('delay_label')} hint={t('delay_hint')}>
                <Input type="number" value={form.delay_seconds} min={1} max={60} dir="ltr" className="max-w-[140px]"
                  onChange={e => setForm(d => ({ ...d, delay_seconds: e.target.value }))} />
              </Field>
            </div>
          </Card>
          <aside className="space-y-3">
            <Card variant="muted">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink"><InformationCircleIcon className="h-5 w-5 text-brand-ink" aria-hidden="true" />{t('duration_title')}</p>
              <p className="mt-1.5 text-sm text-muted">
                {recipientCount !== null
                  ? rich(t('duration_body'), {
                    min: <span className="font-semibold text-ink tabular">{fmtNum(Math.ceil((recipientCount * delaySecs) / 60))}</span>,
                    n: <span className="tabular">{fmtNum(recipientCount)}</span>,
                    s: fmtNum(delaySecs),
                  })
                  : t('duration_unknown')}
              </p>
            </Card>
          </aside>
        </div>
      )}

      {/* ── Step 4: review ──────────────────────────────── */}
      {step === 4 && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-4">
            <Card>
              <CardHeader title={t('summary_title')} icon={RocketLaunchIcon} subtitle={t('summary_sub')} />
              <div className="mt-3">
                <InfoRow label={t('r_name')}>{form.name}</InfoRow>
                <InfoRow label={t('sender_label')}>{instance?.display_name || instance?.phone_number || '—'}</InfoRow>
                <InfoRow label={t('step_audience')}>{audienceLabel}</InfoRow>
                <InfoRow label={t('expected_recipients')}>
                  {recipientCount === null ? '—' : <span className="tabular">{recipientExact ? fmtNum(recipientCount) : t('up_to_n', { n: fmtNum(recipientCount) })}</span>}
                </InfoRow>
                <InfoRow label={t('msg_type_title')}>{usingTemplate ? t('tpl_choice_title') : waWeb ? t('text_choice_title') : t('msg_type_text_cloud')}</InfoRow>
                {usingTemplate && (
                  <InfoRow label={t('r_template')}><span dir="ltr" className="font-mono text-[13px]">{form.template_name} · {form.template_language}</span></InfoRow>
                )}
                {usingTemplate && form.template_variables.length > 0 && (
                  <InfoRow label={t('r_vars')}><span dir="ltr" className="font-mono text-[13px]">{form.template_variables.map(v => v || '∅').join(' · ')}</span></InfoRow>
                )}
                <InfoRow label={t('step_schedule')}>{scheduleMode === 'later' && scheduledDate ? `${fmtInZone(scheduledDate, tz.zone)} (${tz.zone})` : t('when_immediate')}</InfoRow>
                <InfoRow label={t('r_delay')}><span className="tabular">{t('delay_value', { n: fmtNum(delaySecs) })}</span></InfoRow>
              </div>
            </Card>

            {msgsLeft !== null && recipientCount !== null && recipientCount > msgsLeft && (
              <Notice tone="warning" icon={ExclamationTriangleIcon} title={t('limit_warn_title')}
                action={<Button size="sm" variant="secondary" href="/dashboard/billing">{t('plans')}</Button>}>
                {t('limit_warn_body', { left: fmtNum(msgsLeft), max: fmtNum(maxMsgs), n: fmtNum(recipientCount) })}
              </Notice>
            )}
            {Number.isFinite(maxCampaigns) && maxCampaigns >= 0 && campaignsThisMonth !== null && campaignsThisMonth >= maxCampaigns && maxCampaigns !== -1 && (
              <Notice tone="danger" title={maxCampaigns === 0 ? t('camp_unavailable_title') : t('camp_limit_title')}
                action={<Button size="sm" variant="secondary" href="/dashboard/billing">{t('upgrade_plan')}</Button>}>
                {maxCampaigns === 0 ? t('camp_unavailable_body') : t('camp_limit_body', { n: fmtNum(campaignsThisMonth), max: fmtNum(maxCampaigns) })}
              </Notice>
            )}
            {recipientCount === 0 && <Notice tone="warning">{t('no_recipients_warn')}</Notice>}
            {emptyVars > 0 && (
              <Notice tone="warning" action={<Button size="sm" variant="secondary" onClick={() => go(2)}>{tc('edit')}</Button>}>
                {t('empty_vars_review', { n: fmtNum(emptyVars) })}
              </Notice>
            )}

            <Card variant="muted" className="space-y-3">
              {scheduleMode === 'later' ? (
                <Button size="lg" fullWidth icon={CalendarDaysIcon} loading={createMut.isLoading} onClick={() => handleCreate(false)}>{t('schedule_btn')}</Button>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button size="lg" icon={PlayIcon} loading={createMut.isLoading && startAfterCreate.current} disabled={createMut.isLoading} onClick={() => handleCreate(true)}>{t('create_start')}</Button>
                  <Button size="lg" variant="secondary" icon={BookmarkIcon} loading={createMut.isLoading && !startAfterCreate.current} disabled={createMut.isLoading} onClick={() => handleCreate(false)}>{t('save_draft')}</Button>
                </div>
              )}
              <p className="text-xs text-muted">
                {scheduleMode === 'later' ? t('later_note') : t('now_note')}
              </p>
            </Card>
          </div>
          <aside className="xl:sticky xl:top-20 xl:self-start">
            <Card>{previewNode}</Card>
          </aside>
        </div>
      )}

      {/* Footer navigation */}
      {step < 4 && (
        <div className="sticky bottom-0 z-[5] -mx-1 flex items-center justify-between gap-3 rounded-card border border-line bg-surface/95 px-4 py-3 shadow-dropdown backdrop-blur">
          <Button variant="ghost" icon={BackArrowIcon} onClick={() => (step === 1 ? onClose() : go(step - 1))}>
            {step === 1 ? tc('cancel') : t('back')}
          </Button>
          <span className="hidden text-xs text-muted sm:inline">
            {!stepValid(step) && (step === 1 ? t('hint_step1') : step === 2 ? (messageMode === 'template' ? t('hint_step2_tpl') : t('hint_step2_text')) : t('pick_future'))}
          </span>
          <Button variant="dark" iconEnd={ForwardArrowIcon} onClick={next} disabled={!stepValid(step)}>
            {t('next_step', { label: STEPS[step]?.label })}
          </Button>
        </div>
      )}
      {step === 4 && (
        <div className="flex">
          <Button variant="ghost" icon={BackArrowIcon} onClick={() => go(3)}>{t('back')}</Button>
        </div>
      )}
      <p className="sr-only" aria-live="polite">{tcomp('step_n_label', { n: step, label: STEPS[step - 1].label })}</p>
    </div>
  )
}
