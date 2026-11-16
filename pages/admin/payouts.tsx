import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '@/components/layout/AdminLayout'
import { useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'
import { BanknotesIcon, BuildingStorefrontIcon, CheckCircleIcon, ClockIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'
import {
  Avatar, Button, Card, CardHeader, ConfirmDialog, DataTable, EmptyState, Field, Input, PageHeader, Select, StatCard,
} from '@/components/ui'
import type { Column } from '@/components/ui'
import { useApiError, useAdminT, useEnumLabel, usd } from '@/components/admin/i18n'
import { ErrorState, Notice } from '@/components/admin/shared'
import { PAYOUT_METHODS, RESELLER_KEYS, useResellers, type ResellerProfile } from '@/components/admin/resellers/types'
import messages from '@/locales/admin/payouts'

const EMPTY = { reseller_id: '', amount: '', method: 'bank_transfer', reference: '', period_start: '', period_end: '' }

export default function AdminPayoutsPage() {
  const { t, fmtDate, fmtNumber } = useAdminT(messages)
  const apiError = useApiError()
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
    : !Number.isFinite(amount) || amount <= 0 ? t('enterAmountGreaterThan')
    : selected && amount > balance ? t('amountExceedsPendingBalance', { balance: usd(balance) })
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
      toast.success(d?.duplicate ? t('payoutWasAlreadyRecorded') : t('payoutRecorded'))
      setForm(EMPTY)
      setIdemKey(uuidv4())
      setConfirmOpen(false)
    },
    onError: e => { toast.error(apiError(e, t('couldNotRecordPayout'))); setConfirmOpen(false) },
  })

  const submit = () => {
    if (!canSubmit) { toast.error(t('selectResellerEnterValid')); return }
    payMut.mutate({
      reseller_id: form.reseller_id, amount, method: form.method, reference: form.reference || undefined,
      period_start: form.period_start || undefined, period_end: form.period_end || undefined, idempotency_key: idemKey,
    })
  }

  const enumLabel = useEnumLabel()
  const methodLabel = (m: string) => enumLabel('payout', m)

  const cols: Column<ResellerProfile>[] = [
    {
      key: 'r', header: t('reseller'),
      cell: r => <div className="flex items-center gap-2.5"><Avatar name={r.user?.name || r.user?.email || '?'} size="sm" /><div className="min-w-0"><p className="truncate text-sm font-medium text-ink">{r.user?.name || '—'}</p><p dir="ltr" className="truncate text-start text-xs text-muted">{r.user?.email}</p></div></div>,
    },
    { key: 'p', header: t('pending'), align: 'end', cell: r => <span className="tabular font-semibold text-warning" dir="ltr">{usd(r.balance_pending || 0)}</span> },
    { key: 'paid', header: t('paid'), align: 'end', hideBelow: 'sm', cell: r => <span className="tabular text-success" dir="ltr">{usd(r.balance_paid || 0)}</span> },
    { key: 't', header: t('total'), align: 'end', hideBelow: 'md', cell: r => <span className="tabular" dir="ltr">{usd(r.balance_total || 0)}</span> },
    {
      key: 'a', header: <span className="sr-only">{t('actions')}</span>, align: 'end',
      cell: r => <Button size="xs" variant={form.reseller_id === r.user_id ? 'primary' : 'secondary'} icon={BanknotesIcon} disabled={!(Number(r.balance_pending) > 0)} onClick={() => prefill(r)}>{t('pay')}</Button>,
    },
  ]

  return (
    <AdminLayout title={t('resellerPayouts')}>
      <PageHeader className="mb-6"
        eyebrow={t('resellers')}
        title={t('resellerPayouts')}
        description={t('recordTransfersYouSent')}
        actions={<Button variant="secondary" icon={BuildingStorefrontIcon} href="/admin/resellers">{t('resellers')}</Button>}
      />

      {isError ? <ErrorState onRetry={() => refetch()} /> : (
        <div className="space-y-5">
          <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
            <StatCard loading={isLoading} icon={BuildingStorefrontIcon} label={t('approvedResellers')} value={fmtNumber(approved.length)} />
            <StatCard loading={isLoading} icon={ClockIcon} label={t('totalPending')} value={<span dir="ltr">{usd(totalPending)}</span>} subTone="warning"
              sub={t('balance', { v: approved.filter(r => Number(r.balance_pending) > 0).length })} />
            <StatCard loading={isLoading} icon={CheckCircleIcon} label={t('totalPaid')} value={<span dir="ltr">{usd(totalPaid)}</span>} subTone="success" sub={t('allTime')} />
          </div>

          <div className="grid gap-5 lg:grid-cols-5">
            <Card padding="none" className="lg:col-span-3">
              <CardHeader className="px-5 pt-5 sm:px-6" title={t('resellerBalances')} subtitle={t('choosePayFillForm')} />
              <div className="mt-3">
                <DataTable rows={approved} loading={isLoading} rowKey={r => r.id} columns={cols} minWidth={520} caption={t('resellerBalances')}
                  empty={<EmptyState size="sm" icon={BuildingStorefrontIcon} title={t('noApprovedResellersYet')}
                    action={<Button size="sm" variant="secondary" href="/admin/resellers">{t('reviewApplications')}</Button>} />} />
              </div>
              {pendingRequests.length > 0 && (
                <div className="border-t border-line-soft px-5 py-4 sm:px-6">
                  <p className="mb-2 text-sm font-semibold text-ink">{t('pendingPayoutRequests')}</p>
                  <ul className="space-y-2">
                    {pendingRequests.map(p => (
                      <li key={p.id} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2 text-sm">
                        <span className="min-w-0 flex-1 truncate text-ink">{p.reseller?.name || p.reseller?.email || p.reseller_id}</span>
                        <span className="tabular font-semibold" dir="ltr">{usd(p.amount)}</span>
                        <span className="hidden text-xs text-muted sm:inline">{fmtDate(p.created_at)}</span>
                        <Button size="xs" variant="ghost" onClick={() => { setForm(f => ({ ...f, reseller_id: p.reseller_id, amount: Number(p.amount).toFixed(2), method: p.method && (PAYOUT_METHODS as readonly string[]).includes(p.method) ? p.method : f.method })); setIdemKey(uuidv4()) }}>
                          {t('use')}
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
                <h2 className="section-title">{t('recordPayout')}</h2>
              </div>
              <Field label={t('reseller')} required>
                <Select value={form.reseller_id} onChange={e => setField('reseller_id', e.target.value)} placeholder={t('selectReseller')}
                  options={approved.map(r => ({ value: r.user_id, label: `${r.user?.name || r.user?.email} — ${usd(r.balance_pending || 0)}` }))} />
              </Field>
              <Field label={t('amountUsd')} required error={amountError || undefined}
                hint={selected ? t('pendingBalance', { balance: usd(balance) }) : undefined}
                labelAction={selected && balance > 0 ? <button type="button" className="text-xs font-medium text-link hover:text-link-hover" onClick={() => setField('amount', balance.toFixed(2))}>{t('fullBalance')}</button> : undefined}>
                <Input type="number" dir="ltr" step="0.01" min="0" max={selected ? balance : undefined} value={form.amount} onChange={e => setField('amount', e.target.value)} placeholder="0.00" startAdornment="$" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t('method')}>
                  <Select value={form.method} onChange={e => setField('method', e.target.value)} options={PAYOUT_METHODS.map(m => ({ value: m, label: methodLabel(m) }))} />
                </Field>
                <Field label={t('reference')}>
                  <Input dir="ltr" value={form.reference} onChange={e => setField('reference', e.target.value)} placeholder="TXN-123456" maxLength={200} />
                </Field>
                <Field label={t('periodStart')} hint={t('optional')}>
                  <Input type="date" dir="ltr" value={form.period_start} onChange={e => setField('period_start', e.target.value)} />
                </Field>
                <Field label={t('periodEnd')} hint={t('optional')}>
                  <Input type="date" dir="ltr" value={form.period_end} onChange={e => setField('period_end', e.target.value)} />
                </Field>
              </div>
              <Notice tone="info" icon={ShieldCheckIcon}>
                {t('eachAttemptCarriesIdempotency')}
              </Notice>
              <Button fullWidth icon={CheckCircleIcon} disabled={!canSubmit} loading={payMut.isLoading} onClick={() => setConfirmOpen(true)}>{t('recordPayout2')}</Button>
            </Card>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        loading={payMut.isLoading}
        title={t('confirmPayout')}
        description={selected ? t('recordViaDeductedTheir', { amount: usd(amount), method: methodLabel(form.method), v: selected.user?.name || selected.user?.email }) : undefined}
        confirmLabel={t('record')}
        onConfirm={submit}
      />
    </AdminLayout>
  )
}
