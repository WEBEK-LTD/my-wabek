import React, { useEffect, useState } from 'react'
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useI18n } from '@/i18n'
import { useAuth } from '@/lib/auth'
import { useApi, useErrorText } from '@/lib/useApi'
import { authenticate, biometricInfo } from '@/lib/lock'
import { C, F } from '@/lib/theme'
import type { Ticket } from '@/lib/types'
import { Avatar, Badge, Empty, ErrorView, IconBtn, Loader, Ltr, Segmented, T } from '@/components/ui'
import { Icon } from '@/components/Icon'
import { TICKET_STATUS } from '@/components/TicketThread'

type Tab = 'overview' | 'support' | 'users'

type AdminStats = {
  stats: { total_users: number; new_users_this_month: number; active_subscriptions: number; mrr: number; messages_this_month: number; total_instances: number; connected_instances: number }
  daily_signups: { date: string; count: number }[]
}
type AdminUser = { id: string; email: string; name: string | null; role: string; is_active: boolean | null; created_at: string; plans?: { name: string } | null }

export default function Admin() {
  const { t } = useI18n()
  const { isAdmin } = useAuth()
  const [unlocked, setUnlocked] = useState(Platform.OS === 'web')
  const [tab, setTab] = useState<Tab>('overview')
  // Badge on the Support tab: open tickets (only fetched for admins, after unlocking).
  const open = useApi<{ tickets: Ticket[] }>(isAdmin && unlocked ? '/api/admin/support/tickets' : null, { query: { status: 'open' }, pollMs: 30000 })

  // Re-confirm with Face ID / fingerprint every time the admin panel opens.
  useEffect(() => {
    if (unlocked || !isAdmin) return
    void (async () => {
      const b = await biometricInfo()
      if (!b.available) return setUnlocked(true)
      if (await authenticate(t('admin_unlock_prompt'), t('cancel'))) setUnlocked(true)
      else router.back()
    })()
  }, [unlocked, isAdmin, t])

  if (!isAdmin) {
    return (
      <Shell>
        <Empty dark icon="shield" title={t('not_admin')} action={{ label: t('back'), onPress: () => router.back() }} />
      </Shell>
    )
  }
  if (!unlocked) return <Shell><Loader dark /></Shell>

  return (
    <Shell tab={tab} setTab={setTab} openTickets={open.data?.tickets.length || 0}>
      {tab === 'overview' ? <Overview onUsers={() => setTab('users')} /> : tab === 'support' ? <SupportTab /> : <UsersTab />}
    </Shell>
  )
}

