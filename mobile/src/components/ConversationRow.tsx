import React from 'react'
import { Pressable, View } from 'react-native'
import { router } from 'expo-router'
import { useI18n, type Key } from '@/i18n'
import { useAuth } from '@/lib/auth'
import { C } from '@/lib/theme'
import { type Conversation, isCloud } from '@/lib/types'
import { rememberConversation } from '@/lib/convCache'
import { Avatar, T } from './ui'

export function mediaLabel(type: string | null | undefined): Key | null {
  switch (type) {
    case 'image': return 'media_photo'
    case 'video': return 'media_video'
    case 'audio': case 'voice': case 'ptt': return 'media_audio'
    case 'document': return 'media_document'
    case 'text': case null: case undefined: case '': case 'template': return null
    default: return 'media_other'
  }
}

export function ConversationRow({ c, last, compact }: { c: Conversation; last?: boolean; compact?: boolean }) {
  const { t, fmtRelative } = useI18n()
  const { me } = useAuth()
  const name = c.contacts?.name || c.contacts?.phone || '—'
  const lm = c.last_message
  const ml = mediaLabel(lm?.type)
  const preview = (lm?.direction === 'outbound' ? t('you_prefix') : '') + (lm?.content?.trim() || (ml ? t(ml) : ''))
  const waitingLong = lm?.direction === 'inbound' && Date.now() - new Date(lm.created_at).getTime() > 5 * 60 * 1000
  const mine = !!c.assigned_to && (c.assigned_to === me?.id)
  const inst = c.whatsapp_instances
  const unread = Number(c.unread_count || 0)

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${preview}`}
      onPress={() => { rememberConversation(c); router.push({ pathname: '/chat/[id]', params: { id: c.id } }) }}
      style={({ pressed }) => [{ flexDirection: 'row', gap: 12, paddingVertical: compact ? 11 : 12, paddingHorizontal: compact ? 14 : 18, borderBottomWidth: last ? 0 : 1, borderBottomColor: C.lineSoft }, pressed && { backgroundColor: C.surface2 }]}
    >
      <Avatar name={name} size={compact ? 42 : 48} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <T w="semibold" size={14.5} numberOfLines={1} style={{ flexShrink: 1 }}>{name}</T>
          {inst && !compact ? (
            <View style={{ height: 18, paddingHorizontal: 6, borderRadius: 6, justifyContent: 'center', backgroundColor: isCloud(inst) ? C.blueBg : C.chip }}>
              <T w="bold" size={10} color={isCloud(inst) ? C.blue : C.chipInk} style={{ lineHeight: 14 }} numberOfLines={1}>{inst.display_name || inst.phone_number || ''}</T>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          <T size={11.5} w={waitingLong ? 'semibold' : 'regular'} color={waitingLong ? '#B4501F' : C.muted}>{fmtRelative(c.last_message_at || lm?.created_at)}</T>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <T size={13} color={C.muted} numberOfLines={1} style={{ flex: 1 }}>{preview}</T>
          {unread > 0 ? (
            <View style={{ minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' }}>
              <T w="bold" size={11} color="#FFFFFF" style={{ lineHeight: 15 }}>{String(unread)}</T>
            </View>
          ) : null}
        </View>
        {!compact && (c.assigned_user || (c.contacts?.tags || []).length) ? (
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
            {(c.contacts?.tags || []).slice(0, 2).map(tag => (
              <View key={tag} style={{ height: 20, paddingHorizontal: 8, borderRadius: 10, backgroundColor: C.warningBg, justifyContent: 'center' }}>
                <T w="semibold" size={11} color={C.warning} style={{ lineHeight: 15 }}>{tag}</T>
              </View>
            ))}
            {c.assigned_user ? (
              <View style={{ height: 20, paddingHorizontal: 8, borderRadius: 10, backgroundColor: C.bg, justifyContent: 'center' }}>
                <T size={11} color={C.muted} style={{ lineHeight: 15 }}>{mine ? t('assigned_you') : t('assigned_to', { name: c.assigned_user.name || c.assigned_user.email })}</T>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  )
}
