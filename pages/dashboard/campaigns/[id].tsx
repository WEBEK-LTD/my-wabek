import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/router'
import DashboardLayout from '@/components/layout/DashboardLayout'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  PlayIcon, PauseIcon, TrashIcon, UsersIcon, PaperAirplaneIcon, CheckCircleIcon, EyeIcon, XCircleIcon,
  MegaphoneIcon, ExclamationTriangleIcon, InboxIcon, CheckBadgeIcon, Cog6ToothIcon, ArrowPathIcon,
  ChatBubbleLeftEllipsisIcon, LockClosedIcon,
} from '@heroicons/react/24/outline'
import {
  Avatar, Badge, Button, Card, CardHeader, ConfirmDialog, EmptyState, PageHeader, SearchInput, Skeleton,
  StatCard, StatusPill, Table, TBody, TD, TH, THead, TR, Tabs,
} from '@/components/ui'
import { ErrorState, InfoRow, Notice } from '@/components/settings/Shared'
import { fmtDateTime, fmtTime, fmtDate } from '@/components/settings/format'
import { DeliveryBar, funnel } from '@/components/campaigns/DeliveryBar'
import { Funnel } from '@/components/campaigns/Funnel'
import { WhatsAppPreview } from '@/components/campaigns/WhatsAppPreview'
import {
  DELIVERY_COLORS, campaignStatus, errorStatus, fmtNum, friendlyError, isMemberForbidden, messageStatus, pct,
  startResultMessage, useTeamRole, MEMBER_FORBIDDEN_MSG,
} from '@/components/campaigns/shared'

const PAGE = 50

