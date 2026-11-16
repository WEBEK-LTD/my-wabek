// @ts-nocheck
import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import { usePlans } from '@/hooks/usePlans'
import PublicNav from '@/components/PublicNav'
import PublicFooter from '@/components/PublicFooter'
import { t, getStoredLang } from '@/lib/i18n'

const LOGO = '/brand/favicon-32.png'

const CHECK = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>

const FAQS = [
  { q: { en:'Is there a free plan?', ar:'هل يوجد خطة مجانية؟', fr:'Y a-t-il un plan gratuit ?', tr:'Ücretsiz plan var mı?' },
    a: { en:"Yes! Our Free plan includes 500 messages/month, 1 WhatsApp number, and full access to campaigns and chatbot features. No credit card required.", ar:"نعم! الخطة المجانية تشمل 500 رسالة شهرياً ورقم واتساب واحد وإمكانية الوصول الكامل للحملات وميزات الشات بوت. بدون بطاقة ائتمان.", fr:"Oui ! Notre plan gratuit comprend 500 messages/mois, 1 numéro WhatsApp et un accès complet aux campagnes.", tr:"Evet! Ücretsiz planımız ayda 500 mesaj, 1 WhatsApp numarası içerir. Kredi kartı gerekmez." } },
  { q: { en:'Can I cancel at any time?', ar:'هل يمكنني الإلغاء في أي وقت؟', fr:'Puis-je annuler à tout moment ?', tr:'İstediğim zaman iptal edebilir miyim?' },
    a: { en:"Absolutely. No contracts, no cancellation fees. Cancel anytime from your billing dashboard and your account stays active until the end of the billing period.", ar:"بالتأكيد. لا توجد عقود ولا رسوم إلغاء. يمكنك الإلغاء في أي وقت ويبقى حسابك نشطاً حتى نهاية فترة الفوترة.", fr:"Absolument. Pas de contrats, pas de frais d'annulation. Annulez à tout moment.", tr:"Kesinlikle. Sözleşme yok, iptal ücreti yok. İstediğiniz zaman iptal edin." } },
  { q: { en:'What payment methods do you accept?', ar:'ما هي طرق الدفع المقبولة؟', fr:'Quels modes de paiement acceptez-vous ?', tr:'Hangi ödeme yöntemlerini kabul ediyorsunuz?' },
    a: { en:"We accept all major credit cards (Visa, Mastercard, Amex), PayPal, and bank transfers for annual plans. Payments are processed securely via Stripe.", ar:"نقبل جميع بطاقات الائتمان الرئيسية (فيزا، ماستركارد، أمكس) وباي بال والتحويل البنكي للخطط السنوية. تتم المعالجة بشكل آمن عبر Stripe.", fr:"Nous acceptons toutes les cartes de crédit majeures, PayPal et virements bancaires.", tr:"Tüm büyük kredi kartlarını, PayPal'ı ve yıllık planlar için banka transferini kabul ediyoruz." } },
  { q: { en:'Do you offer a free trial?', ar:'هل تقدمون تجربة مجانية؟', fr:'Offrez-vous un essai gratuit ?', tr:'Ücretsiz deneme sunuyor musunuz?' },
    a: { en:"Yes! All paid plans include a 14-day free trial. No credit card required to start. You can upgrade, downgrade, or cancel at any time.", ar:"نعم! جميع الخطط المدفوعة تشمل تجربة مجانية لمدة 14 يوماً. لا تحتاج لبطاقة ائتمان للبدء.", fr:"Oui ! Tous les plans payants incluent un essai gratuit de 14 jours. Pas de carte de crédit requise.", tr:"Evet! Tüm ücretli planlar 14 günlük ücretsiz deneme içerir. Kredi kartı gerekmez." } },
  { q: { en:'Can I switch plans anytime?', ar:'هل يمكنني تغيير الخطة في أي وقت؟', fr:'Puis-je changer de plan à tout moment ?', tr:'Planımı istediğim zaman değiştirebilir miyim?' },
    a: { en:"Yes. You can upgrade or downgrade your plan at any time. Upgrades take effect immediately. Downgrades take effect at the next billing cycle.", ar:"نعم. يمكنك الترقية أو التخفيض في أي وقت. الترقيات تأخذ مفعولها فوراً. التخفيضات تأخذ مفعولها في دورة الفوترة التالية.", fr:"Oui. Vous pouvez changer de plan à tout moment. Les mises à niveau prennent effet immédiatement.", tr:"Evet. İstediğiniz zaman planınızı yükseltebilir veya düşürebilirsiniz." } },
  { q: { en:'Is my WhatsApp account safe?', ar:'هل حساب واتساب الخاص بي آمن؟', fr:'Mon compte WhatsApp est-il sécurisé ?', tr:'WhatsApp hesabım güvende mi?' },
    a: { en:"Yes. WABEK uses the official WhatsApp Business API (Meta Cloud API), which is fully compliant with Meta's terms of service. Your account is never at risk of being banned.", ar:"نعم. يستخدم WABEK واجهة برمجة تطبيقات واتساب للأعمال الرسمية (Meta Cloud API)، والتي تتوافق تماماً مع شروط خدمة Meta. حسابك لن يتعرض للحظر.", fr:"Oui. WABEK utilise l'API WhatsApp Business officielle (Meta Cloud API), entièrement conforme.", tr:"Evet. WABEK resmi WhatsApp Business API'sini kullanır. Hesabınız asla ban riski taşımaz." } },
]

