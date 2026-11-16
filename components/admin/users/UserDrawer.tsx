import React, { useEffect, useState } from 'react'
import { useQuery } from 'react-query'
import axios from 'axios'
import {
  CheckCircleIcon, CreditCardIcon, DevicePhoneMobileIcon, ExclamationTriangleIcon, NoSymbolIcon, ShieldCheckIcon, UserIcon,
} from '@heroicons/react/24/outline'
import {
  Avatar, Badge, Button, Card, ConfirmDialog, Field, Input, Select, Skeleton, StatusPill, Tabs, formatNumber,
} from '@/components/ui'
import { Drawer, InfoTile, Notice } from '../shared'
import { useAdminT } from '../i18n'
import type { AdminPlanRef, AdminUser, AdminUserDetail, UserUpdateBody } from './types'

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
  const { tr, fmtDate } = useAdminT()
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
    { value: '', label: tr('بدون باقة (مجانية)', 'No plan (Free)') },
    ...plans.map(p => ({ value: p.id, label: `${p.name} — $${p.price_monthly ?? 0}${tr('/شهريًا', '/mo')}` })),
    ...(user.plan_id && !plans.some(p => p.id === user.plan_id)
      ? [{ value: user.plan_id, label: `${user.plans?.name || user.plan_id} (${tr('غير نشطة', 'inactive')})` }] : []),
  ]

  const savePlan = () => {
    const body: UserUpdateBody = {}
    if (planChanged) body.plan_id = planId || null
    if (planId && expiryChanged) body.plan_expires_at = expiry ? new Date(expiry).toISOString() : null
    return onSave(user.id, body, tr('تم تحديث الباقة', 'Plan updated'))
  }

  const name = user.name || user.email
  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        width="lg"
        title={tr('تفاصيل المستخدم', 'User details')}
        description={<span dir="ltr">{user.email}</span>}
      >
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar name={name} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold text-ink">{user.name || '—'}</p>
              <p dir="ltr" className="truncate text-start text-sm text-muted">{user.email}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <StatusPill status={user.is_active ? 'active' : 'blocked'}>{user.is_active ? tr('نشط', 'Active') : tr('موقوف', 'Suspended')}</StatusPill>
                <Badge tone={user.role === 'admin' ? 'violet' : 'neutral'} icon={user.role === 'admin' ? ShieldCheckIcon : UserIcon}>
                  {user.role === 'admin' ? tr('مدير', 'Admin') : tr('مستخدم', 'User')}
                </Badge>
                {user.referred_by && <Badge tone="brand">{tr('مُحال من موزّع', 'Referred')}</Badge>}
                {isSelf && <Badge tone="warning">{tr('حسابك', 'You')}</Badge>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <InfoTile label={tr('الباقة', 'Plan')} value={detail?.user?.plans?.name || user.plans?.name || tr('مجانية', 'Free')} />
            <InfoTile label={tr('تنتهي في', 'Expires')} value={user.plan_expires_at ? fmtDate(user.plan_expires_at) : tr('بلا انتهاء', 'No expiry')} />
            <InfoTile label={tr('انضم في', 'Joined')} value={fmtDate(user.created_at)} />
            <InfoTile label={tr('الرسائل', 'Messages')} value={isLoading ? <Skeleton className="h-5 w-12" /> : formatNumber(detail?.stats?.messages ?? 0)} />
            <InfoTile label={tr('جهات الاتصال', 'Contacts')} value={isLoading ? <Skeleton className="h-5 w-12" /> : formatNumber(detail?.stats?.contacts ?? 0)} />
            <InfoTile label={tr('أرقام واتساب', 'WhatsApp numbers')} value={isLoading ? <Skeleton className="h-5 w-12" /> : formatNumber(detail?.instances?.length ?? 0)} />
          </div>

          {!!detail?.instances?.length && (
            <div>
              <p className="mb-2 text-sm font-semibold text-ink">{tr('أرقام واتساب', 'WhatsApp numbers')}</p>
              <ul className="divide-y divide-line-soft rounded-xl border border-line">
                {detail.instances.map(inst => (
                  <li key={inst.id} className="flex items-center gap-3 px-3.5 py-2.5 text-sm">
                    <DevicePhoneMobileIcon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-ink" dir="auto">{inst.display_name || inst.phone_number || tr('بدون رقم', 'No number')}</span>
                    <span className="text-xs text-muted">{inst.instance_type === 'wa_web' ? 'WA Web' : (inst.instance_type || inst.type) === 'cloud_api' ? 'Cloud API' : (inst.instance_type || inst.type || '')}</span>
                    <StatusPill status={inst.status} size="sm">{inst.status || '—'}</StatusPill>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && <Notice tone="danger" icon={ExclamationTriangleIcon} title={tr('لم يُحفظ التغيير', 'The change was not saved')}>{error}</Notice>}

          {/* Plan */}
          <Card variant="muted" padding="md" className="space-y-4">
            <div className="flex items-center gap-2">
              <CreditCardIcon className="h-5 w-5 text-brand-ink" aria-hidden="true" />
              <h3 className="section-title">{tr('تعيين الباقة', 'Plan assignment')}</h3>
            </div>
            {stripeBilled && (
              <Notice tone="warning" title={tr('اشتراك مُدار عبر Stripe', 'Billed through Stripe')}>
                {tr('لا يمكن تبديل الباقة من هنا؛ غيّرها من Stripe. إزالة الباقة تُلغي اشتراك Stripe، وتاريخ الانتهاء يديره Stripe.',
                  'The plan can’t be switched here; change it in Stripe. Removing the plan cancels the Stripe subscription, and expiry is managed by Stripe.')}
              </Notice>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={tr('الباقة', 'Plan')}>
                <Select value={planId} onChange={e => setPlanId(e.target.value)} options={planOptions} />
              </Field>
              {planId && (
                <Field label={tr('تاريخ الانتهاء', 'Expires on')} hint={tr('اتركه فارغًا لباقة دائمة', 'Leave empty for no expiry')}>
                  <Input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} dir="ltr" />
                </Field>
              )}
            </div>
            <div className="flex justify-end gap-2">
              {(planChanged || expiryChanged) && (
                <Button variant="ghost" size="sm" onClick={() => { setPlanId(user.plan_id || ''); setExpiry(dayOnly(user.plan_expires_at)) }}>{tr('تراجع', 'Reset')}</Button>
              )}
              <Button size="sm" loading={saving} disabled={!planChanged && !(planId && expiryChanged)}
                onClick={() => (planChanged && !planId && user.plan_id ? setConfirm('removePlan') : savePlan())}>
                {tr('حفظ الباقة', 'Save plan')}
              </Button>
            </div>
          </Card>

          {/* Role */}
          <Card variant="muted" padding="md" className="space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheckIcon className="h-5 w-5 text-brand-ink" aria-hidden="true" />
              <h3 className="section-title">{tr('الدور', 'Role')}</h3>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Tabs variant="segmented" size="sm" value={role} onChange={v => setRole(v as 'user' | 'admin')} aria-label={tr('الدور', 'Role')}
                tabs={[{ id: 'user', label: tr('مستخدم', 'User'), icon: UserIcon }, { id: 'admin', label: tr('مدير المنصة', 'Platform admin'), icon: ShieldCheckIcon }]} />
              <Button size="sm" variant="secondary" disabled={!roleChanged || (isSelf && role === 'user')} loading={saving} onClick={() => setConfirm('role')}>
                {tr('تغيير الدور', 'Change role')}
              </Button>
            </div>
            <p className="text-xs text-muted">{tr('تغيير الدور يُنهي جميع جلسات المستخدم الحالية.', 'Changing the role signs the user out of every session.')}</p>
          </Card>

          {/* Status */}
          <Card variant="muted" padding="md" className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="section-title">{tr('حالة الحساب', 'Account status')}</h3>
              <p className="mt-0.5 text-xs text-muted">
                {user.is_active
                  ? tr('الإيقاف يمنع الدخول ويُنهي الجلسات فورًا.', 'Suspending blocks sign-in and ends sessions immediately.')
                  : tr('الحساب موقوف حاليًا.', 'This account is currently suspended.')}
              </p>
            </div>
            {user.is_active ? (
              <Button variant="danger-soft" size="sm" icon={NoSymbolIcon} disabled={isSelf} onClick={() => setConfirm('suspend')}>{tr('إيقاف الحساب', 'Suspend')}</Button>
            ) : (
              <Button variant="secondary" size="sm" icon={CheckCircleIcon} onClick={() => setConfirm('activate')}>{tr('تفعيل الحساب', 'Activate')}</Button>
            )}
          </Card>
        </div>
      </Drawer>

      <ConfirmDialog
        open={confirm === 'suspend'}
        destructive
        onClose={() => setConfirm(null)}
        loading={saving}
        title={tr('إيقاف هذا المستخدم؟', 'Suspend this user?')}
        description={tr(`سيُمنع ${name} من الدخول وتنتهي جلساته الحالية.`, `${name} will be blocked from signing in and signed out everywhere.`)}
        confirmLabel={tr('إيقاف', 'Suspend')}
        onConfirm={() => onSave(user.id, { is_active: false }, tr('تم إيقاف المستخدم', 'User suspended')).then(() => setConfirm(null), () => setConfirm(null))}
      />
      <ConfirmDialog
        open={confirm === 'activate'}
        onClose={() => setConfirm(null)}
        loading={saving}
        title={tr('تفعيل هذا المستخدم؟', 'Activate this user?')}
        confirmLabel={tr('تفعيل', 'Activate')}
        onConfirm={() => onSave(user.id, { is_active: true }, tr('تم تفعيل المستخدم', 'User activated')).then(() => setConfirm(null), () => setConfirm(null))}
      />
      <ConfirmDialog
        open={confirm === 'role'}
        destructive={role === 'admin'}
        onClose={() => setConfirm(null)}
        loading={saving}
        title={role === 'admin' ? tr('منح صلاحيات مدير المنصة؟', 'Grant platform admin rights?') : tr('إزالة صلاحيات المدير؟', 'Remove admin rights?')}
        description={role === 'admin'
          ? tr('سيتمكّن هذا المستخدم من إدارة المنصة بالكامل، بما في ذلك الإعدادات والمستخدمين.', 'This user will be able to manage the whole platform, including settings and users.')
          : tr('سيعود الحساب مستخدمًا عاديًا.', 'The account goes back to a regular user.')}
        confirmLabel={tr('تأكيد', 'Confirm')}
        onConfirm={() => onSave(user.id, { role }, tr('تم تغيير الدور', 'Role changed')).then(() => setConfirm(null), () => setConfirm(null))}
      />
      <ConfirmDialog
        open={confirm === 'removePlan'}
        destructive
        onClose={() => setConfirm(null)}
        loading={saving}
        title={tr('إزالة الباقة؟', 'Remove the plan?')}
        description={stripeBilled
          ? tr('سيُلغى اشتراك Stripe لهذا المستخدم ويعود إلى الباقة المجانية.', 'The user’s Stripe subscription will be cancelled and they return to the free tier.')
          : tr('سيعود المستخدم إلى الباقة المجانية ويُلغى اشتراكه اليدوي.', 'The user returns to the free tier and the manual subscription is cancelled.')}
        confirmLabel={tr('إزالة الباقة', 'Remove plan')}
        onConfirm={() => savePlan().then(() => setConfirm(null), () => setConfirm(null))}
      />
    </>
  )
}
