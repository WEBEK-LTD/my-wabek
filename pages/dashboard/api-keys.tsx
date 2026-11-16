import { useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  PlusIcon, KeyIcon, TrashIcon, ShieldCheckIcon, BookOpenIcon, LockClosedIcon, ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import {
  Badge, Button, Card, CardHeader, ConfirmDialog, EmptyState, Field, Input, Modal, PageHeader,
  Skeleton, Table, TBody, TD, TH, THead, TR, Tooltip,
} from '@/components/ui'
import { CopyField, ErrorState, Notice, PlanGate, apiError, apiStatus } from '@/components/settings/Shared'
import { ApiQuickStart } from '@/components/settings/ApiQuickStart'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/dashboard/api-keys'

interface ApiKeyRow {
  id: string
  name: string
  key_prefix: string
  permissions?: string[] | null
  last_used_at?: string | null
  is_active: boolean
  created_at: string
}

const PERMISSION_LABELS: Record<string, keyof typeof messages.en> = { send: 'perm_send', contacts: 'perm_contacts', otp: 'perm_otp' }

export default function ApiKeysPage() {
  return <PlanGate feature="allow_api_access"><ApiKeysContent /></PlanGate>
}

function ApiKeysContent() {
  const { t, fmtDate, fmtRelative } = useT(messages)
  const qc = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKey, setNewKey] = useState<string | null>(null)
  const [toRevoke, setToRevoke] = useState<ApiKeyRow | null>(null)

  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://waabek.com'

  const keysQ = useQuery('api-keys', () => axios.get('/api/settings/api-keys').then(r => r.data), { retry: false })
  // The default key is not part of the user object (owner-only endpoint).
  const defaultQ = useQuery('default-api-key',
    () => axios.get('/api/settings/default-api-key').then(r => r.data), { retry: false, staleTime: Infinity })
  const defaultApiKey: string | null = defaultQ.data?.api_key || null
  const keys: ApiKeyRow[] = keysQ.data?.keys || []
  const ownerOnly = apiStatus(keysQ.error) === 403 || apiStatus(defaultQ.error) === 403
  const activeCount = keys.filter(k => k.is_active).length

  const createMut = useMutation(
    () => axios.post('/api/settings/api-keys', { name: newKeyName }).then(r => r.data),
    {
      onSuccess: (data) => {
        qc.invalidateQueries('api-keys')
        setNewKey(data.key)
        setNewKeyName('')
        setShowNew(false)
        toast.success(t('keyCreated'))
      },
      onError: (e) => void toast.error(apiError(e, t('createError'))),
    }
  )

  const deleteMut = useMutation(
    (id: string) => axios.delete(`/api/settings/api-keys/${id}`),
    {
      onSuccess: () => { qc.invalidateQueries('api-keys'); setToRevoke(null); toast.success(t('keyRevoked')) },
      onError: (e) => void toast.error(apiError(e, t('revokeError'))),
    }
  )

  return (
    <DashboardLayout title={t('pageTitle')}>
      <div className="space-y-6">
        <PageHeader
          eyebrow={t('eyebrow')}
          title={t('title')}
          description={t('description')}
          actions={
            <>
              <Button variant="secondary" icon={BookOpenIcon} href="/docs/api/authentication">{t('authDocs')}</Button>
              {!ownerOnly && <Button icon={PlusIcon} onClick={() => setShowNew(true)}>{t('newKey')}</Button>}
            </>
          }
        />

        {ownerOnly && (
          <Notice tone="info" icon={LockClosedIcon} title={t('ownerOnlyTitle')}>
            {t('ownerOnlyBody')}
          </Notice>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* Keys table */}
          <Card padding="none" className="order-2 lg:order-1">
            <CardHeader
              icon={KeyIcon}
              title={t('namedKeys')}
              subtitle={keys.length ? t('activeOf', { active: activeCount, total: keys.length }) : t('keyPerIntegration')}
              action={!ownerOnly && keys.length > 0 ? <Button size="sm" variant="secondary" icon={PlusIcon} onClick={() => setShowNew(true)}>{t('newKey')}</Button> : undefined}
              divider
            />
            {keysQ.isLoading ? (
              <div className="space-y-3 p-5">{[0, 1, 2].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : ownerOnly ? (
              <EmptyState size="sm" icon={LockClosedIcon} title={t('cannotView')} description={t('cannotViewDesc')} />
            ) : keysQ.isError ? (
              <ErrorState className="m-5" message={apiError(keysQ.error)} onRetry={() => keysQ.refetch()} />
            ) : keys.length === 0 ? (
              <EmptyState
                size="sm"
                icon={KeyIcon}
                title={t('emptyTitle')}
                description={t('emptyDesc')}
                action={<Button size="sm" icon={PlusIcon} onClick={() => setShowNew(true)}>{t('createFirst')}</Button>}
              />
            ) : (
              <Table minWidth={720} caption={t('namedKeys')}>
                <THead>
                  <TR>
                    <TH>{t('th_name')}</TH>
                    <TH>{t('th_prefix')}</TH>
                    <TH>{t('th_permissions')}</TH>
                    <TH>{t('th_lastUsed')}</TH>
                    <TH>{t('th_created')}</TH>
                    <TH align="end"><span className="sr-only">{t('th_actions')}</span></TH>
                  </TR>
                </THead>
                <TBody>
                  {keys.map(k => (
                    <TR key={k.id} className={k.is_active ? undefined : 'opacity-60'}>
                      <TD>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-ink">{k.name}</span>
                          {!k.is_active && <Badge tone="danger" size="sm">{t('revoked')}</Badge>}
                        </div>
                      </TD>
                      <TD><code dir="ltr" className="font-mono text-[13px] text-muted">{k.key_prefix}••••</code></TD>
                      <TD>
                        <div className="flex flex-wrap gap-1">
                          {(k.permissions || []).length === 0
                            ? <span className="text-xs text-muted">—</span>
                            : (k.permissions || []).map(p => <Badge key={p} tone="neutral" size="sm">{PERMISSION_LABELS[p] ? t(PERMISSION_LABELS[p]) : p}</Badge>)}
                        </div>
                      </TD>
                      <TD className="whitespace-nowrap text-sm text-muted">{k.last_used_at ? fmtRelative(k.last_used_at) : t('neverUsed')}</TD>
                      <TD className="whitespace-nowrap text-sm text-muted">{fmtDate(k.created_at)}</TD>
                      <TD align="end">
                        {k.is_active && (
                          <Tooltip content={t('revokeKey')}>
                            <Button size="icon-sm" variant="ghost" icon={TrashIcon} aria-label={t('revokeKeyNamed', { name: k.name })} className="text-muted hover:text-danger" onClick={() => setToRevoke(k)} />
                          </Tooltip>
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>

          {/* Default key */}
          <Card className="order-1 h-fit lg:order-2" variant="deep" padding="lg">
            <div aria-hidden="true" className="pointer-events-none absolute -end-10 -top-10 h-40 w-40 rounded-full bg-brand-green/20 blur-3xl" />
            <div className="relative space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-gradient text-[#04282C]">
                  <ShieldCheckIcon className="h-6 w-6" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-semibold text-deep-ink">{t('defaultKey')}</h2>
                  <p className="text-xs text-deep-muted">{t('defaultKeySub')}</p>
                </div>
              </div>
              {defaultQ.isLoading ? (
                <Skeleton className="h-11 w-full bg-white/10" />
              ) : apiStatus(defaultQ.error) === 403 ? (
                <p className="rounded-field bg-white/[0.06] px-3 py-2.5 text-sm text-deep-muted">{t('defaultOwnerOnly')}</p>
              ) : defaultApiKey ? (
                <CopyField value={defaultApiKey} secret className="border-white/10 bg-white/[0.06] [&_code]:text-deep-ink [&_button]:text-deep-muted" />
              ) : (
                <p className="rounded-field bg-white/[0.06] px-3 py-2.5 text-sm text-deep-muted">{t('noDefault')}</p>
              )}
              <p className="text-xs leading-relaxed text-deep-muted">{t('defaultHint')}</p>
            </div>
          </Card>
        </div>

        <ApiQuickStart baseUrl={appUrl} apiKey={newKey || 'YOUR_API_KEY'} />
      </div>

      {/* Create */}
      <Modal
        open={showNew}
        onClose={() => setShowNew(false)}
        size="sm"
        icon={KeyIcon}
        title={t('newKeyTitle')}
        description={t('newKeyDesc')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowNew(false)}>{t('cancel')}</Button>
            <Button loading={createMut.isLoading} disabled={!newKeyName.trim()} onClick={() => createMut.mutate()}>{t('createKey')}</Button>
          </>
        }
      >
        <Field label={t('keyName')} required>
          <Input
            value={newKeyName}
            onChange={e => setNewKeyName(e.target.value)}
            placeholder={t('keyNamePlaceholder')}
            maxLength={100}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter' && newKeyName.trim()) createMut.mutate() }}
          />
        </Field>
      </Modal>

      {/* Reveal once */}
      <Modal
        open={!!newKey}
        onClose={() => setNewKey(null)}
        icon={ShieldCheckIcon}
        title={t('copyNowTitle')}
        description={t('copyNowDesc')}
        footer={<Button onClick={() => setNewKey(null)}>{t('copiedIt')}</Button>}
      >
        <div className="space-y-4">
          <CopyField value={newKey || ''} className="py-2.5" />
          <Notice tone="warning" icon={ExclamationTriangleIcon} title={t('cantShowAgain')}>
            {t('cantShowAgainBody')}
          </Notice>
        </div>
      </Modal>

      <ConfirmDialog cancelLabel={t('cancel')}
        destructive
        open={!!toRevoke}
        onClose={() => setToRevoke(null)}
        onConfirm={() => { if (toRevoke) deleteMut.mutate(toRevoke.id) }}
        loading={deleteMut.isLoading}
        title={t('revokeTitle', { name: toRevoke?.name || '' })}
        description={t('revokeDesc')}
        confirmLabel={t('revokeKey')}
      />
    </DashboardLayout>
  )
}
