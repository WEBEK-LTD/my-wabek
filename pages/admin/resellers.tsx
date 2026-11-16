import React, { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  BanknotesIcon, BuildingStorefrontIcon, CalendarDaysIcon, CheckCircleIcon, ClockIcon, CreditCardIcon, DocumentTextIcon, XCircleIcon,
} from '@heroicons/react/24/outline'
import {
  Avatar, Badge, Button, Card, ConfirmDialog, DataTable, EmptyState, Input, Modal, PageHeader, Skeleton, StatCard, Tabs, Tooltip,
} from '@/components/ui'
import type { Column } from '@/components/ui'
import { apiError, useAdminT, usd } from '@/components/admin/i18n'
import { ErrorState, JsonViewer } from '@/components/admin/shared'
import { RESELLER_KEYS, useResellers, type ResellerProfile } from '@/components/admin/resellers/types'
import messages from '@/locales/admin/resellers'

type Patch = { user_id: string; is_approved?: boolean; commission_pct?: number }

function CommissionEditor({ value, onSave, saving, label }: { value: number; onSave: (v: number) => void; saving: boolean; label: string }) {
  const { t } = useAdminT(messages)
  const [v, setV] = useState(String(value))
  useEffect(() => { setV(String(value)) }, [value])
  const num = parseFloat(v)
  const valid = Number.isFinite(num) && num >= 0 && num <= 100
  const dirty = valid && num !== value
  return (
    <div className="flex items-center gap-1.5">
      <Input size="sm" type="number" dir="ltr" min={0} max={100} step={0.5} value={v} onChange={e => setV(e.target.value)} invalid={!valid}
        aria-label={label} wrapperClassName="w-24" endAdornment={<span className="text-xs text-muted">%</span>}
        onKeyDown={e => { if (e.key === 'Enter' && dirty) onSave(num) }} />
      {dirty && <Button size="xs" loading={saving} onClick={() => onSave(num)}>{t('save')}</Button>}
    </div>
  )
}

