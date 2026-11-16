import React, { useEffect, useMemo, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  ArrowTopRightOnSquareIcon, BellAlertIcon, ChartBarIcon, ChatBubbleLeftRightIcon, CheckCircleIcon, CircleStackIcon, CloudIcon, CpuChipIcon,
  EnvelopeIcon, ExclamationTriangleIcon, LinkIcon, LockClosedIcon, MegaphoneIcon, PencilSquareIcon, PhoneIcon, PlusIcon, ServerStackIcon,
  SignalIcon, TrashIcon, WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline'
import {
  Badge, Button, Card, ConfirmDialog, DataTable, EmptyState, Field, Input, Modal, PageHeader, Select, Skeleton, StatCard, Tabs, cn,
} from '@/components/ui'
import type { Column, Tone } from '@/components/ui'
import { useApiError, useAdminT, useEnumLabel } from '@/components/admin/i18n'
import { ErrorState } from '@/components/admin/shared'
import messages from '@/locales/admin/service-status'

type SvcStatus = 'operational' | 'degraded' | 'outage' | 'maintenance'
interface Incident { id: string; title: string; status: string; duration?: string | null; incident_date: string }
interface Subscriber { id: string; type: 'email' | 'phone' | string; value: string; created_at: string }
interface ContactMsg { id: string; name: string; email: string; subject?: string; message: string; status: string; created_at: string }

const SERVICES: { key: string; icon: React.ElementType; label: keyof typeof messages.en }[] = [
  { key: 'api', icon: ServerStackIcon, label: 'svcApi' },
  { key: 'whatsapp', icon: ChatBubbleLeftRightIcon, label: 'svcWhatsapp' },
  { key: 'dashboard', icon: ChartBarIcon, label: 'svcDashboard' },
  { key: 'campaigns', icon: MegaphoneIcon, label: 'svcCampaigns' },
  { key: 'chatbot', icon: CpuChipIcon, label: 'svcChatbot' },
  { key: 'auth', icon: LockClosedIcon, label: 'svcAuth' },
  { key: 'webhooks', icon: LinkIcon, label: 'svcWebhooks' },
  { key: 'storage', icon: CircleStackIcon, label: 'svcStorage' },
]
const STATUSES: SvcStatus[] = ['operational', 'degraded', 'outage', 'maintenance']
const S_TONE: Record<SvcStatus, Tone> = { operational: 'success', degraded: 'warning', outage: 'danger', maintenance: 'violet' }
const S_ICON: Record<SvcStatus, React.ElementType> = { operational: CheckCircleIcon, degraded: ExclamationTriangleIcon, outage: SignalIcon, maintenance: WrenchScrewdriverIcon }
const INC_STATUSES = ['resolved', 'investigating', 'identified', 'monitoring']
const today = () => new Date().toISOString().split('T')[0]
const EMPTY_INC = { title: '', status: 'resolved', duration: '', incident_date: today() }

export default function ServiceStatusPage() {
  const { t, fmtDate, fmtDateTime, fmtNumber } = useAdminT(messages)
  const apiError = useApiError()
  const label = useEnumLabel()
  const [tab, setTab] = useState('status')
  const [services, setServices] = useState<Record<string, SvcStatus>>({})
  const [published, setPublished] = useState<Record<string, SvcStatus>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [contactMessages, setContactMessages] = useState<ContactMsg[]>([])
  const [incEditor, setIncEditor] = useState<null | { id?: string; title: string; status: string; duration: string; incident_date: string }>(null)
  const [savingInc, setSavingInc] = useState(false)
  const [toDelete, setToDelete] = useState<Incident | null>(null)
  const [deleting, setDeleting] = useState(false)

  const sLabel = (s: SvcStatus) => ({ operational: t('operational'), degraded: t('degraded'), outage: t('outage'), maintenance: t('maintenance') })[s]
  const incLabel = (s: string) => ({ resolved: t('resolved'), investigating: t('investigating'), identified: t('identified'), monitoring: t('monitoringAlt') } as Record<string, string>)[s] || s

  const load = () => {
    setLoading(true); setError(false)
    axios.get('/api/admin/service-status').then(r => {
      const data = r.data.services || {}
      const map: Record<string, SvcStatus> = {}
      SERVICES.forEach(s => { map[s.key] = data[s.key] || 'operational' })
      setServices(map); setPublished(map)
    }).catch(() => setError(true)).finally(() => setLoading(false))
    axios.get('/api/status/incidents').then(r => setIncidents(r.data.incidents || [])).catch(() => {})
    axios.get('/api/admin/status-subscribers').then(r => setSubscribers(r.data.subscribers || [])).catch(() => {})
    axios.get('/api/status/contact').then(r => setContactMessages(r.data.messages || [])).catch(() => {})
  }
  useEffect(load, [])

  const dirty = JSON.stringify(services) !== JSON.stringify(published)
  const allOk = SERVICES.every(s => (services[s.key] || 'operational') === 'operational')
  const worst = useMemo<SvcStatus>(() => (['outage', 'degraded', 'maintenance'] as SvcStatus[]).find(s => Object.values(published).includes(s)) || 'operational', [published])
  const newMsgs = contactMessages.filter(m => m.status === 'new').length

  const saveServices = async () => {
    setSaving(true)
    try {
      await axios.post('/api/admin/service-status', { services })
      setPublished(services)
      toast.success(t('statusPublished'))
    } catch (e) { toast.error(apiError(e, t('failedSave'))) }
    setSaving(false)
  }

  const saveIncident = async () => {
    if (!incEditor) return
    if (!incEditor.title.trim()) { toast.error(t('titleRequired')); return }
    setSavingInc(true)
    try {
      if (incEditor.id) {
        await axios.put('/api/status/incidents', incEditor)
        setIncidents(list => list.map(i => (i.id === incEditor.id ? { ...i, ...incEditor } as Incident : i)))
        toast.success(t('incidentUpdated'))
      } else {
        const { id: _id, ...body } = incEditor
        void _id
        const r = await axios.post('/api/status/incidents', body)
        setIncidents(i => [r.data.incident, ...i])
        toast.success(t('incidentAddedLiveStatus'))
      }
      setIncEditor(null)
    } catch (e) { toast.error(apiError(e, t('failedSave'))) }
    setSavingInc(false)
  }

  const deleteIncident = async () => {
    if (!toDelete) return
    setDeleting(true)
    try {
      await axios.delete('/api/status/incidents', { data: { id: toDelete.id } })
      setIncidents(i => i.filter(x => x.id !== toDelete.id))
      toast.success(t('deleted'))
      setToDelete(null)
    } catch (e) { toast.error(apiError(e, t('failedDelete'))) }
    setDeleting(false)
  }

  const subCols: Column<Subscriber>[] = [
    { key: 't', header: t('type'), cell: s => <Badge tone={s.type === 'email' ? 'brand' : 'success'} icon={s.type === 'email' ? EnvelopeIcon : PhoneIcon} size="sm">{s.type === 'email' ? t('email') : t('phone')}</Badge> },
    { key: 'v', header: t('value'), cell: s => <span dir="ltr" className="font-mono text-xs text-ink">{s.value}</span> },
    { key: 'd', header: t('date'), cell: s => <span className="text-xs text-muted">{fmtDate(s.created_at)}</span> },
  ]

  return (
    <AdminLayout title={t('serviceStatus')}>
      <PageHeader className="mb-6"
        eyebrow={t('monitoring')}
        title={t('serviceStatus')}
        description={t('controlWhatVisitorsSee')}
        actions={<Button variant="secondary" href="/status" external iconEnd={ArrowTopRightOnSquareIcon}>{t('statusPage')}</Button>}
      >
        <Tabs idPrefix="status" value={tab} onChange={setTab} tabs={[
          { id: 'status', label: t('components'), icon: SignalIcon },
          { id: 'incidents', label: t('incidents'), icon: ExclamationTriangleIcon, count: incidents.length || undefined },
          { id: 'subscribers', label: t('subscribers'), icon: BellAlertIcon, count: subscribers.length || undefined },
          { id: 'messages', label: t('messages'), icon: EnvelopeIcon, count: newMsgs || undefined },
        ]} />
      </PageHeader>

      {tab === 'status' && (error ? <ErrorState onRetry={load} /> : (
        <div className="space-y-5">
          <Card variant={worst === 'operational' ? 'gradient' : 'default'} className={cn('flex flex-wrap items-center gap-4', worst !== 'operational' && 'border-warning/30 bg-warning-bg')}>
            {loading ? <Skeleton className="h-10 w-64" /> : (() => { const Icon = S_ICON[worst]; return (
              <>
                <span className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', worst === 'operational' ? 'bg-[#04282C]/10' : 'bg-surface')}><Icon className="h-6 w-6" aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold">{worst === 'operational' ? t('allSystemsOperational') : t('someServicesNeedAttention')}</p>
                  <p className={cn('text-sm', worst === 'operational' ? 'text-[#04282C]/75' : 'text-muted')}>{t('currentlyPublishedStatus')}</p>
                </div>
              </>
            ) })()}
          </Card>

          <Card padding="none">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
              <h2 className="section-title">{t('componentHealth')}</h2>
              <Button size="sm" variant="ghost" icon={CheckCircleIcon} disabled={allOk} onClick={() => setServices(Object.fromEntries(SERVICES.map(s => [s.key, 'operational'])) as Record<string, SvcStatus>)}>
                {t('allOperational')}
              </Button>
            </div>
            {loading ? <div className="space-y-2 p-5">{SERVICES.map(s => <Skeleton key={s.key} className="h-12" />)}</div> : (
              <ul className="divide-y divide-line-soft">
                {SERVICES.map(svc => {
                  const st = services[svc.key] || 'operational'
                  const changed = st !== published[svc.key]
                  return (
                    <li key={svc.key} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-chip text-brand-ink"><svc.icon className="h-4 w-4" aria-hidden="true" /></span>
                        <span className="font-medium text-ink">{t(svc.label)}</span>
                        {changed && <Badge tone="warning" size="sm">{t('unpublished')}</Badge>}
                      </div>
                      <div role="radiogroup" aria-label={t(svc.label)} className="flex flex-wrap gap-1.5">
                        {STATUSES.map(val => {
                          const on = st === val
                          const Icon = S_ICON[val]
                          return (
                            <button key={val} type="button" role="radio" aria-checked={on} onClick={() => setServices(s => ({ ...s, [svc.key]: val }))}
                              className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                                on ? cn('border-transparent shadow-card', { success: 'bg-success-bg text-success', warning: 'bg-warning-bg text-warning', danger: 'bg-danger-bg text-danger', violet: 'bg-violet-bg text-violet' }[S_TONE[val] as 'success'])
                                  : 'border-line text-muted hover:border-line-strong hover:text-ink')}>
                              <Icon className="h-3.5 w-3.5" aria-hidden="true" />{sLabel(val)}
                            </button>
                          )
                        })}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line-soft px-5 py-4">
              {dirty && <Button variant="ghost" onClick={() => setServices(published)}>{t('discard')}</Button>}
              <Button loading={saving} disabled={!dirty} onClick={saveServices}>{t('savePublish')}</Button>
            </div>
          </Card>
        </div>
      ))}

      {tab === 'incidents' && (
        <Card padding="none">
          <div className="flex items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
            <h2 className="section-title">{t('incidentHistory')}</h2>
            <Button size="sm" icon={PlusIcon} onClick={() => setIncEditor({ ...EMPTY_INC, incident_date: today() })}>{t('newIncident')}</Button>
          </div>
          {incidents.length === 0 ? (
            <EmptyState size="sm" icon={CloudIcon} title={t('noIncidentsRecorded')} description={t('recordIncidentsSoCustomers')}
              action={<Button size="sm" variant="secondary" icon={PlusIcon} onClick={() => setIncEditor({ ...EMPTY_INC, incident_date: today() })}>{t('newIncident')}</Button>} />
          ) : (
            <ol className="relative space-y-0 px-5 py-4">
              {incidents.map((inc, idx) => (
                <li key={inc.id} className="relative flex gap-4 pb-5 ps-1 last:pb-0">
                  {idx < incidents.length - 1 && <span aria-hidden="true" className="absolute bottom-0 start-[17px] top-8 w-px bg-line" />}
                  <span className={cn('relative z-[1] mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full', inc.status === 'resolved' ? 'bg-success-bg text-success' : 'bg-warning-bg text-warning')}>
                    {inc.status === 'resolved' ? <CheckCircleIcon className="h-4 w-4" aria-hidden="true" /> : <ExclamationTriangleIcon className="h-4 w-4" aria-hidden="true" />}
                  </span>
                  <div className="min-w-0 flex-1 rounded-xl border border-line-soft bg-surface-2 px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-medium text-ink">{inc.title}</p>
                      <Badge tone={inc.status === 'resolved' ? 'success' : 'warning'} size="sm">{incLabel(inc.status)}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">{fmtDate(inc.incident_date)}{inc.duration ? ` · ${inc.duration}` : ''}</p>
                    <div className="mt-2 flex gap-1">
                      <Button size="xs" variant="ghost" icon={PencilSquareIcon} onClick={() => setIncEditor({ id: inc.id, title: inc.title, status: inc.status, duration: inc.duration || '', incident_date: inc.incident_date })}>{t('edit')}</Button>
                      <Button size="xs" variant="ghost" icon={TrashIcon} className="text-danger" onClick={() => setToDelete(inc)}>{t('delete')}</Button>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      )}

      {tab === 'subscribers' && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3.5">
            <StatCard icon={BellAlertIcon} label={t('total')} value={fmtNumber(subscribers.length)} />
            <StatCard icon={EnvelopeIcon} label={t('email')} value={fmtNumber(subscribers.filter(s => s.type === 'email').length)} />
            <StatCard icon={PhoneIcon} label={t('phone')} value={fmtNumber(subscribers.filter(s => s.type === 'phone').length)} />
          </div>
          <Card padding="none">
            <DataTable rows={subscribers} rowKey={s => s.id} columns={subCols} minWidth={420} caption={t('statusSubscribers')}
              empty={<EmptyState size="sm" icon={BellAlertIcon} title={t('noSubscribersYet')} />} />
          </Card>
        </div>
      )}

      {tab === 'messages' && (
        <Card padding="none">
          {contactMessages.length === 0 ? (
            <EmptyState size="sm" icon={EnvelopeIcon} title={t('noMessagesYet')} />
          ) : (
            <ul className="divide-y divide-line-soft">
              {contactMessages.map(m => (
                <li key={m.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0"><span className="font-semibold text-ink">{m.name}</span> <span dir="ltr" className="text-xs text-muted">{m.email}</span></div>
                    <Badge tone={m.status === 'new' ? 'danger' : 'success'} size="sm" dot={m.status === 'new'}>{m.status === 'new' ? t('new') : label('contact', m.status)}</Badge>
                  </div>
                  {m.subject && <p className="mt-1 text-sm font-medium text-body">{m.subject}</p>}
                  <p dir="auto" className="mt-1 whitespace-pre-wrap text-sm text-muted">{m.message}</p>
                  <p className="mt-2 text-2xs text-muted">{fmtDateTime(m.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Modal open={!!incEditor} onClose={() => setIncEditor(null)} icon={ExclamationTriangleIcon}
        title={incEditor?.id ? t('editIncident') : t('newIncident')}
        description={t('showsPublicStatusPage')}
        footer={<><Button variant="secondary" onClick={() => setIncEditor(null)}>{t('cancel')}</Button><Button loading={savingInc} disabled={!incEditor?.title.trim()} onClick={saveIncident}>{t('save')}</Button></>}>
        {incEditor && (
          <div className="space-y-4">
            <Field label={t('title')} required>
              <Input value={incEditor.title} onChange={e => setIncEditor(i => i && ({ ...i, title: e.target.value }))} placeholder={t('eGIncreasedLatency')} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t('status')}>
                <Select value={incEditor.status} onChange={e => setIncEditor(i => i && ({ ...i, status: e.target.value }))} options={INC_STATUSES.map(s => ({ value: s, label: incLabel(s) }))} />
              </Field>
              <Field label={t('duration')}><Input value={incEditor.duration} onChange={e => setIncEditor(i => i && ({ ...i, duration: e.target.value }))} placeholder={t('n45Min')} /></Field>
              <Field label={t('date')}><Input type="date" dir="ltr" value={incEditor.incident_date} onChange={e => setIncEditor(i => i && ({ ...i, incident_date: e.target.value }))} /></Field>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog cancelLabel={t('cancel')} open={!!toDelete} destructive onClose={() => setToDelete(null)} loading={deleting} onConfirm={deleteIncident}
        title={t('deleteIncident')} description={toDelete?.title} confirmLabel={t('delete')} />
    </AdminLayout>
  )
}
