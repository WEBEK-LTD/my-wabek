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
  Badge, Button, Card, ConfirmDialog, DataTable, EmptyState, Field, Input, PageHeader, Select, Skeleton, Tabs, Tooltip, cn,
} from '@/components/ui'
import type { Column } from '@/components/ui'
import { useApiError, useAdminT, usd } from '@/components/admin/i18n'
import { CopyButton, ErrorState, Notice } from '@/components/admin/shared'
import { PlanEditor, type Plan } from '@/components/admin/plans/PlanEditor'
import messages from '@/locales/admin/plans'

interface Gift {
  id: string; code: string; duration_days: number; price: number; is_used: boolean; note?: string | null; created_at: string
  plan?: { name: string } | null; used_by_user?: { name: string | null; email: string } | null
}
interface SyncResult { plan: string; status: string; error?: string }

const GIFT_EMPTY = { plan_id: '', duration_days: 30, price: 0, note: '', quantity: 1 }

export default function AdminPlansPage() {
  const { t, tn, fmtDate, fmtNumber } = useAdminT(messages)
  const apiError = useApiError()
  const lim = (v: number | null | undefined) => (v === -1 ? '∞' : v == null ? '—' : fmtNumber(v))
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
      toast.success(tn('plansSynced', d.synced || 0, { n: d.synced || 0 }))
    },
    onError: e => void toast.error(apiError(e, t('syncFailed'))),
  })
  const saveMut = useMutation((body: Record<string, unknown>) => editor.plan ? axios.put(`/api/admin/plans/${editor.plan.id}`, body) : axios.post('/api/admin/plans', body), {
    onSuccess: () => {
      qc.invalidateQueries('admin-plans-full')
      toast.success(editor.plan ? t('planUpdated') : t('planCreated'))
      setEditor({ open: false, plan: null })
    },
    onError: e => void toast.error(apiError(e, t('saveFailed'))),
  })
  const delMut = useMutation((id: string) => axios.delete(`/api/admin/plans/${id}`), {
    onSuccess: () => { qc.invalidateQueries('admin-plans-full'); toast.success(t('planDeactivated')); setToDeactivate(null) },
    onError: e => void toast.error(apiError(e, t('couldNotDeactivatePlan'))),
  })
  const giftMut = useMutation((b: typeof GIFT_EMPTY) => axios.post('/api/admin/gifts', b).then(r => r.data), {
    onSuccess: d => {
      giftsQ.refetch()
      const codes = (d.gifts || []).map((g: Gift) => g.code).join('\n')
      navigator.clipboard?.writeText(codes).catch(() => {})
      toast.success(tn('codesCreated', d.gifts?.length || 0, { n: d.gifts?.length || 0 }))
      setGf(GIFT_EMPTY)
    },
    onError: e => void toast.error(apiError(e, t('couldNotCreateCodes'))),
  })

  const giftCols: Column<Gift>[] = [
    { key: 'code', header: t('code'), cell: g => <div className="flex items-center gap-1"><code dir="ltr" className="rounded-md bg-chip px-2 py-0.5 font-mono text-xs text-chip-ink">{g.code}</code><CopyButton text={g.code} label={t('copyCode')} /></div> },
    { key: 'plan', header: t('plan'), cell: g => g.plan?.name || '—' },
    { key: 'days', header: t('duration'), cell: g => <span className="tabular">{tn('dayCount', g.duration_days, { n: g.duration_days })}</span> },
    { key: 'price', header: t('price'), cell: g => g.price > 0 ? <span className="tabular" dir="ltr">{usd(g.price)}</span> : <Badge tone="brand" size="sm">{t('freeAlt')}</Badge> },
    { key: 'status', header: t('status'), cell: g => <Badge tone={g.is_used ? 'neutral' : 'success'} dot>{g.is_used ? t('used') : t('available')}</Badge> },
    { key: 'used', header: t('used2'), hideBelow: 'md', cell: g => g.used_by_user ? <div><p className="text-sm text-ink">{g.used_by_user.name}</p><p dir="ltr" className="text-start text-xs text-muted">{g.used_by_user.email}</p></div> : '—' },
    { key: 'created', header: t('created'), hideBelow: 'lg', cell: g => <div className="text-xs text-muted">{fmtDate(g.created_at)}{g.note && <p className="mt-0.5 text-2xs">{g.note}</p>}</div> },
  ]

  return (
    <AdminLayout title={t('plans')}>
      <PageHeader className="mb-6"
        eyebrow={t('billing')}
        title={t('plansGiftInvites')}
        description={t('setPricesLimitsFeatures')}
        actions={tab === 'plans' ? <>
          <Button variant="secondary" icon={ArrowPathIcon} loading={syncMut.isLoading} onClick={() => syncMut.mutate()}>{t('syncStripe')}</Button>
          <Button icon={PlusIcon} onClick={() => setEditor({ open: true, plan: null })}>{t('newPlan')}</Button>
        </> : undefined}
      >
        <Tabs idPrefix="plans" value={tab} onChange={setTab} tabs={[
          { id: 'plans', label: t('plans'), icon: CreditCardIcon, count: plans.length || undefined },
          { id: 'gifts', label: t('giftInvites'), icon: GiftIcon, count: gifts.length || undefined },
        ]} />
      </PageHeader>

      {tab === 'plans' && (
        <div className="space-y-5" role="tabpanel" id="plans-panel-plans" aria-labelledby="plans-tab-plans">
          {syncResults && syncResults.length > 0 && (
            <Notice tone={syncResults.some(r => r.status !== 'synced') ? 'warning' : 'success'} icon={syncResults.some(r => r.status !== 'synced') ? ExclamationTriangleIcon : CheckCircleIcon}
              title={t('stripeSyncResult')}>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {syncResults.map(r => <li key={r.plan}><Badge size="sm" tone={r.status === 'synced' ? 'success' : 'danger'}>{r.plan} · {r.status === 'synced' ? t('synced') : r.error || r.status}</Badge></li>)}
              </ul>
            </Notice>
          )}
          {plansQ.isError ? <ErrorState onRetry={() => plansQ.refetch()} /> : plansQ.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-72 rounded-card" />)}</div>
          ) : plans.length === 0 ? (
            <EmptyState variant="card" icon={CreditCardIcon} title={t('noActivePlans')}
              description={t('createFirstPlanShow')}
              action={<Button icon={PlusIcon} onClick={() => setEditor({ open: true, plan: null })}>{t('newPlan')}</Button>} />
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
                      <Tooltip content={t('edit')}><Button size="icon-sm" variant="ghost" icon={PencilSquareIcon} aria-label={t('edit2', { name: p.name })} onClick={() => setEditor({ open: true, plan: p })} /></Tooltip>
                      <Tooltip content={t('deactivate')}><Button size="icon-sm" variant="ghost" icon={TrashIcon} aria-label={t('deactivate2', { name: p.name })} onClick={() => setToDeactivate(p)} /></Tooltip>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1.5" dir="ltr">
                    <span className="tabular text-[32px] font-bold leading-none text-ink">{usd(p.price_monthly, Number(p.price_monthly) % 1 ? 2 : 0)}</span>
                    <span className="text-sm text-muted">/{t('mo')}</span>
                    {Number(p.price_yearly) > 0 && <Badge tone="brand" size="sm" className="ms-2">{usd(p.price_yearly, 0)}/{t('yr')}</Badge>}
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                    {[
                      { icon: ChatBubbleLeftRightIcon, v: lim(p.max_messages_month), k: t('msgsMo') },
                      { icon: UserGroupIcon, v: lim(p.max_contacts), k: t('contactsAlt') },
                      { icon: DevicePhoneMobileIcon, v: lim(p.max_instances), k: t('numbers') },
                      { icon: MegaphoneIcon, v: lim(p.max_campaigns), k: t('campaignsAlt') },
                      { icon: CpuChipIcon, v: lim(p.max_chatbot_flows), k: t('bots') },
                      { icon: SparklesIcon, v: lim(p.max_ai_replies ?? 0), k: t('aiMo') },
                      { icon: UsersIcon, v: lim(p.max_team_members ?? 1), k: t('agents') },
                    ].map(x => (
                      <div key={x.k} className="flex items-center gap-1.5 text-muted">
                        <x.icon className="h-4 w-4 shrink-0 text-brand-ink" aria-hidden="true" />
                        <dd className="tabular font-semibold text-ink">{x.v}</dd><dt className="truncate text-xs">{x.k}</dt>
                      </div>
                    ))}
                  </dl>
                  <div className="flex flex-wrap gap-1.5">
                    {p.allow_api_access && <Badge size="sm">API</Badge>}
                    {p.allow_ai && <Badge size="sm" tone="violet">{t('ai')}</Badge>}
                    {p.allow_white_label && <Badge size="sm">{t('whiteLabel')}</Badge>}
                    {p.allow_sub_accounts && <Badge size="sm">{t('subAccounts', { v: p.max_sub_accounts ?? 0 })}</Badge>}
                    {p.allow_reseller && <Badge size="sm">{t('resellerAlt')}</Badge>}
                    {p.allow_gift_invites && <Badge size="sm" tone="warning" icon={GiftIcon}>{t('giftsMo', { v: p.invite_credits ?? 0 })}</Badge>}
                  </div>
                  <div className="mt-auto flex items-center justify-between border-t border-line-soft pt-3">
                    <Badge tone={p.is_active ? 'success' : 'neutral'} dot>{p.is_active ? t('activeAlt') : t('inactive')}</Badge>
                    {Number(p.price_monthly) === 0 ? <span className="text-xs text-muted">{t('freeNoStripeNeeded')}</span>
                      : <Badge tone={p.stripe_price_id_monthly ? 'brand' : 'warning'} size="sm" icon={p.stripe_price_id_monthly ? CheckCircleIcon : ExclamationTriangleIcon}>
                          {p.stripe_price_id_monthly ? t('stripeSynced') : t('notSynced')}
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
                <h2 className="section-title">{t('generateGiftCodes')}</h2>
                <p className="text-xs text-muted">{t('codeActivatesPlanSet')}</p>
              </div>
            </div>
            <Field label={t('plan')} required>
              <Select value={gf.plan_id} onChange={e => setGf(p => ({ ...p, plan_id: e.target.value }))} placeholder={t('selectPlan')}
                options={plans.map(p => ({ value: p.id, label: `${p.name} ($${p.price_monthly}/${t('mo')})` }))} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label={t('days2')}><Input type="number" dir="ltr" min={1} value={gf.duration_days} onChange={e => setGf(p => ({ ...p, duration_days: parseInt(e.target.value) || 30 }))} /></Field>
              <Field label={t('price2')} hint={t('n0Free')}><Input type="number" dir="ltr" min={0} step={0.01} value={gf.price} onChange={e => setGf(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))} /></Field>
              <Field label={t('qty')} hint={t('max50')}><Input type="number" dir="ltr" min={1} max={50} value={gf.quantity} onChange={e => setGf(p => ({ ...p, quantity: Math.min(50, parseInt(e.target.value) || 1) }))} /></Field>
            </div>
            <Field label={t('internalNote')}><Input value={gf.note} onChange={e => setGf(p => ({ ...p, note: e.target.value }))} placeholder={t('eGRamadanPromotion')} /></Field>
            <Button fullWidth icon={GiftIcon} loading={giftMut.isLoading} disabled={!gf.plan_id} onClick={() => giftMut.mutate(gf)}>
              {tn('generateCodes', gf.quantity, { n: gf.quantity })}
            </Button>
          </Card>

          <Card padding="none" className="xl:col-span-2">
            <div className="flex items-center justify-between px-5 pb-2 pt-5 sm:px-6">
              <h2 className="section-title">{t('allCodes')}</h2>
              <Badge tone="neutral" className="tabular">{fmtNumber(gifts.length)}</Badge>
            </div>
            {giftsQ.isError ? <div className="p-4"><ErrorState onRetry={() => giftsQ.refetch()} /></div> : (
              <DataTable rows={gifts} loading={giftsQ.isLoading} rowKey={g => g.id} columns={giftCols} minWidth={640} caption={t('giftCodes')}
                empty={<EmptyState size="sm" icon={GiftIcon} title={t('noGiftCodesYet')} description={t('generateCodesForm')} />} />
            )}
          </Card>
        </div>
      )}

      <PlanEditor open={editor.open} plan={editor.plan} onClose={() => setEditor({ open: false, plan: null })} saving={saveMut.isLoading} onSave={b => saveMut.mutate(b)} />
      <ConfirmDialog cancelLabel={t('cancel')}
        open={!!toDeactivate}
        destructive
        onClose={() => setToDeactivate(null)}
        loading={delMut.isLoading}
        title={t('deactivatePlan')}
        description={t('disappearsPricingNobodyCan')}
        confirmLabel={t('deactivate')}
        onConfirm={() => { if (toDeactivate) delMut.mutate(toDeactivate.id) }}
      />
    </AdminLayout>
  )
}
