// @ts-nocheck
import Link from 'next/link'

const T: Record<string,any> = {
  en: {
    badge: 'WhatsApp Business Platform',
    title1: 'Automate your business', title2: 'on', title3: 'WhatsApp',
    sub: 'Send campaigns, handle customer replies, and manage your team inbox from one clean dashboard.',
    cta1: 'Start for free', cta2: 'See features', note: 'Free plan included. No credit card required.',
    camp_title: 'Summer Sale', camp_sub: '4,820 contacts · 2h ago', camp_live: 'Live',
    delivered: 'Delivered', read: 'Read', replies: 'Replies',
    inbox_title: 'Team Inbox', inbox_open: '12 open',
    m1: 'Ahmed: Can I change my delivery address?', m2: 'Sarah: When does my trial end exactly?', m3: 'Carlos: Need help setting up the API',
    reply_title: 'Auto-Reply', reply_sub: '48 handled today',
    q: 'What are your shipping times?', a: 'We ship within 24h. Track your order at waabek.com/track',
    replied: 'Replied in 0.3s',

    wa_name: 'Business Store', wa_online: 'online', wa_message: 'Message',
    m_recv1: 'Your order is confirmed', m_sent1: 'When will it ship?', m_order: 'Order #1042', m_ships: 'Ships tomorrow', m_recv2: 'Arrives tomorrow!', m_sent2: 'Perfect, thanks!',
    badge_rate: '98% read rate', badge_del: 'Delivered in 1s',
  },
  ar: {
    badge: 'منصة واتساب للأعمال',
    title1: 'أتمت أعمالك', title2: 'على', title3: 'واتساب',
    sub: 'أرسل حملات، تعامل مع ردود العملاء، وأدر صندوق بريد فريقك من لوحة تحكم واحدة.',
    cta1: 'ابدأ مجاناً', cta2: 'استكشف المميزات', note: 'خطة مجانية متاحة. لا بطاقة ائتمان.',
    camp_title: 'حملة الصيف', camp_sub: '4,820 جهة اتصال · منذ ساعتين', camp_live: 'مباشر',
    delivered: 'تم التسليم', read: 'قراءة', replies: 'ردود',
    inbox_title: 'صندوق الفريق', inbox_open: '12 مفتوح',
    m1: 'أحمد: هل يمكنني تغيير عنوان التسليم؟', m2: 'سارة: متى تنتهي فترة التجربة المجانية؟', m3: 'كارلوس: أحتاج مساعدة في الـ API',
    reply_title: 'الرد التلقائي', reply_sub: '48 محادثة اليوم',
    q: 'ما هي مواعيد الشحن لديكم؟', a: 'نشحن خلال 24 ساعة. تتبع طلبك على waabek.com/track',
    replied: 'رد خلال 0.3 ثانية',

    wa_name: 'متجر الأعمال', wa_online: 'متصل', wa_message: 'رسالة',
    m_recv1: 'تم تأكيد طلبك', m_sent1: 'متى سيتم الشحن؟', m_order: 'الطلب رقم 1042', m_ships: 'يشحن غداً', m_recv2: 'يصل غداً!', m_sent2: 'ممتاز، شكراً!',
    badge_rate: 'معدل قراءة 98%', badge_del: 'تسليم خلال ثانية',
  },
  fr: {
    badge: "Plateforme WhatsApp Business",
    title1: "Automatisez votre entreprise", title2: "sur", title3: "WhatsApp",
    sub: "Envoyez des campagnes, gérez les réponses clients et votre boite de réception depuis un tableau de bord.",
    cta1: "Commencer gratuitement", cta2: "Voir les fonctions", note: "Plan gratuit inclus. Sans carte bancaire.",
    camp_title: "Soldes été", camp_sub: "4 820 contacts · il y a 2h", camp_live: "En direct",
    delivered: "Livré", read: "Lu", replies: "Réponses",
    inbox_title: "Boite équipe", inbox_open: "12 ouverts",
    m1: "Ahmed: Puis-je changer mon adresse?", m2: "Sarah: Quand se termine mon essai?", m3: "Carlos: Aide pour la configuration API",
    reply_title: "Réponse auto", reply_sub: "48 traitées ce jour",
    q: "Quels sont vos délais de livraison?", a: "Nous livrons en 24h. Suivez votre commande sur waabek.com/track",
    replied: "Répondu en 0.3s",
    wa_name: "Business Store", wa_online: "en ligne", wa_message: "Message",
    m_recv1: "Commande confirmée", m_sent1: "Quand sera expédiée?", m_order: "Commande #1042", m_ships: "Expédié demain", m_recv2: "Arrive demain!", m_sent2: "Parfait, merci!",
    badge_rate: "98% taux de lecture", badge_del: "Livré en 1s",
  },
  tr: {
    badge: "WhatsApp İş Platformu",
    title1: "İşletmenizi", title2: "WhatsApp'ta", title3: "otomatikleştirin",
    sub: "Kampanya gönderin, müşteri yanıtlarını yönetin ve ekip kutunuzu tek panelden kontrol edin.",
    cta1: "Ücretsiz başla", cta2: "Özellikleri gör", note: "Ücretsiz plan dahil. Kredi kartı gerekmez.",
    camp_title: "Yaz Kampanyası", camp_sub: "4.820 kişi · 2 saat önce", camp_live: "Canlı",
    delivered: "İletildi", read: "Okundu", replies: "Yanıt",
    inbox_title: "Ekip Kutusu", inbox_open: "12 açık",
    m1: "Ahmed: Teslimat adresimi değiştirebilir miyim?", m2: "Sarah: Deneme sürem ne zaman bitiyor?", m3: "Carlos: API kurulumu için yardım gerekiyor",
    reply_title: "Otomatik Yanıt", reply_sub: "Bugün 48 konuşma",
    q: "Kargo süreleriniz ne kadar?", a: "Siparişleri 24 saatte kargoluyoruz. waabek.com/track adresinden takip edin",
    replied: "0.3 saniyede yanıtlandı",

    wa_name: "Mağaza", wa_online: "çevrimiçi", wa_message: "Mesaj",
    m_recv1: "Siparişiniz onaylandı", m_sent1: "Ne zaman gönderilecek?", m_order: "Sipariş #1042", m_ships: "Yarın kargoda", m_recv2: "Yarın ulaşır!", m_sent2: "Harika, teşekkürler!",
    badge_rate: "98% okunma oranı", badge_del: "1 saniyede iletildi",
  },
}

