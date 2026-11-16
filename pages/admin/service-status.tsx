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
  Badge, Button, Card, ConfirmDialog, DataTable, EmptyState, Field, Input, Modal, PageHeader, Select, Skeleton, StatCard, Tabs, cn, formatNumber,
} from '@/components/ui'
import type { Column, Tone } from '@/components/ui'
import { apiError, useAdminT } from '@/components/admin/i18n'
import { ErrorState } from '@/components/admin/shared'

type SvcStatus = 'operational' | 'degraded' | 'outage' | 'maintenance'
interface Incident { id: string; title: string; status: string; duration?: string | null; incident_date: string }
interface Subscriber { id: string; type: 'email' | 'phone' | string; value: string; created_at: string }
interface ContactMsg { id: string; name: string; email: string; subject?: string; message: string; status: string; created_at: string }

const SERVICES: { key: string; icon: React.ElementType; ar: string; en: string }[] = [
  { key: 'api', icon: ServerStackIcon, ar: 'واجهة API والمنصة الأساسية', en: 'API and core platform' },
  { key: 'whatsapp', icon: ChatBubbleLeftRightIcon, ar: 'توصيل رسائل واتساب', en: 'WhatsApp message delivery' },
  { key: 'dashboard', icon: ChartBarIcon, ar: 'لوحة التحكم وتطبيق الويب', en: 'Dashboard and web app' },
  { key: 'campaigns', icon: MegaphoneIcon, ar: 'الحملات الجماعية', en: 'Bulk campaigns' },
  { key: 'chatbot', icon: CpuChipIcon, ar: 'محرك الروبوت', en: 'Chatbot engine' },
  { key: 'auth', icon: LockClosedIcon, ar: 'المصادقة وOTP', en: 'Authentication and OTP' },
  { key: 'webhooks', icon: LinkIcon, ar: 'Webhooks والتكاملات', en: 'Webhooks and integrations' },
  { key: 'storage', icon: CircleStackIcon, ar: 'تخزين الملفات والوسائط', en: 'File storage and media' },
]
const STATUSES: SvcStatus[] = ['operational', 'degraded', 'outage', 'maintenance']
const S_TONE: Record<SvcStatus, Tone> = { operational: 'success', degraded: 'warning', outage: 'danger', maintenance: 'violet' }
const S_ICON: Record<SvcStatus, React.ElementType> = { operational: CheckCircleIcon, degraded: ExclamationTriangleIcon, outage: SignalIcon, maintenance: WrenchScrewdriverIcon }
const INC_STATUSES = ['resolved', 'investigating', 'identified', 'monitoring']
const today = () => new Date().toISOString().split('T')[0]
const EMPTY_INC = { title: '', status: 'resolved', duration: '', incident_date: today() }

