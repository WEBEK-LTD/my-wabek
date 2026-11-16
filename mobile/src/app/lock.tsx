import React, { useCallback, useEffect, useState } from 'react'
import { View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useI18n } from '@/i18n'
import { useAuth } from '@/lib/auth'
import { authenticate, biometricInfo, lockGate } from '@/lib/lock'
import { LogoTile } from '@/components/Brand'
import { Btn, T } from '@/components/ui'
import { DeepBackdrop } from '@/components/Onboard'
import { C } from '@/lib/theme'

export default function Lock() {
  const { t } = useI18n()
  const { signOut } = useAuth()
  const [kind, setKind] = useState<'face' | 'finger'>('face')

  const unlock = useCallback(async () => {
    if (await authenticate(t('unlock_prompt'), t('cancel'))) {
      lockGate.active = false
      if (router.canGoBack()) router.back()
      else router.replace('/home')
    }
  }, [t])

  useEffect(() => {
    void biometricInfo().then(b => setKind(b.kind))
    void unlock()
  }, [unlock])

  const method = kind === 'face' ? t('biometric_face') : t('biometric_finger')
  return (
    <View style={{ flex: 1, backgroundColor: C.deepest }}>
      <DeepBackdrop />
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 }}>
        <LogoTile size={110} />
        <T w="bold" size={24} color={C.onDeep} style={{ marginTop: 12 }} accessibilityRole="header">{t('locked_title')}</T>
        <T size={14} color={C.onDeepMuted}>{t('locked_sub')}</T>
        <View style={{ alignSelf: 'stretch', gap: 12, marginTop: 24 }}>
          <Btn title={t('sign_in_biometric', { method })} icon="face" onPress={unlock} />
          <Btn
            title={t('sign_out_instead')}
            variant="glass"
            size="md"
            onPress={async () => {
              lockGate.active = false
              await signOut()
              router.replace('/welcome')
            }}
          />
        </View>
      </SafeAreaView>
    </View>
  )
}
