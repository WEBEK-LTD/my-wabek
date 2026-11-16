import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import axios from 'axios'
import toast from 'react-hot-toast'
import { UserGroupIcon, LinkSlashIcon, CheckBadgeIcon } from '@heroicons/react/24/outline'
import { Avatar, Button, Field, Skeleton, Badge } from '@/components/ui'
import { useAuthStore } from '@/lib/store'
import { AuthLayout, AuthHeading } from '@/components/auth/AuthLayout'
import { AuthAlert, PasswordInput, PasswordStrength } from '@/components/auth/AuthParts'
import { useAuthCopy } from '@/components/auth/copy'
import type { AuthCopyKey } from '@/components/auth/copy'

interface Invite { name?: string; email?: string; role?: string; owner_name?: string }

const ROLE_KEYS: Record<string, AuthCopyKey> = { admin: 'role_admin', agent: 'role_agent', viewer: 'role_viewer' }

function describeAcceptError(e: any): { key: AuthCopyKey; raw?: string } {
  const msg = String(e?.response?.data?.error || '')
  if (!e?.response) return { key: 'err_network' }
  if (/another team/i.test(msg)) return { key: 'ti_other_team' }
  if (/own team/i.test(msg)) return { key: 'ti_own_team' }
  if (/admin accounts/i.test(msg)) return { key: 'ti_admin' }
  if (/suspended/i.test(msg)) return { key: 'err_suspended_d' }
  if (/invalid or expired/i.test(msg)) return { key: 'ti_invalid_t' }
  if (/at least 8/i.test(msg)) return { key: 'err_password_short' }
  return { key: 'ti_failed', raw: msg || undefined }
}

