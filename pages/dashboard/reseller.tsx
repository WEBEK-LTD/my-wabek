// @ts-nocheck
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  PlusIcon, TrashIcon, CheckIcon, CurrencyDollarIcon, UserGroupIcon, LinkIcon, BanknotesIcon,
  ChartPieIcon, CubeIcon, MegaphoneIcon, Cog6ToothIcon, GiftIcon, ClockIcon, RocketLaunchIcon,
  ArrowRightIcon, BuildingLibraryIcon, CreditCardIcon, ArrowsRightLeftIcon, ShieldCheckIcon, BookOpenIcon,
  PaperAirplaneIcon, CalendarDaysIcon,
} from '@heroicons/react/24/outline'
import {
  Avatar, Badge, Button, Card, CardHeader, ConfirmDialog, EmptyState, Field, Input, Modal, PageHeader,
  Select, Skeleton, StatCard, StatusPill, Table, TBody, TD, TH, THead, TR, Tabs, Textarea, Tooltip, buttonClasses, cn,
} from '@/components/ui'
import { CopyButton, CopyField, Notice, PlanGate, SectionTitle, apiError, rich } from '@/components/settings/Shared'
import { fmtMoney } from '@/components/settings/format'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/dashboard/reseller'

// Labels below are keys of locales/dashboard/reseller.ts.
const PAYOUT_METHODS = [
  { value: 'bank_transfer', label: 'pm_bank_transfer' },
  { value: 'paypal', label: 'pm_paypal' },
  { value: 'wise', label: 'pm_wise' },
  { value: 'crypto', label: 'pm_crypto' },
]

const PAYOUT_SCHEDULES = [
  { value: 'weekly', label: 'sch_weekly' },
  { value: 'biweekly', label: 'sch_biweekly' },
  { value: 'monthly', label: 'sch_monthly' },
]
const SCHEDULE_LABEL = Object.fromEntries(PAYOUT_SCHEDULES.map(s => [s.value, s.label]))

// Label `pay_<value>`, description `pay_<value>_desc`.
const PAYMENT_OPTIONS = [
  { value: 'platform', icon: BuildingLibraryIcon },
  { value: 'stripe_own', icon: CreditCardIcon },
  { value: 'both', icon: ArrowsRightLeftIcon },
]

// `label` and `phKey` are dictionary keys; `ph` is a literal (Latin) placeholder.
const PAYOUT_FIELDS = {
  bank_transfer: [
    { k: 'bank_name', label: 'f_bank_name', ph: 'HSBC' },
    { k: 'account_name', label: 'f_account_name', phKey: 'f_account_name_ph' },
    { k: 'iban', label: 'f_iban', ph: 'GB29 NWBK 6016 1331 9268 19', ltr: true },
    { k: 'swift', label: 'f_swift', ph: 'NWBKGB2L', ltr: true },
    { k: 'country', label: 'f_country', phKey: 'f_country_ph' },
  ],
  paypal: [{ k: 'email', label: 'f_paypal_email', ph: 'your@paypal.com', ltr: true, type: 'email' }],
  wise: [
    { k: 'email', label: 'f_wise_email', ph: 'your@wise.com', ltr: true },
    { k: 'account_id', label: 'f_wise_account', ph: 'Pxxxx', ltr: true },
  ],
  crypto: [
    { k: 'network', label: 'f_network', ph: 'TRC20 / ERC20 / BEP20', ltr: true },
    { k: 'address', label: 'f_address', ph: 'T...', ltr: true, mono: true },
    { k: 'currency', label: 'f_currency', ph: 'USDT / BTC / ETH', ltr: true },
  ],
}

// Referral / campaign / payout status → `st_<status>`.
const STATUSES = ['active', 'inactive', 'completed', 'sending', 'scheduled', 'failed', 'paid', 'processing', 'pending', 'cancelled']

const money = (n) => fmtMoney(Number(n || 0))

export default function ResellerPage() {
  return <PlanGate feature="allow_reseller"><ResellerContent /></PlanGate>
}

