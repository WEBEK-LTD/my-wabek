import React, { useEffect, useState } from 'react'
import { useQuery } from 'react-query'
import axios from 'axios'
import {
  CheckCircleIcon, CreditCardIcon, DevicePhoneMobileIcon, ExclamationTriangleIcon, NoSymbolIcon, ShieldCheckIcon, UserIcon,
} from '@heroicons/react/24/outline'
import {
  Avatar, Badge, Button, Card, ConfirmDialog, Field, Input, Select, Skeleton, StatusPill, Tabs,
} from '@/components/ui'
import { Drawer, InfoTile, Notice } from '../shared'
import { useAdminT } from '../i18n'
import type { AdminPlanRef, AdminUser, AdminUserDetail, UserUpdateBody } from './types'
import messages from '@/locales/admin/user-drawer'

interface Props {
  user: AdminUser | null
  plans: AdminPlanRef[]
  onClose: () => void
  /** Sends a partial update; resolves on success, rejects with the API message. */
  onSave: (id: string, body: UserUpdateBody, label: string) => Promise<unknown>
  saving: boolean
  error: string | null
  isSelf: boolean
}

const dayOnly = (v?: string | null) => (v ? String(v).split('T')[0] : '')

export function UserDrawer({ user, plans, onClose, onSave, saving, error, isSelf }: Props) {
  const { t, fmtDate, fmtNumber } = useAdminT(messages)
  const open = !!user
  const { data: detail, isLoading } = useQuery<AdminUserDetail>(
    ['admin-user-detail', user?.id],
    () => axios.get(`/api/admin/users/${user!.id}`).then(r => r.data),
    { enabled: !!user },
  )

  const [planId, setPlanId] = useState('')
  const [expiry, setExpiry] = useState('')
  const [role, setRole] = useState<'user' | 'admin'>('user')
  const [confirm, setConfirm] = useState<null | 'suspend' | 'activate' | 'role' | 'removePlan'>(null)

  useEffect(() => {
    if (!user) return
    setPlanId(user.plan_id || '')
    setExpiry(dayOnly(user.plan_expires_at))
    setRole(user.role === 'admin' ? 'admin' : 'user')
  }, [user])

  if (!user) return <Drawer open={false} onClose={onClose} />

  const stripeBilled = !!detail?.subscription?.stripe_subscription_id
  const planChanged = planId !== (user.plan_id || '')
  const expiryChanged = expiry !== dayOnly(user.plan_expires_at)
  const roleChanged = role !== (user.role === 'admin' ? 'admin' : 'user')
  const planOptions = [
    { value: '', label: t('noPlanFree') },
    ...plans.map(p => ({ value: p.id, label: `${p.name} — $${p.price_monthly ?? 0}${t('mo')}` })),
    ...(user.plan_id && !plans.some(p => p.id === user.plan_id)
      ? [{ value: user.plan_id, label: `${user.plans?.name || user.plan_id} (${t('inactive')})` }] : []),
  ]

  const savePlan = () => {
    const body: UserUpdateBody = {}
    if (planChanged) body.plan_id = planId || null
    if (planId && expiryChanged) body.plan_expires_at = expiry ? new Date(expiry).toISOString() : null
    return onSave(user.id, body, t('planUpdated'))
  }

  const name = user.name || user.email
  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        width="lg"
        title={t('userDetails')}
        description={<span dir="ltr">{user.email}</span>}
      >
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar name={name} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold text-ink">{user.name || '—'}</p>
              <p dir="ltr" className="truncate text-start text-sm text-muted">{user.email}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <StatusPill status={user.is_active ? 'active' : 'blocked'}>{user.is_active ? t('active') : t('suspended')}</StatusPill>
                <Badge tone={user.role === 'admin' ? 'violet' : 'neutral'} icon={user.role === 'admin' ? ShieldCheckIcon : UserIcon}>
                  {user.role === 'admin' ? t('admin') : t('userAlt')}
                </Badge>
                {user.referred_by && <Badge tone="brand">{t('referred')}</Badge>}
                {isSelf && <Badge tone="warning">{t('you')}</Badge>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <InfoTile label={t('plan')} value={detail?.user?.plans?.name || user.plans?.name || t('free')} />
            <InfoTile label={t('expires')} value={user.plan_expires_at ? fmtDate(user.plan_expires_at) : t('noExpiry')} />
            <InfoTile label={t('joined')} value={fmtDate(user.created_at)} />
            <InfoTile label={t('messages')} value={isLoading ? <Skeleton className="h-5 w-12" /> : fmtNumber(detail?.stats?.messages ?? 0)} />
            <InfoTile label={t('contacts')} value={isLoading ? <Skeleton className="h-5 w-12" /> : fmtNumber(detail?.stats?.contacts ?? 0)} />
            <InfoTile label={t('whatsappNumbers')} value={isLoading ? <Skeleton className="h-5 w-12" /> : fmtNumber(detail?.instances?.length ?? 0)} />
          </div>

          {!!detail?.instances?.length && (
            <div>
              <p className="mb-2 text-sm font-semibold text-ink">{t('whatsappNumbers')}</p>
              <ul className="divide-y divide-line-soft rounded-xl border border-line">
                {detail.instances.map(inst => (
                  <li key={inst.id} className="flex items-center gap-3 px-3.5 py-2.5 text-sm">
                    <DevicePhoneMobileIcon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-ink" dir="auto">{inst.display_name || inst.phone_number || t('noNumber')}</span>
                    <span className="text-xs text-muted">{inst.instance_type === 'wa_web' ? 'WA Web' : (inst.instance_type || inst.type) === 'cloud_api' ? 'Cloud API' : (inst.instance_type || inst.type || '')}</span>
                    <StatusPill status={inst.status} size="sm">{inst.status || '—'}</StatusPill>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && <Notice tone="danger" icon={ExclamationTriangleIcon} title={t('changeWasNotSaved')}>{error}</Notice>}

          {/* Plan */}
          <Card variant="muted" padding="md" className="space-y-4">
            <div className="flex items-center gap-2">
              <CreditCardIcon className="h-5 w-5 text-brand-ink" aria-hidden="true" />
              <h3 className="section-title">{t('planAssignment')}</h3>
            </div>
            {stripeBilled && (
              <Notice tone="warning" title={t('billedThroughStripe')}>
                {t('planCanTSwitched')}
              </Notice>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('plan')}>
                <Select value={planId} onChange={e => setPlanId(e.target.value)} options={planOptions} />
              </Field>
              {planId && (
                <Field label={t('expires2')} hint={t('leaveEmptyNoExpiry')}>
                  <Input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} dir="ltr" />
                </Field>
              )}
            </div>
            <div className="flex justify-end gap-2">
              {(planChanged || expiryChanged) && (
                <Button variant="ghost" size="sm" onClick={() => { setPlanId(user.plan_id || ''); setExpiry(dayOnly(user.plan_expires_at)) }}>{t('reset')}</Button>
              )}
              <Button size="sm" loading={saving} disabled={!planChanged && !(planId && expiryChanged)}
                onClick={() => (planChanged && !planId && user.plan_id ? setConfirm('removePlan') : savePlan())}>
                {t('savePlan')}
              </Button>
            </div>
          </Card>

          {/* Role */}
          <Card variant="muted" padding="md" className="space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheckIcon className="h-5 w-5 text-brand-ink" aria-hidden="true" />
              <h3 className="section-title">{t('role')}</h3>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Tabs variant="segmented" size="sm" value={role} onChange={v => setRole(v as 'user' | 'admin')} aria-label={t('role')}
                tabs={[{ id: 'user', label: t('userAlt'), icon: UserIcon }, { id: 'admin', label: t('platformAdmin'), icon: ShieldCheckIcon }]} />
              <Button size="sm" variant="secondary" disabled={!roleChanged || (isSelf && role === 'user')} loading={saving} onClick={() => setConfirm('role')}>
                {t('changeRole')}
              </Button>
            </div>
            <p className="text-xs text-muted">{t('changingRoleSignsUser')}</p>
          </Card>

          {/* Status */}
          <Card variant="muted" padding="md" className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="section-title">{t('accountStatus')}</h3>
              <p className="mt-0.5 text-xs text-muted">
                {user.is_active
                  ? t('suspendingBlocksSignEnds')
                  : t('accountCurrentlySuspended')}
              </p>
            </div>
            {user.is_active ? (
              <Button variant="danger-soft" size="sm" icon={NoSymbolIcon} disabled={isSelf} onClick={() => setConfirm('suspend')}>{t('suspend')}</Button>
            ) : (
              <Button variant="secondary" size="sm" icon={CheckCircleIcon} onClick={() => setConfirm('activate')}>{t('activate')}</Button>
            )}
          </Card>
        </div>
      </Drawer>

      <ConfirmDialog
        open={confirm === 'suspend'}
        destructive
        onClose={() => setConfirm(null)}
        loading={saving}
        title={t('suspendUser')}
        description={t('willBlockedSigningSigned', { name })}
        confirmLabel={t('suspend2')}
        onConfirm={() => onSave(user.id, { is_active: false }, t('userSuspended')).then(() => setConfirm(null), () => setConfirm(null))}
      />
      <ConfirmDialog
        open={confirm === 'activate'}
        onClose={() => setConfirm(null)}
        loading={saving}
        title={t('activateUser')}
        confirmLabel={t('activate2')}
        onConfirm={() => onSave(user.id, { is_active: true }, t('userActivated')).then(() => setConfirm(null), () => setConfirm(null))}
      />
      <ConfirmDialog
        open={confirm === 'role'}
        destructive={role === 'admin'}
        onClose={() => setConfirm(null)}
        loading={saving}
        title={role === 'admin' ? t('grantPlatformAdminRights') : t('removeAdminRights')}
        description={role === 'admin'
          ? t('userWillAbleManage')
          : t('accountGoesBackRegular')}
        confirmLabel={t('confirm')}
        onConfirm={() => onSave(user.id, { role }, t('roleChanged')).then(() => setConfirm(null), () => setConfirm(null))}
      />
      <ConfirmDialog
        open={confirm === 'removePlan'}
        destructive
        onClose={() => setConfirm(null)}
        loading={saving}
        title={t('removePlan')}
        description={stripeBilled
          ? t('userSStripeSubscription')
          : t('userReturnsFreeTier')}
        confirmLabel={t('removePlan2')}
        onConfirm={() => savePlan().then(() => setConfirm(null), () => setConfirm(null))}
      />
    </>
  )
}
