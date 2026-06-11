// @ts-nocheck
import { useState, useEffect } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import axios from 'axios'
import toast from 'react-hot-toast'
import Head from 'next/head'

const BUILT_IN_TEMPLATES = [
  { key:'OTP',                   name:'wabek_otp',             params:['otp_code'],       use:'OTP / Verification codes (positional {{1}})' },
  { key:'WELCOME',                name:'welcome_message_v2',    params:[],                 use:'New customer welcome (no variables)' },
  { key:'WELCOME_V1',             name:'welcome_message',       params:[],                 use:'Welcome (legacy, no variables)' },
  { key:'SUPPORT_TICKET_OPEN',    name:'support_ticket_update', params:['customer_name'],  use:'Service update notification' },
  { key:'SUPPORT_REPLY',          name:'support_reply',         params:['message'],        use:'Support team reply' },
  { key:'MARKETING',              name:'marketing_offer',       params:['customer_name','offer_details'],  use:'Marketing campaigns' },
  { key:'BROADCAST',              name:'broadcast_notification',params:['customer_name'],  use:'Bulk announcements' },
  { key:'INVOICE_CREATED',        name:'invoice_created',       params:['customer_name'],  use:'New invoice' },
  { key:'INVOICE_OVERDUE',        name:'invoice_overdue',       params:['customer_name'],  use:'Overdue invoice' },
  { key:'PAYMENT_REMINDER',       name:'payment_reminder',      params:['customer_name'],  use:'Payment reminder' },
  { key:'SERVICE_NOTIFICATION',   name:'service_notification',  params:['customer_name'],  use:'General service update' },
  { key:'AI_FOLLOWUP',            name:'ai_assistant_followup', params:['customer_name'],  use:'AI assistant follow-up' },
  { key:'PASSWORD_RESET',         name:'password_reset',        params:['customer_name'],  use:'Password reset notification' },
]

export default function WATemplatesPage() {
  const [config, setConfig]   = useState<Record<string,any>>({})
  const [saving, setSaving]   = useState(false)
  const [testing, setTesting] = useState<string|null>(null)
  const [testPhone, setTestPhone] = useState('')

  useEffect(() => {
    axios.get('/api/admin/wa-templates').then(r => setConfig(r.data.templates || r.data.defaults || {})).catch(()=>{})
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await axios.post('/api/admin/wa-templates', { templates: config })
      toast.success('Templates saved ✅')
    } catch { toast.error('Failed to save') }
    setSaving(false)
  }

  const test = async (templateKey: string) => {
    if (!testPhone) { toast.error('Enter a phone number first'); return }
    setTesting(templateKey)
    try {
      await axios.post('/api/admin/wa-templates/test', { templateKey, phone: testPhone })
      toast.success('Test message sent!')
    } catch(e: any) {
      toast.error(e?.response?.data?.error || 'Test failed')
    }
    setTesting(null)
  }

  return (
    <>
      <Head><title>WhatsApp Templates — Admin</title></Head>
      <AdminLayout>
        <div className="max-w-3xl mx-auto space-y-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">WhatsApp Templates</h1>
            <p className="text-slate-500 text-sm mt-1">
              These are the Meta-approved templates used when sending outside the 24-hour customer service window.
            </p>
          </div>

          {/* 24h Window Explainer */}
          <div className="rounded-xl p-4 bg-blue-50 border border-blue-200">
            <p className="text-blue-700 font-semibold text-sm mb-1">How the 24-hour window works</p>
            <p className="text-slate-600 text-xs leading-relaxed">
              When a customer messages you, you have 24 hours to reply freely with any text.
              After 24 hours, Meta requires you to use an approved template.
              WABEK automatically detects the window and switches to templates when needed.
            </p>
          </div>

          {/* Test phone input */}
          <div className="card p-4 flex items-center gap-3">
            <div className="flex-1">
              <label className="label">Test Phone Number</label>
              <input value={testPhone} onChange={e=>setTestPhone(e.target.value)}
                placeholder="201234567890 (international format, no +)" className="input w-full mt-1" />
            </div>
          </div>

          {/* Templates list */}
          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200">
              <h2 className="font-semibold text-slate-900 text-sm">Built-in Templates ({BUILT_IN_TEMPLATES.length})</h2>
            </div>
            <div className="divide-y divide-wabek-border">
              {BUILT_IN_TEMPLATES.map(tmpl => (
                <div key={tmpl.key} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <code className="text-green-700 text-sm font-mono bg-green-50 px-2 py-0.5 rounded">{tmpl.name}</code>
                        {tmpl.key !== tmpl.name && (
                          <span className="text-xs text-slate-600">key: {tmpl.key}</span>
                        )}
                      </div>
                      <p className="text-slate-600 text-xs mb-2">{tmpl.use}</p>
                      {tmpl.params.length > 0 ? (
                        <div className="flex gap-1.5 flex-wrap">
                          {tmpl.params.map(p => (
                            <span key={p} className="text-xs bg-slate-50 border border-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono">
                              {'{{'}{p}{'}}'}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-600 italic">No parameters</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <button
                        onClick={() => test(tmpl.key)}
                        disabled={testing === tmpl.key || !testPhone}
                        className="btn-secondary text-xs py-1.5 px-3">
                        {testing === tmpl.key ? 'Sending...' : 'Test'}
                      </button>
                    </div>
                  </div>

                  {/* Custom template name override */}
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs text-slate-500 flex-shrink-0">Override Meta template name:</span>
                    <input
                      value={config[tmpl.key] || ''}
                      onChange={e => setConfig(cfg => ({...cfg, [tmpl.key]: e.target.value}))}
                      placeholder={tmpl.name}
                      className="input text-xs py-1 flex-1 max-w-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Window behavior settings */}
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-slate-900 text-sm">Window Behavior Settings</h2>
            <div className="space-y-3">
              {[
                { key:'default_campaign_template', label:'Default campaign template', placeholder:'marketing_offer', desc:'Used when no template is selected for a campaign' },
                { key:'default_support_template',  label:'Default support reply template', placeholder:'support_ticket_update', desc:'Used for support replies outside 24h window' },
                { key:'default_ai_template',       label:'Default AI assistant template', placeholder:'ai_assistant_followup', desc:'Used for AI replies outside 24h window' },
              ].map(s => (
                <div key={s.key}>
                  <label className="label">{s.label}</label>
                  <p className="text-xs text-slate-500 mb-1">{s.desc}</p>
                  <input
                    value={config[s.key] || ''}
                    onChange={e => setConfig(cfg => ({...cfg, [s.key]: e.target.value}))}
                    placeholder={s.placeholder}
                    className="input w-full"
                  />
                </div>
              ))}
            </div>
          </div>

          <button onClick={save} disabled={saving} className="btn-primary w-full py-3 font-bold">
            {saving ? 'Saving...' : '💾 Save Template Configuration'}
          </button>
        </div>
      </AdminLayout>
    </>
  )
}