export default function ServiceStatusPage() {
  const { tr, fmtDate, fmtDateTime } = useAdminT()
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

  const sLabel = (s: SvcStatus) => ({ operational: tr('يعمل', 'Operational'), degraded: tr('أداء متراجع', 'Degraded'), outage: tr('انقطاع', 'Outage'), maintenance: tr('صيانة', 'Maintenance') })[s]
  const incLabel = (s: string) => ({ resolved: tr('تم الحل', 'Resolved'), investigating: tr('قيد التحقيق', 'Investigating'), identified: tr('تم تحديد السبب', 'Identified'), monitoring: tr('قيد المراقبة', 'Monitoring') } as Record<string, string>)[s] || s

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
      toast.success(tr('نُشرت الحالة', 'Status published'))
    } catch (e) { toast.error(apiError(e, tr('تعذّر الحفظ', 'Failed to save'))) }
    setSaving(false)
  }

  const saveIncident = async () => {
    if (!incEditor) return
    if (!incEditor.title.trim()) { toast.error(tr('العنوان مطلوب', 'Title is required')); return }
    setSavingInc(true)
    try {
      if (incEditor.id) {
        await axios.put('/api/status/incidents', incEditor)
        setIncidents(list => list.map(i => (i.id === incEditor.id ? { ...i, ...incEditor } as Incident : i)))
        toast.success(tr('حُدّث الحادث', 'Incident updated'))
      } else {
        const { id: _id, ...body } = incEditor
        void _id
        const r = await axios.post('/api/status/incidents', body)
        setIncidents(i => [r.data.incident, ...i])
        toast.success(tr('أُضيف الحادث وظهر في صفحة الحالة', 'Incident added and live on /status'))
      }
      setIncEditor(null)
    } catch (e) { toast.error(apiError(e, tr('تعذّر الحفظ', 'Failed to save'))) }
    setSavingInc(false)
  }

  const deleteIncident = async () => {
    if (!toDelete) return
    setDeleting(true)
    try {
      await axios.delete('/api/status/incidents', { data: { id: toDelete.id } })
      setIncidents(i => i.filter(x => x.id !== toDelete.id))
      toast.success(tr('حُذف', 'Deleted'))
      setToDelete(null)
    } catch (e) { toast.error(apiError(e, tr('تعذّر الحذف', 'Failed to delete'))) }
    setDeleting(false)
  }

  const subCols: Column<Subscriber>[] = [
    { key: 't', header: tr('النوع', 'Type'), cell: s => <Badge tone={s.type === 'email' ? 'brand' : 'success'} icon={s.type === 'email' ? EnvelopeIcon : PhoneIcon} size="sm">{s.type === 'email' ? tr('بريد', 'Email') : tr('هاتف', 'Phone')}</Badge> },
    { key: 'v', header: tr('القيمة', 'Value'), cell: s => <span dir="ltr" className="font-mono text-xs text-ink">{s.value}</span> },
    { key: 'd', header: tr('التاريخ', 'Date'), cell: s => <span className="text-xs text-muted">{fmtDate(s.created_at)}</span> },
  ]

  return (
    <AdminLayout title={tr('حالة الخدمة', 'Service status')}>
      <PageHeader className="mb-6"
        eyebrow={tr('المراقبة', 'Monitoring')}
        title={tr('حالة الخدمة', 'Service status')}
        description={tr('تحكّم فيما يراه الزوار على صفحة الحالة العامة.', 'Control what visitors see on the public status page.')}
        actions={<Button variant="secondary" href="/status" external iconEnd={ArrowTopRightOnSquareIcon}>{tr('صفحة الحالة', 'Status page')}</Button>}
      >
        <Tabs idPrefix="status" value={tab} onChange={setTab} tabs={[
          { id: 'status', label: tr('المكوّنات', 'Components'), icon: SignalIcon },
          { id: 'incidents', label: tr('الحوادث', 'Incidents'), icon: ExclamationTriangleIcon, count: incidents.length || undefined },
          { id: 'subscribers', label: tr('المشتركون', 'Subscribers'), icon: BellAlertIcon, count: subscribers.length || undefined },
          { id: 'messages', label: tr('الرسائل', 'Messages'), icon: EnvelopeIcon, count: newMsgs || undefined },
        ]} />
      </PageHeader>

      {tab === 'status' && (error ? <ErrorState onRetry={load} /> : (
        <div className="space-y-5">
          <Card variant={worst === 'operational' ? 'gradient' : 'default'} className={cn('flex flex-wrap items-center gap-4', worst !== 'operational' && 'border-warning/30 bg-warning-bg')}>
            {loading ? <Skeleton className="h-10 w-64" /> : (() => { const Icon = S_ICON[worst]; return (
              <>
                <span className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', worst === 'operational' ? 'bg-[#04282C]/10' : 'bg-surface')}><Icon className="h-6 w-6" aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold">{worst === 'operational' ? tr('جميع الأنظمة تعمل', 'All systems operational') : tr('بعض الخدمات تحتاج انتباهًا', 'Some services need attention')}</p>
                  <p className={cn('text-sm', worst === 'operational' ? 'text-[#04282C]/75' : 'text-muted')}>{tr('الحالة المنشورة حاليًا', 'Currently published status')}</p>
                </div>
              </>
            ) })()}
          </Card>

          <Card padding="none">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
              <h2 className="section-title">{tr('صحة المكوّنات', 'Component health')}</h2>
              <Button size="sm" variant="ghost" icon={CheckCircleIcon} disabled={allOk} onClick={() => setServices(Object.fromEntries(SERVICES.map(s => [s.key, 'operational'])) as Record<string, SvcStatus>)}>
                {tr('الكل يعمل', 'All operational')}
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
                        <span className="font-medium text-ink">{tr(svc.ar, svc.en)}</span>
                        {changed && <Badge tone="warning" size="sm">{tr('غير منشور', 'Unpublished')}</Badge>}
                      </div>
                      <div role="radiogroup" aria-label={tr(svc.ar, svc.en)} className="flex flex-wrap gap-1.5">
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
              {dirty && <Button variant="ghost" onClick={() => setServices(published)}>{tr('تراجع', 'Discard')}</Button>}
              <Button loading={saving} disabled={!dirty} onClick={saveServices}>{tr('حفظ ونشر', 'Save and publish')}</Button>
            </div>
          </Card>
        </div>
      ))}

      {tab === 'incidents' && (
        <Card padding="none">
          <div className="flex items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
            <h2 className="section-title">{tr('سجل الحوادث', 'Incident history')}</h2>
            <Button size="sm" icon={PlusIcon} onClick={() => setIncEditor({ ...EMPTY_INC, incident_date: today() })}>{tr('حادث جديد', 'New incident')}</Button>
          </div>
          {incidents.length === 0 ? (
            <EmptyState size="sm" icon={CloudIcon} title={tr('لا توجد حوادث مسجّلة', 'No incidents recorded')} description={tr('سجّل الحوادث ليطّلع عليها العملاء في صفحة الحالة.', 'Record incidents so customers can see them on the status page.')}
              action={<Button size="sm" variant="secondary" icon={PlusIcon} onClick={() => setIncEditor({ ...EMPTY_INC, incident_date: today() })}>{tr('حادث جديد', 'New incident')}</Button>} />
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
                      <Button size="xs" variant="ghost" icon={PencilSquareIcon} onClick={() => setIncEditor({ id: inc.id, title: inc.title, status: inc.status, duration: inc.duration || '', incident_date: inc.incident_date })}>{tr('تعديل', 'Edit')}</Button>
                      <Button size="xs" variant="ghost" icon={TrashIcon} className="text-danger" onClick={() => setToDelete(inc)}>{tr('حذف', 'Delete')}</Button>
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
            <StatCard icon={BellAlertIcon} label={tr('الإجمالي', 'Total')} value={formatNumber(subscribers.length)} />
            <StatCard icon={EnvelopeIcon} label={tr('بريد', 'Email')} value={formatNumber(subscribers.filter(s => s.type === 'email').length)} />
            <StatCard icon={PhoneIcon} label={tr('هاتف', 'Phone')} value={formatNumber(subscribers.filter(s => s.type === 'phone').length)} />
          </div>
          <Card padding="none">
            <DataTable rows={subscribers} rowKey={s => s.id} columns={subCols} minWidth={420} caption={tr('مشتركو التنبيهات', 'Status subscribers')}
              empty={<EmptyState size="sm" icon={BellAlertIcon} title={tr('لا يوجد مشتركون بعد', 'No subscribers yet')} />} />
          </Card>
        </div>
      )}

      {tab === 'messages' && (
        <Card padding="none">
          {contactMessages.length === 0 ? (
            <EmptyState size="sm" icon={EnvelopeIcon} title={tr('لا توجد رسائل', 'No messages yet')} />
          ) : (
            <ul className="divide-y divide-line-soft">
              {contactMessages.map(m => (
                <li key={m.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0"><span className="font-semibold text-ink">{m.name}</span> <span dir="ltr" className="text-xs text-muted">{m.email}</span></div>
                    <Badge tone={m.status === 'new' ? 'danger' : 'success'} size="sm" dot={m.status === 'new'}>{m.status === 'new' ? tr('جديدة', 'New') : m.status}</Badge>
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
        title={incEditor?.id ? tr('تعديل الحادث', 'Edit incident') : tr('حادث جديد', 'New incident')}
        description={tr('يظهر في صفحة الحالة العامة فور الحفظ.', 'Shows on the public status page as soon as you save.')}
        footer={<><Button variant="secondary" onClick={() => setIncEditor(null)}>{tr('إلغاء', 'Cancel')}</Button><Button loading={savingInc} disabled={!incEditor?.title.trim()} onClick={saveIncident}>{tr('حفظ', 'Save')}</Button></>}>
        {incEditor && (
          <div className="space-y-4">
            <Field label={tr('العنوان', 'Title')} required>
              <Input value={incEditor.title} onChange={e => setIncEditor(i => i && ({ ...i, title: e.target.value }))} placeholder={tr('مثال: بطء في واجهة واتساب', 'e.g. Increased latency on WhatsApp API')} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={tr('الحالة', 'Status')}>
                <Select value={incEditor.status} onChange={e => setIncEditor(i => i && ({ ...i, status: e.target.value }))} options={INC_STATUSES.map(s => ({ value: s, label: incLabel(s) }))} />
              </Field>
              <Field label={tr('المدة', 'Duration')}><Input value={incEditor.duration} onChange={e => setIncEditor(i => i && ({ ...i, duration: e.target.value }))} placeholder={tr('45 دقيقة', '45 min')} /></Field>
              <Field label={tr('التاريخ', 'Date')}><Input type="date" dir="ltr" value={incEditor.incident_date} onChange={e => setIncEditor(i => i && ({ ...i, incident_date: e.target.value }))} /></Field>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!toDelete} destructive onClose={() => setToDelete(null)} loading={deleting} onConfirm={deleteIncident}
        title={tr('حذف هذا الحادث؟', 'Delete this incident?')} description={toDelete?.title} confirmLabel={tr('حذف', 'Delete')} />
    </AdminLayout>
  )
}
