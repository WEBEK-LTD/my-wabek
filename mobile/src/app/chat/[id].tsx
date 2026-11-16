import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActionSheetIOS, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import * as WebBrowser from 'expo-web-browser'
import { useI18n } from '@/i18n'
import { useAuth } from '@/lib/auth'
import { api, ApiError } from '@/lib/api'
import { useErrorText } from '@/lib/useApi'
import { cachedConversation } from '@/lib/convCache'
import { C, F, shadow } from '@/lib/theme'
import { type Conversation, type Instance, type Message, type Template, fmtPhone, isCloud, isConnected } from '@/lib/types'
import { Avatar, Btn, Empty, Field, IconBtn, Loader, Ltr, T, useToast } from '@/components/ui'
import { Icon, Ticks } from '@/components/Icon'
import { mediaLabel } from '@/components/ConversationRow'

const DAY = 24 * 60 * 60 * 1000

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { t, fmtTime, fmtDate, isRTL } = useI18n()
  const { me } = useAuth()
  const toast = useToast()
  const errText = useErrorText()
  const [conv, setConv] = useState<Conversation | null>(() => cachedConversation(String(id)))
  const [instance, setInstance] = useState<Instance | null>(null)
  const [messages, setMessages] = useState<Message[] | null>(null)
  const [loadError, setLoadError] = useState<unknown>(null)
  const [limit, setLimit] = useState(50)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const [tplOpen, setTplOpen] = useState(false)
  const listRef = useRef<FlatList<Message>>(null)

  const contactName = conv?.contacts?.name || conv?.contacts?.phone || ''
  const phone = conv?.contacts?.phone || ''

  // Unknown conversation (e.g. opened from a cold start): back to the list.
  useEffect(() => {
    if (!conv) router.replace('/inbox')
  }, [conv])

  useEffect(() => {
    if (!conv?.instance_id) return
    api<{ instance: Instance }>(`/api/whatsapp/instances/${conv.instance_id}`).then(r => setInstance(r.instance)).catch(() => setInstance(null))
  }, [conv?.instance_id])

  const load = useCallback(async () => {
    if (!conv) return
    try {
      const r = await api<{ messages: Message[] }>('/api/whatsapp/messages', { query: { contact_id: conv.contact_id, instance_id: conv.instance_id || undefined, limit } })
      setMessages(prev => {
        const pending = (prev || []).filter(m => m.local)
        return [...(r.messages || []), ...pending.filter(p => !(r.messages || []).some(m => m.content === p.content && m.direction === 'outbound' && Math.abs(new Date(m.created_at).getTime() - new Date(p.created_at).getTime()) < 120000))]
      })
      setLoadError(null)
    } catch (e) {
      setLoadError(e)
    }
  }, [conv, limit])

  useEffect(() => { void load() }, [load])
  useFocusEffect(useCallback(() => {
    const iv = setInterval(() => void load(), 4000)
    return () => clearInterval(iv)
  }, [load]))

  const lastInbound = useMemo(() => [...(messages || [])].reverse().find(m => m.direction === 'inbound'), [messages])
  const cloud = isCloud(instance)
  const windowClosed = cloud && (!lastInbound || Date.now() - new Date(lastInbound.created_at).getTime() > DAY)
  const numberDown = !!instance && !isConnected(instance.status)

  const send = async (payload: Record<string, unknown>, optimistic?: string) => {
    if (!conv?.instance_id || !phone) return
    const temp: Message | null = optimistic
      ? { id: `local-${Date.now()}`, contact_id: conv.contact_id, instance_id: conv.instance_id, direction: 'outbound', type: 'text', content: optimistic, status: 'pending', created_at: new Date().toISOString(), local: 'sending' }
      : null
    if (temp) setMessages(m => [...(m || []), temp])
    setSending(true)
    try {
      await api('/api/whatsapp/chat-send', { method: 'POST', body: { instance_id: conv.instance_id, to: phone, contact_id: conv.contact_id, ...payload } })
      if (temp) setMessages(m => (m || []).filter(x => x.id !== temp.id))
      await load()
      return true
    } catch (e) {
      if (temp) setMessages(m => (m || []).map(x => (x.id === temp.id ? { ...x, local: 'failed', status: 'failed' } : x)))
      toast(e instanceof ApiError && e.code === 'templates_cloud_only' ? t('error_generic') : errText(e), 'error')
      return false
    } finally {
      setSending(false)
    }
  }

  const sendText = async () => {
    const body = text.trim()
    if (!body) return
    setText('')
    setSuggestion(null)
    const ok = await send({ text: body }, body)
    if (!ok) setText(body)
  }

  const attach = async (kind: 'image' | 'document') => {
    try {
      let file: { uri: string; name: string; mime: string } | null = null
      if (kind === 'image') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
        if (!perm.granted) return
        const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.85 })
        if (r.canceled || !r.assets?.[0]) return
        const a = r.assets[0]
        file = { uri: a.uri, name: a.fileName || `photo-${Date.now()}.jpg`, mime: a.mimeType || (a.type === 'video' ? 'video/mp4' : 'image/jpeg') }
      } else {
        const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false })
        if (r.canceled || !r.assets?.[0]) return
        const a = r.assets[0]
        file = { uri: a.uri, name: a.name, mime: a.mimeType || 'application/octet-stream' }
      }
      toast(t('uploading'))
      const form = new FormData()
      if (Platform.OS === 'web') {
        const blob = await (await fetch(file.uri)).blob()
        form.append('file', blob, file.name)
      } else {
        form.append('file', { uri: file.uri, name: file.name, type: file.mime } as unknown as Blob)
      }
      const up = await api<{ url: string; mimeType: string; filename: string }>('/api/whatsapp/chat-upload', { method: 'POST', form })
      const mt = up.mimeType.startsWith('image/') ? 'image' : up.mimeType.startsWith('video/') ? 'video' : up.mimeType.startsWith('audio/') ? 'audio' : 'document'
      await send({ media_url: up.url, media_type: mt, media_mime_type: up.mimeType, media_filename: up.filename, text: text.trim() || undefined })
      setText('')
    } catch (e) {
      toast(errText(e), 'error')
    }
  }

  const openAttach = () => {
    const options = [t('photo_library'), t('document'), t('cancel')]
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: 2 }, i => {
        if (i === 0) void attach('image')
        if (i === 1) void attach('document')
      })
    } else {
      Alert.alert(t('attach'), undefined, [
        { text: t('photo_library'), onPress: () => void attach('image') },
        { text: t('document'), onPress: () => void attach('document') },
        { text: t('cancel'), style: 'cancel' },
      ])
    }
  }

  const suggest = async () => {
    if (!conv) return
    setSuggesting(true)
    try {
      const r = await api<{ suggestion?: string }>('/api/ai/suggest', { method: 'POST', body: { conversation_id: conv.id } })
      if (r.suggestion) setSuggestion(r.suggestion.trim())
    } catch (e) {
      toast(errText(e), 'error')
    } finally {
      setSuggesting(false)
    }
  }

  const update = async (patch: Record<string, unknown>) => {
    if (!conv) return
    try {
      const r = await api<{ conversation: Conversation }>(`/api/inbox/${conv.id}`, { method: 'PUT', body: patch })
      setConv(c => (c ? { ...c, ...r.conversation, contacts: c.contacts, whatsapp_instances: c.whatsapp_instances, last_message: c.last_message, assigned_user: patch.assigned_to === null ? null : c.assigned_user } : c))
      toast(t('saved'))
    } catch (e) {
      toast(errText(e), 'error')
    }
  }

  const options = () => {
    if (!conv) return
    const mine = conv.assigned_to === me?.id
    const items: { label: string; run: () => void; destructive?: boolean }[] = [
      conv.status === 'resolved' ? { label: t('reopen'), run: () => void update({ status: 'open' }) } : { label: t('mark_resolved'), run: () => void update({ status: 'resolved' }) },
      mine ? { label: t('unassign'), run: () => void update({ assigned_to: null }) } : { label: t('assign_to_me'), run: () => void update({ assigned_to: me?.id }) },
    ]
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ options: [...items.map(i => i.label), t('cancel')], cancelButtonIndex: items.length, title: t('chat_options') }, i => items[i]?.run())
    } else {
      Alert.alert(t('chat_options'), undefined, [...items.map(i => ({ text: i.label, onPress: i.run })), { text: t('cancel'), style: 'cancel' as const }])
    }
  }

  if (!conv) return null

  const data = messages || []
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.lineSoft }}>
      <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.line }]}>
        <IconBtn name="back" label={t('back')} size={40} onPress={() => (router.canGoBack() ? router.back() : router.replace('/inbox'))} />
        <Avatar name={contactName} size={42} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T w="semibold" size={15.5} numberOfLines={1}>{contactName}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {instance ? (
              <View style={{ height: 16, paddingHorizontal: 5, borderRadius: 5, backgroundColor: cloud ? C.blueBg : C.chip, justifyContent: 'center' }}>
                <T w="bold" size={9.5} color={cloud ? C.blue : C.chipInk} style={{ lineHeight: 13 }}>{cloud ? t('type_cloud') : t('type_web')}</T>
              </View>
            ) : null}
            <Ltr size={12} color={C.muted} numberOfLines={1}>{fmtPhone(phone)}</Ltr>
          </View>
        </View>
        <IconBtn name="more" label={t('chat_options')} size={40} onPress={options} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        {messages === null ? (
          loadError ? <Empty icon="alert" title={errText(loadError)} action={{ label: t('retry'), onPress: () => void load() }} /> : <Loader />
        ) : (
          <FlatList
            ref={listRef}
            data={data}
            keyExtractor={m => m.id}
            contentContainerStyle={{ padding: 12, gap: 8 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListHeaderComponent={data.length >= limit ? (
              <Pressable accessibilityRole="button" onPress={() => setLimit(l => l + 50)} style={{ alignSelf: 'center', padding: 8 }}>
                <T w="semibold" size={12.5} color={C.chipInk}>{t('load_earlier')}</T>
              </Pressable>
            ) : undefined}
            renderItem={({ item, index }) => {
              const prev = data[index - 1]
              const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(item.created_at).toDateString()
              return (
                <>
                  {newDay ? (
                    <View style={{ alignSelf: 'center', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.85)', marginVertical: 4 }}>
                      <T size={11.5} color={C.muted}>{new Date(item.created_at).toDateString() === new Date().toDateString() ? t('today') : fmtDate(item.created_at)}</T>
                    </View>
                  ) : null}
                  <Bubble m={item} time={fmtTime(item.created_at)} onRetry={item.local === 'failed' ? () => { setMessages(ms => (ms || []).filter(x => x.id !== item.id)); void send({ text: item.content }, item.content || '') } : undefined} />
                </>
              )
            }}
          />
        )}

        {numberDown ? (
          <View style={{ marginHorizontal: 12, marginBottom: 6, padding: 10, borderRadius: 14, backgroundColor: C.dangerBg, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="unlink" size={16} color={C.danger} />
            <T size={12.5} color={C.danger} style={{ flex: 1 }}>{t('no_number_for_chat')}</T>
          </View>
        ) : null}

        {suggestion ? (
          <View style={{ marginHorizontal: 12, marginBottom: 6, padding: 12, borderRadius: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: '#BFE6DF', gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="sparkle" size={14} color={C.chipInk} />
              <T w="semibold" size={12} color={C.chipInk}>{t('suggest_reply')}</T>
              <View style={{ flex: 1 }} />
              <Pressable accessibilityRole="button" accessibilityLabel={t('close')} onPress={() => setSuggestion(null)} hitSlop={10}><Icon name="close" size={16} color={C.muted} /></Pressable>
            </View>
            <T size={13.5}>{suggestion}</T>
            <Btn title={t('use_suggestion')} size="sm" variant="dark" onPress={() => { setText(suggestion); setSuggestion(null) }} style={{ alignSelf: 'flex-start' }} />
          </View>
        ) : null}

        {windowClosed ? (
          <View style={{ marginHorizontal: 12, marginBottom: 6, padding: 12, borderRadius: 16, backgroundColor: C.warningBg, gap: 10 }}>
            <T size={13} color={C.warning}>{t('window_closed')}</T>
            <Btn title={t('send_template')} icon="template" size="sm" variant="dark" onPress={() => setTplOpen(true)} style={{ alignSelf: 'flex-start' }} />
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 6 }}>
            <Pressable accessibilityRole="button" onPress={suggest} disabled={suggesting} style={{ height: 32, paddingHorizontal: 10, borderRadius: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: '#BFE6DF', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="sparkle" size={13} color={C.chipInk} stroke={2.2} />
              <T w="semibold" size={12} color={C.chipInk}>{suggesting ? t('ai_thinking') : t('suggest_reply')}</T>
            </Pressable>
            {cloud ? (
              <Pressable accessibilityRole="button" onPress={() => setTplOpen(true)} style={{ height: 32, paddingHorizontal: 10, borderRadius: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="template" size={13} color={C.ink} />
                <T size={12}>{t('send_template')}</T>
              </Pressable>
            ) : null}
          </View>
        )}

        <SafeAreaView edges={['bottom']} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 2, paddingBottom: 10 }}>
          <View style={{ flex: 1, minHeight: 50, borderRadius: 25, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 6 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('attach')} onPress={openAttach} disabled={windowClosed || numberDown} style={{ width: 40, height: 48, alignItems: 'center', justifyContent: 'center', opacity: windowClosed || numberDown ? 0.4 : 1 }}>
              <Icon name="attach" size={20} color={C.muted} />
            </Pressable>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={t('type_message')}
              placeholderTextColor="#8AA0A2"
              multiline
              editable={!windowClosed && !numberDown}
              accessibilityLabel={t('type_message')}
              style={[{ flex: 1, minHeight: 48, maxHeight: 130, paddingVertical: 13, fontFamily: F.regular, fontSize: 15, color: C.ink }, Platform.OS === 'web' ? { textAlign: isRTL ? 'right' : 'left', outlineStyle: 'none' } as object : null]}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('send')}
            onPress={sendText}
            disabled={!text.trim() || sending || windowClosed || numberDown}
            style={[{ width: 50, height: 50, borderRadius: 25, overflow: 'hidden', opacity: !text.trim() || windowClosed || numberDown ? 0.5 : 1 }, shadow.glow]}
          >
            <LinearGradient colors={[C.teal, C.deep2]} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="send" size={20} color="#FFFFFF" />
            </LinearGradient>
          </Pressable>
        </SafeAreaView>
      </KeyboardAvoidingView>

      {tplOpen && conv.instance_id ? (
        <TemplateSheet
          instanceId={conv.instance_id}
          onClose={() => setTplOpen(false)}
          onSend={async (tpl, params) => {
            const ok = await send({ template: { name: tpl.name, language: tpl.language, params } })
            if (ok) setTplOpen(false)
          }}
        />
      ) : null}
    </SafeAreaView>
  )
}

function Bubble({ m, time, onRetry }: { m: Message; time: string; onRetry?: () => void }) {
  const { t } = useI18n()
  const out = m.direction === 'outbound'
  const ml = mediaLabel(m.type)
  const isImage = m.type === 'image' && !!m.media_url
  const body = (
    <>
      {isImage ? (
        <Image source={{ uri: m.media_url as string }} style={{ width: 220, height: 220, borderRadius: 12, marginBottom: m.content ? 6 : 2 }} contentFit="cover" accessibilityLabel={t('media_photo')} />
      ) : ml && m.media_url ? (
        <Pressable accessibilityRole="link" onPress={() => void WebBrowser.openBrowserAsync(m.media_url as string)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: m.content ? 6 : 2 }}>
          <Icon name={m.type === 'document' ? 'doc' : 'attach'} size={18} color={out ? '#FFFFFF' : C.chipInk} />
          <T w="semibold" size={13.5} color={out ? '#FFFFFF' : C.chipInk} numberOfLines={1}>{m.media_filename || t(ml)}</T>
        </Pressable>
      ) : null}
      {m.content ? <T size={14.5} color={out ? '#FFFFFF' : C.ink} selectable>{m.content}</T> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 2 }}>
        <Ltr size={10.5} color={out ? 'rgba(255,255,255,0.8)' : C.muted}>{time}</Ltr>
        {out ? <Ticks status={m.local === 'sending' ? 'sent' : m.status || 'sent'} color="rgba(255,255,255,0.85)" /> : null}
      </View>
    </>
  )
  // The "tail" corner sits at the bottom, on the bubble's own side (logical start/end follow the language).
  const radius = { borderRadius: 18, ...(out ? { borderBottomEndRadius: 6 } : { borderBottomStartRadius: 6 }) }
  return (
    <View style={{ alignSelf: out ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
      {out ? (
        <LinearGradient colors={m.local === 'failed' ? [C.dangerDot, C.danger] : ['#0E8F96', C.deep2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6, opacity: m.local === 'sending' ? 0.7 : 1 }, radius]}>
          {body}
        </LinearGradient>
      ) : (
        <View style={[{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6, backgroundColor: C.surface }, radius]}>{body}</View>
      )}
      {onRetry ? (
        <Pressable accessibilityRole="button" onPress={onRetry} style={{ alignSelf: 'flex-end', marginTop: 4, flexDirection: 'row', gap: 4, alignItems: 'center' }}>
          <Icon name="refresh" size={13} color={C.danger} />
          <T w="semibold" size={12} color={C.danger}>{t('send_failed')} {t('retry')}</T>
        </Pressable>
      ) : null}
    </View>
  )
}

function TemplateSheet({ instanceId, onClose, onSend }: { instanceId: string; onClose: () => void; onSend: (tpl: Template, params: string[] | Record<string, string>) => Promise<void> }) {
  const { t } = useI18n()
  const errText = useErrorText()
  const [list, setList] = useState<Template[] | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [pick, setPick] = useState<Template | null>(null)
  const [values, setValues] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api<{ templates: Template[] }>('/api/whatsapp/templates', { query: { instance_id: instanceId } })
      .then(r => setList((r.templates || []).filter(x => x.status === 'APPROVED')))
      .catch(e => setError(e))
  }, [instanceId])

  const names = pick ? (pick.parameterFormat === 'NAMED' ? pick.paramNames : Array.from({ length: pick.variableCount }, (_, i) => String(i + 1))) : []

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel={t('close')} onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(2,26,29,0.55)' }} />
      <SafeAreaView edges={['bottom']} style={{ maxHeight: '80%', backgroundColor: C.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20, gap: 12 }}>
        <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: C.line }} />
        <T w="bold" size={18} accessibilityRole="header">{pick ? pick.name : t('choose_template')}</T>
        <ScrollView contentContainerStyle={{ gap: 10 }}>
          {error ? <T color={C.danger}>{errText(error)}</T> : list === null ? <Loader /> : pick ? (
            <>
              <View style={{ padding: 12, borderRadius: 14, backgroundColor: C.bg }}><T size={13.5}>{pick.body}</T></View>
              {names.map((n, i) => (
                <Field key={n} label={pick.parameterFormat === 'NAMED' ? n : t('template_value', { n })} value={values[i] || ''} onChangeText={v => setValues(vs => { const c = [...vs]; c[i] = v; return c })} />
              ))}
              <Btn
                title={t('send')}
                variant="teal"
                loading={busy}
                disabled={names.some((_, i) => !(values[i] || '').trim())}
                onPress={async () => {
                  setBusy(true)
                  const params = pick.parameterFormat === 'NAMED' ? Object.fromEntries(names.map((n, i) => [n, values[i].trim()])) : names.map((_, i) => values[i].trim())
                  await onSend(pick, params)
                  setBusy(false)
                }}
              />
              <Btn title={t('back')} variant="ghost" size="md" onPress={() => { setPick(null); setValues([]) }} />
            </>
          ) : list.length === 0 ? (
            <T color={C.muted}>{t('no_templates')}</T>
          ) : (
            list.map(tpl => (
              <Pressable key={`${tpl.name}-${tpl.language}`} accessibilityRole="button" onPress={() => { setPick(tpl); setValues([]) }} style={{ padding: 14, borderRadius: 16, borderWidth: 1, borderColor: C.line, gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Ltr w="semibold" size={14}>{tpl.name}</Ltr>
                  <Ltr size={12} color={C.muted}>{tpl.language}</Ltr>
                </View>
                <T size={12.5} color={C.muted} numberOfLines={2}>{tpl.body}</T>
              </Pressable>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}
