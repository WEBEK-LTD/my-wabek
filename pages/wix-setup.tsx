// @ts-nocheck
import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import {
  ArrowTopRightOnSquareIcon, BanknotesIcon, ChartBarIcon, ChatBubbleLeftEllipsisIcon, CheckCircleIcon, CheckIcon,
  CreditCardIcon, ExclamationTriangleIcon, LightBulbIcon, MagnifyingGlassIcon, MegaphoneIcon, PaperAirplaneIcon,
  ShoppingCartIcon, SparklesIcon, TruckIcon, UserGroupIcon, XCircleIcon,
} from '@heroicons/react/24/outline'
import { Badge, Button, Card, CardHeader, EmptyState, Field, Logo, Spinner, StatCard, Tabs, Textarea } from '@/components/ui'
import { cn } from '@/components/ui/utils'

// The signed Wix `instance` param proves which store this page belongs to.
// Every /api/wix call sends it; the server derives the account from it.
let WIX_INSTANCE = ''
const wixFetch = (url: string, init: any = {}) =>
  fetch(url, { ...init, headers: { ...(init.headers || {}), 'x-wix-instance': WIX_INSTANCE } })

export default function WixSetupPage() {
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [userId, setUserId]           = useState('')
  const [instanceId, setInstanceId]   = useState('')
  const [instances, setInstances]     = useState<any[]>([])
  const [userPlan, setUserPlan]       = useState<any>(null)
  const [tab, setTab]                 = useState<'status'|'messages'|'billing'>(() => {
    if (typeof window !== 'undefined') {
      const t = new URLSearchParams(window.location.search).get('tab')
      if (t === 'messages' || t === 'billing') return t
    }
    return 'status'
  })
  const [templates, setTemplates]     = useState<any>({})
  const [tplSaving, setTplSaving]     = useState(false)
  const [tplSaved, setTplSaved]       = useState(false)
  const [openingDash, setOpeningDash] = useState(false)
  const [stats, setStats]             = useState({ messages: 0, contacts: 0, campaigns: 0 })
  const [diagLoading, setDiagLoading] = useState(false)
  const [diagResult, setDiagResult]   = useState<any>(null)
  const [wixPlanId, setWixPlanId]     = useState('') // Wix vendor product id (from auto-connect)

  const DEFAULT_TEMPLATES = {
    order_placed:    '🛒 Order Confirmed!\n\nHi {{customer_name}}, your order #{{order_id}} has been placed.\n💰 Total: {{total}}\n\nThank you! 🙏',
    order_paid:      '✅ Payment Received!\n\nHi {{customer_name}}, payment for order #{{order_id}} confirmed.\n💰 {{total}}',
    order_shipped:   '🚚 Order Shipped!\n\nHi {{customer_name}}, order #{{order_id}} is on its way!\n📦 Tracking: {{tracking_number}}',
    order_cancelled: '❌ Order Cancelled\n\nHi {{customer_name}}, order #{{order_id}} has been cancelled.',
  }

  const connectedInstance = instances.find(i => i.status === 'connected')

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const params  = new URLSearchParams(window.location.search)
    const instJwt = params.get('instance') || ''
    if (!instJwt) { setError('Please open from your Wix Dashboard.'); setLoading(false); return }
    WIX_INSTANCE = instJwt

    wixFetch('/api/wix/auto-connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instance: instJwt }),
    })
      .then(r => r.json())
      .then(async d => {
        if (d.success) {
          setUserId(d.user_id)
          setInstanceId(d.instance_id)
          if (d.vendor_product_id) setWixPlanId(d.vendor_product_id)
          await Promise.all([
            loadInstances(d.instance_id),
            loadUserPlan(d.user_id),
            loadTemplates(d.instance_id),
            loadStats(d.user_id),
          ])
        } else {
          setError(d.error || 'Connection failed')
        }
        setLoading(false)
      })
      .catch(() => { setError('Connection failed. Please refresh.'); setLoading(false) })
  }, [])

  const loadStats = async (uid: string) => {
    try {
      const r = await wixFetch(`/api/wix/stats`)
      const d = await r.json()
      if (d) setStats({ messages: d.messages || 0, contacts: d.contacts || 0, campaigns: d.campaigns || 0 })
    } catch {}
  }

  const loadInstances = async (instId: string) => {
    if (!instId) return
    const r = await wixFetch(`/api/wix/instances`).catch(() => null)
    const d = await r?.json().catch(() => null)
    if (d?.instances) setInstances(d.instances)
  }

  const loadUserPlan = async (uid: string) => {
    const r = await wixFetch(`/api/wix/user-plan`).catch(() => null)
    const d = await r?.json().catch(() => null)
    if (d?.plan) setUserPlan(d.plan)
  }

  const loadTemplates = async (instId: string) => {
    const r = await wixFetch(`/api/wix/templates`).catch(() => null)
    const d = await r?.json().catch(() => null)
    setTemplates({ ...DEFAULT_TEMPLATES, ...(d?.templates || {}) })
  }

  const runDiagnostics = async () => {
    setDiagLoading(true)
    setDiagResult(null)
    const checks: any[] = []

    // 1. Check Wix instance link
    try {
      const r = await wixFetch(`/api/wix/instances`)
      const d = await r.json()
      const linked = !!(d.instances)
      checks.push({ label: 'Wix store linked to WABEK account', ok: linked, detail: linked ? `Instance: ${instanceId}` : 'No link found in DB' })

      // 2. Check WhatsApp instance
      const connected = d.instances?.find((i: any) => i.status === 'connected')
      const hasAny    = d.instances?.length > 0
      checks.push({ label: 'WhatsApp instance exists', ok: hasAny, detail: hasAny ? `${d.instances.length} instance(s) found` : 'No WhatsApp instances in this account' })
      checks.push({ label: 'WhatsApp connected', ok: !!connected, detail: connected ? `${connected.phone_number || connected.name || connected.id}` : hasAny ? `Status: ${d.instances[0]?.status || 'unknown'}` : 'No instance' })
    } catch (e: any) {
      checks.push({ label: 'API connection', ok: false, detail: e.message })
    }

    // 3. Check WABEK account
    checks.push({ label: 'WABEK account created', ok: !!userId, detail: userId ? `User ID: ${userId.slice(0,8)}...` : 'No user ID' })

    // 4. Check Wix plan
    checks.push({ label: 'Plan detected', ok: !!userPlan?.name, detail: userPlan?.name ? `Plan: ${userPlan.name}` : 'No plan (Free)' })

    setDiagResult(checks)
    setDiagLoading(false)
  }

  const openDashboard = async (path = '/dashboard') => {
    setOpeningDash(true)
    try {
      const r = await wixFetch('/api/wix/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const d = await r.json()
      // Append redirect param so magic login goes to correct page
      const baseUrl = d.url || `https://waabek.com/auth/magic`
      const url = baseUrl.includes('?')
        ? `${baseUrl}&redirect=${encodeURIComponent(path)}`
        : `${baseUrl}?redirect=${encodeURIComponent(path)}`
      window.open(url, '_blank')
    } catch {
      window.open(`https://waabek.com${path}`, '_blank')
    }
    setOpeningDash(false)
  }

  const saveTemplates = async () => {
    setTplSaving(true)
    await wixFetch('/api/wix/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instance_id: instanceId, templates }),
    }).catch(() => null)
    setTplSaved(true)
    setTimeout(() => setTplSaved(false), 2000)
    setTplSaving(false)
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  const NOTIF_EVENTS = [
    { label: 'New Order', icon: ShoppingCartIcon },
    { label: 'Order Paid', icon: BanknotesIcon },
    { label: 'Order Shipped', icon: TruckIcon },
    { label: 'Order Cancelled', icon: XCircleIcon },
  ]

  const shell = (children: React.ReactNode, title = 'WABEK') => (
    <>
      <Head><title>{title}</title></Head>
      <div dir="ltr" lang="en" className="min-h-screen bg-canvas text-ink">
        <div className="mx-auto max-w-[600px] px-4 py-5">{children}</div>
      </div>
    </>
  )

  if (loading) return shell(
    <div className="flex flex-col items-center gap-3 py-16 text-sm text-muted" role="status">
      <Spinner className="h-7 w-7 text-brand-teal" />
      <p>Connecting...</p>
    </div>
  )

  if (error) return shell(
    <div className="pt-10">
      <EmptyState variant="card" icon={ExclamationTriangleIcon} title={error} />
    </div>
  )

  return shell(
    <>
      {/* Header */}
      <header className="relative mb-5 flex items-center gap-3 overflow-hidden rounded-card bg-deep-hero px-4 py-3.5">
        <Logo size={34} tone="light" />
        <span className="text-sm font-medium text-deep-muted">WhatsApp</span>
        <span className="ms-auto inline-flex items-center gap-2 text-xs text-deep-muted">
          <span className={cn('h-2.5 w-2.5 rounded-full', connectedInstance ? 'bg-brand-green shadow-[0_0_0_3px_rgba(139,224,122,0.25)]' : 'bg-white/30')} aria-hidden="true" />
          {connectedInstance ? 'Connected' : 'Not connected'}
        </span>
      </header>

      {/* Tabs */}
      <div className="mb-5">
        <Tabs
          variant="segmented"
          fullWidth
          idPrefix="wix"
          aria-label="Sections"
          value={tab}
          onChange={id => { setTab(id as any); if (id === 'billing') loadUserPlan(userId) }}
          tabs={[
            { id: 'status', label: 'Status', icon: ChartBarIcon },
            { id: 'messages', label: 'Messages', icon: ChatBubbleLeftEllipsisIcon },
            { id: 'billing', label: 'Billing', icon: CreditCardIcon },
          ]}
        />
      </div>

      {/* ── STATUS ──────────────────────────────────────────── */}
      {tab === 'status' && (
        <div className="flex flex-col gap-4">
          {connectedInstance ? (
            <div className="flex items-center gap-3 rounded-card border border-success/20 bg-success-bg px-4 py-3.5">
              <CheckCircleIcon className="h-6 w-6 shrink-0 text-success" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-success">{connectedInstance.phone_number || connectedInstance.name || 'WhatsApp Connected'}</p>
                <p className="text-xs text-muted">{connectedInstance.instance_type === 'cloud_api' ? 'Meta Cloud API' : 'WhatsApp Web'}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-card border border-danger/20 bg-danger-bg px-4 py-3.5 text-sm text-danger" role="status">
              <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <p>WhatsApp not connected. Open Full Dashboard to connect your number.</p>
            </div>
          )}

          <Card padding="none">
            <CardHeader title="Notifications" subtitle="Automatic WhatsApp messages sent for each event." as="h3" divider className="px-5 py-4" />
            <ul className="divide-y divide-line-soft">
              {NOTIF_EVENTS.map(e => (
                <li key={e.label} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="inline-flex items-center gap-2.5 text-ink"><e.icon className="h-[18px] w-[18px] text-brand-ink" aria-hidden="true" />{e.label}</span>
                  <Badge tone={connectedInstance ? 'success' : 'neutral'} size="sm" dot>{connectedInstance ? 'Active' : 'Waiting'}</Badge>
                </li>
              ))}
            </ul>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Messages Sent', value: stats.messages.toLocaleString(), icon: PaperAirplaneIcon },
              { label: 'Contacts', value: stats.contacts.toLocaleString(), icon: UserGroupIcon },
              { label: 'Campaigns', value: stats.campaigns.toLocaleString(), icon: MegaphoneIcon },
              { label: 'Plan', value: userPlan?.name || 'Free', icon: SparklesIcon },
            ].map(f => (
              <StatCard key={f.label} label={f.label} value={f.value} icon={f.icon} />
            ))}
          </div>

          <Card>
            <CardHeader title="Connection Check" subtitle="Run a quick check to see exactly what's connected and what's not." as="h3" />
            <Button variant="secondary" fullWidth className="mt-4" icon={MagnifyingGlassIcon} loading={diagLoading} onClick={runDiagnostics}>
              {diagLoading ? 'Checking...' : 'Check Connection Status'}
            </Button>
            {diagResult && (
              <div className="mt-4">
                <ul className="divide-y divide-line-soft">
                  {diagResult.map((check: any, i: number) => (
                    <li key={i} className="flex items-start gap-3 py-2.5">
                      {check.ok
                        ? <CheckCircleIcon className="h-5 w-5 shrink-0 text-success" aria-label="OK" />
                        : <XCircleIcon className="h-5 w-5 shrink-0 text-danger" aria-label="Failed" />}
                      <div className="min-w-0">
                        <p className={cn('text-sm font-semibold', check.ok ? 'text-success' : 'text-danger')}>{check.label}</p>
                        <p className="mt-0.5 break-all text-xs text-muted">{check.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                {diagResult.some((c: any) => !c.ok) && (
                  <div className="mt-3 flex gap-2.5 rounded-btn bg-chip px-3.5 py-3 text-sm leading-relaxed text-chip-ink">
                    <LightBulbIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                    <p>
                      {!diagResult[2]?.ok && diagResult[1]?.ok
                        ? 'WhatsApp instance exists but not connected. Open Full Dashboard → WhatsApp Accounts → reconnect.'
                        : !diagResult[1]?.ok && diagResult[0]?.ok
                        ? 'No WhatsApp instance found. Open Full Dashboard → WhatsApp Accounts → add a new number.'
                        : !diagResult[0]?.ok
                        ? 'Wix store not linked to any WABEK account. Open Full Dashboard → Wix → paste your Instance ID to link.'
                        : 'Something is wrong. Try opening the Full Dashboard.'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card variant="deep" padding="lg">
            <h3 className="text-base font-semibold text-deep-ink">Full Dashboard</h3>
            <p className="mt-1 text-sm leading-relaxed text-deep-muted">
              Connect WhatsApp, set up Chatbot, AI Auto-Reply, Campaigns, Analytics, Contacts, Quick Replies, Link Tracker, and more.
            </p>
            {!connectedInstance && (
              <div className="mt-4 flex gap-2.5 rounded-btn bg-white/[0.07] px-3.5 py-3 text-sm leading-relaxed text-deep-ink">
                <LightBulbIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-green" aria-hidden="true" />
                <p>Already have a WABEK account? Open the dashboard and go to <strong>Settings → Wix Integration</strong> to link your existing WhatsApp number to this Wix store.</p>
              </div>
            )}
            <Button fullWidth size="lg" className="mt-4" iconEnd={ArrowTopRightOnSquareIcon} loading={openingDash} onClick={() => openDashboard('/dashboard')}>
              {openingDash ? 'Opening...' : 'Open Full Dashboard'}
            </Button>
            <p className="mt-2 text-center text-xs text-deep-muted">Opens in a new tab • Auto sign-in included</p>
          </Card>
        </div>
      )}

      {/* ── MESSAGES ────────────────────────────────────────── */}
      {tab === 'messages' && (
        <Card>
          <CardHeader title="Message Templates" subtitle="Customize the WhatsApp message sent for each order event." as="h3" />
          <div className="mt-4 flex flex-col gap-5">
            {[
              { key: 'order_placed',    label: 'New Order',       vars: ['customer_name', 'order_id', 'total'] },
              { key: 'order_paid',      label: 'Order Paid',      vars: ['customer_name', 'order_id', 'total'] },
              { key: 'order_shipped',   label: 'Order Shipped',   vars: ['customer_name', 'order_id', 'tracking_number'] },
              { key: 'order_cancelled', label: 'Order Cancelled', vars: ['customer_name', 'order_id'] },
              { key: 'abandoned_cart',  label: 'Abandoned Cart',  vars: ['customer_name', 'checkout_url'] },
            ].map(ev => (
              <Field
                key={ev.key}
                label={ev.label}
                hint={<span className="flex flex-wrap items-center gap-1">Variables: {ev.vars.map(v => <code key={v} className="rounded bg-surface-3 px-1.5 py-0.5 text-[11px] text-chip-ink">{`{{${v}}}`}</code>)}</span>}
              >
                <Textarea
                  rows={3}
                  className="font-mono text-[13px]"
                  value={templates[ev.key] || DEFAULT_TEMPLATES[ev.key] || ''}
                  onChange={e => setTemplates((t: any) => ({ ...t, [ev.key]: e.target.value }))}
                />
              </Field>
            ))}
          </div>
          <div className="mt-5 flex flex-col items-stretch gap-2">
            <Button fullWidth icon={CheckIcon} loading={tplSaving} onClick={saveTemplates}>
              {tplSaving ? 'Saving...' : 'Save Templates'}
            </Button>
            {tplSaved && <p role="status" className="text-center text-sm font-medium text-success">Saved!</p>}
          </div>
        </Card>
      )}

      {/* ── BILLING ─────────────────────────────────────────── */}
      {tab === 'billing' && (
        <div className="flex flex-col gap-4">
          <Card variant="gradient" padding="lg">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#04282C]/70">Your plan (via Wix)</p>
            <p className="mt-1 text-2xl font-bold capitalize text-[#04282C]">{userPlan?.name || 'Free'}</p>
            <p className="mt-1 text-xs text-[#04282C]/75">Managed by Wix · Payments processed by Wix</p>
          </Card>

          <h3 className="text-sm font-semibold text-muted">Available Plans</h3>
          <ul className="flex flex-col gap-2.5">
            {[
              { id: 'free',     name: 'Free',     price: 'Free',  mo: '',        msgs: '500 messages/mo',      feat: '1 instance · Basic features' },
              { id: 'starter',  name: 'Starter',  price: '$29',   mo: '/mo',     msgs: '50,000 messages/mo',   feat: '5 instances · Campaigns · Analytics' },
              { id: 'pro',      name: 'Pro',       price: '$79',   mo: '/mo',     msgs: 'Unlimited messages',   feat: '30 instances · AI · Chatbot · All features' },
              { id: 'business', name: 'Business',  price: '$199',  mo: '/mo',     msgs: 'Unlimited everything', feat: 'Unlimited · White label · API · Priority support' },
            ].map(plan => {
              const isCurrent = (userPlan?.name || 'Free').toLowerCase() === plan.name.toLowerCase()
              return (
                <li key={plan.id} className={cn('rounded-card border bg-surface px-4 py-3.5 shadow-card', isCurrent ? 'border-brand-teal ring-2 ring-brand-teal/20' : 'border-line')}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-ink">{plan.name}</span>
                      {isCurrent && <Badge tone="brand" size="sm">Current</Badge>}
                    </span>
                    <span className="tabular"><span className="text-base font-bold text-ink">{plan.price}</span><span className="text-xs text-muted">{plan.mo}</span></span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-link">{plan.msgs}</p>
                  <p className="text-xs text-muted">{plan.feat}</p>
                </li>
              )
            })}
          </ul>

          <div className="mt-1">
            <Button
              fullWidth
              size="lg"
              icon={CreditCardIcon}
              onClick={() => window.open(`https://www.wix.com/apps/upgrade/48cfce94-1e3d-4d09-a34d-e5f41e5b0469?appInstanceId=${instanceId}`, '_blank')}
            >
              Upgrade Plan on Wix
            </Button>
            <p className="mt-2 text-center text-xs text-muted">Payments are processed securely by Wix</p>
          </div>
        </div>
      )}
    </>,
    'WABEK WhatsApp',
  )
}
