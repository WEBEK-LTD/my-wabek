// @ts-nocheck
import { usePlanGuard } from '@/hooks/usePlanFeature'
import UpgradeWall from '@/components/UpgradeWall'
import { useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { PlusIcon, ClipboardIcon, TrashIcon, XMarkIcon, KeyIcon, EyeIcon, EyeSlashIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '@/lib/store'
import { format } from 'date-fns'

export default function ApiKeysPage() {
  const { blocked, isLoading: planLoading } = usePlanGuard('allow_api_access')
  if (planLoading) return null
  if (blocked) return <UpgradeWall feature="allow_api_access" />

  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKey, setNewKey] = useState(null)
  const [showDefaultKey, setShowDefaultKey] = useState(false)

  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://your-site.netlify.app'

  const { data } = useQuery('api-keys', () => axios.get('/api/settings/api-keys').then(r => r.data))
  // The default key is no longer part of the user object (owner-only endpoint).
  const { data: defaultKeyData, isError: defaultKeyError } = useQuery('default-api-key',
    () => axios.get('/api/settings/default-api-key').then(r => r.data), { retry: false, staleTime: Infinity })
  const defaultApiKey = defaultKeyData?.api_key || null
  const keys = data?.keys || []

  const createMut = useMutation(
    () => axios.post('/api/settings/api-keys', { name: newKeyName }).then(r => r.data),
    {
      onSuccess: (data) => {
        qc.invalidateQueries('api-keys')
        setNewKey(data.key)
        setNewKeyName('')
        setShowNew(false)
        toast.success('API key created!')
      },
      onError: () => toast.error('Failed to create key'),
    }
  )

  const deleteMut = useMutation(
    (id) => axios.delete(`/api/settings/api-keys/${id}`),
    { onSuccess: () => { qc.invalidateQueries('api-keys'); toast.success('Key revoked') } }
  )

  const copy = (text) => { navigator.clipboard.writeText(text); toast.success('Copied!') }

  const endpoints = [
    { method: 'POST', path: '/api/v1/send', desc: 'Send WhatsApp message', body: '{"to":"+1234567890","message":"Hello!"}' },
    { method: 'GET',  path: '/api/v1/contacts', desc: 'List contacts', body: '' },
    { method: 'POST', path: '/api/v1/contacts', desc: 'Create/update contact', body: '{"phone":"+1234567890","name":"John"}' },
    { method: 'POST', path: '/api/v1/otp', desc: 'Send OTP via WhatsApp', body: '{"phone":"+1234567890","purpose":"verification"}' },
    { method: 'POST', path: '/api/v1/otp-verify', desc: 'Verify OTP', body: '{"otp_id":"uuid","otp":"123456"}' },
    { method: 'POST', path: '/api/v1/whmcs-webhook', desc: 'WHMCS webhook receiver', body: '{"action":"InvoicePaid","invoiceid":"42","userid":"7"}' },
  ]

  return (
    <DashboardLayout title="API Keys">
      <div className="max-w-3xl space-y-6">

        {/* Default API key */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-display font-semibold text-slate-900">Default API Key</h3>
              <p className="text-xs text-slate-500 mt-0.5">Auto-generated for your account — keep it secret</p>
            </div>
            <span className="badge-green">Active</span>
          </div>
          <div className="flex items-center gap-2 bg-[#F8FAFC] rounded-lg px-4 py-3 border border-slate-200">
            <code className="flex-1 text-blue-600 text-sm font-mono truncate text-slate-800">
              {showDefaultKey ? (defaultApiKey || (defaultKeyError ? 'Only the account owner can view this key' : 'Loading…')) : '••••••••••••••••••••••••••••••••'}
            </code>
            <button onClick={() => setShowDefaultKey(v => !v)} className="text-slate-400 hover:text-slate-900 p-1">
              {showDefaultKey ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
            </button>
            <button onClick={() => defaultApiKey && copy(defaultApiKey)} className="text-slate-400 hover:text-slate-900 p-1">
              <ClipboardIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Named API keys */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-semibold text-slate-900">Named API Keys</h3>
              <p className="text-xs text-slate-500 mt-0.5">Create separate keys for different integrations</p>
            </div>
            <button onClick={() => setShowNew(true)} className="btn-primary text-sm">
              <PlusIcon className="w-4 h-4" /> New Key
            </button>
          </div>

          {/* New key reveal */}
          {newKey && (
            <div className="mb-4 p-4 bg-blue-50/20 border border-blue-200 rounded-xl">
              <div className="flex items-start gap-3">
                <CheckCircleIcon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-600 mb-1">⚠️ Copy this key now — won't be shown again!</p>
                  <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2 mt-2">
                    <code className="text-sm text-slate-900 font-mono flex-1 break-all">{newKey}</code>
                    <button onClick={() => copy(newKey)} className="text-blue-600 hover:text-blue-500 flex-shrink-0">
                      <ClipboardIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <button onClick={() => setNewKey(null)} className="text-xs text-slate-500 hover:text-slate-900 mt-2">Dismiss</button>
                </div>
              </div>
            </div>
          )}

          {keys.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-6">No named keys yet</p>
          ) : (
            <div className="space-y-2">
              {keys.map((key) => (
                <div key={key.id} className="flex items-center gap-3 py-3 border-b border-slate-200 last:border-0">
                  <div className="w-8 h-8 rounded-lg bg-[#F8FAFC] flex items-center justify-center flex-shrink-0">
                    <KeyIcon className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{key.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <code className="text-xs text-slate-500 font-mono text-slate-800">{key.key_prefix}••••••••</code>
                      <span className={key.is_active ? 'badge-green' : 'badge-red'}>
                        {key.is_active ? 'Active' : 'Revoked'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-slate-500">Created {format(new Date(key.created_at), 'MMM d')}</p>
                    {key.last_used_at && <p className="text-xs text-slate-600">Used {format(new Date(key.last_used_at), 'MMM d')}</p>}
                  </div>
                  <button onClick={() => { if (confirm('Revoke this key?')) deleteMut.mutate(key.id) }}
                    className="p-1.5 text-slate-500 hover:text-red-400 transition-colors">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* REST API Reference */}
        <div className="card">
          <h3 className="font-display font-semibold text-slate-900 mb-4">📡 REST API Reference</h3>
          <p className="text-sm text-slate-400 mb-4">
            Authenticate with header: <code className="bg-[#F8FAFC] px-2 py-0.5 rounded text-xs text-blue-600">X-API-Key: YOUR_KEY</code>
          </p>
          <div className="space-y-3">
            {endpoints.map(ep => (
              <div key={ep.path} className="bg-[#F8FAFC] rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${ep.method === 'GET' ? 'bg-blue-900 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                      {ep.method}
                    </span>
                    <code className="text-sm text-slate-700 font-mono text-slate-800">{ep.path}</code>
                  </div>
                  <button onClick={() => {
                    const cmd = `curl -X ${ep.method} ${appUrl}${ep.path} \\\n  -H "X-API-Key: ${defaultApiKey || 'YOUR_KEY'}"${ep.body ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '${ep.body}'` : ''}`
                    copy(cmd)
                  }} className="text-xs text-slate-400 hover:text-blue-600 flex items-center gap-1">
                    <ClipboardIcon className="w-3.5 h-3.5" /> Copy curl
                  </button>
                </div>
                <div className="px-4 py-2.5">
                  <p className="text-xs text-slate-400">{ep.desc}</p>
                  {ep.body && (
                    <code className="text-xs text-slate-500 font-mono mt-1 block">Body: {ep.body}</code>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* WHMCS webhook */}
        <div className="card">
          <h3 className="font-display font-semibold text-slate-900 mb-3">🏢 WHMCS Webhook URL</h3>
          <div className="flex items-center gap-2 bg-[#F8FAFC] rounded-lg px-4 py-3 border border-slate-200">
            <code className="flex-1 text-blue-600 text-xs font-mono break-all">
              {appUrl}/api/v1/whmcs-webhook?api_key={defaultApiKey || 'YOUR_KEY'}
            </code>
            <button onClick={() => copy(`${appUrl}/api/v1/whmcs-webhook?api_key=${defaultApiKey || 'YOUR_KEY'}`)} className="text-slate-400 hover:text-slate-900 flex-shrink-0">
              <ClipboardIcon className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">Paste this URL in WHMCS Admin → Setup → API → Hooks</p>
        </div>
      </div>

      {/* New key modal */}
      {showNew && (
        <div className="modal-backdrop" onClick={() => setShowNew(false)}>
          <div className="modal-panel max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h3 className="font-display font-semibold text-slate-900">New API Key</h3>
              <button onClick={() => setShowNew(false)} className="text-slate-400 hover:text-slate-900"><XMarkIcon className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Key name</label>
                <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="e.g. WHMCS Production, Mobile App" className="input" onKeyDown={e => e.key === 'Enter' && newKeyName && createMut.mutate()} />
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowNew(false)} className="btn-secondary">Cancel</button>
                <button onClick={() => createMut.mutate()} disabled={!newKeyName || createMut.isLoading} className="btn-primary">
                  {createMut.isLoading ? 'Creating…' : 'Create Key'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
