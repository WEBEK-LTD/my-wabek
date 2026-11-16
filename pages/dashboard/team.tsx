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
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/dashboard/team'

// Labels are dictionary keys (locales/dashboard/team.ts).
const ROLE_META = {
  admin:  { label: 'role_admin', tone: 'violet', icon: ShieldCheckIcon },
  agent:  { label: 'role_agent', tone: 'brand', icon: ChatBubbleLeftRightIcon },
  viewer: { label: 'role_viewer', tone: 'neutral', icon: EyeIcon },
}
const STATUS_META = {
  active:    { label: 'status_active', tone: 'success' },
  pending:   { label: 'status_pending', tone: 'warning' },
  suspended: { label: 'status_suspended', tone: 'danger' },
}
const ROLE_OPTIONS = [
  { value: 'agent', label: 'role_agent' },
  { value: 'admin', label: 'role_admin' },
  { value: 'viewer', label: 'role_viewer' },
]

// What each role can do — shown in the invite dialog and the roles card.
const ROLE_CAPS = [
  { role: 'owner', label: 'role_owner', icon: StarIcon, tone: 'bg-brand-gradient text-[#04282C]', can: ['cap_all', 'cap_billing', 'cap_team_api'], cannot: [] },
  { role: 'admin', label: 'role_admin', icon: ShieldCheckIcon, tone: 'bg-violet-bg text-violet', can: ['cap_all', 'cap_core', 'cap_settings'], cannot: [] },
  { role: 'agent', label: 'role_agent', icon: ChatBubbleLeftRightIcon, tone: 'bg-chip text-chip-ink', can: ['cap_inbox', 'cap_contacts', 'cap_quick'], cannot: ['cap_no_settings'] },
  { role: 'viewer', label: 'role_viewer', icon: EyeIcon, tone: 'bg-surface-3 text-muted', can: ['cap_view_only'], cannot: ['cap_no_edit'] },
]

const RANGES = ['1d', '7d', '30d']

