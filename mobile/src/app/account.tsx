import React, { useCallback, useEffect, useState } from 'react'
import { Alert, Linking, Platform, Pressable, ScrollView, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import * as WebBrowser from 'expo-web-browser'
import Constants from 'expo-constants'
import { useI18n } from '@/i18n'
import { useAuth } from '@/lib/auth'
import { API_URL } from '@/lib/api'
import { useApi } from '@/lib/useApi'
import { getItem, setItem } from '@/lib/storage'
import { pushPermission, registerPush, updatePush, type PushPrefs } from '@/lib/push'
import { biometricInfo, isLockEnabled, setLockEnabled, authenticate, type Biometric } from '@/lib/lock'
import { C, shadow } from '@/lib/theme'
import type { DashboardStats } from '@/lib/types'
import { Avatar, Btn, Card, DeepBg, ListRow, Ltr, SectionTitle, T, Toggle, useToast } from '@/components/ui'
import { Icon } from '@/components/Icon'
import { TabBar, TAB_BAR_SPACE } from '@/components/TabBar'

const PREFS_KEY = 'wabek_push_prefs'

type PlanFeatures = { plan: { id: string; name: string } | null; features: { max_messages_month?: number | null } }

export default function Account() {
  const { t, lang, setLang, fmtDate, fmtNumber } = useI18n()
  const { me, isAdmin, signOut } = useAuth()
  const toast = useToast()
  const plan = useApi<PlanFeatures>('/api/billing/plan-features')
  const stats = useApi<DashboardStats>('/api/dashboard/stats')
  const [bio, setBio] = useState<Biometric>({ available: false, kind: 'face' })
  const [lock, setLock] = useState(false)
  const [prefs, setPrefs] = useState<PushPrefs>({ messages: true, numbers: true, campaigns: true })
  const [perm, setPerm] = useState<string>('granted')

  useEffect(() => {
    void biometricInfo().then(setBio)
    void isLockEnabled().then(setLock)
    void getItem(PREFS_KEY).then(v => { if (v) try { setPrefs({ ...prefs, ...JSON.parse(v) }) } catch { /* ignore */ } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useFocusEffect(useCallback(() => { void pushPermission().then(setPerm) }, []))

  const method = bio.kind === 'face' ? t('biometric_face') : t('biometric_finger')
  const used = stats.data?.stats.sent_this_month ?? 0
  const max = plan.data?.features?.max_messages_month ?? null
  const pct = max && max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0
  const renew = me?.plan_expires_at ? t('renews_on', { date: fmtDate(me.plan_expires_at) }) : me?.trial_ends_at ? t('trial_until', { date: fmtDate(me.trial_ends_at) }) : ''
  const twoStep = me?.otp_mode === 'always' ? t('two_step_always') : me?.otp_mode === 'new_device' ? t('two_step_new') : t('two_step_off')
  const web = (path: string) => () => void WebBrowser.openBrowserAsync(`${API_URL}${path}`)

  const toggleLock = async (on: boolean) => {
    if (on && !bio.available) return toast(t('biometric_unavailable'), 'error')
    if (on && !(await authenticate(t('unlock_prompt'), t('cancel')))) return
    await setLockEnabled(on)
    setLock(on)
  }

  const setPref = async (k: keyof PushPrefs, v: boolean) => {
    const next = { ...prefs, [k]: v }
    setPrefs(next)
    await setItem(PREFS_KEY, JSON.stringify(next))
    try {
      if (!(await updatePush({ prefs: { [k]: v } })) && v) await registerPush()
    } catch { /* saved locally; synced on next start */ }
  }

  const switchLang = () => {
    const next = lang === 'en' ? 'ar' : 'en'
    const apply = async () => {
      try { await updatePush({ locale: next }) } catch { /* ignore */ }
      await setLang(next)
    }
    if (Platform.OS === 'web') return void apply()
    Alert.alert(t('restart_title'), t('restart_body'), [{ text: t('cancel'), style: 'cancel' }, { text: t('restart'), onPress: () => void apply() }])
  }

  const confirmSignOut = () => {
    const go = async () => { await signOut(); router.replace('/welcome') }
    if (Platform.OS === 'web') return void go()
    Alert.alert(t('sign_out'), t('sign_out_q'), [{ text: t('cancel'), style: 'cancel' }, { text: t('sign_out'), style: 'destructive', onPress: () => void go() }])
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE }}>
        <DeepBg rounded style={{ paddingBottom: 70 }}>
          <SafeAreaView edges={['top']} style={{ paddingHorizontal: 20, paddingTop: 10 }}>
            <T w="bold" size={26} color={C.onDeep} accessibilityRole="header">{t('account')}</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18 }}>
              <LinearGradient colors={[C.tealLight, C.green]} style={{ width: 62, height: 62, borderRadius: 22, padding: 2 }}>
                <View style={{ flex: 1, borderRadius: 20, backgroundColor: C.deep, alignItems: 'center', justifyContent: 'center' }}>
                  <T w="bold" size={24} color={C.green} style={{ lineHeight: 32 }}>{(me?.name || me?.email || '?').charAt(0).toUpperCase()}</T>
                </View>
              </LinearGradient>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T w="semibold" size={18} color={C.onDeep} numberOfLines={1}>{me?.name || '—'}</T>
                <Ltr size={13} color={C.onDeepMuted} numberOfLines={1}>{me?.email || ''}</Ltr>
              </View>
              <Btn title={t('edit')} variant="glass" size="sm" onPress={() => router.push('/settings/profile')} />
            </View>
          </SafeAreaView>
        </DeepBg>

        <View style={[{ marginTop: -50, marginHorizontal: 16, padding: 16, borderRadius: 24, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line }, shadow.card]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <LinearGradient colors={[C.tealLight, C.green]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 26, paddingHorizontal: 10, borderRadius: 13, justifyContent: 'center' }}>
              <T w="bold" size={12} color={C.deep} style={{ lineHeight: 16 }}>{plan.data?.plan?.name || t('plan_free')}</T>
            </LinearGradient>
            <T size={13} color={C.muted} style={{ flex: 1 }} numberOfLines={1}>{renew}</T>
            {/* iOS: plans are bought with In-App Purchase (App Store guideline 3.1.1). */}
            <Pressable accessibilityRole="link" onPress={Platform.OS === 'ios' ? () => router.push('/plans') : web('/dashboard/billing')} hitSlop={8}>
              <T w="semibold" size={13} color={C.chipInk}>{Platform.OS === 'ios' ? t(plan.data?.plan ? 'manage_plan' : 'upgrade_plan') : t('manage_plan')}</T>
            </Pressable>
          </View>
          {max ? (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
                <T size={12.5} color={C.muted}>{t('messages_this_month')}</T>
                <Ltr w="semibold" size={12.5}>{`${fmtNumber(used)} / ${max < 0 ? '∞' : fmtNumber(max)}`}</Ltr>
              </View>
              <View style={{ marginTop: 6, height: 8, borderRadius: 4, backgroundColor: C.lineSoft, overflow: 'hidden' }}>
                <LinearGradient colors={pct > 85 ? [C.warning, C.dangerDot] : [C.teal, C.green]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${max < 0 ? 0 : pct}%`, height: '100%' }} />
              </View>
            </>
          ) : null}
        </View>

        <View style={{ marginHorizontal: 16 }}>
          {isAdmin ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('admin_panel')} onPress={() => router.push('/admin')} style={[{ marginTop: 14, padding: 14, borderRadius: 22, backgroundColor: C.deep, borderWidth: 1, borderColor: 'rgba(181,156,245,0.35)', flexDirection: 'row', alignItems: 'center', gap: 12 }, shadow.card]}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(181,156,245,0.18)', alignItems: 'center', justifyContent: 'center' }}><Icon name="shieldCheck" size={22} color={C.violetLight} /></View>
              <View style={{ flex: 1 }}>
                <T w="bold" size={15} color={C.onDeep}>{t('admin_panel')}</T>
                <T size={12.5} color={C.onDeepMuted}>{t('admin_only')}</T>
              </View>
              <Icon name="chevron" size={18} color={C.onDeep} />
            </Pressable>
          ) : null}

          <Pressable accessibilityRole="button" accessibilityLabel={t('contact_support')} onPress={() => router.push('/support')} style={[{ marginTop: 14, borderRadius: 22, overflow: 'hidden' }, shadow.glow]}>
            <LinearGradient colors={[C.teal, C.deep2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}><Icon name="headset" size={22} color="#FFFFFF" /></View>
              <View style={{ flex: 1 }}>
                <T w="bold" size={15} color="#FFFFFF">{t('contact_support')}</T>
                <T size={12.5} color="rgba(255,255,255,0.85)">{t('contact_support_sub')}</T>
              </View>
              <Icon name="chevron" size={18} color="#FFFFFF" />
            </LinearGradient>
          </Pressable>

          <SectionTitle>{t('section_account')}</SectionTitle>
          <Card padded={false} style={{ overflow: 'hidden' }}>
            <ListRow icon="user" title={t('profile')} onPress={() => router.push('/settings/profile')} />
            <ListRow icon="users" iconBg={C.violetBg} iconColor={C.violet} title={t('team')} onPress={web('/dashboard/team')} />
            <ListRow icon="globe" iconBg={C.warningBg} iconColor={C.warning} title={t('language')} value={t('switch_language')} onPress={switchLang} last />
          </Card>

          <SectionTitle>{t('section_security')}</SectionTitle>
          <Card padded={false} style={{ overflow: 'hidden' }}>
            <ListRow icon="lock" title={t('change_password')} onPress={() => router.push('/settings/password')} />
            <ListRow icon="shieldCheck" iconBg={C.successBg} iconColor={C.success} title={t('two_step')} value={twoStep} onPress={() => router.push('/settings/two-step')} />
            {Platform.OS !== 'web' ? (
              <ListRow icon="face" iconBg={C.violetBg} iconColor={C.violet} title={t('app_lock', { method })} subtitle={t('app_lock_sub', { method })} right={<Toggle value={lock} onChange={v => void toggleLock(v)} label={t('app_lock', { method })} />} />
            ) : null}
            <ListRow icon="devices" iconBg={C.warningBg} iconColor={C.warning} title={t('devices')} onPress={() => router.push('/settings/devices')} last />
          </Card>

          <SectionTitle>{t('section_notifications')}</SectionTitle>
          <Card padded={false} style={{ overflow: 'hidden' }}>
            {perm === 'denied' ? (
              <ListRow icon="alert" iconBg={C.dangerBg} iconColor={C.danger} title={t('notif_off_system')} value={t('open_settings')} onPress={() => void Linking.openSettings()} />
            ) : null}
            <ListRow icon="chat" iconBg={C.pinkBg} iconColor={C.pink} title={t('notif_messages')} right={<Toggle value={prefs.messages} onChange={v => void setPref('messages', v)} label={t('notif_messages')} />} />
            <ListRow icon="unlink" iconBg={C.dangerBg} iconColor={C.danger} title={t('notif_numbers')} right={<Toggle value={prefs.numbers} onChange={v => void setPref('numbers', v)} label={t('notif_numbers')} />} />
            <ListRow icon="trend" title={t('notif_campaigns')} right={<Toggle value={prefs.campaigns} onChange={v => void setPref('campaigns', v)} label={t('notif_campaigns')} />} last />
          </Card>

          <SectionTitle>{t('section_help')}</SectionTitle>
          <Card padded={false} style={{ overflow: 'hidden' }}>
            <ListRow icon="mail" title={t('support_tickets')} onPress={() => router.push('/support')} />
            <ListRow icon="book" iconBg={C.blueBg} iconColor={C.blue} title={t('help_center')} onPress={web('/docs')} />
            <ListRow icon="shield" iconBg={C.successBg} iconColor={C.success} title={t('privacy')} onPress={web('/privacy')} />
            <ListRow icon="doc" iconBg={C.warningBg} iconColor={C.warning} title={t('terms')} onPress={web('/terms')} last />
          </Card>

          <View style={{ marginTop: 18, gap: 10 }}>
            <Btn title={t('sign_out')} icon="logout" variant="outline" size="md" onPress={confirmSignOut} />
            {!me?.sub_account_of ? <Btn title={t('delete_account')} variant="dangerText" size="md" onPress={() => router.push('/settings/delete')} /> : null}
            <Ltr size={12} color={C.faint} style={{ textAlign: 'center' }}>{`WABEK · ${t('version', { v: Constants.expoConfig?.version || '1.0.0' })}`}</Ltr>
          </View>
        </View>
      </ScrollView>
      <TabBar active="account" />
    </View>
  )
}
