import React, { useState } from 'react'
import { Pressable, View } from 'react-native'
import { router } from 'expo-router'
import { useI18n } from '@/i18n'
import { useAuth } from '@/lib/auth'
import { api, ApiError } from '@/lib/api'
import { useErrorText } from '@/lib/useApi'
import { AuthShell } from '@/components/AuthShell'
import { Btn, Field, T } from '@/components/ui'
import { C } from '@/lib/theme'
import { deviceFingerprint, pendingLogin } from '@/lib/device'

type LoginResponse = {
  success?: boolean
  token?: string
  requiresOtp?: boolean
  requiresVerification?: boolean
  userId?: string
  method?: 'whatsapp' | 'email'
  phone?: string
  email?: string
}

export default function Login() {
  const { t } = useI18n()
  const { completeSignIn } = useAuth()
  const errText = useErrorText()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    if (!email.trim() || !password) return setError(t('err_fill'))
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError(t('err_email'))
    setBusy(true)
    try {
      const r = await api<LoginResponse>('/api/auth/login', {
        method: 'POST',
        auth: false,
        body: { email: email.trim().toLowerCase(), password, deviceFingerprint: await deviceFingerprint() },
      })
      if (r.requiresOtp && r.userId) {
        pendingLogin.email = email.trim().toLowerCase()
        pendingLogin.password = password
        router.push({ pathname: '/verify', params: { userId: r.userId, purpose: 'login', method: r.method || '', phone: r.phone || '', email: r.email || '' } })
      } else if (r.token) {
        await completeSignIn(r.token)
        router.replace('/home')
      } else {
        setError(t('error_generic'))
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setError(t('err_login'))
      else if (e instanceof ApiError && e.status === 403 && e.data.requiresVerification && typeof e.data.userId === 'string') {
        router.push({ pathname: '/verify', params: { userId: e.data.userId, purpose: 'registration' } })
      } else if (e instanceof ApiError && e.status === 403) setError(t('err_suspended'))
      else setError(errText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title={t('welcome_back')}
      subtitle={t('sign_in_sub')}
      footer={
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <T size={14} color={C.muted}>{t('no_account')}</T>
          <Pressable accessibilityRole="link" onPress={() => router.replace('/register')} hitSlop={8}>
            <T w="bold" size={14} color={C.chipInk}>{t('create_account')}</T>
          </Pressable>
        </View>
      }
    >
      <Field label={t('email')} icon="mail" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" ltr returnKeyType="next" />
      <View style={{ gap: 6 }}>
        <Field label={t('password')} icon="lock" value={password} onChangeText={setPassword} secure autoComplete="password" textContentType="password" ltr returnKeyType="go" onSubmitEditing={submit} />
        <Pressable accessibilityRole="link" onPress={() => router.push('/forgot')} hitSlop={8} style={{ alignSelf: 'flex-end' }}>
          <T w="medium" size={12.5} color={C.chipInk}>{t('forgot_password')}</T>
        </Pressable>
      </View>
      {error ? <T size={13} color={C.danger} accessibilityLiveRegion="polite">{error}</T> : null}
      <Btn title={t('sign_in')} variant="teal" onPress={submit} loading={busy} />
    </AuthShell>
  )
}
