import React, { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import axios from 'axios'
import {
  ArrowPathIcon, BellAlertIcon, CalendarDaysIcon, ChatBubbleLeftRightIcon, CheckCircleIcon, CheckIcon, CircleStackIcon,
  ClockIcon, ComputerDesktopIcon, CpuChipIcon, DevicePhoneMobileIcon, EnvelopeIcon, ExclamationTriangleIcon,
  LinkIcon, PaperAirplaneIcon, ServerStackIcon, ShieldCheckIcon, Squares2X2Icon, WrenchScrewdriverIcon, XCircleIcon,
} from '@heroicons/react/24/outline'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Select, Skeleton, Tabs, Textarea, Tooltip } from '@/components/ui'
import type { Tone } from '@/components/ui'
import { cn } from '@/components/ui/utils'
import { MarketingPage, PageHero } from '@/components/marketing/MarketingPage'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/public/status'

// Country codes for phone subscription
const COUNTRIES = [
  { code: '+966', name: 'Saudi Arabia' },
  { code: '+971', name: 'UAE' },
  { code: '+965', name: 'Kuwait' },
  { code: '+974', name: 'Qatar' },
  { code: '+973', name: 'Bahrain' },
  { code: '+968', name: 'Oman' },
  { code: '+20', name: 'Egypt' },
  { code: '+90', name: 'Turkey' },
  { code: '+1', name: 'USA' },
  { code: '+44', name: 'UK' },
  { code: '+33', name: 'France' },
  { code: '+49', name: 'Germany' },
]

type Key = keyof typeof messages.en

const SERVICES: { key: 'api' | 'whatsapp' | 'dashboard' | 'campaigns' | 'chatbot' | 'auth' | 'webhooks' | 'storage'; icon: React.ElementType }[] = [
  { key: 'api', icon: ServerStackIcon },
  { key: 'whatsapp', icon: ChatBubbleLeftRightIcon },
  { key: 'dashboard', icon: Squares2X2Icon },
  { key: 'campaigns', icon: PaperAirplaneIcon },
  { key: 'chatbot', icon: CpuChipIcon },
  { key: 'auth', icon: ShieldCheckIcon },
  { key: 'webhooks', icon: LinkIcon },
  { key: 'storage', icon: CircleStackIcon },
]

const STATUS_META: Record<string, { tone: Tone; dot: string }> = {
  operational: { tone: 'success', dot: 'bg-[#22A06B]' },
  degraded: { tone: 'warning', dot: 'bg-[#E08A3C]' },
  outage: { tone: 'danger', dot: 'bg-danger-solid' },
  maintenance: { tone: 'violet', dot: 'bg-violet' },
}

const INCIDENT_STATUS: Record<string, { tone: Tone }> = {
  resolved: { tone: 'success' },
  investigating: { tone: 'danger' },
  identified: { tone: 'warning' },
  monitoring: { tone: 'violet' },
}

const DAY = 86400000
const dayKey = (d: Date) => d.toISOString().slice(0, 10)

