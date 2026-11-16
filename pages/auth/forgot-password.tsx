import { useState } from 'react'
import Link from 'next/link'
import axios from 'axios'
import { EnvelopeIcon, KeyIcon, ArrowLeftIcon, EnvelopeOpenIcon } from '@heroicons/react/24/outline'
import { Button, Field, Input } from '@/components/ui'
import { AuthLayout, AuthHeading } from '@/components/auth/AuthLayout'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/auth'
import type { MessageKey as AuthCopyKey } from '@/locales/auth'
import { validateEmail } from '@/components/auth/session'

export default function ForgotPasswordPage() {
  const { t } = useT(messages)
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState<AuthCopyKey | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const err = validateEmail(email)
    setFieldError(err)
    if (err) return
    setLoading(true)
    try {
      await axios.post('/api/auth/forgot-password', { email: email.trim() })
    } catch {
      // Always show the same confirmation (no account enumeration).
    } finally {
      setSent(true)
      setLoading(false)
    }
  }

  return (
    <AuthLayout title={t('fp_title')}>
      {!sent ? (
        <>
          <AuthHeading icon={KeyIcon} title={t('fp_title')} subtitle={t('fp_subtitle')} />
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <Field label={t('email')} error={fieldError ? t(fieldError) : undefined}>
              <div dir="ltr">
                <Input
                  type="email" inputMode="email" autoComplete="email" autoFocus
                  icon={EnvelopeIcon} placeholder={t('email_ph')}
                  value={email} onChange={e => { setEmail(e.target.value); setFieldError(null) }}
                />
              </div>
            </Field>
            <Button type="submit" size="lg" fullWidth loading={loading}>
              {loading ? t('sending') : t('send_link')}
            </Button>
          </form>
        </>
      ) : (
        <div className="flex flex-col items-center text-center" role="status">
          <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-[22px] bg-brand-gradient text-[#04282C] shadow-glow">
            <EnvelopeOpenIcon className="h-8 w-8" aria-hidden="true" />
          </span>
          <h1 className="text-[26px] font-bold text-ink">{t('fp_sent_title')}</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            {t('fp_sent_body', { email: '⁨' + email.trim() + '⁩' })}
          </p>
          <p className="mt-4 text-sm text-muted">{t('fp_spam')}</p>
          <Button variant="secondary" className="mt-6" onClick={() => setSent(false)}>{t('try_again')}</Button>
        </div>
      )}

      <Link href="/auth/login" className="mt-8 flex items-center justify-center gap-2 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeftIcon className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        {t('back_to_login')}
      </Link>
    </AuthLayout>
  )
}
