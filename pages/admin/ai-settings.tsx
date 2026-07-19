// @ts-nocheck
import { useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'

export default function AISettingsPage() {
  const qc = useQueryClient()
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const [showKey, setShowKey] = useState(false)
  const [newKey, setNewKey] = useState('')

  const { data, isLoading } = useQuery('admin-ai-settings', () =>
    axios.get('/api/admin/ai-settings').then(r => r.data)
  )
  const settings = data?.settings || {}

  const saveMut = useMutation(
    (body) => axios.put('/api/admin/ai-settings', body),
    {
      onSuccess: () => { qc.invalidateQueries('admin-ai-settings'); toast.success('Settings saved') },
      onError: (e: any) => toast.error(e?.response?.data?.error || 'Failed'),
    }
  )

  const save = (updates: Record<string, string>) => saveMut.mutate(updates)

  const testConnection = async () => {
    setTesting(true); setTestResult(null)
    try {
      const r = await axios.post('/api/admin/ai-settings')
      setTestResult({ success: true, ...r.data })
      toast.success('Connection successful!')
    } catch (e: any) {
      setTestResult({ success: false, error: e?.response?.data?.error || 'Failed' })
      toast.error('Connection failed')
    }
    setTesting(false)
  }

  const today = new Date().toISOString().split('T')[0]
  const dailyUsage = parseInt(settings[`ai_usage_${today}`] || '0')
  const monthlyUsage = parseInt(settings['ai_monthly_usage'] || '0')

  return (
    <AdminLayout title="AI Settings">
      <div className="max-w-2xl space-y-6">

        {/* Header */}
        <div className="card border-purple-200/50 bg-purple-50/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-purple-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
              </svg>
            </div>
            <div>
              <h2 className="font-display font-semibold text-slate-900">AI Quality Reviews</h2>
              <p className="text-xs text-slate-400">Configure the AI provider and review settings. Customers cannot see this page.</p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 skeleton rounded-xl"/>)}</div>
        ) : (<>

        {/* Enable/Disable */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">Enable AI Reviews</p>
              <p className="text-xs text-slate-400 mt-0.5">Automatically analyze team conversations with AI</p>
            </div>
            <button
              onClick={() => save({ ai_reviews_enabled: settings.ai_reviews_enabled === 'true' ? 'false' : 'true' })}
              className={`relative w-12 h-6 rounded-full transition-colors ${settings.ai_reviews_enabled === 'true' ? 'bg-brand-500' : 'bg-slate-200'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.ai_reviews_enabled === 'true' ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>

        {/* AI Provider */}
        <div className="card space-y-4">
          <h3 className="font-display font-semibold text-slate-900">AI Provider</h3>
          <div>
            <label className="label">Provider</label>
            <select
              defaultValue={settings.ai_provider || 'deepseek'}
              onChange={e => save({ ai_provider: e.target.value })}
              className="input"
            >
              <option value="deepseek">DeepSeek (Default)</option>
              <option value="openai">OpenAI</option>
            </select>
            <p className="text-xs text-slate-400 mt-1">The system is designed to support multiple providers. DeepSeek is the default.</p>
          </div>

          <div>
            <label className="label">API Key</label>
            <div className="flex gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                value={newKey || (showKey ? '' : settings.ai_deepseek_api_key_masked || '')}
                onChange={e => setNewKey(e.target.value)}
                placeholder="sk-..."
                className="input flex-1 font-mono text-sm"
              />
              <button onClick={() => setShowKey(v => !v)} className="btn-secondary px-3">
                {showKey ? '🙈' : '👁️'}
              </button>
            </div>
            {newKey && (
              <button onClick={() => { save({ ai_deepseek_api_key: newKey }); setNewKey('') }}
                className="btn-primary text-sm mt-2">
                Save Key
              </button>
            )}
            <p className="text-xs text-slate-400 mt-1">Stored securely in the database. Never exposed to customers.</p>
          </div>

          <button
            onClick={testConnection}
            disabled={testing}
            className="btn-secondary w-full"
          >
            {testing ? 'Testing...' : '⚡ Test Connection'}
          </button>
          {testResult && (
            <div className={`px-3 py-2 rounded-lg text-sm ${testResult.success ? 'bg-brand-50 text-brand-600' : 'bg-red-50 text-red-500'}`}>
              {testResult.success ? `✅ Connected — Model: ${testResult.model}` : `❌ ${testResult.error}`}
            </div>
          )}
        </div>

        {/* Review Settings */}
        <div className="card space-y-4">
          <h3 className="font-display font-semibold text-slate-900">Review Settings</h3>
          {[
            { key: 'ai_review_interval_hours', label: 'Review Interval (hours)', default: '1', hint: 'How often the scheduler runs' },
            { key: 'ai_inactivity_hours', label: 'Inactivity Threshold (hours)', default: '2', hint: 'Conversation considered ended after X hours of silence' },
            { key: 'ai_max_messages', label: 'Max Messages to Analyze', default: '100', hint: 'Limit per conversation to control costs' },
            { key: 'ai_daily_limit', label: 'Daily Request Limit', default: '500', hint: 'Max AI calls per day across all accounts' },
          ].map(field => (
            <div key={field.key}>
              <label className="label">{field.label}</label>
              <input
                type="number"
                defaultValue={settings[field.key] || field.default}
                onBlur={e => save({ [field.key]: e.target.value })}
                className="input"
              />
              <p className="text-xs text-slate-400 mt-1">{field.hint}</p>
            </div>
          ))}
        </div>

        {/* Usage Stats */}
        <div className="card space-y-3">
          <h3 className="font-display font-semibold text-slate-900">Usage Statistics</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#F8FAFC] rounded-xl p-3 border border-slate-200">
              <p className="text-2xl font-bold text-slate-900">{dailyUsage}</p>
              <p className="text-xs text-slate-400 mt-0.5">Requests today</p>
            </div>
            <div className="bg-[#F8FAFC] rounded-xl p-3 border border-slate-200">
              <p className="text-2xl font-bold text-slate-900">{monthlyUsage}</p>
              <p className="text-xs text-slate-400 mt-0.5">Requests this month</p>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Daily usage</span>
              <span>{dailyUsage} / {settings.ai_daily_limit || 500}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full"
                style={{ width: `${Math.min((dailyUsage / parseInt(settings.ai_daily_limit || '500')) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>

        </>)}
      </div>
    </AdminLayout>
  )
}
