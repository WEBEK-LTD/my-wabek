import { useState, useEffect, useRef } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  PlusIcon, LifebuoyIcon, ChatBubbleLeftRightIcon, SparklesIcon, PaperAirplaneIcon, ArrowRightIcon,
  ClockIcon, CheckIcon, XMarkIcon, UserIcon, TicketIcon, BookOpenIcon,
} from '@heroicons/react/24/outline'
import {
  Badge, Button, EmptyState, Field, Input, Modal, PageHeader, Skeleton, Textarea, cn,
} from '@/components/ui'
import type { Tone } from '@/components/ui'
import { ErrorState, apiError } from '@/components/settings/Shared'
import { useT } from '@/lib/i18n-local'
import dict from '@/locales/dashboard/support'

type Ticket = {
  id: string; ticket_number: number; subject: string
  status: 'open'|'pending'|'resolved'|'closed'; created_at: string; updated_at: string
}
type Message = {
  id: string; ticket_id: string; sender_type: 'user'|'admin'|'ai'
  content: string; created_at: string; wa_message_id?: string; wa_status?: string
}

// Labels are keys of locales/dashboard/support.ts.
const STATUS_CFG: Record<string, { label: keyof typeof dict.en; tone: Tone }> = {
  open:     { label: 'status_open', tone: 'brand' },
  pending:  { label: 'status_pending', tone: 'warning' },
  resolved: { label: 'status_resolved', tone: 'success' },
  closed:   { label: 'status_closed', tone: 'neutral' },
}
const WA_STATUS = ['pending', 'sent', 'delivered', 'read', 'failed']

function WaStatus({ status }: { status?: string }) {
  const { t } = useT(dict)
  if (!status) return null
  const label = WA_STATUS.includes(status) ? t(`wa_${status}` as keyof typeof dict.en) : status
  if (status === 'failed') return <XMarkIcon className="h-3.5 w-3.5 text-danger" aria-label={label} />
  if (status === 'pending') return <ClockIcon className="h-3.5 w-3.5" aria-label={label} />
  return (
    <span className={cn('inline-flex', status === 'read' ? 'text-brand-ink' : '')} aria-label={label} title={label}>
      <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" />
      {status !== 'sent' && <CheckIcon className="-ms-2 h-3.5 w-3.5" aria-hidden="true" />}
    </span>
  )
}

function isBusinessHours() {
  const now = new Date()
  const h = now.getHours()
  return h >= 9 && h < 18
}

