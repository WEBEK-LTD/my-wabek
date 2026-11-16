import React from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useI18n } from '@/i18n'
import { LogoTile } from './Brand'
import { DeepBg, IconBtn, T } from './ui'
import { Floating } from './Floating'
import { C, shadow } from '@/lib/theme'

/** Deep header with the logo + a white card that overlaps it (sign in, sign up, codes). */
export function AuthShell({ title, subtitle, children, footer, back = true }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode; back?: boolean }) {
  const { t } = useI18n()
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.surface2 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <DeepBg rounded style={{ paddingBottom: 60 }}>
          <SafeAreaView edges={['top']}>
            <View style={{ height: 52, paddingHorizontal: 16, justifyContent: 'center' }}>
              {back && router.canGoBack() ? <IconBtn name="back" label={t('back')} tone="dark" size={40} onPress={() => router.back()} /> : null}
            </View>
            <View style={{ alignItems: 'center', paddingBottom: 6 }}>
              <Floating distance={6} duration={2000}>
                <View style={shadow.glow}><LogoTile size={92} /></View>
              </Floating>
              <T w="bold" size={26} color={C.onDeep} style={{ marginTop: 18, textAlign: 'center' }} accessibilityRole="header">{title}</T>
              {subtitle ? <T size={14} color={C.onDeepMuted} style={{ marginTop: 4, textAlign: 'center', paddingHorizontal: 24 }}>{subtitle}</T> : null}
            </View>
          </SafeAreaView>
        </DeepBg>
        <View style={[{ marginTop: -36, marginHorizontal: 18, padding: 20, borderRadius: 28, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, gap: 14 }, shadow.card]}>
          {children}
        </View>
        <SafeAreaView edges={['bottom']} style={{ marginTop: 'auto', paddingVertical: 24, alignItems: 'center' }}>{footer}</SafeAreaView>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
