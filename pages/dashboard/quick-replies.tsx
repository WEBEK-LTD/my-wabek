// @ts-nocheck
import { useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { PlusIcon, TrashIcon, PencilIcon, BoltIcon } from '@heroicons/react/24/outline'

export default function QuickRepliesPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ title: '', message: '', shortcut: '' })

  const { data } = useQuery('quick-replies', () => axios.get('/api/quick-replies').then(r => r.data))
  const replies = data?.replies || []

  const saveMut = useMutation(
    (body) => editing ? axios.put(`/api/quick-replies/${editing.id}`, body) : axios.post('/api/quick-replies', body),
    {
      onSuccess: () => {
        qc.invalidateQueries('quick-replies')
        setShowForm(false); setEditing(null)
        setForm({ title: '', message: '', shortcut: '' })
        toast.success(editing ? 'Updated!' : 'Created!')
      },
      onError: e => toast.error(e?.response?.data?.error || 'Failed'),
    }
  )

  const deleteMut = useMutation(
    id => axios.delete(`/api/quick-replies/${id}`),
    { onSuccess: () => { qc.invalidateQueries('quick-replies'); toast.success('Deleted') } }
  )

  const openEdit = (reply) => {
    setEditing(reply)
    setForm({ title: reply.title, message: reply.message, shortcut: reply.shortcut || '' })
    setShowForm(true)
  }

  const cancel = () => { setShowForm(false); setEditing(null); setForm({ title: '', message: '', shortcut: '' }) }

  return (
    <DashboardLayout title="Quick Replies">
      <div className="flex justify-between items-center mb-6">
        <p className="text-slate-400 text-sm">{replies.length} quick replies</p>
        <button onClick={() => { setEditing(null); setShowForm(v => !v) }} className="btn-primary">
          <PlusIcon className="w-4 h-4" /> New Quick Reply
        </button>
      </div>

      {showForm && (
        <div className="card mb-6 space-y-3">
          <h3 className="font-display font-semibold text-slate-900">{editing ? 'Edit' : 'Create'} Quick Reply</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Title</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Greeting" className="input" />
            </div>
            <div>
              <label className="label">Shortcut (optional)</label>
              <input value={form.shortcut} onChange={e => setForm(f => ({ ...f, shortcut: e.target.value }))} placeholder="/hi" className="input font-mono" />
            </div>
          </div>
          <div>
            <label className="label">Message</label>
            <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              rows={4} className="input resize-none" placeholder="Hello! Thank you for contacting us..." />
          </div>
          <div className="flex gap-3">
            <button onClick={() => saveMut.mutate(form)} disabled={saveMut.isLoading || !form.title || !form.message} className="btn-primary">
              {saveMut.isLoading ? 'Saving...' : editing ? 'Update' : 'Create'}
            </button>
            <button onClick={cancel} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {replies.length === 0 && !showForm ? (
        <div className="card text-center py-16">
          <BoltIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="font-display font-semibold text-slate-900 mb-2">No quick replies yet</h3>
          <p className="text-slate-400 text-sm mb-4">Save common responses to reply faster in the Live Chat</p>
          <button onClick={() => setShowForm(true)} className="btn-primary mx-auto"><PlusIcon className="w-4 h-4" /> Create First Reply</button>
        </div>
      ) : (
        <div className="space-y-3">
          {replies.map(reply => (
            <div key={reply.id} className="card hover:border-wabek-muted transition-colors">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-slate-900">{reply.title}</p>
                    {reply.shortcut && <code className="text-xs text-blue-600 bg-blue-50/20 px-1.5 py-0.5 rounded">{reply.shortcut}</code>}
                    <span className="text-xs text-slate-500 ml-auto">{reply.use_count} uses</span>
                  </div>
                  <p className="text-sm text-slate-400 line-clamp-2">{reply.message}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(reply)} className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-[#F8FAFC]">
                    <PencilIcon className="w-4 h-4" /></button>
                  <button onClick={() => { if (confirm('Delete?')) deleteMut.mutate(reply.id) }} className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-[#F8FAFC]">
                    <TrashIcon className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  )
}
