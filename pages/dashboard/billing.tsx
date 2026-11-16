// @ts-nocheck
import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { CheckIcon, CreditCardIcon, ArrowTopRightOnSquareIcon, BoltIcon, GiftIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/router'
import { format } from 'date-fns'
import clsx from 'clsx'

export default function BillingPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const [cycle, setCycle] = useState('monthly')
  const [showGift, setShowGift] = useState(false)
  const [giftCode, setGiftCode] = useState('')

  // Wix-origin accounts must manage billing/upgrades inside Wix only
  // (Wix Internal Pricing requirement) — redirect away from this page.
  const { data: meData, isLoading: meLoading } = useQuery('me', () => axios.get('/api/auth/me').then(r => r.data))
  const me = meData?.user

  useEffect(() => {
    if (me?.wix_instance_id) {
      router.replace('/wix-setup?tab=billing')
    }
  }, [me, router])

  const { data, isLoading } = useQuery('billing', () => axios.get('/api/billing').then(r => r.data), {
    refetchOnWindowFocus: true, staleTime: 0,
    enabled: !meLoading && !me?.wix_instance_id,
  })

  const plans = data?.plans || []
  const sub = data?.subscription
  const currentPlanId = sub?.plan_id || null
  // Admin Assigned = has plan but no stripe subscription ID at all
  const isManualSub = sub?.id === 'manual' && !sub?.stripe_subscription_id
  const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end) : null

  useEffect(() => {
    if (router.query.success) {
      toast.success('🎉 Subscription activated!')
      qc.invalidateQueries('billing')
      router.replace('/dashboard/billing', undefined, { shallow: true })
    }
    if (router.query.cancelled) {
      toast('Checkout cancelled', { icon: '↩️' })
      router.replace('/dashboard/billing', undefined, { shallow: true })
    }
  }, [router.query])

  const checkoutMut = useMutation(
    body => axios.post('/api/billing', { action: 'checkout', ...body }).then(r => r.data),
    { onSuccess: d => { if (d.url) window.location.href = d.url }, onError: e => {
      const msg = e?.response?.data?.error || 'Stripe error'
      if (e?.response?.status === 409) {
        // Already subscribed → plan changes / cancellation go through Manage billing.
        if (window.confirm(`${msg}\n\nOpen "Manage billing" now?`)) portalMut.mutate()
        return
      }
      toast.error(msg)
    } }
  )
  const portalMut = useMutation(
    () => axios.post('/api/billing', { action: 'portal' }).then(r => r.data),
    { onSuccess: d => { if (d.url) window.location.href = d.url }, onError: e => toast.error(e?.response?.data?.error || 'Stripe portal not configured') }
  )
  const redeemMut = useMutation(
    code => axios.post('/api/billing/redeem-gift', { code }).then(r => r.data),
    {
      onSuccess: r => { toast.success(`🎁 ${r.plan} activated for ${r.duration_days} days!`); qc.invalidateQueries('billing'); setShowGift(false); setGiftCode('') },
      onError: e => toast.error(e?.response?.data?.error || 'Invalid gift code'),
    }
  )

  const planColors = ['#3B82F6', '#00D46A', '#A855F7', '#F59E0B']

  if (meLoading || me?.wix_instance_id) {
    return (
      <DashboardLayout title="Billing">
        <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
          {me?.wix_instance_id ? 'Redirecting to Wix billing…' : 'Loading…'}
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Billing & Plans">
      <div className="max-w-5xl space-y-6">

        {/* Current subscription */}
        {!isLoading && sub && (
          <div className="card border-blue-200/50 bg-blue-50/10">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <CreditCardIcon className="w-5 h-5 text-blue-600" />
                  <h3 className="font-display font-semibold text-slate-900">
                    Current Plan: <span className="text-blue-600">{sub.plans?.name || 'Active'}</span>
                  </h3>
                  <span className="badge-green text-xs">Active</span>
                  {isManualSub && <span className="text-[10px] text-slate-500 bg-[#F8FAFC] px-2 py-0.5 rounded">Admin Assigned</span>}
                </div>
                <div className="text-sm text-slate-400 space-y-1">
                  {!isManualSub && sub.billing_cycle && <p>📅 {sub.billing_cycle === 'yearly' ? 'Yearly' : 'Monthly'} billing</p>}
                  {periodEnd && <p>{sub.cancel_at_period_end ? '⚠️ Cancels' : '🔄 Renews'} {format(periodEnd, 'MMM d, yyyy')}</p>}
                  {sub.plans && (
                    <div className="flex flex-wrap gap-3 mt-1 text-xs">
                      <span className="text-slate-500">💬 <span className="text-slate-900">{sub.plans.max_messages_month === -1 ? '∞' : sub.plans.max_messages_month?.toLocaleString()}</span> msgs/mo</span>
                      <span className="text-slate-500">👥 <span className="text-slate-900">{sub.plans.max_contacts === -1 ? '∞' : sub.plans.max_contacts?.toLocaleString()}</span> contacts</span>
                      <span className="text-slate-500">📱 <span className="text-slate-900">{sub.plans.max_instances}</span> WA instances</span>
                    </div>
                  )}
                </div>
              </div>
              {!isManualSub && sub.stripe_subscription_id && (
                <button onClick={() => portalMut.mutate()} disabled={portalMut.isLoading} className="btn-secondary text-sm flex-shrink-0">
                  <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                  {portalMut.isLoading ? 'Loading…' : 'Manage Subscription'}
                </button>
              )}
            </div>
          </div>
        )}

        {!isLoading && !sub && (
          <div className="card border-yellow-800/50 bg-yellow-900/10">
            <div className="flex items-start gap-3">
              <BoltIcon className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-yellow-400">No active subscription</p>
                <p className="text-sm text-slate-400 mt-0.5">Choose a plan below to unlock all features.</p>
              </div>
            </div>
          </div>
        )}

        {/* Gift code */}
        <div>
          <button onClick={() => setShowGift(v => !v)} className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-500">
            <GiftIcon className="w-4 h-4" />
            {showGift ? 'Hide gift code' : 'Have a gift code? Redeem here'}
          </button>
          {showGift && (
            <div className="card max-w-md mt-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-900">🎁 Redeem Gift Code</h3>
                <button onClick={() => setShowGift(false)} className="text-slate-400 hover:text-slate-900"><XMarkIcon className="w-4 h-4" /></button>
              </div>
              <div className="flex gap-2">
                <input value={giftCode} onChange={e => setGiftCode(e.target.value.toUpperCase())} placeholder="GIFT-XXXX-XXXX"
                  className="input flex-1 font-mono text-slate-800" onKeyDown={e => e.key === 'Enter' && giftCode && redeemMut.mutate(giftCode)} />
                <button onClick={() => redeemMut.mutate(giftCode)} disabled={redeemMut.isLoading || !giftCode} className="btn-primary text-sm px-4">
                  {redeemMut.isLoading ? '...' : 'Redeem'}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2">Gift codes activate a plan immediately — no payment needed.</p>
            </div>
          )}
        </div>

        {/* Cycle toggle */}
        {plans.some(p => p.price_yearly > 0) && (
          <div className="flex bg-[#F8FAFC] rounded-xl p-1 gap-1 w-fit">
            {['monthly', 'yearly'].map(c => (
              <button key={c} onClick={() => setCycle(c)}
                className={clsx('px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize',
                  cycle === c ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-white')}>
                {c}
                {c === 'yearly' && <span className="ml-1.5 text-[10px] bg-blue-50/60 text-blue-600 px-1.5 py-0.5 rounded-full">Save ~17%</span>}
              </button>
            ))}
          </div>
        )}

        {/* Plans grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1,2,3].map(i => <div key={i} className="card h-80 skeleton rounded-2xl" />)}
          </div>
        ) : plans.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-slate-400 font-medium mb-1">No plans configured yet</p>
            <p className="text-slate-500 text-sm">Admin → Plans to set up subscription plans</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {plans.map((plan, i) => {
              const price = cycle === 'yearly' && plan.price_yearly > 0 ? plan.price_yearly : plan.price_monthly
              const priceId = cycle === 'yearly' && plan.stripe_price_id_yearly ? plan.stripe_price_id_yearly : plan.stripe_price_id_monthly
              const isCurrent = currentPlanId === plan.id
              const isPopular = plan.sort_order === 1 || plan.name?.toLowerCase() === 'pro'
              const color = planColors[i % planColors.length]

              const features = [
                `${plan.max_messages_month === -1 ? 'Unlimited' : plan.max_messages_month?.toLocaleString()} messages/month`,
                `${plan.max_contacts === -1 ? 'Unlimited' : plan.max_contacts?.toLocaleString()} contacts`,
                `${plan.max_instances} WhatsApp instance${plan.max_instances > 1 ? 's' : ''}`,
                plan.max_team_members > 1 ? `${plan.max_team_members} team members` : null,
                plan.allow_api_access ? 'REST API access' : null,
                plan.allow_chatbot ? 'Chatbot builder' : null,
                plan.allow_automation ? 'Automation flows' : null,
                plan.allow_white_label ? 'White label & custom domain' : null,
                plan.allow_sub_accounts && plan.max_sub_accounts > 0 ? `${plan.max_sub_accounts} sub-accounts` : null,
                plan.allow_reseller ? 'Reseller system' : null,
                ...(plan.features || []),
              ].filter(Boolean)

              return (
                <div key={plan.id} className={clsx(
                  'card relative flex flex-col transition-all duration-200 hover:-translate-y-1',
                  isCurrent ? 'border-brand-500/60 bg-blue-50/10' : isPopular ? 'border-brand-500 shadow-lg shadow-brand-500/10' : 'hover:border-slate-200'
                )}>
                  {(isCurrent || isPopular) && (
                    <div className={clsx('absolute -top-3.5 left-1/2 -translate-x-1/2 text-slate-900 text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap',
                      isCurrent ? 'bg-slate-100' : 'bg-brand-500')}>
                      {isCurrent ? 'CURRENT PLAN' : 'MOST POPULAR'}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <h3 className="font-display font-bold text-lg text-slate-900">{plan.name}</h3>
                  </div>
                  {plan.description && <p className="text-xs text-slate-500 mb-3">{plan.description}</p>}

                  <div className="flex items-end gap-1 mb-5">
                    {price === 0 ? (
                      <span className="text-3xl font-display font-extrabold text-slate-900">Free</span>
                    ) : (
                      <>
                        <span className="text-4xl font-display font-extrabold text-slate-900">${price}</span>
                        <span className="text-slate-400 mb-1.5 text-sm">/{cycle === 'yearly' ? 'yr' : 'mo'}</span>
                      </>
                    )}
                  </div>

                  <ul className="space-y-2 flex-1 mb-5">
                    {features.slice(0, 9).map(f => (
                      <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                        <CheckIcon className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />{f}
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <div className="btn-secondary justify-center opacity-60 cursor-default text-sm pointer-events-none">✓ Current Plan</div>
                  ) : price === 0 ? (
                    <div className="btn-secondary justify-center opacity-60 cursor-default text-sm pointer-events-none">Free Plan</div>
                  ) : !priceId ? (
                    <div className="btn-secondary justify-center opacity-40 cursor-not-allowed text-xs pointer-events-none">Coming soon</div>
                  ) : (
                    <button
                      onClick={() => checkoutMut.mutate({ plan_id: plan.id, billing_cycle: cycle, price_id: priceId, reseller_id: plan.reseller_id, reseller_plan_id: plan.reseller_plan_id })}
                      disabled={checkoutMut.isLoading}
                      className={clsx('text-sm justify-center', isPopular ? 'btn-primary' : 'btn-secondary')}>
                      {checkoutMut.isLoading ? 'Loading…' : sub ? 'Switch Plan' : 'Get Started'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="flex flex-wrap gap-4 text-xs text-slate-600 pt-2">
          <span>🔒 Payments secured by Stripe · 256-bit SSL</span>
          <a href="/legal/refund" target="_blank" className="hover:text-slate-400 transition-colors">Refund Policy</a>
          <a href="/legal/terms" target="_blank" className="hover:text-slate-400 transition-colors">Terms of Service</a>
        </div>
      </div>
    </DashboardLayout>
  )
}
