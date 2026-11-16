import React, { useState } from 'react'
import { ScrollView } from 'react-native'
import { router } from 'expo-router'
import { useI18n } from '@/i18n'
import { useAuth } from '@/lib/auth'
import { api, ApiError } from '@/lib/api'
import { useErrorText } from '@/lib/useApi'
import { C } from '@/lib/theme'
import { Btn, Card, Field, Screen, T, TopBar, useToast } from '@/components/ui'
import { Icon } from '@/components/Icon'

export default function DeleteAccount() {
  const { t } = useI18n()
  const { signOut } = useAuth()
  const toast = useToast()
  const errText = useErrorText()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const word = t('delete_confirm_word')
  const ready = confirm.trim().toUpperCase() === word.toUpperCase()

  const run = async () => {
    setError(null)
    setBusy(true)
    try {
      await api('/api/mobile/delete-account', { method: 'POST', body: { password, confirm: 'DELETE' } })
      toast(t('delete_done'))
      await signOut()
      router.replace('/welcome')
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'wrong_password' ? t('err_wrong_password') : e instanceof ApiError && e.code === 'owner_only' ? t('owner_only') : errText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <TopBar title={t('delete_title')} />
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14 }} keyboardShouldPersistTaps="handled">
        <Card style={{ flexDirection: 'row', gap: 12, backgroundColor: C.dangerBg, borderColor: '#F2B8AE' }}>
          <Icon name="alert" size={22} color={C.danger} />
          <T size={13.5} color={C.danger} style={{ flex: 1 }}>{t('delete_warning')}</T>
        </Card>
        <Field label={t('delete_password')} icon="lock" value={password} onChangeText={setPassword} secure ltr />
        <Field label={t('delete_type')} icon="trash" value={confirm} onChangeText={setConfirm} autoCapitalize="characters" placeholder={word} />
        {error ? <T size={13} color={C.danger}>{error}</T> : null}
        <Btn title={t('delete_button')} variant="danger" onPress={run} loading={busy} disabled={!ready} />
      </ScrollView>
    </Screen>
  )
}
