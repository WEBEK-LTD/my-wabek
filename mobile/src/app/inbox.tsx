import React, { useEffect, useState } from 'react'
import { FlatList, Platform, RefreshControl, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useI18n } from '@/i18n'
import { useAuth } from '@/lib/auth'
import { useApi, useErrorText } from '@/lib/useApi'
import { C, F } from '@/lib/theme'
import type { Conversation } from '@/lib/types'
import { Chips, Empty, ErrorView, IconBtn, Loader, T } from '@/components/ui'
import { Icon } from '@/components/Icon'
import { TabBar, TAB_BAR_SPACE } from '@/components/TabBar'
import { ConversationRow } from '@/components/ConversationRow'

type Filter = 'open' | 'mine' | 'pending' | 'resolved' | 'all'

export default function Inbox() {
  const { t, isRTL } = useI18n()
  const { me } = useAuth()
  const errText = useErrorText()
  const [filter, setFilter] = useState<Filter>('open')
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')

  useEffect(() => {
    const id = setTimeout(() => setQ(search.trim()), 350)
    return () => clearTimeout(id)
  }, [search])

  const query = {
    status: filter === 'mine' ? 'open' : filter,
    assigned_to: filter === 'mine' ? me?.id : undefined,
    search: q || undefined,
  }
  const list = useApi<{ conversations: Conversation[]; total: number }>('/api/inbox', { query, pollMs: 10000 })
  const open = useApi<{ total: number }>('/api/inbox', { query: { status: 'open' }, pollMs: 30000 })
  const rows = list.data?.conversations || []

  return (
    <View style={{ flex: 1, backgroundColor: C.surface }}>
      <SafeAreaView edges={['top']} style={{ paddingHorizontal: 18, paddingTop: 10, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <T w="bold" size={26} style={{ flex: 1 }} accessibilityRole="header">{t('chats')}</T>
          <IconBtn name="plus" label={t('new_message')} tone="teal" size={42} onPress={() => router.push('/new-message')} />
        </View>
        <View style={{ height: 46, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.bg, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 }}>
          <Icon name="search" size={18} color={C.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('search_chats')}
            placeholderTextColor="#8AA0A2"
            accessibilityLabel={t('search_chats')}
            returnKeyType="search"
            style={[{ flex: 1, height: '100%', fontFamily: F.regular, fontSize: 14, color: C.ink }, Platform.OS === 'web' ? { textAlign: isRTL ? 'right' : 'left' } : null]}
          />
        </View>
      </SafeAreaView>
      <View style={{ marginTop: 12, marginBottom: 6 }}>
        <Chips<Filter>
          value={filter}
          onChange={setFilter}
          items={[
            { key: 'open', label: t('f_open'), count: open.data?.total },
            { key: 'mine', label: t('f_mine') },
            { key: 'pending', label: t('f_pending') },
            { key: 'resolved', label: t('f_resolved') },
            { key: 'all', label: t('f_all') },
          ]}
        />
      </View>
      {list.loading && !list.data ? (
        <Loader />
      ) : list.error && !list.data ? (
        <ErrorView message={errText(list.error)} onRetry={list.reload} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={c => c.id}
          renderItem={({ item, index }) => <ConversationRow c={item} last={index === rows.length - 1} />}
          refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={C.teal} />}
          contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE, flexGrow: 1 }}
          ListEmptyComponent={<Empty title={t('no_chats')} subtitle={t('no_chats_sub')} />}
        />
      )}
      <TabBar active="inbox" badges={{ inbox: open.data?.total || 0 }} />
    </View>
  )
}
