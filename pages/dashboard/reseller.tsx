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
  ArrowLeftIcon, BuildingLibraryIcon, CreditCardIcon, ArrowsRightLeftIcon, ShieldCheckIcon, BookOpenIcon,
  PaperAirplaneIcon, CalendarDaysIcon,
} from '@heroicons/react/24/outline'
import {
  Avatar, Badge, Button, Card, CardHeader, ConfirmDialog, EmptyState, Field, Input, Modal, PageHeader,
  Select, Skeleton, StatCard, StatusPill, Table, TBody, TD, TH, THead, TR, Tabs, Textarea, Tooltip, buttonClasses, cn,
} from '@/components/ui'
import { CopyButton, CopyField, Notice, PlanGate, SectionTitle } from '@/components/settings/Shared'
import { fmtDate, fmtMoney } from '@/components/settings/format'

const PAYOUT_METHODS = [
  { value: 'bank_transfer', label: 'تحويل بنكي' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'wise', label: 'Wise' },
  { value: 'crypto', label: 'عملات رقمية (USDT/BTC)' },
]

const PAYOUT_SCHEDULES = [
  { value: 'weekly', label: 'أسبوعيًا' },
  { value: 'biweekly', label: 'كل 15 يومًا' },
  { value: 'monthly', label: 'شهريًا' },
]
const SCHEDULE_LABEL = Object.fromEntries(PAYOUT_SCHEDULES.map(s => [s.value, s.label]))

const PAYMENT_OPTIONS = [
  { value: 'platform', label: 'عبر منصة WABEK', desc: 'يدفع عملاؤك لنا ونحوّل أرباحك في كل دورة صرف.', icon: BuildingLibraryIcon },
  { value: 'stripe_own', label: 'حسابي على Stripe', desc: 'يدفع عملاؤك مباشرة إلى حسابك وتتولى الفوترة بنفسك.', icon: CreditCardIcon },
  { value: 'both', label: 'الخياران معًا', desc: 'اعرض طريقتَي الدفع على عملائك.', icon: ArrowsRightLeftIcon },
]

const PAYOUT_FIELDS = {
  bank_transfer: [
    { k: 'bank_name', label: 'اسم البنك', ph: 'HSBC' },
    { k: 'account_name', label: 'اسم صاحب الحساب', ph: 'الاسم كما في الحساب' },
    { k: 'iban', label: 'IBAN / رقم الحساب', ph: 'GB29 NWBK 6016 1331 9268 19', ltr: true },
    { k: 'swift', label: 'SWIFT / BIC', ph: 'NWBKGB2L', ltr: true },
    { k: 'country', label: 'الدولة', ph: 'المملكة المتحدة' },
  ],
  paypal: [{ k: 'email', label: 'بريد PayPal', ph: 'your@paypal.com', ltr: true, type: 'email' }],
  wise: [
    { k: 'email', label: 'بريد Wise', ph: 'your@wise.com', ltr: true },
    { k: 'account_id', label: 'معرّف حساب Wise (اختياري)', ph: 'Pxxxx', ltr: true },
  ],
  crypto: [
    { k: 'network', label: 'الشبكة', ph: 'TRC20 / ERC20 / BEP20', ltr: true },
    { k: 'address', label: 'عنوان المحفظة', ph: 'T...', ltr: true, mono: true },
    { k: 'currency', label: 'العملة', ph: 'USDT / BTC / ETH', ltr: true },
  ],
}

const STATUS_AR = { active: 'نشط', inactive: 'غير نشط', completed: 'مكتملة', sending: 'قيد الإرسال', scheduled: 'مجدولة', failed: 'فشلت', paid: 'مدفوعة', processing: 'قيد المعالجة', pending: 'معلّقة', cancelled: 'ملغاة' }

const money = (n) => fmtMoney(Number(n || 0))

export default function ResellerPage() {
  return <PlanGate feature="allow_reseller"><ResellerContent /></PlanGate>
}

