// Outgoing webhooks: list, create (secret shown once), test, rotate secret, delete.
import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  PlusIcon, TrashIcon, BoltIcon, KeyIcon, BeakerIcon, LinkIcon, ExclamationTriangleIcon,
  CheckCircleIcon, XCircleIcon, ClockIcon, EllipsisHorizontalIcon, LockClosedIcon, ShieldExclamationIcon,
} from '@heroicons/react/24/outline'
import {
  Badge, Button, Card, CardHeader, Checkbox, ConfirmDialog, Dropdown, EmptyState, Field, Input, Modal, Skeleton, cn,
} from '@/components/ui'
import { CopyButton, CopyField, ErrorState, Notice } from '@/components/settings/Shared'
import { fmtRelative } from '@/components/settings/format'
import { fmtNum, friendlyError, isMemberForbidden, useTeamRole, MEMBER_FORBIDDEN_MSG } from '@/components/campaigns/shared'
import { EVENTS, eventMeta } from './events'

interface Hook {
  id: string
  target_url: string
  event: string
  label?: string | null
  is_active: boolean
  last_triggered_at?: string | null
  trigger_count?: number | null
  created_at: string
  last_status?: number | null
  last_error?: string | null
}

interface RevealedSecret { event: string; label?: string; secret: string; rotated?: boolean }
interface TestResult { ok: boolean; status?: number; error?: string; at: number }

