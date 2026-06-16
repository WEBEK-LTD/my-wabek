// @ts-nocheck
import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { CheckCircleIcon, XCircleIcon, ArrowPathIcon, InformationCircleIcon } from '@heroicons/react/24/outline'

const EVENTS = [
  {
    key: 'order_placed',
    label: '🛒 Order Confirmed',
    desc: 'Sent when a customer places a new order',
    vars: ['customer_name', 'order_id', 'total'],
    default: '🛒 Order Confirmed!\n\nHi {{customer_name}}, your order #{{order_id}} has been placed.\n💰 Total: {{total}}\n\nThank you! 🙏',
  },
  {
    key: 'order_paid',
    label: '✅ Payment Received',
    desc: 'Sent when payment is confirmed',
    vars: ['customer_name', 'order_id', 'total'],
    default: '✅ Payment Received!\n\nHi {{customer_name}}, payment for order #{{order_id}} confirmed.\n💰 {{total}}',
  },
  {
    key: 'order_shipped',
    label: '🚚 Order Shipped',
    desc: 'Sent when the order is fulfilled with tracking info',
    vars: ['customer_name', 'order_id', 'tracking_number'],
    default: '🚚 Order Shipped!\n\nHi {{customer_name}}, order #{{order_id}} is on its way!\n📦 Track: {{tracking_number}}',
  },
  {
    key: 'order_cancelled',
    label: '❌ Order Cancelled',
    desc: 'Sent when an order is cancelled or refunded',
    vars: ['customer_name', 'order_id'],
    default: '❌ Order Cancelled\n\nHi {{customer_name}}, order #{{order_id}} has been cancelled.\nContact us if you need help.',
  },
  {
    key: 'order_refunded',
    label: '💰 Refund Processed',
    desc: 'Sent when a refund is completed',
    vars: ['customer_name', 'order_id'],
    default: '💰 Refund Processed\n\nHi {{customer_name}}, your refund for order #{{order_id}} has been processed.',
  },
  {
    key: 'abandoned_cart',
    label: '🛒 Abandoned Cart',
    desc: 'Sent when a customer leaves without completing checkout',
    vars: ['customer_name', 'checkout_url'],
    default: '🛒 You left something behind!\n\nHi {{customer_name}}, you have items waiting in your cart.\n\n💡 Complete your purchase now!\n\n🔗 {{checkout_url}}',
  },
  {
    key: 'cart_recovered',
    label: '🎉 Cart Recovered',
    desc: 'Sent when a customer returns and completes a previously abandoned checkout',
    vars: ['customer_name', 'order_id'],
    default: '🎉 Welcome back!\n\nHi {{customer_name}}, your order #{{order_id}} has been completed. Thank you for coming back! 🙏',
  },
  {
    key: 'back_in_stock',
    label: '📦 Back In Stock',
    desc: 'Sent when a requested product is back in stock',
    vars: ['customer_name'],
    default: '📦 Good news, {{customer_name}}!\n\nA product you were waiting for is back in stock. Order now before it sells out! 🛒',
  },
]

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-green-500' : 'bg-slate-200'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  )
}

