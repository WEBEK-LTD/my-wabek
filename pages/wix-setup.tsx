// @ts-nocheck
import { useState, useEffect } from 'react'
import Head from 'next/head'

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

    fetch('/api/wix/auto-connect', {
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
      const r = await fetch(`/api/wix/stats?user_id=${uid}`)
      const d = await r.json()
      if (d) setStats({ messages: d.messages || 0, contacts: d.contacts || 0, campaigns: d.campaigns || 0 })
    } catch {}
  }

  const loadInstances = async (instId: string) => {
    if (!instId) return
    const r = await fetch(`/api/wix/instances?instance_id=${instId}`).catch(() => null)
    const d = await r?.json().catch(() => null)
    if (d?.instances) setInstances(d.instances)
  }

  const loadUserPlan = async (uid: string) => {
    const r = await fetch(`/api/wix/user-plan?user_id=${uid}`).catch(() => null)
    const d = await r?.json().catch(() => null)
    if (d?.plan) setUserPlan(d.plan)
  }

  const loadTemplates = async (instId: string) => {
    const r = await fetch(`/api/wix/templates?instance_id=${instId}`).catch(() => null)
    const d = await r?.json().catch(() => null)
    setTemplates({ ...DEFAULT_TEMPLATES, ...(d?.templates || {}) })
  }

  const runDiagnostics = async () => {
    setDiagLoading(true)
    setDiagResult(null)
    const checks: any[] = []

    // 1. Check Wix instance link
    try {
      const r = await fetch(`/api/wix/instances?instance_id=${instanceId}`)
      const d = await r.json()
      const linked = !!(d.instances)
      checks.push({ label: 'Wix store linked to WABEK account', ok: linked, detail: linked ? `Instance: ${instanceId}` : 'No link found in DB' })

      // 2. Check WhatsApp instance
      const connected = d.instances?.find((i: any) => i.status === 'connected')
      const hasAny    = d.instances?.length > 0
      checks.push({ label: 'WhatsApp instance exists', ok: hasAny, detail: hasAny ? `${d.instances.length} instance(s) found` : 'No WhatsApp instances in this account' })
      checks.push({ label: 'WhatsApp connected', ok: !!connected, detail: connected ? `✅ ${connected.phone_number || connected.name || connected.id}` : hasAny ? `Status: ${d.instances[0]?.status || 'unknown'}` : 'No instance' })
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
      const r = await fetch('/api/wix/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
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
    await fetch('/api/wix/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instance_id: instanceId, templates }),
    }).catch(() => null)
    setTplSaved(true)
    setTimeout(() => setTplSaved(false), 2000)
    setTplSaving(false)
  }

  // ── CSS ───────────────────────────────────────────────────────────────────
  const css = `
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F8FAFC;color:#0f172a;min-height:100vh}
    .page{max-width:560px;margin:0 auto;padding:20px}
    .header{display:flex;align-items:center;gap:10px;padding:14px 0 18px;border-bottom:1px solid #e2e8f0;margin-bottom:18px}
    .logo{width:34px;height:34px;background:#25D366;border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .logo svg{width:20px;height:20px;fill:#fff}
    .logo-tx{font-size:16px;font-weight:700;color:#0f172a}
    .dot{width:8px;height:8px;border-radius:50%;margin-left:auto}
    .dot.g{background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.2)}
    .dot.r{background:#cbd5e1}
    .tabs{display:flex;gap:1px;background:#e2e8f0;border-radius:9px;padding:3px;margin-bottom:18px}
    .tab{flex:1;padding:7px;border:none;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;background:transparent;color:#64748b;transition:all .15s}
    .tab.on{background:#fff;color:#0f172a;box-shadow:0 1px 2px rgba(0,0,0,.06)}
    .card{background:#fff;border:1px solid #e2e8f0;border-radius:11px;padding:18px;margin-bottom:14px}
    .card h3{font-size:14px;font-weight:700;color:#0f172a;margin-bottom:3px}
    .sub{font-size:12px;color:#64748b;line-height:1.5;margin-bottom:14px}
    .btn{display:flex;align-items:center;justify-content:center;gap:6px;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;padding:11px 18px;transition:all .15s;width:100%}
    .btn-g{background:#25D366;color:#fff}
    .btn-g:hover{background:#1da851}
    .btn-g:disabled{opacity:.5;cursor:not-allowed}
    .btn-o{background:#F8FAFC;color:#334155;border:1.5px solid #cbd5e1}
    .btn-o:hover{border-color:#94a3b8}
    .conn{display:flex;align-items:center;gap:10px;background:rgba(37,211,102,.07);border:1px solid rgba(37,211,102,.25);border-radius:9px;padding:12px 14px;margin-bottom:14px}
    .conn-name{font-size:14px;font-weight:700;color:#16a34a}
    .conn-sub{font-size:11px;color:#64748b;margin-top:1px}
    .notconn{background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.2);border-radius:9px;padding:12px 14px;margin-bottom:14px}
    .notconn p{font-size:13px;color:#dc2626}
    .notif-row{display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid #e2e8f0}
    .notif-row:last-child{border:none}
    .notif-row span{font-size:12px;color:#334155}
    .badge{font-size:10px;font-weight:700;padding:2px 9px;border-radius:20px}
    .badge.ok{background:rgba(37,211,102,.12);color:#16a34a}
    .badge.no{background:#e2e8f0;color:#64748b}
    .plan-box{background:rgba(37,211,102,.07);border:1px solid rgba(37,211,102,.25);border-radius:9px;padding:12px 14px;margin-bottom:16px}
    .plan-name{font-size:20px;font-weight:800;color:#16a34a}
    .plan-sub{font-size:11px;color:#64748b;margin-top:3px}
    .plan-card{border:1px solid #e2e8f0;border-radius:9px;padding:12px 14px;margin-bottom:8px;cursor:default;background:#fff}
    .plan-card.curr{border-color:rgba(37,211,102,.5);background:rgba(37,211,102,.05)}
    .plan-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:5px}
    .plan-title{font-size:14px;font-weight:700;color:#0f172a}
    .plan-price{font-size:16px;font-weight:700;color:#0f172a}
    .plan-mo{font-size:11px;color:#64748b}
    .plan-feat{font-size:11px;color:#64748b}
    .curr-badge{font-size:10px;background:rgba(37,211,102,.18);color:#16a34a;padding:2px 8px;border-radius:20px;font-weight:600;margin-left:6px}
    label{display:block;font-size:11px;font-weight:600;color:#475569;margin-bottom:4px}
    textarea{width:100%;padding:9px 11px;border:1.5px solid #cbd5e1;border-radius:7px;font-size:12px;outline:none;background:#fff;color:#0f172a;font-family:monospace;resize:vertical;transition:border .15s;line-height:1.7}
    textarea:focus{border-color:#25D366}
    .ev-label{font-size:12px;font-weight:700;color:#334155;margin:14px 0 5px}
    .vars{font-size:10px;color:#94a3b8;margin-top:3px}
    code{background:#F1F5F9;color:#0369a1;padding:1px 5px;border-radius:3px;font-size:10px}
    .divider{border:none;border-top:1px solid #e2e8f0;margin:14px 0}
    .info{background:rgba(14,165,233,.06);border:1px solid rgba(14,165,233,.2);border-radius:8px;padding:10px 13px;margin-bottom:12px}
    .info p{font-size:12px;color:#0369a1;line-height:1.7;margin:0}
    .loading{text-align:center;padding:40px 20px;color:#64748b;font-size:13px}
    .spinner{width:32px;height:32px;border:3px solid #e2e8f0;border-top-color:#25D366;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 10px}
    @keyframes spin{to{transform:rotate(360deg)}}
    .err-page{background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.2);border-radius:11px;padding:20px;text-align:center;color:#dc2626;font-size:13px}
    .features-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px}
    .feature-item{background:#F8FAFC;border:1px solid #e2e8f0;border-radius:8px;padding:10px;text-align:center;font-size:11px;color:#64748b}
    .feature-item strong{display:block;color:#0f172a;font-size:13px;margin-bottom:2px}
  `

  const WaIcon = () => <svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.554 4.122 1.524 5.855L.057 23.213a.75.75 0 00.921.902l5.455-1.43A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.695-.498-5.246-1.369l-.376-.219-3.889 1.02 1.041-3.796-.237-.389A9.955 9.955 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>

  if (loading) return (
    <>
      <Head><title>WABEK</title><style>{css}</style></Head>
      <div className="page"><div className="loading"><div className="spinner"/><p>Connecting...</p></div></div>
    </>
  )

  if (error) return (
    <>
      <Head><title>WABEK</title><style>{css}</style></Head>
      <div className="page" style={{paddingTop:40}}><div className="err-page">⚠️ {error}</div></div>
    </>
  )

  return (
    <>
      <Head><title>WABEK WhatsApp</title><style>{css}</style></Head>
      <div className="page">

        {/* Header */}
        <div className="header">
          <div className="logo"><WaIcon /></div>
          <span className="logo-tx">WABEK WhatsApp</span>
          <div className={`dot ${connectedInstance ? 'g' : 'r'}`} />
        </div>

        {/* Tabs */}
        <div className="tabs">
          <button className={`tab ${tab==='status'?'on':''}`}   onClick={() => setTab('status')}>📊 Status</button>
          <button className={`tab ${tab==='messages'?'on':''}`} onClick={() => setTab('messages')}>📝 Messages</button>
          <button className={`tab ${tab==='billing'?'on':''}`}  onClick={() => { setTab('billing'); loadUserPlan(userId) }}>💳 Billing</button>
        </div>

        {/* ── STATUS ──────────────────────────────────────────── */}
        {tab === 'status' && (
          <>
            {/* WhatsApp status */}
            {connectedInstance ? (
              <div className="conn">
                <div style={{flex:1}}>
                  <div className="conn-name">✅ {connectedInstance.phone_number || connectedInstance.name || 'WhatsApp Connected'}</div>
                  <div className="conn-sub">{connectedInstance.instance_type === 'cloud_api' ? 'Meta Cloud API' : 'WhatsApp Web'}</div>
                </div>
              </div>
            ) : (
              <div className="notconn">
                <p>⚠️ WhatsApp not connected. Open Full Dashboard to connect your number.</p>
              </div>
            )}

            {/* Notifications status */}
            <div className="card">
              <h3>Notifications</h3>
              <p className="sub">Automatic WhatsApp messages sent for each event.</p>
              {[
                '🛒 New Order', '✅ Order Paid',
                '🚚 Order Shipped', '❌ Order Cancelled'
              ].map(e => (
                <div key={e} className="notif-row">
                  <span>{e}</span>
                  <span className={`badge ${connectedInstance ? 'ok' : 'no'}`}>
                    {connectedInstance ? '✅ Active' : 'Waiting'}
                  </span>
                </div>
              ))}
            </div>

            {/* Features grid */}
            <div className="features-grid">
              {[
                { label: 'Messages Sent', value: stats.messages.toLocaleString() },
                { label: 'Contacts',      value: stats.contacts.toLocaleString() },
                { label: 'Campaigns',     value: stats.campaigns.toLocaleString() },
                { label: 'Plan',          value: userPlan?.name || 'Free' },
              ].map(f => (
                <div key={f.label} className="feature-item">
                  <strong>{f.value}</strong>
                  {f.label}
                </div>
              ))}
            </div>

            {/* Diagnostics */}
            <div className="card">
              <h3>Connection Check</h3>
              <p className="sub">Run a quick check to see exactly what's connected and what's not.</p>
              <button className="btn btn-o" onClick={runDiagnostics} disabled={diagLoading} style={{marginBottom: diagResult ? 12 : 0}}>
                {diagLoading ? '⏳ Checking...' : '🔍 Check Connection Status'}
              </button>
              {diagResult && (
                <div style={{marginTop:4}}>
                  {diagResult.map((check: any, i: number) => (
                    <div key={i} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'8px 0',borderBottom:'1px solid #e2e8f0'}}>
                      <span style={{fontSize:16,flexShrink:0}}>{check.ok ? '✅' : '❌'}</span>
                      <div style={{flex:1}}>
                        <p style={{fontSize:12,fontWeight:600,color: check.ok ? '#16a34a' : '#dc2626'}}>{check.label}</p>
                        <p style={{fontSize:11,color:'#64748b',marginTop:1}}>{check.detail}</p>
                      </div>
                    </div>
                  ))}
                  {diagResult.some((c: any) => !c.ok) && (
                    <div className="info" style={{marginTop:10}}>
                      <p>
                        {!diagResult[2]?.ok && diagResult[1]?.ok
                          ? '💡 WhatsApp instance exists but not connected. Open Full Dashboard → WhatsApp Accounts → reconnect.'
                          : !diagResult[1]?.ok && diagResult[0]?.ok
                          ? '💡 No WhatsApp instance found. Open Full Dashboard → WhatsApp Accounts → add a new number.'
                          : !diagResult[0]?.ok
                          ? '💡 Wix store not linked to any WABEK account. Open Full Dashboard → Wix → paste your Instance ID to link.'
                          : '💡 Something is wrong. Try opening the Full Dashboard.'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Open Dashboard CTA */}
            <div className="card">
              <h3>Full Dashboard</h3>
              <p className="sub">
                Connect WhatsApp, set up Chatbot, AI Auto-Reply, Campaigns, Analytics, Contacts, Quick Replies, Link Tracker, and more.
              </p>
              {!connectedInstance && (
                <div className="info" style={{marginBottom:12}}>
                  <p>
                    💡 Already have a WABEK account? Open the dashboard and go to <strong>Settings → Wix Integration</strong> to link your existing WhatsApp number to this Wix store.
                  </p>
                </div>
              )}
              <button className="btn btn-g" onClick={() => openDashboard('/dashboard')} disabled={openingDash}>
                {openingDash ? '⏳ Opening...' : '🚀 Open Full Dashboard →'}
              </button>
              <p style={{fontSize:11,color:'#64748b',textAlign:'center',marginTop:6}}>
                Opens in a new tab • Auto sign-in included
              </p>
            </div>
          </>
        )}

        {/* ── MESSAGES ────────────────────────────────────────── */}
        {tab === 'messages' && (
          <div className="card">
            <h3>Message Templates</h3>
            <p className="sub">Customize the WhatsApp message sent for each order event.</p>

            {[
              { key: 'order_placed',    label: '🛒 New Order',      vars: ['customer_name', 'order_id', 'total'] },
              { key: 'order_paid',      label: '✅ Order Paid',      vars: ['customer_name', 'order_id', 'total'] },
              { key: 'order_shipped',   label: '🚚 Order Shipped',   vars: ['customer_name', 'order_id', 'tracking_number'] },
              { key: 'order_cancelled', label: '❌ Order Cancelled', vars: ['customer_name', 'order_id'] },
              { key: 'abandoned_cart',  label: '🛒 Abandoned Cart',   vars: ['customer_name', 'checkout_url'] },
            ].map(ev => (
              <div key={ev.key}>
                <p className="ev-label">{ev.label}</p>
                <textarea
                  rows={3}
                  value={templates[ev.key] || DEFAULT_TEMPLATES[ev.key] || ''}
                  onChange={e => setTemplates((t: any) => ({ ...t, [ev.key]: e.target.value }))}
                />
                <p className="vars">
                  Variables:{' '}
                  {ev.vars.map(v => <code key={v}>{`{{${v}}}`}</code>)
                    .reduce((a: any[], b: any) => [...a, ' ', b], [])}
                </p>
              </div>
            ))}

            <div style={{ marginTop: 16 }}>
              <button className="btn btn-g" onClick={saveTemplates} disabled={tplSaving}>
                {tplSaving ? 'Saving...' : '💾 Save Templates'}
              </button>
              {tplSaved && <p style={{ fontSize: 12, color: '#16a34a', textAlign: 'center', marginTop: 6 }}>✅ Saved!</p>}
            </div>
          </div>
        )}

        {/* ── BILLING ─────────────────────────────────────────── */}
        {tab === 'billing' && (
          <>
            {/* Current plan — from Wix */}
            <div className="plan-box">
              <p style={{ fontSize: 11, color: '#64748b', marginBottom: 3 }}>YOUR PLAN (via Wix)</p>
              <div className="plan-name" style={{textTransform:'capitalize'}}>
                {userPlan?.name || 'Free'}
              </div>
              <div className="plan-sub">Managed by Wix · Payments processed by Wix</div>
            </div>

            {/* Plans */}
            <p style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 10 }}>Available Plans</p>
            {[
              { id: 'free',     name: 'Free',     price: 'Free',  mo: '',        msgs: '500 messages/mo',      feat: '1 instance · Basic features' },
              { id: 'starter',  name: 'Starter',  price: '$29',   mo: '/mo',     msgs: '50,000 messages/mo',   feat: '5 instances · Campaigns · Analytics' },
              { id: 'pro',      name: 'Pro',       price: '$79',   mo: '/mo',     msgs: 'Unlimited messages',   feat: '30 instances · AI · Chatbot · All features' },
              { id: 'business', name: 'Business',  price: '$199',  mo: '/mo',     msgs: 'Unlimited everything', feat: 'Unlimited · White label · API · Priority support' },
            ].map(plan => {
              const isCurrent = (userPlan?.name || 'Free').toLowerCase() === plan.name.toLowerCase()
              return (
                <div key={plan.id} className={`plan-card ${isCurrent ? 'curr' : ''}`}>
                  <div className="plan-head">
                    <div>
                      <span className="plan-title">{plan.name}</span>
                      {isCurrent && <span className="curr-badge">Current</span>}
                    </div>
                    <div>
                      <span className="plan-price">{plan.price}</span>
                      <span className="plan-mo">{plan.mo}</span>
                    </div>
                  </div>
                  <p style={{ fontSize: 11, color: '#16a34a', marginBottom: 2 }}>{plan.msgs}</p>
                  <p className="plan-feat">{plan.feat}</p>
                </div>
              )
            })}

            <div style={{ marginTop: 16 }}>
              <button
                className="btn btn-g"
                onClick={() => window.open(`https://www.wix.com/apps/upgrade/48cfce94-1e3d-4d09-a34d-e5f41e5b0469?appInstanceId=${instanceId}`, '_blank')}
              >
                💳 Upgrade Plan on Wix →
              </button>
              <p style={{ fontSize: 11, color: '#64748b', textAlign: 'center', marginTop: 6 }}>
                Payments are processed securely by Wix
              </p>
            </div>
          </>
        )}

      </div>
    </>
  )
}
