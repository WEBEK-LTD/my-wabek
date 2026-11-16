import React, { useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useI18n, type Key } from '@/i18n'
import { useAuth } from '@/lib/auth'
import { useApi, useErrorText } from '@/lib/useApi'
import { C, shadow } from '@/lib/theme'
import { type Conversation, type DashboardStats, type Instance, instanceName, isConnected } from '@/lib/types'
import { Avatar, Card, DeepBg, ErrorView, IconBtn, Ltr, SectionTitle, T } from '@/components/ui'
import { Icon, type IconName } from '@/components/Icon'
import { PulseDot } from '@/components/Floating'
import { TabBar, TAB_BAR_SPACE } from '@/components/TabBar'
import { ConversationRow } from '@/components/ConversationRow'

type Period = 'today' | '7d' | '30d'

function sumChart(chart: DashboardStats['daily_chart'], days: number, offset = 0) {
  const slice = chart.slice(Math.max(0, chart.length - days - offset), chart.length - offset)
  return slice.reduce((a, d) => ({ sent: a.sent + d.sent, delivered: a.delivered + d.delivered, received: a.received + d.received }), { sent: 0, delivered: 0, received: 0 })
}

export default function Home() {
  const { t, fmtNumber } = useI18n()
  const { me } = useAuth()
  const errText = useErrorText()
  const [period, setPeriod] = useState<Period>('today')
  const stats = useApi<DashboardStats>('/api/dashboard/stats', { pollMs: 30000 })
  const inst = useApi<{ instances: Instance[] }>('/api/whatsapp/instances', { pollMs: 30000 })
  const inbox = useApi<{ conversations: Conversation[]; total: number }>('/api/inbox', { query: { status: 'open' }, pollMs: 15000 })

  const hour = new Date().getHours()
  const greet: Key = hour < 12 ? 'good_morning' : hour < 18 ? 'good_afternoon' : 'good_evening'
  const firstName = (me?.name || me?.email || '').split(/[\s@]/)[0]

  const kpi = useMemo(() => {
    const chart = stats.data?.daily_chart || []
    const days = period === 'today' ? 1 : period === '7d' ? 7 : 30
    const now = sumChart(chart, days)
    const prev = days < 30 ? sumChart(chart, days, days) : null
    const delta = prev && prev.sent > 0 ? Math.round(((now.sent - prev.sent) / prev.sent) * 100) : period === '30d' ? stats.data?.stats.mom_growth ?? null : null
    return { sent: now.sent, delta }
  }, [stats.data, period])

  const numbers = inst.data?.instances || []
  const down = numbers.filter(n => !isConnected(n.status))
  const waiting = (inbox.data?.conversations || []).slice(0, 3)
  const s = stats.data?.stats

  const refreshing = stats.refreshing || inst.refreshing || inbox.refreshing
  const onRefresh = () => { void stats.refresh(); void inst.refresh(); void inbox.refresh() }

  const periods: { key: Period; label: Key }[] = [{ key: 'today', label: 'period_today' }, { key: '7d', label: 'period_7d' }, { key: '30d', label: 'period_30d' }]
  const quick: { icon: IconName; label: Key; bg: string; fg: string; to: string }[] = [
    { icon: 'send', label: 'qa_new_message', bg: C.chip, fg: C.chipInk, to: '/new-message' },
    { icon: 'userPlus', label: 'qa_add_contact', bg: C.violetBg, fg: C.violet, to: '/add-contact' },
    { icon: 'bolt', label: 'qa_quick_replies', bg: C.warningBg, fg: C.warning, to: '/quick-replies' },
    { icon: 'headset', label: 'qa_support', bg: C.successBg, fg: C.success, to: '/support' },
  ]

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.green} />}
      >
        <DeepBg rounded style={{ paddingBottom: 92 }}>
          <SafeAreaView edges={['top']} style={{ paddingHorizontal: 20, paddingTop: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar name={me?.name || me?.email || 'W'} size={44} square />
              <View style={{ flex: 1 }}>
                <T size={12.5} color={C.onDeepMuted}>{t(greet)}</T>
                <T w="semibold" size={17} color={C.onDeep} numberOfLines={1}>{firstName}</T>
              </View>
              <IconBtn name="headset" label={t('contact_support')} tone="dark" onPress={() => router.push('/support')} />
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>
              {periods.map(p => {
                const on = p.key === period
                return (
                  <Pressable
                    key={p.key}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    onPress={() => setPeriod(p.key)}
                    style={{ height: 32, paddingHorizontal: 12, borderRadius: 99, justifyContent: 'center', backgroundColor: on ? 'rgba(234,247,245,0.14)' : 'transparent', borderWidth: on ? 0 : 1, borderColor: C.glassBorder }}
                  >
                    <T w={on ? 'semibold' : 'regular'} size={12.5} color={on ? C.onDeep : C.onDeepMuted}>{t(p.label)}</T>
                  </Pressable>
                )
              })}
            </View>
          </SafeAreaView>
        </DeepBg>

        <View style={[{ marginTop: -74, marginHorizontal: 16, padding: 18, borderRadius: 26, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line }, shadow.card]}>
          {stats.error && !stats.data ? (
            <ErrorView message={errText(stats.error)} onRetry={stats.reload} />
          ) : (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <T size={13} color={C.muted}>{t('messages_sent')}</T>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <PulseDot color={C.successDot} size={7} />
                  <T w="semibold" size={12} color={C.success}>{t('live')}</T>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 2 }}>
                <Ltr w="bold" size={34} style={{ lineHeight: 44 }}>{stats.data ? fmtNumber(kpi.sent) : '—'}</Ltr>
                {kpi.delta !== null && kpi.delta !== undefined ? (
                  <View accessibilityLabel={t('vs_previous')} style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, backgroundColor: kpi.delta >= 0 ? C.successBg : C.dangerBg }}>
                    <Ltr w="semibold" size={12.5} color={kpi.delta >= 0 ? C.success : C.danger}>{`${kpi.delta >= 0 ? '+' : ''}${kpi.delta}%`}</Ltr>
                  </View>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                <MiniStat label={t('delivered')} value={s ? `${s.delivery_rate}%` : '—'} pct={s?.delivery_rate ?? 0} colors={[C.teal, C.teal]} />
                <MiniStat label={t('read_short')} value={s ? `${s.read_rate}%` : '—'} pct={s?.read_rate ?? 0} colors={[C.teal, C.green]} />
                <MiniStat label={t('open_chats')} value={s ? fmtNumber(s.open_conversations) : '—'} pct={Math.min(100, (s?.open_conversations ?? 0) * 5)} colors={[C.green, C.green]} />
              </View>
            </>
          )}
        </View>

        {numbers.length === 0 && inst.data ? (
          <Pressable accessibilityRole="button" onPress={() => router.push('/numbers/add')} style={{ marginTop: 14, marginHorizontal: 16 }}>
            <LinearGradient colors={[C.teal, C.deep2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 16, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" color="#FFFFFF" /></View>
              <View style={{ flex: 1 }}>
                <T w="bold" size={15} color="#FFFFFF">{t('no_numbers_title')}</T>
                <T size={12.5} color="rgba(255,255,255,0.85)">{t('no_numbers_sub')}</T>
              </View>
              <Icon name="chevron" size={18} color="#FFFFFF" />
            </LinearGradient>
          </Pressable>
        ) : null}

        {down.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => (down.length === 1 ? router.push({ pathname: '/numbers/pair', params: { instanceId: down[0].id, phone: down[0].phone_number || '' } }) : router.replace('/numbers'))}
            style={{ marginTop: 14, marginHorizontal: 16, padding: 14, borderRadius: 20, backgroundColor: '#FFF4F2', borderWidth: 1, borderColor: '#F6D3CC', flexDirection: 'row', alignItems: 'center', gap: 12 }}
          >
            <PulseDot color={C.dangerDot} size={10} />
            <View style={{ flex: 1 }}>
              <T w="semibold" size={14}>{down.length === 1 ? t('number_down', { name: instanceName(down[0], t('pending_name')) }) : t('numbers_down', { n: down.length })}</T>
              <T size={12.5} color="#8A3B2E">{t('number_down_sub')}</T>
            </View>
            <View style={{ height: 34, paddingHorizontal: 12, borderRadius: 12, backgroundColor: C.dangerDot, justifyContent: 'center' }}>
              <T w="semibold" size={13} color="#FFFFFF">{t('reconnect')}</T>
            </View>
          </Pressable>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, marginHorizontal: 16 }}>
          {quick.map(q => (
            <Pressable
              key={q.label}
              accessibilityRole="button"
              accessibilityLabel={t(q.label)}
              onPress={() => router.push(q.to as never)}
              style={({ pressed }) => [{ flex: 1, height: 86, borderRadius: 20, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', gap: 8 }, pressed && { opacity: 0.75 }]}
            >
              <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: q.bg, alignItems: 'center', justifyContent: 'center' }}><Icon name={q.icon} size={18} color={q.fg} /></View>
              <T w="medium" size={11.5} numberOfLines={1} style={{ textAlign: 'center' }}>{t(q.label)}</T>
            </Pressable>
          ))}
        </View>

        <View style={{ marginHorizontal: 16 }}>
          <SectionTitle action={{ label: inbox.data?.total ? `${t('see_all')} (${inbox.data.total})` : t('see_all'), onPress: () => router.replace('/inbox') }}>{t('waiting_reply')}</SectionTitle>
          <Card padded={false} style={{ overflow: 'hidden' }}>
            {inbox.loading && !inbox.data ? (
              <View style={{ padding: 20 }}><T size={13} color={C.muted}>{t('loading')}</T></View>
            ) : waiting.length === 0 ? (
              <View style={{ padding: 18, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Icon name="check" size={18} color={C.success} />
                <T size={13.5} color={C.muted}>{t('nothing_waiting')}</T>
              </View>
            ) : (
              waiting.map((c, i) => <ConversationRow key={c.id} c={c} last={i === waiting.length - 1} compact />)
            )}
          </Card>
        </View>
      </ScrollView>
      <TabBar active="home" badges={{ inbox: s?.open_conversations || 0 }} />
    </View>
  )
}

function MiniStat({ label, value, pct, colors }: { label: string; value: string; pct: number; colors: [string, string] }) {
  return (
    <View style={{ flex: 1, padding: 10, borderRadius: 16, backgroundColor: C.bg }}>
      <T size={11.5} color={C.muted}>{label}</T>
      <Ltr w="bold" size={17}>{value}</Ltr>
      <View style={{ marginTop: 6, height: 4, borderRadius: 2, backgroundColor: C.line, overflow: 'hidden' }}>
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', borderRadius: 2 }} />
      </View>
    </View>
  )
}