export default function TeamPage() {
  const { t, fmtDate } = useT(messages)
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
    { onError: (e: any) => toast.error(apiError(e, t('loadTeamError'))) }
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
        toast.success(t('noteSaved'))
      },
      onError: (e: any) => toast.error(apiError(e, t('saveError'))),
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
        toast.success(t('inviteCreated'))
      },
      onError: (e) => toast.error(apiError(e, t('inviteError'))),
    }
  )

  const updateMut = useMutation(
    ({ id, ...body }) => axios.put(`/api/team/${id}`, body),
    {
      onSuccess: () => { qc.invalidateQueries('team'); qc.invalidateQueries('team-performance'); toast.success(t('updated')); setRoleChange(null); setToSuspend(null) },
      onError: (e: any) => toast.error(apiError(e, t('updateError'))),
    }
  )

  const deleteMut = useMutation(
    (id) => axios.delete(`/api/team/${id}`),
    {
      onSuccess: () => { qc.invalidateQueries('team'); qc.invalidateQueries('team-performance'); toast.success(t('memberRemoved')); setToRemove(null) },
      onError: (e: any) => toast.error(apiError(e, t('removeError'))),
    }
  )

  const openInvite = () => { setShowInvite(true); setInviteUrl(''); setForm({ name: '', email: '', role: 'agent' }) }
  const closeInvite = () => { setShowInvite(false); setInviteUrl('') }

  const instancesList = data?.instances || []

  return (
    <DashboardLayout title={t('title')}>
      <div className="space-y-6">
        <PageHeader
          eyebrow={t('eyebrow')}
          title={t('title')}
          description={t('description')}
          actions={
            <>
              <Button variant="secondary" icon={BookOpenIcon} href="/docs/guides/team-roles">{t('rolesDocs')}</Button>
              {isOwner && <Button icon={UserPlusIcon} onClick={openInvite}>{t('invite')}</Button>}
            </>
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs idPrefix="team" aria-label={t('tabsLabel')} value={tab} onChange={v => setTab(v as typeof tab)} tabs={[
              { id: 'members', label: t('tab_members'), icon: UsersIcon, count: members.length || undefined },
              { id: 'performance', label: t('tab_performance'), icon: ChartBarIcon },
              { id: 'reviews', label: t('tab_reviews'), icon: SparklesIcon },
            ]} />
            {tab === 'performance' && (
              <Tabs variant="segmented" size="sm" idPrefix="team-range" aria-label={t('periodLabel')} value={range} onChange={v => setRange(v as typeof range)} tabs={RANGES.map(id => ({ id, label: t(`range_${id}`) }))} />
            )}
          </div>
        </PageHeader>

        {tab === 'members' && (
          <div className="space-y-5">
            {!isOwner && (
              <Notice tone="info">{t('memberNotice')}</Notice>
            )}

            {isLoading ? (
              <Card padding="none"><div className="space-y-3 p-5">{[0, 1, 2].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div></Card>
            ) : teamError ? (
              <ErrorState title={t('loadMembersError')} message={apiError(teamError, t('unknownError'))} onRetry={() => refetch()} />
            ) : members.length === 0 ? (
              <EmptyState
                variant="card"
                icon={UsersIcon}
                title={t('emptyTitle')}
                description={t('emptyDesc')}
                action={isOwner ? <Button icon={UserPlusIcon} onClick={openInvite}>{t('inviteFirst')}</Button> : undefined}
              />
            ) : (
              <Card padding="none">
                <CardHeader title={t('membersTitle')} subtitle={`${t('activeCount', { n: activeCount })}${pendingCount ? ` · ${t(pendingCount === 1 ? 'pendingOne' : 'pendingMany', { n: pendingCount })}` : ''}`} divider />
                <Table minWidth={760} caption={t('membersTitle')}>
                  <THead>
                    <TR>
                      <TH>{t('th_member')}</TH>
                      <TH>{t('th_role')}</TH>
                      <TH>{t('th_status')}</TH>
                      {isOwner && instancesList.length > 0 && <TH>{t('th_inboxes')}</TH>}
                      <TH>{t('th_added')}</TH>
                      {isOwner && <TH align="end"><span className="sr-only">{t('th_actions')}</span></TH>}
                    </TR>
                  </THead>
                  <TBody>
                    {members.map(member => {
                      const roleMeta = ROLE_META[member.role]
                      const role = roleMeta ? { ...roleMeta, label: t(roleMeta.label) } : { label: member.role, tone: 'neutral' }
                      const statusMeta = STATUS_META[member.status]
                      const status = statusMeta ? { ...statusMeta, label: t(statusMeta.label) } : { label: member.status, tone: 'neutral' }
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
                                aria-label={t('roleOf', { name: member.name || member.email })}
                                value={member.role}
                                onChange={e => { if (e.target.value !== member.role) setRoleChange({ member, role: e.target.value }) }}
                                options={ROLE_OPTIONS.map(o => ({ value: o.value, label: t(o.label) }))}
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
                                <div className="flex max-w-[18rem] flex-wrap gap-1.5" role="group" aria-label={t('inboxesGroup')}>
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
                                  {allowed.length === 0 && <span className="self-center text-[11px] text-muted">{t('all')}</span>}
                                </div>
                              ) : <span className="text-xs text-muted">—</span>}
                            </TD>
                          )}
                          <TD className="text-sm text-muted">{fmtDate(member.created_at)}</TD>
                          {isOwner && (
                            <TD align="end">
                              {member.id && (
                                <Dropdown
                                  label={t('optionsFor', { name: member.name || member.email })}
                                  triggerClassName="h-9 w-9 justify-center rounded-btn text-muted hover:bg-surface-3 hover:text-ink"
                                  trigger={<EllipsisHorizontalIcon className="h-5 w-5" />}
                                  items={[
                                    ...(member.status === 'active' ? [{ label: t('suspend'), icon: PauseCircleIcon, onClick: () => setToSuspend({ member, status: 'suspended' }) }] : []),
                                    ...(member.status === 'suspended' ? [{ label: t('reactivate'), icon: PlayCircleIcon, onClick: () => setToSuspend({ member, status: 'active' }) }] : []),
                                    { label: member.status === 'pending' ? t('cancelInvite') : t('removeFromTeam'), icon: TrashIcon, danger: true, divider: member.status !== 'pending', onClick: () => setToRemove(member) },
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
                  <p className="border-t border-line-soft px-5 py-3 text-xs text-muted">{t('inboxesHint')}</p>
                )}
              </Card>
            )}

            {/* Roles */}
            <Card padding="none">
              <CardHeader title={t('rolesCardTitle')} divider />
              <div className="grid gap-px bg-line-soft sm:grid-cols-2 xl:grid-cols-4">
                {ROLE_CAPS.map(r => (
                  <div key={r.role} className="bg-surface p-5">
                    <div className="flex items-center gap-2.5">
                      <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', r.tone)}><r.icon className="h-5 w-5" aria-hidden="true" /></span>
                      <span className="font-semibold text-ink">{t(r.label)}</span>
                    </div>
                    <ul className="mt-3 space-y-1.5 text-sm">
                      {r.can.map(c => <li key={c} className="flex items-start gap-2 text-body"><CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />{t(c)}</li>)}
                      {r.cannot.map(c => <li key={c} className="flex items-start gap-2 text-muted"><XMarkIcon className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />{t(c)}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {tab === 'performance' && (
          <PerformancePanel perfData={perfData} perfLoading={perfLoading} perfFetching={perfFetching} refetchPerf={refetchPerf} rangeLabel={t(`rangeLabel_${range}`)} />
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
        title={inviteUrl ? t('inviteReadyTitle') : t('inviteTitle')}
        description={inviteUrl ? t('inviteReadyDesc') : t('inviteDesc')}
        footer={inviteUrl
          ? <><Button variant="secondary" onClick={() => setInviteUrl('')}>{t('inviteAnother')}</Button><Button onClick={closeInvite}>{t('done')}</Button></>
          : <><Button variant="secondary" onClick={closeInvite}>{t('cancel')}</Button><Button type="submit" form="invite-form" loading={inviteMut.isLoading} disabled={!form.name || !form.email}>{t('createInvite')}</Button></>}
      >
        {inviteUrl ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-ink"><LinkIcon className="h-4 w-4 text-brand-ink" aria-hidden="true" />{t('inviteLink')}</div>
            <CopyField value={inviteUrl} className="py-2.5" />
          </div>
        ) : (
          <form id="invite-form" className="space-y-5" onSubmit={e => { e.preventDefault(); inviteMut.mutate(form) }}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('fullName')} required>
                <Input value={form.name} onChange={e => setForm(d => ({ ...d, name: e.target.value }))} placeholder={t('namePlaceholder')} />
              </Field>
              <Field label={t('email')} required>
                <Input type="email" value={form.email} onChange={e => setForm(d => ({ ...d, email: e.target.value }))} placeholder="sara@example.com" dir="ltr" />
              </Field>
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-ink">{t('roleLegend')}</legend>
              <div className="grid gap-2 sm:grid-cols-3" role="radiogroup">
                {ROLE_CAPS.filter(r => r.role !== 'owner').map(r => {
                  const selected = form.role === r.role
                  return (
                    <button key={r.role} type="button" role="radio" aria-checked={selected} onClick={() => setForm(d => ({ ...d, role: r.role }))}
                      className={cn('rounded-card border p-3 text-start transition', selected ? 'border-brand-teal bg-chip/40 shadow-ring' : 'border-line hover:border-line-strong')}>
                      <span className="flex items-center gap-2">
                        <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', r.tone)}><r.icon className="h-4 w-4" aria-hidden="true" /></span>
                        <span className="text-sm font-semibold text-ink">{t(r.label)}</span>
                      </span>
                      <span className="mt-2 block text-xs leading-relaxed text-muted">{r.can.map(c => t(c)).join(t('listSep'))}</span>
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
        title={t('changeRoleTitle')}
        description={roleChange ? t('changeRoleDesc', { name: roleChange.member.name || roleChange.member.email, role: ROLE_META[roleChange.role] ? t(ROLE_META[roleChange.role].label) : roleChange.role }) : ''}
        confirmLabel={t('changeRoleConfirm')}
      />
      <ConfirmDialog
        destructive={toSuspend?.status === 'suspended'}
        open={!!toSuspend}
        onClose={() => setToSuspend(null)}
        onConfirm={() => { if (toSuspend) updateMut.mutate({ id: toSuspend.member.id, status: toSuspend.status }) }}
        loading={updateMut.isLoading}
        title={toSuspend?.status === 'suspended' ? t('suspendTitle') : t('reactivateTitle')}
        description={toSuspend?.status === 'suspended'
          ? t('suspendDesc')
          : t('reactivateDesc')}
        confirmLabel={toSuspend?.status === 'suspended' ? t('suspendConfirm') : t('reactivateConfirm')}
      />
      <ConfirmDialog
        destructive
        open={!!toRemove}
        onClose={() => setToRemove(null)}
        onConfirm={() => { if (toRemove) deleteMut.mutate(toRemove.id) }}
        loading={deleteMut.isLoading}
        title={toRemove?.status === 'pending' ? t('cancelInviteTitle') : t('removeTitle')}
        description={t('removeDesc', { name: toRemove?.name || toRemove?.email || t('theMember') })}
        confirmLabel={t('removeConfirm')}
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
