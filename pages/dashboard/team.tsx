// @ts-nocheck
import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { PlusIcon, TrashIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '@/lib/store'
import clsx from 'clsx'
import { formatDistanceToNow } from 'date-fns'

const ROLE_COLORS = {
  admin: 'badge-red',
  agent: 'badge-green',
  viewer: 'badge-gray',
}

const STATUS_COLORS = {
  active:    'badge-green',
  pending:   'badge-yellow',
  suspended: 'badge-red',
}

export default function TeamPage() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const isOwner = !user?.sub_account_of  // owner has no parent account
  const [tab, setTab]           = useState<'members' | 'performance'>('members')
  const [range, setRange]       = useState<'1d' | '7d' | '30d'>('7d')
  const [showInvite, setShowInvite] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', role: 'agent' })
  const [inviteUrl, setInviteUrl] = useState('')

  // Close invite form when switching away from members tab
  useEffect(() => { if (tab !== 'members') closeInvite() }, [tab])

  const { data, isLoading, error: teamError } = useQuery(
    'team',
    () => axios.get('/api/team').then(r => r.data),
    { onError: (e: any) => toast.error(e?.response?.data?.error || 'Failed to load team') }
  )
  const members = data?.members || []

  const { data: perfData, isLoading: perfLoading, isFetching: perfFetching, refetch: refetchPerf } = useQuery(
    ['team-performance', range],
    () => axios.get(`/api/team/performance?range=${range}`).then(r => r.data),
    { enabled: tab === 'performance', staleTime: 0 }  // always fresh when range changes
  )
  const inviteMut = useMutation(
    (body) => axios.post('/api/team', body),
    {
      onSuccess: (r) => {
        qc.invalidateQueries('team')
        setInviteUrl(r.data.inviteUrl)
        setForm({ name: '', email: '', role: 'agent' })
        toast.success('Invite created! Share the link.')
      },
      onError: (e) => toast.error(e?.response?.data?.error || 'Failed'),
    }
  )

  const updateMut = useMutation(
    ({ id, ...body }) => axios.put(`/api/team/${id}`, body),
    {
      onSuccess: () => { qc.invalidateQueries('team'); qc.invalidateQueries('team-performance'); toast.success('Updated') },
      onError: (e: any) => toast.error(e?.response?.data?.error || 'Update failed'),
    }
  )

  const deleteMut = useMutation(
    (id) => axios.delete(`/api/team/${id}`),
    {
      onSuccess: () => { qc.invalidateQueries('team'); qc.invalidateQueries('team-performance'); toast.success('Member removed') },
      onError: (e: any) => toast.error(e?.response?.data?.error || 'Remove failed'),
    }
  )

  const copy = (text: string) => { navigator.clipboard.writeText(text); toast.success('Copied!') }

  const openInvite = () => { setShowInvite(true); setInviteUrl(''); setForm({ name: '', email: '', role: 'agent' }) }
  const closeInvite = () => { setShowInvite(false); setInviteUrl('') }

  return (
    <DashboardLayout title="Team">
      {/* Tab switcher */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-1 p-1 bg-[#F8FAFC] rounded-xl border border-slate-200">
          <button onClick={() => setTab('members')}
            className={clsx('px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
              tab === 'members' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-900'
            )}>
            {/* Google Material: group icon */}
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
            </svg>
            Members
          </button>
          <button onClick={() => setTab('performance')}
            className={clsx('px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
              tab === 'performance' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-900'
            )}>
            {/* Google Material: bar chart icon */}
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z"/>
            </svg>
            Performance
          </button>
        </div>
        {tab === 'members' && isOwner && (
          <button onClick={openInvite} className="btn-primary">
            <PlusIcon className="w-4 h-4" /> Invite Member
          </button>
        )}
        {tab === 'performance' && (
          <div className="flex gap-1 p-1 bg-[#F8FAFC] rounded-xl border border-slate-200">
            {(['1d', '7d', '30d'] as const).map(r => (
              <button key={r} onClick={() => setRange(r)}
                className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  range === r ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-900'
                )}>
                {r === '1d' ? 'Today' : r === '7d' ? '7 Days' : '30 Days'}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === 'members' ? (<>
      {/* Invite form */}
      {showInvite && (
        <div className="card mb-6">
          <h3 className="font-display font-semibold text-slate-900 mb-4">Invite Team Member</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Full Name</label>
              <input value={form.name} onChange={e => setForm(d => ({...d, name: e.target.value}))} placeholder="John Doe" className="input" />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(d => ({...d, email: e.target.value}))} placeholder="john@example.com" className="input" />
            </div>
            <div>
              <label className="label">Role</label>
              <select value={form.role} onChange={e => setForm(d => ({...d, role: e.target.value}))} className="input">
                <option value="agent">Agent — Can send messages</option>
                <option value="admin">Admin — Full access</option>
                <option value="viewer">Viewer — Read only</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => inviteMut.mutate(form)} disabled={inviteMut.isLoading || !form.name || !form.email} className="btn-primary">
              {inviteMut.isLoading ? <><ArrowPathIcon className="w-4 h-4 animate-spin" /> Creating...</> : 'Create Invite Link'}
            </button>
            <button onClick={closeInvite} className="btn-secondary">Cancel</button>
          </div>

          {/* Invite URL */}
          {inviteUrl && (
            <div className="mt-4 p-3 bg-blue-50/20 border border-blue-200/50 rounded-xl">
              <p className="text-sm text-slate-700 mb-2">Share this link with your team member:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs text-blue-600 bg-[#F8FAFC] px-3 py-2 rounded-lg truncate">{inviteUrl}</code>
                <button onClick={() => copy(inviteUrl)} className="btn-secondary text-xs py-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg> Copy
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Members list */}
      {!isOwner && (
        <div className="mb-4 px-4 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl">
          <p className="text-xs text-slate-400">You are viewing the team as a member. Contact your account owner to make changes.</p>
        </div>
      )}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
      ) : teamError ? (
        <div className="card text-center py-8">
          <p className="text-red-400 text-sm mb-2">Failed to load team members</p>
          <p className="text-xs text-slate-400">{(teamError as any)?.response?.data?.error || 'Unknown error'}</p>
        </div>
      ) : members.length === 0 ? (
        <div className="card text-center py-16">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-slate-600 mx-auto mb-3" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
          <h3 className="font-display font-semibold text-slate-900 mb-2">No team members yet</h3>
          <p className="text-slate-400 text-sm mb-4">Invite your team to collaborate on conversations</p>
          {isOwner && (
            <button onClick={openInvite} className="btn-primary mx-auto">
              <PlusIcon className="w-4 h-4" /> Invite First Member
            </button>
          )}
        </div>
      ) : (
        <div className="card">
          <div className="space-y-0">
            {members.map(member => (
              <div key={member.id} className="py-3 border-b border-slate-200 last:border-0">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#F8FAFC] flex items-center justify-center font-bold text-slate-700 flex-shrink-0">
                    {(member.name || member.email || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{member.name || '—'}</p>
                    <p className="text-xs text-slate-500">{member.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={ROLE_COLORS[member.role] || 'badge-gray'}>{member.role}</span>
                    <span className={STATUS_COLORS[member.status] || 'badge-gray'}>{member.status}</span>
                    {isOwner && member.status === 'active' && (
                      <select
                        value={member.role}
                        onChange={e => {
                          const newRole = e.target.value
                          if (newRole !== member.role) {
                            if (confirm(`Change role to "${newRole}"?`)) {
                              updateMut.mutate({ id: member.id, role: newRole })
                            } else {
                              // Reset visual state — browser changed it before confirm
                              e.target.value = member.role
                            }
                          }
                        }}
                        className="input text-xs py-1 px-2 w-24"
                      >
                        <option value="agent">Agent</option>
                        <option value="admin">Admin</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    )}
                    {isOwner && member.id && (
                      <button onClick={() => { if(confirm('Remove this member?')) deleteMut.mutate(member.id) }}
                        className="p-1.5 text-slate-500 hover:text-red-400" title="Remove member">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                {/* Inbox Permissions — owner only */}
                {isOwner && member.status === 'active' && data?.instances?.length > 0 && (
                  <div className="mt-2 ml-14">
                    <p className="text-[11px] text-slate-400 mb-1.5">Inbox Access <span className="text-slate-300">(no selection = all inboxes)</span></p>
                    <div className="flex flex-wrap gap-1.5">
                      {(data.instances || []).map(inst => {
                        const allowed = (member.allowed_instances || []).includes(inst.id)
                        return (
                          <button
                            key={inst.id}
                            onClick={() => updateMut.mutate({
                              id: member.id,
                              toggle_instance: inst.id,
                            })}
                            className={clsx(
                              'text-[11px] px-2 py-1 rounded-lg border transition-colors',
                              allowed
                                ? 'bg-brand-500 text-white border-brand-500'
                                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                            )}
                          >
                            {allowed ? '✓ ' : ''}{inst.display_name || inst.phone_number}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Role descriptions */}
      <div className="card mt-6">
        <h3 className="font-display font-semibold text-slate-900 mb-3">Role Permissions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { role: 'Admin', color: 'badge-red', perms: ['Full access to all features', 'Manage team members', 'View all conversations', 'Configure settings'] },
            { role: 'Agent', color: 'badge-green', perms: ['View & reply to conversations', 'Send campaigns', 'Manage contacts', 'Cannot change settings'] },
            { role: 'Viewer', color: 'badge-gray', perms: ['View conversations only', 'View analytics', 'No sending ability', 'Read-only access'] },
          ].map(r => (
            <div key={r.role} className="bg-[#F8FAFC] rounded-xl p-3 border border-slate-200">
              <span className={clsx(r.color, 'mb-2 inline-block')}>{r.role}</span>
              <ul className="space-y-1">
                {r.perms.map(p => <li key={p} className="text-xs text-slate-400 flex items-center gap-1.5"><span className="text-brand-500">✓</span>{p}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>
      </>) : null}

      {/* ── Performance Tab ──────────────────────────────── */}
      {tab === 'performance' && (
        <div className="space-y-4">

          {perfLoading ? (
            <div className="card space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-16 skeleton rounded-xl" />)}
            </div>
          ) : !perfData ? (
            <div className="card text-center py-8">
              <p className="text-slate-400 text-sm">Failed to load performance data.</p>
              <button onClick={() => refetchPerf()} className="btn-secondary text-sm mt-3">Try again</button>
            </div>
          ) : perfData?.mode !== 'team' && perfData?.mode !== 'self' ? (
            // Unknown mode - show error
            <div className="card text-center py-8">
              <p className="text-slate-400 text-sm">Unable to load performance data.</p>
              <button onClick={() => refetchPerf()} className="btn-secondary text-sm mt-3">Try again</button>
            </div>
          ) : perfData?.mode === 'self' ? (
            // Member viewing own stats
            <div className="space-y-4">
              <div className="card border-blue-200/50 bg-blue-50/10">
                <div className="flex items-center gap-3 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                  <div>
                    <h3 className="font-display font-semibold text-slate-900">My Performance</h3>
                    <p className="text-xs text-slate-400">
                      {range === '1d' ? 'Today' : range === '7d' ? 'Last 7 days' : 'Last 30 days'}
                    </p>
                  </div>
                  <button onClick={() => refetchPerf()} disabled={perfFetching} className="ml-auto p-1.5 text-slate-400 hover:text-slate-900 disabled:opacity-50">
                    <ArrowPathIcon className={clsx("w-4 h-4", perfFetching && "animate-spin")} />
                  </button>
                </div>
                <StatCards stats={perfData.stats} />
              </div>
            </div>
          ) : (
            // Owner viewing team stats
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">
                  {(perfData?.members || []).length === 0
                    ? 'No active team members yet — showing your own activity only'
                    : `${(perfData?.members || []).length} active member${(perfData?.members || []).length !== 1 ? 's' : ''} + you`}
                </p>
                <button onClick={() => refetchPerf()} disabled={perfFetching} className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-[#F8FAFC] disabled:opacity-50">
                  <ArrowPathIcon className={clsx("w-4 h-4", perfFetching && "animate-spin")} />
                </button>
              </div>

              {/* Team table */}
              <div className="card p-0 overflow-hidden">
                <table className="w-full">
                  <thead className="border-b border-slate-200 bg-[#F8FAFC]/50">
                    <tr>
                      <th className="table-head">Member</th>
                      <th className="table-head text-center">
                        <span className="flex items-center justify-center gap-1">
                          {/* chat bubble icon */}
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                          Conversations
                        </span>
                      </th>
                      <th className="table-head text-center">
                        <span className="flex items-center justify-center gap-1">
                          {/* send icon */}
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                          Sent
                        </span>
                      </th>
                      <th className="table-head text-center">
                        <span className="flex items-center justify-center gap-1">
                          {/* reply icon */}
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>
                          Response Rate
                        </span>
                      </th>
                      <th className="table-head text-center">
                        <span className="flex items-center justify-center gap-1">
                          {/* timer icon */}
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M15 1H9v2h6V1zm-4 13h2V8h-2v6zm8.03-6.61l1.42-1.42c-.43-.51-.9-.99-1.41-1.41l-1.42 1.42C16.07 4.74 14.12 4 12 4c-4.97 0-9 4.03-9 9s4.02 9 9 9 9-4.03 9-9c0-2.12-.74-4.07-1.97-5.61zM12 20c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/></svg>
                          Avg Response
                        </span>
                      </th>
                      <th className="table-head">Last Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const rows = [...(perfData?.members || []), perfData?.owner]
                        .filter(m => m && m.id)
                        .filter((m, idx, arr) => arr.findIndex(x => x.id === m.id) === idx)
                      if (rows.length === 0) return (
                        <tr><td colSpan={6} className="table-cell text-center text-slate-400 text-sm py-8">No activity data yet for the selected period.</td></tr>
                      )
                      return rows.map((m, i) => (
                      <tr key={m.id || i} className="table-row">
                        <td className="table-cell">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-[#F8FAFC] border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-700 flex-shrink-0">
                              {(m.name || m.email || 'U')[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate max-w-28">{m.name || 'Unknown'}</p>
                              <p className="text-[10px] text-slate-400 truncate max-w-28">{m.email || (m.name === 'You (Owner)' ? 'Account owner' : '')}</p>
                            </div>
                          </div>
                        </td>
                        <td className="table-cell text-center">
                          <span className="text-sm font-semibold text-slate-900">{m.conversations_handled ?? 0}</span>
                        </td>
                        <td className="table-cell text-center">
                          <span className="text-sm font-semibold text-slate-900">{m.messages_sent ?? 0}</span>
                        </td>
                        <td className="table-cell text-center">
                          {m.response_rate !== null && m.response_rate !== undefined ? (
                            <div className="flex flex-col items-center gap-1">
                              <span className={clsx('text-sm font-semibold', m.response_rate >= 80 ? 'text-brand-500' : m.response_rate >= 50 ? 'text-yellow-400' : 'text-red-400')}>
                                {m.response_rate}%
                              </span>
                              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={clsx('h-full rounded-full', m.response_rate >= 80 ? 'bg-brand-500' : m.response_rate >= 50 ? 'bg-yellow-400' : 'bg-red-400')}
                                  style={{ width: `${Math.min(m.response_rate, 100)}%` }} />
                              </div>
                            </div>
                          ) : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                        <td className="table-cell text-center">
                          {m.avg_response_minutes !== null && m.avg_response_minutes !== undefined ? (
                            <span className={clsx('text-sm font-semibold', m.avg_response_minutes <= 5 ? 'text-brand-500' : m.avg_response_minutes <= 30 ? 'text-yellow-400' : 'text-red-400')}>
                              {m.avg_response_minutes < 60
                                ? `${m.avg_response_minutes}m`
                                : `${Math.round(m.avg_response_minutes / 60)}h`}
                            </span>
                          ) : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                        <td className="table-cell text-xs text-slate-400">
                          {m.last_active ? (
                            <span title={new Date(m.last_active).toLocaleString()}>
                              {formatDistanceToNow(new Date(m.last_active), { addSuffix: true })}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                      ))
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-brand-500" />≥80% response rate or ≤5min</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400" />50–79% or 5–30min</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400" />Below 50% or &gt;30min</span>
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>

  )
}

// ── StatCards: member's own performance view ──────────────
function StatCards({ stats }: { stats: any }) {
  if (!stats) return null
  const cards = [
    {
      label: 'Conversations Handled',
      value: stats.conversations_handled ?? 0,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
        </svg>
      ),
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Messages Sent',
      value: stats.messages_sent ?? 0,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
        </svg>
      ),
      color: 'text-brand-500 bg-brand-50',
    },
    {
      label: 'Response Rate',
      value: stats.response_rate !== null && stats.response_rate !== undefined ? `${stats.response_rate}%` : '—',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/>
        </svg>
      ),
      color: 'text-purple-600 bg-purple-50',
    },
    {
      label: 'Avg Response Time',
      value: stats.avg_response_minutes !== null && stats.avg_response_minutes !== undefined
        ? stats.avg_response_minutes < 60 ? `${stats.avg_response_minutes}m` : `${Math.round(stats.avg_response_minutes / 60)}h`
        : '—',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M15 1H9v2h6V1zm-4 13h2V8h-2v6zm8.03-6.61l1.42-1.42c-.43-.51-.9-.99-1.41-1.41l-1.42 1.42C16.07 4.74 14.12 4 12 4c-4.97 0-9 4.03-9 9s4.02 9 9 9 9-4.03 9-9c0-2.12-.74-4.07-1.97-5.61zM12 20c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
        </svg>
      ),
      color: 'text-yellow-600 bg-yellow-50',
    },
  ]
  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map(c => (
        <div key={c.label} className="bg-white border border-slate-200 rounded-xl p-4">
          <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center mb-3', c.color)}>
            {c.icon}
          </div>
          <p className="text-2xl font-bold text-slate-900">{c.value}</p>
          <p className="text-xs text-slate-500 mt-0.5">{c.label}</p>
        </div>
      ))}
    </div>
  )
}
