// @ts-nocheck
import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  CreditCardIcon, ArrowTopRightOnSquareIcon, BoltIcon, LockClosedIcon, CalendarDaysIcon,
  ArrowPathIcon, ExclamationTriangleIcon, ReceiptPercentIcon,
} from '@heroicons/react/24/outline'
import { useRouter } from 'next/router'
import { Badge, Button, Card, ConfirmDialog, EmptyState, PageHeader, Skeleton, Spinner, Tabs } from '@/components/ui'
import { ErrorState, Notice, apiError } from '@/components/settings/Shared'
import { PlanCard, yearlySaving } from '@/components/billing/PlanCard'
import { UsageMeters, GiftCodeCard } from '@/components/billing/UsageMeters'
import { fmtDate } from '@/components/settings/format'

export default function BillingPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const [cycle, setCycle] = useState('monthly')
  const [alreadySubscribed, setAlreadySubscribed] = useState<string | null>(null)
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null)

  // Wix-origin accounts must manage billing/upgrades inside Wix only
  // (Wix Internal Pricing requirement) — redirect away from this page.
  const { data: meData, isLoading: meLoading } = useQuery('me', () => axios.get('/api/auth/me').then(r => r.data))
  const me = meData?.user

  useEffect(() => {
    if (me?.wix_instance_id) {
      router.replace('/wix-setup?tab=billing')
    }
  }, [me, router])

  const { data, isLoading, isError, error, refetch } = useQuery('billing', () => axios.get('/api/billing').then(r => r.data), {
    refetchOnWindowFocus: true, staleTime: 0,
    enabled: !meLoading && !me?.wix_instance_id,
  })

  // Usage for the meters (same stats the home page uses).
  const { data: statsData, isLoading: statsLoading } = useQuery('billing-usage', () => axios.get('/api/dashboard/stats').then(r => r.data), {
    enabled: !meLoading && !me?.wix_instance_id, staleTime: 60000, retry: false,
  })
  const usage = statsData?.stats ? {
    messages: statsData.stats.sent_this_month || 0,
    contacts: statsData.stats.total_contacts || 0,
    instances: (statsData.instances || []).length,
  } : null

  const plans = data?.plans || []
  const sub = data?.subscription
  const currentPlanId = sub?.plan_id || null
  // Admin Assigned = has plan but no stripe subscription ID at all
  const isManualSub = sub?.id === 'manual' && !sub?.stripe_subscription_id
  const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end) : null
  const hasYearly = plans.some(p => p.price_yearly > 0)
  const maxSaving = Math.max(0, ...plans.map(yearlySaving))

  useEffect(() => {
    if (router.query.success) {
      toast.success('تم تفعيل الاشتراك')
      qc.invalidateQueries('billing')
      router.replace('/dashboard/billing', undefined, { shallow: true })
    }
    if (router.query.cancelled) {
      toast('أُلغيت عملية الدفع')
      router.replace('/dashboard/billing', undefined, { shallow: true })
    }
  }, [router.query])

  const checkoutMut = useMutation(
    body => axios.post('/api/billing', { action: 'checkout', ...body }).then(r => r.data),
    { onSuccess: d => { if (d.url) window.location.href = d.url }, onError: e => {
      const msg = e?.response?.data?.error || 'خطأ في Stripe'
      if (e?.response?.status === 409) {
        // Already subscribed → plan changes / cancellation go through Manage billing.
        setAlreadySubscribed(msg)
        return
      }
      toast.error(msg)
    }, onSettled: () => setPendingPlanId(null) }
  )
  const portalMut = useMutation(
    () => axios.post('/api/billing', { action: 'portal' }).then(r => r.data),
    { onSuccess: d => { if (d.url) window.location.href = d.url }, onError: e => toast.error(e?.response?.data?.error || 'بوابة Stripe غير مُعدّة') }
  )
  const redeemMut = useMutation(
    code => axios.post('/api/billing/redeem-gift', { code }).then(r => r.data),
    {
      onSuccess: r => { toast.success(`تم تفعيل ${r.plan} لمدة ${r.duration_days} يومًا`); qc.invalidateQueries('billing') },
      onError: e => toast.error(e?.response?.data?.error || 'رمز الهدية غير صالح'),
    }
  )

  if (meLoading || me?.wix_instance_id) {
    return (
      <DashboardLayout title="Billing">
        <div className="flex items-center justify-center gap-3 py-20 text-sm text-muted">
          <Spinner className="h-5 w-5 text-brand-ink" />
          {me?.wix_instance_id ? 'جارٍ التحويل إلى الفوترة في Wix…' : 'جارٍ التحميل…'}
        </div>
      </DashboardLayout>
    )
  }

  const choose = (plan, priceId) => {
    setPendingPlanId(plan.id)
    checkoutMut.mutate({ plan_id: plan.id, billing_cycle: cycle, price_id: priceId, reseller_id: plan.reseller_id, reseller_plan_id: plan.reseller_plan_id })
  }

  return (
    <DashboardLayout title="Billing & Plans">
      <div className="space-y-6">
        <PageHeader
          eyebrow="الإعدادات"
          title="الفوترة والباقة"
          description="تابع استهلاكك، وغيّر باقتك، وأدر طريقة الدفع والفواتير من بوابة Stripe."
          actions={!isManualSub && sub?.stripe_subscription_id
            ? <Button variant="secondary" icon={ArrowTopRightOnSquareIcon} loading={portalMut.isLoading} onClick={() => portalMut.mutate()}>إدارة الفوترة</Button>
            : undefined}
        />

        {/* Current plan + usage */}
        {isLoading ? (
          <Skeleton className="h-56 w-full rounded-panel" />
        ) : isError ? (
          <ErrorState message={apiError(error, 'تعذّر تحميل بيانات الفوترة')} onRetry={() => refetch()} />
        ) : sub ? (
          <Card padding="none" className="overflow-hidden">
            <div className="relative overflow-hidden bg-deep-hero px-6 py-6 text-deep-ink sm:px-7">
              <div aria-hidden="true" className="pointer-events-none absolute -end-16 -top-16 h-48 w-48 rounded-full bg-brand-green/20 blur-3xl" />
              <div className="relative flex flex-wrap items-center gap-5">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient text-[#04282C] shadow-glow">
                  <CreditCardIcon className="h-7 w-7" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-deep-muted">باقتك الحالية</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-bold">{sub.plans?.name || 'نشطة'}</h2>
                    <Badge tone="success" dot size="sm">نشطة</Badge>
                    {isManualSub && <Badge tone="neutral" size="sm">مُعيّنة من الإدارة</Badge>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-deep-muted">
                    {!isManualSub && sub.billing_cycle && <span className="flex items-center gap-1.5"><ArrowPathIcon className="h-4 w-4" aria-hidden="true" />فوترة {sub.billing_cycle === 'yearly' ? 'سنوية' : 'شهرية'}</span>}
                    {periodEnd && (
                      <span className="flex items-center gap-1.5">
                        {sub.cancel_at_period_end ? <ExclamationTriangleIcon className="h-4 w-4 text-[#F5C26B]" aria-hidden="true" /> : <CalendarDaysIcon className="h-4 w-4" aria-hidden="true" />}
                        {sub.cancel_at_period_end ? 'تنتهي في' : 'تتجدد في'} {fmtDate(periodEnd)}
                      </span>
                    )}
                  </div>
                </div>
                {!isManualSub && sub.stripe_subscription_id && (
                  <Button variant="on-deep" icon={ArrowTopRightOnSquareIcon} loading={portalMut.isLoading} onClick={() => portalMut.mutate()}>إدارة الاشتراك</Button>
                )}
              </div>
            </div>
            <div className="space-y-3 p-5 sm:p-6">
              <p className="text-sm font-medium text-ink">الاستهلاك</p>
              <UsageMeters plan={sub.plans} usage={usage} loading={statsLoading} />
              {!isManualSub && sub.stripe_subscription_id && (
                <p className="flex items-center gap-2 text-xs text-muted">
                  <ReceiptPercentIcon className="h-4 w-4" aria-hidden="true" />
                  الفواتير وطرق الدفع متاحة في «إدارة الفوترة».
                </p>
              )}
            </div>
          </Card>
        ) : (
          <Notice tone="warning" icon={BoltIcon} title="لا يوجد اشتراك نشط">اختر باقة من الأسفل لفتح جميع المزايا.</Notice>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="contents">
            <div>
              <h2 className="text-xl font-bold text-ink">الباقات</h2>
              {data?.isResellerBilling && <p className="mt-0.5 text-sm text-muted">باقات مقدّمة من موزّعك</p>}
            </div>
            {hasYearly && (
              <Tabs variant="segmented" size="sm" idPrefix="cycle" aria-label="دورة الفوترة" value={cycle} onChange={setCycle} tabs={[
                { id: 'monthly', label: 'شهري' },
                { id: 'yearly', label: maxSaving > 0 ? `سنوي · وفّر حتى ${maxSaving}%` : 'سنوي' },
              ]} />
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr))]">
            {[0, 1, 2].map(i => <Skeleton key={i} className="h-96 rounded-panel" />)}
          </div>
        ) : isError ? null : plans.length === 0 ? (
          <EmptyState variant="card" icon={CreditCardIcon} title="لا توجد باقات بعد" description="لم تُضف أي باقات اشتراك حتى الآن. تُدار الباقات من لوحة الإدارة." />
        ) : (
          <div className="grid gap-5 pt-2 [grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr))]">
            {plans.map(plan => (
              <PlanCard
                key={plan.id + (plan.reseller_plan_id || '')}
                plan={plan}
                cycle={cycle}
                isCurrent={currentPlanId === plan.id}
                isPopular={plan.sort_order === 1 || plan.name?.toLowerCase() === 'pro'}
                hasSub={!!sub}
                choosing={checkoutMut.isLoading && pendingPlanId === plan.id}
                onChoose={priceId => choose(plan, priceId)}
              />
            ))}
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-[minmax(0,420px)_1fr] md:items-start">
          <GiftCodeCard loading={redeemMut.isLoading} onRedeem={(code, done) => redeemMut.mutate(code, { onSuccess: done })} />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted md:pt-4">
            <span className="flex items-center gap-1.5"><LockClosedIcon className="h-4 w-4" aria-hidden="true" />المدفوعات مؤمّنة عبر Stripe</span>
            <a href="/legal/refund" target="_blank" rel="noopener noreferrer" className="text-link hover:text-link-hover">سياسة الاسترداد</a>
            <a href="/legal/terms" target="_blank" rel="noopener noreferrer" className="text-link hover:text-link-hover">شروط الخدمة</a>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!alreadySubscribed}
        onClose={() => setAlreadySubscribed(null)}
        onConfirm={() => { setAlreadySubscribed(null); portalMut.mutate() }}
        loading={portalMut.isLoading}
        title="لديك اشتراك نشط بالفعل"
        description={<>تغيير الباقة أو إلغاؤها يتم من «إدارة الفوترة».<span className="mt-2 block text-xs opacity-80" dir="auto">{alreadySubscribed}</span></>}
        confirmLabel="فتح إدارة الفوترة"
        cancelLabel="ليس الآن"
      />
    </DashboardLayout>
  )
}
