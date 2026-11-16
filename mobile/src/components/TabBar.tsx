import React from 'react'
import { Pressable, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { C } from '@/lib/theme'
import { useI18n, type Key } from '@/i18n'
import { Icon, type IconName } from './Icon'
import { T } from './ui'

export type TabKey = 'home' | 'inbox' | 'analytics' | 'numbers' | 'account'

const TABS: { key: TabKey; icon: IconName; label: Key }[] = [
  { key: 'home', icon: 'home', label: 'tab_home' },
  { key: 'inbox', icon: 'chat', label: 'tab_inbox' },
  { key: 'analytics', icon: 'chart', label: 'tab_analytics' },
  { key: 'numbers', icon: 'phone', label: 'tab_numbers' },
  { key: 'account', icon: 'user', label: 'tab_account' },
]

/** Height to keep free at the bottom of tab screens' scroll content. */
export const TAB_BAR_SPACE = 110

export function TabBar({ active, badges, dark }: { active: TabKey; badges?: Partial<Record<TabKey, number>>; dark?: boolean }) {
  const { t } = useI18n()
  const insets = useSafeAreaInsets()
  return (
    <View
      accessibilityRole="tablist"
      style={{
        position: 'absolute', left: 14, right: 14, bottom: Math.max(insets.bottom, 12) + 4, height: 70, borderRadius: 26,
        backgroundColor: dark ? 'rgba(9,50,55,0.96)' : 'rgba(4,40,44,0.96)', borderWidth: dark ? 1 : 0, borderColor: 'rgba(234,247,245,0.1)',
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6,
        shadowColor: '#04282C', shadowOpacity: 0.35, shadowRadius: 26, shadowOffset: { width: 0, height: 16 }, elevation: 12,
      }}
    >
      {TABS.map(tab => {
        const on = tab.key === active
        const count = badges?.[tab.key] || 0
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityLabel={t(tab.label)}
            accessibilityState={{ selected: on }}
            onPress={() => { if (!on) router.replace(`/${tab.key}`) }}
            style={{ flex: 1, alignItems: 'center', gap: 3, paddingVertical: 8 }}
          >
            <View>
              <Icon name={tab.icon} size={22} color={on ? C.green : 'rgba(234,247,245,0.6)'} />
              {count > 0 ? (
                <View style={{ position: 'absolute', top: -6, end: -12, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' }}>
                  <T w="bold" size={10.5} color={C.deep} style={{ lineHeight: 14 }}>{count > 99 ? '99+' : String(count)}</T>
                </View>
              ) : null}
            </View>
            <T w={on ? 'semibold' : 'regular'} size={11} color={on ? C.green : 'rgba(234,247,245,0.6)'} style={{ lineHeight: 15 }} numberOfLines={1}>{t(tab.label)}</T>
          </Pressable>
        )
      })}
    </View>
  )
}