const COMPARE_FEATURES = [
  { key: { en:'Messages/month', ar:'رسائل/شهر', fr:'Messages/mois', tr:'Mesaj/ay' }, values: ['500', '50,000', 'Unlimited', 'Unlimited'] },
  { key: { en:'WhatsApp numbers', ar:'أرقام واتساب', fr:'Numéros WhatsApp', tr:'WhatsApp numarası' }, values: ['1', '5', '30', 'Unlimited'] },
  { key: { en:'Bulk campaigns', ar:'حملات جماعية', fr:'Campagnes en masse', tr:'Toplu kampanyalar' }, values: [true, true, true, true] },
  { key: { en:'AI auto-reply', ar:'الرد الآلي بالذكاء الاصطناعي', fr:'Réponse automatique IA', tr:'Yapay zeka otomatik yanıt' }, values: [false, true, true, true] },
  { key: { en:'Chatbot builder', ar:'منشئ الشات بوت', fr:'Constructeur de chatbot', tr:'Chatbot oluşturucu' }, values: [true, true, true, true] },
  { key: { en:'Analytics', ar:'التحليلات', fr:'Analytique', tr:'Analitik' }, values: [false, true, true, true] },
  { key: { en:'White label', ar:'العلامة البيضاء', fr:'Marque blanche', tr:'Beyaz etiket' }, values: [false, false, true, true] },
  { key: { en:'API access', ar:'الوصول للـ API', fr:'Accès API', tr:'API erişimi' }, values: [true, true, true, true] },
  { key: { en:'Priority support', ar:'دعم ذو أولوية', fr:'Support prioritaire', tr:'Öncelikli destek' }, values: [false, true, true, true] },
  { key: { en:'24/7 support', ar:'دعم 24/7', fr:'Support 24/7', tr:'7/24 destek' }, values: [false, false, false, true] },
]

