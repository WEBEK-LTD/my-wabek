// @ts-nocheck
import Head from 'next/head'
import { useState, useEffect } from 'react'
import axios from 'axios'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import PublicNav from '@/components/PublicNav'
import PublicFooter from '@/components/PublicFooter'

// Country codes for phone subscription
const COUNTRIES = [
  { code: '+966', flag: '🇸🇦', name: 'Saudi Arabia' },
  { code: '+971', flag: '🇦🇪', name: 'UAE' },
  { code: '+965', flag: '🇰🇼', name: 'Kuwait' },
  { code: '+974', flag: '🇶🇦', name: 'Qatar' },
  { code: '+973', flag: '🇧🇭', name: 'Bahrain' },
  { code: '+968', flag: '🇴🇲', name: 'Oman' },
  { code: '+20', flag: '🇪🇬', name: 'Egypt' },
  { code: '+90', flag: '🇹🇷', name: 'Turkey' },
  { code: '+1', flag: '🇺🇸', name: 'USA' },
  { code: '+44', flag: '🇬🇧', name: 'UK' },
  { code: '+33', flag: '🇫🇷', name: 'France' },
  { code: '+49', flag: '🇩🇪', name: 'Germany' },
]

const SVGS: Record<string,any> = {
  api:       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
  whatsapp:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  dashboard: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  campaigns: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2L15 22 11 13 2 9l20-7z"/></svg>,
  chatbot:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><circle cx="8" cy="10" r="1.5" fill="currentColor"/><circle cx="12" cy="10" r="1.5" fill="currentColor"/><circle cx="16" cy="10" r="1.5" fill="currentColor"/></svg>,
  auth:      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  webhooks:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>,
  storage:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>,
}

const SERVICES = [
  { key:'api', color:'#25D366', bg:'#f0fdf4' },
  { key:'whatsapp', color:'#25D366', bg:'#f0fdf4' },
  { key:'dashboard', color:'#0ea5e9', bg:'#f0f9ff' },
  { key:'campaigns', color:'#a855f7', bg:'#faf5ff' },
  { key:'chatbot', color:'#f59e0b', bg:'#fffbeb' },
  { key:'auth', color:'#0ea5e9', bg:'#f0f9ff' },
  { key:'webhooks', color:'#6366f1', bg:'#eef2ff' },
  { key:'storage', color:'#ec4899', bg:'#fdf2f8' },
]

const SVC_NAMES: Record<string,string> = {
  api:'API and Core Platform', whatsapp:'WhatsApp Message Delivery',
  dashboard:'Dashboard and Web App', campaigns:'Bulk Campaigns',
  chatbot:'Chatbot Engine', auth:'Authentication and OTP',
  webhooks:'Webhooks and Integrations', storage:'File Storage and Media',
}

const STATUS_META: Record<string,any> = {
  operational: { label:'Operational', dot:'#25D366', badge:'#166534', badgeBg:'#f0fdf4', badgeBorder:'#bbf7d0' },
  degraded:    { label:'Degraded',    dot:'#f59e0b', badge:'#92400e', badgeBg:'#fffbeb', badgeBorder:'#fde68a' },
  outage:      { label:'Outage',      dot:'#ef4444', badge:'#991b1b', badgeBg:'#fef2f2', badgeBorder:'#fecaca' },
  maintenance: { label:'Maintenance', dot:'#6366f1', badge:'#3730a3', badgeBg:'#eef2ff', badgeBorder:'#c7d2fe' },
}

const INCIDENT_STATUS: Record<string,any> = {
  resolved:     { label:'Resolved',     bg:'#f0fdf4', color:'#166534', border:'#bbf7d0' },
  investigating:{ label:'Investigating',bg:'#fef2f2', color:'#991b1b', border:'#fecaca' },
  identified:   { label:'Identified',   bg:'#fffbeb', color:'#92400e', border:'#fde68a' },
  monitoring:   { label:'Monitoring',   bg:'#eef2ff', color:'#3730a3', border:'#c7d2fe' },
}