export default function WixPage() {
  const [tab, setTab] = useState<'stores' | 'templates' | 'guide'>('stores')
  const [templates, setTemplates] = useState<Record<string, string>>({})
  const [enabled, setEnabled] = useState<Record<string, boolean>>({})
  const [tplSaving, setTplSaving] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [testEvent, setTestEvent] = useState('order_placed')
  const [sending, setSending] = useState(false)
  const qc = useQueryClient()

  // Init defaults
  useEffect(() => {
    const defTpl: Record<string, string> = {}
    const defEna: Record<string, boolean> = {}
    EVENTS.forEach(e => { defTpl[e.key] = e.default; defEna[e.key] = true })
    setTemplates(defTpl)
    setEnabled(defEna)
  }, [])

  const { data: connectData, isLoading } = useQuery('wix-connections',
    () => axios.get('/api/wix/connect').then(r => r.data)
  )
  const connections = connectData?.connections || []

  const disconnectMutation = useMutation(
    (instanceId: string) => axios.delete('/api/wix/connect', { data: { wix_instance_id: instanceId } }),
    { onSuccess: () => { qc.invalidateQueries('wix-connections'); toast.success('Disconnected') } }
  )

  const saveTemplates = async () => {
    setTplSaving(true)
    try {
      await axios.post('/api/settings/wix-templates', { templates, enabled })
      toast.success('Templates saved!')
    } catch { toast.error('Failed to save') }
    setTplSaving(false)
  }

  const sendTest = async () => {
    if (!testPhone) return toast.error('Enter a phone number')
    setSending(true)
    try {
      const ev = EVENTS.find(e => e.key === testEvent)
      const instancesResp = await axios.get('/api/whatsapp/instances')
      const allInstances = instancesResp.data?.instances || []
      const inst = allInstances.find((i: any) => i.status === 'connected')
      if (!inst) return toast.error('No connected WhatsApp instance')

      const msg = (templates[testEvent] || ev?.default || '')
        .replace(/{{customer_name}}/g, 'Ahmed Mohamed')
        .replace(/{{order_id}}/g, 'TEST-001')
        .replace(/{{total}}/g, '$99.00')
        .replace(/{{tracking_number}}/g, 'https://track.example.com/123')
        .replace(/{{checkout_url}}/g, 'https://yourstore.com/checkout')

      await axios.post('/api/whatsapp/send', { instance_id: inst.id, to: testPhone, type: 'text', text: msg })
      toast.success('✅ Test message sent!')
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Failed')
    }
    setSending(false)
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-5 pb-12">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-xl flex-shrink-0">🔷</div>
          <div>
            <h1 className="text-2xl font-display font-bold text-slate-900">Wix Integration</h1>
            <p className="text-slate-400 text-sm">Send automatic WhatsApp notifications for your Wix store events.</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-[#F8FAFC] rounded-xl p-1">
          {[
            { id: 'stores', label: '🏪 My Stores' },
            { id: 'templates', label: '📝 Messages' },
            { id: 'guide', label: '📖 How to Use' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-[#F8FAFC] text-slate-900' : 'text-slate-400 hover:text-slate-900'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── STORES ─────────────────────────────────────────── */}
        {tab === 'stores' && (
          <div className="space-y-4">
            {/* Install */}
            <div className="card border-blue-900/40 bg-blue-900/10">
              <div className="flex items-start gap-4">
                <div className="text-3xl flex-shrink-0">🔷</div>
                <div className="flex-1">
                  <h2 className="font-semibold text-slate-900 mb-1">Connect a Wix Store</h2>
                  <p className="text-slate-400 text-sm mb-4">Install WABEK on your Wix store to automatically send WhatsApp notifications with zero manual setup.</p>
                  <a href={`https://www.wix.com/app-market/48cfce94-1e3d-4d09-a34d-e5f41e5b0469`} target="_blank" rel="noopener" className="btn-primary inline-flex items-center gap-2">
                    Install on Wix →
                  </a>
                </div>
              </div>
            </div>

            {/* Connected stores */}
            <div className="card">
              <h2 className="font-semibold text-slate-900 mb-3">Connected Stores</h2>
              {isLoading ? (
                <div className="flex items-center gap-2 text-slate-500 text-sm py-4"><ArrowPathIcon className="w-4 h-4 animate-spin" />Loading...</div>
              ) : connections.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-500 text-sm">No Wix stores connected yet.</p>
                  <p className="text-slate-600 text-xs mt-1">Install WABEK on your Wix store using the button above.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {connections.map((conn: any) => (
                    <div key={conn.wix_instance_id} className="flex items-center justify-between p-3 bg-[#F8FAFC] rounded-xl">
                      <div className="flex items-center gap-3">
                        <img src="https://cdn.simpleicons.org/wix/000000" alt="Wix" className="w-5 h-5 flex-shrink-0" />
                        <div>
                          <p className="text-slate-900 text-sm font-medium">
                            {conn.wix_installations?.site_name
                              ? conn.wix_installations.site_name
                              : <span className="text-slate-500">Wix Store</span>}
                          </p>
                          <p className="text-slate-400 text-xs font-mono">{conn.wix_instance_id}</p>
                          <p className="text-slate-400 text-xs mt-0.5">
                            Connected {conn.connected_at ? new Date(conn.connected_at).toLocaleDateString() : ''}
                          </p>
                        </div>
                      </div>
                      <button onClick={() => disconnectMutation.mutate(conn.wix_instance_id)}
                        className="text-xs text-red-400 hover:text-red-300 border border-red-900/40 px-3 py-1.5 rounded-lg">
                        Disconnect
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Test */}
            <div className="card">
              <h2 className="font-semibold text-slate-900 mb-1">Test Message</h2>
              <p className="text-slate-400 text-sm mb-4">Send a test to verify your WhatsApp is working.</p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">Phone (with country code)</label>
                  <input type="tel" value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="+201234567890"
                    className="w-full bg-[#F8FAFC] border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-gray-600 focus:outline-none focus:border-brand-600" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">Event</label>
                  <select value={testEvent} onChange={e => setTestEvent(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-brand-600">
                    {EVENTS.map(e => <option key={e.key} value={e.key}>{e.label}</option>)}
                  </select>
                </div>
                <button onClick={sendTest} disabled={sending} className="btn-primary w-full disabled:opacity-50">
                  {sending ? 'Sending...' : '📤 Send Test'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TEMPLATES ───────────────────────────────────────── */}
        {tab === 'templates' && (
          <div style={{display:'flex',flexDirection:'column',gap:16}}>

            {/* Info bar */}
            <div style={{background:'rgba(99,102,241,0.08)',border:'1px solid rgba(99,102,241,0.2)',borderRadius:10,padding:'12px 16px'}}>
              <p style={{color:'#4338ca',fontSize:13,margin:0}}>
                Toggle each notification on/off. When enabled, customize the message text using variables like{' '}
                <code style={{background:'rgba(99,102,241,0.12)',color:'#4338ca',padding:'1px 6px',borderRadius:4,fontSize:12}}>{'{{customer_name}}'}</code>
              </p>
            </div>

            {EVENTS.map(ev => {
              const isOn = enabled[ev.key] !== false
              return (
                <div key={ev.key} style={{background:'#fff',border:`1px solid ${isOn ? 'rgba(34,197,94,0.2)' : '#e2e8f0'}`,borderRadius:12,padding:16,transition:'border-color 0.2s'}}>

                  {/* Header row */}
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,marginBottom: isOn ? 12 : 0}}>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                        <span style={{color:'#0f172a',fontWeight:600,fontSize:14}}>{ev.label}</span>
                        {isOn && <span style={{fontSize:10,background:'rgba(34,197,94,0.15)',color:'#4ade80',padding:'2px 8px',borderRadius:20,fontWeight:600}}>ON</span>}
                        {!isOn && <span style={{fontSize:10,background:'#F1F5F9',color:'#64748b',padding:'2px 8px',borderRadius:20,fontWeight:600}}>OFF</span>}
                      </div>
                      <p style={{color:'#64748b',fontSize:12,margin:0}}>{ev.desc}</p>
                    </div>
                    {/* Toggle */}
                    <button
                      onClick={() => setEnabled(e => ({ ...e, [ev.key]: !isOn }))}
                      style={{
                        position:'relative',width:44,height:24,borderRadius:12,border:'none',cursor:'pointer',
                        background: isOn ? '#22c55e' : '#cbd5e1',
                        transition:'background 0.2s',flexShrink:0,
                      }}
                    >
                      <span style={{
                        position:'absolute',top:3,left: isOn ? 23 : 3,
                        width:18,height:18,borderRadius:'50%',background:'#fff',
                        transition:'left 0.2s',display:'block',
                      }}/>
                    </button>
                  </div>

                  {/* Textarea + vars — only when ON */}
                  {isOn && (
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      <textarea
                        rows={4}
                        value={templates[ev.key] || ev.default}
                        onChange={e => setTemplates((t:any) => ({ ...t, [ev.key]: e.target.value }))}
                        style={{
                          width:'100%',
                          background:'#fff',
                          border:'1.5px solid #cbd5e1',
                          borderRadius:8,
                          padding:'10px 12px',
                          fontSize:13,
                          color:'#0f172a',
                          fontFamily:'monospace',
                          resize:'vertical',
                          outline:'none',
                          lineHeight:1.7,
                          boxSizing:'border-box',
                          display:'block',
                        }}
                        onFocus={e => { e.target.style.borderColor = '#6366f1' }}
                        onBlur={e => { e.target.style.borderColor = '#cbd5e1' }}
                      />
                      {/* Variables */}
                      <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                        {ev.vars.map(v => (
                          <span
                            key={v}
                            onClick={() => {
                              const cur = templates[ev.key] || ev.default
                              setTemplates((t:any) => ({ ...t, [ev.key]: cur + `{{${v}}}` }))
                            }}
                            style={{
                              fontSize:11,background:'rgba(99,102,241,0.1)',color:'#4338ca',
                              border:'1px solid rgba(99,102,241,0.25)',padding:'2px 8px',
                              borderRadius:4,fontFamily:'monospace',cursor:'pointer',
                            }}
                            title="Click to insert"
                          >
                            {`{{${v}}}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            <button
              onClick={saveTemplates}
              disabled={tplSaving}
              className="btn-primary w-full disabled:opacity-50"
            >
              {tplSaving ? 'Saving...' : '💾 Save All Templates'}
            </button>
          </div>
        )}

        {/* ── GUIDE ───────────────────────────────────────────── */}
        {tab === 'guide' && (
          <div className="space-y-4">
            <div className="card">
              <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <InformationCircleIcon className="w-5 h-5 text-blue-600" />
                How to Set Up WABEK for Your Wix Store
              </h2>

              {[
                {
                  step: '1',
                  title: 'Install the App',
                  desc: 'Go to My Stores tab and click "Install on Wix". You\'ll be redirected to the Wix App Market. Click Add to Site.',
                },
                {
                  step: '2',
                  title: 'Open WABEK from Wix',
                  desc: 'In your Wix Dashboard, go to Apps → WABEK WhatsApp. Your account will be created automatically — no registration needed.',
                },
                {
                  step: '3',
                  title: 'Connect WhatsApp',
                  desc: 'Click "Open Full Dashboard" inside the Wix app. Go to WhatsApp Accounts and connect your number using QR Code or Meta Cloud API.',
                },
                {
                  step: '4',
                  title: 'Customize Messages',
                  desc: 'Go to the Messages tab here to customize the WhatsApp notification text for each event. Toggle events on/off as needed.',
                },
                {
                  step: '5',
                  title: 'Test It',
                  desc: 'Use the Test Message section in My Stores tab to send a test notification and verify everything is working.',
                },
                {
                  step: '6',
                  title: 'You\'re Live!',
                  desc: 'Place a test order in your Wix store. Your customer will automatically receive a WhatsApp notification.',
                },
              ].map(s => (
                <div key={s.step} className="flex gap-4 pb-5 border-b border-slate-200/30 last:border-0 last:pb-0 mb-5 last:mb-0">
                  <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {s.step}
                  </div>
                  <div>
                    <p className="text-slate-900 font-semibold text-sm mb-1">{s.title}</p>
                    <p className="text-slate-400 text-sm leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="card border-yellow-900/30 bg-yellow-900/10">
              <h3 className="text-yellow-400 font-semibold text-sm mb-2">📦 Shipping Tracking</h3>
              <p className="text-slate-400 text-sm">When you mark an order as fulfilled in Wix and add a tracking number, the tracking link is automatically included in the WhatsApp message sent to your customer.</p>
            </div>

            <div className="card border-blue-900/30 bg-blue-900/10">
              <h3 className="text-blue-400 font-semibold text-sm mb-2">🛒 Abandoned Cart Recovery</h3>
              <p className="text-slate-400 text-sm">WABEK automatically sends a WhatsApp reminder when a customer starts checkout but doesn't complete it. The message includes a direct link back to their cart.</p>
            </div>

            <div className="card border-green-900/30 bg-green-900/10">
              <h3 className="text-green-400 font-semibold text-sm mb-2">💡 Tips</h3>
              <ul className="text-slate-400 text-sm space-y-1.5">
                <li>• Keep messages short and clear — WhatsApp users prefer concise messages</li>
                <li>• Add emojis to make messages feel friendly and personal</li>
                <li>• Use <code className="text-green-400 text-xs">{'{{customer_name}}'}</code> to personalize every message</li>
                <li>• Test each event type before going live</li>
                <li>• Make sure your WhatsApp number stays connected</li>
              </ul>
            </div>

            <div className="card">
              <h3 className="text-slate-900 font-semibold text-sm mb-3">Available Variables</h3>
              <div className="space-y-2">
                {[
                  { var: '{{customer_name}}', desc: 'Customer\'s first name' },
                  { var: '{{order_id}}', desc: 'Order number (e.g., 1042)' },
                  { var: '{{total}}', desc: 'Order total with currency' },
                  { var: '{{tracking_number}}', desc: 'Tracking link or number' },
                  { var: '{{checkout_url}}', desc: 'Link to complete checkout (abandoned cart)' },
                ].map(v => (
                  <div key={v.var} className="flex items-center gap-3 text-sm">
                    <code className="text-blue-600 bg-blue-50/20 px-2 py-0.5 rounded text-xs font-mono flex-shrink-0">{v.var}</code>
                    <span className="text-slate-500">{v.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  )
}