export default function SupportPage() {
  const { t, fmtDate, fmtTime } = useT(dict)
  const statusLabel = (s: string) => (STATUS_CFG[s] ? t(STATUS_CFG[s].label) : s)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [ticketsLoading, setTicketsLoading] = useState(true)
  const [ticketsError, setTicketsError] = useState(false)
  const [activeTicket, setActiveTicket] = useState<Ticket|null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [newSubject, setNewSubject] = useState('')
  const [newBody, setNewBody] = useState('')
  const [waPhone, setWaPhone] = useState('')
  const [creating, setCreating] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [online, setOnline] = useState(true)
  useEffect(() => { setOnline(isBusinessHours()) }, [])

  useEffect(() => { loadTickets() }, [])
  useEffect(() => {
    if (activeTicket) { setMessages([]); setMessagesLoading(true); loadMessages(activeTicket.id).finally(() => setMessagesLoading(false)) }
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
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages])

  async function loadTickets() {
    try {
      const r = await axios.get('/api/support/tickets')
      setTickets(r.data.tickets || [])
      setTicketsError(false)
    } catch { setTicketsError(true) }
    setTicketsLoading(false)
  }

  async function loadMessages(ticketId: string) {
    try {
      const r = await axios.get(`/api/support/messages?ticket_id=${ticketId}`)
      setMessages(r.data.messages || [])
    } catch {}
  }

  async function createTicket() {
    if (!newSubject.trim() || !newBody.trim()) { toast.error(t('subjectBodyRequired')); return }
    setCreating(true)
    try {
      const r = await axios.post('/api/support/tickets', { subject: newSubject, message: newBody, whatsapp_phone: waPhone })
      toast.success(t('ticketOpened', { n: r.data.ticketNumber }))
      setShowNew(false); setNewSubject(''); setNewBody(''); setWaPhone('')
      await loadTickets()
      setActiveTicket(r.data.ticket)
    } catch (e: any) { toast.error(apiError(e, t('openError'))) }
    setCreating(false)
  }

  async function sendMessage() {
    if (!newMsg.trim() || !activeTicket) return
    setSending(true)
    try {
      const r = await axios.post('/api/support/messages', { ticket_id: activeTicket.id, content: newMsg })
      setMessages(m => [...m, r.data.message])
      setNewMsg('')
      setTickets(ts => ts.map(tk => tk.id === activeTicket.id ? { ...tk, status: 'open', updated_at: new Date().toISOString() } : tk))
    } catch (e: any) { toast.error(apiError(e, t('sendError'))) }
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
    } catch (e: any) { toast.error(t('aiUnavailable')) }
    setAiLoading(false)
  }

  const activeCfg = activeTicket ? STATUS_CFG[activeTicket.status] : null
  const activeStatus = activeCfg ? { ...activeCfg, label: t(activeCfg.label) } : null
  const canReply = activeTicket && activeTicket.status !== 'resolved' && activeTicket.status !== 'closed'

  return (
    <DashboardLayout title={t('pageTitle')}>
      <div className="flex flex-col gap-5">
        <PageHeader
          eyebrow={t('eyebrow')}
          title={t('title')}
          description={t('description')}
          actions={
            <>
              <Button variant="secondary" icon={BookOpenIcon} href="/docs/faq/troubleshooting">{t('troubleshooting')}</Button>
              <Button icon={PlusIcon} onClick={() => setShowNew(true)}>{t('newTicket')}</Button>
            </>
          }
        />

        <div className="grid h-[calc(100vh-15rem)] min-h-[560px] overflow-hidden rounded-panel border border-line bg-surface shadow-card lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* Ticket list */}
          <aside className={cn('flex min-h-0 flex-col border-line lg:border-e', activeTicket && 'hidden lg:flex')} aria-label={t('tickets')}>
            <div className="flex items-center justify-between gap-2 border-b border-line-soft px-4 py-3.5">
              <div>
                <h2 className="text-sm font-semibold text-ink">{t('myTickets')}</h2>
                <p className="text-xs text-muted">{t(tickets.length === 1 ? 'ticketCountOne' : 'ticketCountMany', { n: tickets.length })}</p>
              </div>
              <Button size="icon-sm" icon={PlusIcon} aria-label={t('newTicket')} onClick={() => setShowNew(true)} />
            </div>
            <div className={cn('mx-3 mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs', online ? 'bg-success-bg text-success' : 'bg-warning-bg text-warning')}>
              <span className={cn('h-2 w-2 shrink-0 rounded-full', online ? 'animate-pulse bg-success' : 'bg-warning')} aria-hidden="true" />
              {online ? t('teamOnline') : t('teamOffline')}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto py-2">
              {ticketsLoading ? (
                <div className="space-y-2 px-3">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
              ) : ticketsError ? (
                <ErrorState className="m-3 py-6" title={t('loadError')} onRetry={() => { setTicketsLoading(true); loadTickets() }} />
              ) : tickets.length === 0 ? (
                <EmptyState size="sm" icon={TicketIcon} title={t('noTickets')} action={<Button size="sm" variant="secondary" onClick={() => setShowNew(true)}>{t('openFirst')}</Button>} />
              ) : (
                <ul className="space-y-1 px-2">
                  {tickets.map(tk => {
                    const cfg = STATUS_CFG[tk.status]
                    const st = { label: statusLabel(tk.status), tone: cfg ? cfg.tone : 'neutral' as Tone }
                    const selected = activeTicket?.id === tk.id
                    return (
                      <li key={tk.id}>
                        <button type="button" onClick={() => setActiveTicket(tk)} aria-current={selected || undefined}
                          className={cn('w-full rounded-xl px-3 py-3 text-start transition', selected ? 'bg-chip/60 ring-1 ring-brand-teal/30' : 'hover:bg-surface-2')}>
                          <div className="flex items-start justify-between gap-2">
                            <p className="min-w-0 truncate text-sm font-medium text-ink"><span className="text-muted tabular">#{tk.ticket_number}</span> · {tk.subject}</p>
                            <Badge tone={st.tone} size="sm" className="shrink-0">{st.label}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted">{t('lastUpdate', { date: fmtDate(tk.updated_at) })}</p>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </aside>

          {/* Thread */}
          {activeTicket ? (
            <section className="flex min-h-0 min-w-0 flex-col" aria-label={t('thread')}>
              <header className="flex items-center gap-3 border-b border-line-soft px-4 py-3.5 sm:px-5">
                <Button size="icon-sm" variant="ghost" icon={ArrowRightIcon} aria-label={t('backToTickets')} className="lg:hidden ltr:rotate-180" onClick={() => setActiveTicket(null)} />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-semibold text-ink"><span className="text-muted tabular">#{activeTicket.ticket_number}</span> · {activeTicket.subject}</h2>
                  <p className="text-xs text-muted">{t('openedOn', { date: fmtDate(activeTicket.created_at) })}</p>
                </div>
                {activeStatus && <Badge tone={activeStatus.tone} dot>{activeStatus.label}</Badge>}
              </header>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-surface-2/50 p-4 sm:p-5" aria-live="polite">
                {messagesLoading && messages.length === 0 ? (
                  <div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className={cn('h-14 rounded-2xl', i % 2 ? 'ms-auto w-1/2' : 'w-2/3')} />)}</div>
                ) : messages.map(msg => {
                  const mine = msg.sender_type === 'user'
                  return (
                    <div key={msg.id} className={cn('flex gap-2', mine ? 'justify-end' : 'justify-start')}>
                      {!mine && (
                        <span className={cn('mt-5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', msg.sender_type === 'ai' ? 'bg-violet-bg text-violet' : 'bg-chip text-brand-ink')}>
                          {msg.sender_type === 'ai' ? <SparklesIcon className="h-4 w-4" aria-hidden="true" /> : <UserIcon className="h-4 w-4" aria-hidden="true" />}
                        </span>
                      )}
                      <div className={cn('max-w-[78%]', mine && 'items-end')}>
                        {!mine && <p className="mb-1 ms-1 text-xs text-muted">{msg.sender_type === 'ai' ? t('assistant') : t('supportTeam')}</p>}
                        <div dir="auto" className={cn('whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                          mine ? 'rounded-se-md bg-brand-gradient text-[#04282C]'
                            : msg.sender_type === 'ai' ? 'rounded-ss-md border border-violet/20 bg-violet-bg/60 text-ink'
                            : 'rounded-ss-md border border-line bg-surface text-ink')}>
                          {msg.content}
                        </div>
                        <p className={cn('mt-1 flex items-center gap-1 text-[11px] text-muted', mine ? 'justify-end' : 'ms-1')}>
                          <span className="tabular">{fmtTime(msg.created_at)}</span>
                          {mine && <WaStatus status={msg.wa_status} />}
                        </p>
                      </div>
                    </div>
                  )
                })}
                {aiLoading && (
                  <div className="flex gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-bg text-violet"><SparklesIcon className="h-4 w-4" aria-hidden="true" /></span>
                    <div className="flex items-center gap-1 rounded-2xl rounded-ss-md border border-violet/20 bg-violet-bg/60 px-4 py-3" aria-label={t('assistantTyping')}>
                      {[0, 1, 2].map(i => <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-violet" style={{ animationDelay: `${i * 0.15}s` }} />)}
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {canReply ? (
                <div className="border-t border-line-soft p-3 sm:p-4">
                  {!online && (
                    <p className="mb-3 flex items-start gap-2 rounded-xl bg-warning-bg px-3 py-2 text-xs text-warning">
                      <ClockIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      {t('offlineNotice')}
                    </p>
                  )}
                  <form className="flex items-end gap-2" onSubmit={e => { e.preventDefault(); sendMessage() }}>
                    <Textarea
                      value={newMsg}
                      onChange={e => setNewMsg(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                      placeholder={t('messagePlaceholder')}
                      aria-label={t('messageText')}
                      rows={2}
                      className="min-h-[2.75rem] flex-1 resize-none"
                    />
                    <div className="flex flex-col gap-2">
                      {!online && (
                        <Button type="button" variant="secondary" size="sm" icon={SparklesIcon} loading={aiLoading} disabled={!newMsg.trim()} onClick={askAI}>{t('askAssistant')}</Button>
                      )}
                      <Button type="submit" size="sm" icon={PaperAirplaneIcon} loading={sending} disabled={!newMsg.trim()}>{t('send')}</Button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="border-t border-line-soft p-4 text-center text-sm text-muted">
                  {activeTicket.status === 'closed' ? t('ticketIsClosed') : t('ticketIsResolved')}{' '}
                  <button type="button" className="font-medium text-link hover:text-link-hover" onClick={() => setShowNew(true)}>{t('openNewTicket')}</button> {t('ifMoreHelp')}
                </div>
              )}
            </section>
          ) : (
            <div className="hidden items-center justify-center p-6 lg:flex">
              <EmptyState icon={ChatBubbleLeftRightIcon} title={t('selectTicket')} description={t('selectTicketDesc')}
                action={<Button icon={PlusIcon} onClick={() => setShowNew(true)}>{t('newTicket')}</Button>} />
            </div>
          )}
        </div>
      </div>

      <Modal
        open={showNew}
        onClose={() => setShowNew(false)}
        size="lg"
        icon={LifebuoyIcon}
        title={t('newTicketTitle')}
        description={t('newTicketDesc')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowNew(false)}>{t('cancel')}</Button>
            <Button type="submit" form="ticket-form" icon={TicketIcon} loading={creating} disabled={!newSubject.trim() || !newBody.trim()}>{t('openTicket')}</Button>
          </>
        }
      >
        <form id="ticket-form" className="space-y-4" onSubmit={e => { e.preventDefault(); createTicket() }}>
          <Field label={t('subject')} required>
            <Input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder={t('subjectPlaceholder')} />
          </Field>
          <Field label={t('message')} required>
            <Textarea value={newBody} onChange={e => setNewBody(e.target.value)} placeholder={t('bodyPlaceholder')} rows={5} />
          </Field>
          <Field label={t('waPhone')} hint={t('waPhoneHint')}>
            <Input value={waPhone} onChange={e => setWaPhone(e.target.value)} placeholder="966501234567" dir="ltr" inputMode="tel" />
          </Field>
        </form>
      </Modal>
    </DashboardLayout>
  )
}