export default function StatusPage() {
  const { brandName } = useWhiteLabel()
  const name = brandName || 'WABEK'
  const [lang, setLang] = useState<string>(() => typeof window !== 'undefined' ? localStorage.getItem('lang') || 'en' : 'en')
  const [svcStatus, setSvcStatus] = useState<Record<string,any>>({})
  const [incidents, setIncidents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Subscribe state
  const [subType, setSubType] = useState<'email'|'phone'>('email')
  const [subEmail, setSubEmail] = useState('')
  const [subPhone, setSubPhone] = useState('')
  const [subCountry, setSubCountry] = useState('+966')
  const [subLoading, setSubLoading] = useState(false)
  const [subDone, setSubDone] = useState(false)
  const [subError, setSubError] = useState('')

  // Contact form
  const [form, setForm] = useState({ name:'', email:'', subject:'', message:'' })
  const [formLoading, setFormLoading] = useState(false)
  const [formDone, setFormDone] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    const s = localStorage.getItem('lang') || 'en'
    setLang(s)
    window.addEventListener('langchange', (e:any) => setLang(e.detail))

    Promise.all([
      axios.get('/api/admin/service-status'),
      axios.get('/api/status/incidents'),
    ]).then(([s, i]) => {
      setSvcStatus(s.data.services || {})
      setIncidents(i.data.incidents || [])
    }).finally(() => setLoading(false))
  }, [])

  async function subscribe() {
    const value = subType === 'email' ? subEmail.trim() : `${subCountry}${subPhone.trim()}`
    if (!value) { setSubError('Please enter a valid value'); return }
    setSubLoading(true); setSubError('')
    try {
      await axios.post('/api/status/subscribe', {
        type: subType,
        value,
        country_code: subType === 'phone' ? subCountry : null,
      })
      setSubDone(true)
    } catch(e:any) {
      setSubError(e?.response?.data?.error || 'Failed to subscribe')
    }
    setSubLoading(false)
  }

  async function sendContact() {
    if (!form.name || !form.email || !form.subject || !form.message) { setFormError('All fields required'); return }
    setFormLoading(true); setFormError('')
    try {
      await axios.post('/api/status/contact', form)
      setFormDone(true)
    } catch(e:any) {
      setFormError(e?.response?.data?.error || 'Failed to send')
    }
    setFormLoading(false)
  }

  const getStatus = (key:string) => svcStatus[key] || 'operational'
  const allOk = SERVICES.every(s => getStatus(s.key) === 'operational')
  const hasOutage = SERVICES.some(s => getStatus(s.key) === 'outage')
  const overallColor = hasOutage ? '#ef4444' : !allOk ? '#f59e0b' : '#25D366'
  const overallText = hasOutage ? 'Service disruption detected' : !allOk ? 'Some systems affected' : 'All systems operational'

  return (<>
    <Head>
      <link rel="icon" href="/brand/favicon-32.png" /><title>System Status | {name}</title></Head>
    <div style={{background:'#fff', minHeight:'100vh'}}>
      <PublicNav active="/status" onLangChange={setLang} />
      <style>{`
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;background:#fff}
        .sw{max-width:760px;margin:0 auto;padding:40px 24px 80px}
        .shero{background:linear-gradient(135deg,#f9fafb 0%,#fff 70%);border:1px solid #e9edef;border-radius:20px;padding:48px 32px 36px;text-align:center;margin-bottom:28px}
        .pulse-wrap{position:relative;width:80px;height:80px;margin:0 auto 20px;display:flex;align-items:center;justify-content:center}
        .pr1,.pr2,.pr3{position:absolute;border-radius:50%;animation:rp 2s ease-out infinite}
        .pr1{width:80px;height:80px;background:${overallColor}12;animation-delay:0s}
        .pr2{width:60px;height:60px;background:${overallColor}20;animation-delay:.4s}
        .pr3{width:44px;height:44px;background:${overallColor}30;animation-delay:.8s}
        .pc{position:relative;width:32px;height:32px;border-radius:50%;background:${overallColor};display:flex;align-items:center;justify-content:center;z-index:1;box-shadow:0 0 20px ${overallColor}50}
        @keyframes rp{0%{transform:scale(.8);opacity:.8}100%{transform:scale(1.6);opacity:0}}
        .ubars{display:flex;gap:2px;justify-content:center;margin:20px 0 6px;padding:0 8px;width:100%;box-sizing:border-box;overflow:hidden}
        .ubar{flex:1;height:28px;border-radius:2px;background:#25D366;cursor:pointer;min-width:0;max-width:100%}
        .ubar:hover{opacity:.7}
        .ubar.w{background:#f59e0b}
        .scard{border:1px solid #e9edef;border-radius:14px;overflow:hidden;margin-bottom:20px;background:#fff}
        .scard-hdr{background:#f9fafb;padding:14px 20px;border-bottom:1px solid #e9edef;display:flex;align-items:center;justify-content:space-between}
        .scard-ttl{font-size:13px;font-weight:700;color:#374151;display:flex;align-items:center;gap:8px}
        .svc-row{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid #f9fafb;transition:background .1s;flex-wrap:wrap;gap:8px}
        .svc-row:last-child{border-bottom:none}
        .svc-row:hover{background:#f9fafb}
        .svc-icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .inc-row{padding:16px 20px;border-bottom:1px solid #f9fafb;transition:background .1s}
        .inc-row:last-child{border-bottom:none}
        .inc-row:hover{background:#f9fafb}
        .sub-card{background:linear-gradient(135deg,#f0fdf4,#fff);border:1px solid #bbf7d0;border-radius:14px;padding:24px;margin-bottom:20px;text-align:center}
        .sub-tabs{display:flex;background:#f3f4f6;border-radius:8px;padding:3px;gap:3px;margin:14px auto;max-width:240px}
        .sub-tab{flex:1;padding:6px 12px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;border:none;background:transparent;transition:all .15s}
        .sub-tab.active{background:#fff;color:#111b21;box-shadow:0 1px 3px rgba(0,0,0,.1)}
        .sub-tab:not(.active){color:#6b7280}
        .sub-input{background:#fff;border:1px solid #e9edef;border-radius:8px;padding:10px 14px;color:#111b21;font-size:14px;outline:none;transition:border .15s}
        .sub-input:focus{border-color:#25D366}
        .sub-btn{background:#25D366;color:#fff;border:none;border-radius:8px;padding:10px 22px;font-size:14px;font-weight:600;cursor:pointer;flex-shrink:0}
        .sub-btn:hover{background:#1da851}
        .sub-btn:disabled{opacity:.6;cursor:default}
        .country-select{background:#fff;border:1px solid #e9edef;border-radius:8px 0 0 8px;padding:10px 10px;font-size:14px;border-right:none;outline:none;cursor:pointer;min-width:90px;color:#111b21;-webkit-appearance:none;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%236b7280'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 8px center;padding-right:24px}
        .phone-input{flex:1;background:#fff;border:1px solid #e9edef;border-radius:0 8px 8px 0;padding:10px 14px;font-size:14px;outline:none;color:#111b21}
        .phone-input:focus{border-color:#25D366}
        .contact-card{border:1px solid #e9edef;border-radius:14px;padding:24px;margin-bottom:20px}
        .input{width:100%;background:#f9fafb;border:1px solid #e9edef;border-radius:8px;padding:10px 14px;color:#111b21;font-size:14px;outline:none;box-sizing:border-box;margin-bottom:12px}
        .input:focus{border-color:#25D366;background:#fff}
        textarea.input{resize:vertical;min-height:100px}
        .send-btn{background:#25D366;color:#fff;border:none;border-radius:8px;padding:12px 28px;font-size:14px;font-weight:600;cursor:pointer;width:100%}
        .send-btn:hover{background:#1da851}
        .send-btn:disabled{opacity:.6}
        @media(max-width:600px){
          .sw{padding:16px 12px 60px}
          .shero{padding:24px 12px 20px}
          .svc-row{flex-direction:column;align-items:flex-start;gap:10px;padding:12px 14px}
          .svc-icon{width:28px;height:28px}
          .scard-hdr{flex-direction:column;align-items:flex-start;gap:8px;padding:12px 14px}
          .sub-card{padding:18px 12px}
          .sub-tabs{max-width:100%}
          .contact-card{padding:18px 12px}
          .input{font-size:16px}
          .send-btn{font-size:15px}
          .inc-row{padding:12px 14px}
          .ubars{padding:0 2px;gap:1px}
          .ubar{height:18px;border-radius:1px}
        }
      `}</style>
      <div className="sw">

        {/* Hero */}
        <div className="shero">
          <div className="pulse-wrap">
            <div className="pr1"/><div className="pr2"/><div className="pr3"/>
            <div className="pc">
              {allOk
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                : hasOutage
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              }
            </div>
          </div>
          <h1 style={{fontSize:'clamp(22px,4vw,32px)',fontWeight:800,color:'#111b21',margin:'0 0 8px'}}>System Status</h1>
          <p style={{fontSize:18,fontWeight:700,color:overallColor,margin:'0 0 4px'}}>{overallText}</p>
          <p style={{fontSize:12,color:'#8696a0',margin:0}}>Last updated: {new Date().toLocaleString()}</p>
          <div className="ubars">
            {Array.from({length:90},(_,i) => (
              <div key={i} className={`ubar${i===14||i===62?' w':''}`} title={`Day ${90-i}`}/>
            ))}
          </div>
          <p style={{fontSize:11,color:'#adb5bd',textAlign:'center',marginBottom:12}}>
            Last 90 days · <span style={{color:'#f59e0b'}}>■</span> resolved incident
          </p>
          <span style={{display:'inline-flex',alignItems:'center',gap:8,background:'#fff',border:'1px solid #e9edef',borderRadius:100,padding:'8px 18px',fontSize:13,fontWeight:600,color:'#374151',boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            99.9% uptime — last 90 days
          </span>
        </div>

        {/* Services */}
        <div className="scard">
          <div className="scard-hdr">
            <div className="scard-ttl">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
              Current Status
            </div>
            <span style={{fontSize:11,fontWeight:700,color:allOk?'#166534':'#92400e',background:allOk?'#f0fdf4':'#fffbeb',border:`1px solid ${allOk?'#bbf7d0':'#fde68a'}`,borderRadius:100,padding:'3px 12px'}}>
              {allOk ? 'All operational' : 'Incidents detected'}
            </span>
          </div>
          {loading ? <div style={{padding:24,textAlign:'center',color:'#8696a0',fontSize:13}}>Loading...</div>
          : SERVICES.map(svc => {
            const st = getStatus(svc.key)
            const meta = STATUS_META[st]
            return (
              <div key={svc.key} className="svc-row">
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <div className="svc-icon" style={{background:svc.bg,color:svc.color}}>{SVGS[svc.key]}</div>
                  <span style={{fontSize:13,fontWeight:500,color:'#374151'}}>{SVC_NAMES[svc.key]}</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:8,height:8,borderRadius:'50%',background:meta.dot,boxShadow:`0 0 0 3px ${meta.dot}25`}}/>
                  <span style={{background:meta.badgeBg,border:`1px solid ${meta.badgeBorder}`,borderRadius:100,padding:'3px 12px',fontSize:11,fontWeight:700,color:meta.badge}}>{meta.label}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Past Incidents */}
        <div className="scard">
          <div className="scard-hdr">
            <div className="scard-ttl">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Past Incidents
            </div>
          </div>
          {incidents.length === 0 ? (
            <div style={{padding:'24px 20px',textAlign:'center',color:'#8696a0',fontSize:13}}>
              No incidents reported in the last 90 days ✓
            </div>
          ) : incidents.map(inc => {
            const ist = INCIDENT_STATUS[inc.status] || INCIDENT_STATUS.resolved
            return (
              <div key={inc.id} className="inc-row">
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}}>
                  <div>
                    <p style={{fontSize:13,fontWeight:600,color:'#374151',margin:'0 0 4px'}}>{inc.title}</p>
                    <p style={{fontSize:12,color:'#8696a0',margin:0,display:'flex',alignItems:'center',gap:8}}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8696a0" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      {new Date(inc.incident_date).toLocaleDateString()}
                      {inc.duration && <><span>·</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8696a0" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>{inc.duration}</>}
                    </p>
                  </div>
                  <span style={{background:ist.bg,border:`1px solid ${ist.border}`,borderRadius:100,padding:'3px 12px',fontSize:11,fontWeight:700,color:ist.color,whiteSpace:'nowrap',flexShrink:0}}>
                    {ist.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Subscribe */}
        <div className="sub-card">
          <p style={{fontSize:15,fontWeight:700,color:'#111b21',margin:'0 0 4px'}}>Get incident notifications</p>
          <p style={{fontSize:13,color:'#8696a0',margin:0}}>Choose how you want to be notified when an incident starts or resolves.</p>

          <div className="sub-tabs">
            <button className={`sub-tab ${subType==='email'?'active':''}`} onClick={() => setSubType('email')}>✉️ Email</button>
            <button className={`sub-tab ${subType==='phone'?'active':''}`} onClick={() => setSubType('phone')}>📱 Phone</button>
          </div>

          {subDone ? (
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,color:'#166534',fontWeight:600,fontSize:14,marginTop:8}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              Subscribed successfully!
            </div>
          ) : (
            <>
              {subType === 'email' ? (
                <div style={{display:'flex',gap:8,maxWidth:420,margin:'0 auto',flexWrap:'wrap'}}>
                  <input type="email" className="sub-input" style={{flex:1,minWidth:180}} value={subEmail}
                    onChange={e=>setSubEmail(e.target.value)} placeholder="your@email.com" />
                  <button className="sub-btn" onClick={subscribe} disabled={subLoading}>
                    {subLoading ? '...' : 'Subscribe'}
                  </button>
                </div>
              ) : (
                <div style={{display:'flex',gap:0,maxWidth:420,margin:'0 auto',flexWrap:'nowrap'}}>
                  <select className="country-select" value={subCountry} onChange={e=>setSubCountry(e.target.value)}>
                    {COUNTRIES.map(c => (
                      <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                    ))}
                  </select>
                  <input type="tel" className="phone-input" value={subPhone}
                    onChange={e=>setSubPhone(e.target.value)} placeholder="501234567" />
                  <button className="sub-btn" style={{borderRadius:'0 8px 8px 0'}} onClick={subscribe} disabled={subLoading}>
                    {subLoading ? '...' : 'Subscribe'}
                  </button>
                </div>
              )}
              {subError && <p style={{color:'#ef4444',fontSize:12,marginTop:8,textAlign:'center'}}>{subError}</p>}
            </>
          )}
        </div>

        {/* Contact Form */}
        <div className="contact-card">
          <p style={{fontSize:15,fontWeight:700,color:'#111b21',margin:'0 0 4px'}}>Send Us a Message</p>
          <p style={{fontSize:13,color:'#8696a0',marginBottom:16}}>We respond to all messages within 24 hours on business days.</p>
          {formDone ? (
            <div style={{textAlign:'center',padding:'24px 0',color:'#166534',fontWeight:600,fontSize:14}}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2" strokeLinecap="round" style={{display:'block',margin:'0 auto 12px'}}><circle cx="12" cy="12" r="10"/><polyline points="20 6 9 17 4 12"/></svg>
              Message sent! We'll get back to you soon.
            </div>
          ) : (
            <>
              <div style={{display:'grid',gridTemplateColumns:'min(100%,calc(50% - 6px)) min(100%,calc(50% - 6px))',gap:12,gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))' as any}}>
                <input className="input" style={{marginBottom:0}} placeholder="Your Name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
                <input className="input" style={{marginBottom:0}} type="email" placeholder="Email Address" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} />
              </div>
              <input className="input" style={{marginTop:12}} placeholder="Subject" value={form.subject} onChange={e=>setForm(f=>({...f,subject:e.target.value}))} />
              <textarea className="input" placeholder="Your message..." value={form.message} onChange={e=>setForm(f=>({...f,message:e.target.value}))} />
              {formError && <p style={{color:'#ef4444',fontSize:12,marginBottom:8}}>{formError}</p>}
              <button className="send-btn" onClick={sendContact} disabled={formLoading}>
                {formLoading ? 'Sending...' : '📨 Send Message'}
              </button>
            </>
          )}
        </div>

      </div>
      <PublicFooter lang={lang} onLangChange={setLang} />
    </div>
  </>)
}
