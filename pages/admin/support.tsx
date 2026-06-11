// @ts-nocheck
import { useState, useEffect, useRef } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import axios from 'axios'
import toast from 'react-hot-toast'
import Head from 'next/head'

const STATUS_CFG = {
  open:     { label: 'Open',     bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  pending:  { label: 'Pending',  bg: '#fffbeb', color: '#92400e', border: '#fde68a' },
  resolved: { label: 'Resolved', bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
  closed:   { label: 'Closed',   bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb' },
}

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<any[]>([])
  const [active, setActive] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [showKnowledge, setShowKnowledge] = useState(false)
  const [knowledge, setKnowledge] = useState('')
  const [savingKnowledge, setSavingKnowledge] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadTickets() }, [filterStatus])
  useEffect(() => {
    axios.get('/api/admin/support/knowledge').then(r => setKnowledge(r.data.knowledge || '')).catch(()=>{})
  }, [])
  useEffect(() => { if (active) loadMessages(active.id) }, [active])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function loadTickets() {
    try {
      const r = await axios.get(`/api/admin/support/tickets?status=${filterStatus}`)
      setTickets(r.data.tickets || [])
    } catch {}
  }

  async function loadMessages(ticketId: string) {
    try {
      const r = await axios.get(`/api/admin/support/messages?ticket_id=${ticketId}`)
      setMessages(r.data.messages || [])
    } catch {}
  }

  async function sendReply() {
    if (!reply.trim() || !active) return
    setSending(true)
    try {
      await axios.post('/api/admin/support/reply', { ticket_id: active.id, content: reply })
      toast.success('Reply sent — user notified via email & WhatsApp')
      setReply('')
      await loadMessages(active.id)
      await loadTickets()
    } catch (e: any) { toast.error(e?.response?.data?.error || 'Failed') }
    setSending(false)
  }

  async function updateStatus(id: string, status: string) {
    try {
      await axios.put('/api/admin/support/tickets', { id, status })
      setTickets(ts => ts.map(t => t.id === id ? { ...t, status } : t))
      if (active?.id === id) setActive((a: any) => ({ ...a, status }))
      toast.success(`Ticket marked as ${status}`)
    } catch {}
  }

  const filtered = tickets.filter(t => filterStatus === 'all' || t.status === filterStatus)
  const openCount = tickets.filter(t => t.status === 'open').length

  return (
    <>
      <Head><title>Support Tickets — Admin</title></Head>
      <AdminLayout>
        <div className="flex h-[calc(100vh-56px)] overflow-hidden -m-6">

          {/* Left — ticket list */}
          <div className="w-80 border-r border-slate-200 flex flex-col flex-shrink-0">
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <h1 className="font-bold text-slate-900">Support Tickets</h1>
                {openCount > 0 && (
                  <span className="text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 rounded-full px-2 py-0.5">{openCount} open</span>
                )}
              </div>
              <div className="flex gap-1 flex-wrap">
                {['all','open','pending','resolved','closed'].map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-colors capitalize ${filterStatus === s ? 'bg-brand-500 border-brand-500 text-slate-900' : 'border-slate-200 text-slate-400 hover:text-slate-900'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">No tickets</div>
              ) : filtered.map(t => {
                const user = t.users as any
                const lastMsg = t.support_messages?.slice(-1)[0]
                return (
                  <button key={t.id} onClick={() => setActive(t)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-200 hover:bg-white transition-colors ${active?.id === t.id ? 'bg-white border-l-2 border-l-brand-500' : ''}`}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-slate-900 text-xs font-bold truncate">#{t.ticket_number}</p>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{
                        background: STATUS_CFG[t.status]?.bg, color: STATUS_CFG[t.status]?.color,
                        border: `1px solid ${STATUS_CFG[t.status]?.border}`
                      }}>{STATUS_CFG[t.status]?.label}</span>
                    </div>
                    <p className="text-slate-700 text-xs truncate">{t.subject}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-4 h-4 rounded-full bg-brand-500/20 text-blue-600 flex items-center justify-center text-xs flex-shrink-0 font-bold">
                        {user?.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <p className="text-slate-500 text-xs truncate">{user?.name || user?.email}</p>
                      <p className="text-slate-600 text-xs ml-auto">{new Date(t.updated_at).toLocaleDateString()}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Center — chat */}
          {active ? (
            <div className="flex-1 flex flex-col min-w-0">
              {/* Header */}
              <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-slate-900 font-semibold text-sm">#{active.ticket_number} · {active.subject}</h2>
                  <p className="text-slate-500 text-xs">Opened {new Date(active.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  {Object.entries(STATUS_CFG).map(([s, cfg]) => s !== active.status && (
                    <button key={s} onClick={() => updateStatus(active.id, s)}
                      className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
                      style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}>
                    {msg.sender_type !== 'admin' && (
                      <div className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-xs mr-2 flex-shrink-0">
                        {msg.sender_type === 'ai' ? '🤖' : '👤'}
                      </div>
                    )}
                    <div className="max-w-[70%]">
                      {msg.sender_type !== 'admin' && (
                        <p className="text-xs text-slate-500 mb-1 ml-1">
                          {msg.sender_type === 'ai' ? 'WABEK AI' : (active.users as any)?.name || 'User'}
                        </p>
                      )}
                      <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.sender_type === 'admin'
                          ? 'bg-brand-500 text-slate-900 rounded-tr-sm'
                          : msg.sender_type === 'ai'
                          ? 'bg-purple-500/10 border border-purple-500/20 text-slate-700 rounded-tl-sm'
                          : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'
                      }`}>{msg.content}</div>
                      <p className={`text-xs text-slate-600 mt-1 ${msg.sender_type === 'admin' ? 'text-right' : 'ml-1'}`}>
                        {new Date(msg.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef}/>
              </div>

              {/* Reply */}
              <div className="p-4 border-t border-slate-200">
                <div className="flex gap-2">
                  <textarea value={reply} onChange={e => setReply(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply() } }}
                    placeholder="Type reply... (Enter to send — user gets email + WhatsApp)"
                    rows={2} className="input flex-1 resize-none text-sm" />
                  <button onClick={sendReply} disabled={sending || !reply.trim()} className="btn-primary px-5">
                    {sending ? '...' : 'Reply'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">🎫</div>
                <p className="text-slate-400 text-sm">Select a ticket to view and reply</p>
              </div>
            </div>
          )}

          {/* Right — user details */}
          {active?.users && (
            <div className="w-64 border-l border-slate-200 p-4 flex-shrink-0 overflow-y-auto">
              <h3 className="font-semibold text-slate-900 text-sm mb-4">Customer Details</h3>
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-full bg-brand-500/20 text-blue-600 flex items-center justify-center text-xl font-bold mx-auto">
                  {(active.users as any)?.name?.[0]?.toUpperCase() || '?'}
                </div>
                {[
                  { label: 'Name', value: (active.users as any)?.name },
                  { label: 'Email', value: (active.users as any)?.email },
                  { label: 'Joined', value: new Date((active.users as any)?.created_at).toLocaleDateString() },
                  { label: 'Ticket #', value: `#${active.ticket_number}` },
                  { label: 'Status', value: active.status },
                  { label: 'Opened', value: new Date(active.created_at).toLocaleDateString() },
                ].map(({ label, value }) => value && (
                  <div key={label}>
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="text-sm text-slate-900 break-all">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      {/* AI Knowledge Base Modal */}
      {showKnowledge && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-900 text-lg">🤖 WABEK AI Knowledge Base</h2>
                <p className="text-xs text-slate-500 mt-1">Add custom info the AI uses when replying to support tickets. It already knows about WABEK features by default.</p>
              </div>
              <button onClick={() => setShowKnowledge(false)} className="text-slate-400 hover:text-slate-900 text-xl">×</button>
            </div>
            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-3">
              <p className="text-xs text-slate-500 mb-2 font-semibold uppercase tracking-wide">Default knowledge (built-in)</p>
              <ul className="text-xs text-slate-500 space-y-1">
                {['WABEK features and pricing','Bulk campaigns, chatbot, team inbox, AI auto-reply','Supported: Cloud API + WhatsApp Web (Baileys)','Business hours: 9AM–6PM daily','Support email: support@waabek.com'].map((item, i) => (
                  <li key={i} className="flex items-center gap-2"><span className="text-green-400">✓</span>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <label className="label">Custom Knowledge (add your own info)</label>
              <textarea
                value={knowledge}
                onChange={e => setKnowledge(e.target.value)}
                rows={8}
                placeholder={`Examples:
- Our refund policy: full refund within 14 days for annual plans
- We support Arabic, English, French, Turkish
- Onboarding takes 15 minutes with our setup wizard
- Enterprise plans include dedicated account manager
- We are based in [your location]`}
                className="input w-full resize-none text-sm font-mono"
              />
              <p className="text-xs text-slate-500 mt-1">Write in plain text. The AI will use this when answering questions from your customers.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowKnowledge(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={async () => {
                setSavingKnowledge(true)
                try {
                  await axios.post('/api/admin/support/knowledge', { knowledge })
                  toast.success('AI knowledge updated!')
                  setShowKnowledge(false)
                } catch { toast.error('Failed to save') }
                setSavingKnowledge(false)
              }} disabled={savingKnowledge} className="btn-primary flex-1">
                {savingKnowledge ? 'Saving...' : '💾 Save Knowledge'}
              </button>
            </div>
          </div>
        </div>
      )}

      </AdminLayout>
    </>
  )
}
