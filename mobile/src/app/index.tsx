import React, { useEffect, useRef } from 'react'
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/i18n'
import { lockGate } from '@/lib/lock'
import { LogoTile } from '@/components/Brand'
import { T } from '@/components/ui'
import { C } from '@/lib/theme'

const native = Platform.OS !== 'web'

function Ring({ delay, color }: { delay: number; color: string }) {
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: 3600, easing: Easing.out(Easing.cubic), useNativeDriver: native }),
        Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: native }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [v, delay])
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 1.5, borderColor: color,
        opacity: v.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.55, 0] }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1.9] }) }],
      }}
    />
  )
}

/** Animated splash: shown on every launch while the session is restored, then routes on. */
export default function Splash() {
  const { status } = useAuth()
  const { t } = useI18n()
  const float = useRef(new Animated.Value(0)).current
  const rise = useRef(new Animated.Value(0)).current
  const bar = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      Animated.timing(float, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
    ])).start()
    Animated.timing(rise, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start()
    Animated.loop(Animated.timing(bar, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.cubic), useNativeDriver: native })).start()
  }, [float, rise, bar])

  useEffect(() => {
    if (status === 'loading') return
    const id = setTimeout(() => {
      if (status === 'signedIn') router.replace(lockGate.active ? '/lock' : '/home')
      else router.replace('/welcome')
    }, 1500)
    return () => clearTimeout(id)
  }, [status])

  const riseStyle = (d: number) => ({
    opacity: rise.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
    transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [14 + d, 0] }) }],
  })

  return (
    <View style={{ flex: 1, backgroundColor: C.deepest, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <LinearGradient colors={['rgba(18,181,190,0.5)', 'rgba(18,181,190,0)']} start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.5 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(139,224,122,0)', 'rgba(139,224,122,0.32)']} start={{ x: 0.4, y: 0.5 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

      <View style={{ width: 220, height: 220, alignItems: 'center', justifyContent: 'center' }}>
        <Ring delay={0} color="rgba(139,224,122,0.8)" />
        <Ring delay={1200} color="rgba(18,181,190,0.8)" />
        <Ring delay={2400} color="rgba(139,224,122,0.7)" />
        <Animated.View style={{ transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }] }}>
          <LogoTile size={156} />
        </Animated.View>
      </View>

      <Animated.View style={[{ marginTop: 34, alignItems: 'center' }, riseStyle(0)]}>
        <T w="bold" size={40} color={C.tealLight} style={{ letterSpacing: 7, lineHeight: 50, writingDirection: 'ltr' }}>WABEK</T>
        <T size={15} color={C.onDeepMuted} style={{ marginTop: 8, textAlign: 'center' }}>{t('tagline')}</T>
      </Animated.View>

      <Animated.View style={[{ position: 'absolute', bottom: 72, alignItems: 'center', gap: 16 }, riseStyle(6)]}>
        <View style={{ width: 120, height: 4, borderRadius: 2, backgroundColor: 'rgba(234,247,245,0.12)', overflow: 'hidden' }}>
          <Animated.View style={{ width: 72, height: 4, borderRadius: 2, transform: [{ translateX: bar.interpolate({ inputRange: [0, 1], outputRange: [-80, 130] }) }] }}>
            <LinearGradient colors={['rgba(18,181,190,0)', C.teal, C.green, 'rgba(139,224,122,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
          </Animated.View>
        </View>
        <T size={12} color={C.onDeepFaint} style={{ letterSpacing: 1 }}>{t('by_webek')}</T>
      </Animated.View>
    </View>
  )
}
