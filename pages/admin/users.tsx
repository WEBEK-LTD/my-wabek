// @ts-nocheck
import { useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { MagnifyingGlassIcon, PencilIcon, NoSymbolIcon, CheckCircleIcon, XMarkIcon, EyeIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import clsx from 'clsx'

export default function AdminUsersPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editUser, setEditUser] = useState(null)
  const [viewUser, setViewUser] = useState(null)
  const [editData, setEditData] = useState({ is_active: true, role: 'user', plan_id: '', plan_expires_at: '' })

  const { data, isLoading } = useQuery(
    ['admin-users', search, page],
    () => axios.get(`/api/admin/users?search=${encodeURIComponent(search)}&page=${page}&limit=20`).then(r => r.data),
    { keepPreviousData: true }
  )
  const { data: plansData } = useQuery('admin-plans-list', () => axios.get('/api/admin/plans').then(r => r.data))
  const { data: userDetail } = useQuery(
    ['admin-user-detail', viewUser?.id],
    () => viewUser ? axios.get(`/api/admin/users/${viewUser.id}`).then(r => r.data) : null,
    { enabled: !!viewUser }
  )

  const users = data?.users || []
  const plans = plansData?.plans || []

  const updateMut = useMutation(
    ({ id, body }) => axios.put(`/api/admin/users/${id}`, body),
    { onSuccess: () => { qc.invalidateQueries('admin-users'); setEditUser(null); toast.success('User updated ✅') }, onError: e => toast.error(e?.response?.data?.error || 'Failed') }
  )
  const suspendMut = useMutation(
    id => axios.delete(`/api/admin/users/${id}`),
    { onSuccess: () => { qc.invalidateQueries('admin-users'); toast.success('User suspended') } }
  )
  const activateMut = useMutation(
    id => axios.put(`/api/admin/users/${id}`, { is_active: true }),
    { onSuccess: () => { qc.invalidateQueries('admin-users'); toast.success('User activated') } }
  )

  const openEdit = (user) => {
    setEditUser(user)
    setEditData({
      is_active: user.is_active,
      role: user.role,
      plan_id: user.plan_id || '',
      plan_expires_at: user.plan_expires_at ? user.plan_expires_at.split('T')[0] : '',
    })
  }

  return (
    <AdminLayout title="Users">
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search by name or email…" className="input pl-9" />
        </div>
        <div className="text-sm text-slate-400 flex items-center">{data?.total || 0} total users</div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-[#F8FAFC]/50">
              <tr>
                <th className="table-head">User</th>
                <th className="table-head">Plan</th>
                <th className="table-head">Expires</th>
                <th className="table-head">Role</th>
                <th className="table-head">Status</th>
                <th className="table-head">Joined</th>
                <th className="table-head w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-200">
                  {Array.from({ length: 7 }).map((_, j) => <td key={j} className="table-cell"><div className="h-4 skeleton rounded w-20" /></td>)}
                </tr>
              )) : users.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-500">No users found</td></tr>
              ) : users.map(u => (
                <tr key={u.id} className="table-row">
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-[#F8FAFC] flex items-center justify-center text-xs font-bold text-slate-700 flex-shrink-0">
                        {u.name?.[0]?.toUpperCase() || u.email[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate max-w-32">{u.name || '—'}</p>
                        <p className="text-xs text-slate-500 truncate max-w-32">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell">
                    <span className={clsx('text-xs px-2 py-0.5 rounded font-medium', u.plans?.name ? 'badge-green' : 'badge-gray')}>
                      {u.plans?.name || 'Free'}
                    </span>
                  </td>
                  <td className="table-cell text-xs text-slate-400">
                    {u.plan_expires_at ? format(new Date(u.plan_expires_at), 'MMM d, yyyy') : '—'}
                  </td>
                  <td className="table-cell">
                    <span className={u.role === 'admin' ? 'badge-red' : 'badge-gray'}>{u.role}</span>
                  </td>
                  <td className="table-cell">
                    {u.is_active
                      ? <span className="badge-green flex items-center gap-1 w-fit"><span className="w-1.5 h-1.5 rounded-full bg-brand-400" />Active</span>
                      : <span className="badge-red">Suspended</span>}
                  </td>
                  <td className="table-cell text-xs text-slate-400">{format(new Date(u.created_at), 'MMM d, yyyy')}</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setViewUser(u)} className="p-1.5 text-slate-400 hover:text-blue-400 transition-colors" title="View details">
                        <EyeIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => openEdit(u)} className="p-1.5 text-slate-400 hover:text-slate-900 transition-colors" title="Edit">
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      {u.is_active
                        ? <button onClick={() => { if (confirm('Suspend this user?')) suspendMut.mutate(u.id) }} className="p-1.5 text-slate-400 hover:text-red-400" title="Suspend">
                            <NoSymbolIcon className="w-4 h-4" />
                          </button>
                        : <button onClick={() => activateMut.mutate(u.id)} className="p-1.5 text-slate-400 hover:text-blue-600" title="Activate">
                            <CheckCircleIcon className="w-4 h-4" />
                          </button>
                      }
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(data?.total || 0) > 20 && (
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-50">← Previous</button>
            <span className="text-sm text-slate-400">Page {page} of {Math.ceil((data?.total || 0) / 20)}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={users.length < 20} className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-50">Next →</button>
          </div>
        )}
      </div>

      {/* View User Details Modal */}
      {viewUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setViewUser(null)}>
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h3 className="font-display font-bold text-slate-900">User Details</h3>
              <button onClick={() => setViewUser(null)} className="text-slate-400 hover:text-slate-900"><XMarkIcon className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-200/50 flex items-center justify-center text-lg font-bold text-blue-600">
                  {viewUser.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className="font-bold text-slate-900">{viewUser.name}</p>
                  <p className="text-slate-400 text-sm">{viewUser.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Plan', value: userDetail?.user?.plans?.name || viewUser.plans?.name || 'Free' },
                  { label: 'Plan Expires', value: viewUser.plan_expires_at ? format(new Date(viewUser.plan_expires_at), 'MMM d, yyyy') : 'Never' },
                  { label: 'Reseller', value: userDetail?.subscription ? '—' : (userDetail?.user?.referred_by ? '👥 Referred' : '—') },
                  { label: 'Messages', value: (userDetail?.stats?.messages || 0).toLocaleString() },
                  { label: 'Contacts', value: (userDetail?.stats?.contacts || 0).toLocaleString() },
                  { label: 'Instances', value: (userDetail?.instances?.length || 0) },
                  { label: 'Joined', value: format(new Date(viewUser.created_at), 'MMM d, yyyy') },
                ].map(s => (
                  <div key={s.label} className="bg-[#F8FAFC] rounded-xl p-3 border border-slate-200">
                    <p className="text-xs text-slate-500">{s.label}</p>
                    <p className="text-sm font-medium text-slate-900 mt-0.5">{s.value}</p>
                  </div>
                ))}
              </div>
              {userDetail?.instances?.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-2">WhatsApp Instances</p>
                  {userDetail.instances.map(inst => (
                    <div key={inst.id} className="flex items-center gap-2 text-sm py-1">
                      <div className={clsx('w-2 h-2 rounded-full', inst.status === 'connected' ? 'bg-brand-500' : 'bg-slate-200')} />
                      <span className="text-slate-700">{inst.phone_number || 'No number'}</span>
                      <span className="text-xs text-slate-500 ml-auto">{inst.status}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={async () => {
                  try {
                    await axios.patch('/api/admin/payouts', { user_id: viewUser.id, is_approved: true, commission_pct: 10 })
                    toast.success('Reseller approved! ✅')
                    qc.invalidateQueries('admin-payouts')
                  } catch(e) { toast.error('Failed') }
                }} className="btn-secondary flex-1 justify-center text-sm text-blue-600">
                  ✅ Approve Reseller
                </button>
                <button onClick={() => { setViewUser(null); openEdit(viewUser) }} className="btn-secondary flex-1 justify-center text-sm">
                  <PencilIcon className="w-4 h-4" /> Edit User
                </button>
                <button onClick={() => setViewUser(null)} className="btn-secondary flex-1 justify-center text-sm">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setEditUser(null)}>
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div>
                <h3 className="font-display font-bold text-slate-900">Edit User</h3>
                <p className="text-sm text-slate-400">{editUser.email}</p>
              </div>
              <button onClick={() => setEditUser(null)} className="text-slate-400 hover:text-slate-900"><XMarkIcon className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Status</label>
                <select value={editData.is_active ? 'active' : 'suspended'} onChange={e => setEditData(d => ({ ...d, is_active: e.target.value === 'active' }))} className="input">
                  <option value="active">✅ Active</option>
                  <option value="suspended">🚫 Suspended</option>
                </select>
              </div>
              <div>
                <label className="label">Role</label>
                <select value={editData.role} onChange={e => setEditData(d => ({ ...d, role: e.target.value }))} className="input">
                  <option value="user">👤 User</option>
                  <option value="admin">⭐ Admin</option>
                </select>
              </div>
              <div>
                <label className="label">Plan</label>
                <select value={editData.plan_id} onChange={e => setEditData(d => ({ ...d, plan_id: e.target.value }))} className="input">
                  <option value="">No plan (Free)</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name} — ${p.price_monthly}/mo</option>)}
                </select>
              </div>
              {editData.plan_id && (
                <div>
                  <label className="label">Plan Expires At</label>
                  <input type="date" value={editData.plan_expires_at}
                    onChange={e => setEditData(d => ({ ...d, plan_expires_at: e.target.value }))} className="input" />
                  <p className="text-xs text-slate-500 mt-1">Leave empty for no expiry</p>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setEditUser(null)} className="btn-secondary">Cancel</button>
                <button
                  onClick={() => updateMut.mutate({ id: editUser.id, body: { ...editData, plan_expires_at: editData.plan_expires_at ? new Date(editData.plan_expires_at).toISOString() : null } })}
                  disabled={updateMut.isLoading} className="btn-primary">
                  {updateMut.isLoading ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
