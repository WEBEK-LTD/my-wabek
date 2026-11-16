import React, { useState } from 'react'
import { Alert, Platform, ScrollView, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useI18n } from '@/i18n'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { useApi, useErrorText } from '@/lib/useApi'
import { C } from '@/lib/theme'
import { type Instance, instanceName, isCloud, isConnected } from '@/lib/types'
import { Avatar, Badge, Btn, Card, Empty, ErrorView, Loader, Ltr, Screen, SectionTitle, T, TopBar, useToast } from '@/components/ui'

type Detail = {
  user: { id: string; email: string; name: string | null; phone: string | null; role: string; is_active: boolean | null; created_at: string; last_login_at: string | null; deletion_requested_at?: string | null; plans?: { name: string } | null }
  instances: Instance[]
  stats: { messages: number | null; contacts: number | null }
}

export default function AdminUser() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { t, fmtDate, fmtRelative, fmtNumber } = useI18n()
  const { isAdmin, me } = useAuth()
  const toast = useToast()
  const errText = useErrorText()
  const q = useApi<Detail>(isAdmin ? `/api/admin/users/${id}` : null)
  const [busy, setBusy] = useState(false)

  if (!isAdmin) return <Screen><TopBar title={t('admin')} /><Empty icon="shield" title={t('not_admin')} /></Screen>
  const u = q.data?.user
  const active = u?.is_active !== false

  const toggle = () => {
    if (!u) return
    const run = async () => {
      setBusy(true)
      try {
        await api(`/api/admin/users/${u.id}`, { method: 'PUT', body: { is_active: !active } })
        await q.silentReload()
        toast(t('saved'))
      } catch (e) {
        toast(errText(e), 'error')
      } finally {
        setBusy(false)
      }
    }
    if (!active || Platform.OS === 'web') return void run()
    Alert.alert(t('suspend'), t('suspend_q', { email: u.email }), [{ text: t('cancel'), style: 'cancel' }, { text: t('suspend'), style: 'destructive', onPress: () => void run() }])
  }

  return (
    <Screen>
      <TopBar title={u?.name || u?.email || t('admin_tab_users')} />
      {q.loading && !q.data ? <Loader /> : q.error && !q.data ? <ErrorView message={errText(q.error)} onRetry={q.reload} /> : u ? (
        <ScrollView contentContainerStyle={{ padding: 18, gap: 4, paddingBottom: 40 }}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Avatar name={u.name || u.email} size={56} />
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <T w="semibold" size={17} numberOfLines={1}>{u.name || '—'}</T>
              <Ltr size={13} color={C.muted} numberOfLines={1}>{u.email}</Ltr>
              {u.phone ? <Ltr size={13} color={C.muted}>{u.phone}</Ltr> : null}
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                <Badge label={active ? t('active') : t('suspended')} tone={active ? 'success' : 'danger'} dot />
                <Badge label={u.role === 'admin' ? t('admin_role') : u.plans?.name || t('plan_free')} tone="brand" />
                {u.deletion_requested_at ? <Badge label={t('delete_account')} tone="danger" /> : null}
              </View>
            </View>
          </Card>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            {[
              { label: t('messages_total'), value: fmtNumber(q.data?.stats.messages ?? 0) },
              { label: t('contacts_total'), value: fmtNumber(q.data?.stats.contacts ?? 0) },
              { label: t('numbers_total'), value: fmtNumber(q.data?.instances.length ?? 0) },
            ].map(k => (
              <Card key={k.label} style={{ flex: 1, padding: 12 }}>
                <T size={11.5} color={C.muted}>{k.label}</T>
                <Ltr w="bold" size={18}>{k.value}</Ltr>
              </Card>
            ))}
          </View>

          <T size={12.5} color={C.muted} style={{ marginTop: 10, paddingHorizontal: 4 }}>{t('joined', { date: fmtDate(u.created_at) })}</T>
          {u.last_login_at ? <T size={12.5} color={C.muted} style={{ paddingHorizontal: 4 }}>{t('last_login', { when: fmtRelative(u.last_login_at) })}</T> : null}

          {(q.data?.instances || []).length ? (
            <>
              <SectionTitle>{t('numbers')}</SectionTitle>
              <Card padded={false} style={{ overflow: 'hidden' }}>
                {q.data!.instances.map((i, idx) => (
                  <View key={i.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: idx < q.data!.instances.length - 1 ? 1 : 0, borderBottomColor: C.lineSoft }}>
                    <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: isConnected(i.status) ? C.successDot : C.dangerDot }} />
                    <T size={14} style={{ flex: 1 }} numberOfLines={1}>{instanceName(i, t('pending_name'))}</T>
                    <T size={12} color={C.muted}>{isCloud(i) ? t('type_cloud') : t('type_web')}</T>
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          {u.id !== me?.id ? (
            <Btn title={active ? t('suspend') : t('activate')} variant={active ? 'danger' : 'teal'} onPress={toggle} loading={busy} style={{ marginTop: 18 }} />
          ) : null}
        </ScrollView>
      ) : null}
    </Screen>
  )
}
