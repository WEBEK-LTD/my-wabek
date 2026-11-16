import React, { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { useI18n } from '@/i18n'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { useErrorText } from '@/lib/useApi'
import { C } from '@/lib/theme'
import { Btn, Field, Screen, T, TopBar, useToast } from '@/components/ui'

export default function NewTicket() {
  const { t } = useI18n()
  const { me } = useAuth()
  const toast = useToast()
  const errText = useErrorText()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    if (!subject.trim() || !message.trim()) return setError(t('err_fill'))
    setBusy(true)
    try {
      const r = await api<{ ticket?: { id: string; ticket_number: number } }>('/api/support/tickets', {
        method: 'POST',
        body: { subject: subject.trim().slice(0, 300), message: message.trim(), whatsapp_phone: me?.phone || undefined },
      })
      toast(t('ticket_sent'))
      if (r.ticket?.id) router.replace({ pathname: '/support/[id]', params: { id: r.ticket.id, subject: subject.trim(), number: String(r.ticket.ticket_number || ''), status: 'open' } })
      else router.back()
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <TopBar title={t('new_ticket')} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 18, gap: 14 }} keyboardShouldPersistTaps="handled">
          <Field label={t('subject')} icon="mail" value={subject} onChangeText={setSubject} maxLength={300} />
          <Field label={t('describe_issue')} value={message} onChangeText={setMessage} multiline maxLength={10000} style={{ minHeight: 160, textAlignVertical: 'top', paddingTop: 14 }} />
          {error ? <T size={13} color={C.danger}>{error}</T> : null}
          <Btn title={t('send')} icon="send" variant="teal" onPress={submit} loading={busy} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}
