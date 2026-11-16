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

interface Instance { id: string; display_name?: string | null; phone_number?: string | null; instance_type?: string | null; status?: string | null }

export default function AdminWhatsAppPage() {
  const { tr } = useAdminT()
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
          toast.success(tr('تم ربط واتساب بنجاح', 'WhatsApp connected successfully'))
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
        toast.success(tr('امسح رمز QR بتطبيق واتساب', 'Scan the QR code with WhatsApp'))
      } else {
        toast(tr('جارٍ إنشاء رمز QR…', 'Generating QR code…'))
        setQrData({ instanceId: data.instance?.id, qrCode: null })
      }
    } catch (e) {
      toast.error(apiError(e, tr('تعذّر إنشاء الاتصال', 'Failed to create instance')))
    } finally { setCreating(false) }
  }

  const refreshQR = async () => {
    if (!qrData?.instanceId) return
    setRefreshing(true)
    try {
      const { data } = await axios.post('/api/whatsapp/wa-web', { action: 'request_qr', instanceId: qrData.instanceId })
      if (data.qrCode) setQrData(prev => (prev ? { ...prev, qrCode: data.qrCode } : prev))
    } catch (e) { toast.error(apiError(e, tr('تعذّر تحديث الرمز', 'Could not refresh the code'))) }
    setRefreshing(false)
  }

  const disconnect = async () => {
    if (!toDisconnect) return
    setDisconnecting(true)
    try {
      await axios.post('/api/whatsapp/wa-web', { action: 'disconnect', instanceId: toDisconnect.id })
      load()
      toast.success(tr('تم قطع الاتصال', 'Disconnected'))
      setToDisconnect(null)
    } catch (e) { toast.error(apiError(e, tr('تعذّر قطع الاتصال', 'Failed to disconnect'))) }
    setDisconnecting(false)
  }

  const assignOtp = async (id: string) => {
    setSettingOtp(id)
    try {
      // The settings API only writes the keys it receives.
      await axios.put('/api/admin/settings', { otp_instance_id: id })
      setOtpInstanceId(id)
      toast.success(tr('أصبح هذا الرقم مُرسل رموز OTP', 'This number now sends OTP codes'))
    } catch (e) { toast.error(apiError(e, tr('تعذّر الحفظ', 'Failed to save'))) }
    setSettingOtp(null)
  }

  const connected = instances.filter(i => i.status === 'connected')

  return (
    <AdminLayout title={tr('واتساب النظام', 'System WhatsApp')}>
      <PageHeader
        eyebrow={tr('الإعدادات', 'Settings')}
        title={tr('رقم واتساب المنصة', 'Platform WhatsApp number')}
        description={tr('الرقم الذي يرسل رموز التحقق للمستخدمين عند التسجيل والدخول — منفصل عن أرقام المستخدمين.', 'The number that sends verification codes when users sign up or sign in — separate from users’ own numbers.')}
        actions={<Button variant="secondary" icon={Cog6ToothIcon} href="/admin/settings">{tr('إعدادات OTP', 'OTP settings')}</Button>}
      />

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <Card variant="deep" padding="lg" className="relative overflow-hidden">
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -start-10 h-56 w-56 rounded-full bg-brand-gradient opacity-20 blur-3xl" />
            <div className="relative flex flex-wrap items-center gap-5">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10"><ShieldCheckIcon className="h-7 w-7 text-brand-green" aria-hidden="true" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-deep-muted">{tr('حالة إرسال OTP', 'OTP sending status')}</p>
                <p className="mt-1 text-xl font-semibold text-white">
                  {loading ? '…' : connected.length ? tr(`${connected.length} رقم متصل`, `${connected.length} number(s) connected`) : tr('لا يوجد رقم متصل', 'No number connected')}
                </p>
                <p className="mt-1 text-xs text-deep-muted">
                  {otpInstanceId ? tr('رقم مخصّص محدّد في الإعدادات', 'A specific number is selected in settings') : tr('تلقائي: أول رقم متصل', 'Automatic: first connected number')}
                </p>
              </div>
              {!qrData && <Button variant="on-deep" icon={QrCodeIcon} loading={creating} onClick={connectNew}>{tr('ربط رقم عبر QR', 'Connect via QR')}</Button>}
            </div>
          </Card>

          {qrData && (
            <Card className="text-center">
              <CardHeader icon={QrCodeIcon} title={tr('امسح رمز QR', 'Scan the QR code')} subtitle={tr('واتساب ← القائمة ← الأجهزة المرتبطة ← ربط جهاز', 'WhatsApp → Menu → Linked devices → Link a device')} />
              <div className="mt-5 flex flex-col items-center gap-4">
                {qrData.qrCode ? (
                  <div className="rounded-2xl border border-line bg-white p-3 shadow-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrData.qrCode} alt={tr('رمز QR لربط واتساب', 'WhatsApp link QR code')} className="h-56 w-56" />
                  </div>
                ) : (
                  <div className="flex h-56 w-56 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line-strong bg-surface-2">
                    <Spinner />
                    <p className="text-sm text-muted">{tr('جارٍ إنشاء الرمز…', 'Generating code…')}</p>
                  </div>
                )}
                {polling && <Badge tone="brand" dot pulse>{tr('بانتظار المسح…', 'Waiting for scan…')}</Badge>}
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="secondary" size="sm" icon={ArrowPathIcon} loading={refreshing} onClick={refreshQR}>{tr('تحديث الرمز', 'Refresh QR')}</Button>
                  <Button variant="ghost" size="sm" onClick={() => setQrData(null)}>{tr('إلغاء', 'Cancel')}</Button>
                </div>
              </div>
            </Card>
          )}

          <Card padding="none">
            <CardHeader className="px-5 pt-5 sm:px-6" icon={DevicePhoneMobileIcon} title={tr('الأرقام المرتبطة', 'Linked numbers')} />
            <div className="p-4 sm:p-5">
              {loading ? <div className="space-y-2">{[0, 1].map(i => <Skeleton key={i} className="h-16" />)}</div>
                : error ? <ErrorState onRetry={load} />
                : instances.length === 0 ? (
                  <EmptyState size="sm" icon={SignalIcon} title={tr('لا يوجد رقم واتساب مرتبط', 'No WhatsApp number linked')}
                    description={tr('اربط رقمًا لبدء إرسال رموز التحقق.', 'Connect a number to start sending verification codes.')}
                    action={!qrData ? <Button size="sm" icon={QrCodeIcon} loading={creating} onClick={connectNew}>{tr('ربط عبر QR', 'Connect via QR')}</Button> : undefined} />
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
                              {isOtp && inst.status === 'connected' && <Badge tone="violet" size="sm" icon={KeyIcon}>{tr('مُرسل OTP', 'OTP sender')}</Badge>}
                            </div>
                            <p className="text-xs text-muted"><span dir="ltr">{inst.phone_number || '—'}</span> · {inst.instance_type === 'wa_web' ? 'WhatsApp Web' : 'Cloud API'}</p>
                          </div>
                          <StatusPill status={inst.status}>{inst.status === 'connected' ? tr('متصل', 'Connected') : inst.status || '—'}</StatusPill>
                          <div className="flex gap-1.5">
                            {inst.status === 'connected' && otpInstanceId !== inst.id && (
                              <Button size="xs" variant="secondary" icon={CheckBadgeIcon} loading={settingOtp === inst.id} onClick={() => assignOtp(inst.id)}>{tr('استخدامه لـ OTP', 'Use for OTP')}</Button>
                            )}
                            <Button size="xs" variant="danger-soft" icon={LinkSlashIcon} onClick={() => setToDisconnect(inst)}>{tr('قطع الاتصال', 'Disconnect')}</Button>
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
            <CardHeader title={tr('خطوات الإعداد', 'Setup steps')} />
            <Steps className="mt-4" items={[
              tr('اضغط «ربط رقم عبر QR».', 'Click “Connect via QR”.'),
              tr('افتح واتساب على هاتفك.', 'Open WhatsApp on your phone.'),
              tr('القائمة ← الأجهزة المرتبطة ← ربط جهاز.', 'Menu → Linked devices → Link a device.'),
              tr('امسح الرمز الظاهر وانتظر تأكيد الاتصال.', 'Scan the code and wait for the confirmation.'),
              tr('اختر الرقم كمُرسل OTP هنا أو من الإعدادات ← الأمان وOTP.', 'Pick the number as OTP sender here or in Settings → Security & OTP.'),
              tr('فعّل «اشتراط OTP عند التسجيل» عند الحاجة.', 'Enable “Require OTP on registration” if needed.'),
            ]} />
          </Card>
          <Notice tone="info" icon={ShieldCheckIcon} title={tr('عبر Cloud API تُرسل الرموز بقالب المصادقة', 'On Cloud API, codes use the Authentication template')}>
            {tr('اسم القالب يُضبط في الإعدادات (otp_template_name). اختبره من هناك بإرسال رمز تجريبي.', 'The template name is set in Settings (otp_template_name). Test it there with a sample code.')}
          </Notice>
        </div>
      </div>

      <ConfirmDialog
        open={!!toDisconnect}
        destructive
        onClose={() => setToDisconnect(null)}
        loading={disconnecting}
        title={tr('قطع اتصال هذا الرقم؟', 'Disconnect this number?')}
        description={tr('لن تُرسل رموز التحقق من هذا الرقم حتى تعيد ربطه.', 'Verification codes won’t be sent from this number until you link it again.')}
        confirmLabel={tr('قطع الاتصال', 'Disconnect')}
        onConfirm={disconnect}
      />
    </AdminLayout>
  )
}
