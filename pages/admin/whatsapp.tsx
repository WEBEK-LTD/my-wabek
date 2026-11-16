import React, { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  ArrowPathIcon, CheckBadgeIcon, Cog6ToothIcon, DevicePhoneMobileIcon, KeyIcon, LinkSlashIcon, QrCodeIcon, ShieldCheckIcon, SignalIcon,
} from '@heroicons/react/24/outline'
import { Badge, Button, Card, CardHeader, ConfirmDialog, EmptyState, PageHeader, Skeleton, Spinner, StatusPill, cn } from '@/components/ui'
import { apiError, useAdminT } from '@/components/admin/i18n'
import { ErrorState, Notice, Steps } from '@/components/admin/shared'
import messages from '@/locales/admin/whatsapp'

interface Instance { id: string; display_name?: string | null; phone_number?: string | null; instance_type?: string | null; status?: string | null }

export default function AdminWhatsAppPage() {
  const { t, tn } = useAdminT(messages)
  const [instances, setInstances] = useState<Instance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [qrData, setQrData] = useState<null | { instanceId?: string; qrCode: string | null }>(null)
  const [creating, setCreating] = useState(false)
  const [polling, setPolling] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [toDisconnect, setToDisconnect] = useState<Instance | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [otpInstanceId, setOtpInstanceId] = useState<string | null>(null)
  const [settingOtp, setSettingOtp] = useState<string | null>(null)

  const load = async () => {
    try {
      const { data } = await axios.get('/api/whatsapp/instances')
      setInstances(data.instances || [])
      setError(false)
    } catch { setError(true) }
    setLoading(false)
  }
  useEffect(() => {
    load()
    axios.get('/api/admin/settings').then(r => setOtpInstanceId((r.data.settings?.otp_instance_id as string) || '')).catch(() => {})
  }, [])

  // Poll QR status while a code is shown.
  useEffect(() => {
    if (!qrData?.instanceId) return
    const interval = setInterval(async () => {
      try {
        const { data } = await axios.get(`/api/whatsapp/wa-web?instanceId=${qrData.instanceId}`)
        if (data.status === 'connected') {
          setQrData(null)
          setPolling(false)
          load()
          toast.success(t('whatsappConnectedSuccessfully'))
          clearInterval(interval)
        } else if (data.qrCode) {
          setQrData(prev => (prev ? { ...prev, qrCode: data.qrCode } : prev))
        }
      } catch { /* keep polling */ }
    }, 3000)
    setPolling(true)
    return () => { clearInterval(interval); setPolling(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrData?.instanceId])

  const connectNew = async () => {
    setCreating(true)
    try {
      const { data } = await axios.post('/api/whatsapp/wa-web', { action: 'create', display_name: 'OTP System' })
      if (data.qrCode) {
        setQrData({ instanceId: data.instance?.id, qrCode: data.qrCode })
        toast.success(t('scanQrCodeWhatsapp'))
      } else {
        toast(t('generatingQrCode'))
        setQrData({ instanceId: data.instance?.id, qrCode: null })
      }
    } catch (e) {
      toast.error(apiError(e, t('failedCreateInstance')))
    } finally { setCreating(false) }
  }

  const refreshQR = async () => {
    if (!qrData?.instanceId) return
    setRefreshing(true)
    try {
      const { data } = await axios.post('/api/whatsapp/wa-web', { action: 'request_qr', instanceId: qrData.instanceId })
      if (data.qrCode) setQrData(prev => (prev ? { ...prev, qrCode: data.qrCode } : prev))
    } catch (e) { toast.error(apiError(e, t('couldNotRefreshCode'))) }
    setRefreshing(false)
  }

  const disconnect = async () => {
    if (!toDisconnect) return
    setDisconnecting(true)
    try {
      await axios.post('/api/whatsapp/wa-web', { action: 'disconnect', instanceId: toDisconnect.id })
      load()
      toast.success(t('disconnected'))
      setToDisconnect(null)
    } catch (e) { toast.error(apiError(e, t('failedDisconnect'))) }
    setDisconnecting(false)
  }

  const assignOtp = async (id: string) => {
    setSettingOtp(id)
    try {
      // The settings API only writes the keys it receives.
      await axios.put('/api/admin/settings', { otp_instance_id: id })
      setOtpInstanceId(id)
      toast.success(t('numberNowSendsOtp'))
    } catch (e) { toast.error(apiError(e, t('failedSave'))) }
    setSettingOtp(null)
  }

  const connected = instances.filter(i => i.status === 'connected')

  return (
    <AdminLayout title={t('systemWhatsapp')}>
      <PageHeader className="mb-6"
        eyebrow={t('settings')}
        title={t('platformWhatsappNumber')}
        description={t('numberThatSendsVerification')}
        actions={<Button variant="secondary" icon={Cog6ToothIcon} href="/admin/settings">{t('otpSettings')}</Button>}
      />

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <Card variant="deep" padding="lg" className="relative overflow-hidden">
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -start-10 h-56 w-56 rounded-full bg-brand-gradient opacity-20 blur-3xl" />
            <div className="relative flex flex-wrap items-center gap-5">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10"><ShieldCheckIcon className="h-7 w-7 text-brand-green" aria-hidden="true" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-deep-muted">{t('otpSendingStatus')}</p>
                <p className="mt-1 text-xl font-semibold text-white">
                  {loading ? '…' : connected.length ? tn('numbersConnected', connected.length, { n: connected.length }) : t('noNumberConnected')}
                </p>
                <p className="mt-1 text-xs text-deep-muted">
                  {otpInstanceId ? t('specificNumberSelectedSettings') : t('automaticFirstConnectedNumber')}
                </p>
              </div>
              {!qrData && <Button variant="on-deep" icon={QrCodeIcon} loading={creating} onClick={connectNew}>{t('connectViaQr')}</Button>}
            </div>
          </Card>

          {qrData && (
            <Card className="text-center">
              <CardHeader icon={QrCodeIcon} title={t('scanQrCode')} subtitle={t('whatsappMenuLinkedDevices')} />
              <div className="mt-5 flex flex-col items-center gap-4">
                {qrData.qrCode ? (
                  <div className="rounded-2xl border border-line bg-white p-3 shadow-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrData.qrCode} alt={t('whatsappLinkQrCode')} className="h-56 w-56" />
                  </div>
                ) : (
                  <div className="flex h-56 w-56 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line-strong bg-surface-2">
                    <Spinner />
                    <p className="text-sm text-muted">{t('generatingCode')}</p>
                  </div>
                )}
                {polling && <Badge tone="brand" dot pulse>{t('waitingScan')}</Badge>}
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="secondary" size="sm" icon={ArrowPathIcon} loading={refreshing} onClick={refreshQR}>{t('refreshQr')}</Button>
                  <Button variant="ghost" size="sm" onClick={() => setQrData(null)}>{t('cancel')}</Button>
                </div>
              </div>
            </Card>
          )}

          <Card padding="none">
            <CardHeader className="px-5 pt-5 sm:px-6" icon={DevicePhoneMobileIcon} title={t('linkedNumbers')} />
            <div className="p-4 sm:p-5">
              {loading ? <div className="space-y-2">{[0, 1].map(i => <Skeleton key={i} className="h-16" />)}</div>
                : error ? <ErrorState onRetry={load} />
                : instances.length === 0 ? (
                  <EmptyState size="sm" icon={SignalIcon} title={t('noWhatsappNumberLinked')}
                    description={t('connectNumberStartSending')}
                    action={!qrData ? <Button size="sm" icon={QrCodeIcon} loading={creating} onClick={connectNew}>{t('connectViaQr2')}</Button> : undefined} />
                ) : (
                  <ul className="space-y-2.5">
                    {instances.map(inst => {
                      const isOtp = otpInstanceId ? otpInstanceId === inst.id : inst.id === connected[0]?.id
                      return (
                        <li key={inst.id} className={cn('flex flex-wrap items-center gap-3 rounded-xl border p-3.5 transition-colors',
                          inst.status === 'connected' ? 'border-brand-teal/30 bg-chip/30' : 'border-line')}>
                          <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', inst.status === 'connected' ? 'bg-chip text-brand-ink' : 'bg-surface-3 text-muted')}>
                            <DevicePhoneMobileIcon className="h-5 w-5" aria-hidden="true" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate font-medium text-ink">{inst.display_name || 'WhatsApp Web'}</p>
                              {isOtp && inst.status === 'connected' && <Badge tone="violet" size="sm" icon={KeyIcon}>{t('otpSender')}</Badge>}
                            </div>
                            <p className="text-xs text-muted"><span dir="ltr">{inst.phone_number || '—'}</span> · {inst.instance_type === 'wa_web' ? 'WhatsApp Web' : 'Cloud API'}</p>
                          </div>
                          <StatusPill status={inst.status}>{inst.status === 'connected' ? t('connected') : inst.status || '—'}</StatusPill>
                          <div className="flex gap-1.5">
                            {inst.status === 'connected' && otpInstanceId !== inst.id && (
                              <Button size="xs" variant="secondary" icon={CheckBadgeIcon} loading={settingOtp === inst.id} onClick={() => assignOtp(inst.id)}>{t('useOtp')}</Button>
                            )}
                            <Button size="xs" variant="danger-soft" icon={LinkSlashIcon} onClick={() => setToDisconnect(inst)}>{t('disconnect')}</Button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
            </div>
          </Card>
        </div>

        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader title={t('setupSteps')} />
            <Steps className="mt-4" items={[
              t('clickConnectViaQr'),
              t('openWhatsappPhone'),
              t('menuLinkedDevicesLink'),
              t('scanCodeWaitConfirmation'),
              t('pickNumberAsOtp'),
              t('enableRequireOtpRegistration'),
            ]} />
          </Card>
          <Notice tone="info" icon={ShieldCheckIcon} title={t('cloudApiCodesUse')}>
            {t('templateNameSetSettings')}
          </Notice>
        </div>
      </div>

      <ConfirmDialog
        open={!!toDisconnect}
        destructive
        onClose={() => setToDisconnect(null)}
        loading={disconnecting}
        title={t('disconnectNumber')}
        description={t('verificationCodesWonT')}
        confirmLabel={t('disconnect')}
        onConfirm={disconnect}
      />
    </AdminLayout>
  )
}
