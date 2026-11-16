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
import { Notice, InfoRow } from '@/components/settings/Shared'
import { fmtDateTime } from '@/components/settings/format'
import { Stepper, WizardStep } from './Stepper'
import { BackArrowIcon, ForwardArrowIcon } from './icons'
import { WhatsAppPreview, fillSample } from './WhatsAppPreview'
import { AIGenerator, BlockEditor, Block, DEFAULT_BLOCKS, StarterLibrary, buildMessage } from './MessageComposer'
import { browserTimeZone, fmtNum, friendlyError, startResultMessage } from './shared'

const STEPS: WizardStep[] = [
  { id: 1, label: 'الجمهور', icon: UsersIcon },
  { id: 2, label: 'الرسالة', icon: ChatBubbleLeftEllipsisIcon },
  { id: 3, label: 'الموعد', icon: CalendarDaysIcon },
  { id: 4, label: 'المراجعة', icon: RocketLaunchIcon },
]

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
  const qc = useQueryClient()
  const [step, setStep] = useState(1)
  const [maxReached, setMaxReached] = useState(1)
  const [blocks, setBlocks] = useState<Block[]>(DEFAULT_BLOCKS)
  const [previewContact, setPreviewContact] = useState('سارة')
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
    try { return d.toLocaleString('ar-u-nu-latn', { timeZone: zone, day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return fmtDateTime(d) }
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
        setBlocks(DEFAULT_BLOCKS)
        const id = r?.data?.campaign?.id
        if (startAfterCreate.current && id) {
          toast.success('تم إنشاء الحملة وبدأ الإرسال')
          setTimeout(() => qc.invalidateQueries('campaigns'), 1500)
          axios.post(`/api/campaigns/${id}`, { action: 'start' })
            .then(res => { const m = startResultMessage(res.data); (m.ok ? toast.success : toast.error)(m.text) })
            .catch(e => toast.error(friendlyError(e, 'تعذّر بدء الإرسال')))
            .finally(() => qc.invalidateQueries('campaigns'))
        } else {
          toast.success(r?.data?.campaign?.status === 'scheduled' ? 'تمت جدولة الحملة' : 'حُفظت الحملة مسودةً؛ يمكنك بدء إرسالها من القائمة')
        }
        onClose()
      },
      onError: (e: any) => { toast.error(friendlyError(e, 'تعذّر إنشاء الحملة')) },
    }
  )

  const handleCreate = (start = false) => {
    if (!form.name) { toast.error('أدخل اسم الحملة'); return }
    if (!form.instance_id) { toast.error('اختر رقم واتساب للإرسال'); return }
    if (!message.trim()) { toast.error('الرسالة لا يمكن أن تكون فارغة'); return }
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

  const audienceLabel = audienceMode === 'segment' ? (segment?.name || '—') : audienceMode === 'tags' ? `الوسوم: ${form.tags}` : 'جميع جهات الاتصال'

  const previewNode = (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">المعاينة</h3>
        <label className="flex items-center gap-2 text-xs text-muted">
          <span>اسم للمعاينة</span>
          <Input size="sm" value={previewContact} onChange={e => setPreviewContact(e.target.value)} className="w-28" aria-label="اسم جهة الاتصال في المعاينة" />
        </label>
      </div>
      <WhatsAppPreview
        message={fillSample(message, previewContact)}
        contactName={previewContact}
        header={usingTemplate ? <p className="mb-2 text-center"><Badge tone="neutral" size="sm" icon={CheckBadgeIcon}>قالب معتمد · <span dir="ltr">{form.template_language}</span></Badge></p> : undefined}
      />
      <p className="text-xs text-muted">
        <span className="tabular">{fmtNum(message.length)}</span> حرفًا · القيم في المعاينة أمثلة فقط، وتُستبدل ببيانات كل مستلم عند الإرسال.
      </p>
    </div>
  )

  return (
    <div className="scroll-mt-28 space-y-5" ref={topRef}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] text-muted">الحملات</p>
          <h1 className="text-2xl font-bold text-ink">حملة جديدة</h1>
        </div>
        <Button variant="secondary" icon={XMarkIcon} onClick={onClose}>إلغاء</Button>
      </div>

      <Stepper steps={STEPS} current={step} maxReached={maxReached} onGo={go} />

      {/* ── Step 1: audience ─────────────────────────────── */}
      {step === 1 && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <Card>
              <CardHeader title="أساسيات الحملة" subtitle="اسم داخلي يظهر لفريقك فقط، والرقم الذي تُرسل منه" icon={PencilSquareIcon} />
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="اسم الحملة" required>
                  <Input value={form.name} onChange={e => setForm(d => ({ ...d, name: e.target.value }))} placeholder="تخفيضات الشتاء" maxLength={200} />
                </Field>
                <Field label="رقم الإرسال" required hint={instance ? (waWeb ? 'رقم واتساب ويب: تُرسل الرسالة نصًّا كما تكتبها' : 'رقم Cloud API: تُرسل الحملة عبر قالب معتمد') : undefined}>
                  {instLoading ? <Skeleton className="h-11 w-full" /> : (
                    <Select value={form.instance_id} onChange={e => setForm(d => ({ ...d, instance_id: e.target.value }))}
                      placeholder={instances.length ? 'اختر رقمًا…' : 'لا توجد أرقام متصلة'}
                      options={instances.map(i => ({ value: i.id, label: `${i.display_name || i.phone_number}${isWaWeb(i) ? ' · واتساب ويب' : ' · Cloud API'}` }))} />
                  )}
                </Field>
              </div>
              {!instLoading && instances.length === 0 && (
                <Notice tone="warning" className="mt-4" title="لا يوجد رقم واتساب متصل"
                  action={<Button size="sm" variant="secondary" href="/dashboard/instances" icon={DevicePhoneMobileIcon}>ربط رقم</Button>}>
                  اربط رقمًا من صفحة أرقام واتساب لتتمكن من إرسال الحملات.
                </Notice>
              )}
            </Card>

            <Card>
              <CardHeader title="من سيستلم الحملة؟" subtitle="تُستبعد جهات الاتصال المحظورة ومن ألغوا اشتراكهم تلقائيًا" icon={UsersIcon} />
              <div className="mt-4 grid gap-3" role="radiogroup" aria-label="الجمهور">
                <ChoiceCard name="audience" value="all" selected={audienceMode === 'all'} icon={GlobeAltIcon}
                  title="جميع جهات الاتصال" description="كل جهات الاتصال المشتركة في حسابك."
                  onSelect={() => { setAudienceMode('all'); setForm(d => ({ ...d, segment_id: '', tags: '' })) }} />
                <ChoiceCard name="audience" value="segment" selected={audienceMode === 'segment'} icon={FunnelIcon}
                  title="شريحة محفوظة" description="جمهور محدد بقواعد (الوسوم، الاسم، بادئة الرقم…). تُنسخ قواعد الشريحة إلى الحملة عند إنشائها."
                  badge={segments.length ? <Badge size="sm" tone="neutral">{segments.length}</Badge> : undefined}
                  onSelect={() => { setAudienceMode('segment'); setForm(d => ({ ...d, tags: '' })) }} />
                <ChoiceCard name="audience" value="tags" selected={audienceMode === 'tags'} icon={TagIcon}
                  title="حسب الوسوم" description="جهات الاتصال التي تحمل أيًّا من الوسوم التي تكتبها."
                  onSelect={() => { setAudienceMode('tags'); setForm(d => ({ ...d, segment_id: '' })) }} />
              </div>

              {audienceMode === 'segment' && (
                <div className="mt-4">
                  {segLoading ? <Skeleton className="h-11 w-full" /> : segments.length === 0 ? (
                    <EmptyState size="sm" variant="card" icon={FunnelIcon} title="لا توجد شرائح بعد"
                      description="أنشئ شريحة من صفحة الشرائح ثم عد لاختيارها."
                      action={<Button size="sm" variant="secondary" href="/dashboard/segments">إنشاء شريحة</Button>} />
                  ) : (
                    <Field label="الشريحة" required>
                      <Select value={form.segment_id || ''} onChange={e => setForm(d => ({ ...d, segment_id: e.target.value, tags: '' }))}
                        placeholder="اختر شريحة…"
                        options={segments.map(s => ({ value: s.id, label: `${s.name} (${fmtNum(s.contact_count)} جهة اتصال)` }))} />
                    </Field>
                  )}
                </div>
              )}
              {audienceMode === 'tags' && (
                <div className="mt-4">
                  <Field label="الوسوم" hint="افصل بين الوسوم بفاصلة، مثل: vip, عملاء" required>
                    <Input icon={TagIcon} value={form.tags} onChange={e => setForm(d => ({ ...d, tags: e.target.value, segment_id: '' }))} placeholder="vip, عملاء" />
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
                <p className="text-[13px] text-deep-muted">المستلمون المتوقعون</p>
                <div className="mt-1 flex items-end gap-2" aria-live="polite">
                  {!audienceQuery ? (
                    <span className="text-3xl font-bold text-deep-ink">—</span>
                  ) : audLoading && recipientCount === null ? (
                    <Skeleton className="h-10 w-28 bg-white/10" />
                  ) : audError ? (
                    <span className="text-sm text-deep-muted">تعذّر حساب العدد الآن</span>
                  ) : (
                    <>
                      {!recipientExact && <span className="pb-1 text-sm text-deep-muted">حتى</span>}
                      <span className="text-4xl font-bold tabular text-deep-ink">{fmtNum(recipientCount)}</span>
                      <span className="pb-1 text-sm text-deep-muted">جهة اتصال</span>
                      {audLoading && <ArrowPathIcon className="mb-2 h-4 w-4 animate-spin text-deep-muted" aria-label="جارٍ التحديث" />}
                    </>
                  )}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-deep-muted">
                  {audienceMode === 'all' ? 'جميع جهات الاتصال غير المحظورة والمشتركة.'
                    : audienceMode === 'segment' ? (segment ? (recipientExact ? `شريحة «${segment.name}» بعد استبعاد المحظورين وملغي الاشتراك.` : `شريحة «${segment.name}» (قواعد «أيٌّ منها»)؛ يُستبعد المحظورون وملغو الاشتراك عند الإرسال.`) : 'اختر شريحة لعرض العدد.')
                    : tagList.length ? 'من يحمل أيًّا من هذه الوسوم؛ يُستبعد المحظورون وملغو الاشتراك عند الإرسال.' : 'اكتب وسمًا واحدًا على الأقل.'}
                </p>
                {audData?.contacts?.length > 0 && audienceQuery && (
                  <div className="mt-4 flex items-center gap-3 border-t border-white/10 pt-4">
                    <AvatarGroup people={audData.contacts.slice(0, 5).map((c: any) => ({ name: c.name || c.phone }))} max={5} />
                    <span className="min-w-0 truncate text-xs text-deep-muted">{audData.contacts.slice(0, 3).map((c: any) => c.name || c.phone).join('، ')}…</span>
                  </div>
                )}
              </div>
            </Card>
            {recipientCount === 0 && !audLoading && (
              <Notice tone="warning">لا توجد جهات اتصال مطابقة لهذا الجمهور حاليًا.</Notice>
            )}
          </aside>
        </div>
      )}

      {/* ── Step 2: message ─────────────────────────────── */}
      {step === 2 && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-5">
            <Card>
              <CardHeader title="نوع الرسالة" icon={ChatBubbleLeftEllipsisIcon}
                subtitle={waWeb ? 'رقم واتساب ويب يرسل النص كما تكتبه.' : 'لا يمكن مراسلة من مرّ على آخر رسالة منه أكثر من 24 ساعة إلا بقالب معتمد من Meta.'} />
              <div className="mt-4 grid gap-3 md:grid-cols-2" role="radiogroup" aria-label="نوع الرسالة">
                <ChoiceCard name="msgmode" value="template" selected={messageMode === 'template'} icon={CheckBadgeIcon}
                  title="قالب معتمد" disabled={waWeb}
                  badge={!waWeb ? <Badge tone="success" size="sm">موصى به</Badge> : undefined}
                  description={waWeb ? 'غير متاح لأرقام واتساب ويب.' : 'يصل إلى الجميع، داخل نافذة الـ 24 ساعة وخارجها.'}
                  onSelect={() => setMessageMode('template')} />
                <ChoiceCard name="msgmode" value="text" selected={messageMode === 'text'} icon={DocumentTextIcon}
                  title="نص حر"
                  description={waWeb ? 'تُرسل رسالتك كما هي إلى كل مستلم.' : 'يُدرج نصك في القالب العام marketing_offer لأن أرقام Cloud API ترسل الحملات بقالب دائمًا.'}
                  onSelect={() => { setMessageMode('text') }} />
              </div>
            </Card>

            {messageMode === 'template' && !waWeb && (
              <Card padding="none">
                <CardHeader className="px-5 pt-5 sm:px-6" title="اختر القالب" icon={CheckBadgeIcon}
                  subtitle={approvedTemplates.length ? `${fmtNum(approvedTemplates.length)} قالب معتمد في حساب واتساب للأعمال` : 'القوالب المعتمدة في حساب واتساب للأعمال'}
                  action={<Button size="icon-sm" variant="ghost" icon={ArrowPathIcon} onClick={() => refetchTpl()} aria-label="تحديث القوالب" />} />
                <div className="space-y-3 p-5 sm:p-6">
                  {tplLoading ? (
                    <div className="space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-16 w-full rounded-card" />)}</div>
                  ) : tplError ? (
                    <Notice tone="danger" title="تعذّر تحميل القوالب من Meta">
                      {friendlyError(tplError, 'حاول مرة أخرى بعد قليل.')} يمكنك المتابعة بالنص الحر (القالب العام marketing_offer).
                    </Notice>
                  ) : tplData?.error ? (
                    <Notice tone="warning" title="لا يمكن جلب القوالب لهذا الرقم">
                      لم يُضبط معرّف حساب واتساب للأعمال (WABA ID) لهذا الرقم. أعد ربطه عبر التسجيل المدمج من صفحة الأرقام.
                    </Notice>
                  ) : approvedTemplates.length === 0 ? (
                    <EmptyState size="sm" icon={DocumentTextIcon} title="لا توجد قوالب معتمدة"
                      description={`أنشئ قالبًا في Meta Business Manager ← WhatsApp Manager ← Message Templates، وانتظر اعتماده ثم حدّث القائمة.${otherTemplates ? ` لديك ${fmtNum(otherTemplates)} قالب بانتظار المراجعة أو مرفوض.` : ''}`}
                      action={<Button size="sm" variant="secondary" icon={ArrowPathIcon} onClick={() => refetchTpl()}>تحديث</Button>} />
                  ) : (
                    <>
                      {approvedTemplates.length > 5 && (
                        <SearchInput size="sm" value={tplSearch} onChange={setTplSearch} placeholder="ابحث باسم القالب أو نصه" />
                      )}
                      <div className="grid max-h-[420px] gap-2 overflow-y-auto pe-1" role="radiogroup" aria-label="القوالب المعتمدة">
                        {shownTemplates.map((t: any) => {
                          const sel = t.name === form.template_name && t.language === form.template_language
                          return (
                            <label key={`${t.name}_${t.language}`} className={cn(
                              'flex cursor-pointer flex-col gap-1.5 rounded-card border p-3.5 transition',
                              sel ? 'border-brand-teal bg-chip/50 shadow-ring' : 'border-line bg-surface hover:border-line-strong',
                            )}>
                              <input type="radio" name="tpl" className="sr-only" checked={sel} onChange={() => pickTemplate(`${t.name}|${t.language}`)} />
                              <span className="flex flex-wrap items-center gap-2">
                                <code dir="ltr" className="font-mono text-[13px] font-semibold text-ink">{t.name}</code>
                                <Badge size="sm" tone="brand"><span dir="ltr">{t.language}</span></Badge>
                                {t.category && <Badge size="sm" tone="neutral">{t.category}</Badge>}
                                <Badge size="sm" tone="violet">{t.variableCount} {t.variableCount === 1 ? 'متغير' : 'متغيرات'}</Badge>
                                {t.hasButtons && <Badge size="sm" tone="neutral">أزرار</Badge>}
                              </span>
                              {t.body && <span dir="auto" className="line-clamp-2 whitespace-pre-wrap text-[13px] text-muted">{t.body}</span>}
                            </label>
                          )
                        })}
                        {shownTemplates.length === 0 && <p className="py-4 text-center text-sm text-muted">لا توجد قوالب مطابقة للبحث.</p>}
                      </div>
                      {otherTemplates > 0 && <p className="text-xs text-muted">{fmtNum(otherTemplates)} قالب آخر بانتظار المراجعة أو مرفوض لا يظهر هنا.</p>}
                    </>
                  )}

                  {form.template_name && (
                    <div className="space-y-3 rounded-card border border-line-soft bg-surface-2 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-ink">متغيرات القالب</p>
                        <Button size="xs" variant="ghost" icon={XMarkIcon} onClick={clearTemplate}>إلغاء الاختيار</Button>
                      </div>
                      {form.template_variables.length === 0 ? (
                        <p className="text-xs text-muted">هذا القالب لا يحتوي على متغيرات؛ سيُرسل نصه المعتمد كما هو.</p>
                      ) : (
                        <>
                          {form.template_variables.map((v, i) => {
                            const label = `{{${form.template_param_names[i] || i + 1}}}`
                            const setVal = (val: string) => setForm(d => ({ ...d, template_variables: d.template_variables.map((x, j) => (j === i ? val : x)) }))
                            return (
                              <Field key={i} label={<span dir="ltr" className="font-mono">{label}</span>}>
                                <div className="space-y-1.5">
                                  <Input value={v} dir="auto" className="font-mono text-sm"
                                    placeholder={`${label} — مثل {name} أو {phone} أو {city}`}
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
                            <code dir="ltr" className="font-mono">{'{name}'}</code> و<code dir="ltr" className="font-mono">{'{phone}'}</code> ومتغيرات جهة الاتصال تُستبدل لكل مستلم. النص الذي يصل هو نص القالب المعتمد مع هذه القيم.
                          </p>
                          {emptyVars > 0 && <Notice tone="warning">{fmtNum(emptyVars)} من المتغيرات فارغ؛ قد ترفض Meta الرسالة إن كان المتغير مطلوبًا.</Notice>}
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
                  <Notice tone="info" title="كيف تصل الرسالة النصية من رقم Cloud API؟">
                    تُرسل الحملات من أرقام Cloud API عبر قالب دائمًا. بدون اختيار قالب يُستخدم القالب العام
                    <code dir="ltr" className="mx-1 font-mono">marketing_offer</code>
                    ويُدرج نصك فيه مكان تفاصيل العرض مع اسم المستلم. للتحكم الكامل بالنص اختر «قالب معتمد».
                  </Notice>
                )}
                <AIGenerator onGenerate={setBlocks} />
                <StarterLibrary onPick={(b, name) => { setBlocks(b); toast.success(`تم تحميل نموذج: ${name}`) }} />
                <Card>
                  <CardHeader title="محرر الرسالة" subtitle="رتّب الكتل وأضف المتغيرات والرموز التعبيرية" icon={PencilSquareIcon} />
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
            <CardHeader title="متى تُرسل الحملة؟" icon={CalendarDaysIcon} subtitle={`المنطقة الزمنية لجهازك: ${tz.zone} (${tz.offset})`} />
            <div className="mt-4 grid gap-3 md:grid-cols-2" role="radiogroup" aria-label="موعد الإرسال">
              <ChoiceCard name="when" value="now" selected={scheduleMode === 'now'} icon={BoltIcon}
                title="الآن" description="ابدأ الإرسال فور الإنشاء، أو احفظها مسودة وابدأ لاحقًا."
                onSelect={() => setScheduleMode('now')} />
              <ChoiceCard name="when" value="later" selected={scheduleMode === 'later'} icon={ClockIcon}
                title="في موعد محدد" description="تبدأ الحملة تلقائيًا في الوقت الذي تختاره."
                onSelect={() => {
                  setScheduleMode('later')
                  if (!form.scheduled_at) setForm(d => ({ ...d, scheduled_at: localInputValue(new Date(Date.now() + 60 * 60_000)) }))
                }} />
            </div>

            {scheduleMode === 'later' && (
              <div className="mt-5 space-y-3">
                <Field label="تاريخ الإرسال ووقته" required hint={`بتوقيت جهازك ${tz.zone} (${tz.offset})`} error={scheduleInPast ? 'اختر وقتًا في المستقبل' : undefined}>
                  <Input type="datetime-local" dir="ltr" value={form.scheduled_at} min={localInputValue(new Date())}
                    onChange={e => setForm(d => ({ ...d, scheduled_at: e.target.value }))} className="max-w-xs" />
                </Field>
                {scheduledDate && !scheduleInPast && (
                  <p className="text-sm text-ink">
                    ستبدأ الحملة في <strong className="font-semibold">{fmtInZone(scheduledDate, tz.zone)}</strong>
                    {profileTzDiffers && <span className="text-muted"> · وهو {fmtInZone(scheduledDate, profileTz!)} بتوقيت ملفك ({profileTz})</span>}
                  </p>
                )}
                {profileTzDiffers && (
                  <Notice tone="info">
                    المنطقة الزمنية في ملفك الشخصي ({profileTz}) تختلف عن منطقة جهازك. يُعتمد الوقت كما تراه على جهازك الآن.
                  </Notice>
                )}
              </div>
            )}

            <div className="mt-6 border-t border-line-soft pt-5">
              <Field label="الفاصل بين الرسائل (بالثواني)" hint="فاصل أطول يقلّل خطر تقييد الرقم من واتساب. من 1 إلى 60 ثانية.">
                <Input type="number" value={form.delay_seconds} min={1} max={60} dir="ltr" className="max-w-[140px]"
                  onChange={e => setForm(d => ({ ...d, delay_seconds: e.target.value }))} />
              </Field>
            </div>
          </Card>
          <aside className="space-y-3">
            <Card variant="muted">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink"><InformationCircleIcon className="h-5 w-5 text-brand-ink" aria-hidden="true" />مدة الإرسال التقريبية</p>
              <p className="mt-1.5 text-sm text-muted">
                {recipientCount !== null
                  ? <>نحو <span className="font-semibold text-ink tabular">{fmtNum(Math.ceil((recipientCount * (parseInt(form.delay_seconds) || 3)) / 60))}</span> دقيقة لـ <span className="tabular">{fmtNum(recipientCount)}</span> مستلم بفاصل {parseInt(form.delay_seconds) || 3} ثوانٍ.</>
                  : 'تعتمد على عدد المستلمين والفاصل بين الرسائل.'}
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
              <CardHeader title="ملخّص الحملة" icon={RocketLaunchIcon} subtitle="راجع التفاصيل قبل الإنشاء" />
              <div className="mt-3">
                <InfoRow label="الاسم">{form.name}</InfoRow>
                <InfoRow label="رقم الإرسال">{instance?.display_name || instance?.phone_number || '—'}</InfoRow>
                <InfoRow label="الجمهور">{audienceLabel}</InfoRow>
                <InfoRow label="المستلمون المتوقعون">
                  {recipientCount === null ? '—' : <span className="tabular">{recipientExact ? '' : 'حتى '}{fmtNum(recipientCount)}</span>}
                </InfoRow>
                <InfoRow label="نوع الرسالة">{usingTemplate ? 'قالب معتمد' : waWeb ? 'نص حر' : 'نص حر (القالب العام marketing_offer)'}</InfoRow>
                {usingTemplate && (
                  <InfoRow label="القالب"><span dir="ltr" className="font-mono text-[13px]">{form.template_name} · {form.template_language}</span></InfoRow>
                )}
                {usingTemplate && form.template_variables.length > 0 && (
                  <InfoRow label="المتغيرات"><span dir="ltr" className="font-mono text-[13px]">{form.template_variables.map(v => v || '∅').join(' · ')}</span></InfoRow>
                )}
                <InfoRow label="الموعد">{scheduleMode === 'later' && scheduledDate ? `${fmtInZone(scheduledDate, tz.zone)} (${tz.zone})` : 'فور البدء'}</InfoRow>
                <InfoRow label="الفاصل بين الرسائل"><span className="tabular">{parseInt(form.delay_seconds) || 3}</span> ثوانٍ</InfoRow>
              </div>
            </Card>

            {msgsLeft !== null && recipientCount !== null && recipientCount > msgsLeft && (
              <Notice tone="warning" icon={ExclamationTriangleIcon} title="قد تتجاوز حد رسائل باقتك"
                action={<Button size="sm" variant="secondary" href="/dashboard/billing">الباقات</Button>}>
                المتبقي من رسائل هذا الشهر <span className="tabular">{fmtNum(msgsLeft)}</span> من <span className="tabular">{fmtNum(maxMsgs)}</span>، وعدد المستلمين <span className="tabular">{fmtNum(recipientCount)}</span>. قد يتوقف الإرسال عند بلوغ الحد.
              </Notice>
            )}
            {Number.isFinite(maxCampaigns) && maxCampaigns >= 0 && campaignsThisMonth !== null && campaignsThisMonth >= maxCampaigns && maxCampaigns !== -1 && (
              <Notice tone="danger" title={maxCampaigns === 0 ? 'الحملات غير متاحة في باقتك' : 'بلغت الحد الشهري للحملات'}
                action={<Button size="sm" variant="secondary" href="/dashboard/billing">ترقية الباقة</Button>}>
                {maxCampaigns === 0 ? 'رقِّ باقتك لإنشاء الحملات.' : `أنشأت ${fmtNum(campaignsThisMonth)} من ${fmtNum(maxCampaigns)} حملة هذا الشهر؛ سيُرفض إنشاء حملة جديدة.`}
              </Notice>
            )}
            {recipientCount === 0 && <Notice tone="warning">لا يوجد مستلمون مطابقون حاليًا؛ ستكتمل الحملة دون إرسال إن بدأت الآن.</Notice>}
            {emptyVars > 0 && (
              <Notice tone="warning" action={<Button size="sm" variant="secondary" onClick={() => go(2)}>تعديل</Button>}>
                {fmtNum(emptyVars)} من متغيرات القالب فارغ؛ قد ترفض Meta الرسالة إن كان المتغير مطلوبًا.
              </Notice>
            )}

            <Card variant="muted" className="space-y-3">
              {scheduleMode === 'later' ? (
                <Button size="lg" fullWidth icon={CalendarDaysIcon} loading={createMut.isLoading} onClick={() => handleCreate(false)}>جدولة الحملة</Button>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button size="lg" icon={PlayIcon} loading={createMut.isLoading && startAfterCreate.current} disabled={createMut.isLoading} onClick={() => handleCreate(true)}>إنشاء وبدء الإرسال</Button>
                  <Button size="lg" variant="secondary" icon={BookmarkIcon} loading={createMut.isLoading && !startAfterCreate.current} disabled={createMut.isLoading} onClick={() => handleCreate(false)}>حفظ كمسودة</Button>
                </div>
              )}
              <p className="text-xs text-muted">
                {scheduleMode === 'later' ? 'تبدأ الحملة تلقائيًا في موعدها، ويمكنك إيقافها مؤقتًا من صفحتها.' : 'يمكنك إيقاف الحملة مؤقتًا واستئنافها في أي وقت من صفحتها دون إرسال مكرر.'}
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
            {step === 1 ? 'إلغاء' : 'السابق'}
          </Button>
          <span className="hidden text-xs text-muted sm:inline">
            {!stepValid(step) && (step === 1 ? 'أدخل الاسم واختر الرقم والجمهور للمتابعة' : step === 2 ? (messageMode === 'template' ? 'اختر قالبًا للمتابعة' : 'اكتب الرسالة للمتابعة') : 'اختر وقتًا في المستقبل')}
          </span>
          <Button variant="dark" iconEnd={ForwardArrowIcon} onClick={next} disabled={!stepValid(step)}>
            التالي: {STEPS[step]?.label}
          </Button>
        </div>
      )}
      {step === 4 && (
        <div className="flex">
          <Button variant="ghost" icon={BackArrowIcon} onClick={() => go(3)}>السابق</Button>
        </div>
      )}
      <p className="sr-only" aria-live="polite">{`الخطوة ${step}: ${STEPS[step - 1].label}`}</p>
    </div>
  )
}
