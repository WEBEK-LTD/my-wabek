import React, { useState } from 'react'
import { View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useI18n } from '@/i18n'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { useErrorText } from '@/lib/useApi'
import { C } from '@/lib/theme'
import { Badge, Btn, Empty, Screen, TopBar, useToast } from '@/components/ui'
import { TicketThread, TICKET_STATUS } from '@/components/TicketThread'

export default function AdminTicket() {
  const p = useLocalSearchParams<{ id: string; subject?: string; number?: string; status?: string; who?: string }>()
  const { t } = useI18n()
  const { isAdmin } = useAuth()
  const toast = useToast()
  const errText = useErrorText()
  const [status, setStatus] = useState(p.status || 'open')
  const [busy, setBusy] = useState(false)

  if (!isAdmin) return <Screen><TopBar title={t('admin')} /><Empty icon="shield" title={t('not_admin')} /></Screen>

  const closed = status === 'closed' || status === 'resolved'
  const setTo = async (s: string) => {
    setBusy(true)
    try {
      await api('/api/admin/support/tickets', { method: 'PUT', body: { id: p.id, status: s } })
      setStatus(s)
      toast(t('saved'))
    } catch (e) {
      toast(errText(e), 'error')
    } finally {
      setBusy(false)
    }
  }
  const st = TICKET_STATUS[status] || TICKET_STATUS.open

  return (
    <Screen edges={['top']} bg={C.bg}>
      <TopBar title={p.subject || t('support')} subtitle={t('ticket_from', { name: p.who || '', number: p.number || '' })} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 8 }}>
        <Badge label={t(st.label)} tone={st.tone} />
        <View style={{ flex: 1 }} />
        <Btn size="sm" variant={closed ? 'outline' : 'dark'} title={closed ? t('reopen_ticket') : t('close_ticket')} loading={busy} onPress={() => void setTo(closed ? 'open' : 'closed')} />
      </View>
      <TicketThread ticketId={String(p.id)} side="admin" />
    </Screen>
  )
}
