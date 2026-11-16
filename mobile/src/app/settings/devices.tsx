import React from 'react'
import { ScrollView, View } from 'react-native'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api'
import { useApi, useErrorText } from '@/lib/useApi'
import { C } from '@/lib/theme'
import { Card, Empty, ErrorView, IconBtn, Loader, Screen, T, TopBar, useToast } from '@/components/ui'
import { Icon } from '@/components/Icon'

type Device = { id: string; device_name?: string | null; ip_address?: string | null; last_used_at?: string | null; created_at?: string | null }

export default function Devices() {
  const { t, fmtRelative } = useI18n()
  const toast = useToast()
  const errText = useErrorText()
  const q = useApi<{ devices: Device[] }>('/api/settings/devices')
  const list = q.data?.devices || []

  const remove = async (id: string) => {
    try {
      await api(`/api/settings/devices/${id}`, { method: 'DELETE' })
      q.setData(d => (d ? { devices: d.devices.filter(x => x.id !== id) } : d))
    } catch (e) {
      toast(errText(e), 'error')
    }
  }

  return (
    <Screen>
      <TopBar title={t('devices')} />
      {q.loading ? <Loader /> : q.error ? <ErrorView message={errText(q.error)} onRetry={q.reload} /> : (
        <ScrollView contentContainerStyle={{ padding: 18 }}>
          {list.length === 0 ? <Empty icon="devices" title={t('no_devices')} /> : (
            <Card padded={false} style={{ overflow: 'hidden' }}>
              {list.map((d, i) => (
                <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: i < list.length - 1 ? 1 : 0, borderBottomColor: C.lineSoft }}>
                  <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.chip, alignItems: 'center', justifyContent: 'center' }}><Icon name="devices" size={18} color={C.chipInk} /></View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T size={14.5} numberOfLines={1}>{d.device_name || '—'}</T>
                    <T size={12} color={C.muted}>{t('last_active', { when: fmtRelative(d.last_used_at || d.created_at) })}</T>
                  </View>
                  <IconBtn name="trash" label={t('delete')} size={38} onPress={() => void remove(d.id)} />
                </View>
              ))}
            </Card>
          )}
        </ScrollView>
      )}
    </Screen>
  )
}