export default function CampaignDetailPage() {
  const router = useRouter()
  const { id } = router.query
  const [campaign, setCampaign] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<unknown>(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const [busy, setBusy] = useState<'start' | 'pause' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { canWrite, roleLabel } = useTeamRole()
  const canManage = canWrite('campaigns')

  useEffect(() => {
    if (!id) return
    load()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (campaign?.status !== 'running') return
    const interval = setInterval(load, 3000)
    return () => clearInterval(interval)
  }, [campaign?.status, id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    try {
      const [cRes, mRes] = await Promise.all([
        axios.get(`/api/campaigns?id=${id}`),
        axios.get(`/api/campaigns/${id}/messages`),
      ])
      const camp = (cRes.data.campaigns || []).find((c: any) => c.id === id) || cRes.data.campaign
      setCampaign(camp)
      setMessages(mRes.data.messages || [])
      setLoadError(null)
    } catch (e) {
      setLoadError(e)
    }
    setLoading(false)
  }

  const stats = useMemo(() => ({
    total:     messages.length,
    sent:      messages.filter(m => ['sent', 'delivered', 'read'].includes(m.status)).length,
    delivered: messages.filter(m => m.status === 'delivered').length,
    read:      messages.filter(m => m.status === 'read').length,
    failed:    messages.filter(m => m.status === 'failed').length,
    pending:   messages.filter(m => ['pending', 'waiting'].includes(m.status)).length,
  }), [messages])

  const matchesFilter = (m: any) =>
    filter === 'all' ? true :
    filter === 'read' ? m.status === 'read' :
    filter === 'delivered' ? m.status === 'delivered' :
    filter === 'failed' ? m.status === 'failed' :
    filter === 'sent' ? ['sent', 'delivered', 'read'].includes(m.status) :
    filter === 'pending' ? ['pending', 'waiting'].includes(m.status) :
    true
  const q = search.trim().toLowerCase()
  const filtered = messages.filter(m => matchesFilter(m) &&
    (!q || `${m.contacts?.name || ''} ${m.contacts?.phone || ''}`.toLowerCase().includes(q)))

  // Failure reasons, most frequent first
  const reasons = useMemo(() => {
    const map = new Map<string, { reason: string; code?: string | number; count: number }>()
    for (const m of messages) {
      if (m.status !== 'failed') continue
      const reason = String(m.meta?.error || m.meta?.error_msg || 'سبب غير معروف')
      const code = m.meta?.code
      const key = `${code || ''}|${reason}`
      const cur = map.get(key)
      if (cur) cur.count++
      else map.set(key, { reason, code, count: 1 })
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  }, [messages])

  const runAction = async (action: 'start' | 'pause') => {
    setBusy(action)
    // A start keeps the request open while the batch is sent: refresh early
    // so the page switches to "running" and polls the progress.
    const early = action === 'start' ? setTimeout(load, 1500) : null
    try {
      const r = await axios.post(`/api/campaigns/${id}`, { action })
      if (action === 'pause') toast.success('أُوقفت الحملة مؤقتًا')
      else { const m = startResultMessage(r.data); (m.ok ? toast.success : toast.error)(m.text) }
    } catch (e) {
      toast.error(friendlyError(e, 'تعذّر تنفيذ الإجراء'))
    } finally {
      if (early) clearTimeout(early)
      setBusy(null)
      load()
    }
  }

  const remove = async () => {
    setDeleting(true)
    try {
      await axios.delete(`/api/campaigns/${id}`)
      toast.success('حُذفت الحملة')
      router.push('/dashboard/campaigns')
    } catch (e) {
      toast.error(friendlyError(e, 'تعذّر حذف الحملة'))
      setDeleting(false)
    }
  }

  if (loading) return (
    <DashboardLayout title="Campaign">
      <div className="space-y-5" aria-busy="true" aria-label="جارٍ تحميل الحملة">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-40 w-full rounded-panel" />
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
          {[0, 1, 2, 3, 4].map(i => <StatCard key={i} label="" value="" loading />)}
        </div>
        <Skeleton className="h-72 w-full rounded-panel" />
      </div>
    </DashboardLayout>
  )

  if (!campaign) return (
    <DashboardLayout title="Campaign">
      <div className="space-y-6">
        <PageHeader back={{ href: '/dashboard/campaigns', label: 'الحملات' }} title="تفاصيل الحملة" />
        {loadError && errorStatus(loadError) !== 404 ? (
          <ErrorState
            title={isMemberForbidden(loadError) ? 'لا يمكنك عرض هذه الحملة' : 'تعذّر تحميل الحملة'}
            message={isMemberForbidden(loadError) ? MEMBER_FORBIDDEN_MSG : friendlyError(loadError)}
            onRetry={() => { setLoading(true); load() }}
          />
        ) : (
          <EmptyState variant="card" icon={MegaphoneIcon} title="لم يُعثر على الحملة"
            description="ربما حُذفت أو لا تنتمي إلى حسابك."
            action={<Button href="/dashboard/campaigns">العودة إلى الحملات</Button>} />
        )}
      </div>
    </DashboardLayout>
  )

  const st = campaignStatus(campaign.status)
  const running = campaign.status === 'running'
  const startable = ['draft', 'scheduled', 'paused'].includes(campaign.status)
  const total = Math.max(campaign.total_contacts || 0, stats.total)
  const f = funnel({ total, sent: stats.sent, delivered: stats.delivered + stats.read, read: stats.read, failed: stats.failed })
  const processed = f.sent + f.failed
  const progress = pct(processed, f.total)
  const meta = campaign.meta || {}
  const filterInfo = campaign.contact_filter || {}
  const audience = filterInfo.segment_id ? 'شريحة محفوظة' + (Array.isArray(filterInfo.conditions) ? ` (${filterInfo.conditions.length} قواعد)` : '')
    : Array.isArray(filterInfo.tags) && filterInfo.tags.length ? `الوسوم: ${filterInfo.tags.join('، ')}` : 'جميع جهات الاتصال'
  const visible = filtered.slice(0, limit)

  const tabs = [
    { id: 'all', label: 'الكل', count: stats.total },
    { id: 'sent', label: 'أُرسلت', count: stats.sent },
    { id: 'delivered', label: 'وصلت', count: stats.delivered },
    { id: 'read', label: 'قُرئت', count: stats.read },
    { id: 'failed', label: 'فشلت', count: stats.failed },
    ...(stats.pending ? [{ id: 'pending', label: 'قيد الانتظار', count: stats.pending }] : []),
  ]

  return (
    <DashboardLayout title={campaign.name || 'Campaign'}>
      <div className="space-y-6">
        <PageHeader
          back={{ href: '/dashboard/campaigns', label: 'الحملات' }}
          eyebrow="تقرير الحملة"
          title={<span className="flex flex-wrap items-center gap-3">{campaign.name}<StatusPill status={campaign.status} tone={st.tone} pulse={running}>{st.label}</StatusPill></span>}
          description={
            <span className="flex flex-wrap gap-x-4 gap-y-1">
              <span>أُنشئت {fmtDate(campaign.created_at)}</span>
              {campaign.template_name && <span className="flex items-center gap-1"><CheckBadgeIcon className="h-4 w-4" aria-hidden="true" /><span dir="ltr" className="font-mono text-[13px]">{campaign.template_name}{campaign.template_language ? ` · ${campaign.template_language}` : ''}</span></span>}
              {campaign.status === 'scheduled' && campaign.scheduled_at && <span className="text-warning">موعدها {fmtDateTime(campaign.scheduled_at)}</span>}
            </span>
          }
          actions={canManage ? (
            <>
              {startable && (
                <Button icon={PlayIcon} loading={busy === 'start'} disabled={!!busy} onClick={() => runAction('start')}>
                  {campaign.status === 'paused' ? 'استئناف الإرسال' : campaign.status === 'scheduled' ? 'ابدأ الآن' : 'بدء الإرسال'}
                </Button>
              )}
              {running && (
                <Button variant="secondary" icon={PauseIcon} loading={busy === 'pause'} disabled={!!busy} onClick={() => runAction('pause')}>إيقاف مؤقت</Button>
              )}
              {!running && (
                <Button variant="danger-soft" icon={TrashIcon} onClick={() => setConfirmDelete(true)}>حذف</Button>
              )}
            </>
          ) : undefined}
        />

        {!canManage && (
          <Notice tone="info" icon={LockClosedIcon}>
            صلاحيتك في الفريق ({roleLabel}) تتيح عرض التقرير فقط؛ يقتصر بدء الحملة وإيقافها وحذفها على المالك ومسؤولي الفريق.
          </Notice>
        )}
        {loadError && <Notice tone="warning">تعذّر تحديث البيانات؛ تُعرض آخر نسخة محمّلة. {friendlyError(loadError)}</Notice>}
        {meta.error && <Notice tone="danger" title="توقفت الحملة">{meta.error === 'Campaign stopped due to an internal error' ? 'توقفت الحملة بسبب خطأ داخلي. يمكنك استئنافها من حيث توقفت.' : String(meta.error)}</Notice>}
        {campaign.status === 'paused' && processed > 0 && (
          <Notice tone="warning" icon={PauseIcon}>الحملة متوقفة مؤقتًا عند {fmtNum(processed)} من {fmtNum(f.total)}. عند الاستئناف تُكمل من حيث توقفت دون تكرار.</Notice>
        )}

        {/* Progress hero */}
        <Card variant="deep" padding="lg" className="overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute -end-16 -top-20 h-56 w-56 rounded-full bg-brand-green/20 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 start-10 h-56 w-56 rounded-full bg-brand-teal/25 blur-3xl" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-end">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-deep-muted">{running ? 'جارٍ الإرسال الآن' : campaign.status === 'completed' ? 'اكتمل الإرسال' : 'تقدّم الإرسال'}</p>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="text-4xl font-bold tabular text-deep-ink">{progress}%</span>
                <span className="text-sm text-deep-muted">تمت معالجة <span className="tabular">{fmtNum(processed)}</span> من <span className="tabular">{fmtNum(f.total)}</span></span>
                {running && <ArrowPathIcon className="h-4 w-4 animate-spin text-deep-muted" aria-label="يتحدّث تلقائيًا" />}
              </p>
              <DeliveryBar className="mt-4" size="lg" counts={f} />
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-deep-muted">
                {[
                  { label: 'قُرئت', v: f.read, c: DELIVERY_COLORS.read },
                  { label: 'وصلت', v: f.delivered, c: DELIVERY_COLORS.delivered },
                  { label: 'أُرسلت', v: f.sent, c: DELIVERY_COLORS.sent },
                  { label: 'فشلت', v: f.failed, c: DELIVERY_COLORS.failed },
                ].map(s => (
                  <li key={s.label} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-[3px]" style={{ background: s.c }} aria-hidden="true" />{s.label}
                    <span className="font-semibold text-deep-ink tabular">{fmtNum(s.v)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <dl className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-2 text-sm md:text-end">
              <dt className="text-deep-muted">بدأت</dt><dd className="text-deep-ink">{campaign.started_at ? fmtDateTime(campaign.started_at) : '—'}</dd>
              <dt className="text-deep-muted">انتهت</dt><dd className="text-deep-ink">{campaign.completed_at ? fmtDateTime(campaign.completed_at) : '—'}</dd>
            </dl>
          </div>
        </Card>

        {/* Funnel stat cards */}
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
          <StatCard label="المستهدفون" value={fmtNum(f.total)} icon={UsersIcon} sub={`${fmtNum(stats.total)} رسالة مسجّلة`} />
          <StatCard label="أُرسلت" value={fmtNum(f.sent)} icon={PaperAirplaneIcon} progress={pct(f.sent, f.total)} sub={`${pct(f.sent, f.total)}% من المستهدفين`} />
          <StatCard label="وصلت" value={fmtNum(f.delivered)} icon={CheckCircleIcon} progress={pct(f.delivered, f.sent)} sub={`${pct(f.delivered, f.sent)}% من المرسلة`} subTone="success" />
          <StatCard label="قُرئت" value={fmtNum(f.read)} icon={EyeIcon} progress={pct(f.read, f.sent)} sub={`${pct(f.read, f.sent)}% من المرسلة`} subTone="brand" />
          <StatCard label="فشلت" value={fmtNum(f.failed)} icon={XCircleIcon} sub={f.failed ? `${pct(f.failed, processed)}% من المعالجة` : 'لا إخفاقات'} subTone={f.failed ? 'danger' : 'success'} />
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Card>
            <CardHeader title="مسار التسليم" subtitle="النسبة بجوار كل مرحلة محسوبة من المرحلة السابقة" icon={MegaphoneIcon} />
            <div className="mt-5">
              <Funnel stages={[
                { label: 'المستهدفون', value: f.total, color: '#B59CF5' },
                { label: 'أُرسلت', value: f.sent, color: DELIVERY_COLORS.sent },
                { label: 'وصلت', value: f.delivered, color: DELIVERY_COLORS.delivered },
                { label: 'قُرئت', value: f.read, color: DELIVERY_COLORS.read },
              ]} />
            </div>
          </Card>

          <Card>
            <CardHeader title="أسباب الفشل" icon={ExclamationTriangleIcon}
              subtitle={reasons.length ? `${fmtNum(stats.failed)} رسالة فشلت لـ ${fmtNum(reasons.length)} ${reasons.length === 1 ? 'سبب' : 'أسباب'}` : undefined} />
            <div className="mt-4">
              {Number(meta.reengagement_blocked) > 0 && (
                <Notice tone="warning" className="mb-3" title={`${fmtNum(meta.reengagement_blocked)} مستلم خارج نافذة الـ 24 ساعة`}>
                  رفضت Meta الإرسال (الرمز 131047). استخدم قالبًا معتمدًا لمراسلة من لم يتواصل معك مؤخرًا.
                </Notice>
              )}
              {reasons.length === 0 ? (
                <EmptyState size="sm" icon={CheckCircleIcon} title="لا توجد إخفاقات" description="لم تفشل أي رسالة في هذه الحملة حتى الآن." />
              ) : (
                <ul className="space-y-2.5">
                  {reasons.slice(0, 6).map(r => (
                    <li key={`${r.code}|${r.reason}`} className="rounded-card border border-line-soft bg-surface-2 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p dir="auto" className="min-w-0 break-words text-[13px] text-ink">{r.reason}</p>
                        <Badge tone="danger" size="sm" className="shrink-0"><span className="tabular">{fmtNum(r.count)}</span></Badge>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        {r.code && <code dir="ltr" className="font-mono text-[11px] text-muted">#{r.code}</code>}
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-track" aria-hidden="true">
                          <div className="h-full rounded-full bg-danger/70" style={{ width: `${pct(r.count, stats.failed)}%` }} />
                        </div>
                        <span className="text-[11px] text-muted tabular">{pct(r.count, stats.failed)}%</span>
                      </div>
                    </li>
                  ))}
                  {reasons.length > 6 && (
                    <li><Button size="xs" variant="ghost" onClick={() => setFilter('failed')}>عرض كل الرسائل الفاشلة</Button></li>
                  )}
                </ul>
              )}
            </div>
          </Card>
        </div>

        {/* Recipients */}
        <Card padding="none">
          <CardHeader className="px-5 pt-5 sm:px-6" title="المستلمون" icon={InboxIcon}
            subtitle={`${fmtNum(filtered.length)} رسالة${filter !== 'all' || q ? ' مطابقة' : ''}`} />
          <div className="flex flex-col gap-3 px-5 pb-4 pt-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="-mx-1 overflow-x-auto px-1 scrollbar-none">
              <Tabs variant="segmented" size="sm" value={filter} onChange={v => { setFilter(v); setLimit(PAGE) }} aria-label="تصفية حسب حالة الرسالة" tabs={tabs} />
            </div>
            <SearchInput size="sm" value={search} onChange={v => { setSearch(v); setLimit(PAGE) }} placeholder="ابحث بالاسم أو الرقم" className="lg:w-64" />
          </div>
          {messages.length === 0 ? (
            <EmptyState size="sm" icon={PaperAirplaneIcon} title="لا توجد رسائل بعد"
              description={startable ? 'ستظهر الرسائل هنا فور بدء الإرسال.' : 'لم تُسجَّل أي رسالة لهذه الحملة.'} />
          ) : filtered.length === 0 ? (
            <EmptyState size="sm" icon={InboxIcon} title="لا توجد رسائل مطابقة" description="غيّر عامل التصفية أو كلمة البحث." />
          ) : (
            <>
              <Table minWidth={760} caption="رسائل الحملة">
                <THead>
                  <TR>
                    <TH>جهة الاتصال</TH>
                    <TH>الحالة</TH>
                    <TH>معرّف الرسالة</TH>
                    <TH>الوقت</TH>
                    <TH>الخطأ</TH>
                  </TR>
                </THead>
                <TBody>
                  {visible.map((msg: any) => {
                    const ms = messageStatus(msg.status)
                    const errMsg = msg.meta?.error || msg.meta?.error_msg || ''
                    const name = msg.contacts?.name || ''
                    const phone = msg.contacts?.phone || ''
                    return (
                      <TR key={msg.id}>
                        <TD>
                          <div className="flex items-center gap-2.5">
                            <Avatar name={name || phone || '?'} size="sm" />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-ink">{name || '—'}</p>
                              <p dir="ltr" className="text-start font-mono text-xs text-muted">{phone || '—'}</p>
                            </div>
                          </div>
                        </TD>
                        <TD><StatusPill status={msg.status} tone={ms.tone}>{ms.label}</StatusPill></TD>
                        <TD>
                          <code dir="ltr" className="font-mono text-xs text-muted" title={msg.wa_message_id || undefined}>
                            {msg.wa_message_id ? '…' + msg.wa_message_id.slice(-10) : '—'}
                          </code>
                        </TD>
                        <TD sub={fmtDate(msg.created_at)}><span className="tabular">{fmtTime(msg.created_at)}</span></TD>
                        <TD>
                          {errMsg ? <span dir="auto" className="block max-w-[220px] truncate text-xs text-danger" title={errMsg}>{errMsg}</span> : <span className="text-muted">—</span>}
                        </TD>
                      </TR>
                    )
                  })}
                </TBody>
              </Table>
              {filtered.length > limit && (
                <div className="flex items-center justify-center gap-3 border-t border-line-soft p-4">
                  <span className="text-xs text-muted">عُرضت {fmtNum(limit)} من {fmtNum(filtered.length)}</span>
                  <Button size="sm" variant="secondary" onClick={() => setLimit(l => l + PAGE * 2)}>عرض المزيد</Button>
                </div>
              )}
            </>
          )}
        </Card>

        {/* Settings + message */}
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="إعدادات الحملة" icon={Cog6ToothIcon} />
            <div className="mt-3">
              <InfoRow label="الجمهور">{audience}</InfoRow>
              <InfoRow label="نوع الإرسال">{campaign.template_name ? 'قالب معتمد' : 'نص حر'}</InfoRow>
              {campaign.template_name && <InfoRow label="القالب"><span dir="ltr" className="font-mono text-[13px]">{campaign.template_name}{campaign.template_language ? ` · ${campaign.template_language}` : ''}</span></InfoRow>}
              {Array.isArray(campaign.template_variables) && campaign.template_variables.length > 0 && (
                <InfoRow label="المتغيرات"><span dir="ltr" className="font-mono text-[13px]">{campaign.template_variables.map((v: string) => v || '∅').join(' · ')}</span></InfoRow>
              )}
              <InfoRow label="الموعد">{campaign.scheduled_at ? fmtDateTime(campaign.scheduled_at) : 'فور البدء'}</InfoRow>
              <InfoRow label="الفاصل بين الرسائل"><span className="tabular">{campaign.delay_seconds || 3}</span> ثوانٍ</InfoRow>
            </div>
          </Card>
          <Card>
            <CardHeader title="نص الرسالة" icon={ChatBubbleLeftEllipsisIcon}
              subtitle={campaign.template_name ? 'يصل نص القالب المعتمد مع قيم المتغيرات لكل مستلم' : 'تُستبدل المتغيرات ببيانات كل مستلم'} />
            <WhatsAppPreview className="mt-4" message={campaign.message || ''} contactName="جهة الاتصال" />
          </Card>
        </div>
      </div>

      <ConfirmDialog
        destructive
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        loading={deleting}
        title="حذف الحملة؟"
        description={`ستُحذف حملة «${campaign.name}» وتقريرها نهائيًا. لا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel="حذف"
      />
    </DashboardLayout>
  )
}