function ResellerContent() {
  const { t, fmtDate } = useT(messages)
  const statusLabel = (s) => (STATUSES.includes(s) ? t(`st_${s}`) : s)
  const scheduleLabel = (s) => t(SCHEDULE_LABEL[s] || 'sch_monthly')
  const qc = useQueryClient()
  const router = useRouter()
  const [tab, setTab] = useState(router.query.tab as string || 'overview')
  useEffect(() => { if (router.query.tab) setTab(router.query.tab as string) }, [router.query.tab])

  // Handle Stripe Connect callback
  useEffect(() => {
    if (router.query.success === 'stripe_connected') {
      toast.success(t('stripeConnected'))
      router.replace('/dashboard/reseller?tab=settings', undefined, { shallow: true })
    }
    if (router.query.error) {
      const errors = ['stripe_denied', 'expired', 'stripe_error', 'server_error']
      const code = router.query.error as string
      toast.error(errors.includes(code) ? t(`err_${code}`) : t('connectError'))
      router.replace('/dashboard/reseller?tab=settings', undefined, { shallow: true })
    }
  }, [router.query])
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [showPlanForm, setShowPlanForm] = useState(false)
  const [inviteForm, setInviteForm] = useState({ label: '', reseller_plan_id: '', trial_days: 14, discount_pct: 0, max_uses: '', custom_code: '' })
  const [planForm, setPlanForm] = useState({ base_plan_id: '', custom_name: '', custom_price_monthly: '', custom_price_yearly: '' })
  const [profileForm, setProfileForm] = useState(null)
  const [giftCode, setGiftCode] = useState('')
  const [toDeleteInvite, setToDeleteInvite] = useState(null)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const redeemGiftMut = useMutation(
    (code: string) => axios.post('/api/billing/redeem-gift', { code }).then(r => r.data),
    {
      onSuccess: (r) => {
        toast.success(t('giftActivated', { plan: r.plan, days: r.duration_days }))
        qc.invalidateQueries('reseller-profile')
        setGiftCode('')
      },
      onError: (e: any) => toast.error(e?.response?.status === 404 ? t('giftInvalid') : apiError(e, t('giftInvalid'))),
    }
  )

  const { data: profileData, isLoading } = useQuery('reseller-profile', () => axios.get('/api/reseller/profile').then(r => r.data), {
    onSuccess: (d) => { if (!profileForm && d.profile) setProfileForm(d.profile) }
  })
  const { data: plansData, isLoading: plansLoading } = useQuery('reseller-plans', () => axios.get('/api/reseller/plans').then(r => r.data))
  const { data: invitesData, isLoading: invitesLoading } = useQuery('reseller-invites', () => axios.get('/api/reseller/invites').then(r => r.data))
  const { data: campData, refetch: refetchCamp } = useQuery('reseller-campaigns', () => axios.get('/api/reseller/campaigns').then(r => r.data))

  const profile = profileData?.profile
  const referrals = profileData?.referrals || []
  const payouts = profileData?.payouts || []
  const plans = plansData?.plans || []
  const basePlans = plansData?.basePlans || []
  const invites = invitesData?.invites || []
  const campInstances = campData?.instances || []
  const campaigns = campData?.campaigns || []
  const referralCount = campData?.referral_count || 0
  const [campForm, setCampForm] = useState({ instance_id: '', message: '', target: 'all', scheduled_at: '', delay_seconds: 3 })
  const [showCampForm, setShowCampForm] = useState(false)

  const sendCampMut = useMutation(
    body => axios.post('/api/reseller/campaigns', body).then(r => r.data),
    {
      onSuccess: r => {
        refetchCamp()
        setShowCampForm(false)
        setCampForm({ instance_id: '', message: '', target: 'all', scheduled_at: '', delay_seconds: 3 })
        toast.success(t('campaignSent', { n: r.target_count }))
      },
      onError: e => toast.error(apiError(e, t('sendError'))),
    }
  )

  const saveProfileMut = useMutation(
    (body) => axios.put('/api/reseller/profile', body),
    { onSuccess: () => { qc.invalidateQueries('reseller-profile'); toast.success(t('settingsSaved')) }, onError: e => toast.error(apiError(e, t('saveError'))) }
  )

  const createPlanMut = useMutation(
    (body) => axios.post('/api/reseller/plans', body),
    { onSuccess: () => { qc.invalidateQueries('reseller-plans'); setShowPlanForm(false); toast.success(t('planCreated')) }, onError: e => toast.error(apiError(e, t('planError'))) }
  )

  const createInviteMut = useMutation(
    (body) => axios.post('/api/reseller/invites', body),
    {
      onSuccess: (r) => {
        qc.invalidateQueries('reseller-invites')
        setShowInviteForm(false)
        setInviteForm({ label: '', reseller_plan_id: '', trial_days: 14, discount_pct: 0, max_uses: '', custom_code: '' })
        navigator.clipboard.writeText(r.data.url).catch(() => {})
        toast.success(t('inviteCreated'))
      },
      onError: e => toast.error(apiError(e, t('inviteError')))
    }
  )

  const deleteInviteMut = useMutation(
    id => axios.delete(`/api/reseller/invites/${id}`),
    { onSuccess: () => { qc.invalidateQueries('reseller-invites'); setToDeleteInvite(null); toast.success(t('inviteDeleted')) } }
  )

  const disconnectStripe = () => {
    setDisconnecting(true)
    axios.post('/api/reseller/stripe-connect/disconnect')
      .then(() => { qc.invalidateQueries('reseller-profile'); toast.success(t('stripeDisconnected')) })
      .catch(e => toast.error(apiError(e, t('disconnectError'))))
      .finally(() => { setDisconnecting(false); setConfirmDisconnect(false) })
  }

  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://waabek.com'
  const locked = profile && !profile.is_approved && tab !== 'overview' && tab !== 'settings'
  const selectedBase = basePlans.find(p => p.id === planForm.base_plan_id)
  const profit = planForm.custom_price_monthly && selectedBase ? parseFloat(planForm.custom_price_monthly) - (selectedBase.price_monthly || 0) : null
  const method = profileForm?.payout_method || 'bank_transfer'
  const details = typeof profileForm?.payout_details === 'object' && profileForm?.payout_details ? profileForm.payout_details : {}
  const setDetail = (k: string, v: string) =>
    setProfileForm(f => ({ ...f, payout_details: { ...(typeof f?.payout_details === 'object' ? f.payout_details : {}), [k]: v } }))
  const showStripe = profileForm?.payment_method === 'stripe_own' || profileForm?.payment_method === 'both'
  const showPayout = profileForm?.payment_method === 'platform' || profileForm?.payment_method === 'both'

  const tabs = [
    { id: 'overview', label: t('tab_overview'), icon: ChartPieIcon },
    { id: 'plans', label: t('tab_plans'), icon: CubeIcon, count: plans.length || undefined },
    { id: 'invites', label: t('tab_invites'), icon: LinkIcon, count: invites.length || undefined },
    { id: 'referrals', label: t('tab_referrals'), icon: UserGroupIcon, count: referrals.length || undefined },
    { id: 'campaigns', label: t('tab_campaigns'), icon: MegaphoneIcon },
    { id: 'payouts', label: t('tab_payouts'), icon: BanknotesIcon },
    { id: 'settings', label: t('tab_settings'), icon: Cog6ToothIcon },
  ]

  const changeTab = (id) => { setTab(id); router.replace({ pathname: router.pathname, query: { tab: id } }, undefined, { shallow: true }) }

  return (
    <DashboardLayout title={t('pageTitle')}>
      <div className="space-y-6">
        <PageHeader
          eyebrow={t('eyebrow')}
          title={t('title')}
          description={t('description')}
          actions={<Button variant="secondary" icon={BookOpenIcon} href="/docs/guides/reseller">{t('guide')}</Button>}
        >
          <Tabs idPrefix="reseller" aria-label={t('tabsLabel')} value={tab} onChange={changeTab} tabs={tabs} />
        </PageHeader>

        {locked && (
          <Notice tone="warning" icon={ClockIcon} title={t('lockedTitle')}
            action={<Button size="sm" variant="secondary" onClick={() => changeTab('overview')}>{t('backToOverview')}</Button>}>
            {t('lockedBody')}
          </Notice>
        )}

        {/* ── Overview ───────────────────────────── */}
        {tab === 'overview' && (
          <div className="space-y-5">
            {isLoading ? <Skeleton className="h-24 w-full rounded-panel" /> : !profile ? (
              <Card variant="deep" padding="lg" className="overflow-hidden">
                <div aria-hidden="true" className="pointer-events-none absolute -end-16 -top-16 h-56 w-56 rounded-full bg-brand-green/20 blur-3xl" />
                <div className="relative flex flex-wrap items-center gap-5">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient text-[#04282C] shadow-glow"><RocketLaunchIcon className="h-7 w-7" aria-hidden="true" /></span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-bold text-deep-ink">{t('joinTitle')}</h2>
                    <p className="mt-1 text-sm text-deep-muted">{t('joinBody')}</p>
                  </div>
                  <Button variant="on-deep" className="rtl:[&>svg]:rotate-180" iconEnd={ArrowRightIcon} onClick={() => changeTab('settings')}>{t('applyNow')}</Button>
                </div>
              </Card>
            ) : !profile.is_approved ? (
              <Notice tone="warning" icon={ClockIcon} title={t('reviewTitle')}>{t('reviewBody')}</Notice>
            ) : null}

            <div className="grid grid-cols-2 gap-3 sm:gap-3.5 lg:grid-cols-4">
              <StatCard label={t('statPending')} value={money(profile?.balance_pending)} icon={BanknotesIcon} loading={isLoading} />
              <StatCard label={t('statTotal')} value={money(profile?.balance_total)} icon={CurrencyDollarIcon} loading={isLoading} />
              <StatCard label={t('statReferred')} value={String(referrals.length)} icon={UserGroupIcon} loading={isLoading} />
              <StatCard label={t('statCommission')} value={profile?.referral_commission_pct ? `${profile.referral_commission_pct}%` : t('setByAdmin')} icon={LinkIcon} loading={isLoading} />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: LinkIcon, title: t('qa_invite'), desc: t('qa_invite_desc'), go: () => { changeTab('invites'); setShowInviteForm(true) } },
                { icon: CubeIcon, title: t('qa_prices'), desc: t('qa_prices_desc'), go: () => changeTab('plans') },
                { icon: Cog6ToothIcon, title: t('qa_payment'), desc: t('qa_payment_desc'), go: () => changeTab('settings') },
              ].map(a => (
                <button key={a.title} type="button" onClick={a.go}
                  className="group flex items-start gap-3 rounded-panel border border-line bg-surface p-5 text-start shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-chip text-brand-ink transition group-hover:bg-brand-gradient group-hover:text-[#04282C]"><a.icon className="h-5 w-5" aria-hidden="true" /></span>
                  <span>
                    <span className="block font-semibold text-ink">{a.title}</span>
                    <span className="mt-0.5 block text-xs text-muted">{a.desc}</span>
                  </span>
                </button>
              ))}
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
              <Card padding="none">
                <CardHeader title={t('latestClients')} action={referrals.length > 5 ? <button className="text-link hover:text-link-hover" onClick={() => changeTab('referrals')}>{t('viewAll')}</button> : undefined} divider />
                {referrals.length === 0 ? (
                  <EmptyState size="sm" icon={UserGroupIcon} title={t('noClients')} description={t('noClientsDesc')} />
                ) : (
                  <ul className="divide-y divide-line-soft">
                    {referrals.slice(0, 5).map(r => (
                      <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                        <Avatar name={r.referred_user?.name || r.referred_user?.email || '?'} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">{r.referred_user?.name || t('unknown')}</p>
                          <p className="truncate text-xs text-muted"><span dir="ltr">{r.referred_user?.email}</span></p>
                        </div>
                        <div className="text-end">
                          <p className="text-sm font-semibold text-success tabular">{money(r.total_earned)}</p>
                          <p className="text-xs text-muted">{r.referred_user?.created_at ? fmtDate(r.referred_user.created_at) : ''}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card className="h-fit">
                <SectionTitle icon={GiftIcon} title={t('giftTitle')} subtitle={t('giftSub')} />
                <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (giftCode) redeemGiftMut.mutate(giftCode) }}>
                  <Field label={t('giftLabel')} srOnlyLabel className="min-w-0 flex-1">
                    <Input value={giftCode} onChange={e => setGiftCode(e.target.value.toUpperCase())} placeholder="GIFT-XXXX-XXXX" dir="ltr" className="font-mono" />
                  </Field>
                  <Button type="submit" variant="secondary" loading={redeemGiftMut.isLoading} disabled={!giftCode}>{t('redeem')}</Button>
                </form>
              </Card>
            </div>
          </div>
        )}

        {/* ── Plans ──────────────────────────────── */}
        {tab === 'plans' && !locked && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">{t('plansIntro')}</p>
              <Button icon={PlusIcon} onClick={() => setShowPlanForm(true)}>{t('customPlan')}</Button>
            </div>
            {plansLoading ? <Skeleton className="h-40 w-full rounded-panel" /> : plans.length === 0 ? (
              <EmptyState variant="card" icon={CubeIcon} title={t('noPlans')}
                description={t('noPlansDesc')}
                action={<Button icon={PlusIcon} onClick={() => setShowPlanForm(true)}>{t('createPlan')}</Button>} />
            ) : (
              <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr))]">
                {plans.map(plan => {
                  const cost = plan.base_plan?.price_monthly || 0
                  const p = plan.custom_price_monthly - cost
                  return (
                    <Card key={plan.id} interactive>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-lg font-bold text-ink">{plan.custom_name || plan.base_plan?.name}</p>
                          <p className="text-xs text-muted">{t('basedOn', { name: plan.base_plan?.name })}</p>
                        </div>
                        <Badge tone="success" size="sm" dot>{t('active')}</Badge>
                      </div>
                      <p className="mt-4 text-3xl font-bold text-ink tabular"><span dir="ltr">{money(plan.custom_price_monthly)}</span><span className="ms-1 text-sm font-normal text-muted">{t('perMonth')}</span></p>
                      <div className="mt-4 space-y-2 rounded-card bg-surface-2 p-3 text-sm">
                        <div className="flex justify-between"><span className="text-muted">{t('yourCost')}</span><span className="tabular text-body">{t('priceMonth', { price: money(cost) })}</span></div>
                        <div className="flex justify-between border-t border-line-soft pt-2"><span className="font-medium text-success">{t('yourProfit')}</span><span className="font-bold text-success tabular">{t('priceMonth', { price: money(p) })}</span></div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Invites ────────────────────────────── */}
        {tab === 'invites' && !locked && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">{t(invites.length === 1 ? 'inviteCountOne' : 'inviteCountMany', { n: invites.length })}</p>
              <Button icon={PlusIcon} onClick={() => setShowInviteForm(true)}>{t('newInvite')}</Button>
            </div>
            {invitesLoading ? <Skeleton className="h-32 w-full rounded-panel" /> : invites.length === 0 ? (
              <EmptyState variant="card" icon={LinkIcon} title={t('noInvites')} description={t('noInvitesDesc')}
                action={<Button icon={PlusIcon} onClick={() => setShowInviteForm(true)}>{t('createLink')}</Button>} />
            ) : (
              <div className="grid gap-3">
                {invites.map(invite => {
                  const url = `${appUrl}/auth/register?code=${invite.code}`
                  return (
                    <Card key={invite.id} padding="sm" className={cn(!invite.is_active && 'opacity-60')}>
                      <div className="flex flex-wrap items-start gap-3">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-ink">{invite.label || invite.code}</p>
                            <code dir="ltr" className="rounded-md bg-chip px-2 py-0.5 font-mono text-xs text-chip-ink">{invite.code}</code>
                            <Badge tone={invite.is_active ? 'success' : 'neutral'} size="sm" dot>{invite.is_active ? t('st_active') : t('inactive')}</Badge>
                          </div>
                          <CopyField value={url} />
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                            {invite.trial_days > 0 && <span>{t('trialDays', { n: invite.trial_days })}</span>}
                            {invite.discount_pct > 0 && <span>{t('discount', { n: invite.discount_pct })}</span>}
                            <span className="tabular">{t('uses', { n: `${invite.use_count}${invite.max_uses ? `/${invite.max_uses}` : ''}` })}</span>
                            {invite.reseller_plan && <span>{t('planName', { name: invite.reseller_plan.custom_name || invite.reseller_plan.base_plan?.name })}</span>}
                          </div>
                        </div>
                        <Tooltip content={t('deleteLink')}>
                          <Button size="icon-sm" variant="ghost" icon={TrashIcon} aria-label={t('deleteNamed', { name: invite.label || invite.code })} className="text-muted hover:text-danger" onClick={() => setToDeleteInvite(invite)} />
                        </Tooltip>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Referrals ──────────────────────────── */}
        {tab === 'referrals' && !locked && (
          <Card padding="none">
            <CardHeader icon={UserGroupIcon} title={t('yourClients')} subtitle={t(referrals.length === 1 ? 'clientCountOne' : 'clientCountMany', { n: referrals.length })} divider />
            {referrals.length === 0 ? (
              <EmptyState size="sm" icon={UserGroupIcon} title={t('noClients')} description={t('noClientsDesc')}
                action={<Button size="sm" onClick={() => changeTab('invites')}>{t('tab_invites')}</Button>} />
            ) : (
              <Table minWidth={620} caption={t('referredClients')}>
                <THead><TR><TH>{t('th_client')}</TH><TH>{t('th_joined')}</TH><TH>{t('th_status')}</TH><TH align="end">{t('th_earned')}</TH></TR></THead>
                <TBody>
                  {referrals.map(r => (
                    <TR key={r.id}>
                      <TD>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={r.referred_user?.name || r.referred_user?.email || '?'} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink">{r.referred_user?.name}</p>
                            <p className="truncate text-xs text-muted"><span dir="ltr">{r.referred_user?.email}</span></p>
                          </div>
                        </div>
                      </TD>
                      <TD className="text-sm text-muted">{fmtDate(r.referred_user?.created_at)}</TD>
                      <TD><StatusPill status={r.status === 'active' ? 'completed' : 'draft'} tone={r.status === 'active' ? 'success' : 'neutral'}>{statusLabel(r.status)}</StatusPill></TD>
                      <TD align="end" className="font-semibold text-success tabular">{money(r.total_earned)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        )}

        {/* ── Campaigns ──────────────────────────── */}
        {tab === 'campaigns' && !locked && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">{t('campaignsIntro', { n: referralCount })}</p>
              {referralCount > 0 && <Button icon={PlusIcon} onClick={() => setShowCampForm(true)}>{t('newCampaign')}</Button>}
            </div>
            {referralCount === 0 && (
              <EmptyState variant="card" icon={MegaphoneIcon} title={t('noReferred')} description={t('noReferredDesc')}
                action={<Button onClick={() => changeTab('invites')}>{t('tab_invites')}</Button>} />
            )}
            {campaigns.length > 0 && (
              <Card padding="none">
                <CardHeader title={t('campaignLog')} divider />
                <Table minWidth={640} caption={t('campaignLog')}>
                  <THead><TR><TH>{t('th_date')}</TH><TH>{t('th_message')}</TH><TH align="center">{t('th_targets')}</TH><TH align="center">{t('th_sent')}</TH><TH>{t('th_status')}</TH></TR></THead>
                  <TBody>
                    {campaigns.map(c => (
                      <TR key={c.id}>
                        <TD className="text-sm text-muted">{fmtDate(c.created_at)}</TD>
                        <TD className="max-w-xs"><p className="truncate text-sm text-body">{c.message}</p></TD>
                        <TD align="center" className="tabular">{c.target_count}</TD>
                        <TD align="center" className="font-semibold tabular">{c.sent_count || 0}</TD>
                        <TD><StatusPill status={c.status}>{statusLabel(c.status)}</StatusPill></TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </Card>
            )}
          </div>
        )}

        {/* ── Payouts ────────────────────────────── */}
        {tab === 'payouts' && !locked && (
          <div className="space-y-5">
            <div className="grid gap-3.5 sm:grid-cols-3">
              <Card variant="deep" className="overflow-hidden">
                <div aria-hidden="true" className="pointer-events-none absolute -end-10 -top-10 h-32 w-32 rounded-full bg-brand-green/25 blur-2xl" />
                <p className="relative text-[13px] text-deep-muted">{t('nextPayout')}</p>
                <p className="relative mt-1 text-3xl font-bold text-deep-ink tabular">{money(profile?.balance_pending)}</p>
                <p className="relative mt-1 text-xs text-deep-muted">{t('paidNextCycle', { schedule: scheduleLabel(profile?.payout_schedule) })}</p>
              </Card>
              <StatCard label={t('statPaid')} value={money(profile?.balance_paid)} icon={CheckIcon} />
              <StatCard label={t('statTotal')} value={money(profile?.balance_total)} icon={CurrencyDollarIcon} />
            </div>
            <Card padding="none">
              <CardHeader title={t('payoutLog')} subtitle={t('schedule', { schedule: scheduleLabel(profile?.payout_schedule) })} divider />
              {payouts.length === 0 ? (
                <EmptyState size="sm" icon={BanknotesIcon} title={t('noPayouts')} />
              ) : (
                <Table minWidth={620} caption={t('payoutLog')}>
                  <THead><TR><TH>{t('th_date')}</TH><TH>{t('th_amount')}</TH><TH>{t('th_method')}</TH><TH>{t('th_reference')}</TH><TH>{t('th_status')}</TH></TR></THead>
                  <TBody>
                    {payouts.map(p => (
                      <TR key={p.id}>
                        <TD className="text-sm text-muted">{fmtDate(p.created_at)}</TD>
                        <TD className="font-semibold text-ink tabular">{money(p.amount)}</TD>
                        <TD className="text-sm text-muted">{(() => { const pm = PAYOUT_METHODS.find(m => m.value === p.method); return pm ? t(pm.label) : p.method })()}</TD>
                        <TD><code dir="ltr" className="font-mono text-xs text-muted">{p.reference || '—'}</code></TD>
                        <TD><StatusPill status={p.status === 'paid' ? 'completed' : p.status === 'processing' ? 'pending' : p.status} tone={p.status === 'paid' ? 'success' : p.status === 'processing' ? 'warning' : 'neutral'}>{statusLabel(p.status)}</StatusPill></TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </Card>
          </div>
        )}

        {/* ── Settings ───────────────────────────── */}
        {tab === 'settings' && (
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-5">
              <Card>
                <SectionTitle icon={CreditCardIcon} title={t('paymentMethod')} subtitle={t('paymentMethodSub')} />
                <div role="radiogroup" aria-label={t('paymentMethod')} className="grid gap-2 sm:grid-cols-3">
                  {PAYMENT_OPTIONS.map(opt => {
                    const selected = profileForm?.payment_method === opt.value
                    return (
                      <button key={opt.value} type="button" role="radio" aria-checked={selected}
                        onClick={() => setProfileForm(f => ({ ...f, payment_method: opt.value }))}
                        className={cn('rounded-card border p-4 text-start transition', selected ? 'border-brand-teal bg-chip/40 shadow-ring' : 'border-line hover:border-line-strong')}>
                        <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', selected ? 'bg-brand-gradient text-[#04282C]' : 'bg-surface-3 text-muted')}><opt.icon className="h-5 w-5" aria-hidden="true" /></span>
                        <span className="mt-3 block text-sm font-semibold text-ink">{t(`pay_${opt.value}`)}</span>
                        <span className="mt-1 block text-xs leading-relaxed text-muted">{t(`pay_${opt.value}_desc`)}</span>
                      </button>
                    )
                  })}
                </div>
              </Card>

              {showStripe && (
                <Card>
                  <SectionTitle icon={ShieldCheckIcon} title={t('stripeAccount')} subtitle={t('stripeAccountSub')} />
                  {profile?.stripe_connect_account_id ? (
                    <div className="flex flex-wrap items-center gap-3 rounded-card border border-success/20 bg-success-bg/60 p-4">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-success text-white"><CheckIcon className="h-5 w-5" aria-hidden="true" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-ink">{t('stripeConnectedLabel')}</p>
                        <p className="text-xs text-muted">{t('stripeConnectedDesc')} · <span dir="ltr" className="font-mono">{String(profile.stripe_connect_account_id).replace(/^(acct_).*(.{4})$/, '$1••••$2')}</span></p>
                      </div>
                      <Button size="sm" variant="danger-soft" onClick={() => setConfirmDisconnect(true)}>{t('disconnect')}</Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-body">{t('connectStripeIntro')}</p>
                      <a href="/api/reseller/stripe-connect/authorize" className={buttonClasses({ variant: 'dark' })}><CreditCardIcon className="h-[18px] w-[18px]" aria-hidden="true" />{t('connectStripe')}</a>
                      <ul className="space-y-1 text-xs text-muted">
                        <li className="flex items-center gap-1.5"><CheckIcon className="h-3.5 w-3.5 text-success" aria-hidden="true" />{t('stripe1')}</li>
                        <li className="flex items-center gap-1.5"><CheckIcon className="h-3.5 w-3.5 text-success" aria-hidden="true" />{t('stripe2')}</li>
                        <li className="flex items-center gap-1.5"><CheckIcon className="h-3.5 w-3.5 text-success" aria-hidden="true" />{t('stripe3')}</li>
                      </ul>
                    </div>
                  )}
                </Card>
              )}

              {showPayout && (
                <Card>
                  <SectionTitle icon={BanknotesIcon} title={t('receiveEarnings')} subtitle={t('receiveEarningsSub')} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={t('payoutSchedule')}>
                      <Select value={profileForm?.payout_schedule || 'monthly'} onChange={e => setProfileForm(f => ({ ...f, payout_schedule: e.target.value }))} options={PAYOUT_SCHEDULES.map(o => ({ value: o.value, label: t(o.label) }))} />
                    </Field>
                    <Field label={t('payoutMethod')}>
                      <Select value={method} onChange={e => setProfileForm(f => ({ ...f, payout_method: e.target.value }))} options={PAYOUT_METHODS.map(o => ({ value: o.value, label: t(o.label) }))} />
                    </Field>
                  </div>
                  <fieldset className="mt-4 rounded-card border border-line-soft bg-surface-2/60 p-4">
                    <legend className="px-1 text-sm font-medium text-ink">{t('payoutDetails')}</legend>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {(PAYOUT_FIELDS[method] || []).map(f => (
                        <Field key={f.k} label={t(f.label)}>
                          <Input value={details[f.k] || ''} onChange={e => setDetail(f.k, e.target.value)} placeholder={f.phKey ? t(f.phKey) : f.ph} type={f.type || 'text'}
                            dir={f.ltr ? 'ltr' : undefined} className={f.mono ? 'font-mono' : undefined} />
                        </Field>
                      ))}
                    </div>
                  </fieldset>
                </Card>
              )}

              <Button size="lg" fullWidth loading={saveProfileMut.isLoading} disabled={!profileForm} onClick={() => saveProfileMut.mutate(profileForm)}>
                {profile ? t('saveSettings') : t('saveAndApply')}
              </Button>
            </div>

            <Card variant="muted" className="lg:sticky lg:top-6">
              <h3 className="font-semibold text-ink">{t('accountStatus')}</h3>
              <div className="mt-3">
                {!profile ? <Badge tone="neutral">{t('notApplied')}</Badge>
                  : profile.is_approved ? <Badge tone="success" dot>{t('approved')}</Badge>
                  : <Badge tone="warning" dot>{t('underReview')}</Badge>}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted">{t('secretsNote')}</p>
            </Card>
          </div>
        )}
      </div>

      {/* Create plan */}
      <Modal open={showPlanForm} onClose={() => setShowPlanForm(false)} size="lg" icon={CubeIcon} title={t('planFormTitle')}
        description={t('planFormDesc')}
        footer={<><Button variant="secondary" onClick={() => setShowPlanForm(false)}>{t('cancel')}</Button>
          <Button loading={createPlanMut.isLoading} disabled={!planForm.base_plan_id || !planForm.custom_price_monthly} onClick={() => createPlanMut.mutate(planForm)}>{t('createPlan')}</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('basePlan')} required>
            <Select value={planForm.base_plan_id} onChange={e => setPlanForm(f => ({ ...f, base_plan_id: e.target.value }))} placeholder={t('choosePlan')}
              options={basePlans.filter(p => p.price_monthly > 0).map(p => ({ value: p.id, label: t('baseOption', { name: p.name, price: money(p.price_monthly) }) }))} />
          </Field>
          <Field label={t('clientPlanName')}>
            <Input value={planForm.custom_name} onChange={e => setPlanForm(f => ({ ...f, custom_name: e.target.value }))} placeholder={t('clientPlanNamePh')} />
          </Field>
          <Field label={t('monthlyPrice')} required>
            <Input type="number" min="0" step="0.01" dir="ltr" value={planForm.custom_price_monthly} onChange={e => setPlanForm(f => ({ ...f, custom_price_monthly: e.target.value }))} placeholder="49" />
          </Field>
          <Field label={t('yearlyPrice')}>
            <Input type="number" min="0" step="0.01" dir="ltr" value={planForm.custom_price_yearly} onChange={e => setPlanForm(f => ({ ...f, custom_price_yearly: e.target.value }))} placeholder="499" />
          </Field>
        </div>
        {profit !== null && (
          <div className={cn('mt-4 flex items-center justify-between rounded-card px-4 py-3 text-sm', profit >= 0 ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger')}>
            <span>{t('profitPerClient')}</span>
            <span className="font-bold tabular">{t('priceMonth', { price: money(profit) })}</span>
          </div>
        )}
      </Modal>

      {/* Create invite */}
      <Modal open={showInviteForm} onClose={() => setShowInviteForm(false)} size="lg" icon={LinkIcon} title={t('inviteFormTitle')}
        description={t('inviteFormDesc')}
        footer={<><Button variant="secondary" onClick={() => setShowInviteForm(false)}>{t('cancel')}</Button>
          <Button icon={LinkIcon} loading={createInviteMut.isLoading} onClick={() => createInviteMut.mutate({ ...inviteForm, max_uses: inviteForm.max_uses ? parseInt(inviteForm.max_uses) : null })}>{t('createAndCopy')}</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('internalLabel')}>
            <Input value={inviteForm.label} onChange={e => setInviteForm(f => ({ ...f, label: e.target.value }))} placeholder={t('internalLabelPh')} />
          </Field>
          <Field label={t('customCode')} hint={t('customCodeHint')}>
            <Input value={inviteForm.custom_code} onChange={e => setInviteForm(f => ({ ...f, custom_code: e.target.value.toUpperCase() }))} placeholder="JOHN50" dir="ltr" className="font-mono" />
          </Field>
          <Field label={t('plan')} className="sm:col-span-2">
            <Select value={inviteForm.reseller_plan_id} onChange={e => setInviteForm(f => ({ ...f, reseller_plan_id: e.target.value }))}
              options={[{ value: '', label: t('anyPlan') }, ...plans.map(p => ({ value: p.id, label: t('planOption', { name: p.custom_name || p.base_plan?.name, price: money(p.custom_price_monthly) }) }))]} />
          </Field>
          <Field label={t('trialDaysLabel')}>
            <Input type="number" min={0} max={90} dir="ltr" value={inviteForm.trial_days} onChange={e => setInviteForm(f => ({ ...f, trial_days: parseInt(e.target.value) || 0 }))} />
          </Field>
          <Field label={t('discountLabel')}>
            <Input type="number" min={0} max={100} dir="ltr" value={inviteForm.discount_pct} onChange={e => setInviteForm(f => ({ ...f, discount_pct: parseFloat(e.target.value) || 0 }))} />
          </Field>
          <Field label={t('maxUses')} hint={t('maxUsesHint')}>
            <Input type="number" dir="ltr" value={inviteForm.max_uses} onChange={e => setInviteForm(f => ({ ...f, max_uses: e.target.value }))} placeholder={t('unlimited')} />
          </Field>
        </div>
      </Modal>

      {/* Campaign */}
      <Modal open={showCampForm && referralCount > 0} onClose={() => setShowCampForm(false)} size="lg" icon={MegaphoneIcon} title={t('campFormTitle')}
        description={t('campFormDesc', { n: referralCount })}
        footer={<><Button variant="secondary" onClick={() => setShowCampForm(false)}>{t('cancel')}</Button>
          <Button icon={campForm.scheduled_at ? CalendarDaysIcon : PaperAirplaneIcon} loading={sendCampMut.isLoading} disabled={!campForm.instance_id || !campForm.message}
            onClick={() => sendCampMut.mutate({ ...campForm, scheduled_at: campForm.scheduled_at ? new Date(campForm.scheduled_at).toISOString() : undefined })}>
            {campForm.scheduled_at ? t('schedule_btn') : t('sendNow')}
          </Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('waNumber')} required error={campInstances.length === 0 ? t('noInstances') : undefined}>
            <Select value={campForm.instance_id} onChange={e => setCampForm(f => ({ ...f, instance_id: e.target.value }))} placeholder={t('chooseNumber')}
              options={campInstances.map(inst => ({ value: inst.id, label: `${inst.display_name || inst.phone_number} (${inst.type === 'cloud_api' ? 'Cloud API' : 'WhatsApp Web'})` }))} />
          </Field>
          <Field label={t('audience')}>
            <Select value={campForm.target} onChange={e => setCampForm(f => ({ ...f, target: e.target.value }))}
              options={[{ value: 'all', label: t('allReferred', { n: referralCount }) }, { value: 'active', label: t('activeOnly') }]} />
          </Field>
          <Field label={t('message')} required className="sm:col-span-2" hint={rich(t('variablesHint'), { vars: <><code dir="ltr" className="font-mono">{'{{name}}'}</code> <code dir="ltr" className="font-mono">{'{{phone}}'}</code></> })}>
            <Textarea rows={4} value={campForm.message} onChange={e => setCampForm(f => ({ ...f, message: e.target.value }))} placeholder={t('messagePh')} />
          </Field>
          <Field label={t('sendAt')} hint={t('sendAtHint')}>
            <Input type="datetime-local" dir="ltr" value={campForm.scheduled_at} onChange={e => setCampForm(f => ({ ...f, scheduled_at: e.target.value }))} />
          </Field>
          <Field label={t('delay')}>
            <Input type="number" min={1} max={30} dir="ltr" value={campForm.delay_seconds} onChange={e => setCampForm(f => ({ ...f, delay_seconds: parseInt(e.target.value) || 3 }))} />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog cancelLabel={t('cancel')} destructive open={!!toDeleteInvite} onClose={() => setToDeleteInvite(null)}
        onConfirm={() => { if (toDeleteInvite) deleteInviteMut.mutate(toDeleteInvite.id) }} loading={deleteInviteMut.isLoading}
        title={t('deleteInviteTitle')} description={t('deleteInviteDesc')} confirmLabel={t('delete')} />
      <ConfirmDialog cancelLabel={t('cancel')} destructive open={confirmDisconnect} onClose={() => setConfirmDisconnect(false)} onConfirm={disconnectStripe} loading={disconnecting}
        title={t('disconnectTitle')} description={t('disconnectDesc')} confirmLabel={t('disconnect')} />
    </DashboardLayout>
  )
}
