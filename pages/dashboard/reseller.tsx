// @ts-nocheck
import { usePlanGuard } from '@/hooks/usePlanFeature'
import UpgradeWall from '@/components/UpgradeWall'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import clsx from 'clsx'
import {
  PlusIcon, ClipboardIcon, TrashIcon, CheckIcon, CheckCircleIcon,
  CurrencyDollarIcon, UserGroupIcon, LinkIcon,
  ArrowPathIcon, XMarkIcon, BanknotesIcon,
} from '@heroicons/react/24/outline'

const PAYOUT_METHODS = [
  { value: 'bank_transfer', label: '🏦 Bank Transfer' },
  { value: 'paypal', label: '💳 PayPal' },
  { value: 'wise', label: '💸 Wise' },
  { value: 'crypto', label: '₿ Crypto (USDT/BTC)' },
]

const PAYOUT_SCHEDULES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 15 days' },
  { value: 'monthly', label: 'Monthly' },
]

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="p-1.5 text-slate-400 hover:text-slate-900 flex-shrink-0">
      {copied ? <CheckIcon className="w-3.5 h-3.5 text-blue-600" /> : <ClipboardIcon className="w-3.5 h-3.5" />}
    </button>
  )
}

export default function ResellerPage() {
  const { blocked, isLoading: planLoading } = usePlanGuard('allow_reseller')
  if (planLoading) return null
  if (blocked) return <UpgradeWall feature="allow_reseller" />

  const qc = useQueryClient()
  const router = useRouter()
  const [tab, setTab] = useState(router.query.tab as string || 'overview')

  // Handle Stripe Connect callback
  useEffect(() => {
    if (router.query.success === 'stripe_connected') {
      toast.success('✅ Stripe account connected successfully!')
      router.replace('/dashboard/reseller?tab=settings', undefined, { shallow: true })
    }
    if (router.query.error) {
      const errors = { stripe_denied: 'Stripe connection cancelled', expired: 'Link expired, try again', stripe_error: 'Stripe error, try again', server_error: 'Server error' }
      toast.error(errors[router.query.error as string] || 'Connection failed')
      router.replace('/dashboard/reseller?tab=settings', undefined, { shallow: true })
    }
  }, [router.query])
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [showPlanForm, setShowPlanForm] = useState(false)
  const [inviteForm, setInviteForm] = useState({ label: '', reseller_plan_id: '', trial_days: 14, discount_pct: 0, max_uses: '', custom_code: '' })
  const [planForm, setPlanForm] = useState({ base_plan_id: '', custom_name: '', custom_price_monthly: '', custom_price_yearly: '' })
  const [profileForm, setProfileForm] = useState(null)
  const [giftCode, setGiftCode] = useState('')
  const [showGift, setShowGift] = useState(false)

  const redeemGiftMut = useMutation(
    (code: string) => axios.post('/api/billing/redeem-gift', { code }).then(r => r.data),
    {
      onSuccess: (r) => {
        toast.success(`🎁 ${r.plan} activated for ${r.duration_days} days!`)
        qc.invalidateQueries('reseller-profile')
        setShowGift(false)
        setGiftCode('')
      },
      onError: (e: any) => toast.error(e?.response?.data?.error || 'Invalid gift code'),
    }
  )

  const { data: profileData, isLoading } = useQuery('reseller-profile', () => axios.get('/api/reseller/profile').then(r => r.data), {
    onSuccess: (d) => { if (!profileForm && d.profile) setProfileForm(d.profile) }
  })
  const { data: plansData } = useQuery('reseller-plans', () => axios.get('/api/reseller/plans').then(r => r.data))
  const { data: invitesData } = useQuery('reseller-invites', () => axios.get('/api/reseller/invites').then(r => r.data))
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
        toast.success(`📢 Campaign sent to ${r.target_count} users!`)
      },
      onError: e => toast.error(e?.response?.data?.error || 'Failed'),
    }
  )

  const saveProfileMut = useMutation(
    (body) => axios.put('/api/reseller/profile', body),
    { onSuccess: () => { qc.invalidateQueries('reseller-profile'); toast.success('Settings saved ✅') }, onError: e => toast.error(e?.response?.data?.error || 'Failed') }
  )

  const createPlanMut = useMutation(
    (body) => axios.post('/api/reseller/plans', body),
    { onSuccess: () => { qc.invalidateQueries('reseller-plans'); setShowPlanForm(false); toast.success('Plan created!') }, onError: e => toast.error(e?.response?.data?.error || 'Failed') }
  )

  const createInviteMut = useMutation(
    (body) => axios.post('/api/reseller/invites', body),
    {
      onSuccess: (r) => {
        qc.invalidateQueries('reseller-invites')
        setShowInviteForm(false)
        setInviteForm({ label: '', reseller_plan_id: '', trial_days: 14, discount_pct: 0, max_uses: '', custom_code: '' })
        navigator.clipboard.writeText(r.data.url)
        toast.success('Invite created! Link copied to clipboard 🎉')
      },
      onError: e => toast.error(e?.response?.data?.error || 'Failed')
    }
  )

  const deleteInviteMut = useMutation(
    id => axios.delete(`/api/reseller/invites/${id}`),
    { onSuccess: () => { qc.invalidateQueries('reseller-invites'); toast.success('Deleted') } }
  )

  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://waabek.com'

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'plans', label: '📦 Plans & Pricing' },
    { id: 'invites', label: '🔗 Invite Links' },
    { id: 'referrals', label: '👥 Referrals' },
    { id: 'campaigns', label: '📢 Campaigns' },
    { id: 'payouts', label: '💰 Payouts' },
    { id: 'settings', label: '⚙️ Settings' },
  ]

  return (
    <DashboardLayout title="Reseller Dashboard">
      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200 overflow-x-auto pb-0">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={clsx('px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
              tab === t.id ? 'border-brand-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Approval gate - disable functional tabs until approved */}
      {profile && !profile.is_approved && tab !== 'overview' && tab !== 'settings' && (
        <div className="card border-yellow-800/50 bg-yellow-900/10 mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⏳</span>
            <div>
              <p className="font-semibold text-slate-900">Account pending approval</p>
              <p className="text-sm text-slate-400 mt-0.5">This feature will be unlocked once your reseller account is approved by the admin.</p>
            </div>
            <button onClick={() => setTab('overview')} className="btn-secondary text-sm flex-shrink-0">Back to Overview</button>
          </div>
        </div>
      )}

      {/* ── Overview ─────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="space-y-5">

          {/* Gift Code Redeem */}
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-semibold text-slate-900">🎁 Redeem Gift Code</h3>
                <p className="text-sm text-slate-500 mt-0.5">Have a gift code? Activate a plan instantly — no payment needed</p>
              </div>
              <button onClick={() => setShowGift(v => !v)} className="btn-secondary text-sm">
                {showGift ? 'Hide' : 'Redeem'}
              </button>
            </div>
            {showGift && (
              <div className="mt-4 flex gap-2">
                <input value={giftCode} onChange={e => setGiftCode(e.target.value.toUpperCase())}
                  placeholder="GIFT-XXXX-XXXX" className="input flex-1 font-mono"
                  onKeyDown={e => e.key === 'Enter' && giftCode && redeemGiftMut.mutate(giftCode)} />
                <button onClick={() => giftCode && redeemGiftMut.mutate(giftCode)}
                  disabled={redeemGiftMut.isLoading || !giftCode} className="btn-primary px-4">
                  {redeemGiftMut.isLoading ? '...' : 'Redeem'}
                </button>
              </div>
            )}
          </div>

          {/* Profile exists + not approved = pending review */}
          {profile && !profile.is_approved && (
            <div className="card border-yellow-800/50 bg-yellow-900/10">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⏳</span>
                <div>
                  <p className="font-semibold text-slate-900">Account pending approval</p>
                  <p className="text-sm text-slate-400 mt-0.5">Your reseller account is being reviewed. You'll be notified once approved. Set up your settings in the meantime.</p>
                </div>
              </div>
            </div>
          )}

          {/* No profile yet = prompt to apply */}
          {!profile && (
            <div className="card border-blue-200/50 bg-blue-50/10">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🚀</span>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">Apply to become a Reseller</p>
                  <p className="text-sm text-slate-400 mt-0.5">Fill in your payment settings below and click Save — your application will be sent to the admin for review.</p>
                </div>
                <button onClick={() => setTab('settings')} className="btn-primary text-sm flex-shrink-0">
                  Apply Now →
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Pending Balance', value: `$${(profile?.balance_pending || 0).toFixed(2)}`, icon: BanknotesIcon, color: 'text-blue-600' },
              { label: 'Total Earned', value: `$${(profile?.balance_total || 0).toFixed(2)}`, icon: CurrencyDollarIcon, color: 'text-yellow-400' },
              { label: 'Total Referrals', value: referrals.length, icon: UserGroupIcon, color: 'text-blue-400' },
              { label: 'Commission Rate', value: profile?.referral_commission_pct ? `${profile.referral_commission_pct}%` : 'Set by admin', icon: LinkIcon, color: 'text-purple-400' },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className="flex items-center gap-2 mb-1">
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                  <p className="text-xs text-slate-500">{s.label}</p>
                </div>
                <p className="text-2xl font-display font-bold text-slate-900">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button onClick={() => { setTab('invites'); setShowInviteForm(true) }}
              className="card hover:border-blue-200 transition-colors text-left">
              <div className="text-2xl mb-2">🔗</div>
              <p className="font-semibold text-slate-900">Create Invite Link</p>
              <p className="text-xs text-slate-500 mt-1">Generate a link to invite new users under your account</p>
            </button>
            <button onClick={() => setTab('plans')}
              className="card hover:border-blue-200 transition-colors text-left">
              <div className="text-2xl mb-2">💰</div>
              <p className="font-semibold text-slate-900">Set Your Prices</p>
              <p className="text-xs text-slate-500 mt-1">Customize plan prices for your customers</p>
            </button>
            <button onClick={() => setTab('settings')}
              className="card hover:border-blue-200 transition-colors text-left">
              <div className="text-2xl mb-2">⚙️</div>
              <p className="font-semibold text-slate-900">Payment Settings</p>
              <p className="text-xs text-slate-500 mt-1">Configure how you want to receive your earnings</p>
            </button>
          </div>

          {/* Recent referrals */}
          {referrals.length > 0 && (
            <div className="card">
              <h3 className="font-display font-semibold text-slate-900 mb-3">Recent Referrals</h3>
              <div className="space-y-2">
                {referrals.slice(0, 5).map(r => (
                  <div key={r.id} className="flex items-center justify-between py-2 border-b border-slate-200/50 last:border-0">
                    <div>
                      <p className="text-sm text-slate-900">{r.referred_user?.name || 'Unknown'}</p>
                      <p className="text-xs text-slate-500">{r.referred_user?.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-blue-600">${r.total_earned.toFixed(2)}</p>
                      <p className="text-xs text-slate-500">{r.referred_user?.created_at ? format(new Date(r.referred_user.created_at), 'MMM d') : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Plans & Pricing ──────────────────────────────── */}
      {tab === 'plans' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-slate-400 text-sm">Set custom prices for your customers. You keep the difference!</p>
            <button onClick={() => setShowPlanForm(v => !v)} className="btn-primary text-sm">
              <PlusIcon className="w-4 h-4" /> Add Custom Plan
            </button>
          </div>

          {showPlanForm && (
            <div className="card space-y-4">
              <h3 className="font-display font-semibold text-slate-900">Create Custom Plan</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Base Plan (what you pay us)</label>
                  <select value={planForm.base_plan_id} onChange={e => setPlanForm(f => ({ ...f, base_plan_id: e.target.value }))} className="input">
                    <option value="">Select base plan</option>
                    {basePlans.filter(p => p.price_monthly > 0).map(p => (
                      <option key={p.id} value={p.id}>{p.name} — ${p.price_monthly}/mo (your cost)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Plan Name (shown to customers)</label>
                  <input value={planForm.custom_name} onChange={e => setPlanForm(f => ({ ...f, custom_name: e.target.value }))} placeholder="e.g. Basic Plan" className="input" />
                </div>
                <div>
                  <label className="label">Your Price / Month ($)</label>
                  <input type="number" value={planForm.custom_price_monthly} onChange={e => setPlanForm(f => ({ ...f, custom_price_monthly: e.target.value }))}
                    placeholder="e.g. 49" className="input" min="0" step="0.01" />
                  {planForm.custom_price_monthly && planForm.base_plan_id && (
                    <p className="text-xs text-blue-600 mt-1">
                      💰 Your profit: ${(parseFloat(planForm.custom_price_monthly) - (basePlans.find(p => p.id === planForm.base_plan_id)?.price_monthly || 0)).toFixed(2)}/mo per customer
                    </p>
                  )}
                </div>
                <div>
                  <label className="label">Your Price / Year (optional)</label>
                  <input type="number" value={planForm.custom_price_yearly} onChange={e => setPlanForm(f => ({ ...f, custom_price_yearly: e.target.value }))}
                    placeholder="e.g. 499" className="input" min="0" step="0.01" />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => createPlanMut.mutate(planForm)} disabled={createPlanMut.isLoading || !planForm.base_plan_id || !planForm.custom_price_monthly} className="btn-primary">
                  {createPlanMut.isLoading ? 'Creating...' : 'Create Plan'}
                </button>
                <button onClick={() => setShowPlanForm(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}

          {plans.length === 0 && !showPlanForm ? (
            <div className="card text-center py-12">
              <p className="text-slate-500 text-sm mb-3">No custom plans yet</p>
              <p className="text-slate-600 text-xs">Create plans with your own pricing — you keep the profit between your price and our cost</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.map(plan => {
                const cost = plan.base_plan?.price_monthly || 0
                const profit = plan.custom_price_monthly - cost
                return (
                  <div key={plan.id} className="card">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-bold text-slate-900">{plan.custom_name || plan.base_plan?.name}</p>
                        <p className="text-xs text-slate-500">Based on: {plan.base_plan?.name}</p>
                      </div>
                      <span className="badge-green text-xs">Active</span>
                    </div>
                    <div className="space-y-1 text-sm mb-3">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Your price</span>
                        <span className="text-slate-900 font-bold">${plan.custom_price_monthly}/mo</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Your cost</span>
                        <span className="text-slate-400">${cost}/mo</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-200 pt-1 mt-1">
                        <span className="text-blue-600">Your profit</span>
                        <span className="text-blue-600 font-bold">${profit.toFixed(2)}/mo</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Invite Links ─────────────────────────────────── */}
      {tab === 'invites' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-slate-400 text-sm">{invites.length} invite links</p>
            <button onClick={() => setShowInviteForm(v => !v)} className="btn-primary text-sm">
              <PlusIcon className="w-4 h-4" /> New Invite Link
            </button>
          </div>

          {showInviteForm && (
            <div className="card space-y-4">
              <h3 className="font-display font-semibold text-slate-900">Create Invite Link</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Label (internal)</label>
                  <input value={inviteForm.label} onChange={e => setInviteForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Facebook Campaign" className="input" />
                </div>
                <div>
                  <label className="label">Custom Code (optional)</label>
                  <input value={inviteForm.custom_code} onChange={e => setInviteForm(f => ({ ...f, custom_code: e.target.value.toUpperCase() }))} placeholder="e.g. JOHN50" className="input font-mono" />
                  <p className="text-xs text-slate-500 mt-1">Leave empty to auto-generate</p>
                </div>
                <div>
                  <label className="label">Plan</label>
                  <select value={inviteForm.reseller_plan_id} onChange={e => setInviteForm(f => ({ ...f, reseller_plan_id: e.target.value }))} className="input">
                    <option value="">Any plan (user chooses)</option>
                    {plans.map(p => <option key={p.id} value={p.id}>{p.custom_name || p.base_plan?.name} — ${p.custom_price_monthly}/mo</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Free Trial Days</label>
                  <input type="number" value={inviteForm.trial_days} onChange={e => setInviteForm(f => ({ ...f, trial_days: parseInt(e.target.value) || 0 }))} min={0} max={90} className="input" />
                </div>
                <div>
                  <label className="label">Discount %</label>
                  <input type="number" value={inviteForm.discount_pct} onChange={e => setInviteForm(f => ({ ...f, discount_pct: parseFloat(e.target.value) || 0 }))} min={0} max={100} className="input" />
                </div>
                <div>
                  <label className="label">Max Uses (empty = unlimited)</label>
                  <input type="number" value={inviteForm.max_uses} onChange={e => setInviteForm(f => ({ ...f, max_uses: e.target.value }))} placeholder="Unlimited" className="input" />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => createInviteMut.mutate({ ...inviteForm, max_uses: inviteForm.max_uses ? parseInt(inviteForm.max_uses) : null })}
                  disabled={createInviteMut.isLoading} className="btn-primary">
                  {createInviteMut.isLoading ? 'Creating...' : '🔗 Create & Copy Link'}
                </button>
                <button onClick={() => setShowInviteForm(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {invites.map(invite => {
              const url = `${appUrl}/auth/register?code=${invite.code}`
              return (
                <div key={invite.id} className={clsx('card', !invite.is_active && 'opacity-60')}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-slate-900">{invite.label || invite.code}</p>
                        <code className="text-xs text-blue-600 bg-blue-50/20 px-2 py-0.5 rounded font-mono">{invite.code}</code>
                        <span className={clsx('text-xs px-2 py-0.5 rounded', invite.is_active ? 'badge-green' : 'badge-gray')}>
                          {invite.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-slate-500 truncate flex-1">{url}</code>
                        <CopyBtn text={url} />
                      </div>
                      <div className="flex gap-3 mt-1 text-xs text-slate-500">
                        {invite.trial_days > 0 && <span>🎁 {invite.trial_days} days trial</span>}
                        {invite.discount_pct > 0 && <span>💸 {invite.discount_pct}% off</span>}
                        <span>👥 {invite.use_count}{invite.max_uses ? `/${invite.max_uses}` : ''} uses</span>
                        {invite.reseller_plan && <span>📦 {invite.reseller_plan.custom_name || invite.reseller_plan.base_plan?.name}</span>}
                      </div>
                    </div>
                    <button onClick={() => { if (confirm('Delete?')) deleteInviteMut.mutate(invite.id) }} className="p-1.5 text-slate-500 hover:text-red-400">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
            {invites.length === 0 && !showInviteForm && (
              <div className="card text-center py-12">
                <p className="text-3xl mb-3">🔗</p>
                <p className="text-slate-900 font-semibold mb-1">No invite links yet</p>
                <p className="text-slate-500 text-sm">Create invite links to bring customers to your platform</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Referrals ────────────────────────────────────── */}
      {tab === 'referrals' && (
        <div className="card">
          <h3 className="font-display font-semibold text-slate-900 mb-4">Your Customers ({referrals.length})</h3>
          {referrals.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500 text-sm">No referrals yet — share your invite links to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-slate-200">
                  {['Customer', 'Joined', 'Status', 'Total Earned'].map(h => <th key={h} className="table-head">{h}</th>)}
                </tr></thead>
                <tbody>
                  {referrals.map(r => (
                    <tr key={r.id} className="table-row">
                      <td className="table-cell">
                        <p className="text-sm text-slate-900">{r.referred_user?.name}</p>
                        <p className="text-xs text-slate-500">{r.referred_user?.email}</p>
                      </td>
                      <td className="table-cell text-xs text-slate-400">
                        {r.referred_user?.created_at ? format(new Date(r.referred_user.created_at), 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="table-cell">
                        <span className={r.status === 'active' ? 'badge-green' : 'badge-gray'}>{r.status}</span>
                      </td>
                      <td className="table-cell text-blue-600 font-medium">${r.total_earned.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Campaigns ───────────────────────────────────── */}
      {tab === 'campaigns' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Send WhatsApp messages to all your referred users ({referralCount} users)</p>
            </div>
            <button onClick={() => setShowCampForm(v => !v)} className="btn-primary text-sm">
              <PlusIcon className="w-4 h-4" /> New Campaign
            </button>
          </div>

          {referralCount === 0 && (
            <div className="card text-center py-10">
              <p className="text-3xl mb-2">👥</p>
              <p className="text-slate-900 font-semibold mb-1">No referred users yet</p>
              <p className="text-slate-500 text-sm">Create invite links to get users first, then send them campaigns</p>
            </div>
          )}

          {referralCount > 0 && showCampForm && (
            <div className="card space-y-4">
              <h3 className="font-display font-semibold text-slate-900">New Campaign</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">WhatsApp Instance *</label>
                  <select value={campForm.instance_id} onChange={e => setCampForm(f => ({ ...f, instance_id: e.target.value }))} className="input">
                    <option value="">Select instance</option>
                    {campInstances.map(inst => (
                      <option key={inst.id} value={inst.id}>
                        {inst.display_name || inst.phone_number} ({inst.type === 'cloud_api' ? 'Cloud API' : 'WhatsApp Web'})
                      </option>
                    ))}
                  </select>
                  {campInstances.length === 0 && <p className="text-xs text-red-400 mt-1">No connected instances. Connect WhatsApp first.</p>}
                </div>
                <div>
                  <label className="label">Target Audience</label>
                  <select value={campForm.target} onChange={e => setCampForm(f => ({ ...f, target: e.target.value }))} className="input">
                    <option value="all">All {referralCount} referred users</option>
                    <option value="active">Active subscribers only</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label">Message</label>
                  <textarea value={campForm.message} onChange={e => setCampForm(f => ({ ...f, message: e.target.value }))}
                    rows={4} placeholder={"Hi {{name}}! We have a special offer for you..."} className="input resize-none" />
                  <p className="text-xs text-slate-500 mt-1">Variables: <code className="bg-[#F8FAFC] px-1 rounded text-blue-600">{"{{name}}"}</code> <code className="bg-[#F8FAFC] px-1 rounded text-blue-600">{"{{phone}}"}</code></p>
                </div>
                <div>
                  <label className="label">Schedule (optional)</label>
                  <input type="datetime-local" value={campForm.scheduled_at} onChange={e => setCampForm(f => ({ ...f, scheduled_at: e.target.value }))} className="input" />
                  <p className="text-xs text-slate-500 mt-1">Leave empty to send now</p>
                </div>
                <div>
                  <label className="label">Delay between messages (seconds)</label>
                  <input type="number" value={campForm.delay_seconds} onChange={e => setCampForm(f => ({ ...f, delay_seconds: parseInt(e.target.value) || 3 }))} min={1} max={30} className="input" />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => sendCampMut.mutate({ ...campForm, scheduled_at: campForm.scheduled_at ? new Date(campForm.scheduled_at).toISOString() : undefined })}
                  disabled={sendCampMut.isLoading || !campForm.instance_id || !campForm.message}
                  className="btn-primary">
                  {sendCampMut.isLoading ? <><ArrowPathIcon className="w-4 h-4 animate-spin" /> Sending...</> : campForm.scheduled_at ? '📅 Schedule Campaign' : '📢 Send Now'}
                </button>
                <button onClick={() => setShowCampForm(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}

          {campaigns.length > 0 && (
            <div className="card">
              <h3 className="font-display font-semibold text-slate-900 mb-4">Campaign History</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-slate-200">
                    {['Date', 'Message', 'Target', 'Sent', 'Status'].map(h => <th key={h} className="table-head">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {campaigns.map(c => (
                      <tr key={c.id} className="table-row">
                        <td className="table-cell text-xs text-slate-400">{new Date(c.created_at).toLocaleDateString()}</td>
                        <td className="table-cell text-sm text-slate-700 max-w-xs truncate">{c.message}</td>
                        <td className="table-cell text-sm text-slate-400">{c.target_count} users</td>
                        <td className="table-cell text-sm text-slate-900">{c.sent_count || 0}</td>
                        <td className="table-cell">
                          <span className={clsx('text-xs px-2 py-0.5 rounded font-medium',
                            c.status === 'completed' ? 'badge-green' : c.status === 'sending' ? 'badge-yellow' : 'badge-gray')}>
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Payouts ──────────────────────────────────────── */}
      {tab === 'payouts' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="stat-card border-blue-200/50 bg-blue-50/10">
              <p className="text-xs text-slate-500 mb-1">💰 Pending Payout</p>
              <p className="text-3xl font-display font-bold text-blue-600">${(profile?.balance_pending || 0).toFixed(2)}</p>
              <p className="text-xs text-slate-500 mt-1">Will be paid on next {profile?.payout_schedule || 'monthly'} cycle</p>
            </div>
            <div className="stat-card">
              <p className="text-xs text-slate-500 mb-1">✅ Total Paid Out</p>
              <p className="text-3xl font-display font-bold text-slate-900">${(profile?.balance_paid || 0).toFixed(2)}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs text-slate-500 mb-1">📈 All Time Earned</p>
              <p className="text-3xl font-display font-bold text-slate-900">${(profile?.balance_total || 0).toFixed(2)}</p>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-semibold text-slate-900">Payout History</h3>
              <span className="text-xs text-slate-500">Schedule: {profile?.payout_schedule || 'monthly'}</span>
            </div>
            {payouts.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-6">No payouts yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-slate-200">
                    {['Date', 'Amount', 'Method', 'Reference', 'Status'].map(h => <th key={h} className="table-head">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {payouts.map(p => (
                      <tr key={p.id} className="table-row">
                        <td className="table-cell text-xs">{format(new Date(p.created_at), 'MMM d, yyyy')}</td>
                        <td className="table-cell font-medium text-slate-900">${p.amount.toFixed(2)}</td>
                        <td className="table-cell text-xs text-slate-400">{p.method}</td>
                        <td className="table-cell font-mono text-xs text-slate-500">{p.reference || '—'}</td>
                        <td className="table-cell">
                          <span className={p.status === 'paid' ? 'badge-green' : p.status === 'processing' ? 'badge-yellow' : 'badge-gray'}>{p.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Settings ─────────────────────────────────────── */}
      {tab === 'settings' && (
        <div className="max-w-xl space-y-4">
          <div className="card space-y-4">
            <h3 className="font-display font-semibold text-slate-900">💳 Payment Method</h3>
            <div>
              <label className="label">How do your customers pay?</label>
              <div className="space-y-2">
                {[
                  { value: 'platform', label: '🏦 Through WABEK platform', desc: 'Customers pay us, we send you your earnings every payout cycle. You keep 100% profit.' },
                  { value: 'stripe_own', label: '💳 My own Stripe account', desc: 'Customers pay directly to your Stripe. You handle billing entirely.' },
                  { value: 'both', label: '🔄 Both options', desc: 'Offer both payment methods.' },
                ].map(opt => (
                  <label key={opt.value} className={clsx('flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors',
                    profileForm?.payment_method === opt.value ? 'border-brand-500 bg-blue-50/20' : 'border-slate-200 hover:border-wabek-muted')}>
                    <input type="radio" value={opt.value} checked={profileForm?.payment_method === opt.value}
                      onChange={e => setProfileForm(f => ({ ...f, payment_method: e.target.value }))} className="mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{opt.label}</p>
                      <p className="text-xs text-slate-500">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {(profileForm?.payment_method === 'stripe_own' || profileForm?.payment_method === 'both') && (
              <div className="space-y-3 border-t border-slate-200 pt-4">
                <h4 className="text-sm font-semibold text-slate-900">Stripe Account</h4>
                {profile?.stripe_connect_account_id ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-blue-50/20 border border-blue-200/50 rounded-xl">
                      <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center flex-shrink-0">
                        <CheckIcon className="w-4 h-4 text-slate-900" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">Stripe Connected ✅</p>
                        <p className="text-xs text-slate-400 font-mono">{profile.stripe_connect_account_id}</p>
                      </div>
                      <button onClick={() => {
                        if (confirm('Disconnect Stripe?'))
                          axios.post('/api/reseller/stripe-connect/disconnect')
                            .then(() => { qc.invalidateQueries('reseller-profile'); toast.success('Disconnected') })
                      }} className="text-xs text-red-400 hover:text-red-300 px-2 py-1 border border-red-900/50 rounded-lg">
                        Disconnect
                      </button>
                    </div>
                    <p className="text-xs text-slate-500">✅ Your customers pay directly to your Stripe account.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-4 bg-[#F8FAFC] border border-slate-200 rounded-xl">
                      <p className="text-sm text-slate-700 mb-3">Connect your Stripe account so your customers pay you directly.</p>
                      <a href="/api/reseller/stripe-connect/authorize"
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm text-slate-900 transition-colors"
                        style={{ backgroundColor: '#635BFF' }}>
                        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
                          <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/>
                        </svg>
                        Connect with Stripe
                      </a>
                    </div>
                    <div className="text-xs text-slate-500 space-y-1">
                      <p>✅ Secure OAuth — we never see your Stripe password or keys</p>
                      <p>✅ Payments go directly to your Stripe account</p>
                      <p>✅ You can disconnect anytime</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {(profileForm?.payment_method === 'platform' || profileForm?.payment_method === 'both') && (
            <div className="card space-y-4">
              <h3 className="font-display font-semibold text-slate-900">🏦 Payout Settings</h3>
              <div>
                <label className="label">Payout Schedule</label>
                <select value={profileForm?.payout_schedule || 'monthly'} onChange={e => setProfileForm(f => ({ ...f, payout_schedule: e.target.value }))} className="input">
                  {PAYOUT_SCHEDULES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Payout Method</label>
                <select value={profileForm?.payout_method || 'bank_transfer'} onChange={e => setProfileForm(f => ({ ...f, payout_method: e.target.value }))} className="input">
                  {PAYOUT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Payout Details</label>
                {(() => {
                  const method = profileForm?.payout_method || 'bank_transfer'
                  const details = typeof profileForm?.payout_details === 'object'
                    ? profileForm?.payout_details || {}
                    : {}
                  const setField = (k: string, v: string) =>
                    setProfileForm(f => ({ ...f, payout_details: { ...(typeof f?.payout_details === 'object' ? f.payout_details : {}), [k]: v } }))

                  if (method === 'bank_transfer') return (
                    <div className="space-y-2">
                      {[
                        { k: 'bank_name', label: 'Bank Name', ph: 'e.g. HSBC' },
                        { k: 'account_name', label: 'Account Name', ph: 'Full name on account' },
                        { k: 'iban', label: 'IBAN / Account Number', ph: 'GB29 NWBK 6016 1331 9268 19' },
                        { k: 'swift', label: 'SWIFT / BIC', ph: 'NWBKGB2L' },
                        { k: 'country', label: 'Country', ph: 'United Kingdom' },
                      ].map(f => (
                        <div key={f.k}>
                          <label className="text-xs text-slate-500 block mb-1">{f.label}</label>
                          <input value={details[f.k] || ''} onChange={e => setField(f.k, e.target.value)}
                            placeholder={f.ph} className="input text-sm" />
                        </div>
                      ))}
                    </div>
                  )
                  if (method === 'paypal') return (
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">PayPal Email</label>
                      <input value={details['email'] || ''} onChange={e => setField('email', e.target.value)}
                        placeholder="your@paypal.com" className="input text-sm" type="email" />
                    </div>
                  )
                  if (method === 'wise') return (
                    <div className="space-y-2">
                      {[
                        { k: 'email', label: 'Wise Email', ph: 'your@wise.com' },
                        { k: 'account_id', label: 'Wise Account ID (optional)', ph: 'Pxxxx' },
                      ].map(f => (
                        <div key={f.k}>
                          <label className="text-xs text-slate-500 block mb-1">{f.label}</label>
                          <input value={details[f.k] || ''} onChange={e => setField(f.k, e.target.value)}
                            placeholder={f.ph} className="input text-sm" />
                        </div>
                      ))}
                    </div>
                  )
                  if (method === 'crypto') return (
                    <div className="space-y-2">
                      {[
                        { k: 'network', label: 'Network', ph: 'TRC20 / ERC20 / BEP20' },
                        { k: 'address', label: 'Wallet Address', ph: 'T...' },
                        { k: 'currency', label: 'Currency', ph: 'USDT / BTC / ETH' },
                      ].map(f => (
                        <div key={f.k}>
                          <label className="text-xs text-slate-500 block mb-1">{f.label}</label>
                          <input value={details[f.k] || ''} onChange={e => setField(f.k, e.target.value)}
                            placeholder={f.ph} className="input text-sm font-mono" />
                        </div>
                      ))}
                    </div>
                  )
                  return null
                })()}
              </div>
            </div>
          )}

          <button onClick={() => saveProfileMut.mutate(profileForm)} disabled={saveProfileMut.isLoading || !profileForm} className="btn-primary w-full justify-center">
            {saveProfileMut.isLoading ? <><ArrowPathIcon className="w-4 h-4 animate-spin" /> Saving...</> : '💾 Save Settings'}
          </button>
        </div>
      )}
    </DashboardLayout>
  )
}
