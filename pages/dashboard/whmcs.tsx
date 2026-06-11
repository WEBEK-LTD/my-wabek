// @ts-nocheck
import { useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useAuthStore } from '@/lib/store'
import { useQuery } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { ClipboardIcon, CheckCircleIcon, BuildingOfficeIcon, BellIcon, CodeBracketIcon, PuzzlePieceIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

const THEMES = ['Hostingard', 'Lagom2', 'Nexus', 'Six', 'Twenty-One']

const EVENTS = [
  { key: 'invoice_created',    label: 'Invoice Created',       icon: '🧾' },
  { key: 'invoice_paid',       label: 'Invoice Paid',          icon: '✅' },
  { key: 'invoice_overdue',    label: 'Invoice Overdue',       icon: '⚠️' },
  { key: 'invoice_reminder',   label: 'Payment Reminder',      icon: '⏰' },
  { key: 'ticket_open',        label: 'Ticket Opened',         icon: '🎫' },
  { key: 'ticket_reply',       label: 'Ticket Reply',          icon: '💬' },
  { key: 'ticket_close',       label: 'Ticket Closed',         icon: '🔒' },
  { key: 'service_active',     label: 'Service Activated',     icon: '🚀' },
  { key: 'service_suspended',  label: 'Service Suspended',     icon: '🔴' },
  { key: 'service_terminated', label: 'Service Terminated',    icon: '🗑️' },
  { key: 'service_unsuspend',  label: 'Service Restored',      icon: '💚' },
  { key: 'domain_registered',  label: 'Domain Registered',     icon: '🌐' },
  { key: 'domain_renewal',     label: 'Domain Renewed',        icon: '🔁' },
  { key: 'order_placed',       label: 'Order Confirmed',       icon: '🛒' },
]

function CopyBlock({ code, label = '' }) {
  const [c, setC] = useState(false)
  return (
    <div className="relative bg-white border border-slate-200 rounded-xl overflow-hidden">
      {label && <div className="px-4 py-2 bg-[#F8FAFC]/50 border-b border-slate-200 text-xs text-slate-400 font-medium">{label}</div>}
      <pre className="px-4 py-3 text-xs text-slate-800 font-mono whitespace-pre-wrap overflow-x-auto leading-relaxed">{code}</pre>
      <button onClick={() => { navigator.clipboard.writeText(code); setC(true); setTimeout(() => setC(false), 2000) }}
        className="absolute top-2 right-2 p-1.5 bg-[#F8FAFC]/80 rounded-lg text-slate-400 hover:text-slate-900 transition-colors">
        {c ? <CheckCircleIcon className="w-3.5 h-3.5 text-blue-600" /> : <ClipboardIcon className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}

export default function WHMCSPage() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState('setup')
  const [testPhone, setTestPhone] = useState('')
  const [testEvent, setTestEvent] = useState('invoice_created')
  const [testing, setTesting] = useState(false)
  const [selectedTheme, setSelectedTheme] = useState('Hostingard')

  const { data: apiKeysData } = useQuery('api-keys-list', () => axios.get('/api/settings/api-keys').then(r => r.data), { retry: false })
  const apiKey = apiKeysData?.keys?.[0]?.key || 'YOUR_API_KEY'
  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://waabek.com'

  const sendTest = async () => {
    if (!testPhone) { toast.error('Enter a phone number'); return }
    setTesting(true)
    try {
      await axios.post('/api/whmcs/test', { phone: testPhone, event: testEvent })
      toast.success('Test message sent! ✅')
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed — check WhatsApp instance')
    } finally { setTesting(false) }
  }

  const themeName = selectedTheme.toLowerCase().replace(' ', '-')
  const footerPath = `/templates/${themeName}/footer.tpl`
  const widgetCode = `{* WABEK WhatsApp Chat Widget *}
{php}
if (file_exists(ROOTDIR . '/modules/addons/wabek/wabek-theme-helper.php')) {
    require_once ROOTDIR . '/modules/addons/wabek/wabek-theme-helper.php';
    wabek_inject_chat_widget();
}
{/php}`

  return (
    <DashboardLayout title="WHMCS Integration">
      <div className="max-w-4xl space-y-5">

        {/* Header */}
        <div className="card border-blue-200/40 bg-blue-50/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <BuildingOfficeIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-display font-semibold text-slate-900">WHMCS WhatsApp Notifications</h3>
              <p className="text-sm text-slate-400">14 events · 5 themes compatible · WhatsApp chat widget</p>
            </div>
            <a href="https://billing.webek.org/download/category/4/Wordpress-Plugins-.html"
              target="_blank" className="btn-primary text-sm">
              ⬇️ Download Module
            </a>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200">
          {[
            { id: 'setup', label: '⚙️ Setup' },
            { id: 'themes', label: '🎨 Theme Integration' },
            { id: 'events', label: '📋 Events (14)' },
            { id: 'templates', label: '💬 Templates' },
            { id: 'test', label: '🧪 Test' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={clsx('px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === t.id ? 'border-brand-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700')}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Setup Tab ──────────────────────────────── */}
        {tab === 'setup' && (
          <div className="space-y-4">
            <div className="card">
              <h3 className="font-display font-semibold text-slate-900 mb-4">Step 1 — Upload & Activate</h3>
              <div className="space-y-3 text-sm">
                {[
                  'Download the WABEK WHMCS module from the link above',
                  'Extract the ZIP — you\'ll get a `modules/` folder',
                  'Upload `modules/addons/wabek/` to your WHMCS root',
                  'Go to WHMCS Admin → Setup → Addon Modules',
                  'Find WABEK WhatsApp Notifications → Click Activate',
                  'Set access to Administrators',
                ].map((step, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-50 border border-blue-200/50 flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0">{i + 1}</div>
                    <p className="text-slate-700 pt-0.5 text-sm">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="font-display font-semibold text-slate-900 mb-4">Step 2 — Configure</h3>
              <p className="text-sm text-slate-400 mb-3">Go to <strong className="text-slate-900">Addons → WABEK WhatsApp</strong> and set:</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-200">
                    <th className="table-head text-left">Field</th>
                    <th className="table-head text-left">Value</th>
                  </tr></thead>
                  <tbody>
                    {[
                      ['API Key', apiKey, true],
                      ['Instance ID', 'Leave empty for default', false],
                      ['API URL', `${appUrl}/api/v1/send`, true],
                      ['Phone Field', 'phonenumber', false],
                      ['Country Code', '20 (Egypt) / 966 (Saudi) / 44 (UK)', false],
                    ].map(([field, val, copy]) => (
                      <tr key={field} className="table-row">
                        <td className="table-cell font-medium text-slate-900">{field}</td>
                        <td className="table-cell">
                          <div className="flex items-center gap-2">
                            <code className="text-blue-600 text-xs bg-slate-100 px-2 py-0.5 rounded">{val}</code>
                            {copy && <button onClick={() => { navigator.clipboard.writeText(val); toast.success('Copied!') }} className="text-slate-600 hover:text-slate-400"><ClipboardIcon className="w-3.5 h-3.5" /></button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <h3 className="font-display font-semibold text-slate-900 mb-3">Step 3 — Enable Events</h3>
              <p className="text-sm text-slate-400">In the addon settings, toggle ON/OFF each notification type. All 14 events are enabled by default.</p>
            </div>
          </div>
        )}

        {/* ── Theme Integration Tab ───────────────────── */}
        {tab === 'themes' && (
          <div className="space-y-4">
            <div className="card">
              <h3 className="font-display font-semibold text-slate-900 mb-4">Select Your Theme</h3>
              <div className="flex flex-wrap gap-2 mb-6">
                {THEMES.map(t => (
                  <button key={t} onClick={() => setSelectedTheme(t)}
                    className={clsx('px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                      selectedTheme === t ? 'bg-blue-600 text-white' : 'bg-[#F8FAFC] text-slate-700 hover:text-white')}>
                    {t}
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-slate-900 mb-2">
                    Add WhatsApp Chat Widget to <span className="text-blue-600">{selectedTheme}</span>
                  </p>
                  <p className="text-xs text-slate-500 mb-3">
                    Open <code className="bg-slate-100 px-1.5 py-0.5 rounded text-blue-600">{footerPath}</code> and paste this before <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{`</body>`}</code>:
                  </p>
                  <CopyBlock code={widgetCode} label={`${footerPath}`} />
                </div>

                <div className="p-4 bg-[#F8FAFC] border border-slate-200/50 rounded-xl">
                  <p className="text-sm font-medium text-slate-900 mb-2">Chat Widget Settings (in Addon Config)</p>
                  <div className="grid grid-cols-2 gap-3 text-xs text-slate-400">
                    {[
                      ['Enable Chat Widget', 'Yes'],
                      ['Chat Phone Number', 'Your WhatsApp number'],
                      ['Widget Message', 'Hello! I need help...'],
                      ['Widget Color', '#25D366'],
                      ['Position', 'Right or Left'],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-slate-500">{k}</span>
                        <span className="text-slate-700">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-yellow-900/10 border border-yellow-800/30 rounded-xl text-xs text-slate-400">
                  <p className="text-yellow-400 font-medium mb-1">💡 Theme-specific notes:</p>
                  {selectedTheme === 'Hostingard' && <p>Hostingard uses Bootstrap 4. The widget renders correctly over the sticky header.</p>}
                  {selectedTheme === 'Lagom2' && <p>Lagom2 has a floating action button zone — place the widget code after the existing FAB if any.</p>}
                  {selectedTheme === 'Nexus' && <p>Nexus uses a dark sidebar layout. Use <code>position: left</code> if sidebar is on right.</p>}
                  {selectedTheme === 'Six' && <p>Six is WHMCS's default theme. Compatible with all standard WHMCS 8.x installations.</p>}
                  {selectedTheme === 'Twenty-One' && <p>Twenty-One has a modern card layout. The widget blends well with <code>#25D366</code> color.</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Events Tab ─────────────────────────────── */}
        {tab === 'events' && (
          <div className="card">
            <h3 className="font-display font-semibold text-slate-900 mb-4">All 14 Supported Events</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EVENTS.map(e => (
                <div key={e.key} className="flex items-center gap-3 p-3 bg-[#F8FAFC] rounded-xl border border-slate-200/50">
                  <span className="text-xl">{e.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{e.label}</p>
                    <p className="text-xs text-slate-500 font-mono text-slate-800">{e.key}</p>
                  </div>
                  <CheckCircleIcon className="w-4 h-4 text-blue-600 ml-auto flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Templates Tab ──────────────────────────── */}
        {tab === 'templates' && (
          <div className="space-y-4">
            {[
              {
                label: '🧾 Invoice Created',
                msg: `🧾 *New Invoice #{{invoice_id}}*\n\nHi {{client_name}},\n\nA new invoice has been created.\n\n💰 Amount: {{amount}} {{currency}}\n📅 Due: {{due_date}}\n\nPay here: {{invoice_url}}`,
              },
              {
                label: '✅ Invoice Paid',
                msg: `✅ *Payment Confirmed*\n\nHi {{client_name}},\n\nPayment received for Invoice #{{invoice_id}}.\n\n💰 Amount: {{amount}} {{currency}}\n📅 Date: {{date}}\n\nThank you! 🙏`,
              },
              {
                label: '⚠️ Invoice Overdue',
                msg: `⚠️ *Invoice Overdue — #{{invoice_id}}*\n\nHi {{client_name}},\n\nYour invoice is overdue. Please pay to avoid suspension.\n\n💰 Amount: {{amount}}\n📅 Was Due: {{due_date}}\n\n{{invoice_url}}`,
              },
              {
                label: '🎫 Ticket Opened',
                msg: `🎫 *Support Ticket #{{ticket_id}}*\n\nHi {{client_name}},\n\nYour ticket has been received.\n\n📝 {{subject}}\n🕐 Priority: {{priority}}\n\nWe'll respond shortly.\n{{ticket_url}}`,
              },
              {
                label: '🚀 Service Activated',
                msg: `🚀 *Service Activated*\n\nHi {{client_name}},\n\nYour service is live!\n\n📦 {{product}}\n🌐 {{domain}}\n👤 Username: {{username}}\n\nLogin: {{client_area}}`,
              },
              {
                label: '🔴 Service Suspended',
                msg: `🔴 *Service Suspended*\n\nHi {{client_name}},\n\nYour service has been suspended due to non-payment.\n\n📦 {{product}}\n🌐 {{domain}}\n\nSettle invoices: {{client_area}}`,
              },
              {
                label: '🌐 Domain Registered',
                msg: `🌐 *Domain Registered*\n\nHi {{client_name}},\n\nYour domain is live!\n\n🔗 {{domain}}\n📅 Expires: {{expiry}}\n\nManage: {{client_area}}`,
              },
            ].map(t => (
              <div key={t.label}>
                <p className="text-sm font-medium text-slate-900 mb-2">{t.label}</p>
                <CopyBlock code={t.msg} />
              </div>
            ))}

            <div className="p-3 bg-[#F8FAFC] border border-slate-200 rounded-xl">
              <p className="text-xs font-medium text-slate-900 mb-2">📌 Available Variables</p>
              <div className="flex flex-wrap gap-2">
                {['{{client_name}}', '{{invoice_id}}', '{{amount}}', '{{currency}}', '{{due_date}}', '{{invoice_url}}', '{{ticket_id}}', '{{subject}}', '{{domain}}', '{{product}}', '{{username}}', '{{client_area}}', '{{date}}', '{{expiry}}', '{{priority}}'].map(v => (
                  <code key={v} className="text-xs bg-slate-100 text-blue-600 px-2 py-0.5 rounded">{v}</code>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Test Tab ───────────────────────────────── */}
        {tab === 'test' && (
          <div className="card max-w-md space-y-4">
            <h3 className="font-display font-semibold text-slate-900">Send Test Message</h3>
            <div>
              <label className="label">Phone Number (with country code)</label>
              <input value={testPhone} onChange={e => setTestPhone(e.target.value)}
                placeholder="+201234567890" className="input" />
            </div>
            <div>
              <label className="label">Event to test</label>
              <select value={testEvent} onChange={e => setTestEvent(e.target.value)} className="input">
                {EVENTS.map(e => <option key={e.key} value={e.key}>{e.icon} {e.label}</option>)}
              </select>
            </div>
            <button onClick={sendTest} disabled={testing} className="btn-primary w-full justify-center">
              <BellIcon className="w-4 h-4" />
              {testing ? 'Sending...' : 'Send Test Message'}
            </button>
          </div>
        )}

      </div>
    </DashboardLayout>
  )
}
