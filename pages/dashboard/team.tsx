// @ts-nocheck
import { useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { PlusIcon, TrashIcon, ClipboardIcon, UserGroupIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
const ROLE_COLORS = {
  admin: 'badge-red',
  agent: 'badge-green',
  viewer: 'badge-gray',
}

const STATUS_COLORS = {
  active: 'badge-green',
  pending: 'badge-yellow',
  suspended: 'badge-red',
}

export default function TeamPage() {
  const qc = useQueryClient()
  const { data: meData } = useQuery('me', () => axios.get('/api/auth/me').then(r => r.data))
  // A team member (sub-account) has actualUserId set — only owner can manage team
  const isOwner = !meData?.user?.actualUserId
  const [showInvite, setShowInvite] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', role: 'agent' })
  const [inviteUrl, setInviteUrl] = useState('')

  const { data, isLoading } = useQuery('team', () => axios.get('/api/team').then(r => r.data))
  const members = data?.members || []

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
    { onSuccess: () => { qc.invalidateQueries('team'); toast.success('Updated') } }
  )

  const deleteMut = useMutation(
    (id) => axios.delete(`/api/team/${id}`),
    { onSuccess: () => { qc.invalidateQueries('team'); toast.success('Removed') } }
  )

  const copy = (text) => { navigator.clipboard.writeText(text); toast.success('Copied!') }

  return (
    <DashboardLayout title="Team">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-slate-400 text-sm">{members.length} team members</p>
        </div>
        <button onClick={() => setShowInvite(v => !v)} className="btn-primary">
          <PlusIcon className="w-4 h-4" /> Invite Member
        </button>
      </div>

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
            <button onClick={() => setShowInvite(false)} className="btn-secondary">Cancel</button>
          </div>

          {/* Invite URL */}
          {inviteUrl && (
            <div className="mt-4 p-3 bg-blue-50/20 border border-blue-200/50 rounded-xl">
              <p className="text-sm text-slate-700 mb-2">Share this link with your team member:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs text-blue-600 bg-[#F8FAFC] px-3 py-2 rounded-lg truncate">{inviteUrl}</code>
                <button onClick={() => copy(inviteUrl)} className="btn-secondary text-xs py-2">
                  <ClipboardIcon className="w-4 h-4" /> Copy
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Members list */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
      ) : members.length === 0 ? (
        <div className="card text-center py-16">
          <UserGroupIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="font-display font-semibold text-slate-900 mb-2">No team members yet</h3>
          <p className="text-slate-400 text-sm mb-4">Invite your team to collaborate on conversations</p>
          <button onClick={() => setShowInvite(true)} className="btn-primary mx-auto">
            <PlusIcon className="w-4 h-4" /> Invite First Member
          </button>
        </div>
      ) : (
        <div className="card">
          <div className="space-y-0">
            {members.map(member => (
              <div key={member.id} className="flex items-center gap-4 py-3 border-b border-slate-200 last:border-0">
                <div className="w-10 h-10 rounded-full bg-[#F8FAFC] flex items-center justify-center font-bold text-slate-700 flex-shrink-0">
                  {member.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{member.name}</p>
                  <p className="text-xs text-slate-500">{member.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={ROLE_COLORS[member.role] || 'badge-gray'}>{member.role}</span>
                  <span className={STATUS_COLORS[member.status] || 'badge-gray'}>{member.status}</span>
                  {isOwner && <>
                  <select value={member.role} onChange={e => updateMut.mutate({ id: member.id, role: e.target.value })}
                    className="input text-xs py-1 px-2 w-24">
                    <option value="agent">Agent</option>
                    <option value="admin">Admin</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button onClick={() => { if(confirm('Remove member?')) deleteMut.mutate(member.id) }}
                    className="p-1.5 text-slate-500 hover:text-red-400">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                  </>}
                </div>
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
    </DashboardLayout>
  )
}
