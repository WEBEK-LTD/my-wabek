// @ts-nocheck
import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  UserPlusIcon, UsersIcon, ChartBarIcon, SparklesIcon, EllipsisHorizontalIcon, TrashIcon,
  PauseCircleIcon, PlayCircleIcon, EyeIcon, ChatBubbleLeftRightIcon, ShieldCheckIcon, StarIcon,
  CheckIcon, XMarkIcon, LinkIcon, BookOpenIcon,
} from '@heroicons/react/24/outline'
import {
  Avatar, Badge, Button, Card, CardHeader, ConfirmDialog, Dropdown, EmptyState, Field, Input, Modal,
  PageHeader, Select, Skeleton, Table, TBody, TD, TH, THead, TR, Tabs, cn,
} from '@/components/ui'
import { useAuthStore } from '@/lib/store'
import { CopyField, ErrorState, Notice, apiError } from '@/components/settings/Shared'
import { PerformancePanel, ReviewsPanel, NoteModal } from '@/components/settings/TeamPanels'
import { fmtDate } from '@/components/settings/format'

const ROLE_META = {
  admin:  { label: 'مدير', tone: 'violet', icon: ShieldCheckIcon },
  agent:  { label: 'وكيل', tone: 'brand', icon: ChatBubbleLeftRightIcon },
  viewer: { label: 'مشاهد', tone: 'neutral', icon: EyeIcon },
}
const STATUS_META = {
  active:    { label: 'نشط', tone: 'success' },
  pending:   { label: 'بانتظار القبول', tone: 'warning' },
  suspended: { label: 'موقوف', tone: 'danger' },
}
const ROLE_OPTIONS = [
  { value: 'agent', label: 'وكيل' },
  { value: 'admin', label: 'مدير' },
  { value: 'viewer', label: 'مشاهد' },
]

// What each role can do — shown in the invite dialog and the roles card.
const ROLE_CAPS = [
  { role: 'owner', label: 'المالك', icon: StarIcon, tone: 'bg-brand-gradient text-[#04282C]', can: ['كل الصلاحيات', 'الفوترة والباقة', 'إدارة الفريق ومفاتيح API'], cannot: [] },
  { role: 'admin', label: 'مدير', icon: ShieldCheckIcon, tone: 'bg-violet-bg text-violet', can: ['كل الصلاحيات', 'المحادثات والحملات وجهات الاتصال', 'الإعدادات والتكاملات'], cannot: [] },
  { role: 'agent', label: 'وكيل', icon: ChatBubbleLeftRightIcon, tone: 'bg-chip text-chip-ink', can: ['صندوق المحادثات والرد على العملاء', 'جهات الاتصال', 'الردود السريعة'], cannot: ['الإعدادات والفوترة'] },
  { role: 'viewer', label: 'مشاهد', icon: EyeIcon, tone: 'bg-surface-3 text-muted', can: ['عرض فقط لكل الأقسام المتاحة'], cannot: ['الإرسال أو التعديل'] },
]

const RANGES = [
  { id: '1d', label: 'اليوم' },
  { id: '7d', label: '7 أيام' },
  { id: '30d', label: '30 يومًا' },
]
const RANGE_LABEL = { '1d': 'اليوم', '7d': 'آخر 7 أيام', '30d': 'آخر 30 يومًا' }

