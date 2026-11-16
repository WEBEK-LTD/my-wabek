import React from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { useI18n } from '@/i18n'
import { useApi, useErrorText } from '@/lib/useApi'
import { C } from '@/lib/theme'
import { Empty, ErrorView, Loader, Screen, T, TopBar, useToast } from '@/components/ui'
import { Icon } from '@/components/Icon'

type Reply = { id: string; title: string; message: string; shortcut?: string | null }

export default function QuickReplies() {
  const { t } = useI18n()
  const toast = useToast()
  const errText = useErrorText()
  const q = useApi<{ replies: Reply[] }>('/api/quick-replies')
  const list = q.data?.replies || []
  return (
    <Screen>
      <TopBar title={t('quick_replies')} subtitle={list.length ? t('tap_to_copy') : undefined} />
      {q.loading && !q.data ? <Loader /> : q.error && !q.data ? <ErrorView message={errText(q.error)} onRetry={q.reload} /> : (
        <ScrollView contentContainerStyle={{ padding: 18, gap: 10 }}>
          {list.length === 0 ? <Empty icon="bolt" title={t('no_quick_replies')} /> : list.map(r => (
            <Pressable
              key={r.id}
              accessibilityRole="button"
              accessibilityHint={t('tap_to_copy')}
              onPress={async () => { await Clipboard.setStringAsync(r.message); toast(t('copied')) }}
              style={({ pressed }) => [{ padding: 14, borderRadius: 18, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, gap: 6 }, pressed && { opacity: 0.75 }]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="bolt" size={16} color={C.warning} />
                <T w="semibold" size={14.5} style={{ flex: 1 }} numberOfLines={1}>{r.title}</T>
                <Icon name="copy" size={16} color={C.muted} />
              </View>
              <T size={13.5} color={C.muted} numberOfLines={4}>{r.message}</T>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </Screen>
  )
}
