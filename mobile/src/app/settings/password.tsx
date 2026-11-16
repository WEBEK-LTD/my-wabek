import React, { useState } from 'react'
import { ScrollView } from 'react-native'
import { router } from 'expo-router'
import { useI18n } from '@/i18n'
import { useAuth } from '@/lib/auth'
import { api, ApiError } from '@/lib/api'
import { useErrorText } from '@/lib/useApi'
import { C } from '@/lib/theme'
import { Btn, Field, Screen, T, TopBar, useToast } from '@/components/ui'

export default function Password() {
  const { t } = useI18n()
  const { completeSignIn } = useAuth()
  const toast = useToast()
  const errText = useErrorText()
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setError(null)
    if (!cur || !next) return setError(t('err_fill'))
    if (next.length < 8) return setError(t('err_password_short'))
    if (next !== again) return setError(t('err_password_match'))
    setBusy(true)
    try {
      await api('/api/settings/password', { method: 'PUT', body: { current_password: cur, new_password: next } })
      // Changing the password revokes every session; get a fresh one for this phone.
      const r = await api<{ token?: string }>('/api/mobile/session', { method: 'POST' }).catch(() => ({ token: undefined }))
      if (r.token) await completeSignIn(r.token)
      toast(t('password_changed'))
      router.back()
    } catch (e) {
      setError(e instanceof ApiError && (e.code === 'wrong_password' || e.status === 400) ? t('err_wrong_password') : errText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <TopBar title={t('change_password')} />
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14 }} keyboardShouldPersistTaps="handled">
        <Field label={t('current_password')} icon="lock" value={cur} onChangeText={setCur} secure autoComplete="password" ltr />
        <Field label={t('new_password')} icon="key" value={next} onChangeText={setNext} secure autoComplete="new-password" hint={t('err_password_short')} ltr />
        <Field label={t('confirm_password')} icon="key" value={again} onChangeText={setAgain} secure autoComplete="new-password" ltr onSubmitEditing={save} />
        {error ? <T size={13} color={C.danger}>{error}</T> : null}
        <Btn title={t('save_changes')} variant="teal" onPress={save} loading={busy} />
      </ScrollView>
    </Screen>
  )
}
