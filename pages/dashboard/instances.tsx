// @ts-nocheck
declare global { interface Window { FB: any } }
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  PlusIcon, QrCodeIcon, CloudIcon, DevicePhoneMobileIcon, SignalIcon, CheckIcon,
  ExclamationTriangleIcon, BookOpenIcon,
} from '@heroicons/react/24/outline'
import { Button, Card, CardHeader, ConfirmDialog, EmptyState, PageHeader, StatCard, Tabs } from '@/components/ui'
import { CardsSkeleton, ErrorState, apiError } from '@/components/settings/Shared'
import { NumberCard, isWebInstance, type Instance } from '@/components/numbers/NumberCard'
import { QrDialog } from '@/components/numbers/QrDialog'
import { ConnectNumberDialog } from '@/components/numbers/ConnectNumberDialog'
import { CloudApiForm } from '@/components/numbers/CloudApiForm'
import { rich } from '@/components/settings/Shared'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/dashboard/instances'

export default function InstancesPage() {
  const { t } = useT(messages)
  const qc = useQueryClient()
  const router = useRouter()
  const [filter, setFilter] = useState<'all' | 'cloud' | 'web'>('all')
  const [showConnect, setShowConnect] = useState(false)
  const [showCloudForm, setShowCloudForm] = useState(false)
  const [metaLoading, setMetaLoading] = useState(false)
  const [qrInstance, setQrInstance] = useState(null)
  const [toDelete, setToDelete] = useState<Instance | null>(null)
  const qrPollRef = useRef(null)

  // Meta Embedded Signup handler (unchanged flow)
  const launchMetaSignup = async () => {
    setMetaLoading(true)
    try {
      const signupData = await axios.get('/api/whatsapp/meta-signup').then(r => r.data)
      if (!signupData.appId) throw new Error('META_APP_ID not configured')

      const appUrl      = window.location.origin
      const redirectUri = `${appUrl}/api/whatsapp/meta-oauth-callback`
      const oauthState  = signupData.oauthState

      // Load FB SDK if not loaded
      if (!window.FB) {
        await new Promise<void>((resolve) => {
          const script = document.createElement('script')
          script.src = 'https://connect.facebook.net/en_US/sdk.js'
          script.onload = () => resolve()
          document.head.appendChild(script)
        })
      }

      // Init FB SDK
      window.FB.init({
        appId:   signupData.appId,
        cookie:  true,
        xfbml:   true,
        version: 'v19.0',
      })

      // Listen for Embedded Signup session info
      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== 'https://www.facebook.com' && event.origin !== 'https://web.facebook.com') return
        try {
          const parsed = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
          if (parsed?.type === 'WA_EMBEDDED_SIGNUP' && parsed?.event === 'FINISH') {
            const phoneNumberId = parsed?.data?.phone_number_id || ''
            const wabaId        = parsed?.data?.waba_id || ''
            console.log('[META] ES FINISH phoneNumberId:', phoneNumberId, 'wabaId:', wabaId)
            if (phoneNumberId && oauthState) {
              await axios.put('/api/whatsapp/meta-signup', { oauthState, phoneNumberId, wabaId })
            }
          }
        } catch {}
      }
      window.addEventListener('message', handleMessage)

      // Launch FB.login with config_id (Embedded Signup)
      window.FB.login((response: any) => {
        window.removeEventListener('message', handleMessage)
        if (response?.authResponse?.code) {
          // Exchange code server-side (no redirect_uri mismatch)
          axios.post('/api/whatsapp/meta-signup', {
            code:         response.authResponse.code,
            oauthState,
            redirectUri,
          }).then(r => {
            if (r.data.success) {
              toast.success(t('connectedOk'))
              window.location.reload()
            } else {
              toast.error(r.data.error || t('connectError'))
            }
          }).catch(e => {
            toast.error(apiError(e, t('connectError')))
          }).finally(() => setMetaLoading(false))
        } else {
          setMetaLoading(false)
          if (response?.status !== 'connected') {
            toast.error(t('metaCancelled'))
          }
        }
      }, {
        config_id:       signupData.configId,
        response_type:   'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: '',
          sessionInfoVersion: '3',
        },
      })

    } catch (e: any) {
      const localMsg = e?.message === 'META_APP_ID not configured' ? t('metaNotConfigured') : (e?.message || t('metaNotConfigured'))
      toast.error(e?.response?.data ? apiError(e, localMsg) : localMsg)
      setMetaLoading(false)
    }
  }

  const { data, isLoading, isError, error, refetch } = useQuery('instances', () => axios.get('/api/whatsapp/instances').then(r => r.data))
  const instances: Instance[] = data?.instances || []
  const cloudInstances = instances.filter(i => !i.instance_type || i.instance_type === 'cloud_api')
  const webInstances = instances.filter(i => i.instance_type === 'wa_web')
  const connectedCount = instances.filter(i => i.status === 'connected').length
  const visible = filter === 'cloud' ? cloudInstances : filter === 'web' ? webInstances : instances

  // Show success/error from Meta OAuth redirect
  useEffect(() => {
    const { success, error } = router.query
    if (success === 'connected') {
      toast.success(t('connectedViaMeta'))
      qc.invalidateQueries('instances')
      router.replace('/dashboard/instances', undefined, { shallow: true })
    } else if (error) {
      const errCode = decodeURIComponent(error as string)
      const known = `oauth_${errCode}` in messages.en
      toast.error(known ? t(`oauth_${errCode}` as keyof typeof messages.en) : errCode)
      router.replace('/dashboard/instances', undefined, { shallow: true })
    }
  }, [router.query])

  // Poll QR code status (unchanged)
  useEffect(() => {
    if (!qrInstance) { clearInterval(qrPollRef.current); return }
    qrPollRef.current = setInterval(async () => {
      try {
        const { data } = await axios.get(`/api/whatsapp/wa-web?instanceId=${qrInstance.id}`)
        if (data.status === 'connected') {
          clearInterval(qrPollRef.current)
          setQrInstance(null)
          qc.invalidateQueries('instances')
          toast.success(t('connectedPhone', { phone: data.phoneNumber }))
        } else if (data.qrCode && data.qrCode !== qrInstance.qr_code) {
          setQrInstance(prev => ({ ...prev, qr_code: data.qrCode, status: data.status }))
        }
      } catch {}
    }, 3000)
    return () => clearInterval(qrPollRef.current)
  }, [qrInstance?.id])

  const createCloudMut = useMutation(
    (body) => axios.post('/api/whatsapp/instances', body),
    { onSuccess: (res) => {
        qc.invalidateQueries('instances'); setShowCloudForm(false)
        toast.success(t('cloudConnected'))
        if (res?.data?.webhook_warning) toast(res.data.webhook_warning, { duration: 8000 })
      }, onError: (e) => toast.error(apiError(e, t('connectError'))) }
  )

  const createWebMut = useMutation(
    () => axios.post('/api/whatsapp/wa-web', { action: 'create' }),
    {
      onSuccess: (res) => {
        qc.invalidateQueries('instances')
        setShowConnect(false)
        const inst = res.data?.instance
        if (inst) {
          setQrInstance({ ...inst, qr_code: res.data?.qrCode || null })
          if (!res.data?.qrCode) toast(res.data?.message || t('waitingQr'), { duration: 5000 })
        }
      },
      onError: (e) => {
        const code = String(e?.response?.data?.code || '').toLowerCase()
        const msg = code === 'plan_limit' ? apiError(e) : (e?.response?.data?.message || e?.response?.data?.error || t('sessionError'))
        if (e?.response?.data?.configured === false) {
          toast.error(t('webNotConfigured'), { duration: 6000 })
        } else {
          toast.error(msg, { duration: 5000 })
        }
      },
    }
  )

  const refreshQRMut = useMutation(
    (instanceId) => axios.post('/api/whatsapp/wa-web', { action: 'request_qr', instanceId }),
    {
      onSuccess: (res, instanceId) => {
        const inst = instances.find(i => i.id === instanceId)
        if (inst) setQrInstance({ ...inst, qr_code: res.data?.qrCode || inst.qr_code })
        toast.success(t('qrRefreshed'))
      },
    }
  )

  const deleteMut = useMutation(
    (id) => axios.delete(`/api/whatsapp/instances/${id}`),
    {
      onSuccess: () => { qc.invalidateQueries('instances'); setToDelete(null); toast.success(t('numberDeleted')) },
      onError: (e) => toast.error(apiError(e, t('deleteError'))),
    }
  )

  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://your-site.netlify.app'

  const reconnect = (inst: Instance) => { refreshQRMut.mutate(inst.id); setQrInstance(inst) }
  const openManual = () => { setShowConnect(false); setShowCloudForm(true) }

  return (
    <DashboardLayout title={t('title')}>
      <div className="space-y-6">
        <PageHeader
          eyebrow={t('eyebrow')}
          title={t('title')}
          description={t('description')}
          actions={
            <>
              <Button variant="secondary" icon={BookOpenIcon} href="/docs/getting-started/connect-number">{t('guide')}</Button>
              <Button icon={PlusIcon} onClick={() => setShowConnect(true)}>{t('connectNumber')}</Button>
            </>
          }
        />

        <div className="grid grid-cols-2 gap-3 sm:gap-3.5 lg:grid-cols-4">
          <StatCard label={t('statAll')} value={String(instances.length)} icon={SignalIcon} loading={isLoading} />
          <StatCard label={t('statConnected')} value={String(connectedCount)} icon={CheckIcon} loading={isLoading}
            sub={instances.length ? t('statDisconnected', { n: instances.length - connectedCount }) : undefined}
            subTone={instances.length - connectedCount > 0 ? 'warning' : 'muted'} />
          <StatCard label="Cloud API" value={String(cloudInstances.length)} icon={CloudIcon} loading={isLoading} sub={t('statOfficial')} />
          <StatCard label="WhatsApp Web" value={String(webInstances.length)} icon={DevicePhoneMobileIcon} loading={isLoading} sub={t('statQr')} />
        </div>

        {isLoading ? (
          <CardsSkeleton count={2} className="h-64" />
        ) : isError ? (
          <ErrorState message={apiError(error, t('loadError'))} onRetry={() => refetch()} />
        ) : instances.length === 0 ? (
          <EmptyState
            variant="card"
            icon={SignalIcon}
            title={t('emptyTitle')}
            description={t('emptyDesc')}
            action={
              <>
                <Button icon={CloudIcon} loading={metaLoading} onClick={launchMetaSignup}>{t('connectMeta')}</Button>
                <Button variant="secondary" icon={QrCodeIcon} loading={createWebMut.isLoading} onClick={() => createWebMut.mutate()}>{t('connectQr')}</Button>
              </>
            }
          />
        ) : (
          <section aria-label={t('linkedNumbers')} className="space-y-4">
            <Tabs
              variant="segmented"
              size="sm"
              idPrefix="numbers"
              aria-label={t('filterLabel')}
              value={filter}
              onChange={v => setFilter(v as typeof filter)}
              tabs={[
                { id: 'all', label: t('filterAll'), count: instances.length },
                { id: 'cloud', label: 'Cloud API', count: cloudInstances.length },
                { id: 'web', label: 'WhatsApp Web', count: webInstances.length },
              ]}
            />
            {visible.length === 0 ? (
              <EmptyState
                variant="card"
                size="sm"
                icon={filter === 'web' ? DevicePhoneMobileIcon : CloudIcon}
                title={filter === 'web' ? t('noWeb') : t('noCloud')}
                action={filter === 'web'
                  ? <Button size="sm" icon={QrCodeIcon} loading={createWebMut.isLoading} onClick={() => createWebMut.mutate()}>{t('connectQr')}</Button>
                  : <Button size="sm" icon={CloudIcon} loading={metaLoading} onClick={launchMetaSignup}>{t('connectMeta')}</Button>}
              />
            ) : (
              <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr))]">
                {visible.map(inst => (
                  <NumberCard
                    key={inst.id}
                    inst={inst}
                    onDelete={setToDelete}
                    onReconnect={isWebInstance(inst) ? reconnect : undefined}
                    reconnecting={refreshQRMut.isLoading && refreshQRMut.variables === inst.id}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Which method fits? */}
        <Card padding="none">
          <CardHeader title={t('compareTitle')} subtitle={t('compareSubtitle')} divider />
          <div className="grid gap-px bg-line-soft md:grid-cols-2">
            <div className="space-y-2 bg-surface p-5">
              <p className="flex items-center gap-2 font-semibold text-ink"><CloudIcon className="h-5 w-5 text-brand-ink" aria-hidden="true" />{t('cloudOfficial')}</p>
              <ul className="space-y-1.5 text-sm text-body">
                <li>{t('cloud1')}</li>
                <li>{t('cloud2')}</li>
                <li>{t('cloud3')}</li>
                <li>{rich(t('cloud4'), { link: <a className="text-link hover:text-link-hover" href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" dir="ltr">developers.facebook.com</a> })}</li>
              </ul>
            </div>
            <div className="space-y-2 bg-surface p-5">
              <p className="flex items-center gap-2 font-semibold text-ink"><ExclamationTriangleIcon className="h-5 w-5 text-warning" aria-hidden="true" />{t('webUnofficial')}</p>
              <ul className="space-y-1.5 text-sm text-body">
                <li>{t('web1')}</li>
                <li>{t('web2')}</li>
                <li>{t('web3')}</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>

      <ConnectNumberDialog
        open={showConnect}
        onClose={() => setShowConnect(false)}
        onMeta={launchMetaSignup}
        metaLoading={metaLoading}
        onManual={openManual}
        onWeb={() => createWebMut.mutate()}
        webLoading={createWebMut.isLoading}
      />

      <CloudApiForm
        open={showCloudForm}
        onClose={() => setShowCloudForm(false)}
        loading={createCloudMut.isLoading}
        webhookUrl={`${appUrl}/api/whatsapp/webhook`}
        onSubmit={(d, reset) => createCloudMut.mutate(d, { onSuccess: () => reset() })}
      />

      <QrDialog
        instance={qrInstance}
        onClose={() => { setQrInstance(null); qc.invalidateQueries('instances') }}
        onRefresh={() => qrInstance && refreshQRMut.mutate(qrInstance.id)}
        refreshing={refreshQRMut.isLoading}
      />

      <ConfirmDialog cancelLabel={t('cancel')}
        destructive
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && deleteMut.mutate(toDelete.id)}
        loading={deleteMut.isLoading}
        title={t('deleteTitle')}
        description={t('deleteDesc', { name: toDelete?.display_name || toDelete?.phone_number || t('thisNumber') })}
        confirmLabel={t('deleteConfirm')}
      />
    </DashboardLayout>
  )
}
