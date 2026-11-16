import React from 'react'
import { ActionSheetIOS, Alert, Platform, Pressable, RefreshControl, ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api'
import { useApi, useErrorText } from '@/lib/useApi'
import { C } from '@/lib/theme'
import { type Instance, fmtPhone, instanceName, isCloud, isConnected } from '@/lib/types'
import { Badge, Empty, ErrorView, IconBtn, Loader, Ltr, T, useToast } from '@/components/ui'
import { Icon } from '@/components/Icon'
import { PulseDot } from '@/components/Floating'
import { TabBar, TAB_BAR_SPACE } from '@/components/TabBar'

export default function Numbers() {
  const { t } = useI18n()
  const toast = useToast()
  const errText = useErrorText()
  const q = useApi<{ instances: Instance[] }>('/api/whatsapp/instances', { pollMs: 15000 })
  const list = q.data?.instances || []

  const statusOf = (i: Instance) =>
    isConnected(i.status) ? { label: t('st_connected'), tone: 'success' as const }
      : i.status === 'qr_pending' ? { label: t('st_pending'), tone: 'warning' as const }
        : i.status === 'initializing' ? { label: t('st_initializing'), tone: 'warning' as const }
          : { label: t('st_disconnected'), tone: 'danger' as const }

  const act = (i: Instance) => {
    const name = instanceName(i, t('pending_name'))
    const items: { label: string; run: () => void; destructive?: boolean }[] = []
    if (!isConnected(i.status) && !isCloud(i)) {
      items.push({ label: t('m_code_title'), run: () => router.push({ pathname: '/numbers/pair', params: { instanceId: i.id, phone: fmtPhone(i.phone_number) } }) })
      items.push({ label: t('m_qr_title'), run: () => router.push({ pathname: '/numbers/qr', params: { instanceId: i.id } }) })
    }
    if (!i.is_default) {
      items.push({
        label: t('make_default'),
        run: async () => {
          try { await api(`/api/whatsapp/instances/${i.id}`, { method: 'PUT', body: { is_default: true } }); toast(t('saved')); void q.silentReload() } catch (e) { toast(errText(e), 'error') }
        },
      })
    }
    items.push({
      label: t('remove_number'),
      destructive: true,
      run: () => Alert.alert(t('remove_number'), t('remove_number_q', { name }), [
        { text: t('cancel'), style: 'cancel' },
        { text: t('delete'), style: 'destructive', onPress: async () => {
          try { await api(`/api/whatsapp/instances/${i.id}`, { method: 'DELETE' }); void q.silentReload() } catch (e) { toast(errText(e), 'error') }
        } },
      ]),
    })
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: name, options: [...items.map(x => x.label), t('cancel')], cancelButtonIndex: items.length, destructiveButtonIndex: items.findIndex(x => x.destructive) },
        idx => items[idx]?.run(),
      )
    } else {
      Alert.alert(name, undefined, [...items.map(x => ({ text: x.label, onPress: x.run, style: x.destructive ? ('destructive' as const) : ('default' as const) })), { text: t('cancel'), style: 'cancel' as const }])
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView edges={['top']} style={{ paddingHorizontal: 18, paddingTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <T w="bold" size={26} style={{ flex: 1 }} accessibilityRole="header">{t('numbers')}</T>
        <IconBtn name="plus" label={t('add_number')} tone="teal" size={42} onPress={() => router.push('/numbers/add')} />
      </SafeAreaView>
      {q.loading && !q.data ? <Loader /> : q.error && !q.data ? <ErrorView message={errText(q.error)} onRetry={q.reload} /> : (
        <ScrollView contentContainerStyle={{ padding: 18, gap: 10, paddingBottom: TAB_BAR_SPACE }} refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={C.teal} />}>
          {list.length === 0 ? (
            <Empty icon="phone" title={t('no_numbers_title')} subtitle={t('no_numbers_sub')} action={{ label: t('add_number'), onPress: () => router.push('/numbers/add') }} />
          ) : list.map(i => {
            const st = statusOf(i)
            const down = st.tone === 'danger'
            const cloud = isCloud(i)
            return (
              <Pressable
                key={i.id}
                accessibilityRole="button"
                accessibilityLabel={`${instanceName(i, t('pending_name'))}, ${st.label}`}
                onPress={() => act(i)}
                style={({ pressed }) => [{ padding: 14, borderRadius: 22, backgroundColor: C.surface, borderWidth: down ? 1.5 : 1, borderColor: down ? '#F2B8AE' : C.line, flexDirection: 'row', alignItems: 'center', gap: 12 }, pressed && { opacity: 0.8 }]}
              >
                <View style={{ width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: down ? C.dangerBg : cloud ? C.blueBg : C.chip }}>
                  <Icon name={down ? 'unlink' : cloud ? 'cloud' : 'phone'} size={21} color={down ? C.danger : cloud ? C.blue : C.chipInk} />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <T w="semibold" size={15} numberOfLines={1} style={{ flexShrink: 1 }}>{instanceName(i, t('pending_name'))}</T>
                    {i.is_default ? <Badge label={t('default_number')} tone="brand" /> : null}
                  </View>
                  <T size={12.5} color={C.muted} numberOfLines={1}>{cloud ? t('type_cloud') : t('type_web')}</T>
                  {fmtPhone(i.phone_number) ? <Ltr size={12.5} color={C.muted} numberOfLines={1} style={{ alignSelf: 'flex-start' }}>{fmtPhone(i.phone_number)}</Ltr> : null}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 26, paddingHorizontal: 10, borderRadius: 99, backgroundColor: st.tone === 'success' ? C.successBg : st.tone === 'warning' ? C.warningBg : C.dangerBg }}>
                  {down ? <PulseDot color={C.dangerDot} size={7} /> : <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: st.tone === 'success' ? C.successDot : C.warning }} />}
                  <T w="semibold" size={12} color={st.tone === 'success' ? C.success : st.tone === 'warning' ? C.warning : C.danger}>{st.label}</T>
                </View>
              </Pressable>
            )
          })}
        </ScrollView>
      )}
      <TabBar active="numbers" />
    </View>
  )
}
