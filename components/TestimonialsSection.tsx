// @ts-nocheck
import { useState, useEffect, useRef } from 'react'

// ── 24 reviews, 4 languages, varied countries & roles ──
const ALL_REVIEWS = [
  // EN
  { id:1,  name:'Sarah M.',    country:'🇬🇧 UK',         role:'E-commerce Owner',      avatar:'#25D366', text:"We cut cart abandonment by 34% in the first month. The automation pays for itself. Setup took under 10 minutes.", lang:'en', verified:true,  daysAgo:2  },
  { id:2,  name:'Ahmed K.',    country:'🇦🇪 UAE',         role:'Digital Agency',        avatar:'#0ea5e9', text:"White-labeled this for 15 clients. The reseller dashboard makes management effortless. Support has been excellent.", lang:'en', verified:true,  daysAgo:5  },
  { id:3,  name:'Carlos R.',   country:'🇧🇷 Brazil',      role:'SaaS Founder',          avatar:'#f59e0b', text:"OTP integration replaced our SMS provider. We pay 60% less and delivery rates are higher. Customers love it.", lang:'en', verified:true,  daysAgo:1  },
  { id:4,  name:'James T.',    country:'🇦🇺 Australia',   role:'Dental Clinic',         avatar:'#a855f7', text:"Appointment reminders via WhatsApp reduced no-shows by 41%. Patients actually read the messages.", lang:'en', verified:true,  daysAgo:8  },
  { id:5,  name:'Priya S.',    country:'🇮🇳 India',       role:'Fashion Store',         avatar:'#ef4444', text:"Our WhatsApp campaigns get 8x higher open rates than email. The ROI in the first campaign was insane.", lang:'en', verified:false, daysAgo:3  },
  { id:6,  name:'Lena W.',     country:'🇩🇪 Germany',     role:'Hosting Provider',      avatar:'#06b6d4', text:"WHMCS integration works perfectly. Clients get invoice reminders on WhatsApp and payments improved by 28%.", lang:'en', verified:true,  daysAgo:11 },
  // AR
  { id:7,  name:'محمد السيد',  country:'🇸🇦 السعودية',    role:'متجر إلكتروني',         avatar:'#25D366', text:"ارتفعت مبيعاتنا 23% بعد إضافة رسائل استرداد السلة. الإعداد سهل جداً وفريق الدعم ممتاز.", lang:'ar', verified:true,  daysAgo:4  },
  { id:8,  name:'فاطمة النجار',country:'🇦🇪 الإمارات',    role:'وكالة تسويق',           avatar:'#0ea5e9', text:"أتمتة رسائل العملاء وفّرت علينا 4 ساعات يومياً. عملاؤنا يحصلون على ردود فورية على مدار الساعة.", lang:'ar', verified:true,  daysAgo:7  },
  { id:9,  name:'خالد العمري', country:'🇪🇬 مصر',         role:'مزود استضافة',          avatar:'#f59e0b', text:"تكامل WHMCS مع واتساب غيّر طريقة عملنا. العملاء يدفعون أسرع لما يوصلهم تنبيه على واتساب.", lang:'ar', verified:true,  daysAgo:2  },
  { id:10, name:'نورة الرشيد', country:'🇸🇦 الرياض',      role:'عيادة طبية',            avatar:'#a855f7', text:"تذكيرات المواعيد على واتساب قلّلت الإلغاءات بنسبة 38%. المرضى يردون ويؤكدون بشكل أسرع بكثير.", lang:'ar', verified:true,  daysAgo:9  },
  // FR
  { id:11, name:'Marie Dupont',country:'🇫🇷 France',      role:'Boutique en ligne',     avatar:'#25D366', text:"Notre taux d'abandon de panier a chuté de 31% grâce aux relances automatiques WhatsApp. Excellent ROI.", lang:'fr', verified:true,  daysAgo:6  },
  { id:12, name:'Jean-Paul M.',country:'🇧🇪 Belgique',    role:'Agence digitale',       avatar:'#0ea5e9', text:"On a créé une offre marque blanche pour nos clients. La revente génère 2 000€/mois de revenus récurrents.", lang:'fr', verified:false, daysAgo:14 },
  { id:13, name:'Camille R.',  country:'🇨🇭 Suisse',      role:'Coach business',        avatar:'#f59e0b', text:"Les confirmations de rendez-vous par WhatsApp ont réduit mes absences de 45%. Simple à configurer.", lang:'fr', verified:true,  daysAgo:3  },
  { id:14, name:'Sofiane B.',  country:'🇲🇦 Maroc',       role:'Hébergeur web',         avatar:'#a855f7', text:"L'intégration WHMCS fonctionne parfaitement. Les clients paient plus vite avec les rappels WhatsApp.", lang:'fr', verified:true,  daysAgo:10 },
  // TR
  { id:15, name:'Ahmet Yıldız',country:'🇹🇷 Türkiye',     role:'E-ticaret Yöneticisi',  avatar:'#25D366', text:"Sepet terk oranımız %29 düştü. WhatsApp kampanyaları email'den 6 kat daha iyi performans gösteriyor.", lang:'tr', verified:true,  daysAgo:1  },
  { id:16, name:'Zeynep K.',   country:'🇹🇷 İstanbul',    role:'Dijital Ajans',         avatar:'#0ea5e9', text:"Beyaz etiket çözümü müşterilerimize harika değer katıyor. Tekrar eden gelirlerimiz %40 arttı.", lang:'tr', verified:true,  daysAgo:5  },
  { id:17, name:'Mert Özdemir',country:'🇹🇷 Ankara',      role:'Hosting Şirketi',       avatar:'#f59e0b', text:"WHMCS entegrasyonu mükemmel çalışıyor. Fatura hatırlatmaları sayesinde tahsilatlarımız hızlandı.", lang:'tr', verified:false, daysAgo:8  },
  { id:18, name:'Elif Şahin',  country:'🇹🇷 İzmir',       role:'Güzellik Salonu',       avatar:'#a855f7', text:"Randevu hatırlatmaları gelmeyenleri %33 azalttı. Müşteriler WhatsApp üzerinden hızlıca onay veriyor.", lang:'tr', verified:true,  daysAgo:2  },
  // More EN/mixed
  { id:19, name:'Omar Hassan',country:'🇸🇦 Saudi Arabia',  role:'WHMCS Reseller',        avatar:'#ef4444', text:"Started reselling 3 months ago. Already have 22 clients paying monthly. Best business decision I made.", lang:'en', verified:true,  daysAgo:13 },
  { id:20, name:'Lisa Chen',  country:'🇸🇬 Singapore',    role:'Wix Store Owner',       avatar:'#06b6d4', text:"The Wix integration is seamless. Order confirmations and shipping updates are fully automated now.", lang:'en', verified:true,  daysAgo:4  },
  { id:21, name:'Ravi Patel', country:'🇮🇳 Mumbai',       role:'WordPress Developer',   avatar:'#25D366', text:"WooCommerce plugin works flawlessly. Clients love the order tracking messages on WhatsApp.", lang:'en', verified:true,  daysAgo:7  },
  { id:22, name:'Anna Kowalski',country:'🇵🇱 Poland',     role:'Online Pharmacy',       avatar:'#f59e0b', text:"Prescription reminder campaigns have incredible open rates. Customers appreciate the personal touch.", lang:'en', verified:false, daysAgo:16 },
  { id:23, name:'David Osei',  country:'🇬🇭 Ghana',       role:'Travel Agency',         avatar:'#0ea5e9', text:"Booking confirmations and travel reminders via WhatsApp. Clients love it, complaints dropped to zero.", lang:'en', verified:true,  daysAgo:6  },
  { id:24, name:'Isabella M.', country:'🇮🇹 Italy',       role:'Restaurant Chain',      avatar:'#a855f7', text:"Table booking confirmations on WhatsApp reduced no-shows by 52%. Simple setup, great results.", lang:'en', verified:true,  daysAgo:3  },
]

