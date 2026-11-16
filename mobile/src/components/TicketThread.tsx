import React, { useCallback, useRef, useState } from 'react'
import { FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useI18n, type Key } from '@/i18n'
import { api } from '@/lib/api'
import { useErrorText } from '@/lib/useApi'
import { C, F, shadow } from '@/lib/theme'
import type { TicketMessage } from '@/lib/types'
import { Empty, Loader, Ltr, T, useToast } from './ui'
import { Icon } from './Icon'

export const TICKET_STATUS: Record<string, { label: Key; tone: 'brand' | 'warning' | 'success' | 'neutral' }> = {
  open: { label: 't_open', tone: 'brand' },
  pending: { label: 't_pending', tone: 'warning' },
  answered: { label: 't_answered', tone: 'success' },
  resolved: { label: 't_resolved', tone: 'success' },
  closed: { label: 't_closed', tone: 'neutral' },
}

/**
 * A support ticket conversation. `side` decides whose messages are "mine":
 * the customer (sender_type user) or the admin (sender_type admin / ai).
 */
export function TicketThread({ ticketId, side, header, disabled }: { ticketId: string; side: 'customer' | 'admin'; header?: React.ReactNode; disabled?: boolean }) {
  const { t, fmtTime, fmtDate, isRTL } = useI18n()
  const toast = useToast()
  const errText = useErrorText()
  const [msgs, setMsgs] = useState<TicketMessage[] | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const list = useRef<FlatList<TicketMessage>>(null)
  const base = side === 'admin' ? '/api/admin/support/messages' : '/api/support/messages'

  const load = useCallback(async () => {
    try {
      const r = await api<{ messages: TicketMessage[] }>(base, { query: { ticket_id: ticketId } })
      setMsgs(r.messages || [])
      setError(null)
    } catch (e) {
      setError(e)
    }
  }, [base, ticketId])

  useFocusEffect(useCallback(() => {
    void load()
    const id = setInterval(() => void load(), 6000)
    return () => clearInterval(id)
  }, [load]))

  const send = async () => {
    const content = text.trim()
    if (!content) return
    setBusy(true)
    try {
      if (side === 'admin') await api('/api/admin/support/reply', { method: 'POST', body: { ticket_id: ticketId, content } })
      else await api('/api/support/messages', { method: 'POST', body: { ticket_id: ticketId, content } })
      setText('')
      if (side === 'admin') toast(t('reply_sent'))
      await load()
    } catch (e) {
      toast(errText(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  const mine = (m: TicketMessage) => (side === 'admin' ? m.sender_type !== 'user' : m.sender_type === 'user')

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {msgs === null ? (
        error ? <Empty icon="alert" title={errText(error)} action={{ label: t('retry'), onPress: () => void load() }} /> : <Loader />
      ) : (
        <FlatList
          ref={list}
          data={msgs}
          keyExtractor={m => m.id}
          ListHeaderComponent={header ? <View style={{ marginBottom: 6 }}>{header}</View> : undefined}
          contentContainerStyle={{ padding: 14, gap: 10 }}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const me = mine(item)
            return (
              <View style={{ alignSelf: me ? 'flex-end' : 'flex-start', maxWidth: '85%', gap: 3 }}>
                {!me ? <T w="semibold" size={11.5} color={C.muted}>{item.sender_type === 'user' ? '' : t('support_team')}</T> : null}
                <View style={[{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: 18 }, me ? { backgroundColor: C.deep2, borderBottomEndRadius: 6 } : { backgroundColor: C.surface, borderBottomStartRadius: 6, borderWidth: 1, borderColor: C.line }]}>
                  <T size={14.5} color={me ? '#FFFFFF' : C.ink} selectable>{item.content}</T>
                  <Ltr size={10.5} color={me ? 'rgba(255,255,255,0.75)' : C.muted} style={{ alignSelf: 'flex-end', marginTop: 2 }}>{`${fmtDate(item.created_at, { day: 'numeric', month: 'short' })} ${fmtTime(item.created_at)}`}</Ltr>
                </View>
              </View>
            )
          }}
        />
      )}
      {!disabled ? (
        <SafeAreaView edges={['bottom']} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 10, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.surface }}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t('write_reply')}
            placeholderTextColor="#8AA0A2"
            multiline
            accessibilityLabel={t('write_reply')}
            style={[{ flex: 1, minHeight: 48, maxHeight: 140, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 24, backgroundColor: C.bg, fontFamily: F.regular, fontSize: 15, color: C.ink }, Platform.OS === 'web' ? ({ textAlign: isRTL ? 'right' : 'left', outlineStyle: 'none' } as object) : null]}
          />
          <Pressable accessibilityRole="button" accessibilityLabel={t('send')} onPress={send} disabled={busy || !text.trim()} style={[{ width: 48, height: 48, borderRadius: 24, overflow: 'hidden', opacity: busy || !text.trim() ? 0.5 : 1 }, shadow.glow]}>
            <LinearGradient colors={[C.teal, C.deep2]} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="send" size={19} color="#FFFFFF" />
            </LinearGradient>
          </Pressable>
        </SafeAreaView>
      ) : null}
    </KeyboardAvoidingView>
  )
}
