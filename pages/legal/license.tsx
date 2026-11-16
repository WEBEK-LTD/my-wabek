// @ts-nocheck
import Head from 'next/head'
import { useState, useEffect } from 'react'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import PublicNav from '@/components/PublicNav'
import PublicFooter from '@/components/PublicFooter'

export default function LicensePage() {
  const { brandName } = useWhiteLabel()
  const name = brandName || 'WABEK'
  const [lang, setLang] = useState<string>(() => typeof window !== 'undefined' ? localStorage.getItem('lang') || 'en' : 'en')
  useEffect(() => {
    const h = (e:any) => { setLang(e.detail); localStorage.setItem('lang', e.detail) }
    window.addEventListener('langchange', h)
    return () => window.removeEventListener('langchange', h)
  }, [])
  const dir = lang==='ar'?'rtl':'ltr'
  const isAr = lang==='ar', isFr = lang==='fr', isTr = lang==='tr'
  const T = (en:string,ar:string,fr:string,tr:string) => isAr?ar:isFr?fr:isTr?tr:en

  return (<>
    <Head>
      <link rel="icon" href="/brand/favicon-32.png" /><title>{T('Software License','رخصة البرنامج','Licence du logiciel','Yazılım Lisansı')} | {name}</title></Head>
    <div className="lpage">
      <PublicNav active="/legal/license" onLangChange={setLang} />
      <style>{`
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111b21;background:#fff}
        .lw{max-width:820px;margin:0 auto;padding:40px 24px 80px;direction:${dir}}
        .hero{background:linear-gradient(135deg,#faf5ff 0%,#fff 60%);border:1px solid #e9d5ff;border-radius:16px;padding:36px 32px 28px;margin-bottom:32px;position:relative;overflow:hidden}
        .hero::before{content:'';position:absolute;top:-40px;right:-40px;width:200px;height:200px;background:radial-gradient(circle,#a855f712 0%,transparent 70%);pointer-events:none}
        .hero-ey{font-size:11px;font-weight:700;color:#7c3aed;letter-spacing:.8px;text-transform:uppercase;margin-bottom:10px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
        .hero-ey span{background:#faf5ff;border:1px solid #e9d5ff;border-radius:100px;padding:2px 10px}
        .hero h1{font-size:clamp(22px,4vw,34px);font-weight:800;color:#111b21;line-height:1.15;margin-bottom:10px}
        .hero-desc{font-size:14px;color:#54656f;line-height:1.75;max-width:560px;margin-bottom:20px}
        .hero-meta{display:flex;gap:8px;flex-wrap:wrap}
        .hbadge{background:#f9fafb;border:1px solid #e9edef;border-radius:100px;padding:3px 12px;font-size:12px;color:#54656f}
        .hbadge.purple{background:#faf5ff;border-color:#e9d5ff;color:#6d28d9}
        .hbadge.green{background:#f0fdf4;border-color:#bbf7d0;color:#166534}
        .lnav{display:flex;gap:6px;flex-wrap:wrap;margin-top:18px}
        .lnav a{font-size:12px;font-weight:600;padding:5px 14px;border:1px solid #e9edef;border-radius:100px;color:#54656f;text-decoration:none;background:#fff}
        .lnav a.on{border-color:#7c3aed;color:#7c3aed;background:#faf5ff}
        .owner-box{background:linear-gradient(135deg,#faf5ff 0%,#f5f0ff 100%);border:1px solid #e9d5ff;border-radius:16px;padding:32px;text-align:center;margin:24px 0}
        .owner-icon{width:56px;height:56px;border-radius:14px;background:linear-gradient(135deg,#7c3aed,#6d28d9);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;box-shadow:0 8px 24px #7c3aed20}
        .sec{margin-bottom:36px}
        .st{font-size:16px;font-weight:700;color:#111b21;margin-bottom:14px;padding-bottom:10px;border-bottom:1.5px solid #f0f2f5;display:flex;align-items:center;gap:10px}
        .st::before{content:'';display:inline-block;width:3px;height:16px;background:#7c3aed;border-radius:2px;flex-shrink:0}
        .sec p{font-size:14px;color:#54656f;line-height:1.85;margin-bottom:12px}
        .sec ul{padding-${isAr?'right':'left'}:20px;margin-bottom:14px}
        .sec li{font-size:14px;color:#54656f;line-height:1.85;margin-bottom:5px}
        .sec strong{color:#111b21;font-weight:600}
        .icard{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:14px 16px;margin:14px 0;display:flex;gap:12px;align-items:flex-start}
        .icard-i{width:30px;height:30px;background:#25D366;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .icard p{margin:0;font-size:13px;color:#374151;line-height:1.7}
        .wcard{background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:14px 16px;margin:14px 0;display:flex;gap:12px;align-items:flex-start}
        .wcard-i{width:30px;height:30px;background:#ef4444;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .wcard p{margin:0;font-size:13px;color:#374151;line-height:1.7}
        .pcard{background:#faf5ff;border:1px solid #e9d5ff;border-radius:12px;padding:14px 16px;margin:14px 0;display:flex;gap:12px;align-items:flex-start}
        .pcard-i{width:30px;height:30px;background:#7c3aed;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .pcard p{margin:0;font-size:13px;color:#374151;line-height:1.7}
        .lfooter{background:linear-gradient(135deg,#faf5ff,#f9fafb);border:1px solid #e9d5ff;border-radius:12px;padding:20px;text-align:center;margin-top:40px}
        @media(max-width:600px){.lw{padding:28px 16px 60px}}
      `}</style>
      <div className="lw">
        <div className="hero">
          <div className="hero-ey">
            <span>{T('Proprietary Software','برنامج مملوك','Logiciel propriétaire','Tescilli Yazılım')}</span>
            <span>webek.org</span>
          </div>
          <h1>{T('Software License','رخصة البرنامج','Licence du logiciel','Yazılım Lisansı')}</h1>
          <p className="hero-desc">{T('WABEK is proprietary software owned by webek.org. Read this license carefully before using the software.','WABEK برنامج مملوك لـ webek.org. اقرأ هذه الرخصة بعناية قبل استخدام البرنامج.','WABEK est un logiciel propriétaire appartenant à webek.org. Lisez attentivement cette licence avant d\'utiliser le logiciel.','WABEK, webek.org\'a ait tescilli bir yazılımdır. Yazılımı kullanmadan önce bu lisansı dikkatlice okuyun.')}</p>
          <div className="hero-meta">
            <span className="hbadge">{T('Last updated: January 1, 2025','آخر تحديث: ١ يناير ٢٠٢٥','Mise à jour : 1 janv. 2025','Son güncelleme: 1 Ocak 2025')}</span>
            <span className="hbadge purple">Proprietary</span>
            <span className="hbadge green">webek.org</span>
          </div>
          <div className="lnav">
            <a href="/legal/privacy">Privacy</a>
            <a href="/legal/terms">Terms</a>
            <a href="/legal/refund">Refund</a>
            <a href="/legal/license" className="on">License</a>
          </div>
        </div>

        {/* Owner box */}
        <div className="owner-box">
          <div className="owner-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          </div>
          <p style={{fontSize:14,color:'#6d28d9',fontWeight:700,marginBottom:6}}>
            {T('WABEK is entirely owned by','WABEK مملوكة بالكامل لـ','WABEK est entièrement détenu par','WABEK tamamen şuna aittir')}
          </p>
          <p style={{fontSize:32,fontWeight:900,color:'#4c1d95',marginBottom:8,lineHeight:1}}>webek.org</p>
          <p style={{fontSize:13,color:'#7c3aed'}}>
            {T('All intellectual, commercial, and legal rights reserved','جميع الحقوق الفكرية والتجارية والقانونية محفوظة','Tous les droits intellectuels, commerciaux et juridiques réservés','Tüm fikri, ticari ve yasal haklar saklıdır')}
          </p>
        </div>

        <div className="sec">
          <div className="st">{T('1. Grant of License','١. منح الرخصة','1. Octroi de licence','1. Lisans Verilmesi')}</div>
          <p>{T('Subject to your active subscription, webek.org grants you a license that is:','وفقاً لاشتراكك النشط، تمنحك webek.org رخصة:','Sous réserve de votre abonnement actif, webek.org vous accorde une licence qui est :','Aktif aboneliğinize tabi olarak webek.org size şu lisansı verir:')}</p>
          <ul>
            {(isAr?['محدودة: تقتصر على ما هو مسموح به صراحةً','غير حصرية: يمكن منح رخص مماثلة لآخرين','غير قابلة للتحويل: لا يمكنك نقلها','قابلة للإلغاء: تنتهي عند انتهاك الشروط','شخصية: للاستخدام الداخلي لعملك فقط']
              :isFr?['Limitée : restreinte à ce qui est expressément autorisé','Non exclusive : des licences similaires peuvent être accordées à d\'autres','Non transférable : vous ne pouvez pas la transférer','Révocable : annulée en cas de violation','Personnelle : pour votre usage interne uniquement']
              :isTr?['Sınırlı: Açıkça izin verilenlerle kısıtlı','Münhasır olmayan: Benzer lisanslar başkalarına da verilebilir','Devredilemez: Üçüncü tarafa devredemezsiniz','İptal edilebilir: Şart ihlalinde iptal edilir','Kişisel: Yalnızca dahili iş kullanımı için']
              :['Limited: restricted to what is expressly permitted','Non-exclusive: similar licenses may be granted to others','Non-transferable: you cannot transfer it to a third party','Revocable: terminated upon violation of the Terms','Personal: for your internal business use only']
            ).map((item,i)=><li key={i}>{item}</li>)}
          </ul>
        </div>

        <div className="sec">
          <div className="st">{T('2. Restrictions','٢. القيود الصريحة','2. Restrictions explicites','2. Kısıtlamalar')}</div>
          <p>{T('The following are expressly prohibited without prior written permission from webek.org:','يُحظر صراحةً ما يلي دون إذن خطي مسبق من webek.org:','Les actions suivantes sont expressément interdites sans autorisation écrite préalable de webek.org :','Aşağıdakiler webek.org\'dan önceden yazılı izin olmaksızın açıkça yasaktır:')}</p>
          <ul>
            {(isAr?['نسخ البرنامج أو توزيعه أو نقله','الهندسة العكسية أو محاولة استخراج الكود المصدري','إنشاء منتجات أو خدمات مشتقة','بيع أو إعادة بيع البرنامج','إزالة أو تعديل أي علامات ملكية أو حقوق نشر','استخدام البرنامج لبناء منتج منافس مباشر','الوصول المباشر لقواعد البيانات متجاوزاً API الرسمي']
              :isFr?['Copier, distribuer ou transmettre le logiciel','Procéder à une ingénierie inverse ou tenter d\'extraire le code source','Créer des produits ou services dérivés','Vendre ou revendre le logiciel','Supprimer ou modifier les mentions de propriété','Utiliser le logiciel pour créer un produit concurrent','Accéder directement aux bases de données en contournant l\'API officielle']
              :isTr?['Yazılımı kopyalamak, dağıtmak veya iletmek','Tersine mühendislik uygulamak veya kaynak kodu çıkarmak','Türev ürünler veya hizmetler oluşturmak','Yazılımı satmak veya yeniden satmak','Mülkiyet bildirimlerini kaldırmak veya değiştirmek','Rakip ürün oluşturmak için yazılımı kullanmak','Resmi API\'yi atlatarak veritabanlarına doğrudan erişmek']
              :['Copying, distributing, or transmitting the software','Reverse engineering or attempting to extract the source code','Creating derivative products or services','Selling or reselling the software','Removing or modifying any proprietary notices','Using the software to build a direct competing product','Directly accessing databases bypassing the official API']
            ).map((item,i)=><li key={i}>{item}</li>)}
          </ul>
          <div className="wcard">
            <div className="wcard-i"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
            <p>{T('Violating these restrictions exposes you to legal liability and may result in legal action by webek.org.','انتهاك هذه القيود يعرضك للمساءلة القانونية وقد يؤدي إلى إجراءات قانونية من webek.org.','La violation de ces restrictions vous expose à des poursuites judiciaires par webek.org.','Bu kısıtlamaların ihlali webek.org tarafından yasal işlem başlatılmasına yol açabilir.')}</p>
          </div>
        </div>

        <div className="sec">
          <div className="st">{T('3. Intellectual Property','٣. الملكية الفكرية','3. Propriété intellectuelle','3. Fikri Mülkiyet')}</div>
          <p>{T('All intellectual property rights in WABEK are entirely owned by webek.org, including:','جميع حقوق الملكية الفكرية في WABEK مملوكة بالكامل لـ webek.org، وتشمل:','Tous les droits de propriété intellectuelle sur WABEK appartiennent entièrement à webek.org, notamment :','WABEK\'deki tüm fikri mülkiyet hakları webek.org\'a tamamen aittir:')}</p>
          <ul>
            {(isAr?['الكود المصدري وقواعد البيانات والخوارزميات','التصميم والواجهة والتجربة البصرية','الوثائق والأدلة والمحتوى التعليمي','العلامات التجارية والشعارات وأسماء المنتجات','الأسرار التجارية والمعرفة الخاصة']
              :isFr?['Code source, bases de données et algorithmes','Design, interface et expérience visuelle','Documentation, guides et contenu éducatif','Marques déposées, logos et noms de produits','Secrets commerciaux et savoir-faire propriétaire']
              :isTr?['Kaynak kodu, veritabanları ve algoritmalar','Tasarım, arayüz ve görsel deneyim','Belgeler, kılavuzlar ve eğitim içeriği','Ticari markalar, logolar ve ürün adları','Ticari sırlar ve tescilli bilgi birikimi']
              :['Source code, databases, and algorithms','Design, interface, and visual experience','Documentation, guides, and educational content','Trademarks, logos, and product names','Trade secrets and proprietary know-how']
            ).map((item,i)=><li key={i}>{item}</li>)}
          </ul>
        </div>

        <div className="sec">
          <div className="st">{T('4. User Data','٤. بيانات المستخدم','4. Données utilisateur','4. Kullanıcı Verileri')}</div>
          <p>{T('The data you create and import into WABEK belongs to you. You grant us a limited license to process this data solely to provide the service. You can export your data at any time. Upon account termination, your data is deleted within 30 days.','البيانات التي تنشئها وتستوردها في WABEK تخصك أنت. تمنحنا رخصة محدودة لمعالجة هذه البيانات لغرض تقديم الخدمة فقط. يمكنك تصدير بياناتك في أي وقت. عند إنهاء الحساب، تُحذف بياناتك خلال 30 يوماً.','Les données que vous créez dans WABEK vous appartiennent. Vous nous accordez une licence limitée pour les traiter dans le seul but de fournir le service. Exportez vos données à tout moment. Elles sont supprimées dans les 30 jours suivant la résiliation.','WABEK\'e aktardığınız veriler size aittir. Yalnızca hizmet sunmak için bu verileri işlememiz için sınırlı lisans verirsiniz. Verilerinizi istediğiniz zaman dışa aktarabilirsiniz. Hesap feshinde 30 gün içinde silinir.')}</p>
        </div>

        <div className="sec">
          <div className="st">{T('5. Reseller Program','٥. برنامج الموزعين','5. Programme revendeurs','5. Bayi Programı')}</div>
          <p>{T('Organizations wishing to resell WABEK or offer it under their own brand (White Label) can apply for an official reseller license. Contact:','المؤسسات الراغبة في إعادة بيع WABEK أو تقديمه تحت علامتها (White Label) يمكنها التقدم لرخصة موزع. تواصل مع:','Les organisations souhaitant revendre WABEK sous leur marque peuvent demander une licence revendeur. Contactez :','WABEK\'i kendi markası altında yeniden satmak isteyen kuruluşlar bayi lisansı başvurusunda bulunabilir. İletişim:')} <strong>resellers@waabek.com</strong></p>
          <div className="pcard">
            <div className="pcard-i"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg></div>
            <p>{T('Resellers get: custom domain and logo, independent pricing, unified dashboard, direct support from webek.org, and early access to new features.','يحصل الموزعون على: نطاق وشعار مخصص، تسعير مستقل، لوحة تحكم موحدة، دعم مباشر من webek.org، ووصول مبكر للميزات.','Les revendeurs bénéficient : domaine et logo personnalisés, tarification indépendante, tableau de bord unifié, support direct webek.org, et accès anticipé aux nouvelles fonctionnalités.','Bayiler şunlara sahip olur: özel domain ve logo, bağımsız fiyatlandırma, birleşik panel, webek.org\'dan doğrudan destek ve yeni özelliklere erken erişim.')}</p>
          </div>
        </div>

        <div className="sec">
          <div className="st">{T('6. License Termination','٦. إنهاء الرخصة','6. Résiliation de la licence','6. Lisans Feshi')}</div>
          <p>{T('This license terminates automatically and immediately if:','تنتهي هذه الرخصة تلقائياً وفوراً إذا:','Cette licence se termine automatiquement et immédiatement si :','Bu lisans otomatik olarak ve derhal sona erer:')}</p>
          <ul>
            {(isAr?['انتهاء أو إلغاء اشتراكك دون تجديد','انتهاك أي من القيود المذكورة','إنهاء حسابك بسبب انتهاك شروط الخدمة','انتقال ملكية شركتك لطرف ثالث']
              :isFr?['Votre abonnement expire ou est annulé sans renouvellement','Violation de l\'une des restrictions','Résiliation de votre compte pour violation des conditions','Transfert de propriété de votre entreprise à un tiers']
              :isTr?['Aboneliğiniz yenilenmeden sona erer veya iptal edilir','Kısıtlamalardan herhangi birinin ihlali','Şart ihlali nedeniyle hesabınızın feshi','Şirket mülkiyetinin üçüncü tarafa devri']
              :['Your subscription expires or is cancelled without renewal','Violation of any of the restrictions mentioned','Termination of your account for violating Terms of Service','Transfer of your company ownership to a third party']
            ).map((item,i)=><li key={i}>{item}</li>)}
          </ul>
        </div>

        <div className="lfooter">
          <p style={{fontSize:14,fontWeight:700,color:'#4c1d95',marginBottom:6}}>WABEK — webek.org</p>
          <p style={{fontSize:12,color:'#7c3aed',marginBottom:4}}>
            {T('Proprietary software. All rights reserved.','برنامج مملوك. جميع الحقوق محفوظة.','Logiciel propriétaire. Tous droits réservés.','Tescilli yazılım. Tüm haklar saklıdır.')}
          </p>
          <p style={{fontSize:12,color:'#8696a0'}}>
            {T('Unauthorized use is prohibited and subject to legal prosecution.','الاستخدام غير المصرح به محظور ويخضع للملاحقة القانونية.','Toute utilisation non autorisée est interdite et passible de poursuites judiciaires.','Yetkisiz kullanım yasaktır ve yasal kovuşturmaya konu olabilir.')}
          </p>
        </div>
      </div>
      <PublicFooter lang={lang} onLangChange={setLang} />
    </div>
  </>)
}
