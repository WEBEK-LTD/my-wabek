import React, { useEffect, useMemo, useRef, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  ArrowPathIcon, ArrowRightIcon, BookOpenIcon, ChatBubbleLeftRightIcon, CheckIcon, InboxIcon, PaperAirplaneIcon, SparklesIcon, UserIcon,
} from '@heroicons/react/24/outline'
import {
  Avatar, Badge, Button, Card, Dropdown, EmptyState, Field, Modal, PageHeader, SearchInput, Skeleton, Tabs, Textarea, cn,
} from '@/components/ui'
import type { Tone } from '@/components/ui'
import { apiError, useAdminT } from '@/components/admin/i18n'
import { ErrorState, InfoTile } from '@/components/admin/shared'

type Status = 'open' | 'pending' | 'resolved' | 'closed'
interface TicketUser { name?: string | null; email?: string | null; created_at?: string | null }
interface Ticket {
  id: string; ticket_number: string | number; subject: string; status: Status; created_at: string; updated_at: string
  users?: TicketUser | null; support_messages?: { content?: string }[]
}
interface Message { id: string; sender_type: 'admin' | 'user' | 'ai' | string; content: string; created_at: string }

const STATUSES: Status[] = ['open', 'pending', 'resolved', 'closed']
const TONE: Record<Status, Tone> = { open: 'brand', pending: 'warning', resolved: 'success', closed: 'neutral' }

