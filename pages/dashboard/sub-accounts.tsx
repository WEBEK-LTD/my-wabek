// @ts-nocheck
import { useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  PlusIcon, UserGroupIcon, NoSymbolIcon, CheckCircleIcon, SignalIcon, UsersIcon, ChatBubbleLeftRightIcon,
  ShieldCheckIcon, BookOpenIcon,
} from '@heroicons/react/24/outline'
import {
  Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, Modal, PageHeader, StatCard,
} from '@/components/ui'
import { CardsSkeleton, ErrorState, PlanGate, apiError } from '@/components/settings/Shared'
import { fmtDate, fmtLimit } from '@/components/settings/format'

const EMPTY_FORM = { name: '', email: '', password: '', max_contacts: -1, max_instances: 1, max_messages_month: 1000 }

export default function SubAccountsPage() {
  return <PlanGate feature="allow_sub_accounts"><SubAccountsContent /></PlanGate>
}

function SubAccountsContent() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [toSuspend, setToSuspend] = useState(null)

  const { data, isLoading, isError, error, refetch } = useQuery('sub-accounts', () => axios.get('/api/sub-accounts').then(r => r.data))
  const accounts = data?.accounts || []
  const activeCount = accounts.filter(a => a.user?.is_active).length

  const suspendMut = useMutation(
    id => axios.delete(`/api/sub-accounts/${id}`),
    { onSuccess: () => { qc.invalidateQueries('sub-accounts'); setToSuspend(null); toast.success('تم إيقاف الحساب') },
      onError: e => toast.error(apiError(e, 'تعذّر إيقاف الحساب')) }
  )
  const activateMut = useMutation(
    id => axios.put(`/api/sub-accounts/${id}`, { is_active: true }),
    { onSuccess: () => { qc.invalidateQueries('sub-accounts'); toast.success('تم تفعيل الحساب') },
      onError: e => toast.error(apiError(e, 'تعذّر تفعيل الحساب')) }
  )

  const createMut = useMutation(
    (body) => axios.post('/api/sub-accounts', body),
    {
      onSuccess: () => {
        qc.invalidateQueries('sub-accounts')
        setShowForm(false)
        setForm(EMPTY_FORM)
        toast.success('تم إنشاء الحساب الفرعي')
      },
      onError: (e) => toast.error(e?.response?.data?.error || 'تعذّر إنشاء الحساب'),
    }
  )

  const num = (k) => e => setForm(f => ({ ...f, [k]: parseInt(e.target.value) }))

  return (
    <DashboardLayout title="Sub-Accounts">
      <div className="space-y-6">
        <PageHeader
          eyebrow="الإعدادات"
          title="الحسابات الفرعية"
          description="أنشئ لكل عميل لوحة تحكم مستقلة بحدود تحددها أنت، وأدرها كلها من هنا."
          actions={
            <>
              <Button variant="secondary" icon={BookOpenIcon} href="/docs/guides/sub-accounts">الدليل</Button>
              <Button icon={PlusIcon} onClick={() => setShowForm(true)}>حساب فرعي جديد</Button>
            </>
          }
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-3.5">
          <StatCard label="جميع الحسابات" value={String(accounts.length)} icon={UserGroupIcon} loading={isLoading} />
          <StatCard label="نشطة" value={String(activeCount)} icon={CheckCircleIcon} loading={isLoading} />
          <StatCard label="موقوفة" value={String(accounts.length - activeCount)} icon={NoSymbolIcon} loading={isLoading}
            subTone={accounts.length - activeCount > 0 ? 'warning' : 'muted'} />
        </div>

        {isLoading ? (
          <CardsSkeleton count={3} className="h-48" />
        ) : isError ? (
          <ErrorState message={apiError(error, 'تعذّر تحميل الحسابات')} onRetry={() => refetch()} />
        ) : accounts.length === 0 ? (
          <EmptyState
            variant="card"
            icon={UserGroupIcon}
            title="لا توجد حسابات فرعية بعد"
            description="أنشئ حسابات لعملائك؛ يحصل كل منهم على لوحة تحكم وتسجيل دخول مستقلين."
            action={<Button icon={PlusIcon} onClick={() => setShowForm(true)}>إنشاء أول حساب فرعي</Button>}
          />
        ) : (
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr))]">
            {accounts.map(acc => {
              const active = !!acc.user?.is_active
              return (
                <Card key={acc.id} padding="none" interactive className={active ? '' : 'opacity-80'}>
                  <div className="flex items-start gap-3 p-5">
                    <Avatar name={acc.user?.name || acc.user?.email || '?'} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold text-ink">{acc.user?.name || '—'}</p>
                        <Badge tone={active ? 'success' : 'danger'} size="sm" dot>{active ? 'نشط' : 'موقوف'}</Badge>
                      </div>
                      <p className="truncate text-sm text-muted"><span dir="ltr">{acc.user?.email}</span></p>
                      <p className="mt-0.5 text-xs text-muted">أُنشئ {fmtDate(acc.user?.created_at)}</p>
                    </div>
                  </div>
                  <dl className="grid grid-cols-3 divide-x divide-line-soft border-y border-line-soft bg-surface-2/50 text-center rtl:divide-x-reverse">
                    {[
                      { icon: SignalIcon, label: 'أرقام', value: fmtLimit(acc.max_instances) },
                      { icon: UsersIcon, label: 'جهات اتصال', value: fmtLimit(acc.max_contacts) },
                      { icon: ChatBubbleLeftRightIcon, label: 'رسالة/شهر', value: fmtLimit(acc.max_messages_month) },
                    ].map(s => (
                      <div key={s.label} className="px-2 py-3">
                        <dt className="flex items-center justify-center gap-1 text-[11px] text-muted"><s.icon className="h-3.5 w-3.5" aria-hidden="true" />{s.label}</dt>
                        <dd className="mt-0.5 text-sm font-semibold text-ink tabular">{s.value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="flex justify-end px-5 py-3">
                    {active ? (
                      <Button size="sm" variant="danger-soft" icon={NoSymbolIcon} onClick={() => setToSuspend(acc)}>إيقاف</Button>
                    ) : (
                      <Button size="sm" variant="secondary" icon={CheckCircleIcon} loading={activateMut.isLoading && activateMut.variables === acc.id} onClick={() => activateMut.mutate(acc.id)}>تفعيل</Button>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        <Card variant="muted">
          <div className="flex items-start gap-3">
            <ShieldCheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-ink" aria-hidden="true" />
            <ul className="grid flex-1 gap-x-8 gap-y-1.5 text-sm text-body sm:grid-cols-2">
              <li>لكل حساب فرعي لوحة تحكم وتسجيل دخول مستقلان.</li>
              <li>تحدد حدودًا مخصصة لكل حساب.</li>
              <li>الحسابات معزولة؛ لا يرى أي منها بيانات غيره.</li>
              <li>تتطلب الحسابات الفرعية باقة تتضمن هذه الميزة.</li>
            </ul>
          </div>
        </Card>
      </div>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        size="lg"
        icon={UserGroupIcon}
        title="حساب فرعي جديد"
        description="سيتمكن العميل من الدخول ببريده وكلمة المرور التي تحددها."
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>إلغاء</Button>
            <Button type="submit" form="sub-form" loading={createMut.isLoading} disabled={!form.name || !form.email || !form.password}>إنشاء الحساب</Button>
          </>
        }
      >
        <form id="sub-form" className="space-y-5" onSubmit={e => { e.preventDefault(); createMut.mutate(form) }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="الاسم الكامل" required>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="اسم العميل" />
            </Field>
            <Field label="البريد الإلكتروني" required>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="client@example.com" dir="ltr" />
            </Field>
            <Field label="كلمة المرور" hint="8 أحرف على الأقل" required className="sm:col-span-2">
              <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} autoComplete="new-password" />
            </Field>
          </div>
          <fieldset className="rounded-card border border-line-soft bg-surface-2/60 p-4">
            <legend className="px-1 text-sm font-medium text-ink">الحدود</legend>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="أرقام واتساب">
                <Input type="number" min={1} value={form.max_instances} onChange={num('max_instances')} dir="ltr" />
              </Field>
              <Field label="جهات الاتصال" hint="-1 = غير محدود">
                <Input type="number" value={form.max_contacts} onChange={num('max_contacts')} dir="ltr" />
              </Field>
              <Field label="رسائل شهريًا">
                <Input type="number" value={form.max_messages_month} onChange={num('max_messages_month')} dir="ltr" />
              </Field>
            </div>
          </fieldset>
        </form>
      </Modal>

      <ConfirmDialog
        destructive
        open={!!toSuspend}
        onClose={() => setToSuspend(null)}
        onConfirm={() => { if (toSuspend) suspendMut.mutate(toSuspend.id) }}
        loading={suspendMut.isLoading}
        title="إيقاف هذا الحساب؟"
        description={`لن يتمكن ${toSuspend?.user?.name || 'العميل'} من الدخول حتى تعيد تفعيله.`}
        confirmLabel="إيقاف الحساب"
      />
    </DashboardLayout>
  )
}
