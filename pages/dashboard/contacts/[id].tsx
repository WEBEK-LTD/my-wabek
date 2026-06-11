// @ts-nocheck
import { useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import { useRouter } from 'next/router'
import toast from 'react-hot-toast'
import { ChatBubbleLeftRightIcon, PencilIcon, TrashIcon, TagIcon, PhoneIcon, EnvelopeIcon, XMarkIcon, PaperAirplaneIcon, ArrowLeftIcon, NoSymbolIcon } from '@heroicons/react/24/outline'
import { CheckCircleIcon } from '@heroicons/react/24/solid'
import { format } from 'date-fns'
import Link from 'next/link'

export default function ContactDetailPage() {
  const router = useRouter()
  const { id } = router.query
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({ name: '', email: '', tags: '' })
  const [quickMsg, setQuickMsg] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)

  const { data, isLoading } = useQuery(
    ['contact', id],
    () => axios.get(`/api/contacts/${id}`).then(r => r.data),
    { enabled: !!id, onSuccess: (d) => setEditData({ name: d.contact.name || '', email: d.contact.email || '', tags: d.contact.tags?.join(', ') || '' }) }
  )
  const { data: instancesData } = useQuery('instances', () => axios.get('/api/whatsapp/instances').then(r => r.data))

  const contact = data?.contact
  const messages = data?.messages || []
  const instances = instancesData?.instances || []
  const connectedInstance = instances.find(i => i.status === 'connected')

  const updateMut = useMutation(
    (body) => axios.put(`/api/contacts/${id}`, body),
    { onSuccess: () => { qc.invalidateQueries(['contact', id]); setEditing(false); toast.success('Contact updated') } }
  )

  const deleteMut = useMutation(
    () => axios.delete(`/api/contacts/${id}`),
    { onSuccess: () => { toast.success('Contact deleted'); router.push('/dashboard/contacts') } }
  )

  const blockMut = useMutation(
    (blocked) => axios.put(`/api/contacts/${id}`, { is_blocked: blocked }),
    { onSuccess: () => qc.invalidateQueries(['contact', id]) }
  )

  const sendMsg = async () => {
    if (!quickMsg.trim() || !connectedInstance) return
    setSendingMsg(true)
    try {
      await axios.post('/api/whatsapp/send', { instance_id: connectedInstance.id, to: contact.phone, type: 'text', text: quickMsg.trim() })
      setQuickMsg('')
      qc.invalidateQueries(['contact', id])
      toast.success('Message sent!')
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to send')
    } finally { setSendingMsg(false) }
  }

  if (isLoading) return (
    <DashboardLayout title="Contact">
      <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
    </DashboardLayout>
  )

  if (!contact) return (
    <DashboardLayout title="Contact Not Found">
      <div className="card text-center py-16">
        <p className="text-slate-400">Contact not found</p>
        <Link href="/dashboard/contacts" className="btn-primary mt-4 inline-flex">← Back to Contacts</Link>
      </div>
    </DashboardLayout>
  )

  return (
    <DashboardLayout title={contact.name || contact.phone}>
      <div className="max-w-4xl">
        {/* Back */}
        <Link href="/dashboard/contacts" className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-900 mb-6 transition-colors w-fit">
          <ArrowLeftIcon className="w-4 h-4" /> Back to Contacts
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Contact info */}
          <div className="space-y-4">
            {/* Profile card */}
            <div className="card text-center">
              <div className="w-20 h-20 rounded-full bg-[#F8FAFC] flex items-center justify-center text-3xl font-bold text-slate-900 mx-auto mb-3">
                {(contact.name || contact.phone)[0].toUpperCase()}
              </div>
              <h2 className="font-display font-bold text-xl text-slate-900">{contact.name || 'No name'}</h2>
              <p className="text-slate-400 text-sm mt-1">{contact.phone}</p>
              {contact.email && <p className="text-slate-500 text-xs mt-0.5">{contact.email}</p>}
              <div className="flex items-center justify-center gap-1 mt-2">
                {contact.is_blocked ? <span className="badge-red">Blocked</span> : contact.opted_out ? <span className="badge-yellow">Opted out</span> : <span className="badge-green">Active</span>}
                {contact.ai_opted_out && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-900/30 text-purple-400">🧠 AI Off</span>}
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => axios.post('/api/ai/opt-out', { contact_id: contact.id, opted_out: !contact.ai_opted_out }).then(() => { toast.success(contact.ai_opted_out ? 'AI enabled' : 'AI disabled'); refetch() })}
                  className={contact.ai_opted_out ? 'btn-secondary text-xs py-1' : 'btn-secondary text-xs py-1 text-purple-400'}>
                  🧠 {contact.ai_opted_out ? 'Enable AI' : 'Disable AI'}
                </button>
                <button onClick={() => setEditing(true)} className="btn-secondary flex-1 text-sm py-2"><PencilIcon className="w-4 h-4" /> Edit</button>
                <Link href={`/dashboard/chat?contact=${id}`} className="btn-primary flex-1 text-sm py-2 justify-center"><ChatBubbleLeftRightIcon className="w-4 h-4" /> Chat</Link>
              </div>
            </div>

            {/* Details */}
            <div className="card space-y-3">
              <h3 className="font-semibold text-slate-900 text-sm">Contact Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-slate-300"><PhoneIcon className="w-4 h-4 text-slate-500" />{contact.phone}</div>
                {contact.email && <div className="flex items-center gap-2 text-slate-300"><EnvelopeIcon className="w-4 h-4 text-slate-500" />{contact.email}</div>}
                <div className="flex items-start gap-2"><TagIcon className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                  <div className="flex flex-wrap gap-1">
                    {contact.tags?.length > 0 ? contact.tags.map(t => <span key={t} className="badge-gray">{t}</span>) : <span className="text-slate-500">No tags</span>}
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-600">Added {format(new Date(contact.created_at), 'MMM d, yyyy')}</p>
            </div>

            {/* Actions */}
            <div className="card space-y-2">
              <h3 className="font-semibold text-slate-900 text-sm mb-3">Actions</h3>
              <button onClick={() => blockMut.mutate(!contact.is_blocked)} className="btn-secondary w-full text-sm justify-start">
                <NoSymbolIcon className="w-4 h-4" />
                {contact.is_blocked ? 'Unblock Contact' : 'Block Contact'}
              </button>
              <button onClick={() => { if (confirm('Delete this contact?')) deleteMut.mutate() }} className="btn-danger w-full text-sm">
                <TrashIcon className="w-4 h-4" /> Delete Contact
              </button>
            </div>
          </div>

          {/* Right: Messages */}
          <div className="lg:col-span-2 space-y-4">
            {/* Quick send */}
            {connectedInstance && !contact.is_blocked && !contact.opted_out && (
              <div className="card">
                <h3 className="font-semibold text-slate-900 text-sm mb-3">Quick Message</h3>
                <div className="flex gap-2">
                  <textarea value={quickMsg} onChange={e => setQuickMsg(e.target.value)} placeholder={`Send a message to ${contact.name || contact.phone}…`} rows={2} className="input flex-1 resize-none text-sm" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg() } }} />
                  <button onClick={sendMsg} disabled={!quickMsg.trim() || sendingMsg} className="btn-primary self-end">
                    {sendingMsg ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <PaperAirplaneIcon className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Message history */}
            <div className="card p-0 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Message History</h3>
                <span className="badge-gray">{messages.length} messages</span>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {messages.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-sm">No messages yet</div>
                ) : messages.map((msg) => (
                  <div key={msg.id} className={`flex py-3 px-5 border-b border-slate-200/50 gap-3 ${msg.direction === 'outbound' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${msg.direction === 'outbound' ? 'bg-blue-50 text-blue-600' : 'bg-[#F8FAFC] text-slate-300'}`}>
                      {msg.direction === 'outbound' ? 'Me' : (contact.name || contact.phone)[0].toUpperCase()}
                    </div>
                    <div className={`max-w-xs ${msg.direction === 'outbound' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      <div className={`px-3 py-2 rounded-xl text-sm text-slate-900 ${msg.direction === 'outbound' ? 'bg-brand-700/50 rounded-br-none' : 'bg-[#F8FAFC] rounded-bl-none'}`}>
                        {msg.content}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-600">{format(new Date(msg.created_at), 'MMM d, HH:mm')}</span>
                        {msg.direction === 'outbound' && (
                          msg.status === 'read' ? <CheckCircleIcon className="w-3 h-3 text-blue-400" /> :
                          msg.status === 'delivered' ? <CheckCircleIcon className="w-3 h-3 text-slate-500" /> :
                          <span className="text-[10px] text-slate-600">{msg.status}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(false)}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h3 className="font-display font-semibold text-slate-900">Edit Contact</h3>
              <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-900"><XMarkIcon className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="label">Name</label><input value={editData.name} onChange={e => setEditData(d => ({...d, name: e.target.value}))} className="input" /></div>
              <div><label className="label">Email</label><input value={editData.email} onChange={e => setEditData(d => ({...d, email: e.target.value}))} type="email" className="input" /></div>
              <div><label className="label">Tags <span className="text-slate-500">(comma-separated)</span></label><input value={editData.tags} onChange={e => setEditData(d => ({...d, tags: e.target.value}))} placeholder="vip, customer" className="input" /></div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
                <button onClick={() => updateMut.mutate({ name: editData.name, email: editData.email, tags: editData.tags.split(',').map(t => t.trim()).filter(Boolean) })} disabled={updateMut.isLoading} className="btn-primary">
                  {updateMut.isLoading ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
