// @ts-nocheck
import AdminLayout from '@/components/layout/AdminLayout'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import clsx from 'clsx'
import { CheckCircleIcon, XCircleIcon, UserGroupIcon } from '@heroicons/react/24/outline'

export default function AdminResellersPage() {
  const qc = useQueryClient()
  const [commissionInputs, setCommissionInputs] = useState({})
  const [tab, setTab] = useState('pending')

  const { data, isLoading } = useQuery('admin-resellers',
    () => axios.get('/api/admin/payouts').then(r => r.data)
  )

  const resellers = data?.resellers || []
  const pending  = resellers.filter(r => !r.is_approved)
  const approved = resellers.filter(r => r.is_approved)

  const approveMut = useMutation(
    ({ user_id, is_approved, commission_pct }) =>
      axios.patch('/api/admin/payouts', { user_id, is_approved, commission_pct }),
    {
      onSuccess: (_, vars) => {
        qc.invalidateQueries('admin-resellers')
        toast.success(vars.is_approved ? 'Reseller approved ✅' : 'Reseller rejected')
      },
      onError: e => toast.error(e?.response?.data?.error || 'Failed'),
    }
  )

  return (
    <AdminLayout title="Reseller Management">

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="stat-card">
          <p className="text-xs text-slate-500 mb-1">Total Resellers</p>
          <p className="text-2xl font-display font-bold text-slate-900">{resellers.length}</p>
        </div>
        <div className="stat-card border-yellow-800/40">
          <p className="text-xs text-slate-500 mb-1">⏳ Pending</p>
          <p className="text-2xl font-display font-bold text-yellow-400">{pending.length}</p>
        </div>
        <div className="stat-card border-blue-200/40">
          <p className="text-xs text-slate-500 mb-1">✅ Approved</p>
          <p className="text-2xl font-display font-bold text-blue-600">{approved.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 mb-5">
        {[
          { id: 'pending',  label: `⏳ Pending (${pending.length})` },
          { id: 'approved', label: `✅ Approved (${approved.length})` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={clsx('px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t.id
                ? 'border-brand-500 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Pending ── */}
      {tab === 'pending' && (
        <div className="card">
          {isLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 skeleton rounded-xl" />)}</div>
          ) : pending.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircleIcon className="w-10 h-10 text-blue-600 mx-auto mb-2" />
              <p className="text-slate-400">No pending resellers 🎉</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map(r => (
                <div key={r.id} className="flex flex-wrap items-center gap-4 p-4 bg-[#F8FAFC] rounded-xl border border-yellow-800/30">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900">{r.user?.name || 'Unknown'}</p>
                    <p className="text-sm text-slate-500">{r.user?.email}</p>
                    <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-slate-500">
                      <span>💳 Payment: <span className="text-slate-700">{r.payment_method || 'platform'}</span></span>
                      <span>📅 Schedule: <span className="text-slate-700">{r.payout_schedule || 'monthly'}</span></span>
                      <span>💸 Payout via: <span className="text-slate-700">{r.payout_method || '—'}</span></span>
                      <span>📆 Applied: <span className="text-slate-700">{r.created_at ? format(new Date(r.created_at), 'MMM d, yyyy') : '—'}</span></span>
                    </div>
                    {r.payout_details && typeof r.payout_details === 'object' && Object.keys(r.payout_details).length > 0 && (
                      <p className="text-xs text-slate-600 mt-1">Details: {JSON.stringify(r.payout_details)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex items-center gap-1">
                      <input
                        type="number" placeholder="10" min="0" max="100" step="0.5"
                        value={commissionInputs[r.user_id] ?? '10'}
                        onChange={e => setCommissionInputs(p => ({ ...p, [r.user_id]: e.target.value }))}
                        className="input w-20 text-sm py-1.5 text-center"
                      />
                      <span className="text-slate-500 text-xs">%</span>
                    </div>
                    <button
                      disabled={approveMut.isLoading}
                      onClick={() => approveMut.mutate({
                        user_id: r.user_id,
                        is_approved: true,
                        commission_pct: parseFloat(commissionInputs[r.user_id] ?? '10'),
                      })}
                      className="flex items-center gap-1.5 text-sm font-medium text-black bg-brand-500 hover:bg-brand-600 px-3 py-1.5 rounded-lg transition-colors">
                      <CheckCircleIcon className="w-4 h-4" /> Approve
                    </button>
                    <button
                      disabled={approveMut.isLoading}
                      onClick={() => approveMut.mutate({ user_id: r.user_id, is_approved: false, commission_pct: 0 })}
                      className="p-1.5 text-slate-500 hover:text-red-400 transition-colors" title="Reject">
                      <XCircleIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Approved ── */}
      {tab === 'approved' && (
        <div className="card overflow-x-auto">
          {approved.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">No approved resellers yet</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  {['Reseller', 'Commission %', 'Pending Balance', 'Total Paid', 'All Time', 'Approved', 'Actions'].map(h => (
                    <th key={h} className="table-head">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {approved.map(r => (
                  <tr key={r.id} className="table-row">
                    <td className="table-cell">
                      <p className="font-medium text-slate-900 text-sm">{r.user?.name}</p>
                      <p className="text-xs text-slate-500">{r.user?.email}</p>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1">
                        <input
                          type="number" min="0" max="100" step="0.5"
                          defaultValue={r.referral_commission_pct || 0}
                          onBlur={e => approveMut.mutate({
                            user_id: r.user_id,
                            is_approved: true,
                            commission_pct: parseFloat(e.target.value),
                          })}
                          className="input w-20 text-sm py-1"
                        />
                        <span className="text-slate-500 text-xs">%</span>
                      </div>
                    </td>
                    <td className="table-cell font-medium text-yellow-400">${(r.balance_pending || 0).toFixed(2)}</td>
                    <td className="table-cell font-medium text-blue-600">${(r.balance_paid || 0).toFixed(2)}</td>
                    <td className="table-cell font-medium text-slate-900">${(r.balance_total || 0).toFixed(2)}</td>
                    <td className="table-cell text-xs text-slate-500">
                      {r.approved_at ? format(new Date(r.approved_at), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="table-cell">
                      <button
                        onClick={() => approveMut.mutate({ user_id: r.user_id, is_approved: false, commission_pct: 0 })}
                        className="text-xs text-red-400 hover:text-red-300 px-2 py-1 border border-red-800/40 rounded">
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

    </AdminLayout>
  )
}