export default function AdminResellersPage() {
  const { t, fmtDate, fmtNumber } = useAdminT(messages)
  const qc = useQueryClient()
  const [tab, setTab] = useState('pending')
  const [commission, setCommission] = useState<Record<string, string>>({})
  const [confirm, setConfirm] = useState<null | { r: ResellerProfile; kind: 'reject' | 'revoke' }>(null)
  const [details, setDetails] = useState<ResellerProfile | null>(null)

  const { data, isLoading, isError, refetch } = useResellers('admin-resellers')
  const resellers = data?.resellers || []
  const pending = resellers.filter(r => !r.is_approved)
  const approved = resellers.filter(r => r.is_approved)
  const pendingBalance = approved.reduce((s, r) => s + (Number(r.balance_pending) || 0), 0)

  const mut = useMutation((body: Patch & { msg: string }) => {
    const { msg, ...payload } = body
    void msg
    return axios.patch('/api/admin/payouts', payload)
  }, {
    onSuccess: (_, vars) => { RESELLER_KEYS.forEach(k => qc.invalidateQueries(k)); toast.success(vars.msg); setConfirm(null) },
    onError: e => { toast.error(apiError(e, t('updateFailed'))) },
  })

  const name = (r: ResellerProfile) => r.user?.name || r.user?.email || t('unknown')
  const commissionFor = (r: ResellerProfile) => commission[r.user_id] ?? '10'
  const validPct = (s: string) => { const n = parseFloat(s); return Number.isFinite(n) && n >= 0 && n <= 100 }

  const cols: Column<ResellerProfile>[] = [
    {
      key: 'r', header: t('reseller'),
      cell: r => <div className="flex items-center gap-3"><Avatar name={name(r)} size="sm" /><div className="min-w-0"><p className="truncate font-medium text-ink">{r.user?.name || '—'}</p><p dir="ltr" className="truncate text-start text-xs text-muted">{r.user?.email}</p></div></div>,
    },
    {
      key: 'pct', header: t('commission'),
      cell: r => <CommissionEditor value={Number(r.referral_commission_pct) || 0} saving={mut.isLoading} label={t('commission2', { r: name(r) })}
        onSave={v => mut.mutate({ user_id: r.user_id, commission_pct: v, msg: t('commissionUpdated') })} />,
    },
    { key: 'pending', header: t('pending'), align: 'end', cell: r => <span className="tabular font-semibold text-warning" dir="ltr">{usd(r.balance_pending || 0)}</span> },
    { key: 'paid', header: t('paid'), align: 'end', hideBelow: 'sm', cell: r => <span className="tabular text-success" dir="ltr">{usd(r.balance_paid || 0)}</span> },
    { key: 'total', header: t('allTime'), align: 'end', hideBelow: 'md', cell: r => <span className="tabular text-ink" dir="ltr">{usd(r.balance_total || 0)}</span> },
    { key: 'approved', header: t('approved'), hideBelow: 'lg', cell: r => <span className="text-xs text-muted">{fmtDate(r.approved_at)}</span> },
    {
      key: 'a', header: <span className="sr-only">{t('actions')}</span>, align: 'end',
      cell: r => (
        <div className="flex justify-end gap-1.5">
          <Button size="xs" variant="secondary" icon={BanknotesIcon} href={`/admin/payouts?reseller=${r.user_id}`} disabled={!(Number(r.balance_pending) > 0)}>{t('pay')}</Button>
          <Button size="xs" variant="danger-soft" onClick={() => setConfirm({ r, kind: 'revoke' })}>{t('revoke')}</Button>
        </div>
      ),
    },
  ]

  return (
    <AdminLayout title={t('resellers')}>
      <PageHeader className="mb-6"
        eyebrow={t('resellers')}
        title={t('resellerManagement')}
        description={t('reviewApplicationsApproveThem')}
        actions={<Button variant="secondary" icon={BanknotesIcon} href="/admin/payouts">{t('payouts')}</Button>}
      >
        <Tabs idPrefix="resellers" value={tab} onChange={setTab} tabs={[
          { id: 'pending', label: t('pendingReview'), icon: ClockIcon, count: pending.length },
          { id: 'approved', label: t('approved2'), icon: CheckCircleIcon, count: approved.length },
        ]} />
      </PageHeader>

      {isError ? <ErrorState onRetry={() => refetch()} /> : (
        <div className="space-y-5">
          <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
            <StatCard loading={isLoading} icon={BuildingStorefrontIcon} label={t('totalResellers')} value={fmtNumber(resellers.length)} />
            <StatCard loading={isLoading} icon={ClockIcon} label={t('pendingReview')} value={fmtNumber(pending.length)} subTone={pending.length ? 'warning' : 'muted'}
              sub={pending.length ? t('needDecision') : t('nothingPending')} />
            <StatCard loading={isLoading} icon={CheckCircleIcon} label={t('approved3')} value={fmtNumber(approved.length)} />
            <StatCard loading={isLoading} icon={BanknotesIcon} label={t('balancesDue')} value={<span dir="ltr">{usd(pendingBalance)}</span>} href="/admin/payouts" />
          </div>

          {tab === 'pending' && (
            <div role="tabpanel" id="resellers-panel-pending" aria-labelledby="resellers-tab-pending" className="space-y-3">
              {isLoading ? [0, 1].map(i => <Skeleton key={i} className="h-28 rounded-card" />) : pending.length === 0 ? (
                <EmptyState variant="card" icon={CheckCircleIcon} title={t('noPendingApplications')}
                  description={t('newResellerApplicationsShow')}
                  action={<Button variant="secondary" size="sm" onClick={() => setTab('approved')}>{t('viewApproved')}</Button>} />
              ) : pending.map(r => {
                const pct = commissionFor(r)
                return (
                  <Card key={r.id} className="flex flex-col gap-4 lg:flex-row lg:items-center">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <Avatar name={name(r)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-ink">{name(r)}</p>
                          <Badge tone="warning" size="sm" dot>{t('pending2')}</Badge>
                        </div>
                        <p dir="ltr" className="text-start text-sm text-muted">{r.user?.email}</p>
                        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                          <div className="flex items-center gap-1"><CreditCardIcon className="h-3.5 w-3.5" aria-hidden="true" /><dt>{t('payment')}</dt><dd className="text-body">{r.payment_method || 'platform'}</dd></div>
                          <div className="flex items-center gap-1"><CalendarDaysIcon className="h-3.5 w-3.5" aria-hidden="true" /><dt>{t('schedule')}</dt><dd className="text-body">{r.payout_schedule || 'monthly'}</dd></div>
                          <div className="flex items-center gap-1"><BanknotesIcon className="h-3.5 w-3.5" aria-hidden="true" /><dt>{t('payoutVia')}</dt><dd className="text-body">{r.payout_method || '—'}</dd></div>
                          <div className="flex items-center gap-1"><ClockIcon className="h-3.5 w-3.5" aria-hidden="true" /><dt>{t('applied')}</dt><dd className="text-body">{fmtDate(r.created_at)}</dd></div>
                        </dl>
                        {!!r.payout_details && typeof r.payout_details === 'object' && Object.keys(r.payout_details as object).length > 0 && (
                          <Button size="xs" variant="ghost" icon={DocumentTextIcon} className="mt-1 -ms-2" onClick={() => setDetails(r)}>{t('payoutDetails')}</Button>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <Input size="sm" type="number" dir="ltr" min={0} max={100} step={0.5} value={pct} invalid={!validPct(pct)}
                        onChange={e => setCommission(p => ({ ...p, [r.user_id]: e.target.value }))}
                        aria-label={t('commissionRate')} wrapperClassName="w-28" endAdornment={<span className="text-xs text-muted">%</span>} />
                      <Button size="sm" icon={CheckCircleIcon} disabled={!validPct(pct)} loading={mut.isLoading}
                        onClick={() => mut.mutate({ user_id: r.user_id, is_approved: true, commission_pct: parseFloat(pct), msg: t('resellerApproved') })}>
                        {t('approve')}
                      </Button>
                      <Tooltip content={t('reject')}>
                        <Button size="icon-sm" variant="ghost" icon={XCircleIcon} aria-label={t('reject2', { r: name(r) })} onClick={() => setConfirm({ r, kind: 'reject' })} />
                      </Tooltip>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}

          {tab === 'approved' && (
            <Card padding="none" role="tabpanel" id="resellers-panel-approved" aria-labelledby="resellers-tab-approved">
              <DataTable rows={approved} loading={isLoading} rowKey={r => r.id} columns={cols} minWidth={760} caption={t('approvedResellers')}
                empty={<EmptyState size="sm" icon={BuildingStorefrontIcon} title={t('noApprovedResellersYet')} />} />
            </Card>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        destructive
        onClose={() => setConfirm(null)}
        loading={mut.isLoading}
        title={confirm?.kind === 'reject' ? t('rejectApplication') : t('revokeReseller')}
        description={confirm ? (confirm.kind === 'reject'
          ? t('wonTAbleUse', { r: name(confirm.r) })
          : t('losesResellerAccessExisting', { r: name(confirm.r) })) : undefined}
        confirmLabel={confirm?.kind === 'reject' ? t('reject') : t('revoke')}
        onConfirm={() => { if (confirm) mut.mutate({ user_id: confirm.r.user_id, is_approved: false, msg: confirm.kind === 'reject' ? t('applicationRejected') : t('resellerRevoked') }) }}
      />

      <Modal open={!!details} onClose={() => setDetails(null)} title={t('payoutDetails')} description={details ? name(details) : undefined} icon={DocumentTextIcon}>
        {details && <JsonViewer value={details.payout_details} />}
      </Modal>
    </AdminLayout>
  )
}
