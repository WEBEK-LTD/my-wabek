import axios from 'axios'
// @ts-nocheck
import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import PublicNav from '@/components/PublicNav'
import PublicFooter from '@/components/PublicFooter'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import { t, getStoredLang } from '@/lib/i18n'

export default function SupportPage() {
  const { brandName } = useWhiteLabel()
  const name = brandName || 'WABEK'
  const [lang, setLang] = useState<string>(() => typeof window !== 'undefined' ? localStorage.getItem('lang') || 'en' : 'en')
  const [open, setOpen] = useState<number|null>(null)
  const [form, setForm] = useState({ name:'', email:'', subject:'', message:'' })
  const [formLoading, setFormLoading] = useState(false)
  const [formDone, setFormDone] = useState(false)
  const [formError, setFormError] = useState('')
  useEffect(() => {
    setLang(getStoredLang())
    const h = (e: any) => setLang(e.detail)
    window.addEventListener('langchange', h)
    return () => window.removeEventListener('langchange', h)
  }, [])
  const isRTL = lang === 'ar'
  const dir = isRTL ? 'rtl' : 'ltr'

  const FAQS = [
    { qk:'support_faq1_q', ak:'support_faq1_a' },
    { qk:'support_faq2_q', ak:'support_faq2_a' },
    { qk:'support_faq3_q', ak:'support_faq3_a' },
    { qk:'support_faq4_q', ak:'support_faq4_a' },
    { qk:'support_faq5_q', ak:'support_faq5_a' },
    { qk:'support_faq6_q', ak:'support_faq6_a' },
  ]

  return (
    <>
      <Head>
      <link rel="icon" href="https://res.cloudinary.com/dkl7ntpgw/image/upload/f_auto,q_auto/%D8%AA%D8%B5%D9%85%D9%8A%D9%85_%D8%A8%D8%AF%D9%88%D9%86_%D8%B9%D9%86%D9%88%D8%A7%D9%86_1_kejdrs" /><title>{t(lang,'support_title')} | {name}</title></Head>
      <style>{`*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fff;color:#111b21}.inp{width:100%;padding:12px 16px;border:1.5px solid #e9edef;border-radius:9px;font-size:14px;outline:none;background:#fff;color:#111b21;font-family:inherit;transition:border .15s}.inp:focus{border-color:#25D366}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}@media(max-width:700px){.grid{grid-template-columns:1fr}}`}</style>

      <PublicNav active="/support" onLangChange={setLang} />

      <section style={{background:'linear-gradient(160deg,#f0fdf4,#fff)',padding:'80px 20px 56px',textAlign:'center',direction:dir}}>
        <div style={{maxWidth:600,margin:'0 auto'}}>
          <h1 style={{fontSize:'clamp(28px,5vw,48px)',fontWeight:800,marginBottom:18,lineHeight:1.1}}>{t(lang,'support_title')}</h1>
          <p style={{fontSize:17,color:'#54656f',lineHeight:1.7}}>{t(lang,'support_subtitle')}</p>
        </div>
      </section>

      <section style={{padding:'56px 20px 0',direction:dir}}>
        <div style={{maxWidth:960,margin:'0 auto'}}>
          <div className="grid" style={{marginBottom:64}}>
            {[
              {svg:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,color:'#0ea5e9',bg:'#f0f9ff',tk:'support_docs_title',dk:'support_docs_desc',cta:'support_docs_cta',href:'/dashboard/docs'},
              {svg:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,color:'#25D366',bg:'#f0fdf4',tk:'support_chat_title',dk:'support_chat_desc',cta:'support_chat_cta',href:'#contact'},
              {svg:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,color:'#6366f1',bg:'#eef2ff',tk:'support_email_title',dk:'support_email_desc',cta:'support_email_cta',href:'#contact'},
            ].map(c => (
              <div key={c.tk} style={{background:'#f9fafb',borderRadius:14,padding:24,textAlign:'center'}}>
                <div style={{width:52,height:52,borderRadius:14,background:c.bg,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:16,color:c.color}}>
                  {c.svg}
                </div>
                <h3 style={{fontSize:17,fontWeight:700,marginBottom:8}}>{t(lang,c.tk)}</h3>
                <p style={{fontSize:13,color:'#54656f',lineHeight:1.75,marginBottom:18}}>{t(lang,c.dk)}</p>
                <a href={c.href} style={{background:'#25D366',color:'#0F172A',padding:'9px 22px',borderRadius:8,fontSize:13,fontWeight:700,textDecoration:'none',display:'inline-block'}}>{t(lang,c.cta)}</a>
              </div>
            ))}
          </div>

          {/* FAQ */}
          <div style={{maxWidth:700,margin:'0 auto',marginBottom:72}}>
            <h2 style={{fontSize:'clamp(22px,4vw,32px)',fontWeight:800,marginBottom:36,textAlign:'center'}}>{t(lang,'support_faq_title')}</h2>
            {FAQS.map((f,i) => (
              <div key={i}>
                <button onClick={()=>setOpen(open===i?null:i)} style={{width:'100%',background:'none',border:'none',padding:'16px 0',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',textAlign:isRTL?'right':'left',borderBottom:'1px solid #e9edef'}}>
                  <span style={{fontSize:15,fontWeight:600,color:'#111b21',paddingInlineEnd:20}}>{t(lang,f.qk)}</span>
                  <span style={{fontSize:20,color:'#25D366',transform:open===i?'rotate(45deg)':'none',transition:'transform .2s',flexShrink:0}}>+</span>
                </button>
                {open===i && <p style={{fontSize:14,color:'#54656f',lineHeight:1.8,padding:'12px 0 18px',borderBottom:'1px solid #e9edef'}}>{t(lang,f.ak)}</p>}
              </div>
            ))}
          </div>

          {/* Contact form */}
          <div id="contact" style={{maxWidth:580,margin:'0 auto',paddingBottom:80}}>
            <h2 style={{fontSize:'clamp(22px,4vw,32px)',fontWeight:800,marginBottom:8,textAlign:'center'}}>{t(lang,'support_form_title')}</h2>
            <p style={{fontSize:15,color:'#54656f',textAlign:'center',marginBottom:32}}>{t(lang,'support_form_subtitle')}</p>
            {formDone ? (
              <div style={{textAlign:'center',padding:'32px 0'}}>
                <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2" strokeLinecap="round" style={{display:'block',margin:'0 auto 16px'}}>
                  <circle cx="12" cy="12" r="10"/><polyline points="20 6 9 17 4 12"/>
                </svg>
                <p style={{fontSize:18,fontWeight:700,color:'#111b21',margin:'0 0 8px'}}>Message sent!</p>
                <p style={{fontSize:14,color:'#54656f',margin:0}}>We'll get back to you within 24 hours on business days.</p>
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:16}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                  <div>
                    <label style={{display:'block',fontSize:13,fontWeight:600,color:'#374151',marginBottom:6}}>{t(lang,'support_name')}</label>
                    <input className="inp" placeholder={t(lang,'support_name_ph')} value={form.name}
                      onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
                  </div>
                  <div>
                    <label style={{display:'block',fontSize:13,fontWeight:600,color:'#374151',marginBottom:6}}>{t(lang,'support_email')}</label>
                    <input className="inp" type="email" placeholder={t(lang,'support_email_ph')} value={form.email}
                      onChange={e=>setForm(f=>({...f,email:e.target.value}))} />
                  </div>
                </div>
                <div>
                  <label style={{display:'block',fontSize:13,fontWeight:600,color:'#374151',marginBottom:6}}>{t(lang,'support_subject')}</label>
                  <input className="inp" placeholder={t(lang,'support_subject_ph')} value={form.subject}
                    onChange={e=>setForm(f=>({...f,subject:e.target.value}))} />
                </div>
                <div>
                  <label style={{display:'block',fontSize:13,fontWeight:600,color:'#374151',marginBottom:6}}>{t(lang,'support_message')}</label>
                  <textarea className="inp" style={{resize:'vertical',minHeight:110}} placeholder={t(lang,'support_message_ph')}
                    value={form.message} onChange={e=>setForm(f=>({...f,message:e.target.value}))} />
                </div>
                {formError && <p style={{color:'#ef4444',fontSize:13,margin:'0'}}>{formError}</p>}
                <button
                  disabled={formLoading}
                  onClick={async()=>{
                    if(!form.name||!form.email||!form.subject||!form.message){setFormError('All fields required');return}
                    setFormLoading(true);setFormError('')
                    try{
                      await axios.post('/api/status/contact',form)
                      setFormDone(true)
                    }catch(e:any){setFormError(e?.response?.data?.error||'Failed to send')}
                    setFormLoading(false)
                  }}
                  style={{background:formLoading?'#94a3b8':'#25D366',color:'#0F172A',padding:'13px',borderRadius:9,fontSize:15,fontWeight:700,border:'none',cursor:formLoading?'default':'pointer',transition:'background .2s'}}>
                  {formLoading ? 'Sending...' : t(lang,'support_send')}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <PublicFooter lang={lang} />
    </>
  )
}
