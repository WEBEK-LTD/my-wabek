import React from 'react'
import { useLocalSearchParams } from 'expo-router'
import { useI18n } from '@/i18n'
import { Screen, TopBar } from '@/components/ui'
import { TicketThread } from '@/components/TicketThread'

export default function TicketScreen() {
  const p = useLocalSearchParams<{ id: string; subject?: string; number?: string; status?: string }>()
  const { t } = useI18n()
  return (
    <Screen edges={['top']}>
      <TopBar title={p.subject || t('support')} subtitle={p.number ? `#${p.number}` : undefined} />
      <TicketThread ticketId={String(p.id)} side="customer" disabled={p.status === 'closed'} />
    </Screen>
  )
}
