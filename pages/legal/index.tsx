// @ts-nocheck
import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import PublicNav from '@/components/PublicNav'
import PublicFooter from '@/components/PublicFooter'

const LOGO = '/brand/favicon-32.png'

const S: Record<string, Record<string, string>> = {
  title:      { en:'Legal', ar:'القانوني', fr:'Légal', tr:'Yasal' },
  subtitle:   { en:'Our legal documents, policies, and agreements. We believe in full transparency.', ar:'وثائقنا القانونية وسياساتنا واتفاقياتنا. نؤمن بالشفافية الكاملة.', fr:'Nos documents juridiques, politiques et accords. Nous croyons en la transparence totale.', tr:'Hukuki belgelerimiz, politikalarımız ve anlaşmalarımız. Tam şeffaflığa inanıyoruz.' },
  updated:    { en:'Last updated', ar:'آخر تحديث', fr:'Dernière mise à jour', tr:'Son güncelleme' },
  read_doc:   { en:'Read document', ar:'قراءة الوثيقة', fr:'Lire le document', tr:'Belgeyi oku' },
  company:    { en:'WEBEK LTD · Company No. 16326894 · 71-75 Shelton Street, Covent Garden, London, WC2H 9JQ, United Kingdom', ar:'WEBEK LTD · رقم الشركة: 16326894 · 71-75 شيلتون ستريت، كوفنت غاردن، لندن، WC2H 9JQ، المملكة المتحدة', fr:'WEBEK LTD · Numéro d\'entreprise: 16326894 · 71-75 Shelton Street, Covent Garden, Londres, WC2H 9JQ, Royaume-Uni', tr:'WEBEK LTD · Şirket No: 16326894 · 71-75 Shelton Street, Covent Garden, Londra, WC2H 9JQ, Birleşik Krallık' },
  questions:  { en:'Questions about our legal documents?', ar:'أسئلة حول وثائقنا القانونية؟', fr:'Des questions sur nos documents juridiques ?', tr:'Hukuki belgelerimiz hakkında sorularınız mı var?' },
  contact_us: { en:'Contact us at', ar:'تواصل معنا على', fr:'Contactez-nous à', tr:'Bize ulaşın' },
}

const T = (lang: string, k: string) => S[k]?.[lang] || S[k]?.en || k

