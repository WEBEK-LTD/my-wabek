// @ts-nocheck
import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import PublicNav from '@/components/PublicNav'
import PublicFooter from '@/components/PublicFooter'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import { t, getStoredLang } from '@/lib/i18n'

export default function FeaturesPage() {
  const { brandName } = useWhiteLabel()
  const name = brandName || 'WABEK'
  const [lang, setLang] = useState<string>(() => typeof window !== 'undefined' ? localStorage.getItem('lang') || 'en' : 'en')
  useEffect(() => {
    setLang(getStoredLang())
    const h = (e: any) => setLang(e.detail)
    window.addEventListener('langchange', h)
    return () => window.removeEventListener('langchange', h)
  }, [])
  const isRTL = lang === 'ar'
  const dir = isRTL ? 'rtl' : 'ltr'

  const FEATURES = [
    { svg:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2L15 22 11 13 2 9l20-7z"/></svg>, color:'#25D366', bg:'#f0fdf4', tk:'feat_campaigns_title', dk:'feat_campaigns_desc', bk:'feat_badge_marketing'},
    { svg:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>, color:'#6366f1', bg:'#eef2ff', tk:'feat_ai_title', dk:'feat_ai_desc', bk:'feat_badge_ai'},
    { svg:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/><line x1="9" y1="10" x2="15" y2="10"/><line x1="9" y1="14" x2="13" y2="14"/></svg>, color:'#0ea5e9', bg:'#f0f9ff', tk:'feat_inbox_title', dk:'feat_inbox_desc', bk:'feat_badge_support'},
    { svg:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 17h3v3m0-7v4"/></svg>, color:'#f59e0b', bg:'#fffbeb', tk:'feat_chatbot_title', dk:'feat_chatbot_desc', bk:'feat_badge_automation'},
    { svg:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><path d="M2 20h20"/></svg>, color:'#a855f7', bg:'#faf5ff', tk:'feat_analytics_title', dk:'feat_analytics_desc', bk:'feat_badge_analytics'},
    { svg:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>, color:'#ec4899', bg:'#fdf2f8', tk:'feat_inbox_title', dk:'feat_inbox_desc', bk:'feat_badge_crm'},
    { svg:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 2 13 9 20 9"/><path d="M11 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2v-7"/><path d="M18 2l4 4-9 9-4 1 1-4 8-10z"/></svg>, color:'#ef4444', bg:'#fef2f2', tk:'feat_automation_title', dk:'feat_automation_desc', bk:'feat_badge_automation'},
    { svg:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>, color:'#0891b2', bg:'#f0fdff', tk:'feat_otp_title', dk:'feat_otp_desc', bk:'feat_badge_security'},
    { svg:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 2 13 9 20 9"/><path d="M11 22l7-20H3l7 20"/></svg>, color:'#16a34a', bg:'#f0fdf4', tk:'feat_quick_title', dk:'feat_quick_desc', bk:'feat_badge_support'},
    { svg:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>, color:'#7c3aed', bg:'#f5f3ff', tk:'feat_multi_title', dk:'feat_multi_desc', bk:'feat_badge_platform'},
    { svg:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>, color:'#d97706', bg:'#fffbeb', tk:'feat_notif_title', dk:'feat_notif_desc', bk:'feat_badge_platform'},
    { svg:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>, color:'#0284c7', bg:'#f0f9ff', tk:'integrations_title', dk:'integrations_subtitle', bk:'feat_badge_platform'},
  ]

  return (
    <>
      <Head>
      <link rel="icon" href="https://res.cloudinary.com/dkl7ntpgw/image/upload/f_auto,q_auto/%D8%AA%D8%B5%D9%85%D9%8A%D9%85_%D8%A8%D8%AF%D9%88%D9%86_%D8%B9%D9%86%D9%88%D8%A7%D9%86_1_kejdrs" /><title>{t(lang,'feat_title')} | {name}</title></Head>
      <style>{`*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fff;color:#111b21}.badge{display:inline-block;padding:3px 10px;border-radius:100px;font-size:11px;font-weight:700;background:#dcfce7;color:#166534;margin-bottom:10px}.card{background:#fff;border:1px solid #e9edef;border-radius:14px;padding:24px;transition:all .2s}.card:hover{border-color:#25D366;box-shadow:0 4px 20px rgba(37,211,102,.1);transform:translateY(-2px)}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}@media(max-width:900px){.grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:600px){.grid{grid-template-columns:1fr}}`}</style>

      <PublicNav active="/features" onLangChange={setLang} />

      <section style={{background:'linear-gradient(160deg,#f0fdf4,#fff)',padding:'80px 20px 56px',textAlign:'center',direction:dir}}>
        <div style={{maxWidth:720,margin:'0 auto'}}>
          <h1 style={{fontSize:'clamp(28px,5vw,48px)',fontWeight:800,marginBottom:18,lineHeight:1.1}}>{t(lang,'feat_title')}</h1>
          <p style={{fontSize:17,color:'#54656f',lineHeight:1.7}}>{t(lang,'feat_subtitle')}</p>
        </div>
      </section>

      <section style={{padding:'48px 20px 80px',direction:dir}}>
        <div style={{maxWidth:1100,margin:'0 auto'}}>
          <div className="grid">
            {FEATURES.map((f,i) => (
              <div key={i} className="card">
                <div className="badge">{t(lang,f.bk)}</div>
                <div style={{width:48,height:48,borderRadius:12,background:f.bg,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:16,color:f.color,flexShrink:0}}>
                  {f.svg}
                </div>
                <h3 style={{fontSize:16,fontWeight:700,marginBottom:8}}>{t(lang,f.tk)}</h3>
                <p style={{fontSize:13,color:'#54656f',lineHeight:1.8}}>{t(lang,f.dk)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{background:'#25D366',padding:'64px 20px',textAlign:'center',direction:dir}}>
        <h2 style={{fontSize:'clamp(24px,4vw,36px)',fontWeight:800,color:'#0F172A',marginBottom:14}}>{t(lang,'feat_cta_title')}</h2>
        <p style={{fontSize:17,color:'rgba(255,255,255,.85)',marginBottom:32}}>{t(lang,'feat_cta_subtitle')}</p>
        <Link href="/auth/register" style={{background:'#fff',color:'#25D366',padding:'13px 36px',borderRadius:9,fontSize:15,fontWeight:700,textDecoration:'none',display:'inline-block'}}>{t(lang,'feat_cta_btn')}</Link>
      </section>

      <PublicFooter lang={lang} />
    </>
  )
}
