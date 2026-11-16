// Outgoing webhooks: list, create (secret shown once), test, rotate secret, delete.
import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  PlusIcon, TrashIcon, BoltIcon, KeyIcon, BeakerIcon, LinkIcon, ExclamationTriangleIcon,
  CheckCircleIcon, XCircleIcon, ClockIcon, EllipsisHorizontalIcon, LockClosedIcon, ShieldExclamationIcon,
} from '@heroicons/react/24/outline'
import {
  Badge, Button, Card, CardHeader, Checkbox, ConfirmDialog, Dropdown, EmptyState, Field, Input, Modal, Skeleton, cn,
} from '@/components/ui'
import { Notice } from '@/components/settings/Shared'
import { LoadError } from '@/components/analytics/LoadError'
import { CopyButton, CopyField } from '@/components/campaigns/copy'
import { rich } from '@/components/campaigns/rich'
import { friendlyError, isMemberForbidden, useTeamRole } from '@/components/campaigns/shared'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/dashboard/integrations'
import common from '@/locales/dashboard/common-a'
import { EVENTS, eventMeta } from './events'

interface Hook {
  id: string
  target_url: string
  event: string
  label?: string | null
  is_active: boolean
  last_triggered_at?: string | null
  trigger_count?: number | null
  created_at: string
  last_status?: number | null
  last_error?: string | null
}

interface RevealedSecret { event: string; label?: string; secret: string; rotated?: boolean }
interface TestResult { ok: boolean; status?: number; error?: string; at: number }

