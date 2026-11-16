import React, { useEffect, useRef } from 'react'
import { Animated, Easing, Pressable, ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg'
import { useI18n } from '@/i18n'
import { Btn, IconBtn, T, Ltr } from '@/components/ui'
import { Dots, DeepBackdrop } from '@/components/Onboard'
import { Floating, PulseDot, Rise } from '@/components/Floating'
import { C, shadow } from '@/lib/theme'

const AnimatedPath = Animated.createAnimatedComponent(Path)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const LINE = 'M0 104 C 30 96, 46 70, 78 76 S 128 98, 156 66 S 206 40, 236 52 S 284 18, 310 14'
const BARS = [0.4, 0.62, 0.5, 0.78, 0.66, 0.92, 1]

export default function Onboarding() {
  const { t, fmtDate } = useI18n()
  const draw = useRef(new Animated.Value(0)).current
  const gauge = useRef(new Animated.Value(0)).current
  const grow = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(draw, { toValue: 1, duration: 2200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start()
    Animated.timing(gauge, { toValue: 1, duration: 2000, delay: 300, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start()
    Animated.timing(grow, { toValue: 1, duration: 1200, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start()
  }, [draw, gauge, grow])

  // Last 7 days' initials in the current language.
  const days = Array.from({ length: 7 }, (_, i) => fmtDate(new Date(Date.now() - (6 - i) * 86400000), { weekday: 'narrow' }))

  return (
    <View style={{ flex: 1, backgroundColor: C.deepest }}>
      <DeepBackdrop variant={2} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} bounces={false}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 12 }}>
            <IconBtn name="back" label={t('back')} tone="dark" size={40} onPress={() => router.back()} />
            <Pressable accessibilityRole="link" onPress={() => router.replace('/login')} hitSlop={10}>
              <T size={14} color={C.onDeepMuted}>{t('skip')}</T>
            </Pressable>
          </View>

          <View style={{ paddingHorizontal: 22, paddingTop: 18 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={[{ padding: 18, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }, shadow.card]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <T size={12} color={C.onDeepMuted}>{t('ob_chart_label')}</T>
                  <Ltr w="bold" size={26} color={C.onDeep}>48,210</Ltr>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 10, borderRadius: 99, backgroundColor: 'rgba(139,224,122,0.14)' }}>
                  <PulseDot color={C.green} size={7} />
                  <T w="semibold" size={12} color={C.green}>{t('live')}</T>
                </View>
              </View>
              <Svg width="100%" height={130} viewBox="0 0 310 130" preserveAspectRatio="none" style={{ marginTop: 10 }}>
                <Defs>
                  <SvgGradient id="area" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={C.teal} stopOpacity={0.45} /><Stop offset="1" stopColor={C.teal} stopOpacity={0} /></SvgGradient>
                  <SvgGradient id="stroke" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor={C.green} /><Stop offset="1" stopColor={C.teal} /></SvgGradient>
                </Defs>
                <Path d={`${LINE} L 310 130 L 0 130 Z`} fill="url(#area)" />
                <AnimatedPath d={LINE} fill="none" stroke="url(#stroke)" strokeWidth={3} strokeLinecap="round" strokeDasharray="520" strokeDashoffset={draw.interpolate({ inputRange: [0, 1], outputRange: [520, 0] })} />
                <Circle cx={310} cy={14} r={5} fill={C.green} />
              </Svg>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                {days.map((d, i) => <T key={i} size={11} color={C.onDeepFaint}>{d}</T>)}
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
              <Floating distance={8} duration={2500} style={{ flex: 1 }}>
                <View style={{ padding: 14, borderRadius: 22, backgroundColor: 'rgba(2,26,29,0.7)', borderWidth: 1, borderColor: 'rgba(234,247,245,0.12)', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Svg width={56} height={56} viewBox="0 0 90 90">
                    <Circle cx={45} cy={45} r={38} fill="none" stroke="rgba(234,247,245,0.1)" strokeWidth={9} />
                    <AnimatedCircle cx={45} cy={45} r={38} fill="none" stroke={C.green} strokeWidth={9} strokeLinecap="round" strokeDasharray="239" strokeDashoffset={gauge.interpolate({ inputRange: [0, 1], outputRange: [239, 24] })} transform="rotate(-90 45 45)" />
                  </Svg>
                  <View>
                    <Ltr w="bold" size={20} color={C.onDeep}>90%</Ltr>
                    <T size={12} color={C.onDeepMuted}>{t('read_rate')}</T>
                  </View>
                </View>
              </Floating>
              <View style={{ flex: 1, padding: 14, borderRadius: 22, backgroundColor: 'rgba(2,26,29,0.7)', borderWidth: 1, borderColor: 'rgba(234,247,245,0.12)' }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 46, direction: 'ltr' }}>
                  {BARS.map((h, i) => (
                    <Animated.View key={i} style={{ flex: 1, borderRadius: 4, height: grow.interpolate({ inputRange: [0, 1], outputRange: [3, 46 * h] }), backgroundColor: i === BARS.length - 1 ? C.green : `rgba(18,181,190,${0.45 + i * 0.08})` }} />
                  ))}
                </View>
                <T size={12} color={C.onDeepMuted} style={{ marginTop: 8 }}>{t('avg_first_reply')} <Ltr w="bold" size={12} color={C.onDeep}>3:40</Ltr></T>
              </View>
            </View>
          </View>

          <View style={{ flex: 1, paddingHorizontal: 28, paddingTop: 26, paddingBottom: 20 }}>
            <Rise>
              <T w="bold" size={28} color={C.onDeep} style={{ lineHeight: 40 }} accessibilityRole="header">
                {t('ob_title_1')} <T w="bold" size={28} color={C.tealLight} style={{ lineHeight: 40 }}>{t('ob_title_2')}</T>
              </T>
            </Rise>
            <Rise delay={150}>
              <T size={15} color={C.onDeepMuted} style={{ marginTop: 10, lineHeight: 27 }}>{t('ob_sub')}</T>
            </Rise>
            <View style={{ marginTop: 20 }}><Dots index={1} total={2} /></View>
            <Rise delay={300} style={{ marginTop: 'auto', paddingTop: 24, gap: 12 }}>
              <Btn title={t('create_free_account')} icon="forward" onPress={() => router.push('/register')} />
              <Btn title={t('have_account')} variant="glass" size="md" onPress={() => router.push('/login')} />
            </Rise>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}
