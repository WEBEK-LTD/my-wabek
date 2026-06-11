// @ts-nocheck
import { useState, useEffect, useRef } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import axios from 'axios'
import toast from 'react-hot-toast'
import Head from 'next/head'

type Ticket = {
  id: string; ticket_number: number; subject: string
  status: 'open'|'pending'|'resolved'|'closed'; created_at: string; updated_at: string
}
type Message = {
  id: string; ticket_id: string; sender_type: 'user'|'admin'|'ai'
  content: string; created_at: string; wa_message_id?: string; wa_status?: string
}

const WA_STATUS_ICON: Record<string, any> = {
  pending:   <span style={{fontSize:10,color:'#6b7280'}}>🕐</span>,
  sent:      <span style={{fontSize:10,color:'#6b7280'}}>✓</span>,
  delivered: <span style={{fontSize:10,color:'#6b7280'}}>✓✓</span>,
  read:      <span style={{fontSize:10,color:'#3b82f6'}}>✓✓</span>,
  failed:    <span style={{fontSize:10,color:'#ef4444'}}>✕</span>,
}

const STATUS_CFG = {
  open:     { label: 'Open',     bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  pending:  { label: 'Pending',  bg: '#fffbeb', color: '#92400e', border: '#fde68a' },
  resolved: { label: 'Resolved', bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
  closed:   { label: 'Closed',   bg: '#f9fafb', color: '#E2E8F0', border: '#e5e7eb' },
}

function isBusinessHours() {
  const now = new Date()
  const h = now.getHours()
  return h >= 9 && h < 18
}

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [activeTicket, setActiveTicket] = useState<Ticket|null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [newSubject, setNewSubject] = useState('')
  const [newBody, setNewBody] = useState('')
  const [waPhone, setWaPhone] = useState('')
  const [creating, setCreating] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const online = isBusinessHours()

  useEffect(() => { loadTickets() }, [])
  useEffect(() => {
    if (activeTicket) loadMessages(activeTicket.id)
  }, [activeTicket])

  // Poll for WA status updates every 5s when ticket is open
  useEffect(() => {
    if (!activeTicket) return
    const interval = setInterval(() => {
      loadMessages(activeTicket.id)
    }, 5000)
    return () => clearInterval(interval)
  }, [activeTicket?.id])
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadTickets() {
    try {
      const r = await axios.get('/api/support/tickets')
      setTickets(r.data.tickets || [])
    } catch {}
  }

  async function loadMessages(ticketId: string) {
    try {
      const r = await axios.get(`/api/support/messages?ticket_id=${ticketId}`)
      setMessages(r.data.messages || [])
    } catch {}
  }

  async function createTicket() {
    if (!newSubject.trim() || !newBody.trim()) { toast.error('Subject and message required'); return }
    setCreating(true)
    try {
      const r = await axios.post('/api/support/tickets', { subject: newSubject, message: newBody, whatsapp_phone: waPhone })
      toast.success(`Ticket #${r.data.ticketNumber} opened! Check your email.`)
      setShowNew(false); setNewSubject(''); setNewBody(''); setWaPhone('')
      await loadTickets()
      setActiveTicket(r.data.ticket)
    } catch (e: any) { toast.error(e?.response?.data?.error || 'Failed') }
    setCreating(false)
  }

  async function sendMessage() {
    if (!newMsg.trim() || !activeTicket) return
    setSending(true)
    try {
      const r = await axios.post('/api/support/messages', { ticket_id: activeTicket.id, content: newMsg })
      setMessages(m => [...m, r.data.message])
      setNewMsg('')
      setTickets(ts => ts.map(t => t.id === activeTicket.id ? { ...t, status: 'open', updated_at: new Date().toISOString() } : t))
    } catch (e: any) { toast.error(e?.response?.data?.error || 'Failed') }
    setSending(false)
  }

  async function askAI() {
    if (!newMsg.trim() || !activeTicket) return
    setAiLoading(true)
    const userMsg = { id: Date.now().toString(), ticket_id: activeTicket.id, sender_type: 'user' as const, content: newMsg, created_at: new Date().toISOString() }
    setMessages(m => [...m, userMsg])
    const sentMsg = newMsg; setNewMsg('')
    try {
      const r = await axios.post('/api/support/ai-reply', { ticket_id: activeTicket.id, message: sentMsg })
      setMessages(m => [...m, { id: Date.now().toString() + '1', ticket_id: activeTicket.id, sender_type: 'ai', content: r.data.reply, created_at: new Date().toISOString() }])
    } catch (e: any) { toast.error('WABEK AI unavailable') }
    setAiLoading(false)
  }

  return (
    <>
      <Head><title>Support — WABEK</title></Head>
      <DashboardLayout>
        <div className="flex h-[calc(100vh-56px)] overflow-hidden">

          {/* Left — ticket list */}
          <div className="w-72 border-r border-slate-200 flex flex-col flex-shrink-0">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h1 className="font-bold text-slate-900 text-sm">Support Center</h1>
                <p className="text-xs text-slate-500 mt-0.5">{tickets.length} tickets</p>
              </div>
              <button onClick={() => setShowNew(true)}
                className="w-7 h-7 rounded-lg bg-brand-500 hover:bg-brand-600 text-white flex items-center justify-center text-lg font-bold transition-colors">+</button>
            </div>

            {/* Business hours banner */}
            <div className={`mx-3 mt-3 rounded-lg px-3 py-2 flex items-center gap-2 text-xs ${online ? 'bg-green-500/10 border border-green-500/20' : 'bg-yellow-500/10 border border-yellow-500/20'}`}>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${online ? 'bg-green-400' : 'bg-yellow-400'}`}
                style={online ? {boxShadow:'0 0 0 3px rgba(74,222,128,.2)'} : {}}/>
              <span className={online ? 'text-green-400' : 'text-yellow-400'}>
                {online ? 'Team online · 9AM–6PM' : 'Team offline · WABEK AI available'}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              {tickets.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="text-4xl mb-3">🎫</div>
                  <p className="text-slate-400 text-sm">No tickets yet</p>
                  <button onClick={() => setShowNew(true)} className="text-blue-600 text-xs hover:underline mt-1">Open first ticket</button>
                </div>
              ) : tickets.map(t => (
                <button key={t.id} onClick={() => setActiveTicket(t)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-200 hover:bg-white transition-colors ${activeTicket?.id === t.id ? 'bg-white border-l-2 border-l-brand-500' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-slate-900 text-xs font-semibold truncate">#{t.ticket_number} · {t.subject}</p>
                      <p className="text-slate-500 text-xs mt-0.5">{new Date(t.updated_at).toLocaleDateString()}</p>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{
                      background: STATUS_CFG[t.status]?.bg, color: STATUS_CFG[t.status]?.color,
                      border: `1px solid ${STATUS_CFG[t.status]?.border}`
                    }}>{STATUS_CFG[t.status]?.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right — chat */}
          {activeTicket ? (
            <div className="flex-1 flex flex-col min-w-0">
              {/* Chat header */}
              <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-slate-900 font-semibold text-sm">#{activeTicket.ticket_number} · {activeTicket.subject}</h2>
                  <p className="text-slate-500 text-xs mt-0.5">Opened {new Date(activeTicket.created_at).toLocaleDateString()}</p>
                </div>
                <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{
                  background: STATUS_CFG[activeTicket.status]?.bg, color: STATUS_CFG[activeTicket.status]?.color,
                  border: `1px solid ${STATUS_CFG[activeTicket.status]?.border}`
                }}>{STATUS_CFG[activeTicket.status]?.label}</span>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.sender_type !== 'user' && (
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mr-2 flex-shrink-0 ${msg.sender_type === 'ai' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {msg.sender_type === 'ai' ? '🤖' : '👤'}
                      </div>
                    )}
                    <div className="max-w-[70%]">
                      {msg.sender_type !== 'user' && (
                        <p className="text-xs text-slate-500 mb-1 ml-1">
                          {msg.sender_type === 'ai' ? 'WABEK AI' : 'Support Team'}
                        </p>
                      )}
                      <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.sender_type === 'user'
                          ? 'bg-blue-600 text-white rounded-tr-sm'
                          : msg.sender_type === 'ai'
                          ? 'bg-purple-50 border border-purple-200 text-slate-800 rounded-tl-sm'
                          : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'
                      }`}>{msg.content}</div>
                      <p className={`text-xs text-slate-600 mt-1 flex items-center gap-1 ${msg.sender_type === 'user' ? 'justify-end' : 'justify-start ml-1'}`}>
                        {new Date(msg.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
                        {msg.sender_type === 'user' && msg.wa_status && WA_STATUS_ICON[msg.wa_status]}
                      </p>
                    </div>
                  </div>
                ))}
                {aiLoading && (
                  <div className="flex justify-start">
                    <div className="w-7 h-7 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs mr-2">🤖</div>
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl rounded-tl-sm px-4 py-3">
                      <div className="flex gap-1">{[0,1,2].map(i=><div key={i} className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay:`${i*0.15}s`}}/>)}</div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef}/>
              </div>

              {/* Input */}
              {activeTicket.status !== 'resolved' && activeTicket.status !== 'closed' ? (
                <div className="p-4 border-t border-slate-200">
                  {!online && (
                    <div className="flex items-center gap-2 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 mb-3">
                      <span>⏰</span>
                      <span>Our team is offline. Ask WABEK AI or send a message — we'll reply during business hours (9AM–6PM).</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <textarea
                      value={newMsg}
                      onChange={e => setNewMsg(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                      placeholder="Type your message... (Enter to send)"
                      rows={2}
                      className="input flex-1 resize-none text-sm"
                    />
                    <div className="flex flex-col gap-2">
                      <button onClick={sendMessage} disabled={sending || !newMsg.trim()}
                        className="btn-primary text-sm px-4 py-2 h-fit">
                        {sending ? '...' : 'Send'}
                      </button>
                      {!online && (
                        <button onClick={askAI} disabled={aiLoading || !newMsg.trim()}
                          className="text-xs px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 transition-colors">
                          🤖 Ask AI
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 border-t border-slate-200 text-center text-sm text-slate-500">
                  This ticket is {activeTicket.status}. <button onClick={() => createTicket()} className="text-blue-600 hover:underline">Open a new ticket</button> if you need more help.
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">💬</div>
                <p className="text-slate-400 text-sm mb-2">Select a ticket to view the conversation</p>
                <button onClick={() => setShowNew(true)} className="btn-primary text-sm">+ Open New Ticket</button>
              </div>
            </div>
          )}
        </div>

        {/* New ticket modal */}
        {showNew && (
          <div className="fixed inset-0 bg-slate-50/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-slate-900 text-lg">Open New Ticket</h2>
                <button onClick={() => setShowNew(false)} className="text-slate-400 hover:text-slate-900 text-xl leading-none">×</button>
              </div>
              <div>
                <label className="label">Subject *</label>
                <input value={newSubject} onChange={e => setNewSubject(e.target.value)}
                  placeholder="What do you need help with?" className="input w-full" />
              </div>
              <div>
                <label className="label">Message *</label>
                <textarea value={newBody} onChange={e => setNewBody(e.target.value)}
                  placeholder="Describe your issue in detail..." rows={4} className="input w-full resize-none" />
              </div>
              <div>
                <label className="label">WhatsApp Number (for notifications)</label>
                <input value={waPhone} onChange={e => setWaPhone(e.target.value)}
                  placeholder="e.g. 966501234567" className="input w-full" />
                <p className="text-xs text-slate-500 mt-1">We'll send you WhatsApp updates on your ticket. Include country code, no + or spaces.</p>
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowNew(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={createTicket} disabled={creating || !newSubject.trim() || !newBody.trim()} className="btn-primary flex-1">
                  {creating ? 'Opening...' : '🎫 Open Ticket'}
                </button>
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    </>
  )
}
