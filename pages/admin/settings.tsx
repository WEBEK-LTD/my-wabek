// @ts-nocheck
import { useState, useEffect } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { useQuery, useMutation } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

const TABS = [
  { id: 'security',     label: '🔒 Security & OTP' },
  { id: 'registration', label: '👤 Registration' },
  { id: 'platform',     label: '⚙️ Platform' },
  { id: 'brand',        label: '🎨 Logo & Favicon' },
  { id: 'seo',          label: '🔍 SEO' },
  { id: 'smtp',         label: '📧 SMTP Email' },
  { id: 'webmaster',    label: '🌐 Webmaster' },
  { id: 'push',         label: '🔔 Push Notifications' },
]

export default function AdminSettingsPage() {
  const [tab, setTab] = useState('security')
  const [seoForm, setSeoForm] = useState({ meta_title: '', meta_description: '', og_image: '', ga_id: '', fb_pixel: '', custom_head_code: '' })
  const [brandForm, setBrandForm] = useState({ logo_url: '', favicon_url: '', logo_dark_url: '', app_icon_url: '', app_name: '', site_title: '' })
  const [smtpForm, setSmtpForm] = useState({ host: 'my.mailbux.com', port: '587', secure: 'tls', username: '', password: '', from_name: '', from_email: '' })
  const [pushForm, setPushForm] = useState({ vapid_public: '', vapid_private: '', enabled: false })
  const [webForm, setWebForm] = useState({ google_site_verification: '', bing_site_verification: '', pinterest_verification: '', yandex_verification: '', baidu_verification: '', norton_verification: '', sitemap_url: '', robots_txt: 'User-agent: *\nAllow: /\nSitemap: https://waabek.com/sitemap.xml' })
  const [smtpTest, setSmtpTest] = useState('')
  const [smtpTesting, setSmtpTesting] = useState(false)
  const [otpTestPhone, setOtpTestPhone] = useState('')
  const [otpTesting, setOtpTesting] = useState(false)
  const [otpTestResult, setOtpTestResult] = useState<any>(null)
  const [pushSendForm, setPushSendForm] = useState({ title: '', body: '', url: '/dashboard' })
  const [pushSending, setPushSending] = useState(false)
  const [pushStats, setPushStats] = useState<{sent?: number; total?: number} | null>(null)

  const { data: seoData } = useQuery('admin-seo', () => axios.get('/api/admin/seo').then(r => r.data), {
    onSuccess: d => {
      if (d.seo) setSeoForm(prev => ({ ...prev, ...d.seo }))
      if (d.brand) setBrandForm(prev => ({
        ...prev,
        ...d.brand,
        // Also pull site_title from seo since that's where it's saved
        site_title: d.seo?.site_title || d.brand?.site_title || '',
      }))
      if (d.smtp) setSmtpForm(prev => ({ ...prev, ...d.smtp }))
      if (d.push) setPushForm(prev => ({ ...prev, ...d.push }))
      // Load subscriber count
      axios.get('/api/push/count').then(r => setPushStats(s => ({...s, total: r.data.count}))).catch(()=>{})
      if (d.webmaster) setWebForm(prev => ({ ...prev, ...d.webmaster }))
    }
  })

  const saveSeoMut = useMutation(
    body => axios.put('/api/admin/seo', body),
    { onSuccess: () => toast.success('Saved ✅'), onError: e => toast.error(e?.response?.data?.error || 'Failed') }
  )
  const [settings, setSettings] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [instances, setInstances] = useState([])

  useEffect(() => {
    axios.get('/api/whatsapp/instances').then(r => {
      setInstances((r.data.instances || []).filter(i => i.status === 'connected'))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    axios.get('/api/admin/settings').then(r => { setSettings(r.data.settings); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const set = (key: string, value: unknown) => setSettings(s => ({ ...s, [key]: value }))
  const bool = (key: string) => settings[key] === true || settings[key] === 'true'

  const save = async () => {
    setSaving(true)
    try { await axios.put('/api/admin/settings', settings); toast.success('Settings saved ✅') }
    catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  const Toggle = ({ k, label, desc }: { k: string; label: string; desc?: string }) => (
    <div className="flex items-start justify-between py-3 border-b border-slate-200 last:border-0">
      <div className="flex-1 mr-4">
        <p className="text-sm font-medium text-slate-900">{label}</p>
        {desc && <p className="text-xs text-slate-500 mt-0.5">{desc}</p>}
      </div>
      <button onClick={() => set(k, !bool(k))}
        className={clsx('relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0', bool(k) ? 'bg-brand-500' : 'bg-slate-100')}>
        <span className={clsx('inline-block h-4 w-4 transform rounded-full bg-white transition-transform', bool(k) ? 'translate-x-6' : 'translate-x-1')} />
      </button>
    </div>
  )

  const Num = ({ k, label, desc, min = 0, max = 9999 }: { k: string; label: string; desc?: string; min?: number; max?: number }) => (
    <div className="flex items-center justify-between py-3 border-b border-slate-200 last:border-0">
      <div className="flex-1 mr-4">
        <p className="text-sm font-medium text-slate-900">{label}</p>
        {desc && <p className="text-xs text-slate-500 mt-0.5">{desc}</p>}
      </div>
      <input type="number" value={settings[k] as number ?? 0} onChange={e => set(k, parseInt(e.target.value))}
        min={min} max={max} className="input py-1 px-2 w-20 text-sm text-center" />
    </div>
  )

  const Txt = ({ k, label, desc, placeholder }: { k: string; label: string; desc?: string; placeholder?: string }) => (
    <div className="py-3 border-b border-slate-200 last:border-0">
      <p className="text-sm font-medium text-slate-900 mb-1">{label}</p>
      {desc && <p className="text-xs text-slate-500 mb-1">{desc}</p>}
      <input value={settings[k] as string || ''} onChange={e => set(k, e.target.value)} placeholder={placeholder} className="input text-sm" />
    </div>
  )

  const Sel = ({ k, label, desc, opts }: { k: string; label: string; desc?: string; opts: { v: string; l: string }[] }) => (
    <div className="py-3 border-b border-slate-200 last:border-0">
      <p className="text-sm font-medium text-slate-900 mb-1">{label}</p>
      {desc && <p className="text-xs text-slate-500 mb-1">{desc}</p>}
      <select value={settings[k] as string || ''} onChange={e => set(k, e.target.value)} className="input text-sm">
        {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  )

  if (loading) return <AdminLayout title="Platform Settings"><div className="skeleton h-64 rounded-xl" /></AdminLayout>

  return (
    <AdminLayout title="Platform Settings">
      <div className="flex items-center justify-between mb-6">
        <p className="text-slate-400 text-sm">Configure platform-wide settings for all users</p>
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? <><ArrowPathIcon className="w-4 h-4 animate-spin" /> Saving...</> : '💾 Save All'}
        </button>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={clsx('px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === t.id ? 'bg-brand-500 text-white' : 'bg-[#F8FAFC] text-slate-400 hover:text-white')}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="max-w-2xl space-y-4">

        {tab === 'security' && <>
          <div className="card">
            <h3 className="font-display font-semibold text-slate-900 mb-1">🔐 OTP Authentication</h3>
            <p className="text-xs text-slate-500 mb-3">Control WhatsApp OTP verification for all users</p>
            <Toggle k="otp_required_on_register" label="Require OTP on Registration"
              desc="New users must verify their WhatsApp number before accessing the platform" />
            <Sel k="otp_provider" label="OTP Provider" desc="WhatsApp connection used to send OTP codes"
              opts={[{ v: 'wa_web', l: '📱 WhatsApp Web (QR)' }, { v: 'cloud_api', l: '☁️ Cloud API (Meta)' }]} />
            <div className="py-3 border-b border-slate-200 last:border-0">
              <p className="text-sm font-medium text-slate-900 mb-1">OTP WhatsApp Instance</p>
              <p className="text-xs text-slate-500 mb-1">The connected WhatsApp number that sends OTP codes</p>
              <select value={settings['otp_instance_id'] as string || ''} onChange={e => set('otp_instance_id', e.target.value)} className="input text-sm">
                <option value="">Auto (first connected instance)</option>
                {instances.map(i => <option key={i.id} value={i.id}>{i.display_name || i.phone_number} ({i.instance_type === 'wa_web' ? '📱 WA Web' : '☁️ Cloud API'})</option>)}
              </select>
              {instances.length === 0 && <p className="text-xs text-yellow-500 mt-1">⚠️ No connected WhatsApp instances found</p>}
            </div>
            <Num k="otp_expiry_minutes" label="OTP Expiry (minutes)" desc="How long OTP codes stay valid" min={1} max={60} />
            <Num k="otp_max_attempts" label="Max OTP Attempts" desc="Failed attempts before OTP is invalidated" min={1} max={10} />
            <div className="py-3 border-b border-slate-200 last:border-0">
              <p className="text-sm font-medium text-slate-900 mb-1">OTP Template Name</p>
              <p className="text-xs text-slate-500 mb-1">
                Meta-approved Authentication template name for OTP. Defaults to{' '}
                <code className="bg-slate-100 px-1 rounded">wabek_otp</code> (parameter:{' '}
                <code className="bg-slate-100 px-1 rounded">otp_code</code>). Change this if
                your approved template has a different name (e.g. <code className="bg-slate-100 px-1 rounded">digits</code>).
              </p>
              <input
                type="text"
                value={settings['otp_template_name'] as string || ''}
                onChange={e => set('otp_template_name', e.target.value)}
                placeholder="wabek_otp"
                className="input text-sm font-mono"
                style={{maxWidth: 220}}
              />
              <div className="flex gap-2 mt-2">
                <span className="text-xs text-slate-500 self-center">Presets:</span>
                <button
                  type="button"
                  onClick={() => set('otp_template_name', 'wabek_otp')}
                  className={clsx(
                    'text-xs px-2 py-1 rounded border font-mono',
                    (settings['otp_template_name'] || 'wabek_otp') === 'wabek_otp'
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  )}
                >
                  wabek_otp
                </button>
                <button
                  type="button"
                  onClick={() => set('otp_template_name', 'digits')}
                  className={clsx(
                    'text-xs px-2 py-1 rounded border font-mono',
                    settings['otp_template_name'] === 'digits'
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  )}
                >
                  digits
                </button>
              </div>
            </div>
            <div className="py-3 border-b border-slate-200 last:border-0">
              <p className="text-sm font-medium text-slate-900 mb-1">🧪 Send Test OTP</p>
              <p className="text-xs text-slate-500 mb-2">
                Sends a real OTP (code <code className="bg-slate-100 px-1 rounded">123456</code>) using the
                template above, and shows exactly which language/format Meta accepted —
                or the exact error if it failed. <strong>Save settings first</strong> if you just changed the template name.
              </p>
              <div className="flex gap-2 items-center mb-2">
                <input
                  type="text"
                  value={otpTestPhone}
                  onChange={e => setOtpTestPhone(e.target.value)}
                  placeholder="201234567890 (with country code)"
                  className="input text-sm font-mono flex-1"
                  style={{maxWidth: 260}}
                />
                <button
                  onClick={async () => {
                    setOtpTesting(true)
                    setOtpTestResult(null)
                    try {
                      const r = await axios.post('/api/admin/otp-test', { phone: otpTestPhone })
                      setOtpTestResult(r.data)
                      if (r.data.success) toast.success('Test OTP sent ✅')
                      else toast.error('Test OTP failed — see details below')
                    } catch (e: any) {
                      setOtpTestResult({ success: false, error: e?.response?.data?.error || e.message })
                      toast.error('Request failed')
                    } finally {
                      setOtpTesting(false)
                    }
                  }}
                  disabled={otpTesting || !otpTestPhone}
                  className="btn-secondary text-sm whitespace-nowrap"
                >
                  {otpTesting ? '...' : '📤 Send Test'}
                </button>
              </div>

              {otpTestResult && (
                <div className={clsx(
                  'rounded-lg border p-3 text-xs font-mono space-y-1',
                  otpTestResult.success ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'
                )}>
                  {otpTestResult.success ? (
                    <>
                      <p className="text-green-700 font-semibold">✅ Sent successfully</p>
                      {otpTestResult.provider === 'wa_web' ? (
                        <p>{otpTestResult.note}</p>
                      ) : (
                        <>
                          <p>Configured template: <strong>{otpTestResult.templateName}</strong></p>
                          {otpTestResult.usedTemplateName && otpTestResult.usedTemplateName !== otpTestResult.templateName && (
                            <p className="text-amber-700">
                              ⚠ Configured template wasn't found — sent using fallback template
                              {' '}<strong>{otpTestResult.usedTemplateName}</strong> instead.
                              Consider updating OTP Template Name to match.
                            </p>
                          )}
                          <p>Template used: <strong>{otpTestResult.usedTemplateName}</strong></p>
                          <p>Language used: <strong>{otpTestResult.usedLanguage}</strong></p>
                          <p>Components used: <strong>{otpTestResult.usedComponents}</strong></p>
                          <p>Message ID: {otpTestResult.messageId}</p>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-red-700 font-semibold">❌ Failed</p>
                      {otpTestResult.error && <p>{otpTestResult.error}</p>}
                      {Array.isArray(otpTestResult.attempts) && (
                        <div className="mt-2 space-y-1 max-h-64 overflow-y-auto">
                          <p className="text-slate-600">Attempts ({otpTestResult.attempts.length}):</p>
                          {otpTestResult.attempts.map((a: any, i: number) => (
                            <p key={i} className="text-slate-600">
                              • template=<strong>{a.templateName}</strong> lang=<strong>{a.language}</strong> components=<strong>{a.components}</strong>
                              {' '}→ {a.ok ? '✅' : `❌ (${a.status || ''} ${a.error || ''})`}
                            </p>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="card">
            <h3 className="font-display font-semibold text-slate-900 mb-1">🛡️ Login Security</h3>
            <Num k="max_login_attempts" label="Max Failed Login Attempts"
              desc="Account locked after this many failed attempts" min={3} max={20} />
            <Num k="lockout_minutes" label="Lockout Duration (minutes)"
              desc="How long locked accounts stay locked" min={5} max={1440} />
            <Toggle k="require_strong_password" label="Require Strong Passwords"
              desc="Enforce minimum 8 characters" />
          </div>
          <div className="card">
            <h3 className="font-display font-semibold text-slate-900 mb-3">📊 Security Specs</h3>
            {[
              { l: 'Password Hashing', v: 'bcrypt (12 rounds)' },
              { l: 'JWT Algorithm', v: 'HS256 — 7 day expiry' },
              { l: 'API Keys', v: 'SHA-256 hashed in DB' },
              { l: 'OTP Codes', v: 'SHA-256 hashed, single-use' },
              { l: 'Device Tracking', v: 'Browser fingerprint + IP' },
              { l: 'Trusted Devices', v: '30-day expiry' },
            ].map(r => (
              <div key={r.l} className="flex justify-between py-2 border-b border-slate-200/50 last:border-0">
                <span className="text-slate-400 text-sm">{r.l}</span>
                <span className="text-blue-600 font-mono text-xs">{r.v}</span>
              </div>
            ))}
          </div>
        </>}

        {tab === 'registration' && <>
          <div className="card">
            <h3 className="font-display font-semibold text-slate-900 mb-1">👤 Registration</h3>
            <Toggle k="allow_registration" label="Allow New Registrations"
              desc="Disable to prevent new signups (invite-only mode)" />
            <Num k="default_trial_days" label="Trial Period (days)"
              desc="Free trial duration for new users" min={0} max={365} />
          </div>
        </>}

        {tab === 'platform' && <>
          <div className="card">
            <h3 className="font-display font-semibold text-slate-900 mb-1">⚙️ Platform</h3>
            <Txt k="platform_name" label="Platform Name" placeholder="WABEK" />
            <Txt k="platform_logo" label="Logo URL" placeholder="https://example.com/logo.png" />
            <Txt k="support_email" label="Support Email" placeholder="support@waabek.com" />
            <Toggle k="maintenance_mode" label="Maintenance Mode"
              desc="Show maintenance page to all non-admin users" />
          </div>
        </>}

        

        <div className="flex justify-end">
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? <><ArrowPathIcon className="w-4 h-4 animate-spin" /> Saving...</> : '💾 Save Settings'}
          </button>
        </div>
      {/* Brand / Logo */}
      {tab === 'brand' && (
        <div className="card max-w-xl space-y-5">
          <div>
            <h3 className="font-display font-semibold text-slate-900 mb-1">🎨 Brand & Identity</h3>
            <p className="text-xs text-slate-500">Manage your logo, favicon, and site name. All changes apply site-wide.</p>
          </div>

          {/* Site Name */}
          <div className="p-4 bg-[#F8FAFC] rounded-xl border border-slate-200">
            <p className="text-sm font-semibold text-slate-900 mb-3">Site Name & Browser Tab Title</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">App / Site Name</label>
                <div className="flex gap-2">
                  <input value={brandForm['app_name']||''} onChange={e=>setBrandForm(f=>({...f,app_name:e.target.value}))}
                    placeholder="WABEK" className="input flex-1 text-sm" />
                  <button onClick={async()=>{
                    try { await axios.post('/api/admin/save-brand-url',{url:brandForm['app_name'],field:'app_name'}); toast.success('Saved!') }
                    catch(e:any){ toast.error(e?.response?.data?.error||'Failed') }
                  }} className="btn-primary text-xs px-4">Save</button>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Browser Tab Title</label>
                <div className="flex gap-2">
                  <input value={brandForm['site_title']||''} onChange={e=>setBrandForm(f=>({...f,site_title:e.target.value}))}
                    placeholder="WABEK — WhatsApp Business Platform" className="input flex-1 text-sm" />
                  <button onClick={async()=>{
                    try {
                      await axios.put('/api/admin/seo', { seo: { site_title: brandForm['site_title'] || '' } })
                      // Keep seoForm in sync so full save doesn't overwrite
                      setSeoForm((prev: any) => ({ ...prev, site_title: brandForm['site_title'] || '' }))
                      toast.success('Browser tab title saved!')
                    } catch(e:any){ toast.error(e?.response?.data?.error || 'Failed to save') }
                  }} className="btn-primary text-xs px-4">Save</button>
                </div>
                <p className="text-xs text-slate-600 mt-1">Leave empty to use App Name</p>
              </div>
            </div>
          </div>

          {/* Logo Upload */}
          {[
            {label:'Logo',field:'logo_url',desc:'Shown in navbar, footer, and homepage. PNG/SVG recommended.'},
            {label:'Favicon',field:'favicon_url',desc:'Browser tab icon. 32×32px ICO or PNG recommended.'},
          ].map(({label,field,desc})=>(
            <div key={field} className="p-4 bg-[#F8FAFC] rounded-xl border border-slate-200">
              <p className="text-sm font-semibold text-slate-900 mb-1">{label}</p>
              <p className="text-slate-500 text-xs mb-3">{desc}</p>

              {/* Preview */}
              {brandForm[field] && (
                <div className="w-20 h-14 bg-white rounded-lg flex items-center justify-center border border-slate-200 mb-3 p-2">
                  <img src={brandForm[field]} alt="" className="max-w-full max-h-full object-contain"
                    onError={e=>(e.target as HTMLImageElement).style.display='none'} />
                </div>
              )}

              {/* URL Input */}
              <label className="text-xs text-slate-400 block mb-1">Image URL</label>
              <div className="flex gap-2 mb-3">
                <input
                  value={(brandForm[field]||'').startsWith('data:') ? '' : (brandForm[field]||'')}
                  onChange={e=>setBrandForm(f=>({...f,[field]:e.target.value}))}
                  placeholder="https://example.com/logo.png"
                  className="input flex-1 text-sm"
                />
                <button onClick={async()=>{
                  const url = brandForm[field]
                  if(!url||url.startsWith('data:')) return
                  try { await axios.post('/api/admin/save-brand-url',{url,field}); toast.success(`${label} saved!`) }
                  catch(e:any){ toast.error(e?.response?.data?.error||'Failed') }
                }} className="btn-primary text-xs px-4">Save</button>
              </div>

              {/* File Upload */}
              <label className="text-xs text-slate-400 block mb-1">Or upload a file</label>
              <div className="flex items-center gap-3">
                <input type="file" accept="image/*,image/svg+xml" id={`file-${field}`} className="hidden"
                  onChange={async e=>{
                    const file = e.target.files?.[0]; if(!file) return
                    const reader = new FileReader()
                    reader.onload = async ev=>{
                      const b64 = ev.target?.result as string
                      setBrandForm(f=>({...f,[field]:b64}))
                      try {
                        await axios.post('/api/admin/upload-logo',{imageBase64:b64,field})
                        toast.success(`${label} uploaded!`)
                      } catch(err:any){
                        toast.error(err?.response?.data?.error||'Upload failed')
                        setBrandForm(f=>({...f,[field]:''}))
                      }
                    }
                    reader.readAsDataURL(file)
                  }}
                />
                <label htmlFor={`file-${field}`} className="btn-secondary text-xs px-4 py-2 cursor-pointer">
                  📁 Upload file
                </label>
                {brandForm[field] && (
                  <button onClick={async()=>{
                    setBrandForm(f=>({...f,[field]:''}))
                    await axios.post('/api/admin/save-brand-url',{url:'',field})
                    toast.success('Removed')
                  }} className="text-red-400 text-xs hover:text-red-300">Remove</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

            {tab === 'seo' && (
        <div className="card max-w-xl space-y-4">
          <h3 className="font-display font-semibold text-slate-900 mb-1">🔍 SEO Settings</h3>
          <p className="text-xs text-slate-500 mb-4">Configure meta tags, analytics, and custom head code for the platform landing page.</p>
          <div>
            <label className="label">Meta Title</label>
            <input value={seoForm.meta_title} onChange={e => setSeoForm(f => ({ ...f, meta_title: e.target.value }))} placeholder={`${'{brandName}'} — WhatsApp Marketing Platform`} className="input" />
            <p className="text-xs text-slate-500 mt-1">Leave empty to use default. Max 60 characters recommended.</p>
          </div>
          <div>
            <label className="label">Meta Description</label>
            <textarea value={seoForm.meta_description} onChange={e => setSeoForm(f => ({ ...f, meta_description: e.target.value }))} rows={3} placeholder="Send WhatsApp campaigns, build chatbots..." className="input resize-none" />
            <p className="text-xs text-slate-500 mt-1">Max 160 characters recommended.</p>
          </div>
          <div>
            <label className="label">OG Image URL</label>
            <input value={seoForm.og_image} onChange={e => setSeoForm(f => ({ ...f, og_image: e.target.value }))} placeholder="https://cdn.example.com/og-image.png" className="input" />
            <p className="text-xs text-slate-500 mt-1">1200×630px recommended for social sharing.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Google Analytics ID</label>
              <input value={seoForm.ga_id} onChange={e => setSeoForm(f => ({ ...f, ga_id: e.target.value }))} placeholder="G-XXXXXXXXXX" className="input font-mono text-sm" />
            </div>
            <div>
              <label className="label">Facebook Pixel ID</label>
              <input value={seoForm.fb_pixel} onChange={e => setSeoForm(f => ({ ...f, fb_pixel: e.target.value }))} placeholder="123456789012345" className="input font-mono text-sm" />
            </div>
          </div>
          <div>
            <label className="label">Custom &lt;head&gt; Code</label>
            <textarea value={seoForm.custom_head_code} onChange={e => setSeoForm(f => ({ ...f, custom_head_code: e.target.value }))} rows={5} placeholder="<!-- Paste any custom scripts, meta tags, or tracking code here -->" className="input resize-none font-mono text-xs" />
            <p className="text-xs text-slate-500 mt-1">Injected into &lt;head&gt; on all pages. Use with caution.</p>
          </div>
          <button onClick={() => saveSeoMut.mutate({ seo: seoForm })} disabled={saveSeoMut.isLoading} className="btn-primary">
            {saveSeoMut.isLoading ? 'Saving...' : '💾 Save SEO Settings'}
          </button>
        </div>
      )}

      {/* SMTP Email */}
      {tab === 'smtp' && (
        <div className="card max-w-xl space-y-4">
          <h3 className="font-display font-semibold text-slate-900 mb-1">📧 SMTP Email Configuration</h3>
          <div className="p-3 bg-blue-50/20 border border-blue-200/40 rounded-xl text-xs text-slate-400 space-y-1">
            <p className="text-blue-600 font-medium">Quick Setup: my.mailbux.com</p>
            <p>SMTP: my.mailbux.com:587 (TLS) · SMTPS: my.mailbux.com:465 (SSL)</p>
            <p>IMAP: my.mailbux.com:993 · POP3: my.mailbux.com:995</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">SMTP Host</label><input value={smtpForm.host} onChange={e => setSmtpForm(f => ({...f, host: e.target.value}))} placeholder="my.mailbux.com" className="input"/></div>
            <div><label className="label">Port</label><input value={smtpForm.port} onChange={e => setSmtpForm(f => ({...f, port: e.target.value}))} placeholder="587" className="input"/></div>
            <div><label className="label">Security</label>
              <select value={smtpForm.secure} onChange={e => setSmtpForm(f => ({...f, secure: e.target.value}))} className="input">
                <option value="tls">TLS/STARTTLS (587)</option>
                <option value="ssl">SSL (465)</option>
                <option value="none">None</option>
              </select>
            </div>
            <div><label className="label">Username (full email)</label><input value={smtpForm.username} onChange={e => setSmtpForm(f => ({...f, username: e.target.value}))} placeholder="noreply@yourdomain.com" className="input"/></div>
            <div><label className="label">Password</label><input type="password" value={smtpForm.password} onChange={e => setSmtpForm(f => ({...f, password: e.target.value}))} placeholder="••••••••" className="input"/></div>
            <div><label className="label">From Name</label><input value={smtpForm.from_name} onChange={e => setSmtpForm(f => ({...f, from_name: e.target.value}))} placeholder="WABEK" className="input"/></div>
            <div><label className="label">From Email</label><input value={smtpForm.from_email} onChange={e => setSmtpForm(f => ({...f, from_email: e.target.value}))} placeholder="noreply@yourdomain.com" className="input"/></div>
          </div>
          <div className="flex items-center gap-2">
            <input value={smtpTest} onChange={e => setSmtpTest(e.target.value)} placeholder="test@example.com" className="input flex-1" />
            <button onClick={async () => {
              setSmtpTesting(true)
              try {
                await axios.post('/api/admin/test-smtp', { ...smtpForm, to: smtpTest })
                toast.success('Test email sent! ✅')
              } catch(e) { toast.error(e?.response?.data?.error || 'SMTP test failed') }
              setSmtpTesting(false)
            }} disabled={smtpTesting || !smtpTest} className="btn-secondary text-sm whitespace-nowrap">
              {smtpTesting ? '...' : '📤 Test'}
            </button>
          </div>
          <button onClick={() => saveSeoMut.mutate({ smtp: smtpForm })} disabled={saveSeoMut.isLoading} className="btn-primary">
            {saveSeoMut.isLoading ? 'Saving...' : '💾 Save SMTP Settings'}
          </button>
        </div>
      )}

      {/* Webmaster Tools */}
      {tab === 'webmaster' && (
        <div className="card max-w-xl space-y-4">
          <h3 className="font-display font-semibold text-slate-900 mb-1">🌐 Webmaster & Search Engines</h3>
          <p className="text-xs text-slate-500">Verify site ownership with search engines to unlock indexing, analytics, and ranking tools</p>
          {[
            { label: '🔍 Google Search Console', key: 'google_site_verification', placeholder: 'Google verification code', link: 'https://search.google.com/search-console', desc: 'Get from Search Console → Add property → HTML tag method' },
            { label: '🔵 Bing Webmaster Tools', key: 'bing_site_verification', placeholder: 'Bing verification content', link: 'https://www.bing.com/webmasters', desc: 'Get from Bing Webmaster → Add site → XML meta tag' },
            { label: '📌 Pinterest', key: 'pinterest_verification', placeholder: '67f0db54e40ee97b1eeb7675f199e477', link: 'https://www.pinterest.com/settings/claim', desc: 'Paste only the content value from <meta name="p:domain_verify" content="..."/>' },
            { label: '🟡 Yandex Webmaster', key: 'yandex_verification', placeholder: 'Yandex verification code', link: 'https://webmaster.yandex.com', desc: 'For Russian search market' },
            { label: '🔴 Baidu Webmaster', key: 'baidu_verification', placeholder: 'Baidu verification code', link: 'https://zhanzhang.baidu.com', desc: 'For Chinese search market' },
          ].map(({ label, key, placeholder, link, desc }) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">{label}</label>
                <a href={link} target="_blank" className="text-xs text-blue-600 hover:text-blue-500">Get code →</a>
              </div>
              <input value={webForm[key]} onChange={e => setWebForm(f => ({...f, [key]: e.target.value}))} placeholder={placeholder} className="input font-mono text-sm"/>
              <p className="text-xs text-slate-600 mt-1">{desc}</p>
            </div>
          ))}
          <div>
            <label className="label">Sitemap URL</label>
            <input value={webForm.sitemap_url} onChange={e => setWebForm(f => ({...f, sitemap_url: e.target.value}))} placeholder="https://waabek.com/sitemap.xml" className="input"/>
          </div>
          <div>
            <label className="label">robots.txt Content</label>
            <textarea value={webForm.robots_txt} onChange={e => setWebForm(f => ({...f, robots_txt: e.target.value}))} rows={4} className="input font-mono text-xs resize-none"/>
          </div>
          <div className="p-3 bg-[#F8FAFC] border border-slate-200 rounded-xl space-y-2">
            <p className="text-xs font-medium text-slate-900">🚀 SEO Quick Actions</p>
            {[
              { label: 'Submit sitemap to Google', href: 'https://search.google.com/search-console/sitemaps' },
              { label: 'Submit sitemap to Bing', href: 'https://www.bing.com/webmasters/sitemaps' },
              { label: 'Check Google PageSpeed', href: 'https://pagespeed.web.dev/' },
              { label: 'Test structured data', href: 'https://search.google.com/test/rich-results' },
            ].map(a => (
              <a key={a.label} href={a.href} target="_blank" className="flex items-center justify-between text-xs text-slate-400 hover:text-slate-900 py-1">
                {a.label} <span className="text-slate-600">→</span>
              </a>
            ))}
          </div>
          <button onClick={() => saveSeoMut.mutate({ webmaster: webForm })} disabled={saveSeoMut.isLoading} className="btn-primary">
            {saveSeoMut.isLoading ? 'Saving...' : '💾 Save Webmaster Settings'}
          </button>
        </div>
      )}

      {/* Push Notifications */}
      {tab === 'push' && (
        <div className="card max-w-xl space-y-5">
          <div>
            <h3 className="font-display font-semibold text-slate-900 mb-1">🔔 Push Notifications</h3>
            <p className="text-xs text-slate-500">Send instant browser push notifications to subscribed users — works on Chrome, Firefox, Edge desktop and mobile.</p>
          </div>

          {/* Subscriber count */}
          <div className="flex items-center gap-3 bg-[#F8FAFC] rounded-xl border border-slate-200 px-4 py-3">
            <div className="w-9 h-9 rounded-lg bg-brand-500/10 flex items-center justify-center flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
            </div>
            <div>
              <p className="text-slate-900 font-semibold text-sm" id="push-count-display">
                {pushStats?.total != null ? `${pushStats.total} subscribers` : 'Loading...'}
              </p>
              <p className="text-xs text-slate-500">Users with push notifications enabled</p>
            </div>
            <button onClick={async () => {
              try { const r = await axios.get('/api/push/count'); setPushStats(s => ({...s, total: r.data.count})) }
              catch {}
            }} className="ml-auto text-xs text-slate-500 hover:text-slate-900">↻ Refresh</button>
          </div>

          {/* VAPID Keys */}
          <div className="p-4 bg-[#F8FAFC] rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">VAPID Keys</p>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pushForm.vapid_public ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                {pushForm.vapid_public ? '✓ Configured' : '⚠ Not set'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Generate keys at <a href="https://vapidkeys.com" target="_blank" className="text-blue-600 hover:underline">vapidkeys.com</a> or run: <code className="text-blue-600 bg-white px-1 rounded">npx web-push generate-vapid-keys</code>
            </p>
            <div>
              <label className="label">VAPID Public Key</label>
              <input value={pushForm.vapid_public} onChange={e => setPushForm(f => ({...f, vapid_public: e.target.value}))}
                placeholder="BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjZJtHZ..." className="input font-mono text-xs" />
            </div>
            <div>
              <label className="label">VAPID Private Key</label>
              <input type="password" value={pushForm.vapid_private} onChange={e => setPushForm(f => ({...f, vapid_private: e.target.value}))}
                placeholder="••••••••••••••••" className="input font-mono text-xs" />
            </div>
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <button onClick={() => setPushForm(f => ({...f, enabled: !f.enabled}))}
                  className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${pushForm.enabled?'bg-brand-500':'bg-slate-100'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform m-0.5 ${pushForm.enabled?'translate-x-4':'translate-x-0'}`}/>
                </button>
                <span className="text-sm text-slate-900">Enable push for users</span>
              </div>
              <button onClick={() => saveSeoMut.mutate({ push: pushForm })} disabled={saveSeoMut.isLoading} className="btn-primary text-xs px-4">
                {saveSeoMut.isLoading ? 'Saving...' : '💾 Save Keys'}
              </button>
            </div>
          </div>

          {/* Send notification */}
          {pushForm.vapid_public && (
          <div className="p-4 bg-[#F8FAFC] rounded-xl border border-slate-200 space-y-3">
            <p className="text-sm font-semibold text-slate-900">📤 Send Push Notification</p>
            {pushStats?.sent != null && (
              <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/10 rounded-lg px-3 py-2">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                Sent to {pushStats.sent} / {pushStats.total} subscribers
              </div>
            )}
            <div>
              <label className="label">Title *</label>
              <input value={pushSendForm.title} onChange={e => setPushSendForm(f => ({...f, title: e.target.value}))}
                placeholder="New message!" className="input" />
            </div>
            <div>
              <label className="label">Body *</label>
              <textarea value={pushSendForm.body} onChange={e => setPushSendForm(f => ({...f, body: e.target.value}))}
                rows={2} placeholder="You have a new WhatsApp message" className="input resize-none" />
            </div>
            <div>
              <label className="label">Click URL</label>
              <input value={pushSendForm.url} onChange={e => setPushSendForm(f => ({...f, url: e.target.value}))}
                placeholder="/dashboard" className="input" />
            </div>
            <button onClick={async () => {
              if (!pushSendForm.title || !pushSendForm.body) { toast.error('Title and body required'); return }
              setPushSending(true)
              try {
                const r = await axios.post('/api/push/send', pushSendForm)
                setPushStats(r.data)
                toast.success(`Sent to ${r.data.sent} users! 🔔`)
                setPushSendForm({ title: '', body: '', url: '/dashboard' })
              } catch(e: any) { toast.error(e?.response?.data?.error || 'Failed to send') }
              setPushSending(false)
            }} disabled={pushSending || !pushSendForm.title || !pushSendForm.body} className="btn-primary w-full">
              {pushSending ? '📤 Sending...' : `🔔 Send to All Subscribers`}
            </button>
          </div>
          )}

          {/* How it works */}
          <div className="p-4 bg-[#F8FAFC] rounded-xl border border-slate-200">
            <p className="text-sm font-semibold text-slate-900 mb-2">How it works</p>
            <ol className="space-y-1.5">
              {['Set your VAPID keys and save','Users see "Enable Notifications" button in their dashboard','They click it and allow notifications in browser','You send push notifications from here — they appear on desktop and mobile'].map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                  <span className="w-4 h-4 rounded-full bg-brand-500/20 text-blue-600 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">{i+1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      </div>
    </AdminLayout>
  )
}