export default function TeamPage() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const isOwner = !user?.sub_account_of  // owner has no parent account
  const [tab, setTab]           = useState<'members' | 'performance' | 'reviews'>('members')
  const [range, setRange]       = useState<'1d' | '7d' | '30d'>('7d')
  const [showInvite, setShowInvite] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', role: 'agent' })
  const [inviteUrl, setInviteUrl] = useState('')
  const [roleChange, setRoleChange] = useState<{ member: any; role: string } | null>(null)
  const [toSuspend, setToSuspend] = useState<any>(null)
  const [toRemove, setToRemove] = useState<any>(null)

  // Close invite form when switching away from members tab
  useEffect(() => { if (tab !== 'members') closeInvite() }, [tab])

  const { data, isLoading, error: teamError, refetch } = useQuery(
    'team',
    () => axios.get('/api/team').then(r => r.data),
    { onError: (e: any) => toast.error(e?.response?.data?.error || 'تعذّر تحميل الفريق') }
  )
  const members = data?.members || []
  const activeCount = members.filter(m => m.status === 'active').length
  const pendingCount = members.filter(m => m.status === 'pending').length

  const { data: reviewsData, isLoading: reviewsLoading, refetch: refetchReviews } = useQuery(
    ['ai-reviews', isOwner ? 'owner' : 'member'],
    () => axios.get('/api/ai/reviews').then(r => r.data),
    { enabled: tab === 'reviews', staleTime: 5 * 60 * 1000 }
  )

  const [commentModal, setCommentModal] = useState<{ itemId: string; current: string } | null>(null)
  const [commentText, setCommentText] = useState('')

  const commentMut = useMutation(
    ({ item_id, manual_comment }: any) => axios.put('/api/ai/reviews', { item_id, manual_comment }),
    {
      onSuccess: () => {
        qc.invalidateQueries(['ai-reviews', 'owner'])
        setCommentModal(null)
        toast.success('تم حفظ الملاحظة')
      },
      onError: (e: any) => toast.error(e?.response?.data?.error || 'تعذّر الحفظ'),
    }
  )

  const { data: perfData, isLoading: perfLoading, isFetching: perfFetching, refetch: refetchPerf } = useQuery(
    ['team-performance', range],
    () => axios.get(`/api/team/performance?range=${range}`).then(r => r.data),
    { enabled: tab === 'performance', staleTime: 0 }  // always fresh when range changes
  )
  const inviteMut = useMutation(
    (body) => axios.post('/api/team', body),
    {
      onSuccess: (r) => {
        qc.invalidateQueries('team')
        setInviteUrl(r.data.inviteUrl)
        setForm({ name: '', email: '', role: 'agent' })
        toast.success('أُنشئت الدعوة — شارك الرابط')
      },
      onError: (e) => toast.error(e?.response?.data?.error || 'تعذّر إنشاء الدعوة'),
    }
  )

  const updateMut = useMutation(
    ({ id, ...body }) => axios.put(`/api/team/${id}`, body),
    {
      onSuccess: () => { qc.invalidateQueries('team'); qc.invalidateQueries('team-performance'); toast.success('تم التحديث'); setRoleChange(null); setToSuspend(null) },
      onError: (e: any) => toast.error(e?.response?.data?.error || 'تعذّر التحديث'),
    }
  )

  const deleteMut = useMutation(
    (id) => axios.delete(`/api/team/${id}`),
    {
      onSuccess: () => { qc.invalidateQueries('team'); qc.invalidateQueries('team-performance'); toast.success('تمت إزالة العضو'); setToRemove(null) },
      onError: (e: any) => toast.error(e?.response?.data?.error || 'تعذّرت الإزالة'),
    }
  )

  const openInvite = () => { setShowInvite(true); setInviteUrl(''); setForm({ name: '', email: '', role: 'agent' }) }
  const closeInvite = () => { setShowInvite(false); setInviteUrl('') }

  const instancesList = data?.instances || []

  return (
    <DashboardLayout title="Team">
      <div className="space-y-6">
        <PageHeader
          eyebrow="الإعدادات"
          title="الفريق"
          description="ادعُ زملاءك، وحدد دور كل عضو وصناديق الوارد التي يصل إليها، وتابع أداءهم."
          actions={
            <>
              <Button variant="secondary" icon={BookOpenIcon} href="/docs/guides/team-roles">الأدوار والصلاحيات</Button>
              {isOwner && <Button icon={UserPlusIcon} onClick={openInvite}>دعوة عضو</Button>}
            </>
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs idPrefix="team" aria-label="أقسام الفريق" value={tab} onChange={v => setTab(v as typeof tab)} tabs={[
              { id: 'members', label: 'الأعضاء', icon: UsersIcon, count: members.length || undefined },
              { id: 'performance', label: 'الأداء', icon: ChartBarIcon },
              { id: 'reviews', label: 'مراجعات الذكاء الاصطناعي', icon: SparklesIcon },
            ]} />
            {tab === 'performance' && (
              <Tabs variant="segmented" size="sm" idPrefix="team-range" aria-label="الفترة" value={range} onChange={v => setRange(v as typeof range)} tabs={RANGES} />
            )}
          </div>
        </PageHeader>

        {tab === 'members' && (
          <div className="space-y-5">
            {!isOwner && (
              <Notice tone="info">أنت تشاهد الفريق كعضو. تواصل مع مالك الحساب لإجراء أي تغيير.</Notice>
            )}

            {isLoading ? (
              <Card padding="none"><div className="space-y-3 p-5">{[0, 1, 2].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div></Card>
            ) : teamError ? (
              <ErrorState title="تعذّر تحميل أعضاء الفريق" message={(teamError as any)?.response?.data?.error || 'خطأ غير معروف'} onRetry={() => refetch()} />
            ) : members.length === 0 ? (
              <EmptyState
                variant="card"
                icon={UsersIcon}
                title="لا يوجد أعضاء في الفريق بعد"
                description="ادعُ فريقك للتعاون على المحادثات وخدمة العملاء."
                action={isOwner ? <Button icon={UserPlusIcon} onClick={openInvite}>دعوة أول عضو</Button> : undefined}
              />
            ) : (
              <Card padding="none">
                <CardHeader title="أعضاء الفريق" subtitle={`${activeCount} نشط${pendingCount ? ` · ${pendingCount} دعوة معلّقة` : ''}`} divider />
                <Table minWidth={760} caption="أعضاء الفريق">
                  <THead>
                    <TR>
                      <TH>العضو</TH>
                      <TH>الدور</TH>
                      <TH>الحالة</TH>
                      {isOwner && instancesList.length > 0 && <TH>صناديق الوارد</TH>}
                      <TH>أُضيف</TH>
                      {isOwner && <TH align="end"><span className="sr-only">إجراءات</span></TH>}
                    </TR>
                  </THead>
                  <TBody>
                    {members.map(member => {
                      const role = ROLE_META[member.role] || { label: member.role, tone: 'neutral' }
                      const status = STATUS_META[member.status] || { label: member.status, tone: 'neutral' }
                      const allowed = member.allowed_instances || []
                      return (
                        <TR key={member.id}>
                          <TD>
                            <div className="flex items-center gap-3">
                              <Avatar name={member.name || member.email || '?'} size="sm" />
                              <div className="min-w-0">
                                <p className="max-w-[14rem] truncate font-medium text-ink">{member.name || '—'}</p>
                                <p className="max-w-[14rem] truncate text-xs text-muted"><span dir="ltr">{member.email}</span></p>
                              </div>
                            </div>
                          </TD>
                          <TD>
                            {isOwner && member.status === 'active' ? (
                              <Select
                                size="sm"
                                aria-label={`دور ${member.name || member.email}`}
                                value={member.role}
                                onChange={e => { if (e.target.value !== member.role) setRoleChange({ member, role: e.target.value }) }}
                                options={ROLE_OPTIONS}
                                className="w-28"
                              />
                            ) : (
                              <Badge tone={role.tone} icon={role.icon}>{role.label}</Badge>
                            )}
                          </TD>
                          <TD><Badge tone={status.tone} dot>{status.label}</Badge></TD>
                          {isOwner && instancesList.length > 0 && (
                            <TD>
                              {member.status === 'active' ? (
                                <div className="flex max-w-[18rem] flex-wrap gap-1.5" role="group" aria-label="صناديق الوارد المسموح بها (دون تحديد = الكل)">
                                  {instancesList.map(inst => {
                                    const on = allowed.includes(inst.id)
                                    return (
                                      <button
                                        key={inst.id}
                                        type="button"
                                        aria-pressed={on}
                                        onClick={() => updateMut.mutate({ id: member.id, toggle_instance: inst.id })}
                                        className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition',
                                          on ? 'border-transparent bg-brand-gradient text-[#04282C]' : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink')}
                                      >
                                        {on && <CheckIcon className="h-3 w-3" aria-hidden="true" />}
                                        {inst.display_name || inst.phone_number}
                                      </button>
                                    )
                                  })}
                                  {allowed.length === 0 && <span className="self-center text-[11px] text-muted">الكل</span>}
                                </div>
                              ) : <span className="text-xs text-muted">—</span>}
                            </TD>
                          )}
                          <TD className="text-sm text-muted">{fmtDate(member.created_at)}</TD>
                          {isOwner && (
                            <TD align="end">
                              {member.id && (
                                <Dropdown
                                  label={`خيارات ${member.name || member.email}`}
                                  triggerClassName="h-9 w-9 justify-center rounded-btn text-muted hover:bg-surface-3 hover:text-ink"
                                  trigger={<EllipsisHorizontalIcon className="h-5 w-5" />}
                                  items={[
                                    ...(member.status === 'active' ? [{ label: 'إيقاف العضو مؤقتًا', icon: PauseCircleIcon, onClick: () => setToSuspend({ member, status: 'suspended' }) }] : []),
                                    ...(member.status === 'suspended' ? [{ label: 'إعادة تفعيل العضو', icon: PlayCircleIcon, onClick: () => setToSuspend({ member, status: 'active' }) }] : []),
                                    { label: member.status === 'pending' ? 'إلغاء الدعوة' : 'إزالة من الفريق', icon: TrashIcon, danger: true, divider: member.status !== 'pending', onClick: () => setToRemove(member) },
                                  ]}
                                />
                              )}
                            </TD>
                          )}
                        </TR>
                      )
                    })}
                  </TBody>
                </Table>
                {isOwner && instancesList.length > 0 && (
                  <p className="border-t border-line-soft px-5 py-3 text-xs text-muted">صناديق الوارد: اضغط رقمًا لتقييد وصول العضو إليه. عدم تحديد أي رقم يعني الوصول إلى كل الصناديق.</p>
                )}
              </Card>
            )}

            {/* Roles */}
            <Card padding="none">
              <CardHeader title="ماذا يستطيع كل دور؟" divider />
              <div className="grid gap-px bg-line-soft sm:grid-cols-2 xl:grid-cols-4">
                {ROLE_CAPS.map(r => (
                  <div key={r.role} className="bg-surface p-5">
                    <div className="flex items-center gap-2.5">
                      <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', r.tone)}><r.icon className="h-5 w-5" aria-hidden="true" /></span>
                      <span className="font-semibold text-ink">{r.label}</span>
                    </div>
                    <ul className="mt-3 space-y-1.5 text-sm">
                      {r.can.map(c => <li key={c} className="flex items-start gap-2 text-body"><CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />{c}</li>)}
                      {r.cannot.map(c => <li key={c} className="flex items-start gap-2 text-muted"><XMarkIcon className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />{c}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {tab === 'performance' && (
          <PerformancePanel perfData={perfData} perfLoading={perfLoading} perfFetching={perfFetching} refetchPerf={refetchPerf} rangeLabel={RANGE_LABEL[range]} />
        )}

        {tab === 'reviews' && (
          <ReviewsPanel
            isOwner={isOwner}
            reviewsData={reviewsData}
            reviewsLoading={reviewsLoading}
            refetchReviews={refetchReviews}
            onEditNote={item => { setCommentModal({ itemId: item.id, current: item.manual_comment || '' }); setCommentText(item.manual_comment || '') }}
          />
        )}
      </div>

      {/* Invite */}
      <Modal
        open={showInvite}
        onClose={closeInvite}
        size="lg"
        icon={UserPlusIcon}
        title={inviteUrl ? 'الدعوة جاهزة' : 'دعوة عضو إلى الفريق'}
        description={inviteUrl ? 'تُرسل الدعوة إلى بريده الإلكتروني، ويمكنك أيضًا مشاركة الرابط مباشرة. صلاحية الرابط 7 أيام.' : 'سيصل إلى العضو رابط لإنشاء حسابه والانضمام إلى فريقك.'}
        footer={inviteUrl
          ? <><Button variant="secondary" onClick={() => setInviteUrl('')}>دعوة شخص آخر</Button><Button onClick={closeInvite}>تم</Button></>
          : <><Button variant="secondary" onClick={closeInvite}>إلغاء</Button><Button type="submit" form="invite-form" loading={inviteMut.isLoading} disabled={!form.name || !form.email}>إنشاء رابط الدعوة</Button></>}
      >
        {inviteUrl ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-ink"><LinkIcon className="h-4 w-4 text-brand-ink" aria-hidden="true" />رابط الدعوة</div>
            <CopyField value={inviteUrl} className="py-2.5" />
          </div>
        ) : (
          <form id="invite-form" className="space-y-5" onSubmit={e => { e.preventDefault(); inviteMut.mutate(form) }}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="الاسم الكامل" required>
                <Input value={form.name} onChange={e => setForm(d => ({ ...d, name: e.target.value }))} placeholder="سارة محمود" />
              </Field>
              <Field label="البريد الإلكتروني" required>
                <Input type="email" value={form.email} onChange={e => setForm(d => ({ ...d, email: e.target.value }))} placeholder="sara@example.com" dir="ltr" />
              </Field>
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-ink">الدور</legend>
              <div className="grid gap-2 sm:grid-cols-3" role="radiogroup">
                {ROLE_CAPS.filter(r => r.role !== 'owner').map(r => {
                  const selected = form.role === r.role
                  return (
                    <button key={r.role} type="button" role="radio" aria-checked={selected} onClick={() => setForm(d => ({ ...d, role: r.role }))}
                      className={cn('rounded-card border p-3 text-start transition', selected ? 'border-brand-teal bg-chip/40 shadow-ring' : 'border-line hover:border-line-strong')}>
                      <span className="flex items-center gap-2">
                        <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', r.tone)}><r.icon className="h-4 w-4" aria-hidden="true" /></span>
                        <span className="text-sm font-semibold text-ink">{r.label}</span>
                      </span>
                      <span className="mt-2 block text-xs leading-relaxed text-muted">{r.can.join('، ')}</span>
                    </button>
                  )
                })}
              </div>
            </fieldset>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!roleChange}
        onClose={() => setRoleChange(null)}
        onConfirm={() => { if (roleChange) updateMut.mutate({ id: roleChange.member.id, role: roleChange.role }) }}
        loading={updateMut.isLoading}
        title="تغيير الدور؟"
        description={roleChange ? `سيصبح ${roleChange.member.name || roleChange.member.email} «${ROLE_META[roleChange.role]?.label}». تُطبَّق الصلاحيات الجديدة فورًا.` : ''}
        confirmLabel="تغيير الدور"
      />
      <ConfirmDialog
        destructive={toSuspend?.status === 'suspended'}
        open={!!toSuspend}
        onClose={() => setToSuspend(null)}
        onConfirm={() => { if (toSuspend) updateMut.mutate({ id: toSuspend.member.id, status: toSuspend.status }) }}
        loading={updateMut.isLoading}
        title={toSuspend?.status === 'suspended' ? 'إيقاف العضو مؤقتًا؟' : 'إعادة تفعيل العضو؟'}
        description={toSuspend?.status === 'suspended'
          ? 'سيُسجَّل خروجه فورًا ولن يتمكن من الدخول حتى تعيد تفعيله.'
          : 'سيتمكن العضو من تسجيل الدخول مجددًا بدوره الحالي.'}
        confirmLabel={toSuspend?.status === 'suspended' ? 'إيقاف' : 'إعادة التفعيل'}
      />
      <ConfirmDialog
        destructive
        open={!!toRemove}
        onClose={() => setToRemove(null)}
        onConfirm={() => { if (toRemove) deleteMut.mutate(toRemove.id) }}
        loading={deleteMut.isLoading}
        title={toRemove?.status === 'pending' ? 'إلغاء الدعوة؟' : 'إزالة العضو من الفريق؟'}
        description={`سيفقد ${toRemove?.name || toRemove?.email || 'العضو'} الوصول إلى الحساب فورًا.`}
        confirmLabel="إزالة"
      />

      <NoteModal
        open={!!commentModal}
        onClose={() => setCommentModal(null)}
        value={commentText}
        onChange={setCommentText}
        saving={commentMut.isLoading}
        onSave={() => commentModal && commentMut.mutate({ item_id: commentModal.itemId, manual_comment: commentText })}
      />
    </DashboardLayout>
  )
}
