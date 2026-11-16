import React, { useState, useEffect, useRef, useMemo } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  ArrowLeftIcon, UserCircleIcon, ChatBubbleLeftRightIcon, ClockIcon, CheckBadgeIcon, InformationCircleIcon,
} from '@heroicons/react/24/outline'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Avatar, Button, Select, Skeleton, Tooltip } from '@/components/ui'
import { cn } from '@/components/ui/utils'
import { useAuthStore } from '@/lib/store'
import { useRouter } from 'next/router'
import { useRequireAuth } from '@/hooks/useAuth'
import { useT } from '@/lib/i18n-local'
import inboxMessages from '@/locales/dashboard/inbox'
import { ConversationList, STATUS_KEYS } from '@/components/inbox/ConversationList'
import type { AssignFilter } from '@/components/inbox/ConversationList'
import { MessageBubble } from '@/components/inbox/MessageBubble'
import { Composer } from '@/components/inbox/Composer'
import { CustomerPanel } from '@/components/inbox/CustomerPanel'
import { TemplatesModal, type InboxTemplate, type TemplateParams } from '@/components/inbox/TemplatesModal'
import { apiErrorText, dayLabel, isAiMessage, windowState } from '@/components/inbox/utils'

/** ≥1280px: the customer panel sits beside the thread instead of over it. */
function useIsWide() {
  const [wide, setWide] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)')
    const on = () => setWide(mq.matches)
    on()
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return wide
}

