import React, { useState } from 'react'
import { Pressable, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useI18n } from '@/i18n'
import { useAuth } from '@/lib/auth'
import { api, ApiError } from '@/lib/api'
import { useErrorText } from '@/lib/useApi'
import { deviceFingerprint, pendingLogin } from '@/lib/device'
import { AuthShell } from '@/components/AuthShell'
import { Btn, Field, T, Toggle, useToast } from '@/components/ui'
import { C } from '@/lib/theme'

export default function Verify() {
  const { t } = useI18n()
  const { completeSignIn } = useAuth()
  const errText = useErrorText()
  const toast = useToast()
  const p = useLocalSearchParams<{ userId: string; purpose?: string; method?: string; phone?: string; email?: string }>()
  const purpose = p.purpose === 'registration' ? 'registration' : 'login'
  const [code, setCode] = useState('')
  const [trust, setTrust] = useState(true)
  const [busy, setBusy] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sentTo =
    p.method === 'email' && p.email ? t('verify_sent_email', { email: p.email })
      : p.phone ? t('verify_sent_whatsapp', { phone: p.phone })
        : t('verify_sent_generic')

  const submit = async () => {
    setError(null)
    const c = code.replace(/\D/g, '')
    if (c.length < 4) return setError(t('err_code'))
    setBusy(true)
    try {
      const r = await api<{ token?: string }>('/api/auth/verify-otp', {
        method: 'POST',
        auth: false,
        body: { userId: p.userId, otp: c, purpose, trustDevice: purpose === 'login' && trust, deviceFingerprint: await deviceFingerprint() },
      })
      if (!r.token) throw new ApiError(500, 'no token')
      pendingLogin.email = ''
      pendingLogin.password = ''
      await completeSignIn(r.token)
      router.replace('/home')
    } catch (e) {
      setError(e instanceof ApiError && e.status === 400 ? t('err_code') : errText(e))
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    if (!pendingLogin.email) {
      router.back()
      return
    }
    setResending(true)
    try {
      await api('/api/auth/login', { method: 'POST', auth: false, body: { ...pendingLogin, deviceFingerprint: await deviceFingerprint() } })
      toast(t('done'))
    } catch (e) {
      toast(errText(e), 'error')
    } finally {
      setResending(false)
    }
  }

  return (
    <AuthShell title={t('verify_title')} subtitle={sentTo}>
      <Field
        label={t('code')}
        icon="shieldCheck"
        value={code}
        onChangeText={v => setCode(v.replace(/\D/g, '').slice(0, 8))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={8}
        ltr
        style={{ fontSize: 22, letterSpacing: 6 }}
        onSubmitEditing={submit}
        autoFocus
      />
      {purpose === 'login' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <T size={14} style={{ flex: 1 }}>{t('trust_device')}</T>
          <Toggle value={trust} onChange={setTrust} label={t('trust_device')} />
        </View>
      ) : null}
      {error ? <T size={13} color={C.danger} accessibilityLiveRegion="polite">{error}</T> : null}
      <Btn title={t('verify')} variant="teal" onPress={submit} loading={busy} />
      {purpose === 'login' ? (
        <Pressable accessibilityRole="button" onPress={resend} disabled={resending} style={{ alignSelf: 'center', padding: 6 }}>
          <T w="semibold" size={13.5} color={C.chipInk}>{resending ? t('loading') : t('new_code')}</T>
        </Pressable>
      ) : null}
    </AuthShell>
  )
}
