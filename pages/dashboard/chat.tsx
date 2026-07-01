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

function formatBytes(bytes) {
  if (!bytes) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++ }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

function docIconFor(mime, filename) {
  const ext = (filename || '').split('.').pop()?.toLowerCase() || ''
  if (mime?.includes('pdf') || ext === 'pdf') return '📄'
  if (mime?.includes('word') || ['doc', 'docx'].includes(ext)) return '📝'
  if (mime?.includes('sheet') || mime?.includes('excel') || ['xls', 'xlsx'].includes(ext)) return '📊'
  if (mime?.includes('zip') || mime?.includes('compressed') || ['zip', 'rar', '7z'].includes(ext)) return '🗜️'
  if (mime?.includes('presentation') || ['ppt', 'pptx'].includes(ext)) return '📑'
  return '📎'
}

// Renders the media portion of a message bubble (image/video/audio/ptt/
// document/sticker). Returns null for plain text — caller still renders
// msg.content as a caption underneath when present. Fully isolated: any
// unrecognized/missing media_url silently falls back to showing nothing
// extra, the text content below still renders normally.
function MediaBubbleContent({ msg }) {
  if (!msg.media_url) return null

  switch (msg.type) {
    case 'image':
      return (
        <a href={msg.media_url} target="_blank" rel="noopener noreferrer">
          <img src={msg.media_url} alt="image" className="rounded-lg mb-1 max-w-64 max-h-64 object-cover" />
        </a>
      )
    case 'sticker':
      return <img src={msg.media_url} alt="sticker" className="w-32 h-32 mb-1" />
    case 'video':
      return (
        <video src={msg.media_url} controls className="rounded-lg mb-1 max-w-64 max-h-64" />
      )
    case 'ptt':
      return (
        <div className="flex items-center gap-2 mb-1 min-w-[200px]">
          <span className="text-lg">🎤</span>
          <audio src={msg.media_url} controls className="h-9 max-w-[220px]" />
        </div>
      )
    case 'audio':
      return (
        <div className="flex items-center gap-2 mb-1 min-w-[200px]">
          <span className="text-lg">🎵</span>
          <audio src={msg.media_url} controls className="h-9 max-w-[220px]" />
        </div>
      )
    case 'document':
      return (
        <a href={msg.media_url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 mb-1 bg-black/5 rounded-lg px-3 py-2 hover:bg-black/10 transition-colors min-w-[200px]">
          <span className="text-2xl flex-shrink-0">{docIconFor(msg.media_mime_type, msg.media_filename)}</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium truncate">{msg.media_filename || 'Document'}</p>
            <p className="text-[10px] opacity-60">Open / Download</p>
          </div>
        </a>
      )
    default:
      return null
  }
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
          <MediaBubbleContent msg={msg} />
          {msg.content && !(msg.media_url && /^\[(image|video|audio|document|sticker|ptt)\]$/.test(msg.content)) && (
            <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
          )}
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

function ConversationItem({ conv, active, onClick, unread, showInboxBadge = false }) {
  const status = STATUS_CONFIG[conv.status]
  const lastMsg = conv.last_message
  const contact = conv.contacts
  const inbox = conv.whatsapp_instances

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
            {/* Inbox badge — shown in All Inboxes view so you know which number */}
            {showInboxBadge && inbox && (
              <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded truncate max-w-[80px]">
                📱 {inbox.display_name || inbox.phone_number}
              </span>
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
  const activeConvRef = useRef(null)  // keeps realtime handler in sync without re-subscribing
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [attachment, setAttachment] = useState(null) // { file, previewUrl, type, caption }
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const fileInputRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [searchQ, setSearchQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('open')
  const [showQuickReplies, setShowQuickReplies] = useState(false)
  const [quickReplies, setQuickReplies] = useState([])
  const [showEmoji, setShowEmoji] = useState(false)
  const [instances, setInstances] = useState([])
  const [inboxes, setInboxes] = useState([])          // accessible inboxes for selector
  const [canSeeAll, setCanSeeAll] = useState(true)    // owner = true
  const [selectedInbox, setSelectedInbox] = useState<string | null>(null) // null = All Inboxes
  const [selectedInstance, setSelectedInstance] = useState('')  // for send path (backward-compat)
  const [showDetails, setShowDetails] = useState(false)
  const [teamMembers, setTeamMembers] = useState([])
  const [unreadCounts, setUnreadCounts] = useState({})

  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)
  const realtimeRef = useRef(null)

  // Load accessible inboxes + last selected
  const loadInboxes = async (currentStatus?: string) => {
    try {
      const { data } = await axios.get('/api/inbox/inboxes')
      const inboxList = data.inboxes || []
      setInboxes(inboxList)
      setCanSeeAll(data.can_see_all ?? true)

      // Resolve which inbox to select
      const lastId = data.last_inbox_id || localStorage.getItem('last_inbox_id')
      let resolvedInbox: string | null = null
      if (lastId && inboxList.find((i: any) => i.id === lastId)) {
        resolvedInbox = lastId
      } else if (!data.can_see_all && inboxList.length > 0) {
        resolvedInbox = inboxList[0].id
      }

      setSelectedInbox(resolvedInbox)
      if (resolvedInbox) setSelectedInstance(resolvedInbox)
      else if (inboxList.length === 1) setSelectedInstance(inboxList[0].id)

      // Load conversations immediately with resolved inbox (fixes race condition
      // where useEffect[selectedInbox] fires before setSelectedInbox propagates)
      const params: Record<string, string> = { status: currentStatus || statusFilter }
      if (resolvedInbox) params.instance_id = resolvedInbox
      else if (data.can_see_all) params.instance_id = 'all'
      const { data: convData } = await axios.get('/api/inbox', { params })
      setConversations(convData.conversations || [])
    } catch {}
  }

  const switchInbox = async (inboxId: string | null) => {
    setSelectedInbox(inboxId)
    setActiveConv(null)
    setMessages([])
    if (inboxId) {
      setSelectedInstance(inboxId)
      localStorage.setItem('last_inbox_id', inboxId)
    } else {
      localStorage.removeItem('last_inbox_id')
    }
    axios.post('/api/inbox/set-last-inbox', { inbox_id: inboxId }).catch(() => {})
    // Load conversations for the newly selected inbox immediately
    // (pass inboxId directly — don't rely on selectedInbox state which hasn't updated yet)
    loadConversations(inboxId)
  }

  // Load initial data
  useEffect(() => {
    Promise.all([
      loadInboxes(), // also loads conversations with correct inbox (no race condition)
      axios.get('/api/whatsapp/instances').then(r => setInstances((r.data.instances || []).filter((i: any) => i.status === 'connected'))),
      axios.get('/api/quick-replies').then(r => setQuickReplies(r.data.replies || [])),
      axios.get('/api/team').then(r => setTeamMembers(r.data.members || [])).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  // Keep ref in sync so realtime handler always reads current value
  useEffect(() => { activeConvRef.current = activeConv }, [activeConv])
  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel('inbox-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        // No server-side filter — filter client-side to avoid RLS/publication issues
        // (server filter requires exact column match; client filter is more reliable)
      }, (payload) => {
        const newMsg = payload.new
        // Client-side filter: only handle messages belonging to this user
        if (newMsg.user_id !== user.id) return
        const conv = activeConvRef.current  // always current — no stale closure

        // ── Add to open conversation ──────────────────────────
        if (conv && newMsg.contact_id === conv.contact_id) {
          setMessages(prev => {
            if (prev.find(m => m.id === newMsg.id)) return prev
            if (newMsg.wa_message_id && prev.find(m => m.wa_message_id === newMsg.wa_message_id)) return prev
            const hasTempWaId = prev.find(m => m.id?.startsWith('temp-') && m.wa_message_id === newMsg.wa_message_id)
            if (hasTempWaId) return prev.map(m => m.wa_message_id === newMsg.wa_message_id ? newMsg : m)
            if (newMsg.direction === 'outbound') {
              const hasTempOut = prev.find(m => m.id?.startsWith('temp-') && m.content === newMsg.content)
              if (hasTempOut) return prev.map(m => (m.id?.startsWith('temp-') && m.content === newMsg.content) ? newMsg : m)
            }
            return [...prev, newMsg]
          })
        }

        // ── Update conversations list ─────────────────────────
        if (newMsg.direction === 'inbound') {
          setUnreadCounts(prev => ({
            ...prev,
            [newMsg.contact_id]: (prev[newMsg.contact_id] || 0) + 1,
          }))
          setConversations(prev => {
            const exists = prev.find(c =>
              c.contact_id === newMsg.contact_id &&
              (!newMsg.instance_id || c.instance_id === newMsg.instance_id)
            )
            if (exists) {
              return prev
                .map(c => c.contact_id === newMsg.contact_id &&
                  (!newMsg.instance_id || c.instance_id === newMsg.instance_id)
                    ? { ...c, last_message: newMsg, last_message_at: newMsg.created_at }
                    : c
                )
                .sort((a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime())
            }
            // New contact — reload conversations to get full contact details
            setTimeout(() => loadConversations(newMsg.instance_id || null), 300)
            return prev
          })
          if (newMsg.instance_id) {
            setInboxes(prev => prev.map((inbox: any) =>
              inbox.id === newMsg.instance_id
                ? { ...inbox, unread: (inbox.unread || 0) + 1 }
                : inbox
            ))
          }
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
      }, (payload) => {
        const updated = payload.new
        if (updated.user_id !== user?.id) return
        setMessages(prev => prev.map(m =>
          m.id === updated.id ? { ...m, status: updated.status } : m
        ))
      })
      .subscribe((status) => {
        console.log('[realtime] subscription:', status)
      })

    realtimeRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [user?.id])  // ← no activeConv dep — using ref to avoid stale closure

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

  const loadConversations = async (inboxId?: string | null, status?: string) => {
    try {
      const resolvedInbox = inboxId !== undefined ? inboxId : selectedInbox
      const resolvedStatus = status || statusFilter
      const params: Record<string, string> = { status: resolvedStatus }
      if (resolvedInbox) params.instance_id = resolvedInbox
      else if (canSeeAll) params.instance_id = 'all'
      const { data } = await axios.get('/api/inbox', { params })
      setConversations(data.conversations || [])
    } catch {}
  }

  // Reload when status filter changes (inbox is handled inside loadInboxes on mount,
  // and by switchInbox on user selection — this handles only statusFilter changes)
  useEffect(() => { loadConversations(selectedInbox, statusFilter) }, [statusFilter])

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

  // ── Attachments (isolated from the text sendMessage flow above) ──────────
  function mimeToWaType(mime) {
    if (!mime) return 'document'
    if (mime.startsWith('image/')) return 'image'
    if (mime.startsWith('video/')) return 'video'
    if (mime.startsWith('audio/')) return mime.includes('ogg') ? 'ptt' : 'audio'
    return 'document'
  }

  const pickAttachment = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 16 * 1024 * 1024) { toast.error('File too large (max 16MB)'); return }
    const previewUrl = file.type.startsWith('image/') || file.type.startsWith('video/')
      ? URL.createObjectURL(file) : null
    setAttachment({ file, previewUrl, type: mimeToWaType(file.type), caption: '' })
    e.target.value = '' // allow picking the same file again later
  }

  const cancelAttachment = () => {
    if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl)
    setAttachment(null)
  }

  const sendAttachment = async () => {
    if (!attachment || !activeConv || uploadingAttachment) return
    setUploadingAttachment(true)

    try {
      const instance = instances.find(i => i.id === selectedInstance) || instances[0]
      if (!instance) { toast.error('No WhatsApp instance connected'); return }

      // 1. Upload to our storage
      const formData = new FormData()
      formData.append('file', attachment.file)
      const uploadResp = await axios.post('/api/whatsapp/chat-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const { url, mimeType, filename } = uploadResp.data

      // Optimistic bubble
      const tempMsg = {
        id: 'temp-' + Date.now(), direction: 'outbound', content: attachment.caption,
        status: 'sending', created_at: new Date().toISOString(),
        type: attachment.type, media_url: url, media_mime_type: mimeType, media_filename: filename,
      }
      setMessages(prev => [...prev, tempMsg])
      const sentCaption = attachment.caption
      cancelAttachment()

      // 2. Send via existing chat-send endpoint (media branch)
      const sendResp = await axios.post('/api/whatsapp/chat-send', {
        instance_id: instance.id,
        to: activeConv.contacts?.phone,
        text: sentCaption || undefined,
        media_url: url,
        media_type: attachment.type,
        media_mime_type: mimeType,
        media_filename: filename,
        contact_id: activeConv.contacts?.id,
      })

      const waId = sendResp.data?.wa_message_id
      setMessages(prev => prev.map(m => m.id === tempMsg.id ? { ...m, status: 'sent', wa_message_id: waId } : m))
      setConversations(prev => prev.map(c =>
        c.id === activeConv.id ? { ...c, last_message: { content: sentCaption || `[${attachment.type}]`, direction: 'outbound', created_at: new Date().toISOString() } } : c
      ))
    } catch (e: any) {
      const data = e?.response?.data
      if (data?.outside_window) {
        setMessages(prev => prev.map(m => m.status === 'sending' ? { ...m, status: 'failed', _windowWarning: true } : m))
        setWindowWarning('outside')
      } else {
        setMessages(prev => prev.map(m => m.status === 'sending' ? { ...m, status: 'failed' } : m))
        toast.error(data?.error || 'Attachment send failed')
      }
    } finally { setUploadingAttachment(false) }
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

              {/* Inbox Selector — shown only when multiple inboxes exist */}
              {inboxes.length > 1 && (
                <div className="mb-3">
                  <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1">
                    {canSeeAll && (
                      <button
                        onClick={() => switchInbox(null)}
                        className={clsx(
                          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left w-full',
                          selectedInbox === null
                            ? 'bg-brand-500 text-white'
                            : 'text-slate-600 hover:bg-[#F8FAFC]'
                        )}
                      >
                        <span className="text-base">📥</span>
                        <span className="flex-1 truncate">All Inboxes</span>
                        {Object.values(unreadCounts as Record<string, number>).reduce((a, b) => a + b, 0) > 0 && selectedInbox !== null && (
                          <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 flex-shrink-0">
                            {Object.values(unreadCounts as Record<string, number>).reduce((a, b) => a + b, 0)}
                          </span>
                        )}
                      </button>
                    )}
                    {inboxes.map((inbox: any) => {
                        return (
                        <button
                          key={inbox.id}
                          onClick={() => switchInbox(inbox.id)}
                          className={clsx(
                            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left w-full',
                            selectedInbox === inbox.id
                              ? 'bg-brand-500 text-white'
                              : 'text-slate-600 hover:bg-[#F8FAFC]'
                          )}
                        >
                          <img
                            src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg"
                            alt="WhatsApp"
                            className="w-4 h-4 flex-shrink-0"
                          />
                          <span className="flex-1 truncate">{inbox.name}</span>
                          {inbox.unread > 0 && (
                            <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 flex-shrink-0">
                              {inbox.unread}
                            </span>
                          )}
                        </button>
                        )
                      })}
                  </div>
                </div>
              )}

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
                  showInboxBadge={selectedInbox === null && inboxes.length > 1}
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

                  {/* Attachment preview */}
                {attachment && (
                  <div className="mb-2 bg-[#F8FAFC] border border-slate-200 rounded-xl p-3">
                    <div className="flex items-start gap-3">
                      {attachment.previewUrl && attachment.type === 'image' && (
                        <img src={attachment.previewUrl} alt="preview" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                      )}
                      {attachment.previewUrl && attachment.type === 'video' && (
                        <video src={attachment.previewUrl} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                      )}
                      {!attachment.previewUrl && (
                        <div className="w-16 h-16 rounded-lg bg-slate-200 flex items-center justify-center text-2xl flex-shrink-0">
                          {attachment.type === 'audio' || attachment.type === 'ptt' ? '🎵' : '📎'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{attachment.file.name}</p>
                        <p className="text-xs text-slate-500">{(attachment.file.size / 1024).toFixed(0)} KB</p>
                        <input
                          value={attachment.caption}
                          onChange={e => setAttachment(a => ({ ...a, caption: e.target.value }))}
                          placeholder="Add a caption (optional)…"
                          className="mt-1.5 w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-brand-700"
                        />
                      </div>
                      <button onClick={cancelAttachment} className="p-1 text-slate-400 hover:text-slate-900 flex-shrink-0">
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>
                    <button onClick={sendAttachment} disabled={uploadingAttachment}
                      className="btn-primary text-xs w-full justify-center mt-2 py-2">
                      {uploadingAttachment ? <><ArrowPathIcon className="w-4 h-4 animate-spin" /> Sending…</> : <>📤 Send {attachment.type}</>}
                    </button>
                  </div>
                )}

                <div className="flex items-end gap-2">
                    <input ref={fileInputRef} type="file" className="hidden" onChange={pickAttachment}
                      accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.ppt,.pptx" />
                    <button onClick={() => fileInputRef.current?.click()}
                      className="p-2 text-slate-400 hover:text-slate-900 flex-shrink-0" title="Attach file">
                      <PaperClipIcon className="w-5 h-5" />
                    </button>
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