export default function ChatPage() {
  useRequireAuth()
  const { user } = useAuthStore()
  const { t, lang, locale } = useT(inboxMessages)
  const isWide = useIsWide()

  // State
  const [conversations, setConversations] = useState<any[]>([])
  const [activeConv, setActiveConv] = useState<any>(null)
  const activeConvRef = useRef<any>(null)  // keeps realtime handler in sync without re-subscribing
  const [messages, setMessages] = useState<any[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [attachment, setAttachment] = useState<any>(null) // { file, previewUrl, type, caption }
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [searchQ, setSearchQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('open')
  const [assignFilter, setAssignFilter] = useState<AssignFilter>('all')
  const [showQuickReplies, setShowQuickReplies] = useState(false)
  const [quickReplies, setQuickReplies] = useState<any[]>([])
  const [showEmoji, setShowEmoji] = useState(false)
  const [instances, setInstances] = useState<any[]>([])
  const [inboxes, setInboxes] = useState<any[]>([])          // accessible inboxes for selector
  const [canSeeAll, setCanSeeAll] = useState(true)    // owner = true
  const [selectedInbox, setSelectedInbox] = useState<string | null>(null) // null = All Inboxes
  const [selectedInstance, setSelectedInstance] = useState('')  // for send path (backward-compat)
  const [showDetails, setShowDetails] = useState(false)
  // Large screens open the customer panel by default (true three-pane view).
  useEffect(() => { if (window.matchMedia('(min-width: 1536px)').matches) setShowDetails(true) }, [])
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [windowWarning, setWindowWarning] = useState<string | null>(null)
  const [mode, setMode] = useState<'reply' | 'note'>('reply')
  const [savingNote, setSavingNote] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [contactDetails, setContactDetails] = useState<Record<string, any>>({})
  const [contactLoading, setContactLoading] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiBlocked, setAiBlocked] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  // Deep link: /dashboard/chat?contact=<id> (e.g. "open chat" on a contact page)
  // opens that contact's conversation, or starts one when none exists yet.
  const router = useRouter()
  const deepLinkDone = useRef(false)
  useEffect(() => {
    if (loading || deepLinkDone.current || !router.isReady) return
    const raw = router.query.contact
    const contactId = typeof raw === 'string' && /^[0-9a-f-]{36}$/i.test(raw) ? raw : null
    if (!contactId) return
    deepLinkDone.current = true
    ;(async () => {
      try {
        const known = conversations.find(cv => cv.contact_id === contactId)
        if (known) { openConversation(known); return }
        const { data } = await axios.get('/api/inbox', { params: { status: 'all', contact_id: contactId, ...(canSeeAll ? { instance_id: 'all' } : {}) } })
        const found = (data?.conversations || [])[0]
        if (found) {
          setConversations(prev => (prev.some(cv => cv.id === found.id) ? prev : [found, ...prev]))
          openConversation(found)
          return
        }
        // No conversation yet: open an empty thread for the contact.
        const { data: cd } = await axios.get(`/api/contacts/${contactId}`)
        const contact = cd?.contact
        if (!contact) return
        openConversation({
          id: null, contact_id: contact.id, instance_id: selectedInstance || instances[0]?.id || null, status: 'open',
          contacts: { id: contact.id, name: contact.name, phone: contact.phone, tags: contact.tags },
        })
      } catch { /* invalid or inaccessible contact: stay on the list */ }
    })()
  }, [loading, router.isReady, router.query.contact])

  // Keep ref in sync so realtime handler always reads current value
  useEffect(() => { activeConvRef.current = activeConv }, [activeConv])
  // ── Live updates ────────────────────────────────────────────
  // Authenticated polling of /api/inbox/updates (server-scoped to this
  // account and the member's inboxes). Replaces the former anon-key Supabase
  // Realtime subscription, which received every tenant's messages.
  const seenMsgIdsRef = useRef(new Set<string>())
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    let inFlight = false
    let cursor: string | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    const seen = seenMsgIdsRef.current

    const handleNewMessage = (newMsg: any) => {
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
    }

    const schedule = () => {
      if (cancelled) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(tick, 3500)
    }

    const tick = async () => {
      if (cancelled || inFlight) return
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') { schedule(); return }
      inFlight = true
      try {
        const { data } = await axios.get('/api/inbox/updates', { params: cursor ? { after: cursor } : {} })
        if (cancelled) return
        const isFirst = cursor === null
        cursor = data?.cursor || cursor
        if (!isFirst) {
          if (seen.size > 5000) seen.clear()
          for (const m of data?.messages || []) {
            if (seen.has(m.id)) {
              // Re-delivered (overlap window) — just refresh its status
              setMessages(prev => prev.map(x => (x.id === m.id && x.status !== m.status) ? { ...x, status: m.status } : x))
              continue
            }
            seen.add(m.id)
            handleNewMessage(m)
          }
        }
      } catch {} finally {
        inFlight = false
      }
      schedule()
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !inFlight) { if (timer) clearTimeout(timer); tick() }
    }
    document.addEventListener('visibilitychange', onVisibility)
    tick()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
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
          const updated = fresh.find((f: any) =>
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
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
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

  const openConversation = async (conv: any) => {
    setActiveConv(conv)
    if (!isWide) setShowDetails(false)
    setWindowWarning(null)
    setAiSuggestion(null)
    setMode('reply')
    // Clear unread
    setUnreadCounts(prev => ({ ...prev, [conv.contact_id]: 0 }))
    // Load messages
    setMessages([])
    setLoadingMessages(true)
    try {
      const { data } = await axios.get('/api/whatsapp/messages', { params: { contact_id: conv.contact_id, limit: 50, _t: Date.now() } })
      setMessages(data.messages || [])
    } catch {} finally { setLoadingMessages(false) }
  }

  // The reply goes out from the conversation's own number when it is connected
  // (the 24-hour window belongs to that number).
  const sendingInstance = () =>
    instances.find(i => i.id === activeConv?.instance_id) || instances.find(i => i.id === selectedInstance) || instances[0]

  const sendMessage = async () => {
    if (!text.trim() || !activeConv || sending) return
    setSending(true)
    const msgText = text.trim()
    setText('')
    setAiSuggestion(null)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    // Optimistic update
    const tempMsg = { id: 'temp-' + Date.now(), direction: 'outbound', content: msgText, status: 'sending', created_at: new Date().toISOString(), type: 'text' }
    setMessages(prev => [...prev, tempMsg])

    try {
      const instance = sendingInstance()
      if (!instance) { toast.error(t('no_instance')); return }

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
        // Keep the optimistic message and show the inline warning
        setMessages(prev => prev.map(m => m.id === tempMsg.id
          ? { ...m, status: 'failed', _windowWarning: true }
          : m
        ))
        setWindowWarning('outside')
      } else {
        setMessages(prev => prev.map(m => m.id === tempMsg.id ? { ...m, status: 'failed' } : m))
        toast.error(apiErrorText(e, t, lang, 'send_failed'))
        setText(msgText)
      }
    } finally { setSending(false) }
  }

  // ── Approved template (Cloud API; reopens a conversation outside the 24h window) ──
  const sendTemplate = async (tpl: InboxTemplate, params: TemplateParams) => {
    if (!activeConv) return
    const instance = sendingInstance()
    if (!instance) { toast.error(t('no_instance')); throw new Error('no_instance') }
    try {
      const { data } = await axios.post('/api/whatsapp/chat-send', {
        instance_id: instance.id,
        to: activeConv.contacts?.phone,
        contact_id: activeConv.contacts?.id,
        template: { name: tpl.name, language: tpl.language, params },
      })
      const content = data?.content || `[${tpl.name}]`
      const now = new Date().toISOString()
      setMessages(prev => [...prev, {
        id: 'temp-' + Date.now(), direction: 'outbound', content, status: 'sent', created_at: now, type: 'text',
        wa_message_id: data?.wa_message_id, meta: { method: 'template', template: tpl.name, source: 'live_chat' },
      }])
      setConversations(prev => prev.map(cv =>
        cv.id === activeConv.id ? { ...cv, last_message: { content, direction: 'outbound', created_at: now } } : cv
      ))
      toast.success(t('tpl_sent'))
    } catch (e: any) {
      toast.error(apiErrorText(e, t, lang, 'tpl_send_failed'))
      throw e
    }
  }

  // ── Attachments (isolated from the text sendMessage flow above) ──────────
  function mimeToWaType(mime: string) {
    if (!mime) return 'document'
    if (mime.startsWith('image/')) return 'image'
    if (mime.startsWith('video/')) return 'video'
    if (mime.startsWith('audio/')) return mime.includes('ogg') ? 'ptt' : 'audio'
    return 'document'
  }

  const pickAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 16 * 1024 * 1024) { toast.error(t('file_too_large')); return }
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
      const instance = sendingInstance()
      if (!instance) { toast.error(t('no_instance')); return }

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
        c.id === activeConv.id ? { ...c, last_message: { content: sentCaption || `[${attachment.type}]`, direction: 'outbound', created_at: new Date().toISOString(), type: attachment.type } } : c
      ))
    } catch (e: any) {
      const data = e?.response?.data
      if (data?.outside_window) {
        setMessages(prev => prev.map(m => m.status === 'sending' ? { ...m, status: 'failed', _windowWarning: true } : m))
        setWindowWarning('outside')
      } else {
        setMessages(prev => prev.map(m => m.status === 'sending' ? { ...m, status: 'failed' } : m))
        toast.error(apiErrorText(e, t, lang, 'attachment_failed'))
      }
    } finally { setUploadingAttachment(false) }
  }

  const updateConversation = async (updates: Record<string, unknown>, successMsg?: string) => {
    if (!activeConv) return false
    try {
      const { data } = await axios.put(`/api/inbox/${activeConv.id}`, updates)
      setActiveConv((prev: any) => ({ ...prev, ...data.conversation }))
      setConversations(prev => prev.map(c => c.id === activeConv.id ? { ...c, ...data.conversation } : c))
      toast.success(successMsg || t('updated'))
      return true
    } catch { toast.error(t('update_failed')); return false }
  }

  // ── Internal notes (stored in the conversation's notes field) ──────────
  const addNote = async () => {
    const note = text.trim()
    if (!note || !activeConv || savingNote) return
    setSavingNote(true)
    const stamp = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
    const entry = `[${stamp}${user?.name ? ` · ${user.name}` : ''}] ${note}`
    const next = (activeConv.notes ? `${activeConv.notes}\n` : '') + entry
    const ok = await updateConversation({ notes: next }, t('note_added'))
    if (ok) setText('')
    setSavingNote(false)
  }

  // ── AI reply suggestion (on demand; server builds it from the conversation) ─
  const lastInbound = useMemo(() => [...messages].reverse().find(m => m.direction === 'inbound' && m.content), [messages])
  const suggestReply = async () => {
    if (!activeConv || aiLoading) return
    setAiLoading(true)
    setAiSuggestion(null)
    try {
      const { data } = await axios.post('/api/ai/suggest', activeConv.id
        ? { conversation_id: activeConv.id }
        : { contact_id: activeConv.contact_id, instance_id: activeConv.instance_id || undefined })
      if (data?.suggestion) setAiSuggestion(String(data.suggestion).trim())
      else toast.error(t('ai_failed'))
    } catch (e: any) {
      if (e?.response?.data?.upgrade_required) { setAiBlocked(true); toast.error(t('ai_upgrade')) }
      else toast.error(apiErrorText(e, t, lang, 'ai_failed'))
    } finally { setAiLoading(false) }
  }

  // ── Contact details for the side panel ─────────────────────────────────
  const panelOpen = !!activeConv && showDetails
  useEffect(() => {
    const id = activeConv?.contact_id
    if (!panelOpen || !id || contactDetails[id]) return
    setContactLoading(true)
    axios.get(`/api/contacts/${id}`)
      .then(r => setContactDetails(prev => ({ ...prev, [id]: r.data.contact })))
      .catch(() => {})
      .finally(() => setContactLoading(false))
  }, [panelOpen, activeConv?.contact_id])

  const filteredConvs = conversations.filter(c => {
    if (assignFilter === 'mine' && c.assigned_to !== user?.id) return false
    if (assignFilter === 'unassigned' && c.assigned_to) return false
    if (assignFilter === 'ai' && !isAiMessage(c.last_message)) return false
    if (assignFilter === 'waiting' && c.last_message?.direction !== 'inbound') return false
    if (!searchQ) return true
    const q = searchQ.toLowerCase()
    return c.contacts?.name?.toLowerCase().includes(q) || c.contacts?.phone?.includes(q) ||
      (Array.isArray(c.tags) && c.tags.some((t: string) => t.toLowerCase().includes(q.replace(/^#/, ''))))
  })

  // 24-hour window of the conversation's number
  const win = activeConv ? windowState(messages, activeConv.whatsapp_instances || (activeConv.instance_id ? { id: activeConv.instance_id } : null)) : { kind: 'na' as const }
  const effectiveWin = windowWarning === 'outside' && win.kind !== 'na' ? { kind: 'closed' as const, lastInbound: null } : win

  // Thread with day separators
  const thread = useMemo(() => {
    const out: ({ kind: 'day'; key: string; label: string } | { kind: 'msg'; msg: any; grouped: boolean })[] = []
    let prevDay = ''
    let prev: any = null
    for (const m of messages) {
      const d = m.created_at ? new Date(m.created_at) : new Date()
      const day = d.toDateString()
      if (day !== prevDay) {
        out.push({ kind: 'day', key: `day-${day}`, label: dayLabel(d, lang, t) })
        prevDay = day
        prev = null
      }
      const grouped = !!prev && prev.direction === m.direction && Math.abs(d.getTime() - new Date(prev.created_at).getTime()) < 5 * 60000
      out.push({ kind: 'msg', msg: m, grouped })
      prev = m
    }
    return out
  }, [messages, lang, t])

  const contact = activeConv ? (contactDetails[activeConv.contact_id] || null) : null
  const aiAvailable = !aiBlocked && !!lastInbound && messages[messages.length - 1]?.direction === 'inbound'

  const panel = activeConv && showDetails ? (
    <CustomerPanel
      conv={activeConv}
      contact={contact}
      contactLoading={contactLoading && !contact}
      messages={messages}
      user={user}
      teamMembers={teamMembers}
      onUpdate={updates => updateConversation(updates)}
      onNotesChange={notes => setActiveConv((p: any) => ({ ...p, notes }))}
      onClose={() => setShowDetails(false)}
      className={isWide ? 'w-[320px] shrink-0 border-s border-line-soft' : 'h-full w-full'}
    />
  ) : null

  return (
    <DashboardLayout title={t('title')}>
      <div className="flex h-[calc(100dvh-56px-2rem)] min-h-[460px] overflow-hidden rounded-panel border border-line bg-surface shadow-card md:h-[calc(100dvh-56px-3rem)]">

        {/* Conversations */}
        <ConversationList
          className={cn('w-full shrink-0 md:flex md:w-[340px] md:border-e md:border-line-soft lg:w-[360px]', activeConv ? 'hidden' : 'flex')}
          conversations={filteredConvs}
          totalCount={conversations.length}
          loading={loading}
          activeId={activeConv?.id}
          unreadCounts={unreadCounts}
          inboxes={inboxes}
          canSeeAll={canSeeAll}
          selectedInbox={selectedInbox}
          onSwitchInbox={switchInbox}
          searchQ={searchQ}
          onSearch={setSearchQ}
          statusFilter={statusFilter}
          onStatusFilter={setStatusFilter}
          assignFilter={assignFilter}
          onAssignFilter={setAssignFilter}
          onRefresh={() => loadConversations()}
          onOpen={openConversation}
        />

        {/* Thread */}
        {activeConv ? (
          <div className="flex min-w-0 flex-1">
            <section aria-label={activeConv.contacts?.name || activeConv.contacts?.phone} className="flex min-w-0 flex-1 flex-col">
              {/* Header */}
              <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-line-soft px-3 sm:px-4">
                <Button size="icon-sm" variant="ghost" icon={ArrowLeftIcon} aria-label={t('back')} onClick={() => setActiveConv(null)} className="md:hidden rtl:[&_svg]:rotate-180" />
                <Avatar name={activeConv.contacts?.name || activeConv.contacts?.phone} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink" dir="auto">{activeConv.contacts?.name || activeConv.contacts?.phone}</p>
                  <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
                    {!loadingMessages && effectiveWin.kind !== 'na' ? (
                      <span title={t('window_hint')} className={cn('inline-flex min-w-0 items-center gap-1 font-medium', effectiveWin.kind === 'open' ? 'text-success' : 'text-warning')}>
                        <ClockIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">
                          {effectiveWin.kind === 'open'
                            ? (effectiveWin.msLeft >= 3600000 ? t('window_open', { h: Math.floor(effectiveWin.msLeft / 3600000) }) : t('window_open_m', { m: Math.max(1, Math.floor(effectiveWin.msLeft / 60000)) }))
                            : effectiveWin.lastInbound ? t('window_closed') : t('window_none')}
                        </span>
                      </span>
                    ) : (
                      <bdi dir="ltr" className="tabular truncate">{activeConv.contacts?.phone}</bdi>
                    )}
                    {activeConv.whatsapp_instances && (
                      <span className="hidden truncate lg:inline">· {activeConv.whatsapp_instances.display_name || <bdi dir="ltr">{activeConv.whatsapp_instances.phone_number}</bdi>}</span>
                    )}
                  </p>
                </div>
                <div className={cn('hidden shrink-0', !(isWide && showDetails) && 'sm:block')}>
                  <Select
                    size="sm"
                    aria-label={t('status')}
                    value={activeConv.status}
                    onChange={e => updateConversation({ status: e.target.value })}
                    className="w-[124px]"
                    options={['open', 'pending', 'resolved', 'spam'].map(s => ({ value: s, label: t(STATUS_KEYS[s]) }))}
                  />
                </div>
                {activeConv.status !== 'resolved' && (
                  <Tooltip content={t('mark_resolved')}>
                    <Button size="icon-sm" variant="ghost" icon={CheckBadgeIcon} aria-label={t('mark_resolved')} onClick={() => updateConversation({ status: 'resolved' })} className="hidden sm:inline-flex" />
                  </Tooltip>
                )}
                <Tooltip content={t('details')}>
                  <Button size="icon-sm" variant={showDetails ? 'secondary' : 'ghost'} icon={isWide ? InformationCircleIcon : UserCircleIcon} aria-label={t('details')} aria-pressed={showDetails} onClick={() => setShowDetails(v => !v)} />
                </Tooltip>
              </div>

              {/* Messages */}
              <div
                ref={scrollRef}
                className="min-h-0 flex-1 overflow-y-auto bg-canvas px-3 py-4 sm:px-6"
                style={{ backgroundImage: 'radial-gradient(rgb(var(--brand-teal) / 0.06) 1px, transparent 1px)', backgroundSize: '18px 18px' }}
                aria-busy={loadingMessages || undefined}
              >
                {loadingMessages ? (
                  <div className="flex flex-col gap-3" aria-label={t('loading_messages')}>
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} className={cn('flex', i % 2 ? 'justify-end' : 'justify-start')}>
                        <Skeleton className={cn('h-12 rounded-[18px]', i % 2 ? 'w-1/2' : 'w-2/5')} />
                      </div>
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-chip text-chip-ink"><ChatBubbleLeftRightIcon className="h-6 w-6" aria-hidden="true" /></span>
                    <p className="text-sm text-muted">{t('thread_empty')}</p>
                  </div>
                ) : (
                  thread.map(item => item.kind === 'day' ? (
                    <div key={item.key} className="sticky top-0 z-[1] my-3 flex justify-center">
                      <span className="rounded-full border border-line bg-surface/95 px-3 py-1 text-[11.5px] font-medium text-muted shadow-sm backdrop-blur">{item.label}</span>
                    </div>
                  ) : (
                    <MessageBubble key={item.msg.id} msg={item.msg} grouped={item.grouped} />
                  ))
                )}
              </div>

              <Composer
                mode={mode}
                onMode={m => { setMode(m); setShowQuickReplies(false); setShowEmoji(false); textareaRef.current?.focus() }}
                text={text}
                onText={setText}
                onSend={sendMessage}
                onAddNote={addNote}
                sending={sending}
                savingNote={savingNote}
                textareaRef={textareaRef}
                quickReplies={quickReplies}
                showQuickReplies={showQuickReplies}
                onShowQuickReplies={setShowQuickReplies}
                showEmoji={showEmoji}
                onShowEmoji={setShowEmoji}
                attachment={attachment}
                onAttachmentCaption={v => setAttachment((a: any) => ({ ...a, caption: v }))}
                fileInputRef={fileInputRef}
                onPickAttachment={pickAttachment}
                onCancelAttachment={cancelAttachment}
                onSendAttachment={sendAttachment}
                uploadingAttachment={uploadingAttachment}
                windowState={loadingMessages ? { kind: 'na' } : effectiveWin}
                onOpenTemplates={() => setTemplatesOpen(true)}
                aiAvailable={aiAvailable}
                aiSuggestion={aiSuggestion}
                aiLoading={aiLoading}
                onSuggest={suggestReply}
                onUseSuggestion={() => { if (aiSuggestion) setText(aiSuggestion); setAiSuggestion(null); textareaRef.current?.focus() }}
                onDismissSuggestion={() => setAiSuggestion(null)}
              />
            </section>

            {/* Customer panel: beside the thread on wide screens, a sheet otherwise */}
            {isWide && panel}
          </div>
        ) : (
          <div className="hidden flex-1 flex-col items-center justify-center gap-3 bg-canvas p-8 text-center md:flex">
            <span className="flex h-20 w-20 items-center justify-center rounded-[26px] bg-brand-gradient text-[#04282C] shadow-glow">
              <ChatBubbleLeftRightIcon className="h-10 w-10" aria-hidden="true" />
            </span>
            <h2 className="mt-2 text-xl font-bold text-ink">{t('select_title')}</h2>
            <p className="max-w-xs text-sm text-muted">{t('select_d')}</p>
          </div>
        )}
      </div>

      {!isWide && panel && (
        <div className="fixed inset-0 z-overlay flex justify-end" role="dialog" aria-modal="true" aria-label={t('details')}
          onKeyDown={e => { if (e.key === 'Escape') setShowDetails(false) }}>
          <button type="button" className="absolute inset-0 bg-overlay/50 backdrop-blur-[2px]" aria-label={t('close')} onClick={() => setShowDetails(false)} />
          <div className="relative h-full w-[min(92vw,380px)] shadow-dropdown">{panel}</div>
        </div>
      )}

      <TemplatesModal
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        instanceId={sendingInstance()?.id || activeConv?.instance_id}
        onSend={activeConv ? sendTemplate : undefined}
        defaults={{ first: activeConv?.contacts?.name || undefined }}
      />
    </DashboardLayout>
  )
}