export default function TeamInvitePage() {
  const router = useRouter()
  const { token } = router.query
  const { c } = useAuthCopy()
  const { user: me, setUser, setToken, fetchMe } = useAuthStore()
  const [step, setStep] = useState<'loading' | 'info' | 'invalid'>('loading')
  const [invite, setInvite] = useState<Invite | null>(null)
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [errors, setErrors] = useState<{ password?: AuthCopyKey; confirm?: AuthCopyKey }>({})
  const [acceptError, setAcceptError] = useState<{ key: AuthCopyKey; raw?: string } | null>(null)
  const [loading, setLoading] = useState(false)

  // The session lives in the HttpOnly cookie: load the profile if it isn't cached.
  useEffect(() => { if (!me) fetchMe().catch(() => {}) }, [])

  useEffect(() => {
    if (!router.isReady) return
    if (!token) { setStep('invalid'); return }
    axios.get(`/api/team/invite?token=${encodeURIComponent(String(token))}`)
      .then(r => { setInvite(r.data.invite); setStep('info') })
      .catch(() => setStep('invalid'))
  }, [router.isReady, token])

  // Already logged in as the invited account → accept without a password.
  const loggedInAsInvitee = !!(me?.email && invite?.email && me.email.toLowerCase() === String(invite.email).toLowerCase())
  const loggedInAsOther = !!(me?.email && invite?.email && !loggedInAsInvitee)

  const accept = async () => {
    if (!loggedInAsInvitee) {
      const errs: typeof errors = {}
      if (form.password.length < 8) errs.password = 'err_password_short'
      if (form.password !== form.confirm) errs.confirm = 'mismatch'
      setErrors(errs)
      if (Object.keys(errs).length) return
    }
    setLoading(true)
    setAcceptError(null)
    try {
      const { data } = await axios.post('/api/team/invite/accept', loggedInAsInvitee ? { token } : { token, password: form.password })
      setUser(data.user)
      // In-memory only; the HttpOnly cookie is the session.
      if (data.token) setToken(data.token)
      toast.success(c('ti_welcome'))
      router.push('/dashboard')
      useAuthStore.getState().fetchMe().catch(() => {})
    } catch (e: any) {
      if (e?.response?.status === 409 && e?.response?.data?.requiresLogin) {
        // The email already has an account: log in as it, then come back here.
        toast.error(c('ti_requires_login'), { duration: 6000 })
        router.push(`/auth/login?redirect=${encodeURIComponent(router.asPath)}`)
        return
      }
      setAcceptError(describeAcceptError(e))
    } finally { setLoading(false) }
  }

  const roleLabel = invite?.role ? (ROLE_KEYS[invite.role] ? c(ROLE_KEYS[invite.role]) : invite.role) : ''

  return (
    <AuthLayout title={c('ti_title')}>
      {step === 'loading' && (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label={c('ti_loading')}>
          <Skeleton className="h-12 w-12 rounded-2xl" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {step === 'invalid' && (
        <div className="flex flex-col items-center text-center">
          <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-[22px] bg-danger-bg text-danger">
            <LinkSlashIcon className="h-8 w-8" aria-hidden="true" />
          </span>
          <h1 className="text-[24px] font-bold text-ink">{c('ti_invalid_t')}</h1>
          <p className="mt-3 text-[15px] text-muted">{c('ti_invalid_d')}</p>
          <Button variant="secondary" href="/auth/login" className="mt-6">{c('back_to_login')}</Button>
        </div>
      )}

      {step === 'info' && invite && (
        <>
          <AuthHeading icon={UserGroupIcon} title={c('ti_title')} />

          <div className="mb-6 overflow-hidden rounded-panel border border-line bg-surface shadow-card">
            <div className="bg-deep-hero px-5 py-4">
              <p className="text-xs text-deep-muted">{c('ti_invited_to')}</p>
              <p className="mt-0.5 text-lg font-bold text-deep-ink">{invite.owner_name || 'WABEK'}</p>
              {roleLabel && <Badge tone="brand" size="sm" className="mt-2">{c('ti_as_role', { role: roleLabel })}</Badge>}
            </div>
            <div className="flex items-center gap-3 px-5 py-4">
              <Avatar name={invite.name || invite.email} />
              <div className="min-w-0">
                <p className="text-xs text-muted">{c('ti_joining_as')}</p>
                <p className="truncate font-semibold text-ink">{invite.name}</p>
                <p className="truncate text-sm text-muted" dir="ltr">{invite.email}</p>
              </div>
            </div>
          </div>

          {loggedInAsInvitee && (
            <AuthAlert tone="success" className="mb-5">{c('ti_logged_in')}</AuthAlert>
          )}
          {loggedInAsOther && (
            <AuthAlert tone="info" className="mb-5">{c('ti_other_account', { email: '⁨' + me!.email + '⁩', invite: '⁨' + (invite.email || '') + '⁩' })}</AuthAlert>
          )}

          <form onSubmit={e => { e.preventDefault(); accept() }} noValidate className="flex flex-col gap-4">
            {!loggedInAsInvitee && (
              <>
                <div>
                  <Field label={c('ti_set_password')} hint={form.password ? undefined : c('ti_password_rule')} error={errors.password ? c(errors.password) : undefined}>
                    <PasswordInput autoComplete="new-password" placeholder={c('new_password_ph')} value={form.password}
                      onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setErrors(x => ({ ...x, password: undefined })) }} />
                  </Field>
                  <PasswordStrength password={form.password} />
                </div>
                <Field label={c('confirm_password')} error={errors.confirm ? c(errors.confirm) : (form.confirm && form.password !== form.confirm ? c('mismatch') : undefined)}>
                  <PasswordInput autoComplete="new-password" placeholder={c('confirm_ph')} value={form.confirm}
                    onChange={e => { setForm(f => ({ ...f, confirm: e.target.value })); setErrors(x => ({ ...x, confirm: undefined })) }} />
                </Field>
              </>
            )}

            {acceptError && <AuthAlert tone="danger">{acceptError.raw || c(acceptError.key)}</AuthAlert>}

            <Button type="submit" size="lg" fullWidth loading={loading} icon={CheckBadgeIcon} disabled={!loggedInAsInvitee && !form.password}>
              {loading ? c('ti_joining') : c('ti_accept')}
            </Button>
          </form>

          {!loggedInAsInvitee && (
            <p className="mt-6 text-center text-sm text-muted">
              {c('ti_has_account')}{' '}
              <Link href={`/auth/login?redirect=${encodeURIComponent(router.asPath)}`} className="font-semibold text-link hover:text-link-hover">{c('ti_login_first')}</Link>
            </p>
          )}
        </>
      )}
    </AuthLayout>
  )
}
