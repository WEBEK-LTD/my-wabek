import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '@/components/layout/AdminLayout'
import { useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'
import { BanknotesIcon, BuildingStorefrontIcon, CheckCircleIcon, ClockIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'
import {
  Avatar, Button, Card, CardHeader, ConfirmDialog, DataTable, EmptyState, Field, Input, PageHeader, Select, StatCard, formatNumber,
} from '@/components/ui'
import type { Column } from '@/components/ui'
import { apiError, useAdminT, usd } from '@/components/admin/i18n'
import { ErrorState, Notice } from '@/components/admin/shared'
import { PAYOUT_METHODS, RESELLER_KEYS, useResellers, type ResellerProfile } from '@/components/admin/resellers/types'

const EMPTY = { reseller_id: '', amount: '', method: 'bank_transfer', reference: '', period_start: '', period_end: '' }

export default function AdminPayoutsPage() {
  const { tr, fmtDate } = useAdminT()
  const qc = useQueryClient()
  const router = useRouter()
  const [form, setForm] = useState(EMPTY)
  // One key per payout attempt: retries/double clicks reuse it; a new reseller/amount or a success gets a fresh one.
  const [idemKey, setIdemKey] = useState(() => uuidv4())
  const [confirmOpen, setConfirmOpen] = useState(false)

  const { data, isLoading, isError, refetch } = useResellers('admin-payouts-only')
  const approved = useMemo(() => (data?.resellers || []).filter(r => r.is_approved), [data])
  const pendingRequests = data?.pendingPayouts || []
  const totalPending = approved.reduce((s, r) => s + (Number(r.balance_pending) || 0), 0)
  const totalPaid = approved.reduce((s, r) => s + (Number(r.balance_paid) || 0), 0)

  const selected = approved.find(r => r.user_id === form.reseller_id)
  const balance = Math.round((Number(selected?.balance_pending) || 0) * 100) / 100
  const amount = Math.round(parseFloat(form.amount) * 100) / 100
  const amountError = form.amount === '' ? null
    : !Number.isFinite(amount) || amount <= 0 ? tr('أدخل مبلغًا أكبر من صفر', 'Enter an amount greater than 0')
    : selected && amount > balance ? tr(`المبلغ يتجاوز الرصيد المعلّق (${usd(balance)})`, `Amount exceeds the pending balance (${usd(balance)})`)
    : null
  const canSubmit = !!form.reseller_id && form.amount !== '' && !amountError

  const setField = (k: keyof typeof EMPTY, v: string) => {
    setForm(f => ({ ...f, [k]: v }))
    if (k === 'reseller_id' || k === 'amount') setIdemKey(uuidv4())
  }
  const prefill = (r: ResellerProfile) => {
    setForm(f => ({ ...f, reseller_id: r.user_id, amount: (Number(r.balance_pending) || 0).toFixed(2) }))
    setIdemKey(uuidv4())
  }

  // Deep link from the resellers page: /admin/payouts?reseller=<user_id>
  useEffect(() => {
    const id = typeof router.query.reseller === 'string' ? router.query.reseller : ''
    if (!id || form.reseller_id) return
    const r = approved.find(x => x.user_id === id)
    if (r) prefill(r)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.reseller, approved])

  const payMut = useMutation((body: Record<string, unknown>) => axios.post('/api/admin/payouts', body).then(r => r.data), {
    onSuccess: d => {
      RESELLER_KEYS.forEach(k => qc.invalidateQueries(k))
      toast.success(d?.duplicate ? tr('هذه الدفعة مسجّلة مسبقًا', 'This payout was already recorded') : tr('تم تسجيل الدفعة', 'Payout recorded'))
      setForm(EMPTY)
      setIdemKey(uuidv4())
      setConfirmOpen(false)
    },
    onError: e => { toast.error(apiError(e, tr('تعذّر تسجيل الدفعة', 'Could not record the payout'))); setConfirmOpen(false) },
  })

  const submit = () => {
    if (!canSubmit) { toast.error(tr('اختر موزّعًا وأدخل مبلغًا صالحًا', 'Select a reseller and enter a valid amount')); return }
    payMut.mutate({
      reseller_id: form.reseller_id, amount, method: form.method, reference: form.reference || undefined,
      period_start: form.period_start || undefined, period_end: form.period_end || undefined, idempotency_key: idemKey,
    })
  }

  const methodLabel = (m: string) => ({
    bank_transfer: tr('تحويل بنكي', 'Bank transfer'), paypal: 'PayPal', wise: 'Wise', crypto: tr('عملات رقمية', 'Crypto'), stripe: 'Stripe', other: tr('أخرى', 'Other'),
  } as Record<string, string>)[m] || m

  const cols: Column<ResellerProfile>[] = [
    {
      key: 'r', header: tr('الموزّع', 'Reseller'),
      cell: r => <div className="flex items-center gap-2.5"><Avatar name={r.user?.name || r.user?.email || '?'} size="sm" /><div className="min-w-0"><p className="truncate text-sm font-medium text-ink">{r.user?.name || '—'}</p><p dir="ltr" className="truncate text-start text-xs text-muted">{r.user?.email}</p></div></div>,
    },
    { key: 'p', header: tr('معلّق', 'Pending'), align: 'end', cell: r => <span className="tabular font-semibold text-warning" dir="ltr">{usd(r.balance_pending || 0)}</span> },
    { key: 'paid', header: tr('مدفوع', 'Paid'), align: 'end', hideBelow: 'sm', cell: r => <span className="tabular text-success" dir="ltr">{usd(r.balance_paid || 0)}</span> },
    { key: 't', header: tr('الإجمالي', 'Total'), align: 'end', hideBelow: 'md', cell: r => <span className="tabular" dir="ltr">{usd(r.balance_total || 0)}</span> },
    {
      key: 'a', header: <span className="sr-only">{tr('إجراءات', 'Actions')}</span>, align: 'end',
      cell: r => <Button size="xs" variant={form.reseller_id === r.user_id ? 'primary' : 'secondary'} icon={BanknotesIcon} disabled={!(Number(r.balance_pending) > 0)} onClick={() => prefill(r)}>{tr('دفع', 'Pay')}</Button>,
    },
  ]

  return (
    <AdminLayout title={tr('مدفوعات الموزّعين', 'Reseller payouts')}>
      <PageHeader
        eyebrow={tr('الموزّعون', 'Resellers')}
        title={tr('مدفوعات الموزّعين', 'Reseller payouts')}
        description={tr('سجّل التحويلات التي أرسلتها للموزّعين؛ يُخصم المبلغ من رصيدهم المعلّق ويصلهم إشعار.', 'Record transfers you sent to resellers; the amount is deducted from their pending balance and they get notified.')}
        actions={<Button variant="secondary" icon={BuildingStorefrontIcon} href="/admin/resellers">{tr('الموزّعون', 'Resellers')}</Button>}
      />

      {isError ? <ErrorState onRetry={() => refetch()} /> : (
        <div className="space-y-5">
          <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
            <StatCard loading={isLoading} icon={BuildingStorefrontIcon} label={tr('موزّعون معتمدون', 'Approved resellers')} value={formatNumber(approved.length)} />
            <StatCard loading={isLoading} icon={ClockIcon} label={tr('إجمالي المعلّق', 'Total pending')} value={<span dir="ltr">{usd(totalPending)}</span>} subTone="warning"
              sub={tr(`${approved.filter(r => Number(r.balance_pending) > 0).length} موزّع لديه رصيد`, `${approved.filter(r => Number(r.balance_pending) > 0).length} with a balance`)} />
            <StatCard loading={isLoading} icon={CheckCircleIcon} label={tr('إجمالي المدفوع', 'Total paid')} value={<span dir="ltr">{usd(totalPaid)}</span>} subTone="success" sub={tr('منذ البداية', 'All time')} />
          </div>

          <div className="grid gap-5 lg:grid-cols-5">
            <Card padding="none" className="lg:col-span-3">
              <CardHeader className="px-5 pt-5 sm:px-6" title={tr('أرصدة الموزّعين', 'Reseller balances')} subtitle={tr('اختر «دفع» لتعبئة النموذج بالرصيد كاملًا', 'Choose “Pay” to fill the form with the full balance')} />
              <div className="mt-3">
                <DataTable rows={approved} loading={isLoading} rowKey={r => r.id} columns={cols} minWidth={520} caption={tr('أرصدة الموزّعين', 'Reseller balances')}
                  empty={<EmptyState size="sm" icon={BuildingStorefrontIcon} title={tr('لا يوجد موزّعون معتمدون بعد', 'No approved resellers yet')}
                    action={<Button size="sm" variant="secondary" href="/admin/resellers">{tr('مراجعة الطلبات', 'Review applications')}</Button>} />} />
              </div>
              {pendingRequests.length > 0 && (
                <div className="border-t border-line-soft px-5 py-4 sm:px-6">
                  <p className="mb-2 text-sm font-semibold text-ink">{tr('طلبات دفع معلّقة', 'Pending payout requests')}</p>
                  <ul className="space-y-2">
                    {pendingRequests.map(p => (
                      <li key={p.id} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2 text-sm">
                        <span className="min-w-0 flex-1 truncate text-ink">{p.reseller?.name || p.reseller?.email || p.reseller_id}</span>
                        <span className="tabular font-semibold" dir="ltr">{usd(p.amount)}</span>
                        <span className="hidden text-xs text-muted sm:inline">{fmtDate(p.created_at)}</span>
                        <Button size="xs" variant="ghost" onClick={() => { setForm(f => ({ ...f, reseller_id: p.reseller_id, amount: Number(p.amount).toFixed(2), method: p.method && (PAYOUT_METHODS as readonly string[]).includes(p.method) ? p.method : f.method })); setIdemKey(uuidv4()) }}>
                          {tr('استخدام', 'Use')}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>

            <Card className="space-y-4 lg:col-span-2 lg:self-start">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient text-[#04282C]"><BanknotesIcon className="h-5 w-5" aria-hidden="true" /></span>
                <h2 className="section-title">{tr('تسجيل دفعة', 'Record a payout')}</h2>
              </div>
              <Field label={tr('الموزّع', 'Reseller')} required>
                <Select value={form.reseller_id} onChange={e => setField('reseller_id', e.target.value)} placeholder={tr('اختر موزّعًا', 'Select a reseller')}
                  options={approved.map(r => ({ value: r.user_id, label: `${r.user?.name || r.user?.email} — ${usd(r.balance_pending || 0)}` }))} />
              </Field>
              <Field label={tr('المبلغ (دولار)', 'Amount (USD)')} required error={amountError || undefined}
                hint={selected ? tr(`الرصيد المعلّق: ${usd(balance)}`, `Pending balance: ${usd(balance)}`) : undefined}
                labelAction={selected && balance > 0 ? <button type="button" className="text-xs font-medium text-link hover:text-link-hover" onClick={() => setField('amount', balance.toFixed(2))}>{tr('الرصيد كاملًا', 'Full balance')}</button> : undefined}>
                <Input type="number" dir="ltr" step="0.01" min="0" max={selected ? balance : undefined} value={form.amount} onChange={e => setField('amount', e.target.value)} placeholder="0.00" startAdornment="$" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={tr('الطريقة', 'Method')}>
                  <Select value={form.method} onChange={e => setField('method', e.target.value)} options={PAYOUT_METHODS.map(m => ({ value: m, label: methodLabel(m) }))} />
                </Field>
                <Field label={tr('مرجع العملية', 'Reference')}>
                  <Input dir="ltr" value={form.reference} onChange={e => setField('reference', e.target.value)} placeholder="TXN-123456" maxLength={200} />
                </Field>
                <Field label={tr('بداية الفترة', 'Period start')} hint={tr('اختياري', 'Optional')}>
                  <Input type="date" dir="ltr" value={form.period_start} onChange={e => setField('period_start', e.target.value)} />
                </Field>
                <Field label={tr('نهاية الفترة', 'Period end')} hint={tr('اختياري', 'Optional')}>
                  <Input type="date" dir="ltr" value={form.period_end} onChange={e => setField('period_end', e.target.value)} />
                </Field>
              </div>
              <Notice tone="info" icon={ShieldCheckIcon}>
                {tr('كل محاولة تحمل مفتاح منع تكرار، فلا يُسجَّل المبلغ مرتين عند إعادة الإرسال.', 'Each attempt carries an idempotency key, so a retry never records the amount twice.')}
              </Notice>
              <Button fullWidth icon={CheckCircleIcon} disabled={!canSubmit} loading={payMut.isLoading} onClick={() => setConfirmOpen(true)}>{tr('تسجيل الدفعة', 'Record payout')}</Button>
            </Card>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        loading={payMut.isLoading}
        title={tr('تأكيد تسجيل الدفعة', 'Confirm payout')}
        description={selected ? tr(`تسجيل ${usd(amount)} عبر ${methodLabel(form.method)} إلى ${selected.user?.name || selected.user?.email}؟ سيُخصم من رصيده المعلّق.`,
          `Record ${usd(amount)} via ${methodLabel(form.method)} to ${selected.user?.name || selected.user?.email}? It is deducted from their pending balance.`) : undefined}
        confirmLabel={tr('تسجيل', 'Record')}
        onConfirm={submit}
      />
    </AdminLayout>
  )
}
