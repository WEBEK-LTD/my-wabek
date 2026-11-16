import React from 'react'
import { ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useI18n } from '@/i18n'
import { LogoTile } from '@/components/Brand'
import { Btn, T, Ltr, Avatar } from '@/components/ui'
import { LangSwitch, Dots, DeepBackdrop } from '@/components/Onboard'
import { Icon, Ticks } from '@/components/Icon'
import { Floating, Rise, TypingDots } from '@/components/Floating'
import { C, shadow } from '@/lib/theme'

export default function Welcome() {
  const { t } = useI18n()
  return (
    <View style={{ flex: 1, backgroundColor: C.deepest }}>
      <DeepBackdrop />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} bounces={false}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <LogoTile size={44} ring={false} />
              <T w="bold" size={18} color={C.onDeep} style={{ letterSpacing: 2, writingDirection: 'ltr' }}>WABEK</T>
            </View>
            <LangSwitch />
          </View>

          {/* Live demo */}
          <View style={{ height: 380, marginTop: 8 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={{ position: 'absolute', top: 30, alignSelf: 'center', width: 360, height: 360, borderRadius: 180, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(234,247,245,0.14)' }} />
            <Floating rotate={-4} duration={3000} style={{ position: 'absolute', top: 40, end: 26, width: 236 }}>
              <View style={[{ padding: 14, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' }, shadow.card]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Avatar name={t('demo_name')} size={38} />
                  <View style={{ flex: 1 }}>
                    <T w="semibold" size={14} color={C.onDeep}>{t('demo_name')}</T>
                    <T size={12} color={C.onDeepMuted}>{t('demo_source')}</T>
                  </View>
                  <View style={{ minWidth: 22, height: 22, borderRadius: 11, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' }}>
                    <T w="bold" size={12} color={C.deep} style={{ lineHeight: 16 }}>2</T>
                  </View>
                </View>
                <View style={{ marginTop: 12, padding: 10, borderRadius: 14, borderBottomStartRadius: 4, backgroundColor: 'rgba(234,247,245,0.1)' }}>
                  <T size={13} color={C.onDeep}>{t('demo_msg')}</T>
                </View>
                <View style={{ marginTop: 8, paddingHorizontal: 4 }}><TypingDots color={C.green} /></View>
              </View>
            </Floating>

            <Floating rotate={3} duration={3500} delay={300} style={{ position: 'absolute', top: 196, start: 22, width: 236 }}>
              <LinearGradient colors={[C.teal, C.deep2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ padding: 14, borderRadius: 22 }, shadow.glow]}>
                <T size={12} color="rgba(234,247,245,0.85)">{t('demo_ai_label')}</T>
                <T size={13.5} color="#FFFFFF" style={{ marginTop: 6 }}>{t('demo_ai_msg')}</T>
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 4, marginTop: 6 }}>
                  <Ltr size={11} color="rgba(234,247,245,0.85)">10:42</Ltr>
                  <Ticks status="read" color="#FFFFFF" />
                </View>
              </LinearGradient>
            </Floating>

            <Floating duration={2600} delay={600} style={{ position: 'absolute', top: 316, end: 40 }}>
              <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16, backgroundColor: 'rgba(2,26,29,0.8)', borderWidth: 1, borderColor: 'rgba(139,224,122,0.35)' }, shadow.card]}>
                <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: 'rgba(139,224,122,0.16)', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="trend" size={18} color={C.green} />
                </View>
                <View>
                  <T size={11} color={C.onDeepMuted}>{t('demo_campaign')}</T>
                  <T w="semibold" size={14} color={C.onDeep}>{t('demo_campaign_state')}</T>
                </View>
              </View>
            </Floating>
          </View>

          <View style={{ flex: 1, paddingHorizontal: 28, paddingBottom: 20 }}>
            <Rise>
              <T w="bold" size={30} color={C.onDeep} style={{ lineHeight: 42 }} accessibilityRole="header">
                {t('welcome_title_1')}{'\n'}<T w="bold" size={30} color={C.tealLight} style={{ lineHeight: 42 }}>{t('welcome_title_2')}</T>
              </T>
            </Rise>
            <Rise delay={150}>
              <T size={15} color={C.onDeepMuted} style={{ marginTop: 12, lineHeight: 27 }}>{t('welcome_sub')}</T>
            </Rise>
            <View style={{ marginTop: 22 }}><Dots index={0} total={2} /></View>
            <Rise delay={300} style={{ marginTop: 'auto', paddingTop: 24, gap: 12 }}>
              <Btn title={t('get_started')} icon="forward" onPress={() => router.push('/onboarding')} />
              <Btn title={t('have_account')} variant="glass" size="md" onPress={() => router.push('/login')} />
            </Rise>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}