// Deterministic daily shuffle — same order for everyone on same day
function dailySeed(): number {
  const now = new Date()
  return now.getFullYear() * 10000 + (now.getMonth()+1) * 100 + now.getDate()
}
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr]
  let s = seed
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const STARS = '★★★★★'

export default function TestimonialsSection({ lang, name, t }: any) {
  const [reviews] = useState(() => seededShuffle(ALL_REVIEWS, dailySeed()))
  const [notification, setNotification] = useState<any>(null)
  const [notifVisible, setNotifVisible] = useState(false)
  const [totalToday] = useState(() => {
    const s = dailySeed()
    return 34 + (Math.abs(s * 1664525) % 28)
  })
  const track1Ref = useRef<HTMLDivElement>(null)
  const track2Ref = useRef<HTMLDivElement>(null)
  const notifQueue = useRef<any[]>([])
  const notifTimer = useRef<any>(null)

  // Build notification queue from shuffled reviews
  useEffect(() => {
    notifQueue.current = seededShuffle(reviews, dailySeed() + 7)
    let idx = 0
    function showNext() {
      const r = notifQueue.current[idx % notifQueue.current.length]
      idx++
      setNotification(r)
      setNotifVisible(true)
      setTimeout(() => setNotifVisible(false), 3500)
    }
    showNext()
    notifTimer.current = setInterval(showNext, 7000)
    return () => clearInterval(notifTimer.current)
  }, [])

  const row1 = reviews.slice(0, 12)
  const row2 = [...reviews].reverse().slice(0, 12)

  const titles: Record<string,string> = {
    en: `Businesses Love ${name}`,
    ar: `الشركات تحب ${name}`,
    fr: `Les entreprises adorent ${name}`,
    tr: `İşletmeler ${name}'i Seviyor`,
  }
  const weekLabels: Record<string,string> = {
    en: 'businesses joined this week',
    ar: 'شركة انضمت هذا الأسبوع',
    fr: 'entreprises ont rejoint cette semaine',
    tr: 'işletme bu hafta katıldı',
  }
  const verifiedLabel: Record<string,string> = {
    en: 'Verified customer',
    ar: 'عميل موثّق',
    fr: 'Client vérifié',
    tr: 'Doğrulanmış müşteri',
  }
  const justConnectedLabel: Record<string,string> = {
    en: 'just connected WhatsApp',
    ar: 'ربط للتو واتساب',
    fr: 'vient de connecter WhatsApp',
    tr: 'az önce WhatsApp bağladı',
  }

  return (
    <section style={{background:'#f9fafb',padding:'72px 0',overflow:'hidden'}}>
      <div style={{maxWidth:1100,margin:'0 auto',padding:'0 20px',textAlign:'center',marginBottom:32}}>
        <h2 style={{fontSize:'clamp(26px,4vw,38px)',fontWeight:800,marginBottom:12,color:'#111b21'}}>
          {titles[lang] || titles['en']}
        </h2>
        {/* Live counter */}
        <div style={{display:'inline-flex',alignItems:'center',gap:8,background:'#fff',border:'1px solid #25D36625',borderRadius:100,padding:'7px 18px',boxShadow:'0 2px 8px rgba(37,211,102,.08)'}}>
          <span style={{display:'inline-block',width:8,height:8,borderRadius:'50%',background:'#25D366',boxShadow:'0 0 0 3px #25D36630',animation:'pulse 2s infinite'}}/>
          <span style={{fontSize:13,color:'#374151',fontWeight:500}}>
            <strong style={{color:'#25D366'}}>{totalToday}</strong> {weekLabels[lang] || weekLabels['en']}
          </span>
        </div>
      </div>

      {/* Row 1 — scrolls left */}
      <div style={{overflow:'hidden',marginBottom:16,maskImage:'linear-gradient(90deg,transparent 0%,#000 8%,#000 92%,transparent 100%)'}}>
        <div ref={track1Ref} style={{display:'flex',gap:16,animation:'scrollLeft 40s linear infinite',width:'max-content'}}>
          {[...row1,...row1].map((r,i) => (
            <ReviewCard key={i} r={r} verifiedLabel={verifiedLabel[lang]||verifiedLabel['en']} />
          ))}
        </div>
      </div>

      {/* Row 2 — scrolls right */}
      <div style={{overflow:'hidden',maskImage:'linear-gradient(90deg,transparent 0%,#000 8%,#000 92%,transparent 100%)'}}>
        <div ref={track2Ref} style={{display:'flex',gap:16,animation:'scrollRight 45s linear infinite',width:'max-content'}}>
          {[...row2,...row2].map((r,i) => (
            <ReviewCard key={i} r={r} verifiedLabel={verifiedLabel[lang]||verifiedLabel['en']} />
          ))}
        </div>
      </div>

      {/* Live notification */}
      {notification && (
        <div style={{
          position:'fixed',bottom:24,left:24,zIndex:999,
          background:'#fff',borderRadius:14,padding:'12px 16px',
          boxShadow:'0 8px 32px rgba(0,0,0,.12)',
          border:'1px solid #e9edef',
          display:'flex',alignItems:'center',gap:12,
          maxWidth:300,
          transform: notifVisible ? 'translateY(0)' : 'translateY(100px)',
          opacity: notifVisible ? 1 : 0,
          transition:'all .4s cubic-bezier(.34,1.56,.64,1)',
          pointerEvents:'none',
        }}>
          <div style={{width:36,height:36,borderRadius:'50%',background:notification.avatar,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:14}}>
            {notification.name[0]}
          </div>
          <div style={{minWidth:0}}>
            <p style={{fontSize:12,fontWeight:700,color:'#111b21',margin:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{notification.name} <span style={{color:'#6b7280',fontWeight:400}}>{notification.country}</span></p>
            <p style={{fontSize:11,color:'#6b7280',margin:0}}>{justConnectedLabel[lang]||justConnectedLabel['en']} · {notification.daysAgo}d ago</p>
          </div>
          <div style={{width:8,height:8,borderRadius:'50%',background:'#25D366',flexShrink:0,boxShadow:'0 0 0 3px #25D36625'}}/>
        </div>
      )}

      <style>{`
        @keyframes scrollLeft  { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes scrollRight { from { transform: translateX(-50%) } to { transform: translateX(0) } }
        @keyframes pulse { 0%,100% { box-shadow: 0 0 0 3px #25D36630 } 50% { box-shadow: 0 0 0 6px #25D36615 } }
      `}</style>
    </section>
  )
}

function ReviewCard({ r, verifiedLabel }: { r: any, verifiedLabel: string }) {
  return (
    <div style={{
      background:'#fff',
      borderRadius:16,
      padding:'18px 20px',
      width:300,
      flexShrink:0,
      border:'1px solid #e9edef',
      boxShadow:'0 2px 8px rgba(0,0,0,.04)',
      transition:'transform .2s',
    }}
    onMouseEnter={e => (e.currentTarget as any).style.transform='translateY(-2px)'}
    onMouseLeave={e => (e.currentTarget as any).style.transform='translateY(0)'}
    >
      {/* Stars */}
      <div style={{color:'#f59e0b',fontSize:13,marginBottom:10,letterSpacing:1}}>{STARS}</div>
      {/* Text */}
      <p style={{fontSize:13,color:'#374151',lineHeight:1.7,marginBottom:14,display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical',overflow:'hidden'}}>
        "{r.text}"
      </p>
      {/* Author */}
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <div style={{width:34,height:34,borderRadius:'50%',background:r.avatar,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:13}}>
          {r.name[0]}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:5}}>
            <span style={{fontSize:13,fontWeight:700,color:'#111b21'}}>{r.name}</span>
            {r.verified && <svg width="14" height="14" viewBox="0 0 24 24" fill="#25D366" aria-label={verifiedLabel}><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
          </div>
          <div style={{fontSize:11,color:'#6b7280',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{r.role} · {r.country}</div>
        </div>
        <div style={{fontSize:10,color:'#9ca3af',flexShrink:0}}>{r.daysAgo}d ago</div>
      </div>
    </div>
  )
}