export function WebhooksPanel() {
  const { t, fmtNumber, fmtRelative } = useT(messages)
  const { t: tc } = useT(common)
  const fmtNum = (n: number | null | undefined) => fmtNumber(Number(n) || 0)
  const evLabel = (v: string) => { const m = eventMeta(v); return m ? t(m.labelKey) : v }
  const qc = useQueryClient()
  const { canWrite, roleLabel } = useTeamRole()
  const canManage = canWrite('integrations')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ target_url: '', events: ['message_received'] as string[], label: '' })
  const [creating, setCreating] = useState(false)
  const [secrets, setSecrets] = useState<RevealedSecret[]>([])
  const [unsigned, setUnsigned] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [tests, setTests] = useState<Record<string, TestResult>>({})
  const [toRotate, setToRotate] = useState<Hook | null>(null)
  const [toDelete, setToDelete] = useState<Hook | null>(null)

  const { data, isLoading, isError, error, refetch } = useQuery('zapier-hooks', () => axios.get('/api/webhooks/zapier').then(r => r.data))
  const hooks: Hook[] = data?.hooks || []
  // Only events the server supports (it returns its list next to the hooks)
  const events = Array.isArray(data?.events) ? EVENTS.filter(e => data.events.includes(e.value)) : EVENTS

  const urlValid = /^https:\/\/[^\s/$.?#].[^\s]*$/i.test(form.target_url.trim())

  // One subscription per selected event (the API subscribes a URL to one event)
  const create = async () => {
    setCreating(true)
    const got: RevealedSecret[] = []
    const failed: string[] = []
    let firstError: unknown = null
    let noSecret = false
    for (const ev of form.events) {
      try {
        const r = await axios.post('/api/webhooks/zapier', { target_url: form.target_url.trim(), event: ev, label: form.label })
        if (r?.data?.secret) got.push({ event: ev, label: form.label, secret: r.data.secret })
        else noSecret = true
      } catch (e) {
        failed.push(ev)
        firstError = firstError || e
      }
    }
    setCreating(false)
    qc.invalidateQueries('zapier-hooks')
    if (got.length || noSecret) {
      setSecrets(got)
      setUnsigned(noSecret && !got.length)
      setSaved(false)
      setShowForm(false)
      setForm({ target_url: '', events: ['message_received'], label: '' })
      toast.success(form.events.length - failed.length > 1 ? t('created_n', { n: fmtNum(form.events.length - failed.length) }) : t('created_one'))
    }
    if (failed.length) {
      toast.error(`${friendlyError(firstError, t('create_failed'))}${failed.length < form.events.length ? ` (${failed.map(evLabel).join(t('list_sep'))})` : ''}`)
    }
  }

  const deleteMut = useMutation(
    (id: string) => axios.delete(`/api/webhooks/zapier?id=${id}`),
    {
      onSuccess: () => { qc.invalidateQueries('zapier-hooks'); setToDelete(null); toast.success(t('deleted')) },
      onError: (e: any) => { toast.error(friendlyError(e, t('delete_failed'))) },
    }
  )

  // Signed test delivery from the server (same headers as real events)
  const testWebhook = async (hook: Hook) => {
    setTestingId(hook.id)
    try {
      const r = await axios.post('/api/webhooks/zapier', { action: 'test', id: hook.id })
      setTests(prev => ({ ...prev, [hook.id]: { ok: true, status: r.data?.status, at: Date.now() } }))
      toast.success(r.data?.status ? t('test_ok_toast_status', { status: r.data.status }) : t('test_ok_toast'))
    } catch (e: any) {
      const d = e?.response?.data
      setTests(prev => ({ ...prev, [hook.id]: { ok: false, status: d?.status, error: friendlyError(e, t('test_unreachable')), at: Date.now() } }))
      toast.error(friendlyError(e, t('test_unreachable_hook')))
    }
    setTestingId(null)
  }

  const rotateMut = useMutation(
    (hook: Hook) => axios.post('/api/webhooks/zapier', { action: 'rotate_secret', id: hook.id }),
    {
      onSuccess: (r: any, hook) => {
        setSecrets([{ event: hook.event, label: hook.label || undefined, secret: r.data.secret, rotated: true }])
        setUnsigned(false)
        setSaved(false)
        setToRotate(null)
        toast.success(t('rotated'))
      },
      onError: (e: any) => { toast.error(friendlyError(e, t('rotate_failed'))) },
    }
  )

  const toggleEvent = (v: string) => setForm(f => ({ ...f, events: f.events.includes(v) ? f.events.filter(x => x !== v) : [...f.events, v] }))

  return (
    <div className="space-y-4">
      {/* Secret shown once */}
      {secrets.length > 0 && (
        <Card className="border-warning/30">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-bg text-warning">
              <ShieldExclamationIcon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="font-semibold text-ink">{t('copy_now', { title: secrets[0].rotated ? t('secret_new') : secrets.length > 1 ? t('secrets_many') : t('secret_one') })}</p>
                <p className="mt-0.5 text-sm text-muted">
                  {rich(t(secrets[0].rotated ? 'secret_once_rotated' : 'secret_once'), { env: <code dir="ltr" className="mx-1 font-mono text-[12.5px]">WABEK_WEBHOOK_SECRET</code> })}
                </p>
              </div>
              <div className="space-y-2">
                {secrets.map(s => (
                  <div key={s.secret} className="space-y-1">
                    {secrets.length > 1 && <p className="text-xs font-medium text-muted">{evLabel(s.event)} <code dir="ltr" className="font-mono">({s.event})</code></p>}
                    <CopyField value={s.secret} />
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Checkbox label={t('saved_check')} checked={saved} onChange={e => setSaved(e.target.checked)} />
                <Button size="sm" variant="secondary" disabled={!saved} onClick={() => setSecrets([])}>{t('done')}</Button>
              </div>
            </div>
          </div>
        </Card>
      )}
      {unsigned && (
        <Notice tone="warning" title={t('unsigned_title')} action={<Button size="sm" variant="ghost" icon={XCircleIcon} onClick={() => setUnsigned(false)} aria-label={t('dismiss')} />}>
          {t('unsigned_body')}
        </Notice>
      )}

      <Card padding="none">
        <CardHeader className="px-5 pt-5 sm:px-6" icon={BoltIcon} title={t('panel_title')}
          subtitle={t('panel_sub')}
          action={canManage && hooks.length > 0 ? <Button size="sm" icon={PlusIcon} onClick={() => setShowForm(true)}>{t('new_webhook')}</Button> : undefined} />

        {!canManage && (
          <div className="px-5 pt-4 sm:px-6">
            <Notice tone="info" icon={LockClosedIcon}>{t('role_note', { role: roleLabel })}</Notice>
          </div>
        )}

        <div className="mt-4 border-t border-line-soft">
          {isLoading ? (
            <div className="space-y-3 p-5 sm:p-6">{[0, 1].map(i => <Skeleton key={i} className="h-20 w-full rounded-card" />)}</div>
          ) : isError ? (
            <LoadError size="sm"
              title={isMemberForbidden(error) ? t('forbidden_title') : t('load_failed')}
              description={isMemberForbidden(error) ? tc('err_member_forbidden') : friendlyError(error)} onRetry={() => refetch()} />
          ) : hooks.length === 0 ? (
            <EmptyState size="sm" icon={BoltIcon} title={t('empty_title')}
              description={t('empty_desc')}
              action={canManage ? <Button size="sm" icon={PlusIcon} onClick={() => setShowForm(true)}>{t('add_webhook')}</Button> : undefined} />
          ) : (
            <ul className="divide-y divide-line-soft">
              {hooks.map(hook => {
                const ev = eventMeta(hook.event)
                const Icon = ev?.icon || BoltIcon
                const test = tests[hook.id]
                const failing = !!hook.last_error
                const okStatus = typeof hook.last_status === 'number' && hook.last_status >= 200 && hook.last_status < 300
                return (
                  <li key={hook.id} className="flex flex-col gap-3 px-5 py-4 sm:px-6 md:flex-row md:items-center">
                    <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', failing ? 'bg-danger-bg text-danger' : 'bg-chip text-brand-ink')}>
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-ink">{ev ? t(ev.labelKey) : hook.event}</span>
                        <code dir="ltr" className="font-mono text-[11.5px] text-muted">{hook.event}</code>
                        {hook.label && <Badge size="sm" tone="neutral">{hook.label}</Badge>}
                        <Badge size="sm" tone={hook.is_active ? 'success' : 'neutral'} dot>{hook.is_active ? t('active') : t('paused')}</Badge>
                      </div>
                      <div className="flex min-w-0 items-center gap-1">
                        <LinkIcon className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
                        <code dir="ltr" className="min-w-0 truncate text-start font-mono text-xs text-body">{hook.target_url}</code>
                        <CopyButton text={hook.target_url} label={t('copy_url')} />
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                        <span className="flex items-center gap-1"><CheckCircleIcon className="h-3.5 w-3.5 text-success" aria-hidden="true" /><span className="tabular">{t('deliveries_ok', { n: fmtNum(hook.trigger_count || 0) })}</span></span>
                        <span className="flex items-center gap-1"><ClockIcon className="h-3.5 w-3.5" aria-hidden="true" />{t('last_ok', { when: hook.last_triggered_at ? fmtRelative(hook.last_triggered_at) : t('never') })}</span>
                        {typeof hook.last_status === 'number' && (
                          <span className={cn('flex items-center gap-1', okStatus ? 'text-success' : 'text-danger')}>{t('last_reply')} <code dir="ltr" className="font-mono">HTTP {hook.last_status}</code></span>
                        )}
                      </div>
                      {failing && (
                        <p className="flex items-start gap-1.5 rounded-lg bg-danger-bg px-2.5 py-1.5 text-xs text-danger">
                          <ExclamationTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>{t('last_failed', { error: friendlyError({ response: { data: { error: hook.last_error } } }) })}</span>
                        </p>
                      )}
                      {test && (
                        <p role="status" className={cn('text-xs', test.ok ? 'text-success' : 'text-danger')}>
                          {test.ok ? (test.status ? t('test_ok_status', { status: test.status }) : t('test_ok')) : t('test_failed', { error: test.error })}
                        </p>
                      )}
                    </div>
                    {canManage && (
                      <div className="flex shrink-0 items-center gap-2">
                        <Button size="sm" variant="secondary" icon={BeakerIcon} loading={testingId === hook.id} onClick={() => testWebhook(hook)}>{t('test')}</Button>
                        <Dropdown label={t('hook_options')} align="end"
                          trigger={<span className="flex h-9 w-9 items-center justify-center rounded-btn border border-line text-muted transition hover:text-ink"><EllipsisHorizontalIcon className="h-5 w-5" aria-hidden="true" /></span>}
                          items={[
                            { label: t('new_secret'), icon: KeyIcon, onClick: () => setToRotate(hook) },
                            { label: tc('delete'), icon: TrashIcon, danger: true, divider: true, onClick: () => setToDelete(hook) },
                          ]} />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </Card>

      {/* Create */}
      <Modal open={showForm} onClose={() => !creating && setShowForm(false)} size="lg" icon={BoltIcon}
        title={t('form_title')} description={t('form_desc')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)} disabled={creating}>{tc('cancel')}</Button>
            <Button icon={PlusIcon} loading={creating} disabled={!urlValid || form.events.length === 0} onClick={create}>
              {form.events.length > 1 ? t('create_n', { n: fmtNum(form.events.length) }) : t('create_one')}
            </Button>
          </>
        }>
        <div className="space-y-5">
          <Field label={t('url_label')} required hint={t('url_hint')}
            error={form.target_url && !urlValid ? t('url_error') : undefined}>
            <Input dir="ltr" icon={LinkIcon} value={form.target_url} onChange={e => setForm(f => ({ ...f, target_url: e.target.value }))}
              placeholder="https://hooks.zapier.com/hooks/catch/..." />
          </Field>
          <fieldset>
            <legend className="mb-1 text-sm font-medium text-ink">{t('events')}</legend>
            <p className="mb-3 text-xs text-muted">{t('events_hint')}</p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {events.map(ev => (
                <div key={ev.value} className={cn('rounded-card border p-3 transition', form.events.includes(ev.value) ? 'border-brand-teal bg-chip/40' : 'border-line')}>
                  <Checkbox checked={form.events.includes(ev.value)} onChange={() => toggleEvent(ev.value)}
                    label={<span className="flex flex-wrap items-center gap-1.5">{t(ev.labelKey)}<code dir="ltr" className="font-mono text-[11px] font-normal text-muted">{ev.value}</code></span>}
                    description={t(ev.descKey)} />
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Button size="xs" variant="ghost" onClick={() => setForm(f => ({ ...f, events: events.map(e => e.value) }))}>{t('select_all')}</Button>
              <Button size="xs" variant="ghost" onClick={() => setForm(f => ({ ...f, events: [] }))}>{t('clear_selection')}</Button>
            </div>
          </fieldset>
          <Field label={t('label_label')} hint={t('label_hint')}>
            <Input value={form.label} maxLength={100} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder={t('label_ph')} />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toRotate}
        onClose={() => setToRotate(null)}
        onConfirm={() => { if (toRotate) rotateMut.mutate(toRotate) }}
        loading={rotateMut.isLoading}
        title={t('rotate_title')}
        description={t('rotate_desc')}
        confirmLabel={t('rotate_confirm')}
        cancelLabel={tc('cancel')}
      />
      <ConfirmDialog
        destructive
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => { if (toDelete) deleteMut.mutate(toDelete.id) }}
        loading={deleteMut.isLoading}
        title={t('delete_title')}
        description={toDelete ? t('delete_desc', { event: evLabel(toDelete.event), url: toDelete.target_url }) : undefined}
        confirmLabel={tc('delete')}
        cancelLabel={tc('cancel')}
      />
    </div>
  )
}
