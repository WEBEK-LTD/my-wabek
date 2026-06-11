// @ts-nocheck
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import { LANGUAGES, getStoredLang, setStoredLang, t } from '@/lib/i18n'

export default function PublicFooter({ lang: langProp = '' }: any) {
  const { brandName, brandLogo } = useWhiteLabel()
  const name = brandName || 'WABEK'
  const year = new Date().getFullYear()
  const [lang, setLang] = useState('en')

  useEffect(() => {
    setLang(langProp || getStoredLang())
    const handler = (e: any) => setLang(e.detail)
    window.addEventListener('langchange', handler)
    return () => window.removeEventListener('langchange', handler)
  }, [langProp])

  const changeLang = (code: string) => {
    setLang(code)
    setStoredLang(code)
    window.dispatchEvent(new CustomEvent('langchange', { detail: code }))
  }

  return (
    <footer style={{background:'#111b21',padding:'64px 24px 36px'}}>
      <div style={{maxWidth:1200,margin:'0 auto'}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:48,marginBottom:56}}>

          {/* Brand col */}
          <div style={{gridColumn:'span 2'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:18}}>
              {brandLogo
                ? <div style={{background:'rgba(255,255,255,0.08)',borderRadius:10,padding:'6px 10px',display:'inline-flex',alignItems:'center'}}><img src={brandLogo} alt={name} style={{height:52,maxWidth:180,objectFit:'contain'}} /></div>
                : <>
                    <div style={{width:32,height:32,background:'#25D366',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>💬</div>
                    <span style={{fontWeight:800,fontSize:24,color:'#fff'}}>{name}</span>
                  </>
              }
            </div>
            <p style={{fontSize:14,color:'#8696a0',lineHeight:1.8,maxWidth:260,direction: lang==='ar' ? 'rtl' : 'ltr'}}>{t(lang,'footer_desc')}</p>

            {/* Language switcher */}
            <div style={{display:'flex',gap:8,marginTop:20,flexWrap:'wrap'}}>
              {LANGUAGES.map(l => (
                <button key={l.code} onClick={()=>changeLang(l.code)}
                  style={{display:'flex',alignItems:'center',gap:6,padding:'6px 10px',background: lang===l.code ? '#25D366' : '#1e2a2f',border: lang===l.code ? 'none' : '1px solid #2a3942',borderRadius:7,cursor:'pointer',fontSize:12,fontWeight:700,color: lang===l.code ? '#fff' : '#8696a0'}}>
                  <img src={l.flag} alt={l.label} style={{width:18,height:13,objectFit:'cover',borderRadius:2}} />
                  <span>{l.label}</span>
                </button>
              ))}
            </div>
          </div>

          {[
            {title: t(lang,'footer_product'), links:[
              [t(lang,'home'),'/'],
              [t(lang,'features'),'/features'],
              [t(lang,'integrations'),'/integrations'],
              [t(lang,'pricing'),'/pricing'],
              ['API Docs','/dashboard/docs'],
            ]},
            {title: t(lang,'footer_company'), links:[
              [t(lang,'about'),'/about'],
              [t(lang,'blog'),'/blog'],
              [t(lang,'support'),'/support'],
            ]},
            {title: t(lang,'footer_legal'), links:[
              [t(lang,'privacy'),'/legal/privacy'],
              [t(lang,'terms'),'/legal/terms'],
              [t(lang,'refund'),'/legal/refund'],
              [t(lang,'license'),'/legal/license'],
              ['System Status','/status'],
            ]},
          ].map(col => (
            <div key={col.title}>
              <h4 style={{color:'#fff',fontSize:12,fontWeight:700,marginBottom:20,textTransform:'uppercase',letterSpacing:'0.6px',direction: lang==='ar' ? 'rtl' : 'ltr'}}>{col.title}</h4>
              {col.links.map(([l,h]) => (
                <Link key={l} href={h}
                  style={{display:'block',color:'#8696a0',fontSize:14,marginBottom:12,textDecoration:'none',direction: lang==='ar' ? 'rtl' : 'ltr'}}
                  onMouseOver={e=>(e.target as any).style.color='#25D366'}
                  onMouseOut={e=>(e.target as any).style.color='#8696a0'}>{l}</Link>
              ))}
            </div>
          ))}
        </div>

        <div style={{borderTop:'1px solid #2a3942',paddingTop:28,textAlign:'center'}}>
          <p style={{fontSize:12,color:'#54656f',lineHeight:1.8}}>
            © {year} {name}. {t(lang,'footer_rights')} {t(lang,'footer_proprietary')}
          </p>
          <p style={{fontSize:11,color:'#3d5a65',marginTop:6}}>{t(lang,'footer_built_by')}</p>
        </div>
      </div>
    </footer>
  )
}
