import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  EnvelopeIcon, UserIcon, PhoneIcon, TicketIcon, ShieldCheckIcon, ArrowLeftIcon, GiftIcon, ChevronDownIcon,
} from '@heroicons/react/24/outline'
import { Button, Field, Input, Checkbox, Badge, Spinner } from '@/components/ui'
import { cn } from '@/components/ui/utils'
import { useAuthStore } from '@/lib/store'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import { AuthLayout, AuthHeading } from '@/components/auth/AuthLayout'
import {
  AuthDivider, AuthErrorAlert, OAuthButtons, OtpCodeInput, PasswordInput, PasswordStrength, useCooldown,
} from '@/components/auth/AuthParts'
import { useAuthCopy } from '@/components/auth/copy'
import type { AuthCopyKey } from '@/components/auth/copy'
import { describeAuthError, getDeviceFingerprint, safeRedirect, validateEmail } from '@/components/auth/session'
import type { AuthErrorView } from '@/components/auth/session'

const PHONE_RE = /^\+?[0-9 ()-]{6,24}$/
const CODE_RE = /^[A-Za-z0-9-]{1,64}$/

interface InviteInfo {
  code: string
  reseller_name?: string | null
  reseller_logo?: string | null
  trial_days?: number
  discount_pct?: number | null
  plan?: { custom_name?: string | null; base_plan?: { name?: string } | null } | null
}

type FieldKey = 'name' | 'email' | 'password' | 'phone'

