import React, { useEffect, useState } from 'react'
import { AppState, Platform, View } from 'react-native'
import { Stack } from 'expo-router/stack'
import { router, SplashScreen } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as Notifications from 'expo-notifications'
import {
  useFonts, ReadexPro_300Light, ReadexPro_400Regular, ReadexPro_500Medium, ReadexPro_600SemiBold, ReadexPro_700Bold,
} from '@expo-google-fonts/readex-pro'
import { I18nProvider, useI18n } from '@/i18n'
import { AuthProvider, useAuth } from '@/lib/auth'
import { ToastProvider } from '@/components/ui'
import { routeForNotification } from '@/lib/push'
import { lockGate, isLockEnabled, biometricInfo } from '@/lib/lock'
import { C } from '@/lib/theme'

SplashScreen.preventAutoHideAsync().catch(() => {})

const TAB_SCREENS = ['home', 'inbox', 'analytics', 'numbers', 'account']

function Navigator() {
  const { ready, isRTL } = useI18n()
  const { status } = useAuth()
  const [lockChecked, setLockChecked] = useState(false)

  // Tapped notification → open the right screen.
  useEffect(() => {
    if (Platform.OS === 'web') return
    const sub = Notifications.addNotificationResponseReceivedListener(r => {
      const to = routeForNotification(r.notification.request.content.data as Record<string, unknown>)
      if (to) router.push(to as never)
    })
    return () => sub.remove()
  }, [])

  // App lock (Face ID / fingerprint) on start and when coming back after a minute.
  useEffect(() => {
    if (status !== 'signedIn' || Platform.OS === 'web') {
      setLockChecked(true)
      return
    }
    let leftAt = 0
    let first = true
    const check = async () => {
      if (lockGate.active || !(await isLockEnabled())) return
      if (!(await biometricInfo()).available) return
      lockGate.active = true
      // On start the splash (app/index) sends the user to /lock; later, push it over the current screen.
      if (!first) router.push('/lock')
    }
    void check().finally(() => { first = false; setLockChecked(true) })
    const sub = AppState.addEventListener('change', s => {
      if (s === 'background') leftAt = Date.now()
      if (s === 'active' && leftAt && Date.now() - leftAt > 60_000) void check()
    })
    return () => sub.remove()
  }, [status])

  if (!ready || status === 'loading' || !lockChecked) return <View style={{ flex: 1, backgroundColor: C.deepest }} />

  return (
    <View style={{ flex: 1, direction: isRTL ? 'rtl' : 'ltr' }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }}>
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        {TAB_SCREENS.map(n => <Stack.Screen key={n} name={n} options={{ animation: 'none' }} />)}
        <Stack.Screen name="lock" options={{ animation: 'fade', gestureEnabled: false }} />
      </Stack>
    </View>
  )
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ ReadexPro_300Light, ReadexPro_400Regular, ReadexPro_500Medium, ReadexPro_600SemiBold, ReadexPro_700Bold })
  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {})
  }, [fontsLoaded])
  if (!fontsLoaded) return null
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AuthProvider>
          <ToastProvider>
            <StatusBar style="light" />
            <Navigator />
          </ToastProvider>
        </AuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  )
}