export default function StatusPage() {
  const { brandName } = useWhiteLabel()
  const name = brandName || 'WABEK'
  const { t: T, lang, dir, fmtDate, fmtDateTime } = useT(messages)

  const [svcStatus, setSvcStatus] = useState<Record<string, string>>({})
  const [incidents, setIncidents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [checkedAt, setCheckedAt] = useState<Date | null>(null)

  // Subscribe state
  const [subType, setSubType] = useState<'email' | 'phone'>('email')
  const [subEmail, setSubEmail] = useState('')
  const [subPhone, setSubPhone] = useState('')
  const [subCountry, setSubCountry] = useState('+966')
  const [subLoading, setSubLoading] = useState(false)
  const [subDone, setSubDone] = useState(false)
  const [subError, setSubError] = useState('')

  // Contact form
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [formLoading, setFormLoading] = useState(false)
  const [formDone, setFormDone] = useState(false)
  const [formError, setFormError] = useState('')

  const load = () => {
    setLoading(true)
    setLoadError(false)
    Promise.all([
      axios.get('/api/admin/service-status'),
      axios.get('/api/status/incidents'),
    ]).then(([s, i]) => {
      setSvcStatus(s.data.services || {})
      setIncidents(i.data.incidents || [])
      setCheckedAt(new Date())
    }).catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  async function subscribe(e: React.FormEvent) {
    e.preventDefault()
    const value = subType === 'email' ? subEmail.trim() : `${subCountry}${subPhone.trim()}`
    if (subType === 'email' ? !subEmail.trim() : !subPhone.trim()) { setSubError(T('invalid')); return }
    setSubLoading(true); setSubError('')
    try {
      await axios.post('/api/status/subscribe', {
        type: subType,
        value,
        country_code: subType === 'phone' ? subCountry : null,
      })
      setSubDone(true)
    } catch (err: any) {
      setSubError(err?.response?.data?.error || T('sub_failed'))
    }
    setSubLoading(false)
  }

  async function sendContact(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.email || !form.subject || !form.message) { setFormError(T('required')); return }
    setFormLoading(true); setFormError('')
    try {
      await axios.post('/api/status/contact', form)
      setFormDone(true)
    } catch (err: any) {
      setFormError(err?.response?.data?.error || T('send_failed'))
    }
    setFormLoading(false)
  }

  const getStatus = (key: string) => (STATUS_META[svcStatus[key]] ? svcStatus[key] : 'operational')
  const allOk = SERVICES.every(s => getStatus(s.key) === 'operational')
  const hasOutage = SERVICES.some(s => getStatus(s.key) === 'outage')
  const overall = hasOutage ? 'outage' : !allOk ? 'degraded' : 'operational'
  const overallText = hasOutage ? T('disruption') : !allOk ? T('some') : T('all_ok')
  const OverallIcon = hasOutage ? XCircleIcon : !allOk ? ExclamationTriangleIcon : CheckCircleIcon

  // 90-day strip from the reported incidents (no invented uptime figure).
  const days = useMemo(() => {
    const byDay = new Map<string, any[]>()
    for (const inc of incidents) {
      if (!inc?.incident_date) continue
      const k = dayKey(new Date(inc.incident_date))
      byDay.set(k, [...(byDay.get(k) || []), inc])
    }
    const today = new Date()
    return Array.from({ length: 90 }, (_, i) => {
      const d = new Date(today.getTime() - (89 - i) * DAY)
      return { date: d, incidents: byDay.get(dayKey(d)) || [] }
    })
  }, [incidents])

  const ringColor = overall === 'outage' ? 'bg-danger-solid' : overall === 'degraded' ? 'bg-[#E08A3C]' : 'bg-brand-green'

  return (<>
    <Head>
      <link rel="icon" href="/brand/favicon-32.png" />
      <title>{`${T('title')} | ${name}`}</title>
    </Head>
    <MarketingPage
      active="/status"
      lang={lang}
      dir={dir}
      hero={
        <PageHero title={T('title')} className="pb-28 sm:pb-32">
          <div className="flex flex-col items-center gap-3" aria-live="polite">
            {loading ? (
              <Skeleton className="h-10 w-72 opacity-30" />
            ) : loadError ? (
              <p className="text-lg font-semibold text-deep-muted">{T('load_error')}</p>
            ) : (
              <p className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/[0.06] py-2 pe-5 ps-2 text-lg font-semibold text-deep-ink">
                <span className="relative flex h-8 w-8 items-center justify-center">
                  <span aria-hidden="true" className={cn('absolute inset-0 animate-ping rounded-full opacity-40', ringColor)} />
                  <span className={cn('relative flex h-8 w-8 items-center justify-center rounded-full text-[#04282C]', ringColor)}>
                    <OverallIcon className="h-5 w-5" aria-hidden="true" />
                  </span>
                </span>
                {overallText}
              </p>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-brand-green">
              <ShieldCheckIcon className="h-4 w-4" aria-hidden="true" />{T('uptime_badge')}
            </span>
            {checkedAt && (
              <p className="text-xs text-deep-muted">
                {T('updated')}: <time dateTime={checkedAt.toISOString()}>{fmtDateTime(checkedAt)}</time>
              </p>
            )}
          </div>
        </PageHero>
      }
    >
      <div className="relative mx-auto -mt-20 flex max-w-[860px] flex-col gap-6 px-4 pb-20 sm:px-8">
        {/* Services */}
        <Card padding="none">
          <CardHeader
            title={T('current')}
            icon={ComputerDesktopIcon}
            divider
            className="px-5 py-4 sm:px-6"
            action={!loading && !loadError && (
              <Badge tone={allOk ? 'success' : 'warning'} dot>{allOk ? T('all_operational') : T('incidents_detected')}</Badge>
            )}
          />
          {loading ? (
            <ul className="divide-y divide-line-soft" aria-busy="true">
              <li className="sr-only" role="status">{T('loading')}</li>
              {SERVICES.map(s => (
                <li key={s.key} className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-6 w-20" />
                </li>
              ))}
            </ul>
          ) : loadError ? (
            <EmptyState
              size="sm"
              icon={ExclamationTriangleIcon}
              title={T('load_error')}
              action={<Button variant="secondary" size="sm" icon={ArrowPathIcon} onClick={load}>{T('retry')}</Button>}
            />
          ) : (
            <ul className="divide-y divide-line-soft">
              {SERVICES.map(svc => {
                const meta = STATUS_META[getStatus(svc.key)]
                const Icon = svc.icon
                return (
                  <li key={svc.key} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-surface-2 sm:px-6">
                    <span className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-chip text-chip-ink" aria-hidden="true"><Icon className="h-[18px] w-[18px]" /></span>
                      <span className="text-sm font-medium text-ink">{T(`svc_${svc.key}`)}</span>
                    </span>
                    <Badge tone={meta.tone} dot>{T(`st_${getStatus(svc.key)}` as Key)}</Badge>
                  </li>
                )
              })}
            </ul>
          )}

          {/* 90-day incident strip */}
          {!loading && !loadError && (
            <div className="overflow-x-clip border-t border-line-soft px-5 py-5 sm:px-6">
              <div className="mb-3 flex items-center justify-between text-xs text-muted">
                <span>{T('history')}</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#E08A3C]" aria-hidden="true" />{T('resolved_incident')} · {T('history_legend')}</span>
              </div>
              <div dir="ltr" className="flex h-8 gap-[2px] [&>span]:min-w-0 [&>span]:flex-1">
                {days.map(d => {
                  const label = `${fmtDate(d.date)} · ${d.incidents.length ? d.incidents.map(i => i.title).join(T('list_sep')) : T('no_incident_day')}`
                  return (
                    <Tooltip key={dayKey(d.date)} content={label}>
                      <span
                        tabIndex={d.incidents.length ? 0 : -1}
                        aria-label={label}
                        className={cn('min-w-0 flex-1 rounded-[2px] transition-opacity hover:opacity-70', d.incidents.length ? 'bg-[#E08A3C]' : 'bg-brand-teal/70')}
                      />
                    </Tooltip>
                  )
                })}
              </div>
            </div>
          )}
        </Card>

        {/* Past incidents */}
        <Card padding="none" className={cn(loadError && 'hidden')}>
          <CardHeader title={T('past')} icon={ClockIcon} divider className="px-5 py-4 sm:px-6" />
          {loading ? (
            <div className="p-6"><Skeleton lines={3} /></div>
          ) : loadError ? null : incidents.length === 0 ? (
            <EmptyState size="sm" icon={CheckCircleIcon} title={T('no_incidents')} />
          ) : (
            <ul className="divide-y divide-line-soft">
              {incidents.map(inc => {
                const ist = INCIDENT_STATUS[inc.status] || INCIDENT_STATUS.resolved
                return (
                  <li key={inc.id} className="flex items-start justify-between gap-3 px-5 py-4 sm:px-6">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">{inc.title}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                        <span className="inline-flex items-center gap-1"><CalendarDaysIcon className="h-3.5 w-3.5" aria-hidden="true" />{fmtDate(inc.incident_date)}</span>
                        {inc.duration && <span className="inline-flex items-center gap-1"><ClockIcon className="h-3.5 w-3.5" aria-hidden="true" />{inc.duration}</span>}
                      </p>
                    </div>
                    <Badge tone={ist.tone} className="shrink-0">{T(`inc_${INCIDENT_STATUS[inc.status] ? inc.status : 'resolved'}` as Key)}</Badge>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        {/* Subscribe */}
        <Card variant="deep" padding="lg" className="relative overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute -end-20 -top-20 h-64 w-64 rounded-full bg-brand-green/10 blur-3xl" />
          <div className="relative flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-brand-green" aria-hidden="true"><BellAlertIcon className="h-5 w-5" /></span>
              <div>
                <h2 className="text-lg font-semibold text-deep-ink">{T('sub_title')}</h2>
                <p className="mt-1 text-sm text-deep-muted">{T('sub_desc')}</p>
              </div>
            </div>
            {subDone ? (
              <p role="status" className="inline-flex items-center gap-2 font-semibold text-brand-green">
                <CheckIcon className="h-5 w-5" aria-hidden="true" />{T('subscribed')}
              </p>
            ) : (
              <form onSubmit={subscribe} noValidate className="flex flex-col gap-3">
                <div className="w-fit rounded-btn bg-surface p-0.5">
                  <Tabs
                    variant="segmented"
                    size="sm"
                    idPrefix="status-sub"
                    aria-label={T('sub_title')}
                    value={subType}
                    onChange={v => { setSubType(v as 'email' | 'phone'); setSubError('') }}
                    tabs={[{ id: 'email', label: T('email'), icon: EnvelopeIcon }, { id: 'phone', label: T('phone'), icon: DevicePhoneMobileIcon }]}
                  />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {subType === 'email' ? (
                    <Field label={T('email')} srOnlyLabel className="flex-1">
                      <Input type="email" dir="ltr" value={subEmail} onChange={e => setSubEmail(e.target.value)} placeholder="your@email.com" autoComplete="email" />
                    </Field>
                  ) : (
                    <div className="flex flex-1 gap-2" dir="ltr">
                      <Field label={T('country')} srOnlyLabel className="w-36 shrink-0">
                        <Select value={subCountry} onChange={e => setSubCountry(e.target.value)} options={COUNTRIES.map(c => ({ value: c.code, label: `${c.code} ${c.name}` }))} />
                      </Field>
                      <Field label={T('phone')} srOnlyLabel className="flex-1">
                        <Input type="tel" inputMode="tel" value={subPhone} onChange={e => setSubPhone(e.target.value)} placeholder="501234567" autoComplete="tel-national" />
                      </Field>
                    </div>
                  )}
                  <Button type="submit" loading={subLoading} className="shrink-0">{T('subscribe')}</Button>
                </div>
                {subError && <p role="alert" className="text-sm text-[#FDA4AF]">{subError}</p>}
              </form>
            )}
          </div>
        </Card>

        {/* Contact Form */}
        <Card padding="lg">
          <CardHeader title={T('contact_title')} subtitle={T('contact_desc')} icon={EnvelopeIcon} />
          {formDone ? (
            <div role="status" className="flex flex-col items-center gap-3 py-6 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-bg text-success"><CheckCircleIcon className="h-8 w-8" aria-hidden="true" /></span>
              <p className="font-semibold text-ink">{T('sent')}</p>
            </div>
          ) : (
            <form onSubmit={sendContact} noValidate className="mt-5 flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={T('name')} required><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoComplete="name" /></Field>
                <Field label={T('email_addr')} required><Input type="email" dir="ltr" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} autoComplete="email" /></Field>
              </div>
              <Field label={T('subject')} required><Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} /></Field>
              <Field label={T('message')} required><Textarea rows={4} placeholder={T('message_ph')} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} /></Field>
              {formError && <p role="alert" className="rounded-btn bg-danger-bg px-3.5 py-2.5 text-sm text-danger">{formError}</p>}
              <Button type="submit" size="lg" loading={formLoading} icon={PaperAirplaneIcon} className="rtl:[&_svg]:-scale-x-100">
                {formLoading ? T('sending') : T('send')}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </MarketingPage>
  </>)
}
