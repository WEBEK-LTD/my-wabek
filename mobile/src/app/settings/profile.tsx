import React, { useEffect, useState } from 'react'
import { ScrollView } from 'react-native'
import { router } from 'expo-router'
import { useI18n } from '@/i18n'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { useErrorText } from '@/lib/useApi'
import { C } from '@/lib/theme'
import { Btn, Field, Screen, T, TopBar, useToast } from '@/components/ui'

export default function Profile() {
  const { t } = useI18n()
  const { me, refreshMe } = useAuth()
  const toast = useToast()
  const errText = useErrorText()
  const [name, setName] = useState(me?.name || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setName(me?.name || '') }, [me?.name])

  const save = async () => {
    setError(null)
    if (name.trim().length < 2) return setError(t('err_fill'))
    setBusy(true)
    try {
      await api('/api/settings/profile', { method: 'PUT', body: { name: name.trim() } })
      await refreshMe()
      toast(t('saved'))
      router.back()
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <TopBar title={t('profile')} />
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14 }} keyboardShouldPersistTaps="handled">
        <Field label={t('name')} icon="user" value={name} onChangeText={setName} autoComplete="name" />
        <Field label={t('email')} icon="mail" value={me?.email || ''} editable={false} ltr />
        {me?.phone ? <Field label={t('phone_optional')} icon="whatsapp" value={me.phone} editable={false} ltr /> : null}
        {error ? <T size={13} color={C.danger}>{error}</T> : null}
        <Btn title={t('save_changes')} variant="teal" onPress={save} loading={busy} />
      </ScrollView>
    </Screen>
  )
}
