// @ts-nocheck
import AdminLayout from '@/components/layout/AdminLayout'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import clsx from 'clsx'

export default function AdminPayoutsPage() {
  const qc = useQueryClient()
  const [form, setForm] = useState({ reseller_id: '', amount: '', method: 'bank_transfer', reference: '' })

  const { data, isLoading } = useQuery('admin-payouts-only',
    () => axios.get('/api/admin/payouts').then(r => r.data)
  )

  const approved = (data?.resellers || []).filter(r => r.is_approved)
  const totalPending = approved.reduce((s, r) => s + (r.balance_pending || 0), 0)

  const payMut = useMutation(
    body => axios.post('/api/admin/payouts', body),
    {
      onSuccess: () => {
        qc.invalidateQueries('admin-payouts-only')
        toast.success('Payout recorded ✅')
        setForm({ reseller_id: '', amount: '', method: 'bank_transfer', reference: '' })
      },
      onError: e => toast.error(e?.response?.data?.error || 'Failed'),
    }
  )

  const submit = () => {
    if (!form.reseller_id || !form.amount) { toast.error('Select reseller and enter amount'); return }
    payMut.mutate({ ...form, amount: parseFloat(form.amount) })
  }

  return (
    <AdminLayout title="Reseller Payouts">

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="stat-card">
          <p className="text-xs text-slate-500 mb-1">Approved Resellers</p>
          <p className="text-2xl font-display font-bold text-slate-900">{approved.length}</p>
        </div>
        <div className="stat-card border-yellow-800/40">
          <p className="text-xs text-slate-500 mb-1">💰 Total Pending</p>
          <p className="text-2xl font-display font-bold text-yellow-400">${totalPending.toFixed(2)}</p>
        </div>
        <div className="stat-card border-blue-200/40">
          <p className="text-xs text-slate-500 mb-1">✅ Total Paid All Time</p>
          <p className="text-2xl font-display font-bold text-blue-600">
            ${approved.reduce((s, r) => s + (r.balance_paid || 0), 0).toFixed(2)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Resellers table */}
        <div className="card overflow-x-auto">
          <h3 className="font-display font-semibold text-slate-900 mb-4">Resellers Balance</h3>
          {isLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-10 skeleton rounded" />)}</div>
          ) : approved.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-6">No approved resellers yet</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  {['Reseller', 'Pending', 'Paid', 'Total', ''].map(h => (
                    <th key={h} className="table-head">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {approved.map(r => (
                  <tr key={r.id} className="table-row">
                    <td className="table-cell">
                      <p className="text-sm font-medium text-slate-900">{r.user?.name}</p>
                      <p className="text-xs text-slate-500">{r.user?.email}</p>
                    </td>
                    <td className="table-cell font-medium text-yellow-400">${(r.balance_pending || 0).toFixed(2)}</td>
                    <td className="table-cell font-medium text-blue-600">${(r.balance_paid || 0).toFixed(2)}</td>
                    <td className="table-cell font-medium text-slate-900">${(r.balance_total || 0).toFixed(2)}</td>
                    <td className="table-cell">
                      <button
                        onClick={() => setForm(f => ({
                          ...f,
                          reseller_id: r.user_id,
                          amount: (r.balance_pending || 0).toFixed(2),
                        }))}
                        className="text-xs text-blue-600 hover:text-blue-500 px-2 py-1 border border-blue-200/40 rounded">
                        💸 Pay
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Record payout form */}
        <div className="card space-y-4">
          <h3 className="font-display font-semibold text-slate-900">💸 Record Payout</h3>

          <div>
            <label className="label">Reseller *</label>
            <select value={form.reseller_id}
              onChange={e => setForm(f => ({ ...f, reseller_id: e.target.value }))}
              className="input">
              <option value="">Select reseller...</option>
              {approved.map(r => (
                <option key={r.user_id} value={r.user_id}>
                  {r.user?.name} — Pending: ${(r.balance_pending || 0).toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Amount (USD) *</label>
            <input type="number" step="0.01" min="0"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              className="input" placeholder="0.00" />
          </div>

          <div>
            <label className="label">Method</label>
            <select value={form.method}
              onChange={e => setForm(f => ({ ...f, method: e.target.value }))}
              className="input">
              <option value="bank_transfer">Bank Transfer</option>
              <option value="paypal">PayPal</option>
              <option value="wise">Wise</option>
              <option value="crypto">Crypto</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="label">Transaction Reference</label>
            <input value={form.reference}
              onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
              className="input" placeholder="TXN-123456" />
          </div>

          <button
            onClick={submit}
            disabled={payMut.isLoading || !form.reseller_id || !form.amount}
            className="btn-primary w-full justify-center">
            {payMut.isLoading ? 'Recording...' : '✅ Record Payout'}
          </button>
        </div>

      </div>
    </AdminLayout>
  )
}
