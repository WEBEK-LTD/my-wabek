// @ts-nocheck
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import { LANGUAGES, getStoredLang, setStoredLang, t } from '@/lib/i18n'

export default function PublicNav({ active = '', lang: langProp = '', onLangChange = null }: any) {
  const { brandName, brandLogo } = useWhiteLabel()
  const name = brandName || 'WABEK'
  const [lang, setLang] = useState('en')
  const [showLang, setShowLang] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stored = langProp || getStoredLang()
    setLang(stored)
  }, [langProp])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowLang(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const changeLang = (code: string) => {
    setLang(code)
    setStoredLang(code)
    setShowLang(false)
    onLangChange?.(code)
    window.dispatchEvent(new CustomEvent('langchange', { detail: code }))
  }

  const current = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0]

  const navLinks = [
    [t(lang,'home'), '/'],
    [t(lang,'features'), '/features'],
    [t(lang,'integrations'), '/integrations'],
    [t(lang,'pricing'), '/pricing'],
    [t(lang,'about'), '/about'],
    [t(lang,'support'), '/support'],
  ]

  return (
    <>
      <style>{`
        .pnav{position:sticky;top:0;z-index:100;background:rgba(255,255,255,.97);backdrop-filter:blur(12px);border-bottom:1px solid #e9edef}
        .pnav-inner{max-width:1200px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;height:68px;padding:0 20px}
        .pnav-links{display:flex;gap:20px;align-items:center}
        .pnav-link{color:#54656f;text-decoration:none;font-size:14px;font-weight:500;white-space:nowrap;transition:color .15s}
        .pnav-link:hover,.pnav-link.active{color:#25D366;font-weight:700}
        .pnav-btn{background:#25D366;color:#fff;padding:9px 18px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;white-space:nowrap}
        .lang-btn{display:flex;align-items:center;gap:6px;background:#f3f4f6;border:1px solid #e9edef;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:13px;font-weight:600;color:#374151}
        .lang-drop{position:absolute;top:calc(100% + 8px);right:0;background:#fff;border:1px solid #e9edef;border-radius:12px;padding:8px;box-shadow:0 8px 24px rgba(0,0,0,.12);min-width:150px;z-index:200}
        .lang-item{display:flex;align-items:center;gap:10px;width:100%;padding:9px 12px;background:transparent;border:none;border-radius:8px;cursor:pointer;font-size:14px;text-align:left}
        .lang-item:hover{background:#f3f4f6}
        .lang-item.sel{background:#f0fdf4;color:#25D366;font-weight:700}
        .ham{display:none;background:none;border:none;font-size:24px;cursor:pointer;color:#111b21;padding:4px;line-height:1}
        .mob-menu{display:none;flex-direction:column;gap:2px;background:#fff;border-top:1px solid #e9edef;padding:12px 20px 20px}
        .mob-link{color:#374151;text-decoration:none;font-size:16px;font-weight:500;padding:12px 0;border-bottom:1px solid #f3f4f6;display:block}
        .mob-link.active{color:#25D366;font-weight:700}
        .mob-langs{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}
        .mob-lang{display:flex;align-items:center;gap:6px;padding:7px 12px;border:1px solid #e9edef;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;background:#fff;color:#374151}
        .mob-lang.sel{background:#25D366;color:#fff;border-color:#25D366}
        .flag-img{width:20px;height:14px;object-fit:cover;border-radius:2px;flex-shrink:0}
        @media(max-width:900px){.pnav-links{display:none!important}.ham{display:block!important}}
        @media(max-width:900px){.mob-menu.open{display:flex!important}}
      `}</style>

      <nav className="pnav">
        <div className="pnav-inner">

          {/* Logo — always LTR */}
          <Link href="/" style={{display:'flex',alignItems:'center',gap:10,textDecoration:'none',flexShrink:0}}>
            {brandLogo
              ? <img src={brandLogo} alt={name} style={{height:52,maxWidth:180,objectFit:'contain'}} />
              : <>
                  <div style={{width:34,height:34,background:'#25D366',borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>💬</div>
                  <span style={{fontWeight:800,fontSize:22,color:'#111b21'}}>{name}</span>
                </>
            }
          </Link>

          {/* Desktop links — text direction only, layout stays LTR */}
          <div className="pnav-links">
            {navLinks.map(([l, h]) => (
              <Link key={h} href={h} className={`pnav-link${active===h?' active':''}`}
                style={{direction: lang==='ar' ? 'rtl' : 'ltr'}}>{l}</Link>
            ))}
            <Link href="/auth/login" className="pnav-link"
              style={{direction: lang==='ar' ? 'rtl' : 'ltr'}}>{t(lang,'sign_in')}</Link>
            <Link href="/auth/register" className="pnav-btn">{t(lang,'get_started')}</Link>

            {/* Language switcher */}
            <div ref={dropRef} style={{position:'relative',flexShrink:0}}>
              <button className="lang-btn" onClick={()=>setShowLang(!showLang)}>
                <img className="flag-img" src={current.flag} alt={current.label} />
                <span>{current.label}</span>
                <span style={{fontSize:9,opacity:.5,transform:showLang?'rotate(180deg)':'none',transition:'transform .15s'}}>▼</span>
              </button>
              {showLang && (
                <div className="lang-drop">
                  {LANGUAGES.map(l => (
                    <button key={l.code} onClick={()=>changeLang(l.code)} className={`lang-item${lang===l.code?' sel':''}`}>
                      <img className="flag-img" src={l.flag} alt={l.label} />
                      <span>{l.name}</span>
                      {lang===l.code && <span style={{marginLeft:'auto',color:'#25D366',fontSize:12}}>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Hamburger */}
          <button className="ham" onClick={()=>setMenuOpen(!menuOpen)}>
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* Mobile menu */}
        <div className={`mob-menu${menuOpen?' open':''}`}>
          {navLinks.map(([l, h]) => (
            <Link key={h} href={h} onClick={()=>setMenuOpen(false)}
              className={`mob-link${active===h?' active':''}`}
              style={{textAlign: lang==='ar' ? 'right' : 'left'}}>{l}</Link>
          ))}
          <Link href="/auth/login" onClick={()=>setMenuOpen(false)}
            className="mob-link" style={{textAlign: lang==='ar' ? 'right' : 'left'}}>{t(lang,'sign_in')}</Link>
          <Link href="/auth/register" onClick={()=>setMenuOpen(false)}
            style={{background:'#25D366',color:'#fff',padding:'13px',borderRadius:9,fontSize:15,fontWeight:700,textDecoration:'none',textAlign:'center',marginTop:8,display:'block'}}>{t(lang,'get_started')}</Link>

          <div className="mob-langs">
            {LANGUAGES.map(l => (
              <button key={l.code} onClick={()=>{changeLang(l.code);}}
                className={`mob-lang${lang===l.code?' sel':''}`}>
                <img className="flag-img" src={l.flag} alt={l.label} />
                <span>{l.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>
    </>
  )
}
