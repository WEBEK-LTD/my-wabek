import React, { useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { useMutation, useQuery, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  ArrowPathIcon, ChatBubbleLeftRightIcon, CheckCircleIcon, CpuChipIcon, CreditCardIcon, DevicePhoneMobileIcon, ExclamationTriangleIcon,
  GiftIcon, MegaphoneIcon, PencilSquareIcon, PlusIcon, SparklesIcon, TrashIcon, UserGroupIcon, UsersIcon,
} from '@heroicons/react/24/outline'
import {
  Badge, Button, Card, ConfirmDialog, DataTable, EmptyState, Field, Input, PageHeader, Select, Skeleton, Tabs, Tooltip, cn, formatNumber,
} from '@/components/ui'
import type { Column } from '@/components/ui'
import { apiError, useAdminT, usd } from '@/components/admin/i18n'
import { CopyButton, ErrorState, Notice } from '@/components/admin/shared'
import { PlanEditor, type Plan } from '@/components/admin/plans/PlanEditor'

interface Gift {
  id: string; code: string; duration_days: number; price: number; is_used: boolean; note?: string | null; created_at: string
  plan?: { name: string } | null; used_by_user?: { name: string | null; email: string } | null
}
interface SyncResult { plan: string; status: string; error?: string }

const lim = (v: number | null | undefined) => (v === -1 ? '∞' : v == null ? '—' : formatNumber(v))
const GIFT_EMPTY = { plan_id: '', duration_days: 30, price: 0, note: '', quantity: 1 }

export default function AdminPlansPage() {
  const { tr, fmtDate } = useAdminT()
  const qc = useQueryClient()
  const [tab, setTab] = useState('plans')
  const [editor, setEditor] = useState<{ open: boolean; plan: Plan | null }>({ open: false, plan: null })
  const [toDeactivate, setToDeactivate] = useState<Plan | null>(null)
  const [syncResults, setSyncResults] = useState<SyncResult[] | null>(null)
  const [gf, setGf] = useState(GIFT_EMPTY)

  const plansQ = useQuery<{ plans: Plan[] }>('admin-plans-full', () => axios.get('/api/admin/plans').then(r => r.data))
  const giftsQ = useQuery<{ gifts: Gift[] }>('admin-gifts', () => axios.get('/api/admin/gifts').then(r => r.data))
  const plans = plansQ.data?.plans || []
  const gifts = giftsQ.data?.gifts || []

  const syncMut = useMutation(() => axios.post('/api/admin/sync-stripe').then(r => r.data), {
    onSuccess: d => {
      qc.invalidateQueries('admin-plans-full')
      setSyncResults(d.results || [])
      toast.success(tr(`تمت مزامنة ${d.synced || 0} باقة مع Stripe`, `Synced ${d.synced || 0} plans with Stripe`))
    },
    onError: e => void toast.error(apiError(e, tr('فشلت المزامنة', 'Sync failed'))),
  })
  const saveMut = useMutation((body: Record<string, unknown>) => editor.plan ? axios.put(`/api/admin/plans/${editor.plan.id}`, body) : axios.post('/api/admin/plans', body), {
    onSuccess: () => {
      qc.invalidateQueries('admin-plans-full')
      toast.success(editor.plan ? tr('تم تحديث الباقة', 'Plan updated') : tr('تم إنشاء الباقة', 'Plan created'))
      setEditor({ open: false, plan: null })
    },
    onError: e => void toast.error(apiError(e, tr('تعذّر الحفظ', 'Save failed'))),
  })
  const delMut = useMutation((id: string) => axios.delete(`/api/admin/plans/${id}`), {
    onSuccess: () => { qc.invalidateQueries('admin-plans-full'); toast.success(tr('تم إيقاف الباقة', 'Plan deactivated')); setToDeactivate(null) },
    onError: e => void toast.error(apiError(e, tr('تعذّر إيقاف الباقة', 'Could not deactivate the plan'))),
  })
  const giftMut = useMutation((b: typeof GIFT_EMPTY) => axios.post('/api/admin/gifts', b).then(r => r.data), {
    onSuccess: d => {
      giftsQ.refetch()
      const codes = (d.gifts || []).map((g: Gift) => g.code).join('\n')
      navigator.clipboard?.writeText(codes).catch(() => {})
      toast.success(tr(`أُنشئ ${d.gifts?.length || 0} رمز ونُسخ`, `${d.gifts?.length || 0} code(s) created & copied`))
      setGf(GIFT_EMPTY)
    },
    onError: e => void toast.error(apiError(e, tr('تعذّر إنشاء الرموز', 'Could not create codes'))),
  })

  const giftCols: Column<Gift>[] = [
    { key: 'code', header: tr('الرمز', 'Code'), cell: g => <div className="flex items-center gap-1"><code dir="ltr" className="rounded-md bg-chip px-2 py-0.5 font-mono text-xs text-chip-ink">{g.code}</code><CopyButton text={g.code} label={tr('نسخ الرمز', 'Copy code')} /></div> },
    { key: 'plan', header: tr('الباقة', 'Plan'), cell: g => g.plan?.name || '—' },
    { key: 'days', header: tr('المدة', 'Duration'), cell: g => <span className="tabular">{tr(`${g.duration_days} يومًا`, `${g.duration_days} days`)}</span> },
    { key: 'price', header: tr('السعر', 'Price'), cell: g => g.price > 0 ? <span className="tabular" dir="ltr">{usd(g.price)}</span> : <Badge tone="brand" size="sm">{tr('مجاني', 'Free')}</Badge> },
    { key: 'status', header: tr('الحالة', 'Status'), cell: g => <Badge tone={g.is_used ? 'neutral' : 'success'} dot>{g.is_used ? tr('مستخدم', 'Used') : tr('متاح', 'Available')}</Badge> },
    { key: 'used', header: tr('استخدمه', 'Used by'), hideBelow: 'md', cell: g => g.used_by_user ? <div><p className="text-sm text-ink">{g.used_by_user.name}</p><p dir="ltr" className="text-start text-xs text-muted">{g.used_by_user.email}</p></div> : '—' },
    { key: 'created', header: tr('أُنشئ', 'Created'), hideBelow: 'lg', cell: g => <div className="text-xs text-muted">{fmtDate(g.created_at)}{g.note && <p className="mt-0.5 text-2xs">{g.note}</p>}</div> },
  ]

  return (
    <AdminLayout title={tr('الباقات', 'Plans')}>
      <PageHeader
        eyebrow={tr('الفوترة', 'Billing')}
        title={tr('الباقات ودعوات الهدايا', 'Plans & gift invites')}
        description={tr('حدّد الأسعار والحدود والميزات لكل باقة، ثم زامنها مع Stripe.', 'Set prices, limits and features for each plan, then sync them with Stripe.')}
        actions={tab === 'plans' ? <>
          <Button variant="secondary" icon={ArrowPathIcon} loading={syncMut.isLoading} onClick={() => syncMut.mutate()}>{tr('مزامنة مع Stripe', 'Sync with Stripe')}</Button>
          <Button icon={PlusIcon} onClick={() => setEditor({ open: true, plan: null })}>{tr('باقة جديدة', 'New plan')}</Button>
        </> : undefined}
      >
        <Tabs idPrefix="plans" value={tab} onChange={setTab} tabs={[
          { id: 'plans', label: tr('الباقات', 'Plans'), icon: CreditCardIcon, count: plans.length || undefined },
          { id: 'gifts', label: tr('دعوات الهدايا', 'Gift invites'), icon: GiftIcon, count: gifts.length || undefined },
        ]} />
      </PageHeader>

      {tab === 'plans' && (
        <div className="space-y-5" role="tabpanel" id="plans-panel-plans" aria-labelledby="plans-tab-plans">
          {syncResults && syncResults.length > 0 && (
            <Notice tone={syncResults.some(r => r.status !== 'synced') ? 'warning' : 'success'} icon={syncResults.some(r => r.status !== 'synced') ? ExclamationTriangleIcon : CheckCircleIcon}
              title={tr('نتيجة المزامنة مع Stripe', 'Stripe sync result')}>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {syncResults.map(r => <li key={r.plan}><Badge size="sm" tone={r.status === 'synced' ? 'success' : 'danger'}>{r.plan} · {r.status === 'synced' ? tr('تمت', 'synced') : r.error || r.status}</Badge></li>)}
              </ul>
            </Notice>
          )}
          {plansQ.isError ? <ErrorState onRetry={() => plansQ.refetch()} /> : plansQ.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-72 rounded-card" />)}</div>
          ) : plans.length === 0 ? (
            <EmptyState variant="card" icon={CreditCardIcon} title={tr('لا توجد باقات نشطة', 'No active plans')}
              description={tr('أنشئ أول باقة لتظهر في صفحة الأسعار.', 'Create your first plan to show it on the pricing page.')}
              action={<Button icon={PlusIcon} onClick={() => setEditor({ open: true, plan: null })}>{tr('باقة جديدة', 'New plan')}</Button>} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {plans.map(p => (
                <Card key={p.id} interactive className={cn('flex flex-col gap-4', !p.is_active && 'opacity-60')}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-semibold text-ink">{p.name}</h2>
                      {p.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{p.description}</p>}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Tooltip content={tr('تعديل', 'Edit')}><Button size="icon-sm" variant="ghost" icon={PencilSquareIcon} aria-label={tr(`تعديل ${p.name}`, `Edit ${p.name}`)} onClick={() => setEditor({ open: true, plan: p })} /></Tooltip>
                      <Tooltip content={tr('إيقاف', 'Deactivate')}><Button size="icon-sm" variant="ghost" icon={TrashIcon} aria-label={tr(`إيقاف ${p.name}`, `Deactivate ${p.name}`)} onClick={() => setToDeactivate(p)} /></Tooltip>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1.5" dir="ltr">
                    <span className="tabular text-[32px] font-bold leading-none text-ink">{usd(p.price_monthly, Number(p.price_monthly) % 1 ? 2 : 0)}</span>
                    <span className="text-sm text-muted">/{tr('شهر', 'mo')}</span>
                    {Number(p.price_yearly) > 0 && <Badge tone="brand" size="sm" className="ms-2">{usd(p.price_yearly, 0)}/{tr('سنة', 'yr')}</Badge>}
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                    {[
                      { icon: ChatBubbleLeftRightIcon, v: lim(p.max_messages_month), k: tr('رسالة/شهر', 'msgs/mo') },
                      { icon: UserGroupIcon, v: lim(p.max_contacts), k: tr('جهة اتصال', 'contacts') },
                      { icon: DevicePhoneMobileIcon, v: lim(p.max_instances), k: tr('رقم واتساب', 'numbers') },
                      { icon: MegaphoneIcon, v: lim(p.max_campaigns), k: tr('حملة', 'campaigns') },
                      { icon: CpuChipIcon, v: lim(p.max_chatbot_flows), k: tr('روبوت', 'bots') },
                      { icon: SparklesIcon, v: lim(p.max_ai_replies ?? 0), k: tr('رد ذكي/شهر', 'AI/mo') },
                      { icon: UsersIcon, v: lim(p.max_team_members ?? 1), k: tr('عضو فريق', 'agents') },
                    ].map(x => (
                      <div key={x.k} className="flex items-center gap-1.5 text-muted">
                        <x.icon className="h-4 w-4 shrink-0 text-brand-ink" aria-hidden="true" />
                        <dd className="tabular font-semibold text-ink">{x.v}</dd><dt className="truncate text-xs">{x.k}</dt>
                      </div>
                    ))}
                  </dl>
                  <div className="flex flex-wrap gap-1.5">
                    {p.allow_api_access && <Badge size="sm">API</Badge>}
                    {p.allow_ai && <Badge size="sm" tone="violet">{tr('ذكاء اصطناعي', 'AI')}</Badge>}
                    {p.allow_white_label && <Badge size="sm">{tr('علامة بيضاء', 'White label')}</Badge>}
                    {p.allow_sub_accounts && <Badge size="sm">{tr(`حسابات فرعية (${p.max_sub_accounts ?? 0})`, `Sub-accounts (${p.max_sub_accounts ?? 0})`)}</Badge>}
                    {p.allow_reseller && <Badge size="sm">{tr('موزّعون', 'Reseller')}</Badge>}
                    {p.allow_gift_invites && <Badge size="sm" tone="warning" icon={GiftIcon}>{tr(`${p.invite_credits ?? 0} هدية/شهر`, `${p.invite_credits ?? 0} gifts/mo`)}</Badge>}
                  </div>
                  <div className="mt-auto flex items-center justify-between border-t border-line-soft pt-3">
                    <Badge tone={p.is_active ? 'success' : 'neutral'} dot>{p.is_active ? tr('نشطة', 'Active') : tr('غير نشطة', 'Inactive')}</Badge>
                    {Number(p.price_monthly) === 0 ? <span className="text-xs text-muted">{tr('مجانية — لا تحتاج Stripe', 'Free — no Stripe needed')}</span>
                      : <Badge tone={p.stripe_price_id_monthly ? 'brand' : 'warning'} size="sm" icon={p.stripe_price_id_monthly ? CheckCircleIcon : ExclamationTriangleIcon}>
                          {p.stripe_price_id_monthly ? tr('مزامنة مع Stripe', 'Stripe synced') : tr('غير مزامنة', 'Not synced')}
                        </Badge>}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'gifts' && (
        <div className="grid gap-5 xl:grid-cols-3" role="tabpanel" id="plans-panel-gifts" aria-labelledby="plans-tab-gifts">
          <Card className="space-y-4 xl:col-span-1">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient text-[#04282C]"><GiftIcon className="h-5 w-5" aria-hidden="true" /></span>
              <div>
                <h2 className="section-title">{tr('إنشاء رموز هدايا', 'Generate gift codes')}</h2>
                <p className="text-xs text-muted">{tr('يفعّل الرمز باقة لعدد أيام محدد دون دفع.', 'A code activates a plan for a set number of days, no payment.')}</p>
              </div>
            </div>
            <Field label={tr('الباقة', 'Plan')} required>
              <Select value={gf.plan_id} onChange={e => setGf(p => ({ ...p, plan_id: e.target.value }))} placeholder={tr('اختر باقة', 'Select a plan')}
                options={plans.map(p => ({ value: p.id, label: `${p.name} ($${p.price_monthly}/${tr('شهر', 'mo')})` }))} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label={tr('المدة (أيام)', 'Days')}><Input type="number" dir="ltr" min={1} value={gf.duration_days} onChange={e => setGf(p => ({ ...p, duration_days: parseInt(e.target.value) || 30 }))} /></Field>
              <Field label={tr('السعر $', 'Price $')} hint={tr('0 = مجاني', '0 = free')}><Input type="number" dir="ltr" min={0} step={0.01} value={gf.price} onChange={e => setGf(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))} /></Field>
              <Field label={tr('العدد', 'Qty')} hint={tr('حتى 50', 'max 50')}><Input type="number" dir="ltr" min={1} max={50} value={gf.quantity} onChange={e => setGf(p => ({ ...p, quantity: Math.min(50, parseInt(e.target.value) || 1) }))} /></Field>
            </div>
            <Field label={tr('ملاحظة داخلية', 'Internal note')}><Input value={gf.note} onChange={e => setGf(p => ({ ...p, note: e.target.value }))} placeholder={tr('مثال: عرض رمضان', 'e.g. Ramadan promotion')} /></Field>
            <Button fullWidth icon={GiftIcon} loading={giftMut.isLoading} disabled={!gf.plan_id} onClick={() => giftMut.mutate(gf)}>
              {tr(`إنشاء ${gf.quantity} رمز ونسخها`, `Generate ${gf.quantity} code${gf.quantity > 1 ? 's' : ''} & copy`)}
            </Button>
          </Card>

          <Card padding="none" className="xl:col-span-2">
            <div className="flex items-center justify-between px-5 pb-2 pt-5 sm:px-6">
              <h2 className="section-title">{tr('جميع الرموز', 'All codes')}</h2>
              <Badge tone="neutral" className="tabular">{formatNumber(gifts.length)}</Badge>
            </div>
            {giftsQ.isError ? <div className="p-4"><ErrorState onRetry={() => giftsQ.refetch()} /></div> : (
              <DataTable rows={gifts} loading={giftsQ.isLoading} rowKey={g => g.id} columns={giftCols} minWidth={640} caption={tr('رموز الهدايا', 'Gift codes')}
                empty={<EmptyState size="sm" icon={GiftIcon} title={tr('لا توجد رموز بعد', 'No gift codes yet')} description={tr('أنشئ رموزًا من النموذج المجاور.', 'Generate codes with the form.')} />} />
            )}
          </Card>
        </div>
      )}

      <PlanEditor open={editor.open} plan={editor.plan} onClose={() => setEditor({ open: false, plan: null })} saving={saveMut.isLoading} onSave={b => saveMut.mutate(b)} />
      <ConfirmDialog
        open={!!toDeactivate}
        destructive
        onClose={() => setToDeactivate(null)}
        loading={delMut.isLoading}
        title={tr('إيقاف هذه الباقة؟', 'Deactivate this plan?')}
        description={tr('ستختفي من صفحة الأسعار ولن يتمكن أحد من الاشتراك فيها. المشتركون الحاليون لا يتأثرون.', 'It disappears from pricing and nobody can subscribe to it. Existing subscribers are not affected.')}
        confirmLabel={tr('إيقاف', 'Deactivate')}
        onConfirm={() => { if (toDeactivate) delMut.mutate(toDeactivate.id) }}
      />
    </AdminLayout>
  )
}
