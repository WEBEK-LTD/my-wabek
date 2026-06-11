// @ts-nocheck
import { useState, useEffect } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import axios from 'axios'
import toast from 'react-hot-toast'
import { ArrowPathIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

export default function AdminWhatsAppPage() {
  const [instances, setInstances] = useState([])
  const [loading, setLoading] = useState(true)
  const [qrData, setQrData] = useState(null)
  const [creating, setCreating] = useState(false)
  const [polling, setPolling] = useState(false)

  const load = async () => {
    try {
      const { data } = await axios.get('/api/whatsapp/instances')
      // Show only admin/system instances (or all for admin)
      setInstances(data.instances || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Poll QR status
  useEffect(() => {
    if (!qrData?.instanceId) return
    const interval = setInterval(async () => {
      try {
        const { data } = await axios.get(`/api/whatsapp/wa-web?instanceId=${qrData.instanceId}`)
        if (data.status === 'connected') {
          setQrData(null)
          setPolling(false)
          load()
          toast.success('✅ WhatsApp connected successfully!')
          clearInterval(interval)
        } else if (data.qrCode) {
          setQrData(prev => ({ ...prev, qrCode: data.qrCode }))
        }
      } catch {}
    }, 3000)
    setPolling(true)
    return () => clearInterval(interval)
  }, [qrData?.instanceId])

  const connectNew = async () => {
    setCreating(true)
    try {
      const { data } = await axios.post('/api/whatsapp/wa-web', {
        action: 'create',
        display_name: 'OTP System',
      })
      if (data.qrCode) {
        setQrData({ instanceId: data.instance?.id, qrCode: data.qrCode })
        toast.success('Scan QR code with WhatsApp')
      } else {
        toast('Generating QR code...')
        setQrData({ instanceId: data.instance?.id, qrCode: null })
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to create instance')
    } finally { setCreating(false) }
  }

  const refreshQR = async () => {
    if (!qrData?.instanceId) return
    try {
      const { data } = await axios.post('/api/whatsapp/wa-web', {
        action: 'request_qr',
        instanceId: qrData.instanceId,
      })
      if (data.qrCode) setQrData(prev => ({ ...prev, qrCode: data.qrCode }))
    } catch {}
  }

  const disconnect = async (id) => {
    if (!confirm('Disconnect this WhatsApp instance?')) return
    try {
      await axios.post('/api/whatsapp/wa-web', { action: 'disconnect', instanceId: id })
      load()
      toast.success('Disconnected')
    } catch { toast.error('Failed') }
  }

  return (
    <AdminLayout title="WhatsApp — OTP System">
      <div className="max-w-2xl space-y-4">

        {/* Info card */}
        <div className="card border-blue-200/50 bg-blue-50/10">
          <div className="flex items-start gap-3">
            <div className="text-2xl">📱</div>
            <div>
              <h3 className="font-display font-semibold text-slate-900 mb-1">OTP WhatsApp Connection</h3>
              <p className="text-sm text-slate-400">
                Connect a WhatsApp number here to send OTP verification codes to users when they register or login.
                This is separate from users' own WhatsApp instances.
              </p>
            </div>
          </div>
        </div>

        {/* Connected instances */}
        {loading ? (
          <div className="card"><div className="skeleton h-16 rounded-lg" /></div>
        ) : instances.length > 0 ? (
          <div className="card">
            <h3 className="font-display font-semibold text-slate-900 mb-3">Connected Instances</h3>
            <div className="space-y-3">
              {instances.map(inst => (
                <div key={inst.id} className={clsx(
                  'flex items-center justify-between p-3 rounded-lg border',
                  inst.status === 'connected' ? 'border-blue-200/50 bg-blue-50/10' : 'border-slate-200'
                )}>
                  <div className="flex items-center gap-3">
                    <div className={clsx('w-2.5 h-2.5 rounded-full', inst.status === 'connected' ? 'bg-brand-500' : 'bg-slate-200')} />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{inst.display_name || 'WhatsApp Web'}</p>
                      <p className="text-xs text-slate-500">{inst.phone_number} · {inst.instance_type === 'wa_web' ? '📱 WA Web' : '☁️ Cloud API'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {inst.status === 'connected' ? (
                      <span className="badge-green text-xs flex items-center gap-1">
                        <CheckCircleIcon className="w-3 h-3" /> Connected
                      </span>
                    ) : (
                      <span className="badge-gray text-xs flex items-center gap-1">
                        <XCircleIcon className="w-3 h-3" /> {inst.status}
                      </span>
                    )}
                    <button onClick={() => disconnect(inst.id)}
                      className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded border border-red-900/50 hover:border-red-800">
                      Disconnect
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : !qrData ? (
          <div className="card text-center py-10">
            <div className="text-4xl mb-3">📵</div>
            <p className="text-slate-900 font-medium mb-1">No WhatsApp connected</p>
            <p className="text-slate-400 text-sm mb-4">Connect a WhatsApp number to start sending OTP codes</p>
          </div>
        ) : null}

        {/* QR Code */}
        {qrData && (
          <div className="card text-center">
            <h3 className="font-display font-semibold text-slate-900 mb-2">📷 Scan QR Code</h3>
            <p className="text-slate-400 text-sm mb-4">
              Open WhatsApp → Menu → Linked Devices → Link a Device
            </p>
            {qrData.qrCode ? (
              <div className="inline-block p-3 bg-white rounded-xl mb-4">
                <img src={qrData.qrCode} alt="QR Code" className="w-52 h-52" />
              </div>
            ) : (
              <div className="flex items-center justify-center h-52 mb-4">
                <div className="text-center">
                  <ArrowPathIcon className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">Generating QR code...</p>
                </div>
              </div>
            )}
            {polling && (
              <div className="flex items-center justify-center gap-2 text-sm text-blue-600 mb-3">
                <span className="animate-ping w-2 h-2 rounded-full bg-brand-500 inline-block" />
                Waiting for scan...
              </div>
            )}
            <div className="flex gap-2 justify-center">
              <button onClick={refreshQR} className="btn-secondary text-sm">
                <ArrowPathIcon className="w-4 h-4" /> Refresh QR
              </button>
              <button onClick={() => setQrData(null)} className="btn-secondary text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Connect button */}
        {!qrData && (
          <button onClick={connectNew} disabled={creating} className="btn-primary w-full justify-center py-3">
            {creating ? (
              <><ArrowPathIcon className="w-4 h-4 animate-spin" /> Connecting...</>
            ) : (
              <>📱 Connect WhatsApp via QR Code</>
            )}
          </button>
        )}

        {/* Instructions */}
        <div className="card border-slate-200">
          <h3 className="font-semibold text-slate-900 mb-3 text-sm">📋 Setup Instructions</h3>
          <ol className="space-y-2 text-sm text-slate-400">
            {[
              'Click "Connect WhatsApp via QR Code" above',
              'Open WhatsApp on your phone',
              'Tap Menu (⋮) → Linked Devices → Link a Device',
              'Scan the QR code that appears',
              'Wait for connection confirmation',
              'Go to Settings → Security & OTP → Select this instance as OTP provider',
              'Enable "Require OTP on Registration" if needed',
            ].map((step, i) => (
              <li key={i} className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-50 border border-brand-700 text-blue-600 text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </AdminLayout>
  )
}
