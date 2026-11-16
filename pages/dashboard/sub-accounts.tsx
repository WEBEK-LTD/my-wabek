// @ts-nocheck
import { useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  PlusIcon, UserGroupIcon, NoSymbolIcon, CheckCircleIcon, SignalIcon, UsersIcon, ChatBubbleLeftRightIcon,
  ShieldCheckIcon, BookOpenIcon,
} from '@heroicons/react/24/outline'
import {
  Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, Modal, PageHeader, StatCard,
} from '@/components/ui'
import { CardsSkeleton, ErrorState, PlanGate, apiError } from '@/components/settings/Shared'
import { fmtLimit } from '@/components/settings/format'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/dashboard/sub-accounts'

const EMPTY_FORM = { name: '', email: '', password: '', max_contacts: -1, max_instances: 1, max_messages_month: 1000 }

export default function SubAccountsPage() {
  return <PlanGate feature="allow_sub_accounts"><SubAccountsContent /></PlanGate>
}

function SubAccountsContent() {
  const { t, lang, fmtDate } = useT(messages)
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [toSuspend, setToSuspend] = useState(null)

  const { data, isLoading, isError, error, refetch } = useQuery('sub-accounts', () => axios.get('/api/sub-accounts').then(r => r.data))
  const accounts = data?.accounts || []
  const activeCount = accounts.filter(a => a.user?.is_active).length

  const suspendMut = useMutation(
    id => axios.delete(`/api/sub-accounts/${id}`),
    { onSuccess: () => { qc.invalidateQueries('sub-accounts'); setToSuspend(null); toast.success(t('suspended')) },
      onError: e => toast.error(apiError(e, t('suspendError'))) }
  )
  const activateMut = useMutation(
    id => axios.put(`/api/sub-accounts/${id}`, { is_active: true }),
    { onSuccess: () => { qc.invalidateQueries('sub-accounts'); toast.success(t('activated')) },
      onError: e => toast.error(apiError(e, t('activateError'))) }
  )

  const createMut = useMutation(
    (body) => axios.post('/api/sub-accounts', body),
    {
      onSuccess: () => {
        qc.invalidateQueries('sub-accounts')
        setShowForm(false)
        setForm(EMPTY_FORM)
        toast.success(t('created'))
      },
      onError: (e) => toast.error(apiError(e, t('createError'))),
    }
  )

  const num = (k) => e => setForm(f => ({ ...f, [k]: parseInt(e.target.value) }))

  return (
    <DashboardLayout title={t('pageTitle')}>
      <div className="space-y-6">
        <PageHeader
          eyebrow={t('eyebrow')}
          title={t('title')}
          description={t('description')}
          actions={
            <>
              <Button variant="secondary" icon={BookOpenIcon} href="/docs/guides/sub-accounts">{t('guide')}</Button>
              <Button icon={PlusIcon} onClick={() => setShowForm(true)}>{t('newAccount')}</Button>
            </>
          }
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-3.5">
          <StatCard label={t('statAll')} value={String(accounts.length)} icon={UserGroupIcon} loading={isLoading} />
          <StatCard label={t('statActive')} value={String(activeCount)} icon={CheckCircleIcon} loading={isLoading} />
          <StatCard label={t('statSuspended')} value={String(accounts.length - activeCount)} icon={NoSymbolIcon} loading={isLoading}
            subTone={accounts.length - activeCount > 0 ? 'warning' : 'muted'} />
        </div>

        {isLoading ? (
          <CardsSkeleton count={3} className="h-48" />
        ) : isError ? (
          <ErrorState message={apiError(error, t('loadError'))} onRetry={() => refetch()} />
        ) : accounts.length === 0 ? (
          <EmptyState
            variant="card"
            icon={UserGroupIcon}
            title={t('emptyTitle')}
            description={t('emptyDesc')}
            action={<Button icon={PlusIcon} onClick={() => setShowForm(true)}>{t('createFirst')}</Button>}
          />
        ) : (
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr))]">
            {accounts.map(acc => {
              const active = !!acc.user?.is_active
              return (
                <Card key={acc.id} padding="none" interactive className={active ? '' : 'opacity-80'}>
                  <div className="flex items-start gap-3 p-5">
                    <Avatar name={acc.user?.name || acc.user?.email || '?'} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold text-ink">{acc.user?.name || '—'}</p>
                        <Badge tone={active ? 'success' : 'danger'} size="sm" dot>{active ? t('active') : t('inactive')}</Badge>
                      </div>
                      <p className="truncate text-sm text-muted"><span dir="ltr">{acc.user?.email}</span></p>
                      <p className="mt-0.5 text-xs text-muted">{t('createdOn', { date: fmtDate(acc.user?.created_at) })}</p>
                    </div>
                  </div>
                  <dl className="grid grid-cols-3 divide-x divide-line-soft border-y border-line-soft bg-surface-2/50 text-center rtl:divide-x-reverse">
                    {[
                      { icon: SignalIcon, label: t('limNumbers'), value: fmtLimit(acc.max_instances, lang) },
                      { icon: UsersIcon, label: t('limContacts'), value: fmtLimit(acc.max_contacts, lang) },
                      { icon: ChatBubbleLeftRightIcon, label: t('limMessages'), value: fmtLimit(acc.max_messages_month, lang) },
                    ].map(s => (
                      <div key={s.label} className="px-2 py-3">
                        <dt className="flex items-center justify-center gap-1 text-[11px] text-muted"><s.icon className="h-3.5 w-3.5" aria-hidden="true" />{s.label}</dt>
                        <dd className="mt-0.5 text-sm font-semibold text-ink tabular">{s.value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="flex justify-end px-5 py-3">
                    {active ? (
                      <Button size="sm" variant="danger-soft" icon={NoSymbolIcon} onClick={() => setToSuspend(acc)}>{t('suspend')}</Button>
                    ) : (
                      <Button size="sm" variant="secondary" icon={CheckCircleIcon} loading={activateMut.isLoading && activateMut.variables === acc.id} onClick={() => activateMut.mutate(acc.id)}>{t('activate')}</Button>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        <Card variant="muted">
          <div className="flex items-start gap-3">
            <ShieldCheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-ink" aria-hidden="true" />
            <ul className="grid flex-1 gap-x-8 gap-y-1.5 text-sm text-body sm:grid-cols-2">
              <li>{t('info1')}</li>
              <li>{t('info2')}</li>
              <li>{t('info3')}</li>
              <li>{t('info4')}</li>
            </ul>
          </div>
        </Card>
      </div>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        size="lg"
        icon={UserGroupIcon}
        title={t('formTitle')}
        description={t('formDesc')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>{t('cancel')}</Button>
            <Button type="submit" form="sub-form" loading={createMut.isLoading} disabled={!form.name || !form.email || !form.password}>{t('createAccount')}</Button>
          </>
        }
      >
        <form id="sub-form" className="space-y-5" onSubmit={e => { e.preventDefault(); createMut.mutate(form) }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('fullName')} required>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t('namePlaceholder')} />
            </Field>
            <Field label={t('email')} required>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="client@example.com" dir="ltr" />
            </Field>
            <Field label={t('password')} hint={t('passwordHint')} required className="sm:col-span-2">
              <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} autoComplete="new-password" />
            </Field>
          </div>
          <fieldset className="rounded-card border border-line-soft bg-surface-2/60 p-4">
            <legend className="px-1 text-sm font-medium text-ink">{t('limits')}</legend>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t('fNumbers')}>
                <Input type="number" min={1} value={form.max_instances} onChange={num('max_instances')} dir="ltr" />
              </Field>
              <Field label={t('fContacts')} hint={t('fContactsHint')}>
                <Input type="number" value={form.max_contacts} onChange={num('max_contacts')} dir="ltr" />
              </Field>
              <Field label={t('fMessages')}>
                <Input type="number" value={form.max_messages_month} onChange={num('max_messages_month')} dir="ltr" />
              </Field>
            </div>
          </fieldset>
        </form>
      </Modal>

      <ConfirmDialog
        destructive
        open={!!toSuspend}
        onClose={() => setToSuspend(null)}
        onConfirm={() => { if (toSuspend) suspendMut.mutate(toSuspend.id) }}
        loading={suspendMut.isLoading}
        title={t('suspendTitle')}
        description={t('suspendDesc', { name: toSuspend?.user?.name || t('theClient') })}
        confirmLabel={t('suspendConfirm')}
      />
    </DashboardLayout>
  )
}
