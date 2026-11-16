import React, { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useI18n } from '@/i18n'
import { api, ApiError, API_URL } from '@/lib/api'
import { useErrorText } from '@/lib/useApi'
import { C } from '@/lib/theme'
import { Btn, Card, Field, Screen, T, TopBar, useToast } from '@/components/ui'
import { Icon } from '@/components/Icon'

export default function CloudApi() {
  const { t } = useI18n()
  const toast = useToast()
  const errText = useErrorText()
  const [form, setForm] = useState({ phone: '', name: '', phoneId: '', wabaId: '', token: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    setError(null)
    const phone = form.phone.replace(/[^\d+]/g, '')
    if (!/^\+?\d{8,15}$/.test(phone)) return setError(t('err_invalid_phone'))
    if (!/^\d{5,30}$/.test(form.phoneId.trim()) || !form.token.trim()) return setError(t('err_fill'))
    if (form.wabaId.trim() && !/^\d{5,30}$/.test(form.wabaId.trim())) return setError(t('err_fill'))
    setBusy(true)
    try {
      const r = await api<{ webhook_warning?: string | null }>('/api/whatsapp/instances', {
        method: 'POST',
        body: {
          phone_number: phone.startsWith('+') ? phone : `+${phone}`,
          display_name: form.name.trim() || undefined,
          phone_number_id: form.phoneId.trim(),
          waba_id: form.wabaId.trim() || undefined,
          access_token: form.token.trim(),
        },
      })
      toast(r.webhook_warning ? t('cloud_webhook_warning') : t('cloud_connected'), r.webhook_warning ? 'error' : 'ok')
      router.replace('/numbers')
    } catch (e) {
      setError(e instanceof ApiError && e.status === 400 && /credential/i.test(e.message) ? t('err_cloud_creds') : errText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <TopBar title={t('cloud_title')} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 18, gap: 14 }} keyboardShouldPersistTaps="handled">
          <Card style={{ flexDirection: 'row', gap: 12, backgroundColor: C.blueBg, borderColor: '#CBD6FF' }}>
            <Icon name="cloud" size={22} color={C.blue} />
            <T size={13.5} color={C.blue} style={{ flex: 1 }}>{t('cloud_intro')}</T>
          </Card>
          <Field label={t('cloud_phone')} icon="phone" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" placeholder="+966 50 123 4567" ltr />
          <Field label={`${t('cloud_name')} (${t('optional')})`} icon="building" value={form.name} onChangeText={set('name')} />
          <Field label={t('cloud_phone_id')} icon="key" value={form.phoneId} onChangeText={v => set('phoneId')(v.replace(/\D/g, ''))} keyboardType="number-pad" ltr />
          <Field label={`${t('cloud_waba_id')} (${t('optional')})`} icon="key" value={form.wabaId} onChangeText={v => set('wabaId')(v.replace(/\D/g, ''))} keyboardType="number-pad" ltr />
          <Field label={t('cloud_token')} icon="lock" value={form.token} onChangeText={set('token')} secure autoCapitalize="none" autoCorrect={false} ltr />
          {error ? <T size={13} color={C.danger} accessibilityLiveRegion="polite">{error}</T> : null}
          <Btn title={t('cloud_connect')} variant="teal" onPress={submit} loading={busy} />
          <Pressable accessibilityRole="link" onPress={() => void WebBrowser.openBrowserAsync(`${API_URL}/docs`)} style={{ alignSelf: 'center', padding: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="book" size={16} color={C.chipInk} />
              <T w="semibold" size={13.5} color={C.chipInk}>{t('cloud_help')}</T>
            </View>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}
