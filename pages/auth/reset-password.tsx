import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import axios from 'axios'
import toast from 'react-hot-toast'
import { LockClosedIcon, CheckCircleIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { Button, Field } from '@/components/ui'
import { AuthLayout, AuthHeading } from '@/components/auth/AuthLayout'
import { AuthAlert, PasswordInput, PasswordStrength } from '@/components/auth/AuthParts'
import { useAuthCopy } from '@/components/auth/copy'
import type { AuthCopyKey } from '@/components/auth/copy'

export default function ResetPasswordPage() {
  const router = useRouter()
  const token = typeof router.query.token === 'string' ? router.query.token : ''
  const { c } = useAuthCopy()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ password?: AuthCopyKey; confirm?: AuthCopyKey }>({})
  const [serverError, setServerError] = useState<{ key: AuthCopyKey; raw?: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => router.push('/auth/login'), 2000)
    return () => clearTimeout(t)
  }, [done])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: typeof errors = {}
    if (password.length < 8) errs.password = 'err_password_short'
    if (password !== confirm) errs.confirm = 'mismatch'
    setErrors(errs)
    if (Object.keys(errs).length || !token) return
    setLoading(true)
    setServerError(null)
    try {
      await axios.post('/api/auth/reset-password', { token, password })
      setDone(true)
      toast.success(c('rp_toast'))
    } catch (err: any) {
      const msg = String(err?.response?.data?.error || '')
      if (!err?.response) setServerError({ key: 'err_network' })
      else if (/expired|invalid/i.test(msg)) setServerError({ key: 'rp_expired' })
      else if (/too short/i.test(msg)) setErrors({ password: 'err_password_short' })
      else setServerError({ key: 'err_generic', raw: msg || undefined })
    } finally {
      setLoading(false)
    }
  }

  const missingToken = router.isReady && !token

  return (
    <AuthLayout title={c('rp_title')}>
      {!done ? (
        <>
          <AuthHeading icon={LockClosedIcon} title={c('rp_title')} subtitle={c('rp_subtitle')} />
          {missingToken && (
            <AuthAlert tone="warning" className="mb-5">
              {c('rp_missing_token')}{' '}
              <Link href="/auth/forgot-password" className="font-semibold text-inherit underline underline-offset-4">{c('rp_request_new')}</Link>
            </AuthAlert>
          )}
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div>
              <Field label={c('new_password')} error={errors.password ? c(errors.password) : undefined}>
                <PasswordInput autoComplete="new-password" autoFocus placeholder={c('new_password_ph')} value={password}
                  onChange={e => { setPassword(e.target.value); setErrors(x => ({ ...x, password: undefined })) }} />
              </Field>
              <PasswordStrength password={password} />
            </div>
            <Field label={c('confirm_password')} error={errors.confirm ? c(errors.confirm) : (confirm && password !== confirm ? c('mismatch') : undefined)}>
              <PasswordInput autoComplete="new-password" placeholder={c('confirm_ph')} value={confirm}
                onChange={e => { setConfirm(e.target.value); setErrors(x => ({ ...x, confirm: undefined })) }} />
            </Field>
            {serverError && (
              <AuthAlert tone="danger">
                {serverError.raw || c(serverError.key)}{' '}
                {serverError.key === 'rp_expired' && (
                  <Link href="/auth/forgot-password" className="font-semibold text-inherit underline underline-offset-4">{c('rp_request_new')}</Link>
                )}
              </AuthAlert>
            )}
            <Button type="submit" size="lg" fullWidth loading={loading} disabled={!token}>
              {loading ? c('rp_saving') : c('rp_save')}
            </Button>
          </form>
        </>
      ) : (
        <div className="flex flex-col items-center text-center" role="status">
          <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-[22px] bg-brand-gradient text-[#04282C] shadow-glow">
            <CheckCircleIcon className="h-8 w-8" aria-hidden="true" />
          </span>
          <h1 className="text-[26px] font-bold text-ink">{c('rp_done_title')}</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">{c('rp_done_body')}</p>
          <Button href="/auth/login" className="mt-6">{c('go_to_login')}</Button>
        </div>
      )}

      {!done && (
        <Link href="/auth/login" className="mt-8 flex items-center justify-center gap-2 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeftIcon className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          {c('back_to_login')}
        </Link>
      )}
    </AuthLayout>
  )
}
