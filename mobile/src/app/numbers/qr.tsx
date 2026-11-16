import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Image } from 'expo-image'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api'
import { useErrorText } from '@/lib/useApi'
import { C, shadow } from '@/lib/theme'
import { Btn, ErrorView, Loader, Screen, T, TopBar } from '@/components/ui'
import { Icon } from '@/components/Icon'
import { PulseDot } from '@/components/Floating'

export default function Qr() {
  const p = useLocalSearchParams<{ instanceId?: string }>()
  const { t } = useI18n()
  const errText = useErrorText()
  const [instanceId, setInstanceId] = useState<string | undefined>(p.instanceId || undefined)
  const [qr, setQr] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [linked, setLinked] = useState(false)
  const [busy, setBusy] = useState(false)
  const started = useRef(false)

  const start = useCallback(async () => {
    setError(null)
    setBusy(true)
    try {
      if (instanceId) {
        const r = await api<{ qrCode?: string | null; status?: string }>('/api/whatsapp/wa-web', { method: 'POST', body: { action: 'request_qr', instanceId } })
        if (r.status === 'connected') setLinked(true)
        if (r.qrCode) setQr(r.qrCode)
      } else {
        const r = await api<{ instance?: { id: string }; qrCode?: string }>('/api/whatsapp/wa-web', { method: 'POST', body: { action: 'create' } })
        if (r.instance?.id) setInstanceId(r.instance.id)
        if (r.qrCode) setQr(r.qrCode)
      }
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }, [instanceId])

  useEffect(() => {
    if (started.current) return
    started.current = true
    void start()
  }, [start])

  // Poll for a fresh QR and the connection.
  useEffect(() => {
    if (!instanceId || linked) return
    const id = setInterval(async () => {
      try {
        const r = await api<{ status?: string; qrCode?: string | null }>('/api/whatsapp/wa-web', { query: { instanceId } })
        if (r.status === 'connected') setLinked(true)
        else if (r.qrCode) setQr(r.qrCode)
      } catch { /* keep polling */ }
    }, 3000)
    return () => clearInterval(id)
  }, [instanceId, linked])

  return (
    <Screen>
      <TopBar title={t('qr_title')} />
      <ScrollView contentContainerStyle={{ padding: 18, gap: 16, alignItems: 'stretch' }}>
        {linked ? (
          <View style={{ alignItems: 'center', gap: 14, paddingVertical: 30 }}>
            <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: C.successBg, alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={36} color={C.success} stroke={2.6} /></View>
            <T w="bold" size={19} style={{ textAlign: 'center' }} accessibilityLiveRegion="polite">{t('linked')}</T>
            <Btn title={t('done')} variant="teal" onPress={() => router.replace('/numbers')} style={{ alignSelf: 'stretch' }} />
          </View>
        ) : error ? (
          <ErrorView message={errText(error)} onRetry={start} />
        ) : (
          <>
            <T size={14} color={C.muted}>{t('qr_step')}</T>
            <View style={[{ alignSelf: 'center', width: 290, height: 290, borderRadius: 26, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }, shadow.card]}>
              {qr ? (
                <Image source={{ uri: qr }} style={{ width: 260, height: 260 }} contentFit="contain" accessibilityLabel={t('qr_title')} />
              ) : (
                <View style={{ alignItems: 'center', gap: 10 }}><Loader /><T size={13} color={C.muted}>{t('qr_loading')}</T></View>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
              <PulseDot color={C.teal} />
              <T size={13} color={C.muted}>{t('waiting_link')}</T>
            </View>
            <Btn title={t('qr_refresh')} icon="refresh" variant="outline" size="md" onPress={start} loading={busy} />
          </>
        )}
      </ScrollView>
    </Screen>
  )
}