export default function AdminSupportPage() {
  const { tr, fmtDate, fmtTime, fmtDateTime } = useAdminT()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [active, setActive] = useState<Ticket | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [filterStatus, setFilterStatus] = useState<'all' | Status>('all')
  const [q, setQ] = useState('')
  const [showKnowledge, setShowKnowledge] = useState(false)
  const [knowledge, setKnowledge] = useState('')
  const [savingKnowledge, setSavingKnowledge] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const statusLabel = (s: Status) => ({ open: tr('مفتوحة', 'Open'), pending: tr('معلّقة', 'Pending'), resolved: tr('محلولة', 'Resolved'), closed: tr('مغلقة', 'Closed') })[s] || s

  useEffect(() => { loadTickets() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filterStatus])
  useEffect(() => { axios.get('/api/admin/support/knowledge').then(r => setKnowledge(r.data.knowledge || '')).catch(() => {}) }, [])
  useEffect(() => { if (active) loadMessages(active.id) /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [active?.id])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages])

  async function loadTickets() {
    setLoadingList(true)
    try {
      const r = await axios.get(`/api/admin/support/tickets?status=${filterStatus}`)
      setTickets(r.data.tickets || [])
      setListError(null)
    } catch (e) { setListError(apiError(e, tr('تعذّر تحميل التذاكر', 'Could not load tickets'))) }
    setLoadingList(false)
  }

  async function loadMessages(ticketId: string) {
    setLoadingMsgs(true)
    try {
      const r = await axios.get(`/api/admin/support/messages?ticket_id=${ticketId}`)
      setMessages(r.data.messages || [])
    } catch { setMessages([]) }
    setLoadingMsgs(false)
  }

  async function sendReply() {
    if (!reply.trim() || !active) return
    setSending(true)
    try {
      await axios.post('/api/admin/support/reply', { ticket_id: active.id, content: reply })
      toast.success(tr('أُرسل الرد — أُبلغ المستخدم بالبريد وواتساب', 'Reply sent — user notified by email & WhatsApp'))
      setReply('')
      await loadMessages(active.id)
      await loadTickets()
    } catch (e) { toast.error(apiError(e, tr('تعذّر الإرسال', 'Failed to send'))) }
    setSending(false)
  }

  async function updateStatus(id: string, status: Status) {
    try {
      await axios.put('/api/admin/support/tickets', { id, status })
      setTickets(ts => ts.map(t => (t.id === id ? { ...t, status } : t)))
      if (active?.id === id) setActive(a => (a ? { ...a, status } : a))
      toast.success(tr(`حُدّثت التذكرة إلى «${statusLabel(status)}»`, `Ticket marked as ${statusLabel(status)}`))
    } catch (e) { toast.error(apiError(e, tr('تعذّر تحديث الحالة', 'Could not update the status'))) }
  }

  async function saveKnowledge() {
    setSavingKnowledge(true)
    try {
      await axios.post('/api/admin/support/knowledge', { knowledge })
      toast.success(tr('حُدّثت معرفة المساعد', 'AI knowledge updated'))
      setShowKnowledge(false)
    } catch { toast.error(tr('تعذّر الحفظ', 'Failed to save')) }
    setSavingKnowledge(false)
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return tickets
      .filter(t => filterStatus === 'all' || t.status === filterStatus)
      .filter(t => !term || [t.subject, String(t.ticket_number), t.users?.name, t.users?.email].some(v => (v || '').toLowerCase().includes(term)))
  }, [tickets, filterStatus, q])
  const openCount = tickets.filter(t => t.status === 'open').length
  const customer = active?.users

  return (
    <AdminLayout title={tr('تذاكر الدعم', 'Support tickets')}>
      <PageHeader className="mb-6"
        eyebrow={tr('الدعم', 'Support')}
        title={tr('تذاكر الدعم', 'Support tickets')}
        description={tr('رد على العملاء من مكان واحد؛ يصلهم الرد بالبريد وواتساب.', 'Answer customers in one place; replies reach them by email and WhatsApp.')}
        actions={<>
          <Button variant="secondary" icon={BookOpenIcon} onClick={() => setShowKnowledge(true)}>{tr('معرفة المساعد الذكي', 'AI knowledge base')}</Button>
          <Button variant="ghost" size="icon" icon={ArrowPathIcon} aria-label={tr('تحديث', 'Refresh')} onClick={() => { loadTickets(); if (active) loadMessages(active.id) }} />
        </>}
      />

      <Card padding="none" className="overflow-hidden">
        <div className="grid lg:h-[calc(100vh-260px)] lg:min-h-[560px] lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)_260px]">
          {/* Queue */}
          <aside className={cn('flex min-h-0 flex-col border-line-soft lg:border-e', active && 'hidden lg:flex')} aria-label={tr('قائمة التذاكر', 'Ticket queue')}>
            <div className="space-y-3 border-b border-line-soft p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-ink">{tr('الطابور', 'Queue')}</p>
                {openCount > 0 && <Badge tone="danger" size="sm" dot pulse>{tr(`${openCount} مفتوحة`, `${openCount} open`)}</Badge>}
              </div>
              <SearchInput size="sm" value={q} onChange={setQ} placeholder={tr('ابحث بالموضوع أو الرقم أو العميل', 'Search subject, number or customer')} />
              <div className="-mx-1 overflow-x-auto px-1 scrollbar-none">
                <Tabs variant="segmented" size="sm" value={filterStatus} onChange={v => setFilterStatus(v as 'all' | Status)} aria-label={tr('تصفية حسب الحالة', 'Filter by status')}
                  tabs={[{ id: 'all', label: tr('الكل', 'All') }, ...STATUSES.map(s => ({ id: s, label: statusLabel(s) }))]} />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {loadingList && !tickets.length ? (
                <div className="space-y-2 p-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>
              ) : listError ? (
                <div className="p-4"><ErrorState description={listError} onRetry={loadTickets} /></div>
              ) : filtered.length === 0 ? (
                <EmptyState size="sm" icon={InboxIcon} title={q ? tr('لا نتائج', 'No results') : tr('لا توجد تذاكر', 'No tickets')}
                  description={filterStatus !== 'all' ? tr('جرّب حالة أخرى.', 'Try another status.') : undefined}
                  action={filterStatus !== 'all' || q ? <Button size="sm" variant="secondary" onClick={() => { setFilterStatus('all'); setQ('') }}>{tr('عرض الكل', 'Show all')}</Button> : undefined} />
              ) : (
                <ul>
                  {filtered.map(t => (
                    <li key={t.id}>
                      <button type="button" onClick={() => setActive(t)} aria-current={active?.id === t.id || undefined}
                        className={cn('w-full border-b border-line-soft px-4 py-3 text-start transition-colors hover:bg-surface-2',
                          active?.id === t.id && 'bg-chip/50 shadow-[inset_3px_0_0_rgb(var(--brand-teal))] rtl:shadow-[inset_-3px_0_0_rgb(var(--brand-teal))]')}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="tabular text-xs font-semibold text-muted" dir="ltr">#{t.ticket_number}</span>
                          <Badge tone={TONE[t.status]} size="sm">{statusLabel(t.status)}</Badge>
                        </div>
                        <p className="mt-1 truncate text-sm font-medium text-ink">{t.subject}</p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <Avatar name={t.users?.name || t.users?.email || '?'} size="xs" />
                          <span className="min-w-0 flex-1 truncate text-xs text-muted">{t.users?.name || t.users?.email}</span>
                          <span className="shrink-0 text-2xs text-muted">{fmtDate(t.updated_at)}</span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>

          {/* Thread */}
          <section className={cn('flex min-h-[520px] min-w-0 flex-col lg:min-h-0', !active && 'hidden lg:flex')} aria-label={tr('المحادثة', 'Conversation')}>
            {active ? (
              <>
                <div className="flex flex-wrap items-center gap-3 border-b border-line-soft px-4 py-3 sm:px-5">
                  <Button size="icon-sm" variant="ghost" icon={ArrowRightIcon} className="lg:hidden ltr:[&_svg]:rotate-180" aria-label={tr('العودة إلى القائمة', 'Back to list')} onClick={() => setActive(null)} />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-semibold text-ink"><span dir="ltr" className="tabular text-muted">#{active.ticket_number}</span> · {active.subject}</h2>
                    <p className="text-xs text-muted">{tr('فُتحت في', 'Opened')} {fmtDate(active.created_at)}</p>
                  </div>
                  <Dropdown
                    label={tr('تغيير الحالة', 'Change status')}
                    triggerClassName="h-9 gap-2 rounded-xl border border-line px-3 text-sm hover:bg-surface-2"
                    trigger={<><Badge tone={TONE[active.status]} size="sm" dot>{statusLabel(active.status)}</Badge><span className="text-muted">{tr('تغيير', 'Change')}</span></>}
                    items={STATUSES.map(s => ({ label: statusLabel(s), selected: s === active.status, icon: s === active.status ? CheckIcon : undefined, disabled: s === active.status, onClick: () => updateStatus(active.id, s) }))}
                  />
                </div>

                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-canvas/50 px-4 py-5 sm:px-5" aria-live="polite">
                  {loadingMsgs && !messages.length ? (
                    [0, 1, 2].map(i => <Skeleton key={i} className={cn('h-14 w-2/3 rounded-2xl', i % 2 && 'ms-auto')} />)
                  ) : messages.length === 0 ? (
                    <EmptyState size="sm" icon={ChatBubbleLeftRightIcon} title={tr('لا توجد رسائل في هذه التذكرة', 'No messages in this ticket')} />
                  ) : messages.map(m => {
                    const mine = m.sender_type === 'admin'
                    const ai = m.sender_type === 'ai'
                    return (
                      <div key={m.id} className={cn('flex gap-2.5', mine && 'flex-row-reverse')}>
                        {!mine && (ai
                          ? <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-bg text-violet"><SparklesIcon className="h-4 w-4" aria-hidden="true" /></span>
                          : <Avatar name={customer?.name || customer?.email || '?'} size="sm" />)}
                        <div className={cn('max-w-[78%]', mine && 'items-end text-end')}>
                          {!mine && <p className="mb-1 text-xs text-muted">{ai ? tr('مساعد WABEK الذكي', 'WABEK AI') : customer?.name || tr('المستخدم', 'User')}</p>}
                          <div dir="auto" className={cn('whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-start text-sm leading-relaxed',
                            mine ? 'rounded-se-md bg-brand-gradient text-[#04282C]'
                              : ai ? 'rounded-ss-md border border-violet/20 bg-violet-bg text-ink'
                                : 'rounded-ss-md border border-line bg-surface text-ink')}>{m.content}</div>
                          <p className="tabular mt-1 text-2xs text-muted">{fmtTime(m.created_at)}</p>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={bottomRef} />
                </div>

                <div className="border-t border-line-soft p-3 sm:p-4">
                  <div className="flex items-end gap-2">
                    <Textarea
                      aria-label={tr('الرد', 'Reply')}
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply() } }}
                      placeholder={tr('اكتب ردك… (Enter للإرسال، Shift+Enter لسطر جديد)', 'Type a reply… (Enter to send, Shift+Enter for a new line)')}
                      rows={2}
                      maxLength={10000}
                      className="flex-1 resize-none"
                    />
                    <Button icon={PaperAirplaneIcon} className="rtl:[&_svg]:-scale-x-100" loading={sending} disabled={!reply.trim()} onClick={sendReply}>{tr('إرسال', 'Send')}</Button>
                  </div>
                  <p className="mt-1.5 text-2xs text-muted">{tr('سيصل الرد إلى العميل بالبريد الإلكتروني وواتساب.', 'The customer gets the reply by email and WhatsApp.')}</p>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-6">
                <EmptyState icon={ChatBubbleLeftRightIcon} title={tr('اختر تذكرة', 'Pick a ticket')} description={tr('اختر تذكرة من الطابور لعرض المحادثة والرد عليها.', 'Choose a ticket from the queue to read and reply.')} />
              </div>
            )}
          </section>

          {/* Customer */}
          <aside className="hidden min-h-0 overflow-y-auto border-s border-line-soft p-4 xl:block" aria-label={tr('بيانات العميل', 'Customer details')}>
            {active && customer ? (
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-2 text-center">
                  <Avatar name={customer.name || customer.email || '?'} size="lg" />
                  <p className="font-semibold text-ink">{customer.name || '—'}</p>
                  <p dir="ltr" className="break-all text-xs text-muted">{customer.email}</p>
                </div>
                <div className="grid gap-2">
                  <InfoTile label={tr('رقم التذكرة', 'Ticket')} value={<span dir="ltr" className="tabular">#{active.ticket_number}</span>} />
                  <InfoTile label={tr('الحالة', 'Status')} value={<Badge tone={TONE[active.status]} size="sm">{statusLabel(active.status)}</Badge>} />
                  <InfoTile label={tr('فُتحت', 'Opened')} value={fmtDateTime(active.created_at)} />
                  <InfoTile label={tr('العميل منذ', 'Customer since')} value={fmtDate(customer.created_at)} />
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted">
                <UserIcon className="h-6 w-6" aria-hidden="true" />
                {tr('تظهر بيانات العميل هنا', 'Customer details appear here')}
              </div>
            )}
          </aside>
        </div>
      </Card>

      <Modal
        open={showKnowledge}
        onClose={() => setShowKnowledge(false)}
        size="lg"
        icon={SparklesIcon}
        title={tr('قاعدة معرفة مساعد WABEK', 'WABEK AI knowledge base')}
        description={tr('معلومات إضافية يستخدمها المساعد عند الرد على التذاكر. يعرف ميزات WABEK افتراضيًا.', 'Extra information the AI uses when answering tickets. It already knows WABEK features.')}
        footer={<>
          <Button variant="secondary" onClick={() => setShowKnowledge(false)}>{tr('إلغاء', 'Cancel')}</Button>
          <Button loading={savingKnowledge} onClick={saveKnowledge}>{tr('حفظ المعرفة', 'Save knowledge')}</Button>
        </>}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-line-soft bg-surface-2 p-3.5">
            <p className="eyebrow mb-2">{tr('المعرفة المدمجة', 'Built-in knowledge')}</p>
            <ul className="space-y-1.5 text-xs text-body">
              {[
                tr('ميزات WABEK وأسعارها', 'WABEK features and pricing'),
                tr('الحملات الجماعية، الروبوت، صندوق الفريق، الرد الذكي', 'Bulk campaigns, chatbot, team inbox, AI auto-reply'),
                tr('يدعم Cloud API وواتساب ويب (Baileys)', 'Supports Cloud API + WhatsApp Web (Baileys)'),
                tr('ساعات العمل: 9 صباحًا – 6 مساءً يوميًا', 'Business hours: 9AM–6PM daily'),
                tr('بريد الدعم: support@waabek.com', 'Support email: support@waabek.com'),
              ].map(item => <li key={item} className="flex items-center gap-2"><CheckIcon className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />{item}</li>)}
            </ul>
          </div>
          <Field label={tr('معرفة مخصّصة', 'Custom knowledge')} hint={tr('اكتب نصًا عاديًا يستخدمه المساعد في إجاباته.', 'Plain text the AI uses in its answers.')}>
            <Textarea rows={9} value={knowledge} onChange={e => setKnowledge(e.target.value)} className="font-mono text-sm"
              placeholder={tr('أمثلة:\n- سياسة الاسترداد: استرداد كامل خلال 14 يومًا للباقات السنوية\n- ندعم العربية والإنجليزية والفرنسية والتركية',
                'Examples:\n- Refund policy: full refund within 14 days for annual plans\n- We support Arabic, English, French, Turkish')} />
          </Field>
        </div>
      </Modal>
    </AdminLayout>
  )
}
