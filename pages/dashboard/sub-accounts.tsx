// @ts-nocheck
import { usePlanGuard } from '@/hooks/usePlanFeature'
import UpgradeWall from '@/components/UpgradeWall'
import { useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { PlusIcon, UserIcon, ArrowPathIcon, NoSymbolIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import clsx from 'clsx'

export default function SubAccountsPage() {
  const { blocked, isLoading: planLoading } = usePlanGuard('allow_sub_accounts')
  if (planLoading) return null
  if (blocked) return <UpgradeWall feature="allow_sub_accounts" />

  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', max_contacts: -1, max_instances: 1, max_messages_month: 1000 })

  const { data, isLoading } = useQuery('sub-accounts', () => axios.get('/api/sub-accounts').then(r => r.data))
  const accounts = data?.accounts || []

  const suspendMut = useMutation(
    id => axios.delete(`/api/sub-accounts/${id}`),
    { onSuccess: () => { qc.invalidateQueries('sub-accounts'); toast.success('Account suspended') } }
  )
  const activateMut = useMutation(
    id => axios.put(`/api/sub-accounts/${id}`, { is_active: true }),
    { onSuccess: () => { qc.invalidateQueries('sub-accounts'); toast.success('Account activated') } }
  )

  const createMut = useMutation(
    (body) => axios.post('/api/sub-accounts', body),
    {
      onSuccess: () => {
        qc.invalidateQueries('sub-accounts')
        setShowForm(false)
        setForm({ name: '', email: '', password: '', max_contacts: -1, max_instances: 1, max_messages_month: 1000 })
        toast.success('Sub-account created! ✅')
      },
      onError: (e) => toast.error(e?.response?.data?.error || 'Failed'),
    }
  )

  return (
    <DashboardLayout title="Sub-Accounts">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-slate-400 text-sm">{accounts.length} sub-accounts</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="btn-primary">
          <PlusIcon className="w-4 h-4" /> New Sub-Account
        </button>
      </div>

      {showForm && (
        <div className="card mb-6 space-y-4">
          <h3 className="font-display font-semibold text-slate-900">Create Sub-Account</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Full Name</label>
              <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Client Name" className="input" />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} placeholder="client@example.com" className="input" />
            </div>
            <div>
              <label className="label">Password</label>
              <input type="password" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} placeholder="Min 8 characters" className="input" />
            </div>
            <div>
              <label className="label">Max Instances</label>
              <input type="number" value={form.max_instances} onChange={e => setForm(f => ({...f, max_instances: parseInt(e.target.value)}))} min={1} className="input" />
            </div>
            <div>
              <label className="label">Max Contacts (-1 = unlimited)</label>
              <input type="number" value={form.max_contacts} onChange={e => setForm(f => ({...f, max_contacts: parseInt(e.target.value)}))} className="input" />
            </div>
            <div>
              <label className="label">Max Messages/Month</label>
              <input type="number" value={form.max_messages_month} onChange={e => setForm(f => ({...f, max_messages_month: parseInt(e.target.value)}))} className="input" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => createMut.mutate(form)} disabled={createMut.isLoading || !form.name || !form.email || !form.password} className="btn-primary">
              {createMut.isLoading ? <><ArrowPathIcon className="w-4 h-4 animate-spin" /> Creating...</> : 'Create Sub-Account'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>
      ) : accounts.length === 0 && !showForm ? (
        <div className="card text-center py-16">
          <UserIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="font-display font-semibold text-slate-900 mb-2">No sub-accounts yet</h3>
          <p className="text-slate-400 text-sm mb-4">Create accounts for your clients — each gets their own dashboard</p>
          <button onClick={() => setShowForm(true)} className="btn-primary mx-auto"><PlusIcon className="w-4 h-4" /> Create First Sub-Account</button>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map(acc => (
            <div key={acc.id} className="card hover:border-wabek-muted transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-200/50 flex items-center justify-center font-bold text-blue-600 flex-shrink-0">
                  {acc.user?.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-medium text-slate-900">{acc.user?.name}</p>
                    <span className={clsx('text-xs px-2 py-0.5 rounded', acc.user?.is_active ? 'bg-blue-50/30 text-blue-600' : 'bg-red-900/30 text-red-400')}>
                      {acc.user?.is_active ? 'Active' : 'Suspended'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">{acc.user?.email}</p>
                  <p className="text-xs text-slate-600 mt-0.5">Created {acc.user?.created_at ? format(new Date(acc.user.created_at), 'MMM d, yyyy') : '—'}</p>
                </div>
                <div className="text-right text-xs text-slate-500 space-y-1 flex-shrink-0">
                  <p>📱 {acc.max_instances} instance{acc.max_instances !== 1 ? 's' : ''}</p>
                  <p>👥 {acc.max_contacts === -1 ? '∞' : acc.max_contacts} contacts</p>
                  <p>💬 {acc.max_messages_month.toLocaleString()} msgs/mo</p>
                  <div className="flex gap-1 mt-2 justify-end">
                    {acc.user?.is_active ? (
                      <button onClick={() => { if(confirm('Suspend this account?')) suspendMut.mutate(acc.id) }}
                        className="text-xs text-red-400 hover:text-red-300 px-2 py-1 border border-red-900/50 rounded-lg">
                        Suspend
                      </button>
                    ) : (
                      <button onClick={() => activateMut.mutate(acc.id)}
                        className="text-xs text-blue-600 hover:text-blue-500 px-2 py-1 border border-blue-200/50 rounded-lg">
                        Activate
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card mt-6 border-slate-200">
        <h3 className="font-semibold text-slate-900 text-sm mb-3">ℹ️ About Sub-Accounts</h3>
        <ul className="space-y-1.5 text-xs text-slate-400">
          <li>✅ Each sub-account gets their own dashboard and login</li>
          <li>✅ You can set custom limits per account</li>
          <li>✅ Sub-accounts are isolated — they can't see each other's data</li>
          <li>✅ You can manage all sub-accounts from this page</li>
          <li>⚠️ Sub-accounts require the Pro or Business plan</li>
        </ul>
      </div>
    </DashboardLayout>
  )
}
