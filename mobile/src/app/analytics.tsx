import React, { useMemo, useState } from 'react'
import { RefreshControl, ScrollView, Share, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useI18n } from '@/i18n'
import { useApi, useErrorText } from '@/lib/useApi'
import { C } from '@/lib/theme'
import type { DashboardStats } from '@/lib/types'
import { ErrorView, IconBtn, Loader, Ltr, Segmented, T } from '@/components/ui'
import { PulseDot } from '@/components/Floating'
import { AreaChart } from '@/components/AreaChart'
import { TabBar, TAB_BAR_SPACE } from '@/components/TabBar'

type Period = '7d' | '30d'

export default function Analytics() {
  const { t, fmtNumber, fmtDate } = useI18n()
  const errText = useErrorText()
  const [period, setPeriod] = useState<Period>('7d')
  const q = useApi<DashboardStats>('/api/dashboard/stats', { pollMs: 30000 })
  const d = q.data
  const s = d?.stats

  const view = useMemo(() => {
    const chart = d?.daily_chart || []
    const days = period === '7d' ? 7 : 30
    const cur = chart.slice(-days)
    const prev = chart.slice(-days * 2, -days)
    const sum = (rows: typeof chart, k: 'sent' | 'delivered' | 'received') => rows.reduce((a, r) => a + (r[k] || 0), 0)
    const sent = sum(cur, 'sent')
    const prevSent = sum(prev, 'sent')
    return {
      cur,
      sent,
      delivered: sum(cur, 'delivered'),
      received: sum(cur, 'received'),
      delta: prev.length === cur.length && prevSent > 0 ? Math.round(((sent - prevSent) / prevSent) * 100) : null,
    }
  }, [d, period])

  const exportReport = async () => {
    if (!d) return
    const lines = [
      `${t('export_title')} — ${fmtDate(new Date())}`,
      '',
      `,${t('sent')},${t('delivered')},${t('received')}`,
      ...view.cur.map(r => `${r.date},${r.sent},${r.delivered},${r.received}`),
      '',
      `${t('delivery_rate')}: ${s?.delivery_rate ?? 0}%`,
      `${t('read_rate')}: ${s?.read_rate ?? 0}%`,
      `${t('link_clicks')}: ${s?.link_clicks_total ?? 0}`,
    ]
    await Share.share({ title: t('export_title'), message: lines.join('\n') })
  }

  const kpis = s ? [
    { label: t('delivery_rate'), value: `${s.delivery_rate}%` },
    { label: t('read_rate'), value: `${s.read_rate}%` },
    { label: t('received'), value: fmtNumber(view.received) },
    { label: t('link_clicks'), value: fmtNumber(s.link_clicks_total) },
  ] : []

  const ai = s?.ai_replies_30d ?? 0
  const team = s?.team_replies_30d ?? 0
  const replyTotal = Math.max(1, ai + team)

  return (
    <View style={{ flex: 1, backgroundColor: C.deepest }}>
      <LinearGradient colors={['rgba(14,108,114,0.85)', 'rgba(14,108,114,0)']} start={{ x: 1, y: 0 }} end={{ x: 0.3, y: 0.4 }} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE }} refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={C.green} />}>
        <SafeAreaView edges={['top']} style={{ paddingHorizontal: 18, paddingTop: 10, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <T w="bold" size={26} color={C.onDeep} style={{ flex: 1 }} accessibilityRole="header">{t('analytics')}</T>
            <IconBtn name="download" label={t('export')} tone="dark" size={42} onPress={exportReport} />
          </View>
          <Segmented<Period> dark value={period} onChange={setPeriod} items={[{ key: '7d', label: t('period_7d') }, { key: '30d', label: t('period_30d') }]} />
        </SafeAreaView>

        {q.loading && !d ? <Loader dark /> : q.error && !d ? <ErrorView dark message={errText(q.error)} onRetry={q.reload} /> : d && s ? (
          <View style={{ paddingHorizontal: 18, gap: 10, marginTop: 12 }}>
            <LinearGradient colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.03)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 16, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View>
                  <T size={12} color={C.onDeepMuted}>{t('messages_sent')}</T>
                  <Ltr w="bold" size={30} color={C.onDeep} style={{ lineHeight: 40 }}>{fmtNumber(view.sent)}</Ltr>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <PulseDot color={C.green} size={7} />
                    <T w="semibold" size={12} color={C.green}>{t('live')}</T>
                  </View>
                  {view.delta !== null ? (
                    <View accessibilityLabel={t('vs_previous')} style={{ paddingHorizontal: 9, paddingVertical: 2, borderRadius: 99, backgroundColor: view.delta >= 0 ? 'rgba(139,224,122,0.15)' : 'rgba(220,59,43,0.2)' }}>
                      <Ltr w="semibold" size={12} color={view.delta >= 0 ? C.green : '#F6A196'}>{`${view.delta >= 0 ? '+' : ''}${view.delta}%`}</Ltr>
                    </View>
                  ) : null}
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 14, marginTop: 6, marginBottom: 8 }}>
                <Legend color={C.teal} label={t('sent')} />
                <Legend color={C.green} label={t('delivered')} />
              </View>
              <AreaChart a={view.cur.map(r => r.sent)} b={view.cur.map(r => r.delivered)} colorA={C.teal} colorB={C.green} label={t('chart_a11y')} />
            </LinearGradient>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {kpis.map(k => (
                <View key={k.label} style={{ width: '48%', flexGrow: 1, padding: 14, borderRadius: 20, backgroundColor: 'rgba(234,247,245,0.05)', borderWidth: 1, borderColor: 'rgba(234,247,245,0.1)' }}>
                  <T size={12} color={C.onDeepMuted}>{k.label}</T>
                  <Ltr w="bold" size={20} color={C.onDeep}>{k.value}</Ltr>
                </View>
              ))}
            </View>

            <View style={{ padding: 14, borderRadius: 22, backgroundColor: 'rgba(234,247,245,0.05)', borderWidth: 1, borderColor: 'rgba(234,247,245,0.1)', gap: 10 }}>
              <T w="semibold" size={13.5} color={C.onDeep}>{t('replies_30d')}</T>
              <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 }}>
                <View style={{ flex: Math.max(ai, 0.0001) / replyTotal, backgroundColor: C.teal }} />
                <View style={{ flex: Math.max(team, 0.0001) / replyTotal, backgroundColor: C.green }} />
              </View>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <Legend color={C.teal} label={`${t('ai_replies')} · ${fmtNumber(ai)}`} />
                <Legend color={C.green} label={`${t('team_replies')} · ${fmtNumber(team)}`} />
              </View>
            </View>

            <View style={{ padding: 14, borderRadius: 22, backgroundColor: 'rgba(234,247,245,0.05)', borderWidth: 1, borderColor: 'rgba(234,247,245,0.1)', gap: 4 }}>
              <T w="semibold" size={13.5} color={C.onDeep}>{t('campaigns')}</T>
              {(d.recent_campaigns || []).length === 0 ? <T size={13} color={C.onDeepMuted}>{t('no_campaigns')}</T> : d.recent_campaigns.slice(0, 5).map((c, i) => {
                const sent = c.sent_count || 0
                const readPct = sent > 0 ? Math.round(((c.read_count || 0) / sent) * 100) : 0
                return (
                  <View key={`${c.name}-${i}`} style={{ paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: 'rgba(234,247,245,0.07)', gap: 6 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                      <T size={14} color={C.onDeep} numberOfLines={1} style={{ flex: 1 }}>{c.name}</T>
                      <Ltr size={12.5} color={C.onDeepMuted}>{`${fmtNumber(sent)} · ${readPct}%`}</Ltr>
                    </View>
                    <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(234,247,245,0.08)', overflow: 'hidden' }}>
                      <LinearGradient colors={[C.teal, C.green]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${readPct}%`, height: '100%' }} />
                    </View>
                  </View>
                )
              })}
            </View>

            {(d.top_links || []).length ? (
              <View style={{ padding: 14, borderRadius: 22, backgroundColor: 'rgba(234,247,245,0.05)', borderWidth: 1, borderColor: 'rgba(234,247,245,0.1)', gap: 8 }}>
                <T w="semibold" size={13.5} color={C.onDeep}>{t('top_links')}</T>
                {d.top_links.slice(0, 5).map((l, i) => (
                  <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                    <Ltr size={13} color={C.onDeepMuted} numberOfLines={1} style={{ flex: 1 }}>{l.title || l.original_url || l.short_code || ''}</Ltr>
                    <T size={12.5} color={C.green}>{t('clicks', { n: fmtNumber(l.click_count || 0) })}</T>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
      <TabBar active="analytics" dark />
    </View>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 3, borderRadius: 2, backgroundColor: color }} />
      <T size={11.5} color={C.onDeepMuted}>{label}</T>
    </View>
  )
}
