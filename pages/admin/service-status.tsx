// @ts-nocheck
import { useState, useEffect } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import axios from 'axios'
import toast from 'react-hot-toast'
import Head from 'next/head'

const SERVICES = [
  { key:'api',       name:'API and Core Platform',    icon:'🖥️' },
  { key:'whatsapp',  name:'WhatsApp Message Delivery', icon:'💬' },
  { key:'dashboard', name:'Dashboard and Web App',     icon:'📊' },
  { key:'campaigns', name:'Bulk Campaigns',            icon:'📢' },
  { key:'chatbot',   name:'Chatbot Engine',            icon:'🤖' },
  { key:'auth',      name:'Authentication and OTP',    icon:'🔐' },
  { key:'webhooks',  name:'Webhooks and Integrations', icon:'🔗' },
  { key:'storage',   name:'File Storage and Media',    icon:'💾' },
]

const STATUS_CONFIG: Record<string,{label:string;color:string;bg:string;border:string}> = {
  operational: { label:'Operational', color:'#166534', bg:'#f0fdf4', border:'#bbf7d0' },
  degraded:    { label:'Degraded',    color:'#92400e', bg:'#fffbeb', border:'#fde68a' },
  outage:      { label:'Outage',      color:'#991b1b', bg:'#fef2f2', border:'#fecaca' },
  maintenance: { label:'Maintenance', color:'#3730a3', bg:'#eef2ff', border:'#c7d2fe' },
}

type SvcStatus = 'operational'|'degraded'|'outage'|'maintenance'