export default function HeroIllustration({ lang = 'en' }: { lang: string }) {
  const isRTL = lang === 'ar'
  const tx = T[lang] || T.en
  const dir = isRTL ? 'rtl' : 'ltr'

  const card: React.CSSProperties = {
    background: '#fff', border: '1px solid #f1f5f9', borderRadius: 14,
    padding: '16px 18px', boxShadow: '0 1px 4px rgba(0,0,0,.04)',
  }
  const iconBox = (bg: string) => ({
    width: 34, height: 34, background: bg, borderRadius: 9,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  })

  return (
    <div style={{ direction: dir, padding: '72px 0 0' }}>
      {/* grid: text left, cards right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 48, alignItems: 'center' }} className="hero-grid">

        {/* LEFT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="hero-left-col">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#dcfce7', border: '1px solid #86efac', borderRadius: 100, padding: '5px 14px', width: 'fit-content' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#25D366', display: 'inline-block' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#166534' }}>{tx.badge}</span>
          </div>
          <h1 style={{ fontSize: 'clamp(28px,4vw,56px)', fontWeight: 900, lineHeight: 1.1, letterSpacing: '-1px', color: '#0f172a', margin: 0 }} className="hero-h1">
            {tx.title1}<br />{tx.title2} <span style={{ color: '#25D366' }}>{tx.title3}</span>
          </h1>
          <p style={{ fontSize: 'clamp(14px,1.4vw,17px)', color: '#54656f', lineHeight: 1.75, margin: 0, maxWidth: 440 }} className="hero-sub">{tx.sub}</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }} className="hero-btns">
            <Link href="/auth/register" style={{ background: '#25D366', color: '#fff', padding: '12px 24px', borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>{tx.cta1}</Link>
            <Link href="/features" style={{ color: '#25D366', padding: '11px 22px', borderRadius: 10, fontSize: 14, fontWeight: 700, border: '2px solid #25D366', textDecoration: 'none' }}>{tx.cta2}</Link>
          </div>
          <p style={{ fontSize: 12, color: '#adb5bd', margin: 0, textAlign: isRTL ? 'right' : 'left' }} className="hero-note">{tx.note}</p>
        </div>

        {/* RIGHT: 3 cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} className="hero-desktop-cards">

          {/* Campaign card */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={iconBox('#f0fdf4')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2" strokeLinecap="round"><path d="M22 2L11 13M22 2L15 22 11 13 2 9l20-7z"/></svg>
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: 0 }}>{tx.camp_title}</p>
                  <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>{tx.camp_sub}</p>
                </div>
              </div>
              <span style={{ background: '#dcfce7', color: '#166534', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 100, border: '1px solid #86efac' }}>{tx.camp_live}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {[
                { n: '4,612', l: tx.delivered, bg: '#f8fafc', nc: '#0f172a', lc: '#64748b' },
                { n: '96%', l: tx.read, bg: '#f0fdf4', nc: '#25D366', lc: '#166534' },
                { n: '341', l: tx.replies, bg: '#eff6ff', nc: '#3b82f6', lc: '#1d4ed8' },
              ].map(s => (
                <div key={s.l} style={{ background: s.bg, borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: s.nc, lineHeight: 1 }}>{s.n}</div>
                  <div style={{ fontSize: 10, color: s.lc, marginTop: 3, fontWeight: 500 }}>{s.l}</div>
                </div>
              ))}
            </div>
            <div style={{ height: 3, background: '#f1f5f9', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
              <div style={{ width: '96%', height: '100%', background: '#25D366', borderRadius: 2 }} />
            </div>
          </div>

          {/* Inbox card */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={iconBox('#f0f9ff')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: 0 }}>{tx.inbox_title}</p>
              </div>
              <span style={{ background: '#fef9ec', color: '#92400e', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 100, border: '1px solid #fcd34d' }}>{tx.inbox_open}</span>
            </div>
            {[
              { init: tx.m1[0], msg: tx.m1, bg: '#dcfce7', tc: '#166534' },
              { init: tx.m2[0], msg: tx.m2, bg: '#dbeafe', tc: '#1d4ed8' },
              { init: tx.m3[0], msg: tx.m3, bg: '#fce7f3', tc: '#9d174d' },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', background: '#f8fafc', borderRadius: 9, marginBottom: i < 2 ? 6 : 0 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: r.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: r.tc, flexShrink: 0 }}>{r.init}</div>
                <p style={{ fontSize: 11.5, color: '#374151', margin: 0, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.msg}</p>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#25D366', flexShrink: 0 }} />
              </div>
            ))}
          </div>

          {/* Auto-reply card */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={iconBox('#f5f3ff')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 17h3v3m0-7v4"/></svg>
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: 0 }}>{tx.reply_title}</p>
                  <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>{tx.reply_sub}</p>
                </div>
              </div>
              <div style={{ width: 38, height: 21, background: '#25D366', borderRadius: 11, position: 'relative', flexShrink: 0 }}>
                <div style={{ width: 17, height: 17, background: '#fff', borderRadius: '50%', position: 'absolute', right: 2, top: 2, boxShadow: '0 1px 3px rgba(0,0,0,.15)' }} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px 12px 12px 3px', padding: '9px 13px', fontSize: 12, color: '#1e293b', lineHeight: 1.5, maxWidth: '85%' }}>{tx.q}</div>
              <div style={{ background: '#d9fdd3', borderRadius: '12px 12px 3px 12px', padding: '9px 13px', fontSize: 12, color: '#14532d', lineHeight: 1.5, maxWidth: '90%', alignSelf: 'flex-end' }}>{tx.a}</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f0fdf4', borderRadius: 100, padding: '2px 9px', fontSize: 10, fontWeight: 600, color: '#065f46', alignSelf: 'flex-end' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#065f46" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                {tx.replied}
              </div>
            </div>
          </div>

        </div>

        {/* ── MOBILE PHONE (visible only on mobile) ── */}
        <div className="hero-mobile-phone">
          <div style={{position:'relative'}}>
            {/* iPhone body */}
            <div style={{
              width:200,height:400,
              background:'#1C1C1E',
              borderRadius:44,
              padding:4,
              boxShadow:'0 24px 60px rgba(0,0,0,.32), inset 0 0 0 1px rgba(255,255,255,.1)',
            }}>
              {/* Screen */}
              <div style={{width:'100%',height:'100%',background:'#ece5dd',borderRadius:40,overflow:'hidden',display:'flex',flexDirection:'column'}}>
                {/* Dynamic island */}
                <div style={{width:72,height:18,background:'#000',borderRadius:9,margin:'8px auto 0',flexShrink:0}}/>
                {/* WA Header */}
                <div style={{background:'#075e54',padding:'8px 12px',display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
                  <div style={{width:30,height:30,borderRadius:'50%',background:'#25D366',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#fff',flexShrink:0}}>{tx.wa_av || 'B'}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,fontWeight:600,color:'#fff',lineHeight:1}}>{tx.wa_name || 'Business Store'}</div>
                    <div style={{display:'flex',alignItems:'center',gap:3,marginTop:2}}>
                      <div style={{width:5,height:5,borderRadius:'50%',background:'#4ade80'}}/>
                      <span style={{fontSize:9,color:'#86efac'}}>{tx.wa_online || 'online'}</span>
                    </div>
                  </div>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="2.2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 12.3 19.79 19.79 0 01.22 3.67 2 2 0 012.2 1.5h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 9.47a16 16 0 006.29 6.29l1.54-1.54a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                </div>
                {/* Chat messages */}
                <div style={{flex:1,padding:'10px 8px',display:'flex',flexDirection:'column',gap:7,overflow:'hidden'}}>
                  {/* Received */}
                  <div style={{background:'#fff',borderRadius:'10px 10px 10px 2px',padding:'7px 10px',fontSize:10,color:'#111',lineHeight:1.4,border:'0.5px solid #eee',maxWidth:'85%'}}>{tx.m_recv1 || 'Your order is confirmed'} ✅</div>
                  {/* Sent */}
                  <div style={{background:'#d9fdd3',borderRadius:'10px 10px 2px 10px',padding:'7px 10px',fontSize:10,color:'#1a4c1a',lineHeight:1.4,maxWidth:'82%',alignSelf:'flex-end'}}>{tx.m_sent1 || 'When will it ship?'}</div>
                  {/* Received with card */}
                  <div style={{background:'#fff',borderRadius:'10px 10px 10px 2px',padding:'7px 10px',fontSize:10,color:'#111',lineHeight:1.4,border:'0.5px solid #eee',maxWidth:'90%'}}>
                    <div style={{background:'#f0fdf4',borderRadius:6,padding:'5px 7px',marginBottom:4,border:'0.5px solid #bbf7d0'}}>
                      <div style={{fontSize:9,fontWeight:700,color:'#0f172a'}}>{tx.m_order || 'Order #1042'}</div>
                      <div style={{fontSize:8,color:'#25D366',fontWeight:600,marginTop:1}}>{tx.m_ships || 'Ships tomorrow'}</div>
                    </div>
                    {tx.m_recv2 || 'Arrives tomorrow!'} 🚚
                  </div>
                  {/* Sent */}
                  <div style={{background:'#d9fdd3',borderRadius:'10px 10px 2px 10px',padding:'7px 10px',fontSize:10,color:'#1a4c1a',lineHeight:1.4,maxWidth:'80%',alignSelf:'flex-end'}}>{tx.m_sent2 || 'Perfect, thanks!'} 🙏</div>
                  {/* Typing */}
                  <div style={{background:'#fff',borderRadius:10,padding:'6px 10px',display:'flex',gap:4,alignItems:'center',width:'fit-content',border:'0.5px solid #eee'}}>
                    {[0,.3,.6].map((d,i)=>(
                      <div key={i} style={{width:5,height:5,borderRadius:'50%',background:'#adb5bd',animation:`typing 1.2s ${d}s infinite`}}/>
                    ))}
                  </div>
                </div>
                {/* Input bar */}
                <div style={{background:'#f0f2f5',padding:'6px 8px',display:'flex',gap:6,alignItems:'center',flexShrink:0}}>
                  <div style={{flex:1,background:'#fff',borderRadius:20,height:28,display:'flex',alignItems:'center',padding:'0 10px',fontSize:9,color:'#adb5bd'}}>{tx.wa_message || 'Message'}</div>
                  <div style={{width:28,height:28,background:'#25D366',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0014 0M12 19v3M8 22h8"/></svg>
                  </div>
                </div>
              </div>
            </div>
            {/* Side buttons */}
            <div style={{position:'absolute',left:-4,top:80,width:4,height:32,background:'#3a3a3c',borderRadius:2}}/>
            <div style={{position:'absolute',left:-4,top:122,width:4,height:52,background:'#3a3a3c',borderRadius:2}}/>
            <div style={{position:'absolute',left:-4,top:182,width:4,height:52,background:'#3a3a3c',borderRadius:2}}/>
            <div style={{position:'absolute',right:-4,top:110,width:4,height:72,background:'#3a3a3c',borderRadius:2}}/>
            {/* Floating badges */}
            <div style={{position:'absolute',top:-12,right:-48,background:'#fff',border:'1px solid #f0f0f0',borderRadius:20,padding:'5px 10px',display:'flex',alignItems:'center',gap:5,boxShadow:'0 2px 8px rgba(0,0,0,.08)',whiteSpace:'nowrap'}}>
              <span style={{width:7,height:7,borderRadius:'50%',background:'#25D366',display:'inline-block'}}/>
              <span style={{fontSize:10,fontWeight:600,color:'#0f172a'}}>{tx.badge_rate || '98% read rate'}</span>
            </div>
            <div style={{position:'absolute',bottom:72,left:-60,background:'#25D366',borderRadius:20,padding:'5px 10px',display:'flex',alignItems:'center',gap:5,boxShadow:'0 2px 8px rgba(37,211,102,.3)',whiteSpace:'nowrap'}}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span style={{fontSize:10,fontWeight:600,color:'#fff'}}>{tx.badge_del || 'Delivered in 1s'}</span>
            </div>
          </div>
        </div>

      </div>

      <style>{`
        .hero-mobile-phone{display:none}
        @media(max-width:768px){
          .hero-grid{
            grid-template-columns:1fr!important;
            gap:0!important;
          }
          .hero-desktop-cards{display:none!important}
          .hero-mobile-phone{display:flex!important;justify-content:center;padding:32px 0 48px}
          .hero-left-col{
            padding:40px 0 24px!important;
            align-items:center!important;
            text-align:center!important;
          }
          .hero-h1{text-align:center!important}
          .hero-sub{text-align:center!important;max-width:100%!important}
          .hero-note{text-align:center!important}
          .hero-btns{justify-content:center!important}
          .hero-badge{align-self:center!important}
        }
        @keyframes typing{0%,80%,100%{opacity:.25}40%{opacity:1}}
      `}</style>
    </div>
  )
}