export default function PricingPage() {
  const { brandName } = useWhiteLabel()
  const name = brandName || 'WABEK'
  const [lang, setLang] = useState<string>(() => typeof window !== 'undefined' ? localStorage.getItem('lang') || 'en' : 'en')
  const [annual, setAnnual] = useState(false)
  const [openFaq, setOpenFaq] = useState<number|null>(null)
  const { plans, loading } = usePlans()
  const isRTL = lang === 'ar'
  const dir = isRTL ? 'rtl' : 'ltr'

  useEffect(() => {
    const stored = localStorage.getItem('lang') || 'en'
    setLang(stored)
    const h = (e:any) => setLang(e.detail)
    window.addEventListener('langchange', h)
    return () => window.removeEventListener('langchange', h)
  }, [])

  const STRINGS: Record<string,Record<string,string>> = {
    title:       { en:`Simple, Transparent Pricing`, ar:`أسعار بسيطة وشفافة`, fr:`Tarification simple et transparente`, tr:`Basit ve Şeffaf Fiyatlandırma` },
    subtitle:    { en:`Start free. Upgrade when you're ready. Cancel anytime.`, ar:`ابدأ مجاناً. قم بالترقية عندما تكون جاهزاً. ألغِ في أي وقت.`, fr:`Commencez gratuitement. Mettez à niveau quand vous êtes prêt.`, tr:`Ücretsiz başlayın. Hazır olduğunuzda yükseltin. İstediğiniz zaman iptal edin.` },
    monthly:     { en:`Monthly`, ar:`شهري`, fr:`Mensuel`, tr:`Aylık` },
    annual:      { en:`Annual`, ar:`سنوي`, fr:`Annuel`, tr:`Yıllık` },
    save:        { en:`Save 20%`, ar:`وفّر 20%`, fr:`Économisez 20%`, tr:`%20 Tasarruf` },
    per_month:   { en:`/month`, ar:`/شهر`, fr:`/mois`, tr:`/ay` },
    free:        { en:`Free forever`, ar:`مجاني للأبد`, fr:`Gratuit pour toujours`, tr:`Sonsuza kadar ücretsiz` },
    popular:     { en:`Most Popular`, ar:`الأكثر شيوعاً`, fr:`Le plus populaire`, tr:`En Popüler` },
    trial:       { en:`14-day free trial`, ar:`تجربة مجانية 14 يوم`, fr:`Essai gratuit 14 jours`, tr:`14 günlük ücretsiz deneme` },
    no_card:     { en:`No credit card required`, ar:`لا تحتاج لبطاقة ائتمان`, fr:`Aucune carte de crédit requise`, tr:`Kredi kartı gerekmez` },
    compare:     { en:`Compare all features`, ar:`مقارنة كل الميزات`, fr:`Comparer toutes les fonctionnalités`, tr:`Tüm özellikleri karşılaştır` },
    faq_title:   { en:`Frequently Asked Questions`, ar:`الأسئلة الشائعة`, fr:`Questions fréquemment posées`, tr:`Sık Sorulan Sorular` },
    faq_sub:     { en:`Everything you need to know about pricing.`, ar:`كل ما تحتاج معرفته عن الأسعار.`, fr:`Tout ce que vous devez savoir sur les tarifs.`, tr:`Fiyatlandırma hakkında bilmeniz gereken her şey.` },
    cta_title:   { en:`Ready to get started?`, ar:`هل أنت مستعد للبدء؟`, fr:`Prêt à commencer ?`, tr:`Başlamaya hazır mısınız?` },
    cta_sub:     { en:`Join thousands of businesses using ${name} to automate their WhatsApp.`, ar:`انضم إلى آلاف الشركات التي تستخدم ${name} لأتمتة واتساب.`, fr:`Rejoignez des milliers d'entreprises utilisant ${name}.`, tr:`${name} kullanan binlerce işletmeye katılın.` },
    get_started: { en:`Get Started Free`, ar:`ابدأ مجاناً`, fr:`Commencer gratuitement`, tr:`Ücretsiz Başla` },
    contact:     { en:`Contact Sales`, ar:`تواصل مع المبيعات`, fr:`Contacter les ventes`, tr:`Satışa Ulaşın` },
    trust_title: { en:`Trusted by thousands of businesses`, ar:`موثوق من آلاف الشركات`, fr:`Approuvé par des milliers d'entreprises`, tr:`Binlerce işletme tarafından güvenilen` },
  }
  const T = (key: string) => STRINGS[key]?.[lang] || STRINGS[key]?.en || key

  const planColor = (popular: boolean) => popular ? { bg:'#25D366', text:'#fff', border:'#25D366' } : { bg:'#fff', text:'#111b21', border:'#e9edef' }

  return (<>
    <Head>
      <link rel="icon" href={LOGO} />
      <title>{T('title')} | {name}</title>
      <meta name="description" content={T('subtitle')} />
    </Head>
    <div style={{background:'#fff',minHeight:'100vh',direction:dir}}>
      <PublicNav active="/pricing" onLangChange={setLang} />
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111b21}
        .sw{max-width:1140px;margin:0 auto;padding:0 24px}
        .grid{display:grid;gap:20px}
        .g4{grid-template-columns:repeat(4,1fr)}
        .g3{grid-template-columns:repeat(3,1fr)}
        .g2{grid-template-columns:repeat(2,1fr)}
        .pcard{border-radius:20px;padding:32px 28px;position:relative;transition:transform .2s,box-shadow .2s;display:flex;flex-direction:column}
        .pcard:hover{transform:translateY(-4px);box-shadow:0 20px 40px rgba(0,0,0,.1)}
        .feat-check{color:#25D366;flex-shrink:0;margin-top:1px}
        .feat-check.off{color:#d1d5db}
        .compare-table{width:100%;border-collapse:collapse;font-size:14px}
        .compare-table th,.compare-table td{padding:12px 16px;text-align:center;border-bottom:1px solid #f3f4f6}
        .compare-table th:first-child,.compare-table td:first-child{text-align:${isRTL?'right':'left'}}
        .compare-table tr:last-child td{border-bottom:none}
        .compare-table tr:hover td{background:#f9fafb}
        .faq-item{border-bottom:1px solid #f3f4f6;overflow:hidden}
        .trust-badge{background:#f9fafb;border:1px solid #e9edef;border-radius:12px;padding:20px 24px;text-align:center}
        @media(max-width:900px){.g4{grid-template-columns:repeat(2,1fr)}.g3{grid-template-columns:1fr}}
        @media(max-width:560px){.g4{grid-template-columns:1fr}.g2{grid-template-columns:1fr}}
      `}</style>

      {/* ── Hero ── */}
      <section style={{padding:'72px 0 48px',textAlign:'center',background:'linear-gradient(180deg,#f9fafb 0%,#fff 100%)'}}>
        <div className="sw">
          <h1 style={{fontSize:'clamp(28px,5vw,52px)',fontWeight:900,lineHeight:1.1,marginBottom:16,color:'#111b21'}}>{T('title')}</h1>
          <p style={{fontSize:18,color:'#54656f',marginBottom:36,maxWidth:520,margin:'0 auto 36px'}}>{T('subtitle')}</p>

          {/* Toggle */}
          <div style={{display:'inline-flex',background:'#f3f4f6',borderRadius:100,padding:4,gap:4}}>
            <button onClick={()=>setAnnual(false)} style={{padding:'8px 22px',borderRadius:100,border:'none',fontWeight:600,fontSize:14,cursor:'pointer',background:annual?'transparent':'#fff',color:annual?'#6b7280':'#111b21',boxShadow:annual?'none':'0 1px 4px rgba(0,0,0,.1)',transition:'all .2s'}}>{T('monthly')}</button>
            <button onClick={()=>setAnnual(true)} style={{padding:'8px 22px',borderRadius:100,border:'none',fontWeight:600,fontSize:14,cursor:'pointer',background:annual?'#fff':'transparent',color:annual?'#111b21':'#6b7280',boxShadow:annual?'0 1px 4px rgba(0,0,0,.1)':'none',transition:'all .2s',display:'flex',alignItems:'center',gap:8}}>
              {T('annual')} <span style={{background:'#dcfce7',color:'#166534',fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:100}}>{T('save')}</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── Plans ── */}
      <section style={{padding:'0 0 64px'}}>
        <div className="sw">
          {loading ? (
            <div style={{textAlign:'center',padding:40,color:'#8696a0'}}>Loading plans...</div>
          ) : (
            <div className="grid g4">
              {plans.map((p, i) => {
                const popular = p.is_popular || false
                const col = planColor(popular)
                const price = annual ? (p.price_annual || Math.round(p.price_monthly * 0.8)) : p.price_monthly
                const features = Array.isArray(p.features) ? p.features : []
                return (
                  <div key={p.id} className="pcard" style={{background:col.bg,border:`2px solid ${col.border}`,color:col.text,boxShadow:popular?'0 20px 60px rgba(37,211,102,.2)':'0 2px 8px rgba(0,0,0,.06)'}}>
                    {(popular || p.badge) && (
                      <div style={{position:'absolute',top:-14,left:'50%',transform:'translateX(-50%)',background:'#111b21',color:'#0F172A',fontSize:11,fontWeight:800,padding:'5px 18px',borderRadius:100,whiteSpace:'nowrap',letterSpacing:.5}}>
                        {p.badge || T('popular')}
                      </div>
                    )}
                    <div style={{marginBottom:24}}>
                      <p style={{fontSize:13,fontWeight:700,color:popular?'rgba(255,255,255,.7)':'#8696a0',marginBottom:6,textTransform:'uppercase',letterSpacing:.5}}>{p.name}</p>
                      <div style={{display:'flex',alignItems:'baseline',gap:4}}>
                        <span style={{fontSize:44,fontWeight:900,lineHeight:1,color:popular?'#fff':'#25D366'}}>${price}</span>
                        <span style={{fontSize:13,color:popular?'rgba(255,255,255,.6)':'#8696a0'}}>{price===0 ? '' : T('per_month')}</span>
                      </div>
                      {price===0 ? <p style={{fontSize:12,color:popular?'rgba(255,255,255,.6)':'#8696a0',marginTop:4}}>{T('free')}</p>
                        : annual && p.price_annual ? <p style={{fontSize:12,color:popular?'rgba(255,255,255,.7)':'#8696a0',marginTop:4}}>billed ${p.price_annual*12}/year</p>
                        : <p style={{fontSize:12,color:popular?'rgba(255,255,255,.6)':'#8696a0',marginTop:4}}>{T('trial')}</p>}
                      {p.description && <p style={{fontSize:13,color:popular?'rgba(255,255,255,.75)':'#54656f',marginTop:8,lineHeight:1.5}}>{p.description}</p>}
                    </div>

                    <ul style={{listStyle:'none',marginBottom:28,flex:1,display:'flex',flexDirection:'column',gap:10}}>
                      {features.map((f,fi) => (
                        <li key={fi} style={{display:'flex',alignItems:'flex-start',gap:10,fontSize:14,color:popular?'rgba(255,255,255,.9)':'#374151'}}>
                          <span style={{color:popular?'rgba(255,255,255,.9)':'#25D366',flexShrink:0,marginTop:1}}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                          </span>
                          {f}
                        </li>
                      ))}
                    </ul>

                    <Link href={p.cta_text?.toLowerCase().includes('sales') ? '/support#contact' : '/auth/register'}
                      style={{display:'block',textAlign:'center',padding:'13px',borderRadius:10,fontSize:15,fontWeight:700,textDecoration:'none',background:popular?'#fff':'#25D366',color:popular?'#25D366':'#fff',transition:'opacity .2s'}}
                      onMouseOver={e=>(e.currentTarget.style.opacity='.85')}
                      onMouseOut={e=>(e.currentTarget.style.opacity='1')}>
                      {p.cta_text || (price===0 ? T('get_started') : T('get_started'))} →
                    </Link>
                    {price>0 && <p style={{fontSize:11,textAlign:'center',color:popular?'rgba(255,255,255,.5)':'#adb5bd',marginTop:10}}>{T('no_card')}</p>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── Trust badges ── */}
      <section style={{padding:'0 0 64px',background:'#f9fafb'}}>
        <div className="sw" style={{padding:'48px 24px'}}>
          <h2 style={{textAlign:'center',fontSize:'clamp(20px,3vw,28px)',fontWeight:800,marginBottom:36,color:'#111b21'}}>{T('trust_title')}</h2>
          <div className="grid g4">
            {[
              {n:'10,000+',l:{en:'Businesses',ar:'شركة',fr:'Entreprises',tr:'İşletme'}},
              {n:'500M+',l:{en:'Messages sent',ar:'رسالة أُرسلت',fr:'Messages envoyés',tr:'Gönderilen mesaj'}},
              {n:'99.9%',l:{en:'Uptime SLA',ar:'ضمان التشغيل',fr:'SLA de disponibilité',tr:'Çalışma süresi SLA'}},
              {n:'4.9★',l:{en:'Average rating',ar:'متوسط التقييم',fr:'Note moyenne',tr:'Ortalama puan'}},
            ].map(b => (
              <div key={b.n} className="trust-badge">
                <p style={{fontSize:32,fontWeight:900,color:'#25D366',marginBottom:4}}>{b.n}</p>
                <p style={{fontSize:13,color:'#54656f'}}>{b.l[lang]||b.l.en}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Compare table ── */}
      <section style={{padding:'64px 0'}}>
        <div className="sw">
          <h2 style={{textAlign:'center',fontSize:'clamp(22px,4vw,34px)',fontWeight:800,marginBottom:40,color:'#111b21'}}>{T('compare')}</h2>
          <div style={{overflowX:'auto',borderRadius:16,border:'1px solid #e9edef',boxShadow:'0 2px 8px rgba(0,0,0,.04)'}}>
            <table className="compare-table">
              <thead>
                <tr style={{background:'#f9fafb'}}>
                  <th style={{padding:'16px',fontWeight:700,color:'#374151'}}></th>
                  {plans.map(p => (
                    <th key={p.id} style={{padding:'16px',fontWeight:800,color:p.is_popular?'#25D366':'#111b21'}}>
                      {p.name}
                      {p.is_popular && <div style={{fontSize:10,color:'#25D366',fontWeight:600,marginTop:2}}>{T('popular')}</div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE_FEATURES.map((row,i) => (
                  <tr key={i}>
                    <td style={{fontWeight:500,color:'#374151'}}>{row.key[lang]||row.key.en}</td>
                    {row.values.map((v,vi) => (
                      <td key={vi} style={{color:typeof v==='boolean'?(v?'#25D366':'#d1d5db'):'#111b21',fontWeight:500}}>
                        {typeof v==='boolean'
                          ? v ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2.5" strokeLinecap="round" style={{display:'inline-block'}}><polyline points="20 6 9 17 4 12"/></svg>
                              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2.5" strokeLinecap="round" style={{display:'inline-block'}}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          : v
                        }
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{padding:'64px 0',background:'#f9fafb'}}>
        <div className="sw" style={{maxWidth:720}}>
          <h2 style={{textAlign:'center',fontSize:'clamp(22px,4vw,34px)',fontWeight:800,marginBottom:8,color:'#111b21'}}>{T('faq_title')}</h2>
          <p style={{textAlign:'center',color:'#54656f',marginBottom:40,fontSize:16}}>{T('faq_sub')}</p>
          <div style={{border:'1px solid #e9edef',borderRadius:16,overflow:'hidden',background:'#fff'}}>
            {FAQS.map((faq,i) => (
              <div key={i} className="faq-item">
                <button onClick={()=>setOpenFaq(openFaq===i?null:i)}
                  style={{width:'100%',padding:'20px 24px',background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,textAlign:isRTL?'right':'left'}}>
                  <span style={{fontWeight:700,fontSize:15,color:'#111b21'}}>{faq.q[lang]||faq.q.en}</span>
                  <span style={{color:'#25D366',fontSize:20,flexShrink:0,transform:openFaq===i?'rotate(45deg)':'none',transition:'transform .2s'}}>+</span>
                </button>
                {openFaq===i && (
                  <div style={{padding:'0 24px 20px',fontSize:14,color:'#54656f',lineHeight:1.7}}>{faq.a[lang]||faq.a.en}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{background:'linear-gradient(135deg,#25D366,#128C7E)',padding:'72px 24px',textAlign:'center'}}>
        <h2 style={{fontSize:'clamp(24px,4vw,40px)',fontWeight:900,color:'#0F172A',marginBottom:12}}>{T('cta_title')}</h2>
        <p style={{fontSize:17,color:'rgba(255,255,255,.85)',marginBottom:32,maxWidth:500,margin:'0 auto 32px'}}>{T('cta_sub')}</p>
        <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
          <Link href="/auth/register" style={{background:'#fff',color:'#25D366',padding:'14px 36px',borderRadius:10,fontSize:16,fontWeight:700,textDecoration:'none'}}>{T('get_started')} →</Link>
          <Link href="/support#contact" style={{background:'rgba(255,255,255,.15)',color:'#0F172A',padding:'14px 36px',borderRadius:10,fontSize:16,fontWeight:700,textDecoration:'none',border:'2px solid rgba(255,255,255,.3)'}}>{T('contact')}</Link>
        </div>
        <p style={{fontSize:12,color:'rgba(255,255,255,.6)',marginTop:16}}>{T('no_card')} · {T('trial')}</p>
      </section>

      <PublicFooter lang={lang} onLangChange={setLang} />
    </div>
  </>)
}
