import React from 'react'
import { Pressable, RefreshControl, ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import { useI18n } from '@/i18n'
import { useApi, useErrorText } from '@/lib/useApi'
import { C } from '@/lib/theme'
import type { Ticket } from '@/lib/types'
import { Badge, Empty, ErrorView, IconBtn, Loader, Ltr, Screen, T, TopBar } from '@/components/ui'
import { Icon } from '@/components/Icon'
import { TICKET_STATUS } from '@/components/TicketThread'

export default function Support() {
  const { t, fmtRelative } = useI18n()
  const errText = useErrorText()
  const q = useApi<{ tickets: Ticket[] }>('/api/support/tickets', { pollMs: 20000 })
  const list = q.data?.tickets || []

  return (
    <Screen>
      <TopBar title={t('support')} right={<IconBtn name="plus" label={t('new_ticket')} tone="teal" size={40} onPress={() => router.push('/support/new')} />} />
      {q.loading && !q.data ? <Loader /> : q.error && !q.data ? <ErrorView message={errText(q.error)} onRetry={q.reload} /> : (
        <ScrollView contentContainerStyle={{ padding: 18, gap: 10 }} refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={C.teal} />}>
          {list.length === 0 ? (
            <Empty icon="headset" title={t('no_tickets')} subtitle={t('no_tickets_sub')} action={{ label: t('new_ticket'), onPress: () => router.push('/support/new') }} />
          ) : list.map(tk => {
            const st = TICKET_STATUS[tk.status] || TICKET_STATUS.open
            return (
              <Pressable
                key={tk.id}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/support/[id]', params: { id: tk.id, subject: tk.subject, number: String(tk.ticket_number), status: tk.status } })}
                style={({ pressed }) => [{ padding: 14, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, gap: 8 }, pressed && { opacity: 0.8 }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ltr w="semibold" size={12.5} color={C.muted}>{`#${tk.ticket_number}`}</Ltr>
                  <Badge label={t(st.label)} tone={st.tone} />
                  <View style={{ flex: 1 }} />
                  <T size={12} color={C.muted}>{fmtRelative(tk.updated_at || tk.created_at)}</T>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <T w="semibold" size={15} style={{ flex: 1 }} numberOfLines={2}>{tk.subject}</T>
                  <Icon name="chevron" size={16} color="#9BB0B2" />
                </View>
              </Pressable>
            )
          })}
        </ScrollView>
      )}
    </Screen>
  )
}
