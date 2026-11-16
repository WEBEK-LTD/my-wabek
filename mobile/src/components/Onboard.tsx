import React from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useI18n } from '@/i18n'
import { T } from './ui'
import { Icon } from './Icon'
import { C } from '@/lib/theme'

export function LangSwitch() {
  const { t, lang, setLang } = useI18n()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('switch_language')}
      onPress={() => void setLang(lang === 'en' ? 'ar' : 'en')}
      style={{ height: 38, paddingHorizontal: 14, borderRadius: 99, borderWidth: 1, borderColor: C.glassBorder, backgroundColor: C.glass, flexDirection: 'row', alignItems: 'center', gap: 6 }}
    >
      <Icon name="globe" size={16} color={C.onDeep} stroke={1.8} />
      <T w="medium" size={13} color={C.onDeep}>{t('switch_language')}</T>
    </Pressable>
  )
}

export function Dots({ index, total }: { index: number; total: number }) {
  const { t } = useI18n()
  return (
    <View accessibilityLabel={t('page_of', { n: index + 1, total })} style={{ flexDirection: 'row', gap: 6 }}>
      {Array.from({ length: total }).map((_, i) =>
        i === index ? (
          <LinearGradient key={i} colors={[C.teal, C.green]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: 26, height: 6, borderRadius: 3 }} />
        ) : (
          <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(234,247,245,0.25)' }} />
        ),
      )}
    </View>
  )
}

export function DeepBackdrop({ variant = 1 }: { variant?: 1 | 2 }) {
  return (
    <>
      <LinearGradient colors={['rgba(14,108,114,0.95)', 'rgba(14,108,114,0)']} start={variant === 1 ? { x: 1, y: 0 } : { x: 0, y: 0 }} end={{ x: 0.4, y: 0.55 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(29,107,74,0)', 'rgba(29,107,74,0.65)']} start={{ x: 0.5, y: 0.3 }} end={variant === 1 ? { x: 0, y: 0.75 } : { x: 1, y: 0.7 }} style={StyleSheet.absoluteFill} />
    </>
  )
}
