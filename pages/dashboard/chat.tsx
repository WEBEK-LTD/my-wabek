// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from 'react'
import Head from 'next/head'
import axios from 'axios'
import { useAuthStore } from '@/lib/store'
import { useRequireAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { format, isToday, isYesterday } from 'date-fns'
import clsx from 'clsx'
import DashboardLayout from '@/components/layout/DashboardLayout'
import {
  PaperAirplaneIcon, MagnifyingGlassIcon, XMarkIcon,
  CheckIcon, UserCircleIcon, FunnelIcon, EllipsisVerticalIcon,
  CheckCircleIcon, ClockIcon, ExclamationCircleIcon,
  BoltIcon, TagIcon, UserPlusIcon, ArchiveBoxIcon,
  FaceSmileIcon, PaperClipIcon, ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid'

const EMOJIS = ['👍','❤️','😂','😮','😢','🙏','🔥','✅','💯','🎉']

const STATUS_CONFIG = {
  open: { label: 'Open', color: 'text-blue-600', bg: 'bg-blue-50/30', icon: '🟢' },
  pending: { label: 'Pending', color: 'text-yellow-400', bg: 'bg-yellow-900/30', icon: '🟡' },
  resolved: { label: 'Resolved', color: 'text-slate-400', bg: 'bg-[#F8FAFC]/30', icon: '✅' },
  spam: { label: 'Spam', color: 'text-red-400', bg: 'bg-red-900/30', icon: '🚫' },
}

const PRIORITY_CONFIG = {
  low: { label: 'Low', color: 'text-slate-400' },
  normal: { label: 'Normal', color: 'text-blue-400' },
  high: { label: 'High', color: 'text-orange-400' },
  urgent: { label: 'Urgent', color: 'text-red-400' },
}

function formatTime(d) {
  const date = new Date(d)
  if (isToday(date)) return format(date, 'HH:mm')
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'MMM d')
}

function MessageBubble({ msg, showAvatar }) {
  const isOut = msg.direction === 'outbound'
  const statusIcon = {
    pending: <span className="text-slate-500 text-xs">🕐</span>,
    waiting: <span className="text-slate-500 text-xs">🕐</span>,
    sending: <span className="text-slate-500 text-xs">🕐</span>,
    sent: <CheckIcon className="w-3 h-3 text-slate-400" />,
    delivered: <div className="flex"><CheckIcon className="w-3 h-3 text-slate-400" /><CheckIcon className="w-3 h-3 -ml-1.5 text-slate-400" /></div>,
    read: <div className="flex"><CheckIcon className="w-3 h-3 text-blue-400" /><CheckIcon className="w-3 h-3 -ml-1.5 text-blue-400" /></div>,
    failed: <ExclamationCircleIcon className="w-3 h-3 text-red-400" />,
    window: <ExclamationCircleIcon className="w-3 h-3 text-yellow-400" />,
  }

  return (
    <div className={clsx('flex items-end gap-2 group', isOut ? 'justify-end' : 'justify-start')}>
      {!isOut && showAvatar && (
        <div className="w-6 h-6 rounded-full bg-[#F8FAFC] flex items-center justify-center text-xs text-slate-400 flex-shrink-0 mb-1">
          {msg.contacts?.name?.[0] || '?'}
        </div>
      )}
      {!isOut && !showAvatar && <div className="w-6 flex-shrink-0" />}
      <div className="max-w-[70%]">
        <div className={clsx('px-3 py-2 rounded-2xl text-sm', isOut ? 'bg-brand-600 text-white rounded-br-sm' : 'bg-[#F8FAFC] text-slate-800 rounded-bl-sm', msg._windowWarning && 'opacity-60')}>
          {msg.type === 'image' && msg.media_url && (
            <img src={msg.media_url} alt="image" className="rounded-lg mb-1 max-w-48" />
          )}
          <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
          <div className={clsx('flex items-center gap-1 mt-1', isOut ? 'justify-end' : 'justify-start')}>
            {(msg.type === 'ai_reply' || msg.meta?.source === 'ai_assistant') && (
              <span className="text-[9px] text-purple-400 bg-purple-900/30 px-1.5 py-0.5 rounded-full">🧠 AI</span>
            )}
            {msg.meta?.source === 'chatbot' && (
              <span className="text-[9px] text-blue-400 bg-blue-900/30 px-1.5 py-0.5 rounded-full">🤖 Bot</span>
            )}
            <span className="text-[10px] opacity-60">{formatTime(msg.created_at)}</span>
            {isOut && <span className="opacity-70">{msg._windowWarning ? statusIcon.window : (statusIcon[msg.status] || statusIcon.sent)}</span>}
          </div>
        </div>
        {msg._windowWarning && (
          <p className="text-yellow-400 text-[11px] mt-1 text-right">Not delivered — customer outside 24h window</p>
        )}
        {!msg._windowWarning && msg.status === 'failed' && msg.meta?.error_code && (
          <p className="text-red-400 text-[11px] mt-1 text-right">
            {msg.meta.error_code === 131047 
              ? '⚠️ Outside 24h window — customer must message first'
              : msg.meta.error_code === 131026
              ? '⚠️ Message not delivered — phone not on WhatsApp'
              : `✕ Failed (${msg.meta.error_code}): ${msg.meta.error_msg || 'Unknown error'}`}
          </p>
        )}
      </div>
    </div>
  )
}

function ConversationItem({ conv, active, onClick, unread }) {
  const status = STATUS_CONFIG[conv.status]
  const lastMsg = conv.last_message
  const contact = conv.contacts

  return (
    <button onClick={onClick} className={clsx(
      'w-full text-left px-3 py-3 border-b border-slate-200/50 hover:bg-slate-50 transition-colors',
      active && 'bg-blue-50/20 border-l-2 border-l-brand-500'
    )}>
      <div className="flex items-start gap-3">
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-[#F8FAFC] flex items-center justify-center text-sm font-bold text-slate-700">
            {contact?.name?.[0]?.toUpperCase() || contact?.phone?.[0] || '?'}
          </div>
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <p className="text-sm font-medium text-slate-900 truncate">{contact?.name || contact?.phone}</p>
            <span className="text-[10px] text-slate-500 flex-shrink-0 ml-2">
              {lastMsg ? formatTime(lastMsg.created_at) : ''}
            </span>
          </div>
          <p className="text-xs text-slate-500 truncate">
            {lastMsg?.direction === 'outbound' && '↗ '}
            {lastMsg?.content || 'No messages yet'}
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={clsx('text-[10px] px-1.5 py-0.5 rounded', status.bg, status.color)}>{status.label}</span>
            {conv.priority !== 'normal' && (
              <span className={clsx('text-[10px]', PRIORITY_CONFIG[conv.priority]?.color)}>
                {conv.priority === 'urgent' ? '🔴' : conv.priority === 'high' ? '🟠' : ''}
              </span>
            )}
            {conv.assigned_user && (
              <span className="text-[10px] text-slate-600">@{conv.assigned_user.name?.split(' ')[0]}</span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

export default function ChatPage() {
  useRequireAuth()
  const { user } = useAuthStore()

  // State
  const [conversations, setConversations] = useState([])
  const [activeConv, setActiveConv] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchQ, setSearchQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('open')
  const [showQuickReplies, setShowQuickReplies] = useState(false)
  const [quickReplies, setQuickReplies] = useState([])
  const [showEmoji, setShowEmoji] = useState(false)
  const [instances, setInstances] = useState([])
  const [selectedInstance, setSelectedInstance] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [teamMembers, setTeamMembers] = useState([])
  const [unreadCounts, setUnreadCounts] = useState({})

  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)
  const realtimeRef = useRef(null)

  // Load initial data
  useEffect(() => {
    Promise.all([
      loadConversations(),
      axios.get('/api/whatsapp/instances').then(r => setInstances((r.data.instances || []).filter(i => i.status === 'connected'))),
      axios.get('/api/quick-replies').then(r => setQuickReplies(r.data.replies || [])),
      axios.get('/api/team').then(r => setTeamMembers(r.data.members || [])).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel('inbox-realtime')
      // Listen for new messages (INSERT)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const newMsg = payload.new
        setMessages(prev => {
          if (activeConv && newMsg.contact_id === activeConv.contact_id) {
            // Skip if already in list (by id or wa_message_id)
            if (prev.find(m => m.id === newMsg.id)) return prev
            if (newMsg.wa_message_id && prev.find(m => m.wa_message_id === newMsg.wa_message_id)) return prev
            // Replace temp message if same wa_message_id
            const hasTempWithSameWaId = prev.find(m =>
              m.id?.startsWith('temp-') && m.wa_message_id === newMsg.wa_message_id
            )
            if (hasTempWithSameWaId) {
              return prev.map(m => m.wa_message_id === newMsg.wa_message_id ? newMsg : m)
            }
            // For outbound messages from realtime, skip if we already have a temp
            if (newMsg.direction === 'outbound') {
              const hasTempOutbound = prev.find(m => m.id?.startsWith('temp-') && m.content === newMsg.content)
              if (hasTempOutbound) {
                return prev.map(m => (m.id?.startsWith('temp-') && m.content === newMsg.content) ? newMsg : m)
              }
            }
            return [...prev, newMsg]
          }
          return prev
        })
        if (newMsg.direction === 'inbound') {
          setUnreadCounts(prev => ({
            ...prev,
            [newMsg.contact_id]: (prev[newMsg.contact_id] || 0) + 1,
          }))
          setConversations(prev => prev.map(c =>
            c.contact_id === newMsg.contact_id
              ? { ...c, last_message: newMsg, last_message_at: newMsg.created_at }
              : c
          ).sort((a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()))
        }
      })
      // Listen for status updates (UPDATE) — fixes Waiting → Sent/Delivered/Read
      // Note: no filter on UPDATE — Supabase realtime filter only fully works on INSERT
      // We filter client-side instead
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
      }, (payload) => {
        const updated = payload.new
        // Only update if this message belongs to current user
        if (updated.user_id !== user?.id) return
        setMessages(prev => prev.map(m =>
          m.id === updated.id ? { ...m, status: updated.status } : m
        ))
      })
      .subscribe()

    realtimeRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, activeConv?.contact_id])

  // Poll for message status updates every 4 seconds
  useEffect(() => {
    if (!activeConv?.contact_id) return
    const interval = setInterval(async () => {
      try {
        // Get pending messages that need status updates
        const pendingIds = messages
          .filter(m => m.direction === 'outbound' && (m.status === 'pending' || m.status === 'sending' || m.status === 'waiting' || m.status === 'sent'))
          .map(m => m.id)
          .filter(Boolean)

        if (!pendingIds.length) return

        const { data } = await axios.get('/api/whatsapp/messages', {
          params: { contact_id: activeConv.contact_id, limit: 50 }
        })
        const fresh = data?.messages || []
        if (!fresh.length) return

        setMessages(prev => prev.map(msg => {
          if (!pendingIds.includes(msg.id)) return msg
          const updated = fresh.find(f =>
            f.id === msg.id ||
            (f.wa_message_id && f.wa_message_id === msg.wa_message_id)
          )
          if (updated && updated.status !== msg.status) {
            return { ...msg, status: updated.status }
          }
          return msg
        }))
      } catch {}
    }, 4000)
    return () => clearInterval(interval)
  }, [activeConv?.contact_id, messages])

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadConversations = async () => {
    try {
      const { data } = await axios.get('/api/inbox', { params: { status: statusFilter } })
      setConversations(data.conversations || [])
    } catch {}
  }

  useEffect(() => { loadConversations() }, [statusFilter])

  const openConversation = async (conv) => {
    setActiveConv(conv)
    setShowDetails(false)
    // Clear unread
    setUnreadCounts(prev => ({ ...prev, [conv.contact_id]: 0 }))
    // Load messages
    try {
      const { data } = await axios.get('/api/whatsapp/messages', { params: { contact_id: conv.contact_id, limit: 50, _t: Date.now() } })
      setMessages(data.messages || [])
    } catch {}
  }

  const sendMessage = async () => {
    if (!text.trim() || !activeConv || sending) return
    setSending(true)
    const msgText = text.trim()
    setText('')

    // Optimistic update
    const tempMsg = { id: 'temp-' + Date.now(), direction: 'outbound', content: msgText, status: 'sending', created_at: new Date().toISOString(), type: 'text' }
    setMessages(prev => [...prev, tempMsg])

    try {
      const instance = instances.find(i => i.id === selectedInstance) || instances[0]
      if (!instance) { toast.error('No WhatsApp instance connected'); return }

      const sendResp = await axios.post('/api/whatsapp/chat-send', {
        instance_id: instance.id,
        to: activeConv.contacts?.phone,
        text: msgText,
        contact_id: activeConv.contacts?.id,
      })

      // Replace temp message with sent status + real wa_message_id
      const waId = sendResp.data?.wa_message_id
      setMessages(prev => prev.map(m =>
        m.id === tempMsg.id
          ? { ...m, status: 'sent', wa_message_id: waId }
          : m
      ))

      // Update conversation last message
      setConversations(prev => prev.map(c =>
        c.id === activeConv.id ? { ...c, last_message: { content: msgText, direction: 'outbound', created_at: new Date().toISOString() } } : c
      ))
    } catch (e: any) {
      const data = e?.response?.data
      if (data?.outside_window) {
        // Remove the optimistic message and show inline warning
        setMessages(prev => prev.map(m => m.id === tempMsg.id 
          ? { ...m, status: 'failed', _windowWarning: true }
          : m
        ))
        setWindowWarning('outside')
      } else {
        setMessages(prev => prev.map(m => m.id === tempMsg.id ? { ...m, status: 'failed' } : m))
        toast.error(data?.error || 'Send failed')
        setText(msgText)
      }
    } finally { setSending(false) }
  }

  const updateConversation = async (updates) => {
    if (!activeConv) return
    try {
      const { data } = await axios.put(`/api/inbox/${activeConv.id}`, updates)
      setActiveConv(prev => ({ ...prev, ...data.conversation }))
      setConversations(prev => prev.map(c => c.id === activeConv.id ? { ...c, ...data.conversation } : c))
      toast.success('Updated')
    } catch { toast.error('Failed') }
  }

  const filteredConvs = conversations.filter(c => {
    if (!searchQ) return true
    const q = searchQ.toLowerCase()
    return c.contacts?.name?.toLowerCase().includes(q) || c.contacts?.phone?.includes(q)
  })

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <DashboardLayout title="Inbox">
      <div className="flex h-[calc(100vh-56px)] bg-[#F8FAFC] overflow-hidden -m-6">
        <div className="flex flex-1 overflow-hidden">

          {/* Conversations List */}
          <div className={clsx('flex flex-col bg-white border-r border-slate-200 flex-shrink-0', activeConv ? 'hidden md:flex w-80' : 'flex w-full md:w-80')}>
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-bold text-slate-900">Inbox</h2>
                <div className="flex gap-1">
                  <button onClick={loadConversations} className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-[#F8FAFC]">
                    <ArrowPathIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="relative mb-3">
                <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                  placeholder="Search conversations..." className="input pl-9 py-2 text-sm" />
              </div>

              {/* Status tabs */}
              <div className="flex gap-1">
                {Object.entries(STATUS_CONFIG).map(([s, config]) => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={clsx('flex-1 text-xs py-1.5 rounded-lg transition-colors font-medium',
                      statusFilter === s ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-white hover:bg-[#F8FAFC]')}>
                    {config.icon}
                  </button>
                ))}
                <button onClick={() => setStatusFilter('all')}
                  className={clsx('flex-1 text-xs py-1.5 rounded-lg transition-colors font-medium',
                    statusFilter === 'all' ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-white hover:bg-[#F8FAFC]')}>
                  All
                </button>
              </div>
            </div>

            {/* Instance selector */}
            {instances.length > 1 && (
              <div className="px-3 py-2 border-b border-slate-200">
                <select value={selectedInstance} onChange={e => setSelectedInstance(e.target.value)} className="input text-xs py-1.5">
                  <option value="">All instances</option>
                  {instances.map(i => <option key={i.id} value={i.id}>{i.display_name || i.phone_number}</option>)}
                </select>
              </div>
            )}

            {/* Conversations */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-4 space-y-3">
                  {[1,2,3,4,5].map(i => <div key={i} className="skeleton h-16 rounded-lg" />)}
                </div>
              ) : filteredConvs.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-slate-500 text-sm">No conversations</p>
                  <p className="text-slate-600 text-xs mt-1">Messages will appear here</p>
                </div>
              ) : filteredConvs.map(conv => (
                <ConversationItem
                  key={conv.id}
                  conv={conv}
                  active={activeConv?.id === conv.id}
                  unread={unreadCounts[conv.contact_id] || 0}
                  onClick={() => openConversation(conv)}
                />
              ))}
            </div>
          </div>

          {/* Chat Area */}
          {activeConv ? (
            <div className="flex flex-1 overflow-hidden">
              <div className="flex flex-col flex-1 overflow-hidden">
                {/* Chat Header */}
                <div className="h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3 flex-shrink-0">
                  <button onClick={() => setActiveConv(null)} className="md:hidden text-slate-400 hover:text-slate-900 mr-1">
                    ←
                  </button>
                  <div className="w-9 h-9 rounded-full bg-[#F8FAFC] flex items-center justify-center font-bold text-slate-700">
                    {activeConv.contacts?.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 text-sm truncate">{activeConv.contacts?.name || activeConv.contacts?.phone}</p>
                    <p className="text-xs text-slate-500">{activeConv.contacts?.phone}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Status badge */}
                    <select value={activeConv.status} onChange={e => updateConversation({ status: e.target.value })}
                      className={clsx('text-xs px-2 py-1 rounded-lg border-0 cursor-pointer', STATUS_CONFIG[activeConv.status]?.bg, STATUS_CONFIG[activeConv.status]?.color)}>
                      {Object.entries(STATUS_CONFIG).map(([s, c]) => <option key={s} value={s}>{c.icon} {c.label}</option>)}
                    </select>
                    <button onClick={() => setShowDetails(v => !v)} className="p-2 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-[#F8FAFC]">
                      <EllipsisVerticalIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-1.5" style={{ backgroundColor: '#F8FAFC' }}>
                  {messages.length === 0 ? (
                    <div className="text-center py-16 text-slate-500 text-sm">No messages yet</div>
                  ) : messages.map((msg, idx) => {
                    const prevMsg = messages[idx - 1]
                    const showAvatar = !prevMsg || prevMsg.direction !== msg.direction
                    return <MessageBubble key={msg.id} msg={msg} showAvatar={showAvatar} />
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="bg-white border-t border-slate-200 p-3">
                  {/* Quick replies popup */}
                  {showQuickReplies && quickReplies.length > 0 && (
                    <div className="mb-2 bg-[#F8FAFC] border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                      {quickReplies.filter(r => !text || r.title.toLowerCase().includes(text.toLowerCase()) || r.message.toLowerCase().includes(text.toLowerCase())).map(reply => (
                        <button key={reply.id} onClick={() => { setText(reply.message); setShowQuickReplies(false); textareaRef.current?.focus() }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-200/50 last:border-0">
                          <p className="text-sm font-medium text-slate-900">{reply.title}</p>
                          <p className="text-xs text-slate-500 truncate">{reply.message}</p>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Emoji picker */}
                  {showEmoji && (
                    <div className="mb-2 flex gap-1.5 flex-wrap p-2 bg-[#F8FAFC] border border-slate-200 rounded-xl">
                      {EMOJIS.map(e => (
                        <button key={e} onClick={() => { setText(t => t + e); setShowEmoji(false) }}
                          className="text-xl hover:scale-125 transition-transform">{e}</button>
                      ))}
                    </div>
                  )}

                  <div className="flex items-end gap-2">
                    <button onClick={() => { setShowEmoji(v => !v); setShowQuickReplies(false) }}
                      className="p-2 text-slate-400 hover:text-slate-900 flex-shrink-0">
                      <FaceSmileIcon className="w-5 h-5" />
                    </button>
                    <button onClick={() => { setShowQuickReplies(v => !v); setShowEmoji(false) }}
                      className="p-2 text-slate-400 hover:text-slate-900 flex-shrink-0" title="Quick Replies">
                      <BoltIcon className="w-5 h-5" />
                    </button>
                    <textarea
                      ref={textareaRef}
                      value={text}
                      onChange={e => setText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                      rows={1}
                      style={{ resize: 'none', maxHeight: '120px' }}
                      className="flex-1 bg-[#F8FAFC] border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-700 transition-colors"
                      onInput={e => {
                        const t = e.target as HTMLTextAreaElement
                        t.style.height = 'auto'
                        t.style.height = Math.min(t.scrollHeight, 120) + 'px'
                      }}
                    />
                    <button onClick={sendMessage} disabled={!text.trim() || sending}
                      className="p-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex-shrink-0">
                      <PaperAirplaneIcon className="w-5 h-5 text-slate-900" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Details Panel */}
              {showDetails && (
                <div className="w-72 bg-white border-l border-slate-200 flex-shrink-0 overflow-y-auto">
                  <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900 text-sm">Details</h3>
                    <button onClick={() => setShowDetails(false)} className="text-slate-400 hover:text-slate-900">
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="p-4 space-y-4">
                    {/* Contact info */}
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Contact</p>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-full bg-[#F8FAFC] flex items-center justify-center text-lg font-bold text-slate-700">
                          {activeConv.contacts?.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{activeConv.contacts?.name || 'Unknown'}</p>
                          <p className="text-xs text-slate-500">{activeConv.contacts?.phone}</p>
                        </div>
                      </div>
                    </div>

                    {/* Assign */}
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Assigned To</p>
                      <select value={activeConv.assigned_to || ''} onChange={e => updateConversation({ assigned_to: e.target.value || null })} className="input text-sm py-2">
                        <option value="">Unassigned</option>
                        <option value={user?.id}>Me</option>
                        {teamMembers.filter(m => m.status === 'active').map(m => (
                          <option key={m.id} value={m.user_id}>{m.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Priority */}
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Priority</p>
                      <select value={activeConv.priority || 'normal'} onChange={e => updateConversation({ priority: e.target.value })} className="input text-sm py-2">
                        {Object.entries(PRIORITY_CONFIG).map(([p, c]) => (
                          <option key={p} value={p}>{c.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Notes */}
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Notes</p>
                      <textarea value={activeConv.notes || ''} onChange={e => setActiveConv(p => ({ ...p, notes: e.target.value }))}
                        onBlur={() => updateConversation({ notes: activeConv.notes })}
                        placeholder="Add internal notes..."
                        rows={3} className="input text-sm resize-none" />
                    </div>

                    {/* Actions */}
                    <div className="space-y-2">
                      <button onClick={() => updateConversation({ status: 'resolved' })}
                        className="btn-secondary w-full justify-center text-sm py-2 text-blue-600">
                        <CheckCircleIcon className="w-4 h-4" /> Mark Resolved
                      </button>
                      <button onClick={() => updateConversation({ status: 'spam' })}
                        className="btn-secondary w-full justify-center text-sm py-2 text-red-400">
                        <ArchiveBoxIcon className="w-4 h-4" /> Mark as Spam
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden md:flex flex-1 items-center justify-center bg-[#F8FAFC]">
              <div className="text-center">
                <div className="w-20 h-20 bg-blue-50 border-2 border-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.96 9.96 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/>
                  </svg>
                </div>
                <h3 className="font-display font-bold text-xl text-slate-900 mb-2">Select a conversation</h3>
                <p className="text-slate-500 text-sm">Choose from the left to start chatting</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
