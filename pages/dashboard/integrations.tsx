// @ts-nocheck
import { useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { PlusIcon, TrashIcon, ClipboardIcon, CheckIcon, ArrowPathIcon, XMarkIcon, BoltIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

const EVENTS = [
  { value: 'message_received', label: '📥 Message Received', desc: 'Fires when a contact sends you a message' },
  { value: 'message_sent', label: '📤 Message Sent', desc: 'Fires when any outbound message is sent (API, inbox, campaigns, bots)' },
  { value: 'message_status', label: '✔️ Message Status', desc: 'Fires when an outbound message is delivered, read or failed' },
  { value: 'contact_created', label: '👤 New Contact', desc: 'Fires when a new contact is created' },
  { value: 'campaign_completed', label: '📢 Campaign Completed', desc: 'Fires when a campaign finishes sending' },
  { value: 'opt_out', label: '🚫 Opt-out', desc: 'Fires when a contact unsubscribes (STOP) or is opted out' },
  { value: 'opt_in', label: '✅ Opt-in', desc: 'Fires when a contact re-subscribes (START) or is opted in' },
  { value: 'chatbot_triggered', label: '🤖 Chatbot Triggered', desc: 'Fires when a chatbot flow starts' },
  { value: 'link_clicked', label: '🔗 Link Clicked', desc: 'Fires when a tracked link is clicked' },
]

function CopyBtn({ text }) {
  const [c, setC] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setC(true); setTimeout(() => setC(false), 2000) }}
      className="p-1.5 text-slate-400 hover:text-slate-900 flex-shrink-0">
      {c ? <CheckIcon className="w-3.5 h-3.5 text-blue-600" /> : <ClipboardIcon className="w-3.5 h-3.5" />}
    </button>
  )
}

