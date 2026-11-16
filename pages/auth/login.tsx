import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import axios from 'axios'
import toast from 'react-hot-toast'
import { EnvelopeIcon, ShieldCheckIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { Button, Field, Input, Checkbox } from '@/components/ui'
import { useAuthStore } from '@/lib/store'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import { AuthLayout, AuthHeading } from '@/components/auth/AuthLayout'
import {
  AuthAlert, AuthDivider, AuthErrorAlert, OAuthButtons, OtpCodeInput, PasswordInput, useCooldown,
} from '@/components/auth/AuthParts'
import { useAuthCopy } from '@/components/auth/copy'
import type { AuthCopyKey } from '@/components/auth/copy'
import {
  describeAuthError, describeQueryError, getDeviceFingerprint, safeRedirect, validateEmail,
} from '@/components/auth/session'
import type { AuthErrorView } from '@/components/auth/session'

type Step = 'form' | 'otp'
type Purpose = 'login' | 'registration'

const RESEND_SECONDS = 30

export default function LoginPage() {
  const router = useRouter()
  const redirectTo = safeRedirect(router.query.redirect)
  const { setUser, setToken } = useAuthStore()
  const { brandName } = useWhiteLabel()
  const brand = brandName || 'WABEK'
  const { c } = useAuthCopy()

  const [form, setForm] = useState({ email: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState<{ email?: AuthCopyKey; password?: AuthCopyKey }>({})
  const [error, setError] = useState<AuthErrorView | null>(null)
  const [loading, setLoading] = useState(false)

  const [step, setStep] = useState<Step>('form')
  const [purpose, setPurpose] = useState<Purpose>('login')
  const [pendingUserId, setPendingUserId] = useState('')
  const [method, setMethod] = useState<'whatsapp' | 'email' | null>(null)
  const [pendingPhone, setPendingPhone] = useState('')
  const [pendingEmail, setPendingEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState<AuthErrorView | null>(null)
  const [trustDevice, setTrustDevice] = useState(false)
  const [resendLeft, setResendLeft] = useCooldown(0)

  const queryError = describeQueryError(router.query.error)

  useEffect(() => { setError(null) }, [form.email, form.password])

  const finish = (data: any) => {
    setUser(data.user)
    // In-memory only; the HttpOnly cookie set by the server is the session.
    setToken(data.token || null)
    router.push(redirectTo)
    // Load the full profile (language, team role…) in the background.
    useAuthStore.getState().fetchMe().catch(() => {})
  }

  const startOtp = (opts: { userId: string; purpose: Purpose; method?: 'whatsapp' | 'email' | null; phone?: string; email?: string }) => {
    setPendingUserId(opts.userId)
    setPurpose(opts.purpose)
    setMethod(opts.method ?? null)
    setPendingPhone(opts.phone || '')
    setPendingEmail(opts.email || '')
    setOtp('')
    setOtpError(null)
    setStep('otp')
    setResendLeft(RESEND_SECONDS)
  }

  const submitLogin = async (resend = false) => {
    if (!resend) {
      const errs: typeof fieldErrors = {}
      const e1 = validateEmail(form.email)
      if (e1) errs.email = e1
      if (!form.password) errs.password = 'err_password_required'
      setFieldErrors(errs)
      if (Object.keys(errs).length) return
    }
    setLoading(true)
    setError(null)
    try {
      const { data } = await axios.post('/api/auth/login', {
        ...form,
        email: form.email.trim(),
        deviceFingerprint: getDeviceFingerprint(),
      })
      if (data.requiresOtp) {
        startOtp({ userId: data.userId, purpose: 'login', method: data.method, phone: data.phone, email: data.email })
        toast.success(resend ? c('code_resent') : data.method === 'email' ? c('otp_sent_email') : c('otp_sent_whatsapp'))
      } else if (data.requiresVerification) {
        startOtp({ userId: data.userId, purpose: 'registration' })
      } else if (data.success) {
        finish(data)
      }
    } catch (e: any) {
      const d = e?.response?.data
      if (e?.response?.status === 403 && d?.requiresVerification && d?.userId) {
        // Registration not completed: the server just sent a verification code.
        startOtp({ userId: d.userId, purpose: 'registration' })
        if (resend) toast.success(c('code_resent'))
      } else if (step === 'otp') {
        setOtpError(describeAuthError(e))
      } else {
        setError(describeAuthError(e))
      }
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
        purpose,
        trustDevice,
        deviceFingerprint: getDeviceFingerprint(),
      })
      toast.success(c('welcome_toast'))
      finish(data)
    } catch (e: any) {
      setOtpError(describeAuthError(e))
      setOtp('')
    } finally { setLoading(false) }
  }

  const backToForm = () => { setStep('form'); setOtp(''); setOtpError(null) }

  const sentLine = method === 'email' ? c('otp_sent_email') : method === 'whatsapp' ? c('otp_sent_whatsapp') : c('otp_sent_generic')
  const sentTo = method === 'email' ? pendingEmail : pendingPhone

  return (
    <AuthLayout title={c('login_title')}>
      {step === 'form' ? (
        <>
          <AuthHeading title={c('login_title')} subtitle={c('login_subtitle', { brand })} />

          {queryError && <AuthErrorAlert error={queryError} className="mb-5" />}

          <OAuthButtons providers={['google', 'github']} />
          <AuthDivider>{c('or_email')}</AuthDivider>

          <form onSubmit={e => { e.preventDefault(); submitLogin() }} noValidate className="flex flex-col gap-4">
            <Field label={c('email')} error={fieldErrors.email ? c(fieldErrors.email) : undefined}>
              <div dir="ltr">
                <Input
                  type="email" inputMode="email" autoComplete="email" autoFocus
                  icon={EnvelopeIcon} placeholder={c('email_ph')}
                  value={form.email}
                  onChange={e => { setForm(d => ({ ...d, email: e.target.value })); setFieldErrors(f => ({ ...f, email: undefined })) }}
                />
              </div>
            </Field>
            <Field
              label={c('password')}
              error={fieldErrors.password ? c(fieldErrors.password) : undefined}
              labelAction={<Link href="/auth/forgot-password" className="font-medium text-link hover:text-link-hover">{c('forgot')}</Link>}
            >
              <PasswordInput
                autoComplete="current-password" placeholder={c('password_ph')}
                value={form.password}
                onChange={e => { setForm(d => ({ ...d, password: e.target.value })); setFieldErrors(f => ({ ...f, password: undefined })) }}
              />
            </Field>

            <AuthErrorAlert error={error} />

            <Button type="submit" size="lg" fullWidth loading={loading} className="mt-1">
              {loading ? c('signing_in') : c('sign_in')}
            </Button>
          </form>

          <p className="mt-7 text-center text-sm text-muted">
            {c('no_account', { brand })}{' '}
            <Link href={redirectTo !== '/dashboard' ? `/auth/register?redirect=${encodeURIComponent(redirectTo)}` : '/auth/register'} className="font-semibold text-link hover:text-link-hover">{c('create_one')}</Link>
          </p>
        </>
      ) : (
        <>
          <AuthHeading
            icon={ShieldCheckIcon}
            title={purpose === 'registration' ? c('otp_title_verify') : c('otp_title_login')}
            subtitle={
              <>
                {sentLine}
                {sentTo && <> <bdi dir="ltr" className="font-semibold text-ink">{sentTo}</bdi></>}
              </>
            }
          />

          {purpose === 'registration' && (
            <AuthAlert tone="info" className="mb-5">{c('otp_unverified_note')}</AuthAlert>
          )}

          <form onSubmit={e => { e.preventDefault(); verifyOtp() }} className="flex flex-col gap-5">
            <OtpCodeInput
              value={otp}
              onChange={v => { setOtp(v); setOtpError(null) }}
              onComplete={v => verifyOtp(v)}
              invalid={!!otpError}
              disabled={loading}
              autoFocus
            />
            <AuthErrorAlert error={otpError} />

            {purpose === 'login' && (
              <Checkbox
                label={c('trust_device')}
                description={c('trust_device_d')}
                checked={trustDevice}
                onChange={e => setTrustDevice(e.target.checked)}
              />
            )}

            <Button type="submit" size="lg" fullWidth loading={loading} disabled={otp.length !== 6}>
              {loading ? c('verifying') : purpose === 'registration' ? c('verify_account') : c('verify_sign_in')}
            </Button>
          </form>

          <div className="mt-6 flex flex-col items-center gap-3 text-sm">
            <p className="text-muted">
              {c('didnt_receive')}{' '}
              {resendLeft > 0 ? (
                <span className="tabular text-muted">{c('resend_in', { s: resendLeft })}</span>
              ) : (
                <button type="button" onClick={() => submitLogin(true)} disabled={loading} className="font-semibold text-link hover:text-link-hover disabled:opacity-60">
                  {c('resend')}
                </button>
              )}
            </p>
            <button type="button" onClick={backToForm} className="inline-flex items-center gap-1.5 text-muted hover:text-ink">
              <ArrowLeftIcon className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              {c('back_to_login')}
            </button>
          </div>
        </>
      )}
    </AuthLayout>
  )
}
