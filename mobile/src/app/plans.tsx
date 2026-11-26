import React, { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { useI18n } from '@/i18n'
import { useAuth } from '@/lib/auth'
import { API_URL } from '@/lib/api'
import { useApi, useErrorText } from '@/lib/useApi'
import { C } from '@/lib/theme'
import { Badge, Btn, Card, ErrorView, Loader, Screen, Segmented, T, TopBar, useToast } from '@/components/ui'
import { Icon } from '@/components/Icon'
import { buy, iapSupported, listen, loadProducts, manage, restore, trialEligible, type IapProduct } from '@/lib/iap'

type Status = {
  product_ids: string[]
  is_owner: boolean
  account_token: string | null
  source: 'apple' | 'web' | 'other' | 'none'
  status: string | null
  cycle: 'monthly' | 'yearly' | null
  renews: boolean
  expires_at: string | null
  plan: { id: string; name: string } | null
  plans: { key: 'starter' | 'pro' | 'business'; name: string; max_messages_month: number; max_instances: number; max_team_members: number }[]
}
type Cycle = 'monthly' | 'yearly'
const ORDER = ['starter', 'pro', 'business'] as const

export default function Plans() {
  const { t, fmtDate, fmtNumber } = useI18n()
  const { refreshMe } = useAuth()
  const toast = useToast()
  const errText = useErrorText()
  const q = useApi<Status>('/api/mobile/iap/status')
  const [cycle, setCycle] = useState<Cycle>('monthly')
  const [products, setProducts] = useState<IapProduct[] | null>(null)
  const [eligible, setEligible] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [storeError, setStoreError] = useState<string | null>(null)

  const s = q.data
  useEffect(() => {
    if (!iapSupported || !s?.product_ids?.length) return
    loadProducts(s.product_ids)
      .then(async list => {
        setProducts(list)
        setEligible(await trialEligible(list[0]?.groupId || null))
      })
      .catch(e => setStoreError(e instanceof Error ? e.message : t('error_generic')))
  }, [s?.product_ids?.join(','), t])

  useEffect(() => {
    if (!iapSupported) return
    return listen(
      () => { setBusy(null); toast(t('iap_done')); q.reload(); void refreshMe() },
      msg => { setBusy(null); if (msg) toast(msg, 'error') },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const byId = useMemo(() => new Map((products || []).map(p => [p.id, p])), [products])
  const sku = (key: string) => (s?.product_ids || []).find(id => id.endsWith(`.${key}.${cycle}`)) || ''
  const currentKey = s?.plan ? s.plan.name.toLowerCase() : null
  const blockedByWeb = s?.source === 'web' || s?.source === 'other'

  const onBuy = async (key: string) => {
    const id = sku(key)
    if (!id || !s?.account_token) return
    setBusy(id)
    try {
      await buy(id, s.account_token)
    } catch (e) {
      setBusy(null)
      toast(errText(e), 'error')
    }
  }
  const onRestore = async () => {
    setBusy('restore')
    try {
      const n = await restore(s?.product_ids || [])
      toast(n ? t('iap_restored') : t('iap_nothing_to_restore'))
      q.reload()
      void refreshMe()
    } catch (e) {
      toast(errText(e), 'error')
    } finally {
      setBusy(null)
    }
  }
  const open = (path: string) => () => void WebBrowser.openBrowserAsync(`${API_URL}${path}`)

  const limit = (n: number) => (n < 0 || n >= 1000000 ? t('iap_unlimited') : fmtNumber(n))

  return (
    <Screen>
      <TopBar title={t('iap_title')} />
      {q.loading ? <Loader /> : q.error || !s ? <ErrorView message={errText(q.error)} onRetry={q.reload} /> : (
        <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 40 }}>
          <View style={{ gap: 6 }}>
            <T w="bold" size={22}>{t('iap_headline')}</T>
            <T size={14} color={C.muted}>{t('iap_sub')}</T>
          </View>

          {s.plan ? (
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Badge label={s.plan.name} tone="brand" />
                <T size={13} color={C.muted} style={{ flex: 1 }}>
                  {s.status === 'trialing' ? t('iap_in_trial', { date: fmtDate(s.expires_at) }) : s.expires_at ? (s.renews ? t('renews_on', { date: fmtDate(s.expires_at) }) : t('iap_ends_on', { date: fmtDate(s.expires_at) })) : ''}
                </T>
              </View>
              {s.source === 'apple' ? (
                <Btn title={t('iap_manage')} variant="ghost" size="sm" icon="refresh" onPress={() => void manage()} style={{ marginTop: 10 }} />
              ) : blockedByWeb ? (
                <T size={12.5} color={C.muted} style={{ marginTop: 8 }}>{t('iap_billed_on_web')}</T>
              ) : null}
            </Card>
          ) : null}

          {!s.is_owner ? (
            <Card><T size={14} color={C.muted}>{t('iap_owner_only')}</T></Card>
          ) : (
            <>
              <Segmented items={[{ key: 'monthly', label: t('iap_monthly') }, { key: 'yearly', label: t('iap_yearly') }]} value={cycle} onChange={setCycle} />
              {storeError ? <Card><T size={13.5} color={C.danger}>{storeError}</T></Card> : null}
              {products === null && !storeError ? <Loader /> : null}
              {ORDER.map(key => {
                const meta = s.plans.find(p => p.key === key)
                const product = byId.get(sku(key))
                if (!meta || !product) return null
                const current = currentKey === key && s.source === 'apple' && s.cycle === cycle
                return (
                  <Card key={key} style={key === 'pro' ? { borderColor: C.teal, borderWidth: 1.5 } : undefined}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <T w="bold" size={18} style={{ flex: 1 }}>{meta.name}</T>
                      {key === 'pro' ? <Badge label={t('iap_popular')} tone="brand" /> : null}
                    </View>
                    <T w="bold" size={24} style={{ marginTop: 6 }}>{product.displayPrice}<T size={14} color={C.muted}>{cycle === 'monthly' ? t('iap_per_month') : t('iap_per_year')}</T></T>
                    {product.freeTrial && eligible ? <T w="semibold" size={13} color={C.chipInk} style={{ marginTop: 2 }}>{t('iap_trial_badge')}</T> : null}
                    <View style={{ marginTop: 10, gap: 6 }}>
                      {[
                        t('iap_f_messages', { n: limit(meta.max_messages_month) }),
                        t('iap_f_numbers', { n: limit(meta.max_instances) }),
                        t('iap_f_team', { n: limit(meta.max_team_members) }),
                      ].map(line => (
                        <View key={line} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Icon name="check" size={15} color={C.teal} /><T size={13.5}>{line}</T>
                        </View>
                      ))}
                    </View>
                    <Btn
                      title={current ? t('iap_current') : product.freeTrial && eligible ? t('iap_start_trial') : t('iap_subscribe')}
                      variant={key === 'pro' ? 'brand' : 'teal'}
                      size="md"
                      disabled={current || blockedByWeb || !!busy}
                      loading={busy === product.id}
                      onPress={() => void onBuy(key)}
                      style={{ marginTop: 14 }}
                    />
                  </Card>
                )
              })}
              <Pressable accessibilityRole="button" onPress={() => void onRestore()} disabled={!!busy} style={{ alignSelf: 'center', padding: 10 }}>
                <T w="semibold" size={14} color={C.chipInk}>{busy === 'restore' ? t('loading') : t('iap_restore')}</T>
              </Pressable>
            </>
          )}

          {/* Required subscription disclosure (App Store guideline 3.1.2). */}
          <T size={11.5} color={C.muted} style={{ lineHeight: 17 }}>{t('iap_legal')}</T>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 18 }}>
            <Pressable accessibilityRole="link" onPress={open('/terms')}><T size={12.5} color={C.chipInk}>{t('iap_eula')}</T></Pressable>
            <Pressable accessibilityRole="link" onPress={open('/privacy')}><T size={12.5} color={C.chipInk}>{t('privacy')}</T></Pressable>
          </View>
        </ScrollView>
      )}
    </Screen>
  )
}