const DOCS = [
  {
    href: '/legal/privacy',
    title: { en:'Privacy Policy', ar:'سياسة الخصوصية', fr:'Politique de confidentialité', tr:'Gizlilik Politikası' },
    desc:  { en:'How we collect, use, store, and protect your personal data. Your privacy matters to us.', ar:'كيف نجمع بياناتك الشخصية ونستخدمها ونخزنها ونحميها. خصوصيتك تهمنا.', fr:'Comment nous collectons, utilisons, stockons et protégeons vos données personnelles.', tr:'Kişisel verilerinizi nasıl topladığımızı, kullandığımızı ve koruduğumuzu açıklar.' },
    date:  'May 2025',
    svg: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>`,
    color: '#25D366', bg: '#f0fdf4', border: '#bbf7d0',
  },
  {
    href: '/legal/terms',
    title: { en:'Terms of Service', ar:'شروط الخدمة', fr:'Conditions d\'utilisation', tr:'Hizmet Şartları' },
    desc:  { en:'The rules and agreements that govern your use of WABEK services. Please read carefully.', ar:'القواعد والاتفاقيات التي تحكم استخدامك لخدمات WABEK. يرجى القراءة بعناية.', fr:'Les règles et accords qui régissent votre utilisation des services WABEK.', tr:'WABEK hizmetlerinin kullanımını yöneten kurallar ve anlaşmalar.' },
    date:  'May 2025',
    svg: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>`,
    color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe',
  },
  {
    href: '/legal/refund',
    title: { en:'Refund Policy', ar:'سياسة الاسترداد', fr:'Politique de remboursement', tr:'İade Politikası' },
    desc:  { en:'Our refund and cancellation terms. We offer a 14-day money-back guarantee on all paid plans.', ar:'شروط الاسترداد والإلغاء لدينا. نقدم ضمان استرداد المال لمدة 14 يوماً على جميع الخطط المدفوعة.', fr:'Nos conditions de remboursement et d\'annulation. Garantie de remboursement de 14 jours.', tr:'İade ve iptal şartlarımız. Tüm ücretli planlarda 14 günlük para iade garantisi.' },
    date:  'May 2025',
    svg: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2"/>
      <line x1="1" y1="10" x2="23" y2="10"/>
    </svg>`,
    color: '#0ea5e9', bg: '#f0f9ff', border: '#bae6fd',
  },
  {
    href: '/legal/license',
    title: { en:'Software License', ar:'رخصة البرنامج', fr:'Licence du logiciel', tr:'Yazılım Lisansı' },
    desc:  { en:'The proprietary software license that governs the use of WABEK platform and its source code.', ar:'رخصة البرنامج الملكي التي تحكم استخدام منصة WABEK وكودها المصدري.', fr:'La licence logicielle propriétaire qui régit l\'utilisation de la plateforme WABEK.', tr:'WABEK platformunun ve kaynak kodunun kullanımını yöneten tescilli yazılım lisansı.' },
    date:  'May 2025',
    svg: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2"/>
      <path d="M7 11V7a5 5 0 0110 0v4"/>
    </svg>`,
    color: '#f59e0b', bg: '#fffbeb', border: '#fde68a',
  },
  {
    href: '/legal/accessibility',
    title: { en:'Accessibility Statement', ar:'بيان إمكانية الوصول', fr:'Déclaration d\'accessibilité', tr:'Erişilebilirlik Bildirimi' },
    desc:  { en:'Our commitment to making WABEK accessible to all users, regardless of ability or disability.', ar:'التزامنا بجعل WABEK في متناول جميع المستخدمين، بغض النظر عن قدراتهم.', fr:'Notre engagement à rendre WABEK accessible à tous les utilisateurs.', tr:'WABEK\'i tüm kullanıcılar için erişilebilir kılma taahhüdümüz.' },
    date:  'May 2025',
    svg: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="8" r="1" fill="#ec4899"/>
      <line x1="12" y1="11" x2="12" y2="17"/>
      <line x1="9" y1="13" x2="12" y2="11"/>
      <line x1="15" y1="13" x2="12" y2="11"/>
    </svg>`,
    color: '#ec4899', bg: '#fdf2f8', border: '#fbcfe8',
  },
]

export default function LegalIndexPage() {
  const { brandName } = useWhiteLabel()
  const name = brandName || 'WABEK'
  const [lang, setLang] = useState<string>(() => typeof window !== 'undefined' ? localStorage.getItem('lang') || 'en' : 'en')
  const isRTL = lang === 'ar'
  const dir = isRTL ? 'rtl' : 'ltr'

  useEffect(() => {
    const s = localStorage.getItem('lang') || 'en'
    setLang(s)
    const h = (e: any) => setLang(e.detail)
    window.addEventListener('langchange', h)
    return () => window.removeEventListener('langchange', h)
  }, [])

  return (<>
    <Head>
      <link rel="icon" href={LOGO} />
      <title>{T(lang, 'title')} | {name}</title>
      <meta name="description" content={T(lang, 'subtitle')} />
    </Head>
    <div style={{background:'#fff', minHeight:'100vh', direction:dir}}>
      <PublicNav active="/legal" onLangChange={setLang} />
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111b21}
        .sw{max-width:860px;margin:0 auto;padding:0 24px}
        .doc-card{background:#fff;border:1px solid #e9edef;border-radius:16px;padding:28px 24px;display:flex;gap:20px;align-items:flex-start;transition:all .2s;text-decoration:none;color:inherit}
        .doc-card:hover{box-shadow:0 8px 32px rgba(0,0,0,.08);transform:translateY(-2px)}
        .doc-icon{width:56px;height:56px;border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .doc-arrow{color:#adb5bd;flex-shrink:0;align-self:center;transition:transform .2s}
        .doc-card:hover .doc-arrow{transform:translateX(${isRTL?'-4px':'4px'})}
        @media(max-width:560px){
          .doc-card{padding:18px 16px;gap:14px}
          .doc-icon{width:44px;height:44px;border-radius:10px}
          .sw{padding:0 12px}
        }
      `}</style>

      {/* Hero */}
      <section style={{background:'linear-gradient(180deg,#f9fafb 0%,#fff 100%)',padding:'64px 0 48px',borderBottom:'1px solid #f3f4f6'}}>
        <div className="sw" style={{textAlign:'center'}}>
          <div style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:64,height:64,borderRadius:18,background:'#f9fafb',border:'1px solid #e9edef',marginBottom:20}}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </div>
          <h1 style={{fontSize:'clamp(28px,5vw,44px)',fontWeight:900,color:'#111b21',marginBottom:12}}>{T(lang,'title')}</h1>
          <p style={{fontSize:16,color:'#54656f',maxWidth:500,margin:'0 auto',lineHeight:1.7}}>{T(lang,'subtitle')}</p>
        </div>
      </section>

      {/* Documents grid */}
      <section style={{padding:'48px 0 64px'}}>
        <div className="sw">
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            {DOCS.map(doc => (
              <Link key={doc.href} href={doc.href} className="doc-card">
                <div className="doc-icon" style={{background:doc.bg, border:`1px solid ${doc.border}`}}
                  dangerouslySetInnerHTML={{__html: doc.svg}} />
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6,flexWrap:'wrap'}}>
                    <h2 style={{fontSize:16,fontWeight:800,color:'#111b21'}}>{doc.title[lang]||doc.title.en}</h2>
                    <span style={{fontSize:11,color:'#8696a0',background:'#f3f4f6',borderRadius:100,padding:'2px 10px',fontWeight:600,flexShrink:0}}>
                      {T(lang,'updated')}: {doc.date}
                    </span>
                  </div>
                  <p style={{fontSize:14,color:'#54656f',lineHeight:1.6,marginBottom:10}}>{doc.desc[lang]||doc.desc.en}</p>
                  <span style={{fontSize:13,fontWeight:700,color:doc.color,display:'inline-flex',alignItems:'center',gap:4}}>
                    {T(lang,'read_doc')}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="5" y1="12" x2="19" y2="12"/>
                      <polyline points={isRTL ? "12 19 5 12 12 5" : "12 5 19 12 12 19"}/>
                    </svg>
                  </span>
                </div>
                <div className="doc-arrow">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points={isRTL ? "15 18 9 12 15 6" : "9 18 15 12 9 6"}/>
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Company info */}
      <section style={{background:'#f9fafb',borderTop:'1px solid #f3f4f6',padding:'40px 24px'}}>
        <div className="sw" style={{textAlign:'center'}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:8,marginBottom:12}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <span style={{fontSize:13,fontWeight:700,color:'#374151'}}>WEBEK LTD</span>
          </div>
          <p style={{fontSize:12,color:'#8696a0',lineHeight:1.7,maxWidth:600,margin:'0 auto 20px'}}>{T(lang,'company')}</p>
          <p style={{fontSize:13,color:'#54656f'}}>
            {T(lang,'questions')} {T(lang,'contact_us')}{' '}
            <a href="mailto:legal@waabek.com" style={{color:'#25D366',fontWeight:700,textDecoration:'none'}}>legal@waabek.com</a>
          </p>
        </div>
      </section>

      <PublicFooter lang={lang} onLangChange={setLang} />
    </div>
  </>)
}