export default function ServiceStatusPage() {
  const [tab, setTab] = useState<'status'|'incidents'|'subscribers'|'messages'>('status')
  const [services, setServices] = useState<Record<string,SvcStatus>>({})
  const [saving, setSaving] = useState(false)
  const [incidents, setIncidents] = useState<any[]>([])
  const [subscribers, setSubscribers] = useState<any[]>([])
  const [contactMessages, setContactMessages] = useState<any[]>([])
  const [newInc, setNewInc] = useState({ title:'', status:'resolved', duration:'', incident_date: new Date().toISOString().split('T')[0] })
  const [addingInc, setAddingInc] = useState(false)

  useEffect(() => {
    axios.get('/api/admin/service-status').then(r => {
      const data = r.data.services || {}
      const map: Record<string,SvcStatus> = {}
      SERVICES.forEach(s => { map[s.key] = data[s.key] || 'operational' })
      setServices(map)
    })
    axios.get('/api/status/incidents').then(r => setIncidents(r.data.incidents || []))
    axios.get('/api/admin/status-subscribers').then(r => setSubscribers(r.data.subscribers || [])).catch(()=>{})
    axios.get('/api/status/contact').then(r => setContactMessages(r.data.messages || [])).catch(()=>{})
  }, [])

  const saveServices = async () => {
    setSaving(true)
    try {
      await axios.post('/api/admin/service-status', { services })
      toast.success('Status updated ✅')
    } catch { toast.error('Failed') }
    setSaving(false)
  }

  const allOk = SERVICES.every(s => (services[s.key] || 'operational') === 'operational')

  return (
    <>
      <Head><title>Service Status — Admin</title></Head>
      <AdminLayout>
        <div className="max-w-3xl mx-auto space-y-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Service Status</h1>
            <p className="text-slate-400 text-sm mt-1">Manage what visitors see on <a href="/status" target="_blank" className="text-blue-600 hover:underline">waabek.com/status</a></p>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 flex-wrap">
            {([['status','🟢 Status'],['incidents','⚠️ Incidents'],['subscribers','🔔 Subscribers'],['messages','✉️ Messages']] as [string,string][]).map(([t,l]) => (
              <button key={t} onClick={() => setTab(t as any)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab===t?'bg-brand-500 text-slate-900':'btn-secondary'}`}>
                {l} {t==='subscribers'&&subscribers.length?`(${subscribers.length})`:''}
                {t==='messages'&&contactMessages.filter(m=>m.status==='new').length?` (${contactMessages.filter(m=>m.status==='new').length})`:''}
              </button>
            ))}
          </div>

          {/* ─── Status Tab ─── */}
          {tab === 'status' && <>
            <div className={`rounded-xl p-4 flex items-center gap-3 ${allOk?'bg-green-500/10 border border-green-500/20':'bg-yellow-500/10 border border-yellow-500/20'}`}>
              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${allOk?'bg-green-500':'bg-yellow-500'}`}/>
              <p className={`font-semibold text-sm ${allOk?'text-green-400':'text-yellow-400'}`}>
                {allOk ? '✓ All systems operational' : '⚠ Some services need attention'}
              </p>
            </div>

            <div className="card space-y-0 p-0 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200">
                <h2 className="font-semibold text-slate-900 text-sm">Service Health</h2>
              </div>
              {SERVICES.map((svc, i) => {
                const st: SvcStatus = services[svc.key] || 'operational'
                const cfg = STATUS_CONFIG[st]
                return (
                  <div key={svc.key} className={`px-5 py-4 ${i<SERVICES.length-1?'border-b border-slate-200':''}`}>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{svc.icon}</span>
                          <span className="font-medium text-slate-900 text-sm">{svc.name}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap justify-end">
                        {(['operational','degraded','outage','maintenance'] as SvcStatus[]).map(val => (
                          <button key={val} onClick={() => setServices(s => ({...s,[svc.key]:val}))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize ${st===val?'opacity-100 scale-105':'opacity-35 hover:opacity-70'}`}
                            style={st===val ? { background:STATUS_CONFIG[val].bg, color:STATUS_CONFIG[val].color, borderColor:STATUS_CONFIG[val].border } : { background:'transparent', color:'#6B7280', borderColor:'#374151' }}>
                            {val === 'operational' ? '●' : val === 'degraded' ? '◐' : val === 'outage' ? '✕' : '⚙'} {STATUS_CONFIG[val].label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setServices(Object.fromEntries(SERVICES.map(s => [s.key,'operational'])) as any)} className="btn-secondary text-sm">✓ All Operational</button>
              <button onClick={saveServices} disabled={saving} className="btn-primary flex-1 py-3 font-bold">
                {saving ? 'Saving...' : '💾 Save and Publish'}
              </button>
            </div>
          </>}

          {/* ─── Incidents Tab ─── */}
          {tab === 'incidents' && <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-900">Past Incidents ({incidents.length})</h2>
              <button onClick={() => setAddingInc(v=>!v)} className="btn-primary text-sm">+ Add Incident</button>
            </div>

            {addingInc && (
              <div className="card p-4 space-y-3 border border-brand-500/30">
                <p className="font-semibold text-slate-900 text-sm">New Incident</p>
                <input value={newInc.title} onChange={e=>setNewInc(i=>({...i,title:e.target.value}))}
                  placeholder="e.g. Increased latency on WhatsApp API" className="input w-full" />
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="label">Status</label>
                    <select value={newInc.status} onChange={e=>setNewInc(i=>({...i,status:e.target.value}))} className="input w-full">
                      {['resolved','investigating','identified','monitoring'].map(s=><option key={s} value={s} className="capitalize">{s}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="label">Duration</label>
                    <input value={newInc.duration} onChange={e=>setNewInc(i=>({...i,duration:e.target.value}))} placeholder="e.g. 45 min" className="input w-full" />
                  </div>
                  <div className="flex-1">
                    <label className="label">Date</label>
                    <input type="date" value={newInc.incident_date} onChange={e=>setNewInc(i=>({...i,incident_date:e.target.value}))} className="input w-full" />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={()=>setAddingInc(false)} className="btn-secondary flex-1">Cancel</button>
                  <button onClick={async()=>{
                    if(!newInc.title){toast.error('Title required');return}
                    try{
                      const r = await axios.post('/api/status/incidents',newInc)
                      setIncidents(i=>[r.data.incident,...i])
                      setAddingInc(false)
                      setNewInc({title:'',status:'resolved',duration:'',incident_date:new Date().toISOString().split('T')[0]})
                      toast.success('Incident added and live on /status ✅')
                    }catch{toast.error('Failed')}
                  }} className="btn-primary flex-1">Save</button>
                </div>
              </div>
            )}

            <div className="card p-0 overflow-hidden">
              {incidents.length===0 ? <div className="p-6 text-center text-slate-500 text-sm">No incidents recorded.</div>
              : incidents.map(inc=>(
                <div key={inc.id} className="flex items-center justify-between px-4 py-3 border-b border-slate-200 last:border-b-0">
                  <div>
                    <p className="text-slate-900 text-sm font-semibold">{inc.title}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{inc.incident_date}{inc.duration&&` · ${inc.duration}`}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${inc.status==='resolved'?'bg-green-500/10 text-green-400':'bg-yellow-500/10 text-yellow-400'}`}>{inc.status}</span>
                    <button onClick={async()=>{
                      await axios.delete('/api/status/incidents',{data:{id:inc.id}})
                      setIncidents(i=>i.filter(x=>x.id!==inc.id))
                      toast.success('Deleted')
                    }} className="text-red-400 hover:text-red-300 text-xs">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>}

          {/* ─── Subscribers Tab ─── */}
          {tab === 'subscribers' && <div className="space-y-4">
            <h2 className="font-bold text-slate-900">Subscribers ({subscribers.length})</h2>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="card p-4 text-center"><p className="text-2xl font-bold text-blue-600">{subscribers.length}</p><p className="text-xs text-slate-500 mt-1">Total</p></div>
              <div className="card p-4 text-center"><p className="text-2xl font-bold text-blue-400">{subscribers.filter(s=>s.type==='email').length}</p><p className="text-xs text-slate-500 mt-1">Email</p></div>
              <div className="card p-4 text-center"><p className="text-2xl font-bold text-green-400">{subscribers.filter(s=>s.type==='phone').length}</p><p className="text-xs text-slate-500 mt-1">Phone</p></div>
            </div>
            <div className="card p-0 overflow-hidden">
              {subscribers.length===0 ? <div className="p-6 text-center text-slate-500 text-sm">No subscribers yet.</div>
              : <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-200 text-xs text-slate-500 uppercase">
                  <th className="px-4 py-2.5 text-left">Type</th>
                  <th className="px-4 py-2.5 text-left">Value</th>
                  <th className="px-4 py-2.5 text-left">Date</th>
                </tr></thead>
                <tbody>{subscribers.map(s=>(
                  <tr key={s.id} className="border-b border-slate-200/40 hover:bg-white/40">
                    <td className="px-4 py-2.5"><span className={`text-xs font-semibold px-2 py-0.5 rounded ${s.type==='email'?'bg-blue-500/10 text-blue-400':'bg-green-500/10 text-green-400'}`}>{s.type==='email'?'✉️ Email':'📱 Phone'}</span></td>
                    <td className="px-4 py-2.5 text-slate-900 font-mono text-xs">{s.value}</td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs">{new Date(s.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}</tbody>
              </table>}
            </div>
          </div>}

          {/* ─── Messages Tab ─── */}
          {tab === 'messages' && <div className="space-y-4">
            <h2 className="font-bold text-slate-900">Contact Messages ({contactMessages.length})</h2>
            <div className="card p-0 overflow-hidden">
              {contactMessages.length===0 ? <div className="p-6 text-center text-slate-500 text-sm">No messages yet.</div>
              : contactMessages.map(msg=>(
                <div key={msg.id} className="px-4 py-4 border-b border-slate-200 last:border-b-0">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <span className="text-slate-900 font-semibold text-sm">{msg.name}</span>
                      <span className="text-slate-500 text-xs ml-2">{msg.email}</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded font-semibold flex-shrink-0 ${msg.status==='new'?'bg-red-500/10 text-red-400 border border-red-500/20':'bg-green-500/10 text-green-400'}`}>{msg.status}</span>
                  </div>
                  <p className="text-slate-700 text-sm font-medium mb-1">{msg.subject}</p>
                  <p className="text-slate-400 text-sm">{msg.message}</p>
                  <p className="text-slate-600 text-xs mt-2">{new Date(msg.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>}

        </div>
      </AdminLayout>
    </>
  )
}