function ResellerContent() {
  const qc = useQueryClient()
  const router = useRouter()
  const [tab, setTab] = useState(router.query.tab as string || 'overview')
  useEffect(() => { if (router.query.tab) setTab(router.query.tab as string) }, [router.query.tab])

  // Handle Stripe Connect callback
  useEffect(() => {
    if (router.query.success === 'stripe_connected') {
      toast.success('تم ربط حساب Stripe بنجاح')
      router.replace('/dashboard/reseller?tab=settings', undefined, { shallow: true })
    }
    if (router.query.error) {
      const errors = { stripe_denied: 'أُلغي ربط Stripe', expired: 'انتهت صلاحية الرابط، حاول مجددًا', stripe_error: 'خطأ من Stripe، حاول مجددًا', server_error: 'خطأ في الخادم' }
      toast.error(errors[router.query.error as string] || 'تعذّر الربط')
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
        toast.success(`تم تفعيل ${r.plan} لمدة ${r.duration_days} يومًا`)
        qc.invalidateQueries('reseller-profile')
        setGiftCode('')
      },
      onError: (e: any) => toast.error(e?.response?.data?.error || 'رمز الهدية غير صالح'),
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
        toast.success(`أُرسلت الحملة إلى ${r.target_count} مستخدم`)
      },
      onError: e => toast.error(e?.response?.data?.error || 'تعذّر الإرسال'),
    }
  )

  const saveProfileMut = useMutation(
    (body) => axios.put('/api/reseller/profile', body),
    { onSuccess: () => { qc.invalidateQueries('reseller-profile'); toast.success('تم حفظ الإعدادات') }, onError: e => toast.error(e?.response?.data?.error || 'تعذّر الحفظ') }
  )

  const createPlanMut = useMutation(
    (body) => axios.post('/api/reseller/plans', body),
    { onSuccess: () => { qc.invalidateQueries('reseller-plans'); setShowPlanForm(false); toast.success('تم إنشاء الباقة') }, onError: e => toast.error(e?.response?.data?.error || 'تعذّر إنشاء الباقة') }
  )

  const createInviteMut = useMutation(
    (body) => axios.post('/api/reseller/invites', body),
    {
      onSuccess: (r) => {
        qc.invalidateQueries('reseller-invites')
        setShowInviteForm(false)
        setInviteForm({ label: '', reseller_plan_id: '', trial_days: 14, discount_pct: 0, max_uses: '', custom_code: '' })
        navigator.clipboard.writeText(r.data.url).catch(() => {})
        toast.success('أُنشئ رابط الدعوة ونُسخ إلى الحافظة')
      },
      onError: e => toast.error(e?.response?.data?.error || 'تعذّر إنشاء الرابط')
    }
  )

  const deleteInviteMut = useMutation(
    id => axios.delete(`/api/reseller/invites/${id}`),
    { onSuccess: () => { qc.invalidateQueries('reseller-invites'); setToDeleteInvite(null); toast.success('تم حذف الرابط') } }
  )

  const disconnectStripe = () => {
    setDisconnecting(true)
    axios.post('/api/reseller/stripe-connect/disconnect')
      .then(() => { qc.invalidateQueries('reseller-profile'); toast.success('تم فصل Stripe') })
      .catch(e => toast.error(e?.response?.data?.error || 'تعذّر فصل Stripe'))
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
    { id: 'overview', label: 'نظرة عامة', icon: ChartPieIcon },
    { id: 'plans', label: 'الباقات والأسعار', icon: CubeIcon, count: plans.length || undefined },
    { id: 'invites', label: 'روابط الدعوة', icon: LinkIcon, count: invites.length || undefined },
    { id: 'referrals', label: 'العملاء', icon: UserGroupIcon, count: referrals.length || undefined },
    { id: 'campaigns', label: 'الحملات', icon: MegaphoneIcon },
    { id: 'payouts', label: 'الأرباح والمدفوعات', icon: BanknotesIcon },
    { id: 'settings', label: 'الإعدادات', icon: Cog6ToothIcon },
  ]

  const changeTab = (id) => { setTab(id); router.replace({ pathname: router.pathname, query: { tab: id } }, undefined, { shallow: true }) }

  return (
    <DashboardLayout title="Reseller Dashboard">
      <div className="space-y-6">
        <PageHeader
          eyebrow="الإعدادات"
          title="برنامج الموزّعين"
          description="سعّر الباقات لعملائك، وادعهم بروابط خاصة، وتابع أرباحك ومدفوعاتك."
          actions={<Button variant="secondary" icon={BookOpenIcon} href="/docs/guides/reseller">الدليل</Button>}
        >
          <Tabs idPrefix="reseller" aria-label="أقسام الموزّع" value={tab} onChange={changeTab} tabs={tabs} />
        </PageHeader>

        {locked && (
          <Notice tone="warning" icon={ClockIcon} title="الحساب بانتظار الموافقة"
            action={<Button size="sm" variant="secondary" onClick={() => changeTab('overview')}>العودة إلى النظرة العامة</Button>}>
            ستُفتح هذه الميزة بعد موافقة الإدارة على حساب الموزّع.
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
                    <h2 className="text-xl font-bold text-deep-ink">انضم إلى برنامج الموزّعين</h2>
                    <p className="mt-1 text-sm text-deep-muted">اختر طريقة الدفع في الإعدادات واحفظها، وسيُرسل طلبك إلى الإدارة للمراجعة.</p>
                  </div>
                  <Button variant="on-deep" iconEnd={ArrowLeftIcon} onClick={() => changeTab('settings')}>قدّم الآن</Button>
                </div>
              </Card>
            ) : !profile.is_approved ? (
              <Notice tone="warning" icon={ClockIcon} title="حسابك قيد المراجعة">سنُعلمك فور الموافقة. يمكنك ضبط إعداداتك في الأثناء.</Notice>
            ) : null}

            <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
              <StatCard label="الرصيد المعلّق" value={money(profile?.balance_pending)} icon={BanknotesIcon} loading={isLoading} />
              <StatCard label="إجمالي الأرباح" value={money(profile?.balance_total)} icon={CurrencyDollarIcon} loading={isLoading} />
              <StatCard label="العملاء المُحالون" value={String(referrals.length)} icon={UserGroupIcon} loading={isLoading} />
              <StatCard label="نسبة العمولة" value={profile?.referral_commission_pct ? `${profile.referral_commission_pct}%` : 'تحددها الإدارة'} icon={LinkIcon} loading={isLoading} />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: LinkIcon, title: 'أنشئ رابط دعوة', desc: 'رابط خاص لدعوة مستخدمين جدد تحت حسابك', go: () => { changeTab('invites'); setShowInviteForm(true) } },
                { icon: CubeIcon, title: 'حدّد أسعارك', desc: 'خصّص أسعار الباقات لعملائك', go: () => changeTab('plans') },
                { icon: Cog6ToothIcon, title: 'إعدادات الدفع', desc: 'اختر طريقة استلام أرباحك', go: () => changeTab('settings') },
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
                <CardHeader title="أحدث العملاء" action={referrals.length > 5 ? <button className="text-link hover:text-link-hover" onClick={() => changeTab('referrals')}>عرض الكل</button> : undefined} divider />
                {referrals.length === 0 ? (
                  <EmptyState size="sm" icon={UserGroupIcon} title="لا يوجد عملاء بعد" description="شارك روابط الدعوة لتبدأ." />
                ) : (
                  <ul className="divide-y divide-line-soft">
                    {referrals.slice(0, 5).map(r => (
                      <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                        <Avatar name={r.referred_user?.name || r.referred_user?.email || '?'} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">{r.referred_user?.name || 'غير معروف'}</p>
                          <p className="truncate text-xs text-muted" dir="ltr">{r.referred_user?.email}</p>
                        </div>
                        <div className="text-end">
                          <p className="text-sm font-semibold text-success tabular">{money(r.total_earned)}</p>
                          <p className="text-xs text-muted">{fmtDate(r.referred_user?.created_at, '')}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card className="h-fit">
                <SectionTitle icon={GiftIcon} title="استخدام رمز هدية" subtitle="فعّل باقة فورًا دون دفع" />
                <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (giftCode) redeemGiftMut.mutate(giftCode) }}>
                  <Field label="رمز الهدية" srOnlyLabel className="min-w-0 flex-1">
                    <Input value={giftCode} onChange={e => setGiftCode(e.target.value.toUpperCase())} placeholder="GIFT-XXXX-XXXX" dir="ltr" className="font-mono" />
                  </Field>
                  <Button type="submit" variant="secondary" loading={redeemGiftMut.isLoading} disabled={!giftCode}>استخدام</Button>
                </form>
              </Card>
            </div>
          </div>
        )}

        {/* ── Plans ──────────────────────────────── */}
        {tab === 'plans' && !locked && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">حدّد أسعارًا مخصصة لعملائك، والفرق بين سعرك وتكلفتك ربح لك.</p>
              <Button icon={PlusIcon} onClick={() => setShowPlanForm(true)}>باقة مخصصة</Button>
            </div>
            {plansLoading ? <Skeleton className="h-40 w-full rounded-panel" /> : plans.length === 0 ? (
              <EmptyState variant="card" icon={CubeIcon} title="لا توجد باقات مخصصة بعد"
                description="أنشئ باقات بأسعارك الخاصة؛ تحتفظ بالفرق بين سعرك وتكلفتنا."
                action={<Button icon={PlusIcon} onClick={() => setShowPlanForm(true)}>إنشاء باقة</Button>} />
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
                          <p className="text-xs text-muted">مبنية على: {plan.base_plan?.name}</p>
                        </div>
                        <Badge tone="success" size="sm" dot>نشطة</Badge>
                      </div>
                      <p className="mt-4 text-3xl font-bold text-ink tabular" dir="ltr">{money(plan.custom_price_monthly)}<span className="ms-1 text-sm font-normal text-muted">/ شهر</span></p>
                      <div className="mt-4 space-y-2 rounded-card bg-surface-2 p-3 text-sm">
                        <div className="flex justify-between"><span className="text-muted">تكلفتك</span><span className="tabular text-body">{money(cost)} / شهر</span></div>
                        <div className="flex justify-between border-t border-line-soft pt-2"><span className="font-medium text-success">ربحك</span><span className="font-bold text-success tabular">{money(p)} / شهر</span></div>
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
              <p className="text-sm text-muted">{invites.length} رابط دعوة</p>
              <Button icon={PlusIcon} onClick={() => setShowInviteForm(true)}>رابط دعوة جديد</Button>
            </div>
            {invitesLoading ? <Skeleton className="h-32 w-full rounded-panel" /> : invites.length === 0 ? (
              <EmptyState variant="card" icon={LinkIcon} title="لا توجد روابط دعوة بعد" description="أنشئ روابط لجذب العملاء إلى منصتك."
                action={<Button icon={PlusIcon} onClick={() => setShowInviteForm(true)}>إنشاء رابط</Button>} />
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
                            <Badge tone={invite.is_active ? 'success' : 'neutral'} size="sm" dot>{invite.is_active ? 'نشط' : 'غير نشط'}</Badge>
                          </div>
                          <CopyField value={url} />
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                            {invite.trial_days > 0 && <span>تجربة {invite.trial_days} يومًا</span>}
                            {invite.discount_pct > 0 && <span>خصم {invite.discount_pct}%</span>}
                            <span className="tabular">الاستخدام: {invite.use_count}{invite.max_uses ? `/${invite.max_uses}` : ''}</span>
                            {invite.reseller_plan && <span>الباقة: {invite.reseller_plan.custom_name || invite.reseller_plan.base_plan?.name}</span>}
                          </div>
                        </div>
                        <Tooltip content="حذف الرابط">
                          <Button size="icon-sm" variant="ghost" icon={TrashIcon} aria-label={`حذف ${invite.label || invite.code}`} className="text-muted hover:text-danger" onClick={() => setToDeleteInvite(invite)} />
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
            <CardHeader icon={UserGroupIcon} title="عملاؤك" subtitle={`${referrals.length} عميل`} divider />
            {referrals.length === 0 ? (
              <EmptyState size="sm" icon={UserGroupIcon} title="لا يوجد عملاء بعد" description="شارك روابط الدعوة لتبدأ."
                action={<Button size="sm" onClick={() => changeTab('invites')}>روابط الدعوة</Button>} />
            ) : (
              <Table minWidth={620} caption="العملاء المُحالون">
                <THead><TR><TH>العميل</TH><TH>تاريخ الانضمام</TH><TH>الحالة</TH><TH align="end">إجمالي الأرباح</TH></TR></THead>
                <TBody>
                  {referrals.map(r => (
                    <TR key={r.id}>
                      <TD>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={r.referred_user?.name || r.referred_user?.email || '?'} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink">{r.referred_user?.name}</p>
                            <p className="truncate text-xs text-muted" dir="ltr">{r.referred_user?.email}</p>
                          </div>
                        </div>
                      </TD>
                      <TD className="text-sm text-muted">{fmtDate(r.referred_user?.created_at)}</TD>
                      <TD><StatusPill status={r.status === 'active' ? 'completed' : 'draft'} tone={r.status === 'active' ? 'success' : 'neutral'}>{STATUS_AR[r.status] || r.status}</StatusPill></TD>
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
              <p className="text-sm text-muted">أرسل رسائل واتساب إلى عملائك المُحالين ({referralCount} مستخدم).</p>
              {referralCount > 0 && <Button icon={PlusIcon} onClick={() => setShowCampForm(true)}>حملة جديدة</Button>}
            </div>
            {referralCount === 0 && (
              <EmptyState variant="card" icon={MegaphoneIcon} title="لا يوجد مستخدمون مُحالون بعد" description="أنشئ روابط دعوة لتكسب مستخدمين، ثم أرسل إليهم حملاتك."
                action={<Button onClick={() => changeTab('invites')}>روابط الدعوة</Button>} />
            )}
            {campaigns.length > 0 && (
              <Card padding="none">
                <CardHeader title="سجل الحملات" divider />
                <Table minWidth={640} caption="سجل الحملات">
                  <THead><TR><TH>التاريخ</TH><TH>الرسالة</TH><TH align="center">المستهدفون</TH><TH align="center">المرسلة</TH><TH>الحالة</TH></TR></THead>
                  <TBody>
                    {campaigns.map(c => (
                      <TR key={c.id}>
                        <TD className="text-sm text-muted">{fmtDate(c.created_at)}</TD>
                        <TD className="max-w-xs"><p className="truncate text-sm text-body">{c.message}</p></TD>
                        <TD align="center" className="tabular">{c.target_count}</TD>
                        <TD align="center" className="font-semibold tabular">{c.sent_count || 0}</TD>
                        <TD><StatusPill status={c.status}>{STATUS_AR[c.status] || c.status}</StatusPill></TD>
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
                <p className="relative text-[13px] text-deep-muted">الدفعة القادمة</p>
                <p className="relative mt-1 text-3xl font-bold text-deep-ink tabular">{money(profile?.balance_pending)}</p>
                <p className="relative mt-1 text-xs text-deep-muted">تُصرف في الدورة التالية ({SCHEDULE_LABEL[profile?.payout_schedule] || 'شهريًا'})</p>
              </Card>
              <StatCard label="إجمالي المصروف" value={money(profile?.balance_paid)} icon={CheckIcon} />
              <StatCard label="إجمالي الأرباح" value={money(profile?.balance_total)} icon={CurrencyDollarIcon} />
            </div>
            <Card padding="none">
              <CardHeader title="سجل المدفوعات" subtitle={`الجدول: ${SCHEDULE_LABEL[profile?.payout_schedule] || 'شهريًا'}`} divider />
              {payouts.length === 0 ? (
                <EmptyState size="sm" icon={BanknotesIcon} title="لا توجد مدفوعات بعد" />
              ) : (
                <Table minWidth={620} caption="سجل المدفوعات">
                  <THead><TR><TH>التاريخ</TH><TH>المبلغ</TH><TH>الطريقة</TH><TH>المرجع</TH><TH>الحالة</TH></TR></THead>
                  <TBody>
                    {payouts.map(p => (
                      <TR key={p.id}>
                        <TD className="text-sm text-muted">{fmtDate(p.created_at)}</TD>
                        <TD className="font-semibold text-ink tabular">{money(p.amount)}</TD>
                        <TD className="text-sm text-muted">{PAYOUT_METHODS.find(m => m.value === p.method)?.label || p.method}</TD>
                        <TD><code dir="ltr" className="font-mono text-xs text-muted">{p.reference || '—'}</code></TD>
                        <TD><StatusPill status={p.status === 'paid' ? 'completed' : p.status === 'processing' ? 'pending' : p.status} tone={p.status === 'paid' ? 'success' : p.status === 'processing' ? 'warning' : 'neutral'}>{STATUS_AR[p.status] || p.status}</StatusPill></TD>
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
                <SectionTitle icon={CreditCardIcon} title="طريقة الدفع" subtitle="كيف يدفع عملاؤك؟" />
                <div role="radiogroup" aria-label="طريقة الدفع" className="grid gap-2 sm:grid-cols-3">
                  {PAYMENT_OPTIONS.map(opt => {
                    const selected = profileForm?.payment_method === opt.value
                    return (
                      <button key={opt.value} type="button" role="radio" aria-checked={selected}
                        onClick={() => setProfileForm(f => ({ ...f, payment_method: opt.value }))}
                        className={cn('rounded-card border p-4 text-start transition', selected ? 'border-brand-teal bg-chip/40 shadow-ring' : 'border-line hover:border-line-strong')}>
                        <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', selected ? 'bg-brand-gradient text-[#04282C]' : 'bg-surface-3 text-muted')}><opt.icon className="h-5 w-5" aria-hidden="true" /></span>
                        <span className="mt-3 block text-sm font-semibold text-ink">{opt.label}</span>
                        <span className="mt-1 block text-xs leading-relaxed text-muted">{opt.desc}</span>
                      </button>
                    )
                  })}
                </div>
              </Card>

              {showStripe && (
                <Card>
                  <SectionTitle icon={ShieldCheckIcon} title="حساب Stripe" subtitle="ربط آمن عبر OAuth" />
                  {profile?.stripe_connect_account_id ? (
                    <div className="flex flex-wrap items-center gap-3 rounded-card border border-success/20 bg-success-bg/60 p-4">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-success text-white"><CheckIcon className="h-5 w-5" aria-hidden="true" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-ink">Stripe متصل</p>
                        <p className="text-xs text-muted">يدفع عملاؤك مباشرة إلى حسابك · <span dir="ltr" className="font-mono">{String(profile.stripe_connect_account_id).replace(/^(acct_).*(.{4})$/, '$1••••$2')}</span></p>
                      </div>
                      <Button size="sm" variant="danger-soft" onClick={() => setConfirmDisconnect(true)}>فصل</Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-body">اربط حسابك على Stripe ليدفع عملاؤك لك مباشرة.</p>
                      <a href="/api/reseller/stripe-connect/authorize" className={buttonClasses({ variant: 'dark' })}><CreditCardIcon className="h-[18px] w-[18px]" aria-hidden="true" />الربط مع Stripe</a>
                      <ul className="space-y-1 text-xs text-muted">
                        <li className="flex items-center gap-1.5"><CheckIcon className="h-3.5 w-3.5 text-success" aria-hidden="true" />لا نرى كلمة مرورك أو مفاتيحك على Stripe</li>
                        <li className="flex items-center gap-1.5"><CheckIcon className="h-3.5 w-3.5 text-success" aria-hidden="true" />تذهب المدفوعات مباشرة إلى حسابك</li>
                        <li className="flex items-center gap-1.5"><CheckIcon className="h-3.5 w-3.5 text-success" aria-hidden="true" />يمكنك الفصل في أي وقت</li>
                      </ul>
                    </div>
                  )}
                </Card>
              )}

              {showPayout && (
                <Card>
                  <SectionTitle icon={BanknotesIcon} title="استلام الأرباح" subtitle="متى وكيف نحوّل أرباحك" />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="جدول الصرف">
                      <Select value={profileForm?.payout_schedule || 'monthly'} onChange={e => setProfileForm(f => ({ ...f, payout_schedule: e.target.value }))} options={PAYOUT_SCHEDULES} />
                    </Field>
                    <Field label="طريقة الصرف">
                      <Select value={method} onChange={e => setProfileForm(f => ({ ...f, payout_method: e.target.value }))} options={PAYOUT_METHODS} />
                    </Field>
                  </div>
                  <fieldset className="mt-4 rounded-card border border-line-soft bg-surface-2/60 p-4">
                    <legend className="px-1 text-sm font-medium text-ink">بيانات الصرف</legend>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {(PAYOUT_FIELDS[method] || []).map(f => (
                        <Field key={f.k} label={f.label}>
                          <Input value={details[f.k] || ''} onChange={e => setDetail(f.k, e.target.value)} placeholder={f.ph} type={f.type || 'text'}
                            dir={f.ltr ? 'ltr' : undefined} className={f.mono ? 'font-mono' : undefined} />
                        </Field>
                      ))}
                    </div>
                  </fieldset>
                </Card>
              )}

              <Button size="lg" fullWidth loading={saveProfileMut.isLoading} disabled={!profileForm} onClick={() => saveProfileMut.mutate(profileForm)}>
                {profile ? 'حفظ الإعدادات' : 'حفظ وإرسال الطلب'}
              </Button>
            </div>

            <Card variant="muted" className="lg:sticky lg:top-6">
              <h3 className="font-semibold text-ink">حالة الحساب</h3>
              <div className="mt-3">
                {!profile ? <Badge tone="neutral">لم يُقدَّم طلب بعد</Badge>
                  : profile.is_approved ? <Badge tone="success" dot>معتمد</Badge>
                  : <Badge tone="warning" dot>قيد المراجعة</Badge>}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted">لا تُعرض أي مفاتيح أو أسرار هنا؛ تُحفظ بيانات الربط مشفّرة على الخادم.</p>
            </Card>
          </div>
        )}
      </div>

      {/* Create plan */}
      <Modal open={showPlanForm} onClose={() => setShowPlanForm(false)} size="lg" icon={CubeIcon} title="باقة مخصصة"
        description="اختر الباقة الأساسية (ما تدفعه لنا) وحدّد سعرك لعملائك."
        footer={<><Button variant="secondary" onClick={() => setShowPlanForm(false)}>إلغاء</Button>
          <Button loading={createPlanMut.isLoading} disabled={!planForm.base_plan_id || !planForm.custom_price_monthly} onClick={() => createPlanMut.mutate(planForm)}>إنشاء الباقة</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="الباقة الأساسية" required>
            <Select value={planForm.base_plan_id} onChange={e => setPlanForm(f => ({ ...f, base_plan_id: e.target.value }))} placeholder="اختر الباقة"
              options={basePlans.filter(p => p.price_monthly > 0).map(p => ({ value: p.id, label: `${p.name} — ${money(p.price_monthly)} / شهر (تكلفتك)` }))} />
          </Field>
          <Field label="اسم الباقة لعملائك">
            <Input value={planForm.custom_name} onChange={e => setPlanForm(f => ({ ...f, custom_name: e.target.value }))} placeholder="الباقة الأساسية" />
          </Field>
          <Field label="سعرك الشهري ($)" required>
            <Input type="number" min="0" step="0.01" dir="ltr" value={planForm.custom_price_monthly} onChange={e => setPlanForm(f => ({ ...f, custom_price_monthly: e.target.value }))} placeholder="49" />
          </Field>
          <Field label="سعرك السنوي (اختياري)">
            <Input type="number" min="0" step="0.01" dir="ltr" value={planForm.custom_price_yearly} onChange={e => setPlanForm(f => ({ ...f, custom_price_yearly: e.target.value }))} placeholder="499" />
          </Field>
        </div>
        {profit !== null && (
          <div className={cn('mt-4 flex items-center justify-between rounded-card px-4 py-3 text-sm', profit >= 0 ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger')}>
            <span>ربحك من كل عميل</span>
            <span className="font-bold tabular">{money(profit)} / شهر</span>
          </div>
        )}
      </Modal>

      {/* Create invite */}
      <Modal open={showInviteForm} onClose={() => setShowInviteForm(false)} size="lg" icon={LinkIcon} title="رابط دعوة جديد"
        description="يُنسخ الرابط تلقائيًا بعد إنشائه."
        footer={<><Button variant="secondary" onClick={() => setShowInviteForm(false)}>إلغاء</Button>
          <Button icon={LinkIcon} loading={createInviteMut.isLoading} onClick={() => createInviteMut.mutate({ ...inviteForm, max_uses: inviteForm.max_uses ? parseInt(inviteForm.max_uses) : null })}>إنشاء ونسخ الرابط</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="وصف داخلي">
            <Input value={inviteForm.label} onChange={e => setInviteForm(f => ({ ...f, label: e.target.value }))} placeholder="حملة فيسبوك" />
          </Field>
          <Field label="رمز مخصص (اختياري)" hint="اتركه فارغًا لإنشائه تلقائيًا">
            <Input value={inviteForm.custom_code} onChange={e => setInviteForm(f => ({ ...f, custom_code: e.target.value.toUpperCase() }))} placeholder="JOHN50" dir="ltr" className="font-mono" />
          </Field>
          <Field label="الباقة" className="sm:col-span-2">
            <Select value={inviteForm.reseller_plan_id} onChange={e => setInviteForm(f => ({ ...f, reseller_plan_id: e.target.value }))}
              options={[{ value: '', label: 'أي باقة (يختار المستخدم)' }, ...plans.map(p => ({ value: p.id, label: `${p.custom_name || p.base_plan?.name} — ${money(p.custom_price_monthly)} / شهر` }))]} />
          </Field>
          <Field label="أيام التجربة المجانية">
            <Input type="number" min={0} max={90} dir="ltr" value={inviteForm.trial_days} onChange={e => setInviteForm(f => ({ ...f, trial_days: parseInt(e.target.value) || 0 }))} />
          </Field>
          <Field label="نسبة الخصم %">
            <Input type="number" min={0} max={100} dir="ltr" value={inviteForm.discount_pct} onChange={e => setInviteForm(f => ({ ...f, discount_pct: parseFloat(e.target.value) || 0 }))} />
          </Field>
          <Field label="الحد الأقصى للاستخدام" hint="فارغ = غير محدود">
            <Input type="number" dir="ltr" value={inviteForm.max_uses} onChange={e => setInviteForm(f => ({ ...f, max_uses: e.target.value }))} placeholder="غير محدود" />
          </Field>
        </div>
      </Modal>

      {/* Campaign */}
      <Modal open={showCampForm && referralCount > 0} onClose={() => setShowCampForm(false)} size="lg" icon={MegaphoneIcon} title="حملة جديدة"
        description={`تُرسل إلى عملائك المُحالين (${referralCount} مستخدم).`}
        footer={<><Button variant="secondary" onClick={() => setShowCampForm(false)}>إلغاء</Button>
          <Button icon={campForm.scheduled_at ? CalendarDaysIcon : PaperAirplaneIcon} loading={sendCampMut.isLoading} disabled={!campForm.instance_id || !campForm.message}
            onClick={() => sendCampMut.mutate({ ...campForm, scheduled_at: campForm.scheduled_at ? new Date(campForm.scheduled_at).toISOString() : undefined })}>
            {campForm.scheduled_at ? 'جدولة الحملة' : 'إرسال الآن'}
          </Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="رقم واتساب" required error={campInstances.length === 0 ? 'لا توجد أرقام متصلة. اربط رقم واتساب أولًا.' : undefined}>
            <Select value={campForm.instance_id} onChange={e => setCampForm(f => ({ ...f, instance_id: e.target.value }))} placeholder="اختر الرقم"
              options={campInstances.map(inst => ({ value: inst.id, label: `${inst.display_name || inst.phone_number} (${inst.type === 'cloud_api' ? 'Cloud API' : 'WhatsApp Web'})` }))} />
          </Field>
          <Field label="الجمهور">
            <Select value={campForm.target} onChange={e => setCampForm(f => ({ ...f, target: e.target.value }))}
              options={[{ value: 'all', label: `كل المُحالين (${referralCount})` }, { value: 'active', label: 'المشتركون النشطون فقط' }]} />
          </Field>
          <Field label="الرسالة" required className="sm:col-span-2" hint={<>المتغيرات: <code dir="ltr" className="font-mono">{'{{name}}'}</code> <code dir="ltr" className="font-mono">{'{{phone}}'}</code></>}>
            <Textarea rows={4} value={campForm.message} onChange={e => setCampForm(f => ({ ...f, message: e.target.value }))} placeholder={'مرحبًا {{name}}! لدينا عرض خاص لك…'} />
          </Field>
          <Field label="موعد الإرسال (اختياري)" hint="اتركه فارغًا للإرسال الآن">
            <Input type="datetime-local" dir="ltr" value={campForm.scheduled_at} onChange={e => setCampForm(f => ({ ...f, scheduled_at: e.target.value }))} />
          </Field>
          <Field label="الفاصل بين الرسائل (ثوانٍ)">
            <Input type="number" min={1} max={30} dir="ltr" value={campForm.delay_seconds} onChange={e => setCampForm(f => ({ ...f, delay_seconds: parseInt(e.target.value) || 3 }))} />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog destructive open={!!toDeleteInvite} onClose={() => setToDeleteInvite(null)}
        onConfirm={() => { if (toDeleteInvite) deleteInviteMut.mutate(toDeleteInvite.id) }} loading={deleteInviteMut.isLoading}
        title="حذف رابط الدعوة؟" description="لن يعمل الرابط بعد الحذف، ويبقى العملاء الذين سجّلوا به." confirmLabel="حذف" />
      <ConfirmDialog destructive open={confirmDisconnect} onClose={() => setConfirmDisconnect(false)} onConfirm={disconnectStripe} loading={disconnecting}
        title="فصل حساب Stripe؟" description="لن يتمكن عملاؤك من الدفع مباشرة إلى حسابك حتى تعيد الربط." confirmLabel="فصل" />
    </DashboardLayout>
  )
}
