// @ts-nocheck
import Head from 'next/head'
import { useState, useEffect } from 'react'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import PublicNav from '@/components/PublicNav'
import PublicFooter from '@/components/PublicFooter'

export default function TermsPage() {
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
      <link rel="icon" href="https://res.cloudinary.com/dkl7ntpgw/image/upload/f_auto,q_auto/%D8%AA%D8%B5%D9%85%D9%8A%D9%85_%D8%A8%D8%AF%D9%88%D9%86_%D8%B9%D9%86%D9%88%D8%A7%D9%86_1_kejdrs" /><title>{T('Terms of Service','شروط الخدمة','Conditions d\'utilisation','Hizmet Şartları')} | {name}</title></Head>
    <div className="lpage">
      <PublicNav active="/legal/terms" onLangChange={setLang} />
      <style>{`
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111b21;background:#fff}
        .lw{max-width:820px;margin:0 auto;padding:40px 24px 80px;direction:${dir}}
        .hero{background:linear-gradient(135deg,#f0fdf4 0%,#fff 60%);border:1px solid #e9edef;border-radius:16px;padding:36px 32px 28px;margin-bottom:32px;position:relative;overflow:hidden}
        .hero::before{content:'';position:absolute;top:-40px;right:-40px;width:200px;height:200px;background:radial-gradient(circle,#25D36612 0%,transparent 70%);pointer-events:none}
        .hero-ey{font-size:11px;font-weight:700;color:#25D366;letter-spacing:.8px;text-transform:uppercase;margin-bottom:10px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
        .hero-ey span{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:100px;padding:2px 10px}
        .hero h1{font-size:clamp(22px,4vw,34px);font-weight:800;color:#111b21;line-height:1.15;margin-bottom:10px}
        .hero-desc{font-size:14px;color:#54656f;line-height:1.75;max-width:560px;margin-bottom:20px}
        .hero-meta{display:flex;gap:8px;flex-wrap:wrap}
        .hbadge{background:#f9fafb;border:1px solid #e9edef;border-radius:100px;padding:3px 12px;font-size:12px;color:#54656f}
        .hbadge.green{background:#f0fdf4;border-color:#bbf7d0;color:#166534}
        .lnav{display:flex;gap:6px;flex-wrap:wrap;margin-top:18px}
        .lnav a{font-size:12px;font-weight:600;padding:5px 14px;border:1px solid #e9edef;border-radius:100px;color:#54656f;text-decoration:none;background:#fff}
        .lnav a.on{border-color:#25D366;color:#25D366;background:#f0fdf4}
        .toc{background:#f9fafb;border:1px solid #e9edef;border-radius:12px;padding:18px 22px;margin-bottom:32px}
        .toc-lbl{font-size:11px;font-weight:700;color:#8696a0;text-transform:uppercase;letter-spacing:.6px;margin-bottom:12px}
        .toc ol{padding-${isAr?'right':'left'}:18px;columns:2;column-gap:24px;margin:0}
        .toc li{font-size:13px;color:#374151;line-height:2}
        .sec{margin-bottom:36px}
        .st{font-size:16px;font-weight:700;color:#111b21;margin-bottom:14px;padding-bottom:10px;border-bottom:1.5px solid #f0f2f5;display:flex;align-items:center;gap:10px}
        .st::before{content:'';display:inline-block;width:3px;height:16px;background:#25D366;border-radius:2px;flex-shrink:0}
        .sec p{font-size:14px;color:#54656f;line-height:1.85;margin-bottom:12px}
        .sec ul{padding-${isAr?'right':'left'}:20px;margin-bottom:14px}
        .sec li{font-size:14px;color:#54656f;line-height:1.85;margin-bottom:5px}
        .sec strong{color:#111b21;font-weight:600}
        .sec a{color:#25D366;text-decoration:none}
        .icard{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:14px 16px;margin:14px 0;display:flex;gap:12px;align-items:flex-start}
        .icard-i{width:30px;height:30px;background:#25D366;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .icard p{margin:0;font-size:13px;color:#374151;line-height:1.7}
        .wcard{background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:14px 16px;margin:14px 0;display:flex;gap:12px;align-items:flex-start}
        .wcard-i{width:30px;height:30px;background:#ef4444;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .wcard p{margin:0;font-size:13px;color:#374151;line-height:1.7}
        .lfooter{background:#f9fafb;border:1px solid #e9edef;border-radius:12px;padding:20px;text-align:center;margin-top:40px}
        @media(max-width:600px){.lw{padding:28px 16px 60px}.toc ol{columns:1}}
      `}</style>
      <div className="lw">
        <div className="hero">
          <div className="hero-ey"><span>{T('Legal Document','وثيقة قانونية','Document légal','Yasal Belge')}</span><span>webek.org</span></div>
          <h1>{T('Terms of Service','شروط الخدمة','Conditions d\'utilisation','Hizmet Şartları')}</h1>
          <p className="hero-desc">{T('These terms govern your use of the WABEK platform. Please read them carefully before using the service.','تحكم هذه الشروط استخدامك لمنصة WABEK. يرجى قراءتها بعناية قبل استخدام الخدمة.','Ces conditions régissent votre utilisation de WABEK. Veuillez les lire attentivement avant d\'utiliser le service.','Bu şartlar WABEK platformunu kullanımınızı düzenler. Lütfen hizmeti kullanmadan önce dikkatlice okuyun.')}</p>
          <div className="hero-meta">
            <span className="hbadge">{T('Last updated: January 1, 2025','آخر تحديث: ١ يناير ٢٠٢٥','Mise à jour : 1 janv. 2025','Son güncelleme: 1 Ocak 2025')}</span>
            <span className="hbadge green">webek.org</span>
          </div>
          <div className="lnav">
            <a href="/legal/privacy">Privacy</a>
            <a href="/legal/terms" className="on">Terms</a>
            <a href="/legal/refund">Refund</a>
            <a href="/legal/license">License</a>
          </div>
        </div>

        <div className="icard">
          <div className="icard-i"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
          <p>{T('By using WABEK, you agree to these Terms. If you use the service on behalf of a company, you confirm that you are authorized to accept these Terms on its behalf.','باستخدامك لـ WABEK، فإنك توافق على هذه الشروط. إذا كنت تستخدم الخدمة نيابةً عن شركة، فإنك تؤكد أنك مفوض بقبول هذه الشروط باسمها.','En utilisant WABEK, vous acceptez ces conditions. Si vous utilisez le service au nom d\'une entreprise, vous confirmez être autorisé à accepter ces conditions.','WABEK\'i kullanarak bu Şartları kabul etmiş olursunuz. Şirketi adına kullanıyorsanız bu şartları kabul etmeye yetkili olduğunuzu onaylarsınız.')}</p>
        </div>

        <div className="toc">
          <div className="toc-lbl">{T('Table of contents','جدول المحتويات','Table des matières','İçindekiler')}</div>
          <ol>
            {(isAr?['قبول الشروط','وصف الخدمة','الاستخدام المقبول','مسؤولية الحساب','الامتثال لواتساب','توافر الخدمة','الاشتراكات والفواتير','حدود المسؤولية','الإنهاء','القانون الحاكم']
              :isFr?['Acceptation','Description du service','Utilisation acceptable','Responsabilité du compte','Conformité WhatsApp','Disponibilité','Abonnements','Limitation de responsabilité','Résiliation','Droit applicable']
              :isTr?['Kabul','Hizmet Tanımı','Kabul Edilebilir Kullanım','Hesap Sorumluluğu','WhatsApp Uyumluluğu','Kullanılabilirlik','Abonelikler','Sorumluluk Sınırlaması','Fesih','Yürürlükteki Hukuk']
              :['Acceptance of Terms','Service Description','Acceptable Use','Account Responsibility','WhatsApp Compliance','Service Availability','Subscriptions and Billing','Limitation of Liability','Termination','Governing Law']
            ).map((item,i)=><li key={i}>{item}</li>)}
          </ol>
        </div>

        <div className="sec">
          <div className="st">{T('1. Acceptance of Terms','١. قبول الشروط','1. Acceptation des conditions','1. Şartların Kabulü')}</div>
          <p>{T('By accessing or using WABEK, you acknowledge that you have read, understood, and agree to be bound by these Terms. These Terms are subject to periodic updates — we will notify you of significant changes 30 days before they take effect.','من خلال الوصول إلى WABEK أو استخدامه، فإنك تقر بأنك قرأت هذه الشروط وفهمتها وتوافق على الالتزام بها. تخضع هذه الشروط للتحديث الدوري — سنبلغك بالتغييرات الجوهرية قبل 30 يوماً.','En accédant à WABEK ou en l\'utilisant, vous reconnaissez avoir lu et accepté ces conditions. Elles peuvent être mises à jour — nous vous notifierons 30 jours avant.','WABEK\'e erişerek bu Şartları okuduğunuzu ve kabul ettiğinizi onaylarsınız. Önemli değişiklikler için 30 gün önceden bildirim yapılır.')}</p>
        </div>

        <div className="sec">
          <div className="st">{T('2. Service Description','٢. وصف الخدمة','2. Description du service','2. Hizmet Tanımı')}</div>
          <p>{T('WABEK is a comprehensive WhatsApp Business management SaaS platform owned and operated by webek.org. The platform enables:','WABEK هي منصة SaaS متكاملة لإدارة واتساب للأعمال مملوكة وتديرها webek.org. تتيح المنصة:','WABEK est une plateforme SaaS complète de gestion WhatsApp Business, détenue et exploitée par webek.org. La plateforme permet :','WABEK, webek.org tarafından sahiplenilen ve işletilen kapsamlı bir WhatsApp Business SaaS platformudur. Platform şunlara olanak tanır:')}</p>
          <ul>
            {(isAr?['إرسال حملات رسائل واتساب الجماعية المخصصة','بناء روبوتات دردشة بدون كتابة كود','إدارة صندوق وارد مشترك لفريق العمل','أتمتة رحلات العملاء والردود التلقائية','التحليلات والتقارير المفصلة','التكامل مع Wix وWordPress وWHMCS وغيرها']
              :isFr?['Envoi de campagnes WhatsApp personnalisées','Création de chatbots sans code','Gestion d\'une boite de réception partagée','Automatisation des parcours clients','Analyses et rapports détaillés','Intégration avec Wix, WordPress, WHMCS et plus']
              :isTr?['Toplu kişiselleştirilmiş WhatsApp kampanyaları','Kodsuz chatbot oluşturma','Ekip paylaşımlı gelen kutusu yönetimi','Müşteri yolculuklarını otomatikleştirme','Ayrıntılı analitik ve raporlama','Wix, WordPress, WHMCS entegrasyonu']
              :['Sending personalized bulk WhatsApp campaigns','Building chatbots without writing code','Managing a shared team inbox','Automating customer journeys and auto-replies','Detailed analytics and reporting','Integration with Wix, WordPress, WHMCS, and more']
            ).map((item,i)=><li key={i}>{item}</li>)}
          </ul>
        </div>

        <div className="sec">
          <div className="st">{T('3. Acceptable Use','٣. الاستخدام المقبول','3. Utilisation acceptable','3. Kabul Edilebilir Kullanım')}</div>
          <p>{T('The following is prohibited:','يُحظر ما يلي:','Les actions suivantes sont interdites :','Aşağıdakiler yasaktır:')}</p>
          <ul>
            {(isAr?['إرسال رسائل غير مرغوب فيها بدون موافقة صريحة','انتهاك سياسات واتساب للأعمال من Meta','توزيع محتوى ضار أو مسيء أو غير قانوني','محاولة اختراق أنظمة المنصة','انتحال هوية أشخاص أو مؤسسات أخرى','إعادة بيع الخدمة بدون اتفاقية موزع رسمية']
              :isFr?['Envoyer du spam sans consentement explicite','Violer les politiques WhatsApp Business de Meta','Distribuer du contenu nuisible ou illégal','Tenter de pirater les systèmes de la plateforme','Usurper l\'identité d\'autres personnes','Revendre le service sans accord revendeur officiel']
              :isTr?['Onay olmadan spam göndermek','Meta WhatsApp Business politikalarını ihlal etmek','Zararlı veya yasa dışı içerik dağıtmak','Platform sistemlerine saldırı girişiminde bulunmak','Başkalarının kimliğine bürünmek','Resmi bayi sözleşmesi olmadan hizmeti yeniden satmak']
              :['Sending spam without explicit consent','Violating Meta WhatsApp Business policies','Distributing harmful or illegal content','Attempting to breach platform systems','Impersonating other individuals or organizations','Reselling the service without an official reseller agreement']
            ).map((item,i)=><li key={i}>{item}</li>)}
          </ul>
          <div className="wcard">
            <div className="wcard-i"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
            <p>{T('Violations may result in immediate account suspension and reporting WhatsApp-related violations to Meta.','انتهاك هذه القواعد قد يؤدي إلى تعليق الحساب فوراً وإبلاغ Meta بالانتهاكات المتعلقة بواتساب.','Les violations peuvent entraîner la suspension immédiate du compte et le signalement à Meta.','İhlaller, hesabın derhal askıya alınmasına ve Meta\'ya bildirilmesine yol açabilir.')}</p>
          </div>
        </div>

        <div className="sec">
          <div className="st">{T('4. Account Responsibility','٤. مسؤولية الحساب','4. Responsabilité du compte','4. Hesap Sorumluluğu')}</div>
          <ul>
            {(isAr?['الحفاظ على سرية بيانات تسجيل الدخول','تفعيل المصادقة الثنائية (2FA)','إبلاغنا فوراً على security@waabek.com عند الاختراق','ضمان امتثال فريقك لهذه الشروط','الحصول على موافقة المستلمين قبل إرسال أي رسائل']
              :isFr?['Maintenir la confidentialité de vos identifiants','Activer l\'authentification à deux facteurs (2FA)','Nous informer immédiatement à security@waabek.com en cas de violation','S\'assurer que votre équipe respecte ces conditions','Obtenir le consentement des destinataires avant tout envoi']
              :isTr?['Giriş bilgilerinin gizliliğini korumak','İki faktörlü kimlik doğrulamayı (2FA) etkinleştirmek','İhlal durumunda security@waabek.com\'a derhal bildirmek','Ekibinizin bu şartlara uymasını sağlamak','Mesaj göndermeden önce alıcıların rızasını almak']
              :['Maintaining the confidentiality of your login credentials','Enabling two-factor authentication (2FA)','Notifying us immediately at security@waabek.com of any breach','Ensuring your team complies with these Terms','Obtaining recipients\' consent before sending any messages']
            ).map((item,i)=><li key={i}>{item}</li>)}
          </ul>
        </div>

        <div className="sec">
          <div className="st">{T('5. WhatsApp Compliance','٥. الامتثال لسياسات واتساب','5. Conformité WhatsApp','5. WhatsApp Uyumluluğu')}</div>
          <p>{T('Using WABEK requires full compliance with Meta\'s WhatsApp Business policies:','استخدام WABEK يلزمك بالامتثال التام لسياسات Meta:','L\'utilisation de WABEK exige le plein respect des politiques Meta :','WABEK kullanımı Meta politikalarına tam uyumu zorunlu kılar:')}</p>
          <ul>
            <li><a href="https://www.whatsapp.com/legal/business-policy" target="_blank" rel="noopener">WhatsApp Business Policy</a></li>
            <li><a href="https://www.whatsapp.com/legal/commerce-policy" target="_blank" rel="noopener">WhatsApp Commerce Policy</a></li>
            <li><a href="https://developers.facebook.com/terms/" target="_blank" rel="noopener">Meta Platform Terms</a></li>
          </ul>
          <p>{T('You bear full responsibility for compliance. If Meta suspends your number due to your own violations, webek.org is not liable.','أنت تتحمل المسؤولية الكاملة عن الامتثال. إذا علّقت Meta رقمك بسبب انتهاكاتك، لا تتحمل webek.org أي مسؤولية.','Vous assumez l\'entière responsabilité. Si Meta suspend votre numéro suite à vos violations, webek.org n\'est pas responsable.','Uyum konusunda tam sorumluluk size aittir. Meta kendi ihlalleriniz nedeniyle numaranızı askıya alırsa webek.org sorumlu değildir.')}</p>
        </div>

        <div className="sec">
          <div className="st">{T('6. Service Availability','٦. توافر الخدمة','6. Disponibilité du service','6. Hizmet Kullanılabilirliği')}</div>
          <p>{T('We target 99.9% monthly uptime. Our SLA includes:','نستهدف توافراً بنسبة 99.9% شهرياً. تشمل اتفاقية SLA لدينا:','Nous visons 99,9 % de disponibilité mensuelle. Notre SLA comprend :','Aylık %99,9 çalışma süresi hedefliyoruz. SLA\'mız şunları içerir:')}</p>
          <ul>
            {(isAr?['إشعار مسبق بـ 48 ساعة للصيانة المجدولة','صفحة حالة مباشرة على waabek.com/status','رصيد خدمة 10x لأي تجاوز لاتفاقية SLA']
              :isFr?['Préavis de 48 heures pour la maintenance planifiée','Page de statut en direct sur waabek.com/status','Crédit service 10x pour tout dépassement du SLA']
              :isTr?['Planlı bakım için 48 saat önceden bildirim','waabek.com/status\'ta canlı durum sayfası','SLA aşımı için 10x hizmet kredisi']
              :['48-hour advance notice for scheduled maintenance','Live status page at waabek.com/status','10x service credit for any SLA breach']
            ).map((item,i)=><li key={i}>{item}</li>)}
          </ul>
        </div>

        <div className="sec">
          <div className="st">{T('7. Subscriptions and Billing','٧. الاشتراكات والفواتير','7. Abonnements et facturation','7. Abonelikler ve Faturalandırma')}</div>
          <ul>
            {(isAr?['تُجدد الاشتراكات تلقائياً في نهاية كل دورة فوترة','يمكن الإلغاء في أي وقت من إعدادات الحساب','الترقية تسري فوراً، التخفيض في نهاية الدورة الحالية','الأسعار قابلة للتغيير مع إشعار مسبق 30 يوماً']
              :isFr?['Les abonnements se renouvellent automatiquement','Annulation possible à tout moment depuis les paramètres','Mise à niveau immédiate, rétrogradation en fin de cycle','Changements de prix avec préavis de 30 jours']
              :isTr?['Abonelikler otomatik olarak yenilenir','Hesap ayarlarından istediğiniz zaman iptal edilebilir','Yükseltme hemen, düşürme mevcut dönem sonunda','Fiyat değişiklikleri 30 gün önceden bildirilir']
              :['Subscriptions auto-renew at the end of each billing cycle','Cancellation available at any time from Account Settings','Upgrades take effect immediately, downgrades at cycle end','Price changes with 30 days advance notice']
            ).map((item,i)=><li key={i}>{item}</li>)}
          </ul>
        </div>

        <div className="sec">
          <div className="st">{T('8. Limitation of Liability','٨. حدود المسؤولية','8. Limitation de responsabilité','8. Sorumluluk Sınırlaması')}</div>
          <ul>
            {(isAr?['مسؤوليتنا الإجمالية تقتصر على رسوم الـ 3 أشهر الأخيرة','لسنا مسؤولين عن الأضرار غير المباشرة أو العرضية','لسنا مسؤولين عن انقطاع خدمة واتساب خارج عن سيطرتنا','لسنا مسؤولين عن محتوى الرسائل التي ترسلها']
              :isFr?['Notre responsabilité totale est limitée aux frais des 3 derniers mois','Nous ne sommes pas responsables des dommages indirects','Nous ne sommes pas responsables des interruptions WhatsApp','Nous ne sommes pas responsables du contenu de vos messages']
              :isTr?['Toplam sorumluluğumuz son 3 ayın ücretleriyle sınırlıdır','Dolaylı veya sonuçsal zararlardan sorumlu değiliz','WhatsApp hizmet kesintilerinden sorumlu değiliz','Gönderdiğiniz mesajların içeriğinden sorumlu değiliz']
              :['Our total liability is limited to fees paid in the last 3 months','We are not liable for indirect, incidental, or consequential damages','We are not liable for WhatsApp service interruptions outside our control','We are not liable for the content of messages you send']
            ).map((item,i)=><li key={i}>{item}</li>)}
          </ul>
        </div>

        <div className="sec">
          <div className="st">{T('9. Termination','٩. الإنهاء','9. Résiliation','9. Fesih')}</div>
          <ul>
            {(isAr?['يمكنك إلغاء حسابك في أي وقت من إعدادات الحساب','نحتفظ بحق تعليق الحسابات المنتهكة دون إشعار مسبق','عند الإنهاء، بياناتك متاحة للتصدير 30 يوماً ثم تُحذف نهائياً']
              :isFr?['Vous pouvez annuler votre compte à tout moment','Nous nous réservons le droit de suspendre les comptes en violation','Lors de la résiliation, vos données sont exportables pendant 30 jours puis supprimées']
              :isTr?['Hesabınızı istediğiniz zaman iptal edebilirsiniz','İhlal eden hesapları askıya alma hakkını saklı tutarız','Fesih sonrası verileriniz 30 gün dışa aktarılabilir, ardından silinir']
              :['You can cancel your account at any time from Account Settings','We reserve the right to suspend accounts that violate these Terms without prior notice','Upon termination, your data is exportable for 30 days then permanently deleted']
            ).map((item,i)=><li key={i}>{item}</li>)}
          </ul>
        </div>

        <div className="sec">
          <div className="st">{T('10. Governing Law','١٠. القانون الحاكم','10. Droit applicable','10. Yürürlükteki Hukuk')}</div>
          <p>{T('These Terms are governed by applicable international law. Disputes shall first seek amicable resolution within 30 days, then through binding arbitration.','تخضع هذه الشروط للقانون الدولي المعمول به. تسعى النزاعات أولاً للتسوية الودية خلال 30 يوماً، ثم من خلال التحكيم الملزم.','Ces conditions sont régies par le droit international applicable. Les litiges cherchent d\'abord un règlement amiable dans les 30 jours, puis par arbitrage contraignant.','Bu Şartlar geçerli uluslararası hukuka tabidir. Anlaşmazlıklar önce 30 gün içinde dostane çözüm arar, ardından bağlayıcı tahkime gider.')}</p>
          <div className="icard">
            <div className="icard-i"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg></div>
            <p>webek.org — {T('All legal rights reserved.','جميع الحقوق القانونية محفوظة.','Tous les droits légaux réservés.','Tüm yasal haklar saklıdır.')}</p>
          </div>
        </div>

        <div className="lfooter">
          <p style={{fontSize:12,color:'#8696a0'}}>© 2025 webek.org — WABEK. {T('All rights reserved.','جميع الحقوق محفوظة.','Tous droits réservés.','Tüm haklar saklıdır.')}</p>
        </div>
      </div>
      <PublicFooter lang={lang} onLangChange={setLang} />
    </div>
  </>)
}
