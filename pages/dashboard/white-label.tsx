// @ts-nocheck
import { usePlanGuard } from '@/hooks/usePlanFeature'
import UpgradeWall from '@/components/UpgradeWall'
import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useQuery, useMutation } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { ArrowPathIcon, SwatchIcon, GlobeAltIcon, CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

export default function WhiteLabelPage() {
  const { blocked, isLoading: planLoading } = usePlanGuard('allow_white_label')
  if (planLoading) return null
  if (blocked) return <UpgradeWall feature="allow_white_label" />

  const [dnsStatus, setDnsStatus] = useState(null) // null | 'ok' | 'pending' | 'error'
  const [dnsChecking, setDnsChecking] = useState(false)

  const checkDns = async () => {
    if (!form.custom_domain) return
    setDnsChecking(true)
    try {
      const { data } = await axios.get(`/api/white-label/check-dns?domain=${encodeURIComponent(form.custom_domain)}`)
      setDnsStatus(data.status)
    } catch { setDnsStatus('error') }
    finally { setDnsChecking(false) }
  }

  const [form, setForm] = useState({
    brand_name: '', brand_logo: '', brand_color: '#00D46A',
    brand_secondary_color: '#F8FAFC', custom_domain: '',
    favicon_url: '', support_email: '', support_whatsapp: '',
    hide_powered_by: false, custom_css: '', custom_footer: '',
  })

  const { data, isLoading } = useQuery('white-label', () => axios.get('/api/white-label').then(r => r.data))

  useEffect(() => {
    if (data?.settings && Object.keys(data.settings).length > 0) {
      setForm(prev => ({ ...prev, ...data.settings }))
    }
  }, [data])

  const saveMut = useMutation(
    (body) => axios.put('/api/white-label', body),
    {
      onSuccess: (r) => {
        if (r.data.domain_status === 'configured') {
          toast.success('✅ Settings saved — domain added to server')
        } else if (r.data.domain_status === 'netlify_error') {
          toast.success('✅ Settings saved')
          // Don't expose internal infra error to user
        } else {
          toast.success('✅ White label settings saved')
        }
      },
      onError: (e) => toast.error(e?.response?.data?.error || 'Failed'),
    }
  )

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  return (
    <DashboardLayout title="White Label">
      <div className="max-w-2xl space-y-4">

        <div className="card border-blue-200/50 bg-blue-50/10">
          <div className="flex items-center gap-3">
            <SwatchIcon className="w-6 h-6 text-blue-600" />
            <div>
              <h3 className="font-display font-semibold text-slate-900">White Label Branding</h3>
              <p className="text-slate-400 text-sm">Customize the platform with your own brand identity</p>
            </div>
          </div>
        </div>

        <div className="card space-y-4">
          <h3 className="font-display font-semibold text-slate-900">🎨 Brand Identity</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Brand Name</label>
              <input value={form.brand_name} onChange={e => set('brand_name', e.target.value)} placeholder="My Company" className="input" />
            </div>
            <div>
              <label className="label">Logo URL</label>
              <input value={form.brand_logo} onChange={e => set('brand_logo', e.target.value)} placeholder="https://..." className="input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Primary Color</label>
              <div className="flex gap-2">
                <input type="color" value={form.brand_color} onChange={e => set('brand_color', e.target.value)} className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer" />
                <input value={form.brand_color} onChange={e => set('brand_color', e.target.value)} className="input flex-1 font-mono" />
              </div>
            </div>
            <div>
              <label className="label">Background Color</label>
              <div className="flex gap-2">
                <input type="color" value={form.brand_secondary_color} onChange={e => set('brand_secondary_color', e.target.value)} className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer" />
                <input value={form.brand_secondary_color} onChange={e => set('brand_secondary_color', e.target.value)} className="input flex-1 font-mono" />
              </div>
            </div>
          </div>
          <div>
            <label className="label">Favicon URL</label>
            <input value={form.favicon_url} onChange={e => set('favicon_url', e.target.value)} placeholder="https://..." className="input" />
          </div>
        </div>

        <div className="card space-y-4">
          <h3 className="font-display font-semibold text-slate-900">🌐 Domain & Support</h3>
          <div>
            <label className="label">Custom Domain</label>
            <div className="flex gap-2">
              <input value={form.custom_domain} onChange={e => { set('custom_domain', e.target.value); setDnsStatus(null) }} placeholder="app.mycompany.com" className="input flex-1" />
              <button onClick={checkDns} disabled={!form.custom_domain || dnsChecking}
                className="btn-secondary text-sm flex-shrink-0">
                {dnsChecking ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : '🔍 Check'}
              </button>
            </div>
            <div className="mt-2 space-y-1.5">
              {dnsStatus === 'ok' && (
                <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50/20 border border-blue-200/50 rounded-lg px-3 py-2">
                  <CheckCircleIcon className="w-4 h-4 flex-shrink-0" />
                  ✅ DNS is configured correctly! Your domain will be live within 24-48 hours after propagation completes.
                </div>
              )}
              {dnsStatus === 'pending' && (
                <div className="flex items-center gap-2 text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-800/50 rounded-lg px-3 py-2">
                  <ClockIcon className="w-4 h-4 flex-shrink-0" />
                  ⏳ DNS not connected yet. May take up to 24-48 hours to propagate.
                </div>
              )}
              {dnsStatus === 'error' && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2">
                  <XCircleIcon className="w-4 h-4 flex-shrink-0" />
                  ❌ Domain not found. Check spelling or DNS settings.
                </div>
              )}
              <div className="text-xs text-slate-500 space-y-1 bg-[#F8FAFC] rounded-lg px-3 py-2 border border-slate-200">
                <p className="font-medium text-slate-400">📋 DNS Setup Instructions:</p>
                <p>1. Login to your domain registrar (GoDaddy, Namecheap, Cloudflare…)</p>
                <p>2. Go to DNS Settings → Add new record</p>
                <p>3. Type: <code className="bg-[#F8FAFC] px-1 rounded text-blue-600">CNAME</code></p>
                <p>4. Name: <code className="bg-[#F8FAFC] px-1 rounded text-blue-600">{form.custom_domain?.split('.').slice(0, -2).join('.') || 'app'}</code></p>
                <p>5. Value: <code className="bg-[#F8FAFC] px-1 rounded text-blue-600">{(process.env.NEXT_PUBLIC_NETLIFY_URL || process.env.NEXT_PUBLIC_APP_URL || 'wabek.netlify.app').replace(/^https?:\/\//, '')}</code></p>
                <p>6. Save and wait 15 min – 48 hours for propagation</p>
                <div className="mt-2 pt-2 border-t border-slate-200 text-yellow-600">
                  ⚠️ <strong>Cloudflare users:</strong> Set the proxy to <strong>DNS only</strong> (grey cloud 🔘), not Proxied (orange ☁️). Proxied mode breaks SSL with Netlify.
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Support Email</label>
              <input type="email" value={form.support_email} onChange={e => set('support_email', e.target.value)} placeholder="support@..." className="input" />
            </div>
            <div>
              <label className="label">Support WhatsApp</label>
              <input value={form.support_whatsapp} onChange={e => set('support_whatsapp', e.target.value)} placeholder="+201234567890" className="input" />
            </div>
          </div>
        </div>

        <div className="card space-y-4">
          <h3 className="font-display font-semibold text-slate-900">⚙️ Advanced</h3>
          <div className="flex items-center justify-between py-2 border-b border-slate-200">
            <div>
              <p className="text-sm font-medium text-slate-900">Hide "Powered by WABEK"</p>
              <p className="text-xs text-slate-500">Remove the WABEK branding from the footer</p>
            </div>
            <button onClick={() => set('hide_powered_by', !form.hide_powered_by)}
              className={clsx('relative inline-flex h-6 w-11 items-center rounded-full transition-colors', form.hide_powered_by ? 'bg-brand-500' : 'bg-slate-100')}>
              <span className={clsx('inline-block h-4 w-4 transform rounded-full bg-white transition-transform', form.hide_powered_by ? 'translate-x-6' : 'translate-x-1')} />
            </button>
          </div>
          <div>
            <label className="label">Custom CSS</label>
            <textarea value={form.custom_css} onChange={e => set('custom_css', e.target.value)}
              rows={4} placeholder=":root { --brand: #ff0000; }" className="input font-mono text-xs resize-none" />
          </div>
          <div>
            <label className="label">Custom Footer Text</label>
            <input value={form.custom_footer} onChange={e => set('custom_footer', e.target.value)} placeholder="© 2025 My Company" className="input" />
          </div>
        </div>

        {/* Preview */}
        {(form.brand_name || form.brand_color !== '#00D46A') && (
          <div className="card border-slate-200" style={{ borderLeftColor: form.brand_color, borderLeftWidth: '4px' }}>
            <h3 className="font-display font-semibold text-slate-900 mb-3">👁️ Preview</h3>
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: form.brand_secondary_color }}>
              {form.brand_logo ? (
                <img src={form.brand_logo} alt="logo" className="w-8 h-8 object-contain" />
              ) : (
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-900 font-bold text-sm" style={{ backgroundColor: form.brand_color }}>
                  {(form.brand_name || 'B')[0]}
                </div>
              )}
              <span className="font-bold text-slate-900">{form.brand_name || 'Brand Name'}</span>
            </div>
          </div>
        )}

        <button onClick={() => saveMut.mutate(form)} disabled={saveMut.isLoading} className="btn-primary w-full justify-center">
          {saveMut.isLoading ? <><ArrowPathIcon className="w-4 h-4 animate-spin" /> Saving...</> : '💾 Save White Label Settings'}
        </button>
      </div>
    </DashboardLayout>
  )
}
