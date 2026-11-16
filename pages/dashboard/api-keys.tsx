import { useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  PlusIcon, KeyIcon, TrashIcon, ShieldCheckIcon, BookOpenIcon, LockClosedIcon, ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import {
  Badge, Button, Card, CardHeader, ConfirmDialog, EmptyState, Field, Input, Modal, PageHeader,
  Skeleton, Table, TBody, TD, TH, THead, TR, Tooltip,
} from '@/components/ui'
import { CopyField, ErrorState, Notice, PlanGate, apiError, apiStatus } from '@/components/settings/Shared'
import { ApiQuickStart } from '@/components/settings/ApiQuickStart'
import { fmtDate, fmtRelative } from '@/components/settings/format'

interface ApiKeyRow {
  id: string
  name: string
  key_prefix: string
  permissions?: string[] | null
  last_used_at?: string | null
  is_active: boolean
  created_at: string
}

const PERMISSION_LABELS: Record<string, string> = { send: 'الإرسال', contacts: 'جهات الاتصال', otp: 'رموز التحقق' }

export default function ApiKeysPage() {
  return <PlanGate feature="allow_api_access"><ApiKeysContent /></PlanGate>
}

function ApiKeysContent() {
  const qc = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKey, setNewKey] = useState<string | null>(null)
  const [toRevoke, setToRevoke] = useState<ApiKeyRow | null>(null)

  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://waabek.com'

  const keysQ = useQuery('api-keys', () => axios.get('/api/settings/api-keys').then(r => r.data), { retry: false })
  // The default key is not part of the user object (owner-only endpoint).
  const defaultQ = useQuery('default-api-key',
    () => axios.get('/api/settings/default-api-key').then(r => r.data), { retry: false, staleTime: Infinity })
  const defaultApiKey: string | null = defaultQ.data?.api_key || null
  const keys: ApiKeyRow[] = keysQ.data?.keys || []
  const ownerOnly = apiStatus(keysQ.error) === 403 || apiStatus(defaultQ.error) === 403
  const activeCount = keys.filter(k => k.is_active).length

  const createMut = useMutation(
    () => axios.post('/api/settings/api-keys', { name: newKeyName }).then(r => r.data),
    {
      onSuccess: (data) => {
        qc.invalidateQueries('api-keys')
        setNewKey(data.key)
        setNewKeyName('')
        setShowNew(false)
        toast.success('تم إنشاء المفتاح')
      },
      onError: (e) => void toast.error(apiError(e, 'تعذّر إنشاء المفتاح')),
    }
  )

  const deleteMut = useMutation(
    (id: string) => axios.delete(`/api/settings/api-keys/${id}`),
    {
      onSuccess: () => { qc.invalidateQueries('api-keys'); setToRevoke(null); toast.success('تم إلغاء المفتاح') },
      onError: (e) => void toast.error(apiError(e, 'تعذّر إلغاء المفتاح')),
    }
  )

  return (
    <DashboardLayout title="API Keys">
      <div className="space-y-6">
        <PageHeader
          eyebrow="التكاملات"
          title="مفاتيح API"
          description="أنشئ مفتاحًا مستقلًا لكل تكامل (WHMCS أو ووردبريس أو تطبيقك)، وألغِه فورًا عند الحاجة دون التأثير على البقية."
          actions={
            <>
              <Button variant="secondary" icon={BookOpenIcon} href="/docs/api/authentication">توثيق المصادقة</Button>
              {!ownerOnly && <Button icon={PlusIcon} onClick={() => setShowNew(true)}>مفتاح جديد</Button>}
            </>
          }
        />

        {ownerOnly && (
          <Notice tone="info" icon={LockClosedIcon} title="إدارة المفاتيح متاحة لمالك الحساب فقط">
            يمكنك استخدام التكاملات التي أعدّها المالك، لكن إنشاء المفاتيح وعرضها وإلغاءها يقتصر عليه. تواصل معه إذا احتجت إلى مفتاح.
          </Notice>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* Keys table */}
          <Card padding="none" className="order-2 lg:order-1">
            <CardHeader
              icon={KeyIcon}
              title="المفاتيح المسمّاة"
              subtitle={keys.length ? `${activeCount} نشط من ${keys.length}` : 'مفتاح لكل تكامل'}
              action={!ownerOnly && keys.length > 0 ? <Button size="sm" variant="secondary" icon={PlusIcon} onClick={() => setShowNew(true)}>مفتاح جديد</Button> : undefined}
              divider
            />
            {keysQ.isLoading ? (
              <div className="space-y-3 p-5">{[0, 1, 2].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : ownerOnly ? (
              <EmptyState size="sm" icon={LockClosedIcon} title="لا يمكنك عرض المفاتيح" description="تظهر المفاتيح لمالك الحساب فقط." />
            ) : keysQ.isError ? (
              <ErrorState className="m-5" message={apiError(keysQ.error)} onRetry={() => keysQ.refetch()} />
            ) : keys.length === 0 ? (
              <EmptyState
                size="sm"
                icon={KeyIcon}
                title="لا توجد مفاتيح مسمّاة بعد"
                description="أنشئ مفتاحًا لكل تكامل لتعرف مصدر كل طلب وتلغيه منفردًا."
                action={<Button size="sm" icon={PlusIcon} onClick={() => setShowNew(true)}>إنشاء أول مفتاح</Button>}
              />
            ) : (
              <Table minWidth={720} caption="المفاتيح المسمّاة">
                <THead>
                  <TR>
                    <TH>الاسم</TH>
                    <TH>البادئة</TH>
                    <TH>الصلاحيات</TH>
                    <TH>آخر استخدام</TH>
                    <TH>تاريخ الإنشاء</TH>
                    <TH align="end"><span className="sr-only">إجراءات</span></TH>
                  </TR>
                </THead>
                <TBody>
                  {keys.map(k => (
                    <TR key={k.id} className={k.is_active ? undefined : 'opacity-60'}>
                      <TD>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-ink">{k.name}</span>
                          {!k.is_active && <Badge tone="danger" size="sm">ملغى</Badge>}
                        </div>
                      </TD>
                      <TD><code dir="ltr" className="font-mono text-[13px] text-muted">{k.key_prefix}••••</code></TD>
                      <TD>
                        <div className="flex flex-wrap gap-1">
                          {(k.permissions || []).length === 0
                            ? <span className="text-xs text-muted">—</span>
                            : (k.permissions || []).map(p => <Badge key={p} tone="neutral" size="sm">{PERMISSION_LABELS[p] || p}</Badge>)}
                        </div>
                      </TD>
                      <TD className="whitespace-nowrap text-sm text-muted">{k.last_used_at ? fmtRelative(k.last_used_at) : 'لم يُستخدم'}</TD>
                      <TD className="whitespace-nowrap text-sm text-muted">{fmtDate(k.created_at)}</TD>
                      <TD align="end">
                        {k.is_active && (
                          <Tooltip content="إلغاء المفتاح">
                            <Button size="icon-sm" variant="ghost" icon={TrashIcon} aria-label={`إلغاء المفتاح ${k.name}`} className="text-muted hover:text-danger" onClick={() => setToRevoke(k)} />
                          </Tooltip>
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>

          {/* Default key */}
          <Card className="order-1 h-fit lg:order-2" variant="deep" padding="lg">
            <div aria-hidden="true" className="pointer-events-none absolute -end-10 -top-10 h-40 w-40 rounded-full bg-brand-green/20 blur-3xl" />
            <div className="relative space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-gradient text-[#04282C]">
                  <ShieldCheckIcon className="h-6 w-6" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-semibold text-deep-ink">المفتاح الافتراضي</h2>
                  <p className="text-xs text-deep-muted">أُنشئ تلقائيًا لحسابك</p>
                </div>
              </div>
              {defaultQ.isLoading ? (
                <Skeleton className="h-11 w-full bg-white/10" />
              ) : apiStatus(defaultQ.error) === 403 ? (
                <p className="rounded-field bg-white/[0.06] px-3 py-2.5 text-sm text-deep-muted">يستطيع مالك الحساب وحده عرض هذا المفتاح.</p>
              ) : defaultApiKey ? (
                <CopyField value={defaultApiKey} secret className="border-white/10 bg-white/[0.06] [&_code]:text-deep-ink [&_button]:text-deep-muted" />
              ) : (
                <p className="rounded-field bg-white/[0.06] px-3 py-2.5 text-sm text-deep-muted">لا يوجد مفتاح افتراضي لهذا الحساب.</p>
              )}
              <p className="text-xs leading-relaxed text-deep-muted">احفظه في مكان آمن ولا تضعه في رابط أو في كود يعمل داخل المتصفح.</p>
            </div>
          </Card>
        </div>

        <ApiQuickStart baseUrl={appUrl} apiKey={newKey || 'YOUR_API_KEY'} />
      </div>

      {/* Create */}
      <Modal
        open={showNew}
        onClose={() => setShowNew(false)}
        size="sm"
        icon={KeyIcon}
        title="مفتاح API جديد"
        description="سمِّ المفتاح باسم التكامل الذي سيستخدمه."
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowNew(false)}>إلغاء</Button>
            <Button loading={createMut.isLoading} disabled={!newKeyName.trim()} onClick={() => createMut.mutate()}>إنشاء المفتاح</Button>
          </>
        }
      >
        <Field label="اسم المفتاح" required>
          <Input
            value={newKeyName}
            onChange={e => setNewKeyName(e.target.value)}
            placeholder="مثل: WHMCS Production"
            maxLength={100}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter' && newKeyName.trim()) createMut.mutate() }}
          />
        </Field>
      </Modal>

      {/* Reveal once */}
      <Modal
        open={!!newKey}
        onClose={() => setNewKey(null)}
        icon={ShieldCheckIcon}
        title="انسخ المفتاح الآن"
        description="هذه هي المرة الوحيدة التي يظهر فيها المفتاح كاملًا."
        footer={<Button onClick={() => setNewKey(null)}>نسخته واحتفظت به</Button>}
      >
        <div className="space-y-4">
          <CopyField value={newKey || ''} className="py-2.5" />
          <Notice tone="warning" icon={ExclamationTriangleIcon} title="لن نتمكن من عرضه مرة أخرى">
            نحتفظ ببصمة المفتاح فقط. إن فقدته فأنشئ مفتاحًا جديدًا وألغِ القديم.
          </Notice>
        </div>
      </Modal>

      <ConfirmDialog
        destructive
        open={!!toRevoke}
        onClose={() => setToRevoke(null)}
        onConfirm={() => { if (toRevoke) deleteMut.mutate(toRevoke.id) }}
        loading={deleteMut.isLoading}
        title={`إلغاء المفتاح «${toRevoke?.name || ''}»؟`}
        description="ستُرفض فورًا كل الطلبات التي تستخدم هذا المفتاح. لا يمكن التراجع عن الإلغاء."
        confirmLabel="إلغاء المفتاح"
      />
    </DashboardLayout>
  )
}
