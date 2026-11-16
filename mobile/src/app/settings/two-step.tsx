import React, { useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { useI18n, type Key } from '@/i18n'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { useErrorText } from '@/lib/useApi'
import { C } from '@/lib/theme'
import { Card, Screen, T, TopBar, useToast } from '@/components/ui'
import { Icon } from '@/components/Icon'

type Mode = 'disabled' | 'new_device' | 'always'
const MODES: { key: Mode; label: Key }[] = [
  { key: 'disabled', label: 'two_step_off' },
  { key: 'new_device', label: 'two_step_new' },
  { key: 'always', label: 'two_step_always' },
]

export default function TwoStep() {
  const { t } = useI18n()
  const { me, refreshMe } = useAuth()
  const toast = useToast()
  const errText = useErrorText()
  const [mode, setMode] = useState<Mode>((me?.otp_mode as Mode) || 'disabled')
  const [busy, setBusy] = useState<Mode | null>(null)

  const choose = async (m: Mode) => {
    if (m === mode) return
    setBusy(m)
    try {
      await api('/api/settings/security', { method: 'PUT', body: { otp_mode: m } })
      setMode(m)
      await refreshMe()
      toast(t('saved'))
    } catch (e) {
      toast(errText(e), 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Screen>
      <TopBar title={t('two_step')} />
      <ScrollView contentContainerStyle={{ padding: 18 }}>
        <Card padded={false} style={{ overflow: 'hidden' }}>
          {MODES.map((m, i) => {
            const on = m.key === mode
            return (
              <Pressable
                key={m.key}
                accessibilityRole="radio"
                accessibilityState={{ checked: on, busy: busy === m.key }}
                onPress={() => void choose(m.key)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: i < MODES.length - 1 ? 1 : 0, borderBottomColor: C.lineSoft }}
              >
                <T size={15} style={{ flex: 1 }}>{t(m.label)}</T>
                <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: on ? C.teal : C.lineStrong, backgroundColor: on ? C.teal : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  {on ? <Icon name="check" size={14} color="#FFFFFF" stroke={3} /> : null}
                </View>
              </Pressable>
            )
          })}
        </Card>
      </ScrollView>
    </Screen>
  )
}