export function WebhooksPanel() {
  const qc = useQueryClient()
  const { canWrite, roleLabel } = useTeamRole()
  const canManage = canWrite('integrations')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ target_url: '', events: ['message_received'] as string[], label: '' })
  const [creating, setCreating] = useState(false)
  const [secrets, setSecrets] = useState<RevealedSecret[]>([])
  const [unsigned, setUnsigned] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [tests, setTests] = useState<Record<string, TestResult>>({})
  const [toRotate, setToRotate] = useState<Hook | null>(null)
  const [toDelete, setToDelete] = useState<Hook | null>(null)

  const { data, isLoading, isError, error, refetch } = useQuery('zapier-hooks', () => axios.get('/api/webhooks/zapier').then(r => r.data))
  const hooks: Hook[] = data?.hooks || []
  // Only events the server supports (it returns its list next to the hooks)
  const events = Array.isArray(data?.events) ? EVENTS.filter(e => data.events.includes(e.value)) : EVENTS

  const urlValid = /^https:\/\/[^\s/$.?#].[^\s]*$/i.test(form.target_url.trim())

  // One subscription per selected event (the API subscribes a URL to one event)
  const create = async () => {
    setCreating(true)
    const got: RevealedSecret[] = []
    const failed: string[] = []
    let firstError: unknown = null
    let noSecret = false
    for (const ev of form.events) {
      try {
        const r = await axios.post('/api/webhooks/zapier', { target_url: form.target_url.trim(), event: ev, label: form.label })
        if (r?.data?.secret) got.push({ event: ev, label: form.label, secret: r.data.secret })
        else noSecret = true
      } catch (e) {
        failed.push(ev)
        firstError = firstError || e
      }
    }
    setCreating(false)
    qc.invalidateQueries('zapier-hooks')
    if (got.length || noSecret) {
      setSecrets(got)
      setUnsigned(noSecret && !got.length)
      setSaved(false)
      setShowForm(false)
      setForm({ target_url: '', events: ['message_received'], label: '' })
      toast.success(form.events.length - failed.length > 1 ? `أُنشئت ${fmtNum(form.events.length - failed.length)} اشتراكات` : 'أُنشئ الـ Webhook')
    }
    if (failed.length) {
      toast.error(`${friendlyError(firstError, 'تعذّر إنشاء الـ Webhook')}${failed.length < form.events.length ? ` (${failed.map(f => eventMeta(f)?.label || f).join('، ')})` : ''}`)
    }
  }

  const deleteMut = useMutation(
    (id: string) => axios.delete(`/api/webhooks/zapier?id=${id}`),
    {
      onSuccess: () => { qc.invalidateQueries('zapier-hooks'); setToDelete(null); toast.success('حُذف الـ Webhook') },
      onError: (e: any) => { toast.error(friendlyError(e, 'تعذّر الحذف')) },
    }
  )

  // Signed test delivery from the server (same headers as real events)
  const testWebhook = async (hook: Hook) => {
    setTestingId(hook.id)
    try {
      const r = await axios.post('/api/webhooks/zapier', { action: 'test', id: hook.id })
      setTests(t => ({ ...t, [hook.id]: { ok: true, status: r.data?.status, at: Date.now() } }))
      toast.success(`وصلت الحمولة التجريبية${r.data?.status ? ` (HTTP ${r.data.status})` : ''}`)
    } catch (e: any) {
      const d = e?.response?.data
      setTests(t => ({ ...t, [hook.id]: { ok: false, status: d?.status, error: friendlyError(e, 'تعذّر الوصول إلى الرابط'), at: Date.now() } }))
      toast.error(friendlyError(e, 'تعذّر الوصول إلى رابط الـ Webhook'))
    }
    setTestingId(null)
  }

  const rotateMut = useMutation(
    (hook: Hook) => axios.post('/api/webhooks/zapier', { action: 'rotate_secret', id: hook.id }),
    {
      onSuccess: (r: any, hook) => {
        setSecrets([{ event: hook.event, label: hook.label || undefined, secret: r.data.secret, rotated: true }])
        setUnsigned(false)
        setSaved(false)
        setToRotate(null)
        toast.success('وُلّد مفتاح توقيع جديد')
      },
      onError: (e: any) => { toast.error(friendlyError(e, 'تعذّر توليد مفتاح جديد')) },
    }
  )

  const toggleEvent = (v: string) => setForm(f => ({ ...f, events: f.events.includes(v) ? f.events.filter(x => x !== v) : [...f.events, v] }))

  return (
    <div className="space-y-4">
      {/* Secret shown once */}
      {secrets.length > 0 && (
        <Card className="border-warning/30">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-bg text-warning">
              <ShieldExclamationIcon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="font-semibold text-ink">{secrets[0].rotated ? 'مفتاح التوقيع الجديد' : secrets.length > 1 ? 'مفاتيح التوقيع' : 'مفتاح التوقيع'}: انسخه الآن</p>
                <p className="mt-0.5 text-sm text-muted">
                  يظهر مرة واحدة فقط ولا يمكن عرضه لاحقًا{secrets[0].rotated ? '، وقد توقف المفتاح السابق عن العمل فورًا' : ''}. احفظه في متغير بيئة مثل
                  <code dir="ltr" className="mx-1 font-mono text-[12.5px]">WABEK_WEBHOOK_SECRET</code>على خادمك.
                </p>
              </div>
              <div className="space-y-2">
                {secrets.map(s => (
                  <div key={s.secret} className="space-y-1">
                    {secrets.length > 1 && <p className="text-xs font-medium text-muted">{eventMeta(s.event)?.label || s.event} <code dir="ltr" className="font-mono">({s.event})</code></p>}
                    <CopyField value={s.secret} />
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Checkbox label="حفظتُ المفتاح في مكان آمن" checked={saved} onChange={e => setSaved(e.target.checked)} />
                <Button size="sm" variant="secondary" disabled={!saved} onClick={() => setSecrets([])}>تم</Button>
              </div>
            </div>
          </div>
        </Card>
      )}
      {unsigned && (
        <Notice tone="warning" title="أُنشئ الـ Webhook دون توقيع" action={<Button size="sm" variant="ghost" icon={XCircleIcon} onClick={() => setUnsigned(false)} aria-label="إخفاء" />}>
          قاعدة البيانات لم تُحدَّث بعد لدعم مفاتيح التوقيع؛ ستُرسل الأحداث غير موقّعة حتى يُطبَّق التحديث، ثم ولّد مفتاحًا من زر «مفتاح جديد».
        </Notice>
      )}

      <Card padding="none">
        <CardHeader className="px-5 pt-5 sm:px-6" icon={BoltIcon} title="Webhooks الصادرة"
          subtitle="طلب POST موقّع إلى رابطك فور وقوع الحدث"
          action={canManage && hooks.length > 0 ? <Button size="sm" icon={PlusIcon} onClick={() => setShowForm(true)}>Webhook جديد</Button> : undefined} />

        {!canManage && (
          <div className="px-5 pt-4 sm:px-6">
            <Notice tone="info" icon={LockClosedIcon}>صلاحيتك في الفريق ({roleLabel}) تتيح عرض الـ Webhooks فقط؛ الإنشاء والاختبار والحذف للمالك ومسؤولي الفريق.</Notice>
          </div>
        )}

        <div className="mt-4 border-t border-line-soft">
          {isLoading ? (
            <div className="space-y-3 p-5 sm:p-6">{[0, 1].map(i => <Skeleton key={i} className="h-20 w-full rounded-card" />)}</div>
          ) : isError ? (
            <ErrorState className="m-5"
              title={isMemberForbidden(error) ? 'لا يمكنك عرض الـ Webhooks' : 'تعذّر تحميل الـ Webhooks'}
              message={isMemberForbidden(error) ? MEMBER_FORBIDDEN_MSG : friendlyError(error)} onRetry={() => refetch()} />
          ) : hooks.length === 0 ? (
            <EmptyState size="sm" icon={BoltIcon} title="لا توجد Webhooks بعد"
              description="أضف رابطًا لتصلك الأحداث لحظيًا: رسالة واردة، تغيّر حالة رسالة، اكتمال حملة وغيرها."
              action={canManage ? <Button size="sm" icon={PlusIcon} onClick={() => setShowForm(true)}>إضافة Webhook</Button> : undefined} />
          ) : (
            <ul className="divide-y divide-line-soft">
              {hooks.map(hook => {
                const ev = eventMeta(hook.event)
                const Icon = ev?.icon || BoltIcon
                const test = tests[hook.id]
                const failing = !!hook.last_error
                const okStatus = typeof hook.last_status === 'number' && hook.last_status >= 200 && hook.last_status < 300
                return (
                  <li key={hook.id} className="flex flex-col gap-3 px-5 py-4 sm:px-6 md:flex-row md:items-center">
                    <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', failing ? 'bg-danger-bg text-danger' : 'bg-chip text-brand-ink')}>
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-ink">{ev?.label || hook.event}</span>
                        <code dir="ltr" className="font-mono text-[11.5px] text-muted">{hook.event}</code>
                        {hook.label && <Badge size="sm" tone="neutral">{hook.label}</Badge>}
                        <Badge size="sm" tone={hook.is_active ? 'success' : 'neutral'} dot>{hook.is_active ? 'مفعّل' : 'متوقف'}</Badge>
                      </div>
                      <div className="flex min-w-0 items-center gap-1">
                        <LinkIcon className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
                        <code dir="ltr" className="min-w-0 truncate text-start font-mono text-xs text-body">{hook.target_url}</code>
                        <CopyButton text={hook.target_url} label="نسخ الرابط" />
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                        <span className="flex items-center gap-1"><CheckCircleIcon className="h-3.5 w-3.5 text-success" aria-hidden="true" /><span className="tabular">{fmtNum(hook.trigger_count || 0)}</span> تسليم ناجح</span>
                        <span className="flex items-center gap-1"><ClockIcon className="h-3.5 w-3.5" aria-hidden="true" />آخر تسليم ناجح: {hook.last_triggered_at ? fmtRelative(hook.last_triggered_at) : 'لم يحدث بعد'}</span>
                        {typeof hook.last_status === 'number' && (
                          <span className={cn('flex items-center gap-1', okStatus ? 'text-success' : 'text-danger')}>آخر رد: <code dir="ltr" className="font-mono">HTTP {hook.last_status}</code></span>
                        )}
                      </div>
                      {failing && (
                        <p className="flex items-start gap-1.5 rounded-lg bg-danger-bg px-2.5 py-1.5 text-xs text-danger">
                          <ExclamationTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>فشل آخر تسليم: {friendlyError({ response: { data: { error: hook.last_error } } })} يُعاد الإرسال تلقائيًا بفواصل متزايدة حتى 6 محاولات.</span>
                        </p>
                      )}
                      {test && (
                        <p role="status" className={cn('text-xs', test.ok ? 'text-success' : 'text-danger')}>
                          {test.ok ? `نجح الاختبار${test.status ? ` (HTTP ${test.status})` : ''}` : `فشل الاختبار: ${test.error}`}
                        </p>
                      )}
                    </div>
                    {canManage && (
                      <div className="flex shrink-0 items-center gap-2">
                        <Button size="sm" variant="secondary" icon={BeakerIcon} loading={testingId === hook.id} onClick={() => testWebhook(hook)}>اختبار</Button>
                        <Dropdown label="خيارات الـ Webhook" align="end"
                          trigger={<span className="flex h-9 w-9 items-center justify-center rounded-btn border border-line text-muted transition hover:text-ink"><EllipsisHorizontalIcon className="h-5 w-5" aria-hidden="true" /></span>}
                          items={[
                            { label: 'مفتاح توقيع جديد', icon: KeyIcon, onClick: () => setToRotate(hook) },
                            { label: 'حذف', icon: TrashIcon, danger: true, divider: true, onClick: () => setToDelete(hook) },
                          ]} />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </Card>

      {/* Create */}
      <Modal open={showForm} onClose={() => !creating && setShowForm(false)} size="lg" icon={BoltIcon}
        title="Webhook جديد" description="رابط HTTPS عام يستقبل طلبات POST من WABEK."
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)} disabled={creating}>إلغاء</Button>
            <Button icon={PlusIcon} loading={creating} disabled={!urlValid || form.events.length === 0} onClick={create}>
              {form.events.length > 1 ? `إنشاء ${fmtNum(form.events.length)} اشتراكات` : 'إنشاء الـ Webhook'}
            </Button>
          </>
        }>
        <div className="space-y-5">
          <Field label="رابط الاستقبال" required hint="https فقط، وإلى عنوان عام (لا عناوين داخلية)."
            error={form.target_url && !urlValid ? 'أدخل رابطًا يبدأ بـ https://' : undefined}>
            <Input dir="ltr" icon={LinkIcon} value={form.target_url} onChange={e => setForm(f => ({ ...f, target_url: e.target.value }))}
              placeholder="https://hooks.zapier.com/hooks/catch/..." />
          </Field>
          <fieldset>
            <legend className="mb-1 text-sm font-medium text-ink">الأحداث</legend>
            <p className="mb-3 text-xs text-muted">يُنشأ اشتراك مستقل لكل حدث تختاره، بمفتاح توقيع خاص به.</p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {events.map(ev => (
                <div key={ev.value} className={cn('rounded-card border p-3 transition', form.events.includes(ev.value) ? 'border-brand-teal bg-chip/40' : 'border-line')}>
                  <Checkbox checked={form.events.includes(ev.value)} onChange={() => toggleEvent(ev.value)}
                    label={<span className="flex flex-wrap items-center gap-1.5">{ev.label}<code dir="ltr" className="font-mono text-[11px] font-normal text-muted">{ev.value}</code></span>}
                    description={ev.desc} />
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Button size="xs" variant="ghost" onClick={() => setForm(f => ({ ...f, events: events.map(e => e.value) }))}>تحديد الكل</Button>
              <Button size="xs" variant="ghost" onClick={() => setForm(f => ({ ...f, events: [] }))}>إلغاء التحديد</Button>
            </div>
          </fieldset>
          <Field label="وصف (اختياري)" hint="يساعدك على تمييز الرابط، مثل: إشعار نظام CRM">
            <Input value={form.label} maxLength={100} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="إشعار نظام CRM" />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toRotate}
        onClose={() => setToRotate(null)}
        onConfirm={() => { if (toRotate) rotateMut.mutate(toRotate) }}
        loading={rotateMut.isLoading}
        title="توليد مفتاح توقيع جديد؟"
        description="يتوقف المفتاح الحالي عن العمل فورًا، وستحتاج إلى تحديثه على خادمك قبل التسليم التالي."
        confirmLabel="توليد مفتاح جديد"
      />
      <ConfirmDialog
        destructive
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => { if (toDelete) deleteMut.mutate(toDelete.id) }}
        loading={deleteMut.isLoading}
        title="حذف الـ Webhook؟"
        description={toDelete ? `لن تصل أحداث «${eventMeta(toDelete.event)?.label || toDelete.event}» إلى ${toDelete.target_url} بعد الآن.` : undefined}
        confirmLabel="حذف"
      />
    </div>
  )
}
