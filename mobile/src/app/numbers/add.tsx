import React from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import { useI18n, type Key } from '@/i18n'
import { C } from '@/lib/theme'
import { Badge, Screen, T, TopBar } from '@/components/ui'
import { Icon, type IconName } from '@/components/Icon'

const METHODS: { key: string; icon: IconName; title: Key; sub: Key; to: string; bg: string; fg: string; recommended?: boolean }[] = [
  { key: 'code', icon: 'link', title: 'm_code_title', sub: 'm_code_sub', to: '/numbers/pair', bg: C.chip, fg: C.chipInk, recommended: true },
  { key: 'qr', icon: 'qr', title: 'm_qr_title', sub: 'm_qr_sub', to: '/numbers/qr', bg: C.violetBg, fg: C.violet },
  { key: 'cloud', icon: 'cloud', title: 'm_cloud_title', sub: 'm_cloud_sub', to: '/numbers/cloud', bg: C.blueBg, fg: C.blue },
]

export default function AddNumber() {
  const { t } = useI18n()
  return (
    <Screen>
      <TopBar title={t('add_number')} />
      <ScrollView contentContainerStyle={{ padding: 18, gap: 12 }}>
        <T w="semibold" size={15} color={C.muted}>{t('how_to_connect')}</T>
        {METHODS.map(m => (
          <Pressable
            key={m.key}
            accessibilityRole="button"
            accessibilityLabel={`${t(m.title)}. ${t(m.sub)}`}
            onPress={() => router.replace(m.to as never)}
            style={({ pressed }) => [{ padding: 16, borderRadius: 22, backgroundColor: C.surface, borderWidth: m.recommended ? 1.5 : 1, borderColor: m.recommended ? C.teal : C.line, flexDirection: 'row', alignItems: 'center', gap: 14 }, pressed && { opacity: 0.8 }]}
          >
            <View style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: m.bg, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={m.icon} size={23} color={m.fg} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <T w="semibold" size={15.5}>{t(m.title)}</T>
                {m.recommended ? <Badge label={t('recommended')} tone="brand" /> : null}
              </View>
              <T size={13} color={C.muted}>{t(m.sub)}</T>
            </View>
            <Icon name="chevron" size={18} color="#9BB0B2" />
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  )
}
