import React, { useEffect, useRef, useState } from 'react'
import { Linking, Pressable, ScrollView, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import * as Clipboard from 'expo-clipboard'
import Svg, { Circle } from 'react-native-svg'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api'
import { useErrorText } from '@/lib/useApi'
import { C, shadow } from '@/lib/theme'
import { Btn, Field, Ltr, Screen, T, TopBar, useToast } from '@/components/ui'
import { Icon } from '@/components/Icon'
import { PulseDot } from '@/components/Floating'

const TTL = 60

export default function Pair() {
  const p = useLocalSearchParams<{ instanceId?: string; phone?: string }>()
  const { t } = useI18n()
  const toast = useToast()
  const errText = useErrorText()
  const [phone, setPhone] = useState(p.phone ? `+${String(p.phone).replace(/\D/g, '')}` : '')
  const [instanceId, setInstanceId] = useState<string | undefined>(p.instanceId || undefined)
  const [code, setCode] = useState<string | null>(null)
  const [left, setLeft] = useState(TTL)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [linked, setLinked] = useState(false)
  const poll = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => { if (poll.current) clearInterval(poll.current) }, [])

  // Countdown
  useEffect(() => {
    if (!code || linked) return
    const id = setInterval(() => setLeft(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [code, linked])

  const watch = (id: string) => {
    if (poll.current) clearInterval(poll.current)
    poll.current = setInterval(async () => {
      try {
        const r = await api<{ status?: string }>('/api/whatsapp/wa-web', { query: { instanceId: id } })
        if (r.status === 'connected') {
          if (poll.current) clearInterval(poll.current)
          setLinked(true)
        }
      } catch { /* keep polling */ }
    }, 3000)
  }

  const getCode = async () => {
    setError(null)
    const digits = phone.replace(/\D/g, '')
    if (!/^\d{8,15}$/.test(digits)) return setError(t('err_invalid_phone'))
    setBusy(true)
    try {
      const r = await api<{ instance?: { id: string }; pairingCode?: string; expiresIn?: number; status?: string }>('/api/whatsapp/wa-web', {
        method: 'POST',
        body: { action: 'pair', phone: digits, instanceId },
      })
      const id = r.instance?.id || instanceId
      if (id) setInstanceId(id)
      if (r.status === 'connected') { setLinked(true); return }
      if (!r.pairingCode) throw new Error('no code')
      setCode(r.pairingCode)
      setLeft(r.expiresIn || TTL)
      if (id) watch(id)
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }

  const openWhatsApp = async () => {
    const url = 'whatsapp://'
    try {
      if (await Linking.canOpenURL(url)) await Linking.openURL(url)
      else await Linking.openURL('https://wa.me/')
    } catch { /* not installed */ }
  }

  const chars = (code || '').replace('-', '').split('')

  return (
    <Screen>
      <TopBar title={t('pair_title')} />
      <ScrollView contentContainerStyle={{ padding: 18, gap: 16 }} keyboardShouldPersistTaps="handled">
        {linked ? (
          <View style={{ alignItems: 'center', gap: 14, paddingVertical: 30 }}>
            <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: C.successBg, alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={36} color={C.success} stroke={2.6} /></View>
            <T w="bold" size={19} style={{ textAlign: 'center' }} accessibilityLiveRegion="polite">{t('linked')}</T>
            <Btn title={t('done')} variant="teal" onPress={() => router.replace('/numbers')} style={{ alignSelf: 'stretch' }} />
          </View>
        ) : !code ? (
          <>
            <Field label={t('pair_phone_label')} icon="whatsapp" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" placeholder="+966 50 123 4567" ltr error={error} onSubmitEditing={getCode} />
            <Btn title={t('get_code')} variant="teal" onPress={getCode} loading={busy} />
            <Steps />
          </>
        ) : (
          <>
            <View style={[{ padding: 18, borderRadius: 26, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, gap: 14 }, shadow.card]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <T w="semibold" size={14} color={C.muted}>{t('pair_code_label')}</T>
                <Countdown left={left} />
              </View>
              <View accessible accessibilityLabel={`${t('pair_code_label')}: ${chars.join(' ')}`} style={{ flexDirection: 'row', gap: 6, direction: 'ltr', justifyContent: 'center' }}>
                {chars.map((ch, i) => (
                  <React.Fragment key={i}>
                    {i === 4 ? <View style={{ width: 10, alignItems: 'center', justifyContent: 'center' }}><T w="bold" size={22} color={C.muted}>-</T></View> : null}
                    <View style={{ width: 34, height: 50, borderRadius: 12, backgroundColor: C.deep, alignItems: 'center', justifyContent: 'center' }}>
                      <T w="bold" size={22} color={i < 4 ? C.onDeep : C.green} style={{ lineHeight: 30 }}>{ch}</T>
                    </View>
                  </React.Fragment>
                ))}
              </View>
              {left === 0 ? <T size={13} color={C.danger} style={{ textAlign: 'center' }}>{t('code_expired')}</T> : null}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Btn title={t('copy')} icon="copy" variant="outline" size="md" style={{ flex: 1 }} onPress={async () => { await Clipboard.setStringAsync((code || '').replace('-', '')); toast(t('copied')) }} />
                {left === 0 ? <Btn title={t('new_code')} icon="refresh" variant="dark" size="md" style={{ flex: 1 }} onPress={getCode} loading={busy} /> : null}
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
              <PulseDot color={C.teal} />
              <T size={13} color={C.muted}>{t('waiting_link')}</T>
            </View>
            <Steps />
            <Btn title={t('open_whatsapp')} icon="whatsapp" onPress={openWhatsApp} />
          </>
        )}
        {!linked ? (
          <Pressable accessibilityRole="link" onPress={() => router.replace({ pathname: '/numbers/qr', params: instanceId ? { instanceId } : {} })} style={{ alignSelf: 'center', padding: 8 }}>
            <T w="semibold" size={14} color={C.chipInk}>{t('use_qr_instead')}</T>
          </Pressable>
        ) : null}
      </ScrollView>
    </Screen>
  )
}

function Steps() {
  const { t } = useI18n()
  return (
    <View style={{ gap: 12 }}>
      {(['pair_step_1', 'pair_step_2', 'pair_step_3'] as const).map((k, i) => (
        <View key={k} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: C.chip, alignItems: 'center', justifyContent: 'center' }}>
            <T w="bold" size={12.5} color={C.chipInk} style={{ lineHeight: 17 }}>{String(i + 1)}</T>
          </View>
          <T size={14} style={{ flex: 1 }}>{t(k)}</T>
        </View>
      ))}
    </View>
  )
}

function Countdown({ left }: { left: number }) {
  const { t } = useI18n()
  const r = 18
  const c = 2 * Math.PI * r
  return (
    <View accessibilityLabel={t('code_expires', { s: left })} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={44} height={44} viewBox="0 0 44 44" style={{ position: 'absolute' }}>
        <Circle cx={22} cy={22} r={r} fill="none" stroke={C.lineSoft} strokeWidth={4} />
        <Circle cx={22} cy={22} r={r} fill="none" stroke={left > 10 ? C.teal : C.dangerDot} strokeWidth={4} strokeLinecap="round" strokeDasharray={`${c}`} strokeDashoffset={c * (1 - left / TTL)} transform="rotate(-90 22 22)" />
      </Svg>
      <Ltr w="bold" size={11}>{`0:${String(left).padStart(2, '0')}`}</Ltr>
    </View>
  )
}
