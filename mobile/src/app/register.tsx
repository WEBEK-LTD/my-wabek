import React, { useState } from 'react'
import { Pressable, View } from 'react-native'
import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useI18n } from '@/i18n'
import { useAuth } from '@/lib/auth'
import { api, ApiError, API_URL } from '@/lib/api'
import { useErrorText } from '@/lib/useApi'
import { AuthShell } from '@/components/AuthShell'
import { Btn, Field, T } from '@/components/ui'
import { C } from '@/lib/theme'

export default function Register() {
  const { t } = useI18n()
  const { completeSignIn } = useAuth()
  const errText = useErrorText()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    if (name.trim().length < 2 || !email.trim() || !password) return setError(t('err_fill'))
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError(t('err_email'))
    if (password.length < 8) return setError(t('err_password_short'))
    const cleanPhone = phone.replace(/[^\d+]/g, '')
    if (cleanPhone && !/^\+?\d{8,15}$/.test(cleanPhone)) return setError(t('err_invalid_phone'))
    setBusy(true)
    try {
      const r = await api<{ token?: string; requiresVerification?: boolean; userId?: string }>('/api/auth/register', {
        method: 'POST',
        auth: false,
        body: { name: name.trim(), email: email.trim().toLowerCase(), password, phone: cleanPhone ? (cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`) : '' },
      })
      if (r.requiresVerification && r.userId) {
        router.replace({ pathname: '/verify', params: { userId: r.userId, purpose: 'registration', method: 'whatsapp', phone: cleanPhone } })
      } else if (r.token) {
        await completeSignIn(r.token)
        router.replace('/home')
      } else {
        router.replace('/login')
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setError(t('err_email_taken'))
      else setError(errText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title={t('create_title')}
      subtitle={t('create_sub')}
      footer={
        <View style={{ alignItems: 'center', gap: 12, paddingHorizontal: 24 }}>
          <Pressable accessibilityRole="link" onPress={() => void WebBrowser.openBrowserAsync(`${API_URL}/terms`)}>
            <T size={12} color={C.muted} style={{ textAlign: 'center' }}>{t('terms_note')}</T>
          </Pressable>
          <Pressable accessibilityRole="link" onPress={() => router.replace('/login')} hitSlop={8}>
            <T w="bold" size={14} color={C.chipInk}>{t('have_account')}</T>
          </Pressable>
        </View>
      }
    >
      <Field label={t('full_name')} icon="user" value={name} onChangeText={setName} autoComplete="name" textContentType="name" />
      <Field label={t('email')} icon="mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" ltr />
      <Field label={t('phone_optional')} icon="whatsapp" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" hint={t('phone_hint')} ltr placeholder="+966 50 123 4567" />
      <Field label={t('password')} icon="lock" value={password} onChangeText={setPassword} secure autoComplete="new-password" textContentType="newPassword" hint={t('err_password_short')} ltr onSubmitEditing={submit} />
      {error ? <T size={13} color={C.danger} accessibilityLiveRegion="polite">{error}</T> : null}
      <Btn title={t('create_account')} variant="teal" onPress={submit} loading={busy} />
    </AuthShell>
  )
}
