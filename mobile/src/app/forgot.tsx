import React, { useState } from 'react'
import { router } from 'expo-router'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api'
import { useErrorText } from '@/lib/useApi'
import { AuthShell } from '@/components/AuthShell'
import { Btn, Field, T } from '@/components/ui'
import { C } from '@/lib/theme'

export default function Forgot() {
  const { t } = useI18n()
  const errText = useErrorText()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError(t('err_email'))
    setBusy(true)
    try {
      await api('/api/auth/forgot-password', { method: 'POST', auth: false, body: { email: email.trim().toLowerCase() } })
      setSent(true)
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title={t('forgot_title')} subtitle={t('forgot_sub')}>
      {sent ? (
        <>
          <T size={14.5} color={C.success} accessibilityLiveRegion="polite">{t('forgot_sent')}</T>
          <Btn title={t('back_to_sign_in')} variant="teal" onPress={() => router.replace('/login')} />
        </>
      ) : (
        <>
          <Field label={t('email')} icon="mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" ltr onSubmitEditing={submit} />
          {error ? <T size={13} color={C.danger}>{error}</T> : null}
          <Btn title={t('send_link')} variant="teal" onPress={submit} loading={busy} />
        </>
      )}
    </AuthShell>
  )
}