export default function RegisterPage() {
  const router = useRouter()
  const { brandName } = useWhiteLabel()
  const brand = brandName || 'WABEK'
  const { c, lang } = useAuthCopy()
  const { setUser, setToken } = useAuthStore()
  const redirectTo = safeRedirect(router.query.redirect)

  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' })
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, AuthCopyKey>>>({})
  const [error, setError] = useState<{ view: AuthErrorView; exists?: boolean } | null>(null)
  const [loading, setLoading] = useState(false)

  // Reseller invite code (?code=…)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null)
  const [inviteState, setInviteState] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle')
  const checkedCode = useRef('')

  // OTP step
  const [step, setStep] = useState<'form' | 'otp'>('form')
  const [pendingUserId, setPendingUserId] = useState('')
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState<AuthErrorView | null>(null)
  const [trustDevice, setTrustDevice] = useState(true)
  const [resendLeft, setResendLeft] = useCooldown(0)

  const validateInvite = (code: string) => {
    const v = code.trim()
    if (!v || !CODE_RE.test(v)) { setInviteInfo(null); setInviteState(v ? 'invalid' : 'idle'); checkedCode.current = v; return }
    if (checkedCode.current === v) return
    checkedCode.current = v
    setInviteState('checking')
    axios.get(`/api/reseller/validate-code?code=${encodeURIComponent(v)}`)
      .then(r => { if (checkedCode.current === v) { setInviteInfo(r.data.invite); setInviteState('valid') } })
      .catch(() => { if (checkedCode.current === v) { setInviteInfo(null); setInviteState('invalid') } })
  }

  useEffect(() => {
    if (!router.isReady) return
    const param = router.query.code
    if (typeof param === 'string' && param) {
      setInviteCode(param)
      setInviteOpen(true)
      validateInvite(param)
    }
  }, [router.isReady, router.query.code])

  const update = (k: FieldKey, v: string) => {
    setForm(d => ({ ...d, [k]: v }))
    setFieldErrors(f => ({ ...f, [k]: undefined }))
    setError(null)
  }

  const finish = (data: any, welcome: string) => {
    setUser(data.user)
    setToken(data.token || null)
    router.push(redirectTo)
    toast.success(welcome)
    useAuthStore.getState().fetchMe().catch(() => {})
  }

  const handleRegister = async () => {
    const errs: typeof fieldErrors = {}
    if (form.name.trim().length < 2) errs.name = 'err_name'
    const e1 = validateEmail(form.email)
    if (e1) errs.email = e1
    if (form.password.length < 8) errs.password = 'err_password_short'
    if (form.phone.trim() && !PHONE_RE.test(form.phone.trim())) errs.phone = 'err_phone'
    setFieldErrors(errs)
    if (Object.keys(errs).length) return

    setLoading(true)
    setError(null)
    try {
      const code = inviteCode.trim()
      const { data } = await axios.post('/api/auth/register', {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim(),
        ...(code ? { invite_code: code } : {}),
      })
      if (data.requiresVerification) {
        setPendingUserId(data.userId)
        setOtp('')
        setStep('otp')
        setResendLeft(30)
        toast.success(c('otp_sent_whatsapp'))
      } else {
        finish(data, c('welcome_new', { brand }))
      }
    } catch (e: any) {
      const status = e?.response?.status
      const d = e?.response?.data
      if (status === 409) setError({ view: { body: 'reg_err_exists', tone: 'danger' }, exists: true })
      else if (status === 403) setError({ view: { body: 'reg_err_disabled', tone: 'warning' } })
      else if (status === 429) setError({ view: { title: 'err_rate_t', body: 'reg_err_rate', tone: 'warning' } })
      else if (status === 400 && Array.isArray(d?.details)) {
        const map: Partial<Record<FieldKey, AuthCopyKey>> = {}
        for (const it of d.details) {
          const p = it?.path?.[0]
          if (p === 'name') map.name = 'err_name'
          if (p === 'email') map.email = 'err_email_invalid'
          if (p === 'password') map.password = 'err_password_short'
          if (p === 'phone') map.phone = 'err_phone'
        }
        setFieldErrors(map)
        if (!Object.keys(map).length) setError({ view: { body: 'reg_err_generic', tone: 'danger' } })
      } else if (!e?.response) setError({ view: { body: 'err_network', tone: 'danger' } })
      else setError({ view: { body: 'reg_err_generic', tone: 'danger' } })
    } finally { setLoading(false) }
  }

  const verifyOtp = async (code = otp) => {
    if (loading) return
    if (code.length !== 6) { setOtpError({ body: 'err_otp_length', tone: 'danger' }); return }
    setLoading(true)
    setOtpError(null)
    try {
      const { data } = await axios.post('/api/auth/verify-otp', {
        userId: pendingUserId,
        otp: code,
        purpose: 'registration',
        trustDevice,
        deviceFingerprint: getDeviceFingerprint(),
      })
      finish(data, c('verified_welcome'))
    } catch (e: any) {
      setOtpError(describeAuthError(e))
      setOtp('')
    } finally { setLoading(false) }
  }

  // The account now exists (unverified): signing in with it re-sends the
  // registration code (403 requiresVerification). Re-posting /register would
  // only answer 409 "already registered".
  const resendOtp = async () => {
    setLoading(true)
    setOtpError(null)
    try {
      const { data } = await axios.post('/api/auth/login', { email: form.email.trim(), password: form.password, deviceFingerprint: getDeviceFingerprint() })
      if (data?.success) { finish(data, c('welcome_new', { brand })); return }
      toast.success(c('code_resent'))
      setResendLeft(30)
    } catch (e: any) {
      if (e?.response?.data?.requiresVerification) { toast.success(c('code_resent')); setResendLeft(30) }
      else setOtpError(describeAuthError(e))
    } finally { setLoading(false) }
  }

  const planName = inviteInfo?.plan?.custom_name || inviteInfo?.plan?.base_plan?.name

  if (step === 'otp') {
    return (
      <AuthLayout title={c('otp_title_verify')}>
        <AuthHeading
          icon={ShieldCheckIcon}
          title={c('otp_title_verify')}
          subtitle={form.phone
            ? <>{c('otp_sent_whatsapp')} <bdi dir="ltr" className="font-semibold text-ink">{form.phone}</bdi></>
            : c('otp_sent_generic')}
        />
        <form onSubmit={e => { e.preventDefault(); verifyOtp() }} className="flex flex-col gap-5">
          <OtpCodeInput value={otp} onChange={v => { setOtp(v); setOtpError(null) }} onComplete={v => verifyOtp(v)} invalid={!!otpError} disabled={loading} autoFocus />
          <AuthErrorAlert error={otpError} />
          <Checkbox label={c('trust_device')} description={c('trust_device_d')} checked={trustDevice} onChange={e => setTrustDevice(e.target.checked)} />
          <Button type="submit" size="lg" fullWidth loading={loading} disabled={otp.length !== 6}>
            {loading ? c('verifying') : c('verify_account')}
          </Button>
        </form>
        <div className="mt-6 flex flex-col items-center gap-3 text-sm">
          <p className="text-muted">
            {c('didnt_receive')}{' '}
            {resendLeft > 0
              ? <span className="tabular">{c('resend_in', { s: resendLeft })}</span>
              : <button type="button" onClick={resendOtp} disabled={loading} className="font-semibold text-link hover:text-link-hover disabled:opacity-60">{c('resend')}</button>}
          </p>
          <button type="button" onClick={() => { setStep('form'); setOtp(''); setOtpError(null) }} className="inline-flex items-center gap-1.5 text-muted hover:text-ink">
            <ArrowLeftIcon className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            {c('go_back')}
          </button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title={c('reg_title')} width="md">
      <AuthHeading title={c('reg_title')} subtitle={c('reg_subtitle', { brand })} />

      {inviteState === 'valid' && inviteInfo && (
        <div className="mb-6 flex items-start gap-3 overflow-hidden rounded-2xl bg-brand-gradient-soft p-4 text-[#04282C]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#04282C]/10">
            <GiftIcon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-col gap-1.5">
            <p className="font-semibold">{inviteInfo.reseller_name ? c('invite_from', { name: inviteInfo.reseller_name }) : c('invite_code')}</p>
            <div className="flex flex-wrap gap-1.5 text-xs font-medium">
              {!!inviteInfo.trial_days && <span className="rounded-full bg-[#04282C]/10 px-2.5 py-1">{c('invite_trial', { days: inviteInfo.trial_days })}</span>}
              {!!inviteInfo.discount_pct && <span className="rounded-full bg-[#04282C]/10 px-2.5 py-1">{c('invite_discount', { pct: inviteInfo.discount_pct })}</span>}
              {planName && <span className="rounded-full bg-[#04282C]/10 px-2.5 py-1">{c('invite_plan', { plan: planName })}</span>}
            </div>
          </div>
        </div>
      )}

      <OAuthButtons providers={['google', 'facebook', 'github']} />
      <AuthDivider>{c('or_email')}</AuthDivider>

      <form onSubmit={e => { e.preventDefault(); handleRegister() }} noValidate className="flex flex-col gap-4">
        <Field label={c('full_name')} error={fieldErrors.name ? c(fieldErrors.name) : undefined}>
          <Input icon={UserIcon} autoComplete="name" placeholder={c('name_ph')} value={form.name} onChange={e => update('name', e.target.value)} />
        </Field>
        <Field label={c('email')} error={fieldErrors.email ? c(fieldErrors.email) : undefined}>
          <Input type="email" inputMode="email" autoComplete="email" dir="ltr" className="text-start" icon={EnvelopeIcon} placeholder={c('email_ph')} value={form.email} onChange={e => update('email', e.target.value)} />
        </Field>
        <Field label={c('password')} hint={form.password ? undefined : c('password_hint')} error={fieldErrors.password ? c(fieldErrors.password) : undefined}>
          <PasswordInput autoComplete="new-password" placeholder={c('password_hint')} value={form.password} onChange={e => update('password', e.target.value)} />
        </Field>
        <PasswordStrength password={form.password} />
        <Field
          label={<>{c('phone')} <span className="font-normal text-muted">({c('optional')})</span></>}
          hint={c('phone_hint')}
          error={fieldErrors.phone ? c(fieldErrors.phone) : undefined}
        >
          <Input type="tel" inputMode="tel" autoComplete="tel" dir="ltr" className="text-start" icon={PhoneIcon} placeholder="+201234567890" value={form.phone} onChange={e => update('phone', e.target.value)} />
        </Field>

        {/* Invite code */}
        <div className="rounded-2xl border border-line bg-surface-2/60">
          <button
            type="button"
            onClick={() => setInviteOpen(o => !o)}
            aria-expanded={inviteOpen}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-ink"
          >
            <span className="flex items-center gap-2"><TicketIcon className="h-[18px] w-[18px] text-brand-ink" aria-hidden="true" />{c('invite_have')}</span>
            <span className="flex items-center gap-2">
              {inviteState === 'valid' && <Badge tone="success" size="sm">{inviteCode.trim().toUpperCase()}</Badge>}
              <ChevronDownIcon className={cn('h-4 w-4 text-muted transition-transform', inviteOpen && 'rotate-180')} aria-hidden="true" />
            </span>
          </button>
          {inviteOpen && (
            <div className="border-t border-line-soft px-4 pb-4 pt-3">
              <Field
                label={c('invite_code')}
                hint={inviteState === 'invalid' ? undefined : c('invite_hint')}
                error={inviteState === 'invalid' ? c('invite_invalid') : undefined}
              >
                <Input
                  dir="ltr" className="text-start uppercase tracking-wider" placeholder={c('invite_ph')}
                  value={inviteCode}
                  onChange={e => { setInviteCode(e.target.value); if (inviteState !== 'idle') setInviteState('idle'); checkedCode.current = '' }}
                  onBlur={() => validateInvite(inviteCode)}
                  endAdornment={inviteState === 'checking' ? <Spinner label={c('invite_checking')} /> : undefined}
                />
              </Field>
            </div>
          )}
        </div>

        {error && (
          <AuthErrorAlert error={error.view} />
        )}
        {error?.exists && (
          <p className="-mt-2 text-sm">
            <Link href="/auth/login" className="font-semibold text-link hover:text-link-hover">{c('sign_in_link')}</Link>
            <span className="text-muted"> · </span>
            <Link href="/auth/forgot-password" className="font-medium text-link hover:text-link-hover">{c('forgot')}</Link>
          </p>
        )}

        <Button type="submit" size="lg" fullWidth loading={loading} className="mt-1">
          {loading ? c('creating') : c('create_account')}
        </Button>

        <p className="text-center text-xs leading-relaxed text-muted">
          {c('terms_prefix')}{' '}
          <Link href="/legal/terms" className="text-link hover:text-link-hover">{c('terms')}</Link>{' '}
          {c('and')}{lang === 'ar' ? '' : ' '}
          <Link href="/legal/privacy" className="text-link hover:text-link-hover">{c('privacy')}</Link>.
        </p>
      </form>

      <p className="mt-7 text-center text-sm text-muted">
        {c('have_account')}{' '}
        <Link href="/auth/login" className="font-semibold text-link hover:text-link-hover">{c('sign_in_link')}</Link>
      </p>
    </AuthLayout>
  )
}
