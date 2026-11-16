import React, { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api'
import { useApi, useErrorText } from '@/lib/useApi'
import { C } from '@/lib/theme'
import { type Instance, instanceName, isCloud, isConnected } from '@/lib/types'
import { Btn, Empty, Field, Loader, Screen, T, TopBar, useToast } from '@/components/ui'
import { Icon } from '@/components/Icon'

export default function NewMessage() {
  const { t } = useI18n()
  const toast = useToast()
  const errText = useErrorText()
  const q = useApi<{ instances: Instance[] }>('/api/whatsapp/instances')
  const numbers = (q.data?.instances || []).filter(i => isConnected(i.status))
  const [from, setFrom] = useState<string | null>(null)
  const [to, setTo] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!from && numbers.length) setFrom((numbers.find(n => n.is_default) || numbers[0]).id)
  }, [numbers, from])

  const send = async () => {
    setError(null)
    const digits = to.replace(/\D/g, '')
    if (!/^\d{8,15}$/.test(digits)) return setError(t('err_invalid_phone'))
    if (!text.trim() || !from) return setError(t('err_fill'))
    setBusy(true)
    try {
      await api('/api/whatsapp/chat-send', { method: 'POST', body: { instance_id: from, to: digits, text: text.trim() } })
      toast(t('message_sent'))
      router.replace('/inbox')
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <TopBar title={t('new_message')} />
      {q.loading && !q.data ? <Loader /> : numbers.length === 0 ? (
        <Empty icon="phone" title={t('no_numbers_title')} subtitle={t('no_numbers_sub')} action={{ label: t('add_number'), onPress: () => router.replace('/numbers/add') }} />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ padding: 18, gap: 14 }} keyboardShouldPersistTaps="handled">
            <T w="semibold" size={13}>{t('from_number')}</T>
            <View style={{ gap: 8 }}>
              {numbers.map(n => {
                const on = n.id === from
                return (
                  <Pressable key={n.id} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setFrom(n.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: on ? 1.5 : 1, borderColor: on ? C.teal : C.line, backgroundColor: C.surface }}>
                    <Icon name={isCloud(n) ? 'cloud' : 'phone'} size={18} color={on ? C.teal : C.muted} />
                    <T size={14.5} style={{ flex: 1 }} numberOfLines={1}>{instanceName(n, t('pending_name'))}</T>
                    <T size={12} color={C.muted}>{isCloud(n) ? t('type_cloud') : t('type_web')}</T>
                  </Pressable>
                )
              })}
            </View>
            <Field label={t('to_number')} icon="whatsapp" value={to} onChangeText={setTo} keyboardType="phone-pad" placeholder="+966 50 123 4567" ltr />
            <Field label={t('message')} value={text} onChangeText={setText} multiline style={{ minHeight: 120, textAlignVertical: 'top', paddingTop: 14 }} />
            {error ? <T size={13} color={C.danger}>{error}</T> : null}
            <Btn title={t('send')} icon="send" variant="teal" onPress={send} loading={busy} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </Screen>
  )
}
