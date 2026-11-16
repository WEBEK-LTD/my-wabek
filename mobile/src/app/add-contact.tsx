import React, { useState } from 'react'
import { ScrollView } from 'react-native'
import { router } from 'expo-router'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api'
import { useErrorText } from '@/lib/useApi'
import { C } from '@/lib/theme'
import { Btn, Field, Screen, T, TopBar, useToast } from '@/components/ui'

export default function AddContact() {
  const { t } = useI18n()
  const toast = useToast()
  const errText = useErrorText()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setError(null)
    const digits = phone.replace(/\D/g, '')
    if (!/^\d{8,15}$/.test(digits)) return setError(t('err_invalid_phone'))
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) return setError(t('err_email'))
    setBusy(true)
    try {
      await api('/api/contacts', { method: 'POST', body: { phone: digits, name: name.trim() || undefined, email: email.trim() || undefined } })
      toast(t('contact_saved'))
      router.back()
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <TopBar title={t('add_contact')} />
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14 }} keyboardShouldPersistTaps="handled">
        <Field label={t('contact_name')} icon="user" value={name} onChangeText={setName} autoComplete="name" />
        <Field label={t('contact_phone')} icon="whatsapp" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+966 50 123 4567" ltr />
        <Field label={`${t('email')} (${t('optional')})`} icon="mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" ltr />
        {error ? <T size={13} color={C.danger}>{error}</T> : null}
        <Btn title={t('save')} variant="teal" onPress={save} loading={busy} />
      </ScrollView>
    </Screen>
  )
}
