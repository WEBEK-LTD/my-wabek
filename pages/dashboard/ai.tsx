// @ts-nocheck
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { CpuChipIcon, BoltIcon, ChatBubbleLeftRightIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

const MODELS = [
  { id: 'deepseek-v4-flash', label: 'WABEK AI', desc: 'Powered by WABEK AI' },
]

export default function AISettingsPage() {
  const qc = useQueryClient()
  const [selectedInstance, setSelectedInstance] = useState('')
  const [testMsg, setTestMsg] = useState('')
  const [testResult, setTestResult] = useState(null)
  const [testing, setTesting] = useState(false)
  const [form, setForm] = useState({
    is_enabled: false,
    company_name: '',
    system_prompt: '',
    model: 'WABEK AI-v4-flash',
    max_tokens: 300,
    temperature: 0.7,
    escalation_keywords: 'agent,human,انسان,موظف,بشري',
  })

  const { data: instData } = useQuery('instances',
    () => axios.get('/api/whatsapp/instances').then(r => r.data)
  )
  const { data: aiData } = useQuery('ai-settings',
    () => axios.get('/api/ai/settings').then(r => r.data)
  )
  const { data: statsData, refetch: refetchStats } = useQuery('ai-stats',
    () => axios.get('/api/ai/stats').then(r => r.data)
  )

  const instances = instData?.instances || []
  const aiSettings = aiData?.settings || []
  const stats = statsData || {}

  const planOk = stats.limit === -1 || (stats.limit > 0 && stats.allowed)

  const loadInstance = (instanceId) => {
    setSelectedInstance(instanceId)
    setTestResult(null)
    const existing = aiSettings.find(s => s.instance_id === instanceId)
    if (existing) {
      setForm({
        is_enabled: existing.is_enabled,
        company_name: existing.company_name || '',
        system_prompt: existing.system_prompt || '',
        model: existing.model || 'WABEK AI-v4-flash',
        max_tokens: existing.max_tokens || 300,
        temperature: existing.temperature ?? 0.7,
        escalation_keywords: existing.escalation_keywords || 'agent,human,انسان,موظف,بشري',
      })
    } else {
      setForm({
        is_enabled: false, company_name: '', system_prompt: '',
        model: 'WABEK AI-v4-flash', max_tokens: 300, temperature: 0.7,
        escalation_keywords: 'agent,human,انسان,موظف,بشري',
      })
    }
  }

  const saveMut = useMutation(
    () => axios.post('/api/ai/settings', { instance_id: selectedInstance, ...form }),
    {
      onSuccess: () => {
        qc.invalidateQueries('ai-settings')
        refetchStats()
        toast.success('AI settings saved ✅')
      },
      onError: (e) => toast.error(e?.response?.data?.error || 'Failed to save'),
    }
  )

  const runTest = async () => {
    if (!testMsg.trim() || !selectedInstance) return
    setTesting(true)
    setTestResult(null)
    try {
      const { data } = await axios.post('/api/ai/test', {
        instance_id: selectedInstance,
        message: testMsg,
        system_prompt: form.system_prompt,
        company_name: form.company_name,
        model: form.model,
        max_tokens: form.max_tokens,
        temperature: form.temperature,
      })
      setTestResult({ ok: true, reply: data.reply })
    } catch (e) {
      setTestResult({ ok: false, error: e?.response?.data?.error || 'Failed' })
    }
    setTesting(false)
  }

  const usagePct = stats.limit > 0 ? Math.round((stats.replies_this_month / stats.limit) * 100) : 0

  return (
    <DashboardLayout title="AI Auto-Reply">
      <div className="max-w-3xl space-y-5">

        {/* Plan warning */}
        {!planOk && (
          <div className="card border-yellow-800/50 bg-yellow-900/10">
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-900 text-sm">AI replies not available on your plan</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {stats.limit === 0
                    ? 'Your current plan has 0 AI replies/month. Ask the admin to update your plan.'
                    : `You've used all ${stats.limit} AI replies this month. Upgrade to get more.`}
                </p>
                <a href="/dashboard/billing" className="text-xs text-yellow-400 underline mt-1 inline-block">View Billing →</a>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="stat-card border-blue-200/40">
            <div className="flex items-center gap-2 mb-1">
              <CpuChipIcon className="w-4 h-4 text-blue-600" />
              <p className="text-xs text-slate-500">This Month</p>
            </div>
            <p className="text-2xl font-display font-bold text-slate-900">
              {stats.replies_this_month || 0}
              {stats.limit > 0 && <span className="text-sm text-slate-500 font-normal"> / {stats.limit}</span>}
              {stats.limit === -1 && <span className="text-sm text-blue-600 font-normal"> / ∞</span>}
            </p>
            {stats.limit > 0 && (
              <div className="mt-2 h-1.5 bg-[#F8FAFC] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{
                  width: `${Math.min(usagePct, 100)}%`,
                  background: usagePct > 85 ? '#EF4444' : usagePct > 60 ? '#F59E0B' : '#00D46A'
                }} />
              </div>
            )}
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 mb-1">
              <ChatBubbleLeftRightIcon className="w-4 h-4 text-blue-400" />
              <p className="text-xs text-slate-500">Total Replies</p>
            </div>
            <p className="text-2xl font-display font-bold text-slate-900">{(stats.total_replies || 0).toLocaleString()}</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 mb-1">
              <BoltIcon className="w-4 h-4 text-yellow-400" />
              <p className="text-xs text-slate-500">Active Instances</p>
            </div>
            <p className="text-2xl font-display font-bold text-slate-900">
              {aiSettings.filter(s => s.is_enabled).length}
            </p>
          </div>
        </div>

        {/* How it works */}
        <div className="card border-blue-200/30 bg-blue-50/5">
          <h3 className="font-display font-semibold text-slate-900 mb-3">🤖 How AI Auto-Reply Works</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            {[
              { icon: '1️⃣', title: 'Message arrives',  desc: 'Customer sends WhatsApp message' },
              { icon: '2️⃣', title: 'Chatbot first',    desc: 'If chatbot flow matches → it replies' },
              { icon: '3️⃣', title: 'AI fallback',      desc: 'No chatbot match → WABEK AI replies' },
            ].map(s => (
              <div key={s.icon} className="text-center">
                <div className="text-2xl mb-1">{s.icon}</div>
                <p className="font-medium text-slate-900 text-xs">{s.title}</p>
                <p className="text-slate-500 text-xs mt-0.5">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Instance selector */}
        <div className="card space-y-4">
          <h3 className="font-display font-semibold text-slate-900">Select Instance</h3>
          {instances.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-slate-500 text-sm">No connected WhatsApp instances</p>
              <a href="/dashboard/instances" className="text-xs text-blue-600 underline mt-1 inline-block">Connect one →</a>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {instances.map(inst => {
                const s = aiSettings.find(a => a.instance_id === inst.id)
                return (
                  <button key={inst.id} onClick={() => loadInstance(inst.id)}
                    className={clsx(
                      'flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                      selectedInstance === inst.id
                        ? 'border-brand-500 bg-blue-50/20'
                        : 'border-slate-200 hover:border-gray-600'
                    )}>
                    <div className={clsx('w-2.5 h-2.5 rounded-full flex-shrink-0',
                      inst.status === 'connected' ? 'bg-green-400' : 'bg-slate-200')} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{inst.display_name || inst.phone_number}</p>
                      <p className="text-xs text-slate-500">
                        {inst.phone_number} · {(inst.instance_type || inst.type) === 'wa_web' ? 'WA Web' : 'Cloud API'}
                      </p>
                    </div>
                    {s?.is_enabled
                      ? <span className="badge-green text-xs flex-shrink-0">🟢 AI On</span>
                      : <span className="text-xs text-slate-600 flex-shrink-0">Off</span>
                    }
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Settings form */}
        {selectedInstance && (
          <div className="card space-y-5">
            {/* Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-semibold text-slate-900">AI Settings</h3>
                <p className="text-xs text-slate-500 mt-0.5">Configure how AI replies to customers</p>
              </div>
              <button
                onClick={() => setForm(f => ({ ...f, is_enabled: !f.is_enabled }))}
                className={clsx('relative w-12 h-6 rounded-full transition-colors flex-shrink-0',
                  form.is_enabled ? 'bg-brand-500' : 'bg-[#F8FAFC]')}>
                <span className={clsx('absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow',
                  form.is_enabled ? 'translate-x-7' : 'translate-x-1')} />
              </button>
            </div>

            {/* Status indicator */}
            <div className={clsx('flex items-center gap-2 p-3 rounded-xl text-sm',
              form.is_enabled ? 'bg-blue-50/20 border border-blue-200/40' : 'bg-[#F8FAFC]/50')}>
              <div className={clsx('w-2 h-2 rounded-full', form.is_enabled ? 'bg-brand-400 animate-pulse' : 'bg-slate-200')} />
              <span className={form.is_enabled ? 'text-blue-600' : 'text-slate-500'}>
                {form.is_enabled ? 'AI will reply to incoming messages on this instance' : 'AI is disabled for this instance'}
              </span>
            </div>

            {/* Company name */}
            <div>
              <label className="label">Company / Brand Name</label>
              <input value={form.company_name}
                onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                className="input" placeholder="Your Company Name" />
            </div>

            {/* System prompt */}
            <div>
              <label className="label">
                System Prompt
                <span className="text-slate-600 font-normal ml-1">(Tell AI about your business)</span>
              </label>
              <textarea value={form.system_prompt}
                onChange={e => setForm(f => ({ ...f, system_prompt: e.target.value }))}
                rows={7} className="input resize-none font-mono text-sm"
                placeholder={`You are a helpful support assistant for [Company Name].

- Products/services: hosting, domains, VPS servers
- Pricing: Starter $9/mo, Pro $29/mo, Business $99/mo
- Support hours: 9am–6pm UTC (Mon–Fri)
- For billing issues: ask for their account email
- For refunds: direct them to billing@company.com
- Language: always reply in the same language the customer uses
- Tone: friendly, professional, concise (max 3 sentences)`}
              />
              <p className="text-xs text-slate-500 mt-1">
                The more detail you provide, the better the AI responses.
                Include your products, pricing, policies and tone.
              </p>
            </div>

            {/* model fixed to WABEK AI */}

            {/* Advanced */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Max Reply Length (tokens)</label>
                <input type="number" min={50} max={1000} step={50}
                  value={form.max_tokens}
                  onChange={e => setForm(f => ({ ...f, max_tokens: parseInt(e.target.value) || 300 }))}
                  className="input" />
                <p className="text-xs text-slate-500 mt-1">≈75 words per 100 tokens</p>
              </div>
              <div>
                <label className="label">Temperature (0–1)</label>
                <input type="number" min={0} max={1} step={0.1}
                  value={form.temperature}
                  onChange={e => setForm(f => ({ ...f, temperature: parseFloat(e.target.value) || 0.7 }))}
                  className="input" />
                <p className="text-xs text-slate-500 mt-1">0.3 precise · 0.7 natural</p>
              </div>
            </div>

            {/* Escalation */}
            <div>
              <label className="label">Escalation Keywords (stop AI, notify you)</label>
              <input value={form.escalation_keywords}
                onChange={e => setForm(f => ({ ...f, escalation_keywords: e.target.value }))}
                className="input font-mono text-sm"
                placeholder="agent,human,انسان,موظف" />
              <p className="text-xs text-slate-500 mt-1">
                Customer says one of these → AI stops, you get a notification to take over
              </p>
            </div>

            <button onClick={() => saveMut.mutate()} disabled={saveMut.isLoading}
              className="btn-primary w-full justify-center">
              {saveMut.isLoading ? 'Saving...' : '💾 Save AI Settings'}
            </button>
          </div>
        )}

        {/* Test AI */}
        {selectedInstance && (
          <div className="card space-y-3">
            <h3 className="font-display font-semibold text-slate-900">🧪 Test AI Response</h3>
            <p className="text-xs text-slate-500">Test how AI will respond — uses your current system prompt settings above</p>
            <div className="flex gap-2">
              <input value={testMsg}
                onChange={e => setTestMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runTest()}
                placeholder="e.g. What are your prices?"
                className="input flex-1" />
              <button onClick={runTest} disabled={testing || !testMsg.trim()}
                className="btn-primary px-4 flex-shrink-0">
                {testing ? '...' : 'Test'}
              </button>
            </div>
            {testResult && (
              <div className={clsx('p-3 rounded-xl text-sm', testResult.ok
                ? 'bg-blue-50/20 border border-blue-200/40'
                : 'bg-red-900/20 border border-red-800/40')}>
                {testResult.ok ? (
                  <>
                    <p className="text-xs text-slate-500 mb-1">🧠 AI would reply:</p>
                    <p className="text-slate-700 whitespace-pre-wrap">{testResult.reply}</p>
                  </>
                ) : (
                  <p className="text-red-400">❌ {testResult.error}</p>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </DashboardLayout>
  )
}
