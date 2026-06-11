// @ts-nocheck
declare global { interface Window { FB: any } }
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  PlusIcon, TrashIcon, XMarkIcon, ClipboardIcon,
  QrCodeIcon, ArrowPathIcon, CheckCircleIcon,
  ExclamationTriangleIcon, CloudIcon, DevicePhoneMobileIcon,
} from '@heroicons/react/24/outline'
import { useForm } from 'react-hook-form'

interface Instance {
  id: string; phone_number: string; display_name: string | null
  status: string; instance_type: string; phone_number_id: string
  waba_id: string; webhook_url: string; qr_code: string | null; created_at: string
}

const STATUS_BADGE = {
  connected:    'badge-green',
  disconnected: 'badge-red',
  pending:      'badge-yellow',
  qr_pending:   'badge-yellow',
  initializing: 'badge-yellow',
  banned:       'badge-red',
}

const STATUS_LABEL = {
  connected:    '🟢 Connected',
  disconnected: '🔴 Disconnected',
  pending:      '🟡 Pending',
  qr_pending:   '📱 Scan QR Code',
  initializing: '⏳ Initializing',
  banned:       '🚫 Banned',
}

export default function InstancesPage() {
  const qc = useQueryClient()
  const router = useRouter()
  const [tab, setTab] = useState<'cloud' | 'web'>('cloud')
  const [showCloudForm, setShowCloudForm] = useState(false)
  const [metaLoading, setMetaLoading] = useState(false)
  const [metaAppId, setMetaAppId] = useState('')
  const [qrInstance, setQrInstance] = useState(null)
  const [qrPolling, setQrPolling] = useState(false)
  const qrPollRef = useRef(null)
  const { register, handleSubmit, reset } = useForm()

  // Meta Embedded Signup handler
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
              toast.success('✅ WhatsApp connected successfully!')
              window.location.reload()
            } else {
              toast.error(r.data.error || 'Connection failed')
            }
          }).catch(e => {
            toast.error(e?.response?.data?.error || 'Connection failed')
          }).finally(() => setMetaLoading(false))
        } else {
          setMetaLoading(false)
          if (response?.status !== 'connected') {
            toast.error('Meta login cancelled or failed')
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
      toast.error(e?.response?.data?.error || e?.message || 'META_APP_ID not configured')
      setMetaLoading(false)
    }
  }

  const { data } = useQuery('instances', () => axios.get('/api/whatsapp/instances').then(r => r.data))
  const instances: Instance[] = data?.instances || []
  const cloudInstances = instances.filter(i => !i.instance_type || i.instance_type === 'cloud_api')
  const webInstances = instances.filter(i => i.instance_type === 'wa_web')

  // Show success/error from Meta OAuth redirect
  useEffect(() => {
    const { success, error } = router.query
    if (success === 'connected') {
      toast.success('✅ WhatsApp connected via Meta!')
      qc.invalidateQueries('instances')
      router.replace('/dashboard/instances', undefined, { shallow: true })
    } else if (error) {
      toast.error(decodeURIComponent(error as string))
      router.replace('/dashboard/instances', undefined, { shallow: true })
    }
  }, [router.query])

  // Poll QR code status
  useEffect(() => {
    if (!qrInstance) { clearInterval(qrPollRef.current); return }
    qrPollRef.current = setInterval(async () => {
      try {
        const { data } = await axios.get(`/api/whatsapp/wa-web?instanceId=${qrInstance.id}`)
        if (data.status === 'connected') {
          clearInterval(qrPollRef.current)
          setQrInstance(null)
          qc.invalidateQueries('instances')
          toast.success(`✅ WhatsApp connected: ${data.phoneNumber}`)
        } else if (data.qrCode && data.qrCode !== qrInstance.qr_code) {
          setQrInstance(prev => ({ ...prev, qr_code: data.qrCode, status: data.status }))
        }
      } catch {}
    }, 3000)
    return () => clearInterval(qrPollRef.current)
  }, [qrInstance?.id])

  const createCloudMut = useMutation(
    (body) => axios.post('/api/whatsapp/instances', body),
    { onSuccess: () => { qc.invalidateQueries('instances'); reset(); setShowCloudForm(false); toast.success('Cloud API instance connected!') }, onError: (e) => toast.error(e?.response?.data?.error || 'Failed') }
  )

  const createWebMut = useMutation(
    () => axios.post('/api/whatsapp/wa-web', { action: 'create', display_name: 'WhatsApp Web' }),
    {
      onSuccess: (res) => {
        qc.invalidateQueries('instances')
        const inst = res.data?.instance
        if (inst) {
          setQrInstance({ ...inst, qr_code: res.data?.qrCode || null })
          if (!res.data?.qrCode) toast(res.data?.message || 'Waiting for QR code…', { icon: '📱', duration: 5000 })
        }
      },
      onError: (e) => {
        const msg = e?.response?.data?.message || e?.response?.data?.error || 'Failed'
        if (e?.response?.data?.configured === false) {
          toast.error('WA Web server not configured. Add WA_WEB_SERVER_URL to Netlify env vars first.', { duration: 6000 })
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
        toast.success('QR code refreshed')
      },
    }
  )

  const deleteMut = useMutation(
    (id) => axios.delete(`/api/whatsapp/instances/${id}`),
    { onSuccess: () => { qc.invalidateQueries('instances'); toast.success('Instance removed') } }
  )

  const copyWebhook = (url) => { navigator.clipboard.writeText(url); toast.success('Copied!') }

  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://your-site.netlify.app'

  return (
    <DashboardLayout title="WhatsApp Accounts">
      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white border border-slate-200 rounded-xl p-1 w-fit">
        <button onClick={() => setTab('cloud')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === 'cloud' ? 'bg-[#F8FAFC] text-slate-900 shadow' : 'text-slate-400 hover:text-slate-900'}`}>
          <CloudIcon className="w-4 h-4" />
          Cloud API
          {cloudInstances.length > 0 && <span className="ml-1 bg-blue-50 text-blue-600 text-xs px-1.5 rounded-full">{cloudInstances.length}</span>}
        </button>
        <button onClick={() => setTab('web')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === 'web' ? 'bg-[#F8FAFC] text-slate-900 shadow' : 'text-slate-400 hover:text-slate-900'}`}>
          <DevicePhoneMobileIcon className="w-4 h-4" />
          WhatsApp Web
          {webInstances.length > 0 && <span className="ml-1 bg-blue-900 text-blue-400 text-xs px-1.5 rounded-full">{webInstances.length}</span>}
        </button>
      </div>

      {/* ─── CLOUD API TAB ─── */}
      {tab === 'cloud' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-slate-400 text-sm">{cloudInstances.length} Cloud API instance{cloudInstances.length !== 1 ? 's' : ''}</p>
            <div className="flex gap-2">
              <button
                onClick={launchMetaSignup}
                disabled={metaLoading}
                className="btn-primary text-sm bg-[#1877F2] hover:bg-[#166fe5]">
                <img src="https://upload.wikimedia.org/wikipedia/commons/0/05/Facebook_Logo_%282019%29.png" className="w-4 h-4 rounded" alt="" />
                {metaLoading ? 'Connecting...' : 'Connect with Meta'}
              </button>
              <button onClick={() => setShowCloudForm(true)} className="btn-secondary text-sm">
                <PlusIcon className="w-4 h-4" /> Manual Setup
              </button>
            </div>
          </div>

          {/* Guide */}
          <div className="card border-blue-200/50 bg-blue-50/10 mb-5">
            <h3 className="font-display font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <CloudIcon className="w-4 h-4 text-blue-600" />
              Meta WhatsApp Cloud API — Official ✅
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-400">
              <ul className="space-y-1">
                <li>✅ Official Meta product — no ban risk</li>
                <li>✅ Free up to 1,000 conversations/month</li>
                <li>✅ Stable — 99.9% uptime SLA</li>
                <li>✅ Works on Netlify serverless</li>
              </ul>
              <ul className="space-y-1">
                <li>📋 Requires Meta Business verification</li>
                <li>📋 1–2 weeks approval process</li>
                <li>📋 <a href="https://developers.facebook.com" target="_blank" className="text-blue-600 hover:underline">developers.facebook.com</a></li>
                <li>📋 Get Phone Number ID + Access Token</li>
              </ul>
            </div>
          </div>

          {cloudInstances.length === 0 ? (
            <div className="card text-center py-16">
              <CloudIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 mb-4">No Cloud API instances yet</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button onClick={launchMetaSignup} disabled={metaLoading}
                  className="btn-primary bg-[#1877F2] hover:bg-[#166fe5]">
                  <img src="https://upload.wikimedia.org/wikipedia/commons/0/05/Facebook_Logo_%282019%29.png" className="w-4 h-4 rounded" alt="" />
                  {metaLoading ? 'Connecting...' : 'Connect with Meta'}
                </button>
                <button onClick={() => setShowCloudForm(true)} className="btn-secondary">
                  <PlusIcon className="w-4 h-4" /> Manual Setup
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {cloudInstances.map(inst => (
                <div key={inst.id} className="card">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-blue-50 border border-brand-700 flex items-center justify-center text-blue-600 font-bold text-lg">
                        {(inst.display_name || inst.phone_number)[0]}
                      </div>
                      <div>
                        <h3 className="font-display font-semibold text-slate-900">{inst.display_name || inst.phone_number}</h3>
                        <p className="text-xs text-slate-400">{inst.phone_number}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={STATUS_BADGE[inst.status] || 'badge-gray'}>{STATUS_LABEL[inst.status] || inst.status}</span>
                      <button onClick={() => deleteMut.mutate(inst.id)} className="p-1.5 text-slate-500 hover:text-red-400">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between bg-[#F8FAFC] rounded-lg px-3 py-2 gap-2">
                      <span className="text-slate-500 flex-shrink-0">Instance ID</span>
                      <span className="text-slate-800 font-mono truncate text-slate-800">{inst.id}</span>
                      <button onClick={() => { navigator.clipboard.writeText(inst.id); toast.success('Instance ID copied!') }} className="text-blue-600 flex-shrink-0">
                        <ClipboardIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex justify-between bg-[#F8FAFC] rounded-lg px-3 py-2">
                      <span className="text-slate-500">Phone Number ID</span>
                      <span className="text-slate-800 font-mono text-slate-800">{inst.phone_number_id || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between bg-[#F8FAFC] rounded-lg px-3 py-2 gap-2">
                      <span className="text-slate-500 flex-shrink-0">Webhook URL</span>
                      <span className="text-slate-800 font-mono truncate text-slate-800">{inst.webhook_url}</span>
                      <button onClick={() => copyWebhook(inst.webhook_url)} className="text-blue-600 flex-shrink-0">
                        <ClipboardIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── WA WEB TAB ─── */}
      {tab === 'web' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-slate-400 text-sm">{webInstances.length} WhatsApp Web instance{webInstances.length !== 1 ? 's' : ''}</p>
            <button onClick={() => createWebMut.mutate()} disabled={createWebMut.isLoading} className="btn-primary text-sm">
              <QrCodeIcon className="w-4 h-4" />
              {createWebMut.isLoading ? 'Generating QR…' : 'Connect via QR Code'}
            </button>
          </div>

          {/* Warning */}
          <div className="card border-yellow-800/50 bg-yellow-900/10 mb-5">
            <h3 className="font-display font-semibold text-yellow-400 mb-2 flex items-center gap-2">
              <ExclamationTriangleIcon className="w-4 h-4" />
              WhatsApp Web — Unofficial Method ⚠️
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <ul className="space-y-1 text-slate-700">
                <li>✅ No Meta approval needed</li>
                <li>✅ Works with any WhatsApp number</li>
                <li>✅ Free — no per-message fees</li>
                <li>✅ Full WA features (media, reactions)</li>
              </ul>
              <ul className="space-y-1 text-yellow-400/80">
                <li>⚠️ Against WhatsApp ToS</li>
                <li>⚠️ Account ban risk</li>
                <li>⚠️ Requires separate server for sessions</li>
                <li>⚠️ Not suitable for high-volume</li>
              </ul>
            </div>


          </div>

          {/* QR Code display */}
          {qrInstance && (
            <div className="card border-blue-200/50 bg-blue-50/10 mb-5">
              <div className="flex flex-col items-center gap-4 py-4">
                <h3 className="font-display font-semibold text-slate-900 text-lg">📱 Scan QR Code with WhatsApp</h3>
                <p className="text-slate-400 text-sm text-center max-w-sm">
                  Open WhatsApp on your phone → Menu → Linked Devices → Link a Device → Scan this QR code
                </p>
                {qrInstance.qr_code ? (
                  <div className="bg-white p-4 rounded-2xl">
                    <img src={qrInstance.qr_code.startsWith('data:') ? qrInstance.qr_code : `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrInstance.qr_code)}`}
                      alt="WhatsApp QR Code" className="w-56 h-56" />
                  </div>
                ) : (
                  <div className="w-56 h-56 bg-[#F8FAFC] rounded-2xl flex flex-col items-center justify-center gap-3">
                    <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-400 text-sm">Generating QR code…</p>
                    <p className="text-slate-500 text-xs text-center px-4">Make sure WA_WEB_SERVER_URL is set in env vars</p>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                  <span className="text-sm text-slate-400">Waiting for scan… (auto-refreshes)</span>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => refreshQRMut.mutate(qrInstance.id)} className="btn-secondary text-sm">
                    <ArrowPathIcon className="w-4 h-4" /> Refresh QR
                  </button>
                  <button onClick={() => { setQrInstance(null); qc.invalidateQueries('instances') }} className="btn-secondary text-sm">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {webInstances.length === 0 && !qrInstance ? (
            <div className="card text-center py-16">
              <DevicePhoneMobileIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 mb-2">No WhatsApp Web instances yet</p>
              <p className="text-slate-500 text-sm mb-4">Connect any WhatsApp number by scanning a QR code</p>
              <button onClick={() => createWebMut.mutate()} disabled={createWebMut.isLoading} className="btn-primary mx-auto">
                <QrCodeIcon className="w-4 h-4" />
                {createWebMut.isLoading ? 'Generating…' : 'Generate QR Code'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {webInstances.map(inst => (
                <div key={inst.id} className="card">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-blue-900 border border-blue-700 flex items-center justify-center text-blue-400">
                        <DevicePhoneMobileIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-display font-semibold text-slate-900">{inst.display_name || 'WhatsApp Web'}</h3>
                        <p className="text-xs text-slate-400">{inst.phone_number !== 'pending' ? inst.phone_number : 'Not connected yet'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={STATUS_BADGE[inst.status] || 'badge-gray'}>{STATUS_LABEL[inst.status] || inst.status}</span>
                      <button onClick={() => deleteMut.mutate(inst.id)} className="p-1.5 text-slate-500 hover:text-red-400">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mb-3 text-xs">
                    <div className="flex items-center justify-between bg-[#F8FAFC] rounded-lg px-3 py-2 gap-2">
                      <span className="text-slate-500 flex-shrink-0">Instance ID</span>
                      <span className="text-slate-800 font-mono truncate text-slate-800">{inst.id}</span>
                      <button onClick={() => { navigator.clipboard.writeText(inst.id); toast.success('Instance ID copied!') }} className="text-blue-600 flex-shrink-0">
                        <ClipboardIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {['disconnected', 'qr_pending', 'initializing'].includes(inst.status) && (
                    <button onClick={() => { refreshQRMut.mutate(inst.id); setQrInstance(inst) }} className="btn-secondary text-sm w-full justify-center">
                      <QrCodeIcon className="w-4 h-4" />
                      {inst.status === 'qr_pending' ? 'Show QR Code' : 'Reconnect'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cloud API Form Modal */}
      {showCloudForm && (
        <div className="modal-backdrop" onClick={() => setShowCloudForm(false)}>
          <div className="modal-panel max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div>
                <h3 className="font-display font-semibold text-slate-900">Connect WhatsApp Cloud API</h3>
                <p className="text-xs text-slate-400 mt-0.5">Official Meta Business API</p>
              </div>
              <button onClick={() => setShowCloudForm(false)} className="text-slate-400 hover:text-slate-900">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit(d => createCloudMut.mutate(d))} className="p-5 space-y-4">
              <div>
                <label className="label">Phone Number (E.164 format) *</label>
                <input {...register('phone_number', { required: true })} placeholder="+905551234567" className="input" />
              </div>
              <div>
                <label className="label">Display Name</label>
                <input {...register('display_name')} placeholder="My Business" className="input" />
              </div>
              <div>
                <label className="label">Phone Number ID * <span className="text-slate-500 font-normal">(from Meta Developer Portal)</span></label>
                <input {...register('phone_number_id', { required: true })} placeholder="123456789012345" className="input font-mono text-sm" />
              </div>
              <div>
                <label className="label">WABA ID * <span className="text-slate-500 font-normal">(WhatsApp Business Account ID)</span></label>
                <input {...register('waba_id', { required: true })} placeholder="987654321098765" className="input font-mono text-sm" />
              </div>
              <div>
                <label className="label">Access Token * <span className="text-slate-500 font-normal">(System User token)</span></label>
                <input {...register('access_token', { required: true })} type="password" placeholder="EAAx…" className="input font-mono text-sm" />
              </div>
              <div className="bg-[#F8FAFC] rounded-lg px-3 py-2 text-xs text-slate-400">
                <strong className="text-slate-900">Webhook URL to set in Meta:</strong>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-blue-600 flex-1 truncate">{appUrl}/api/whatsapp/webhook</code>
                  <button type="button" onClick={() => copyWebhook(`${appUrl}/api/whatsapp/webhook`)} className="text-slate-400 hover:text-slate-900">
                    <ClipboardIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCloudForm(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={createCloudMut.isLoading} className="btn-primary">
                  {createCloudMut.isLoading ? 'Connecting…' : 'Connect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