function Shell({ children, tab, setTab, openTickets }: { children: React.ReactNode; tab?: Tab; setTab?: (t: Tab) => void; openTickets?: number }) {
  const { t } = useI18n()
  return (
    <View style={{ flex: 1, backgroundColor: C.deepest }}>
      <LinearGradient colors={['rgba(14,108,114,0.8)', 'rgba(14,108,114,0)']} start={{ x: 1, y: 0 }} end={{ x: 0.3, y: 0.4 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(91,61,181,0)', 'rgba(91,61,181,0.3)']} start={{ x: 0.5, y: 0.2 }} end={{ x: 0, y: 0.5 }} style={StyleSheet.absoluteFill} />
      <SafeAreaView edges={['top']} style={{ paddingHorizontal: 16, paddingTop: 8, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconBtn name="back" label={t('back')} tone="dark" size={40} onPress={() => (router.canGoBack() ? router.back() : router.replace('/account'))} />
          <View style={{ flex: 1 }}>
            <T w="bold" size={21} color={C.onDeep} accessibilityRole="header">{t('admin')}</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="shieldCheck" size={13} color={C.violetLight} />
              <T size={11.5} color={C.onDeepMuted}>{t('admin_only')}</T>
            </View>
          </View>
        </View>
        {tab && setTab ? (
          <Segmented<Tab> dark value={tab} onChange={setTab} items={[
            { key: 'overview', label: t('admin_tab_overview') },
            { key: 'support', label: t('admin_tab_support'), badge: openTickets ? String(openTickets) : undefined },
            { key: 'users', label: t('admin_tab_users') },
          ]} />
        ) : null}
      </SafeAreaView>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  )
}

function Overview({ onUsers }: { onUsers: () => void }) {
  const { t, fmtNumber, fmtDate } = useI18n()
  const errText = useErrorText()
  const q = useApi<AdminStats>('/api/admin/stats', { pollMs: 60000 })
  const del = useApi<{ total: number }>('/api/admin/users', { query: { deletion: 'requested', limit: 1 } })
  const s = q.data?.stats
  const signups = q.data?.daily_signups || []
  const maxSign = Math.max(1, ...signups.map(d => d.count))
  if (q.loading && !q.data) return <Loader dark />
  if (q.error && !q.data) return <ErrorView dark message={errText(q.error)} onRetry={q.reload} />
  if (!s) return null
  const down = s.total_instances - s.connected_instances
  const services = [
    { name: t('svc_api'), state: t('svc_ok'), ok: true },
    { name: t('svc_numbers'), state: t('svc_connected_of', { n: fmtNumber(s.connected_instances), total: fmtNumber(s.total_instances) }), ok: down === 0 },
  ]
  const kpis = [
    { label: t('users_total'), value: fmtNumber(s.total_users), sub: t('users_new_month', { n: fmtNumber(s.new_users_this_month) }) },
    { label: t('paid_subscriptions'), value: fmtNumber(s.active_subscriptions), sub: '' },
    { label: t('mrr'), value: fmtNumber(s.mrr, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }), sub: '' },
    { label: t('messages_month'), value: fmtNumber(s.messages_this_month, { notation: 'compact' }), sub: '' },
  ]
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={C.green} />}>
      <View style={glass}>
        <T w="semibold" size={13} color={C.onDeep} style={{ marginBottom: 6 }}>{t('service_status')}</T>
        {services.map(sv => (
          <View key={sv.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: sv.ok ? C.successDot : '#F5B83D' }} />
            <T size={13.5} color={C.onDeep} style={{ flex: 1 }}>{sv.name}</T>
            <T w="semibold" size={12} color={sv.ok ? C.green : '#F5B83D'}>{sv.state}</T>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {kpis.map(k => (
          <LinearGradient key={k.label} colors={['rgba(255,255,255,0.09)', 'rgba(255,255,255,0.03)']} style={{ width: '48%', flexGrow: 1, padding: 14, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(234,247,245,0.1)' }}>
            <T size={12} color={C.onDeepMuted}>{k.label}</T>
            <Ltr w="bold" size={21} color={C.onDeep}>{k.value}</Ltr>
            {k.sub ? <T size={11.5} color={C.green}>{k.sub}</T> : null}
          </LinearGradient>
        ))}
      </View>
      {signups.length ? (
        <View style={glass}>
          <T w="semibold" size={13} color={C.onDeep}>{t('signups_7d')}</T>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 70, marginTop: 10, direction: 'ltr' }}>
            {signups.map(d => (
              <View key={d.date} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <Ltr size={10.5} color={C.onDeepMuted}>{String(d.count)}</Ltr>
                <View style={{ width: '100%', height: Math.max(3, (d.count / maxSign) * 46), borderRadius: 4, backgroundColor: C.teal }} />
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, direction: 'ltr' }}>
            {signups.map(d => <T key={d.date} size={10} color={C.onDeepFaint} style={{ flex: 1, textAlign: 'center' }}>{fmtDate(d.date, { weekday: 'narrow' })}</T>)}
          </View>
        </View>
      ) : null}
      {del.data?.total ? (
        <Pressable accessibilityRole="button" onPress={onUsers} style={{ padding: 14, borderRadius: 20, backgroundColor: 'rgba(220,59,43,0.1)', borderWidth: 1, borderColor: 'rgba(242,140,128,0.35)', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(220,59,43,0.2)', alignItems: 'center', justifyContent: 'center' }}><Icon name="trash" size={18} color="#F6A196" /></View>
          <T w="semibold" size={14} color={C.onDeep} style={{ flex: 1 }}>{`${t('deletion_requests')} · ${fmtNumber(del.data.total)}`}</T>
          <Icon name="chevron" size={16} color={C.onDeep} />
        </Pressable>
      ) : null}
    </ScrollView>
  )
}

function SupportTab() {
  const { t, fmtRelative } = useI18n()
  const errText = useErrorText()
  const [filter, setFilter] = useState<'open' | 'all'>('open')
  const q = useApi<{ tickets: Ticket[] }>('/api/admin/support/tickets', { query: { status: filter }, pollMs: 15000 })
  const list = q.data?.tickets || []
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={C.green} />}>
      <View style={{ flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 8 }}>
        {(['open', 'all'] as const).map(f => (
          <Pressable key={f} accessibilityRole="tab" accessibilityState={{ selected: filter === f }} onPress={() => setFilter(f)} style={{ height: 32, paddingHorizontal: 12, borderRadius: 16, justifyContent: 'center', backgroundColor: filter === f ? 'rgba(234,247,245,0.14)' : 'transparent', borderWidth: filter === f ? 0 : 1, borderColor: C.glassBorder }}>
            <T w={filter === f ? 'semibold' : 'regular'} size={12.5} color={filter === f ? C.onDeep : C.onDeepMuted}>{f === 'open' ? t('tickets_open') : t('tickets_all')}</T>
          </Pressable>
        ))}
      </View>
      {q.loading && !q.data ? <Loader dark /> : q.error && !q.data ? <ErrorView dark message={errText(q.error)} onRetry={q.reload} /> : list.length === 0 ? (
        <Empty dark icon="headset" title={t('no_admin_tickets')} />
      ) : list.map(tk => {
        const st = TICKET_STATUS[tk.status] || TICKET_STATUS.open
        const who = tk.users?.name || tk.users?.email || ''
        const last = [...(tk.support_messages || [])].sort((a, b) => a.created_at.localeCompare(b.created_at)).pop()
        const unanswered = last?.sender_type === 'user'
        return (
          <Pressable
            key={tk.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/admin/ticket/[id]', params: { id: tk.id, subject: tk.subject, number: String(tk.ticket_number), status: tk.status, who } })}
            style={({ pressed }) => [{ flexDirection: 'row', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(234,247,245,0.07)' }, pressed && { backgroundColor: 'rgba(234,247,245,0.04)' }]}
          >
            <View style={{ width: 10, height: 10, marginTop: 6, borderRadius: 5, backgroundColor: unanswered ? C.tealLight : 'transparent' }} />
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <T w="semibold" size={14} color={C.onDeep} numberOfLines={1} style={{ flex: 1 }}>{tk.subject}</T>
                <T size={11.5} color={C.onDeepFaint}>{fmtRelative(tk.updated_at || tk.created_at)}</T>
              </View>
              <T size={12.5} color={C.onDeepMuted} numberOfLines={1}>{t('ticket_from', { name: who, number: tk.ticket_number })}</T>
              {last ? <T size={12.5} color={C.onDeepFaint} numberOfLines={1}>{last.content}</T> : null}
              <View style={{ marginTop: 3 }}><Badge label={t(st.label)} tone="dark" /></View>
            </View>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

function UsersTab() {
  const { t, isRTL } = useI18n()
  const errText = useErrorText()
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [onlyDeletion, setOnlyDeletion] = useState(false)
  useEffect(() => { const id = setTimeout(() => setQ(search.trim()), 350); return () => clearTimeout(id) }, [search])
  const list = useApi<{ users: AdminUser[]; total: number }>('/api/admin/users', { query: { q: q || undefined, limit: 40, deletion: onlyDeletion ? 'requested' : undefined } })
  const users = list.data?.users || []
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={C.green} />}>
      <View style={{ padding: 16, paddingBottom: 6, gap: 10 }}>
        <View style={{ height: 46, borderRadius: 16, borderWidth: 1, borderColor: C.glassBorder, backgroundColor: C.glass, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 }}>
          <Icon name="search" size={18} color={C.onDeepMuted} />
          <TextInput value={search} onChangeText={setSearch} placeholder={t('search_users')} placeholderTextColor={C.onDeepFaint} autoCapitalize="none" accessibilityLabel={t('search_users')} style={[{ flex: 1, height: '100%', fontFamily: F.regular, fontSize: 14, color: C.onDeep }, Platform.OS === 'web' ? ({ textAlign: isRTL ? 'right' : 'left', outlineStyle: 'none' } as object) : null]} />
        </View>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: onlyDeletion }} onPress={() => setOnlyDeletion(v => !v)} style={{ alignSelf: 'flex-start', height: 32, paddingHorizontal: 12, borderRadius: 16, justifyContent: 'center', backgroundColor: onlyDeletion ? 'rgba(220,59,43,0.25)' : 'transparent', borderWidth: 1, borderColor: onlyDeletion ? 'rgba(242,140,128,0.5)' : C.glassBorder }}>
          <T size={12.5} color={onlyDeletion ? '#F6A196' : C.onDeepMuted}>{t('deletion_requests')}</T>
        </Pressable>
      </View>
      {list.loading && !list.data ? <Loader dark /> : list.error && !list.data ? <ErrorView dark message={errText(list.error)} onRetry={list.reload} /> : users.length === 0 ? (
        <Empty dark icon="users" title={t('no_users')} />
      ) : users.map(u => (
        <Pressable
          key={u.id}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/admin/user/[id]', params: { id: u.id } })}
          style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(234,247,245,0.07)' }, pressed && { backgroundColor: 'rgba(234,247,245,0.04)' }]}
        >
          <Avatar name={u.name || u.email} size={42} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <T w="semibold" size={14} color={C.onDeep} numberOfLines={1}>{u.name || '—'}</T>
            <Ltr size={12} color={C.onDeepMuted} numberOfLines={1}>{u.email}</Ltr>
          </View>
          {u.is_active === false ? <Badge label={t('suspended')} tone="danger" /> : (
            <View style={{ height: 24, paddingHorizontal: 9, borderRadius: 12, justifyContent: 'center', backgroundColor: u.plans?.name ? 'rgba(139,224,122,0.14)' : 'rgba(234,247,245,0.08)' }}>
              <T w="bold" size={11.5} color={u.plans?.name ? C.green : C.onDeepMuted} style={{ lineHeight: 16 }}>{u.role === 'admin' ? t('admin_role') : u.plans?.name || t('plan_free')}</T>
            </View>
          )}
        </Pressable>
      ))}
    </ScrollView>
  )
}

const glass = { padding: 14, borderRadius: 20, backgroundColor: 'rgba(234,247,245,0.05)', borderWidth: 1, borderColor: 'rgba(234,247,245,0.1)' } as const