export default function IntegrationsPage() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState('webhooks')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ target_url: '', event: 'message_received', label: '' })
  const [testingId, setTestingId] = useState(null)
  const [newSecret, setNewSecret] = useState(null)

  const { data, isLoading } = useQuery('zapier-hooks', () => axios.get('/api/webhooks/zapier').then(r => r.data))
  const hooks = data?.hooks || []

  const { data: apiKeysData } = useQuery('api-keys-list', () => axios.get('/api/settings/api-keys').then(r => r.data))
  const apiKey = apiKeysData?.keys?.[0]?.key || 'YOUR_API_KEY'

  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://waabek.com'

  const createMut = useMutation(
    body => axios.post('/api/webhooks/zapier', body),
    {
      onSuccess: (r) => {
        qc.invalidateQueries('zapier-hooks')
        if (r?.data?.secret) setNewSecret(r.data.secret)
        setShowForm(false)
        setForm({ target_url: '', event: 'message_received', label: '' })
        toast.success('Webhook created ✅')
      },
      onError: e => toast.error(e?.response?.data?.error || 'Failed'),
    }
  )

  const deleteMut = useMutation(
    id => axios.delete(`/api/webhooks/zapier?id=${id}`),
    { onSuccess: () => { qc.invalidateQueries('zapier-hooks'); toast.success('Deleted') } }
  )

  // Signed test delivery from the server (same headers as real events)
  const testWebhook = async (hook) => {
    setTestingId(hook.id)
    try {
      await axios.post('/api/webhooks/zapier', { action: 'test', id: hook.id })
      toast.success('Test payload sent ✅')
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to reach webhook URL')
    }
    setTestingId(null)
  }

  const rotateSecret = async (hook) => {
    if (!confirm('Generate a new signing secret? The old one stops working immediately.')) return
    try {
      const r = await axios.post('/api/webhooks/zapier', { action: 'rotate_secret', id: hook.id })
      setNewSecret(r.data.secret)
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed')
    }
  }

  return (
    <DashboardLayout title="Integrations & Webhooks">
      <div className="max-w-4xl space-y-6">

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200 mb-2">
          {[{ id: 'webhooks', label: '🔗 Webhooks' }, { id: 'zapier', label: '⚡ Zapier' }, { id: 'make', label: '🔄 Make' }, { id: 'api', label: '🔌 REST API' }, { id: 'modules', label: '📦 Modules' }].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={clsx('px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === t.id ? 'border-brand-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700')}>
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'webhooks' && <>
        {/* Send API */}
        <div className="card">
          <h3 className="font-display font-semibold text-slate-900 mb-1">📤 Send Message — Trigger URL</h3>
          <p className="text-xs text-slate-500 mb-3">Use this URL in Zapier, Make, or any automation tool to send WhatsApp messages</p>
          <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-4 space-y-3">
            <div>
              <p className="text-xs text-slate-500 mb-1">Endpoint</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs text-blue-600 font-mono bg-slate-100 px-3 py-2 rounded-lg">
                  POST {appUrl}/api/webhooks/trigger
                </code>
                <CopyBtn text={`${appUrl}/api/webhooks/trigger`} />
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Header</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs text-slate-800 font-mono bg-slate-100 px-3 py-2 rounded-lg">
                  X-API-Key: {apiKey}
                </code>
                <CopyBtn text={`X-API-Key: ${apiKey}`} />
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Body (JSON)</p>
              <div className="flex items-start gap-2">
                <pre className="flex-1 text-xs text-slate-800 font-mono bg-slate-100 px-3 py-2 rounded-lg">
{`{
  "to": "201234567890",
  "message": "Hello {{name}}!",
  "instance_id": "optional"
}`}
                </pre>
                <CopyBtn text={`{"to":"201234567890","message":"Hello!"}`} />
              </div>
            </div>
          </div>
        </div>

        </>
        }

        {activeTab === 'zapier' && <>
        {/* Zapier guide */}
        <div className="card">
          <h3 className="font-display font-semibold text-slate-900 mb-1">⚡ Zapier Setup</h3>
          <p className="text-xs text-slate-500 mb-4">Connect WABEK to 5,000+ apps with Zapier</p>
          <div className="space-y-3">
            {[
              { n: '1', t: 'Create a Zap', d: 'In Zapier, click "Create Zap" and choose your trigger app (e.g. Google Forms, Typeform, Shopify...)' },
              { n: '2', t: 'Add Webhook action', d: 'Search for "Webhooks by Zapier" → choose "POST" action' },
              { n: '3', t: 'Configure the webhook', d: `URL: ${appUrl}/api/webhooks/trigger\nMethod: POST\nData Pass-Through: No` },
              { n: '4', t: 'Set Headers', d: `X-API-Key: ${apiKey}\nContent-Type: application/json` },
              { n: '5', t: 'Set Body', d: 'to: (customer phone field)\nmessage: (your message template)' },
            ].map(step => (
              <div key={step.n} className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-50 border border-blue-200/50 flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0 mt-0.5">{step.n}</div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{step.t}</p>
                  <p className="text-xs text-slate-500 mt-0.5 whitespace-pre-line">{step.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        </>
        }

        {activeTab === 'make' && <>
        {/* Make guide */}
        <div className="card">
          <h3 className="font-display font-semibold text-slate-900 mb-1">🔄 Make (Integromat) Setup</h3>
          <p className="text-xs text-slate-500 mb-4">Use Make's HTTP module to send WhatsApp messages</p>
          <div className="space-y-3">
            {[
              { n: '1', t: 'Create a Scenario', d: 'In Make, create a new scenario and add your trigger module' },
              { n: '2', t: 'Add HTTP module', d: 'Click + → search "HTTP" → choose "Make a request"' },
              { n: '3', t: 'Configure request', d: `URL: ${appUrl}/api/webhooks/trigger\nMethod: POST\nBody type: Raw\nContent type: JSON (application/json)` },
              { n: '4', t: 'Add header', d: `Name: X-API-Key\nValue: ${apiKey}` },
              { n: '5', t: 'Set body', d: '{"to": "{{phone}}", "message": "{{message}}"}' },
            ].map(step => (
              <div key={step.n} className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-purple-900/40 border border-purple-800/50 flex items-center justify-center text-purple-400 text-xs font-bold flex-shrink-0 mt-0.5">{step.n}</div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{step.t}</p>
                  <p className="text-xs text-slate-500 mt-0.5 whitespace-pre-line">{step.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        </>
        }

        {activeTab === 'api' && <>
        {/* Outgoing webhooks */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-semibold text-slate-900">🔗 Outgoing Webhooks</h3>
              <p className="text-xs text-slate-500 mt-0.5">Get notified when events happen in WABEK</p>
            </div>
            <button onClick={() => setShowForm(v => !v)} className="btn-primary text-sm">
              <PlusIcon className="w-4 h-4" /> Add Webhook
            </button>
          </div>

          {showForm && (
            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-4 mb-4 space-y-3">
              <div>
                <label className="label">Webhook URL *</label>
                <input value={form.target_url} onChange={e => setForm(f => ({ ...f, target_url: e.target.value }))}
                  placeholder="https://hooks.zapier.com/hooks/catch/..." className="input" />
              </div>
              <div>
                <label className="label">Event</label>
                <select value={form.event} onChange={e => setForm(f => ({ ...f, event: e.target.value }))} className="input">
                  {EVENTS.map(ev => <option key={ev.value} value={ev.value}>{ev.label}</option>)}
                </select>
                <p className="text-xs text-slate-500 mt-1">{EVENTS.find(e => e.value === form.event)?.desc}</p>
              </div>
              <div>
                <label className="label">Label (optional)</label>
                <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="e.g. Notify CRM" className="input" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => createMut.mutate(form)} disabled={createMut.isLoading || !form.target_url}
                  className="btn-primary text-sm">
                  {createMut.isLoading ? <><ArrowPathIcon className="w-4 h-4 animate-spin" /> Creating...</> : '✅ Create Webhook'}
                </button>
                <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button>
              </div>
            </div>
          )}

          {newSecret && (
            <div className="mb-4 p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs">
              <p className="font-medium text-amber-800 mb-1">Signing secret — copy it now, it is shown only once:</p>
              <div className="flex items-center gap-1"><code className="font-mono break-all text-slate-800">{newSecret}</code><CopyBtn text={newSecret} /></div>
              <p className="text-amber-700 mt-1">Verify <code>X-WABEK-Signature: sha256=HMAC_SHA256(secret, X-WABEK-Timestamp + "." + raw body)</code>.</p>
              <button onClick={() => setNewSecret(null)} className="btn-secondary text-xs mt-2 py-1 px-2">Done</button>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-16 skeleton rounded-xl" />)}</div>
          ) : hooks.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl">
              <BoltIcon className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No webhooks yet</p>
              <p className="text-slate-600 text-xs mt-1">Add a webhook to receive real-time events</p>
            </div>
          ) : (
            <div className="space-y-2">
              {hooks.map(hook => (
                <div key={hook.id} className="flex items-center gap-3 p-3 bg-[#F8FAFC] border border-slate-200 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-blue-600 bg-blue-50/20 px-2 py-0.5 rounded font-mono text-slate-800">
                        {EVENTS.find(e => e.value === hook.event)?.label || hook.event}
                      </span>
                      {hook.label && <span className="text-xs text-slate-500">{hook.label}</span>}
                      <span className={clsx('text-xs px-1.5 py-0.5 rounded', hook.is_active ? 'badge-green' : 'badge-gray')}>
                        {hook.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <code className="text-xs text-slate-400 font-mono truncate text-slate-800">{hook.target_url}</code>
                      <CopyBtn text={hook.target_url} />
                    </div>
                  </div>
                  <button onClick={() => testWebhook(hook)} disabled={testingId === hook.id}
                    className="btn-secondary text-xs py-1.5 px-3 flex-shrink-0">
                    {testingId === hook.id ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> : '🧪 Test'}
                  </button>
                  <button onClick={() => rotateSecret(hook)} className="btn-secondary text-xs py-1.5 px-3 flex-shrink-0">🔑 Secret</button>
                  <button onClick={() => { if (confirm('Delete webhook?')) deleteMut.mutate(hook.id) }}
                    className="p-1.5 text-slate-500 hover:text-red-400 flex-shrink-0">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 p-3 bg-[#F8FAFC] rounded-xl border border-slate-200/50">
            <p className="text-xs text-slate-500 font-medium mb-2">📋 Webhook Payload Example (message_received):</p>
            <pre className="text-xs text-slate-400 font-mono leading-relaxed">{`POST <your URL>
X-WABEK-Event: message_received
X-WABEK-Timestamp: 1735732800
X-WABEK-Signature: sha256=<hex>

{
  "event": "message_received",
  "created_at": "2025-01-01T12:00:00.000Z",
  "data": {
    "message_id": "wamid.HBgM...",
    "from": "201234567890",
    "name": "Contact Name",
    "message": "Hello!",
    "type": "text",
    "contact_id": "uuid",
    "instance_id": "uuid"
  }
}`}</pre>
          </div>
        </div>

        </>
        }

        {activeTab === 'modules' && <>
        <div className="card">
          <h3 className="font-display font-semibold text-slate-900 mb-1">📦 Plugins &amp; Modules</h3>
          <p className="text-xs text-slate-500 mb-4">Download and install WABEK integrations for your platform.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-slate-200 rounded-xl p-4 flex flex-col">
              <div className="flex items-center gap-3 mb-2">
                <img src="https://cdn.simpleicons.org/wordpress/21759B" alt="WordPress" className="w-8 h-8 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-slate-900 text-sm">WordPress Plugin</h4>
                  <p className="text-xs text-slate-500">WhatsApp notifications &amp; OTP for WordPress/WooCommerce</p>
                </div>
              </div>
              <ul className="text-xs text-slate-500 space-y-1 mb-4 mt-1">
                <li>• Order &amp; OTP notifications via WhatsApp</li>
                <li>• WooCommerce integration</li>
                <li>• Connects with your WABEK API key</li>
              </ul>
              <a href="/downloads/wabek-wordpress-plugin.zip" download
                className="btn-primary text-sm w-full justify-center mt-auto">
                ⬇️ Download Plugin (.zip)
              </a>
              <p className="text-xs text-slate-400 mt-2">Install via WordPress Admin → Plugins → Add New → Upload Plugin.</p>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 flex flex-col">
              <div className="flex items-center gap-3 mb-2">
                <img src="https://logo.clearbit.com/whmcs.com" alt="WHMCS" className="w-8 h-8 flex-shrink-0 rounded" />
                <div>
                  <h4 className="font-semibold text-slate-900 text-sm">WHMCS Addon</h4>
                  <p className="text-xs text-slate-500">Full WhatsApp automation suite for WHMCS</p>
                </div>
              </div>
              <ul className="text-xs text-slate-500 space-y-1 mb-4 mt-1">
                <li>• Invoice, ticket &amp; service notifications</li>
                <li>• Campaigns, chatbot &amp; shared inbox</li>
                <li>• White label mode &amp; permissions manager</li>
              </ul>
              <a href="/downloads/wabek-whmcs-addon.zip" download
                className="btn-primary text-sm w-full justify-center mt-auto">
                ⬇️ Download Addon (.zip)
              </a>
              <p className="text-xs text-slate-400 mt-2">Install via WHMCS Admin → System → Addon Modules → Upload &amp; Activate.</p>
            </div>
          </div>

          <div className="mt-4 p-3 bg-[#F8FAFC] rounded-lg text-xs text-slate-500">
            💡 Need your API key for setup? Find it under <strong>Integrations → REST API</strong> in this page.
          </div>
        </div>
        </>
        }
      </div>
    </DashboardLayout>
  )
}
