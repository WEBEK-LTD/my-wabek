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
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/public/wix-setup'

type Key = keyof typeof messages.en
type Check = { k: Key; ok: boolean; d: Key | null; v?: Record<string, string | number>; raw?: string }

// The signed Wix `instance` param proves which store this page belongs to.
// Every /api/wix call sends it; the server derives the account from it.
let WIX_INSTANCE = ''
const wixFetch = (url: string, init: any = {}) =>
  fetch(url, { ...init, headers: { ...(init.headers || {}), 'x-wix-instance': WIX_INSTANCE } })

export default function WixSetupPage() {
  const { t, lang, dir, fmtNumber } = useT(messages)
  const [loading, setLoading]         = useState(true)
  // A dictionary key, or a message returned by the server.
  const [error, setError]             = useState<{ key?: Key; raw?: string } | null>(null)
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
  const [diagResult, setDiagResult]   = useState<Check[] | null>(null)
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
    if (!instJwt) { setError({ key: 'err_open' }); setLoading(false); return }
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
          setError(d.error ? { raw: d.error } : { key: 'err_conn' })
        }
        setLoading(false)
      })
      .catch(() => { setError({ key: 'err_refresh' }); setLoading(false) })
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
    const checks: Check[] = []

    // 1. Check Wix instance link
    try {
      const r = await wixFetch(`/api/wix/instances`)
      const d = await r.json()
      const linked = !!(d.instances)
      checks.push({ k: 'c_linked', ok: linked, d: linked ? 'c_linked_yes' : 'c_linked_no', v: { id: instanceId } })

      // 2. Check WhatsApp instance
      const connected = d.instances?.find((i: any) => i.status === 'connected')
      const hasAny    = d.instances?.length > 0
      checks.push({ k: 'c_exists', ok: hasAny, d: hasAny ? 'c_exists_yes' : 'c_exists_no', v: { n: d.instances?.length || 0 } })
      checks.push(connected
        ? { k: 'c_connected', ok: true, d: null, raw: `${connected.phone_number || connected.name || connected.id}` }
        : hasAny ? { k: 'c_connected', ok: false, d: 'c_status', v: { s: d.instances[0]?.status || '' } } : { k: 'c_connected', ok: false, d: 'c_no_instance' })
    } catch (e: any) {
      checks.push({ k: 'c_api', ok: false, d: null, raw: e.message })
    }

    // 3. Check WABEK account
    checks.push({ k: 'c_account', ok: !!userId, d: userId ? 'c_account_yes' : 'c_account_no', v: { id: userId.slice(0, 8) } })

    // 4. Check Wix plan
    checks.push({ k: 'c_plan', ok: !!userPlan?.name, d: userPlan?.name ? 'c_plan_yes' : 'c_plan_no', v: { p: userPlan?.name || '' } })

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
    { label: t('ev_order_placed'), icon: ShoppingCartIcon },
    { label: t('ev_order_paid'), icon: BanknotesIcon },
    { label: t('ev_order_shipped'), icon: TruckIcon },
    { label: t('ev_order_cancelled'), icon: XCircleIcon },
  ]

  const shell = (children: React.ReactNode, title = 'WABEK') => (
    <>
      <Head><title>{title}</title></Head>
      <div dir={dir} lang={lang} className="min-h-screen bg-canvas text-ink">
        <div className="mx-auto max-w-[600px] px-4 py-5">{children}</div>
      </div>
    </>
  )

  if (loading) return shell(
    <div className="flex flex-col items-center gap-3 py-16 text-sm text-muted" role="status">
      <Spinner className="h-7 w-7 text-brand-teal" />
      <p>{t('connecting')}</p>
    </div>
  )

  if (error) return shell(
    <div className="pt-10">
      <EmptyState variant="card" icon={ExclamationTriangleIcon} title={error.key ? t(error.key) : error.raw} />
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
          {connectedInstance ? t('connected') : t('not_connected')}
        </span>
      </header>

      {/* Tabs */}
      <div className="mb-5">
        <Tabs
          variant="segmented"
          fullWidth
          idPrefix="wix"
          aria-label={t('sections')}
          value={tab}
          onChange={id => { setTab(id as any); if (id === 'billing') loadUserPlan(userId) }}
          tabs={[
            { id: 'status', label: t('tab_status'), icon: ChartBarIcon },
            { id: 'messages', label: t('tab_messages'), icon: ChatBubbleLeftEllipsisIcon },
            { id: 'billing', label: t('tab_billing'), icon: CreditCardIcon },
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
                <p className="truncate text-sm font-semibold text-success">{connectedInstance.phone_number || connectedInstance.name || t('wa_connected')}</p>
                <p className="text-xs text-muted">{connectedInstance.instance_type === 'cloud_api' ? 'Meta Cloud API' : 'WhatsApp Web'}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-card border border-danger/20 bg-danger-bg px-4 py-3.5 text-sm text-danger" role="status">
              <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <p>{t('wa_not_connected')}</p>
            </div>
          )}

          <Card padding="none">
            <CardHeader title={t('notifications')} subtitle={t('notifications_sub')} as="h3" divider className="px-5 py-4" />
            <ul className="divide-y divide-line-soft">
              {NOTIF_EVENTS.map(e => (
                <li key={e.label} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="inline-flex items-center gap-2.5 text-ink"><e.icon className="h-[18px] w-[18px] text-brand-ink" aria-hidden="true" />{e.label}</span>
                  <Badge tone={connectedInstance ? 'success' : 'neutral'} size="sm" dot>{connectedInstance ? t('active') : t('waiting')}</Badge>
                </li>
              ))}
            </ul>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: t('stat_messages'), value: fmtNumber(stats.messages), icon: PaperAirplaneIcon },
              { label: t('stat_contacts'), value: fmtNumber(stats.contacts), icon: UserGroupIcon },
              { label: t('stat_campaigns'), value: fmtNumber(stats.campaigns), icon: MegaphoneIcon },
              { label: t('stat_plan'), value: userPlan?.name || t('free'), icon: SparklesIcon },
            ].map(f => (
              <StatCard key={f.label} label={f.label} value={f.value} icon={f.icon} />
            ))}
          </div>

          <Card>
            <CardHeader title={t('check_title')} subtitle={t('check_sub')} as="h3" />
            <Button variant="secondary" fullWidth className="mt-4" icon={MagnifyingGlassIcon} loading={diagLoading} onClick={runDiagnostics}>
              {diagLoading ? t('checking') : t('check_btn')}
            </Button>
            {diagResult && (
              <div className="mt-4">
                <ul className="divide-y divide-line-soft">
                  {diagResult.map((check, i) => (
                    <li key={i} className="flex items-start gap-3 py-2.5">
                      {check.ok
                        ? <CheckCircleIcon className="h-5 w-5 shrink-0 text-success" aria-label={t('ok')} />
                        : <XCircleIcon className="h-5 w-5 shrink-0 text-danger" aria-label={t('failed')} />}
                      <div className="min-w-0">
                        <p className={cn('text-sm font-semibold', check.ok ? 'text-success' : 'text-danger')}>{t(check.k)}</p>
                        <p className="mt-0.5 break-all text-xs text-muted">{check.d ? t(check.d, check.d === 'c_status' && !check.v?.s ? { s: t('unknown') } : check.v) : check.raw}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                {diagResult.some(c => !c.ok) && (
                  <div className="mt-3 flex gap-2.5 rounded-btn bg-chip px-3.5 py-3 text-sm leading-relaxed text-chip-ink">
                    <LightBulbIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                    <p>
                      {!diagResult[2]?.ok && diagResult[1]?.ok
                        ? t('tip_reconnect')
                        : !diagResult[1]?.ok && diagResult[0]?.ok
                        ? t('tip_add')
                        : !diagResult[0]?.ok
                        ? t('tip_link')
                        : t('tip_other')}
                    </p>
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card variant="deep" padding="lg">
            <h3 className="text-base font-semibold text-deep-ink">{t('full_title')}</h3>
            <p className="mt-1 text-sm leading-relaxed text-deep-muted">
              {t('full_desc')}
            </p>
            {!connectedInstance && (
              <div className="mt-4 flex gap-2.5 rounded-btn bg-white/[0.07] px-3.5 py-3 text-sm leading-relaxed text-deep-ink">
                <LightBulbIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-green" aria-hidden="true" />
                <p>{t('have_account_a')}<strong>{t('have_account_b')}</strong>{t('have_account_c')}</p>
              </div>
            )}
            <Button fullWidth size="lg" className="mt-4" iconEnd={ArrowTopRightOnSquareIcon} loading={openingDash} onClick={() => openDashboard('/dashboard')}>
              {openingDash ? t('opening') : t('open_full')}
            </Button>
            <p className="mt-2 text-center text-xs text-deep-muted">{t('opens_note')}</p>
          </Card>
        </div>
      )}

      {/* ── MESSAGES ────────────────────────────────────────── */}
      {tab === 'messages' && (
        <Card>
          <CardHeader title={t('tpl_title')} subtitle={t('tpl_sub')} as="h3" />
          <div className="mt-4 flex flex-col gap-5">
            {[
              { key: 'order_placed',    label: t('ev_order_placed'),    vars: ['customer_name', 'order_id', 'total'] },
              { key: 'order_paid',      label: t('ev_order_paid'),      vars: ['customer_name', 'order_id', 'total'] },
              { key: 'order_shipped',   label: t('ev_order_shipped'),   vars: ['customer_name', 'order_id', 'tracking_number'] },
              { key: 'order_cancelled', label: t('ev_order_cancelled'), vars: ['customer_name', 'order_id'] },
              { key: 'abandoned_cart',  label: t('ev_abandoned_cart'),  vars: ['customer_name', 'checkout_url'] },
            ].map(ev => (
              <Field
                key={ev.key}
                label={ev.label}
                hint={<span className="flex flex-wrap items-center gap-1">{t('variables')} {ev.vars.map(v => <code key={v} className="rounded bg-surface-3 px-1.5 py-0.5 text-[11px] text-chip-ink">{`{{${v}}}`}</code>)}</span>}
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
              {tplSaving ? t('saving') : t('save_tpl')}
            </Button>
            {tplSaved && <p role="status" className="text-center text-sm font-medium text-success">{t('saved')}</p>}
          </div>
        </Card>
      )}

      {/* ── BILLING ─────────────────────────────────────────── */}
      {tab === 'billing' && (
        <div className="flex flex-col gap-4">
          <Card variant="gradient" padding="lg">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#04282C]/70">{t('your_plan')}</p>
            <p className="mt-1 text-2xl font-bold capitalize text-[#04282C]">{userPlan?.name || t('free')}</p>
            <p className="mt-1 text-xs text-[#04282C]/75">{t('managed')}</p>
          </Card>

          <h3 className="text-sm font-semibold text-muted">{t('available')}</h3>
          <ul className="flex flex-col gap-2.5">
            {[
              { id: 'free',     name: 'Free',     label: t('p_free_name'), price: t('free'), mo: '',         msgs: t('p_free_msgs'),     feat: t('p_free_feat') },
              { id: 'starter',  name: 'Starter',  label: 'Starter',        price: '$29',     mo: t('per_mo'), msgs: t('p_starter_msgs'),  feat: t('p_starter_feat') },
              { id: 'pro',      name: 'Pro',      label: 'Pro',            price: '$79',     mo: t('per_mo'), msgs: t('p_pro_msgs'),      feat: t('p_pro_feat') },
              { id: 'business', name: 'Business', label: 'Business',       price: '$199',    mo: t('per_mo'), msgs: t('p_business_msgs'), feat: t('p_business_feat') },
            ].map(plan => {
              const isCurrent = (userPlan?.name || 'Free').toLowerCase() === plan.name.toLowerCase()
              return (
                <li key={plan.id} className={cn('rounded-card border bg-surface px-4 py-3.5 shadow-card', isCurrent ? 'border-brand-teal ring-2 ring-brand-teal/20' : 'border-line')}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-ink">{plan.label}</span>
                      {isCurrent && <Badge tone="brand" size="sm">{t('current')}</Badge>}
                    </span>
                    <span className="tabular" dir="ltr"><span className="text-base font-bold text-ink">{plan.price}</span><span className="text-xs text-muted">{plan.mo}</span></span>
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
              {t('upgrade')}
            </Button>
            <p className="mt-2 text-center text-xs text-muted">{t('payments_note')}</p>
          </div>
        </div>
      )}
    </>,
    t('page_title'),
  )
}
