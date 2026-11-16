// @ts-nocheck
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import { LegalLayout } from '@/components/marketing/LegalLayout'
import { usePublicLang } from '@/components/marketing/usePublicLang'

export default function LicensePage() {
  const { brandName } = useWhiteLabel()
  const name = brandName || 'WABEK'
  const { lang, setLang, dir } = usePublicLang()
  const isAr = lang==='ar', isFr = lang==='fr', isTr = lang==='tr'
  const T = (en:string,ar:string,fr:string,tr:string) => isAr?ar:isFr?fr:isTr?tr:en

  return (
    <LegalLayout
      lang={lang}
      dir={dir}
      onLangChange={setLang}
      active="/legal/license"
      headTitle={`${T('Software License','رخصة البرنامج','Licence du logiciel','Yazılım Lisansı')} | ${name}`}
      eyebrow={T('Proprietary Software','برنامج مملوك','Logiciel propriétaire','Tescilli Yazılım')}
      title={T('Software License','رخصة البرنامج','Licence du logiciel','Yazılım Lisansı')}
      description={T('WABEK is proprietary software owned by webek.org. Read this license carefully before using the software.','WABEK برنامج مملوك لـ webek.org. اقرأ هذه الرخصة بعناية قبل استخدام البرنامج.','WABEK est un logiciel propriétaire appartenant à webek.org. Lisez attentivement cette licence avant d\'utiliser le logiciel.','WABEK, webek.org\'a ait tescilli bir yazılımdır. Yazılımı kullanmadan önce bu lisansı dikkatlice okuyun.')}
      updated={T('Last updated: January 1, 2025','آخر تحديث: ١ يناير ٢٠٢٥','Mise à jour : 1 janv. 2025','Son güncelleme: 1 Ocak 2025')}
      meta={<><span className="rounded-full bg-violet-bg px-3 py-1 text-xs font-medium text-violet" dir="ltr">Proprietary</span><span className="rounded-full bg-chip px-3 py-1 text-xs font-medium text-chip-ink" dir="ltr">webek.org</span></>}
    >

      {/* Owner box */}
      <div className="owner-box">
        <div className="owner-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
        </div>
        <p className="mb-1.5 text-sm font-bold">
          {T('WABEK is entirely owned by','WABEK مملوكة بالكامل لـ','WABEK est entièrement détenu par','WABEK tamamen şuna aittir')}
        </p>
        <p className="owner-name mb-2 text-[32px] font-bold leading-none" dir="ltr">webek.org</p>
        <p className="text-[13px]">
          {T('All intellectual, commercial, and legal rights reserved','جميع الحقوق الفكرية والتجارية والقانونية محفوظة','Tous les droits intellectuels, commerciaux et juridiques réservés','Tüm fikri, ticari ve yasal haklar saklıdır')}
        </p>
      </div>

      <div className="sec">
        <h2 className="st">{T('1. Grant of License','١. منح الرخصة','1. Octroi de licence','1. Lisans Verilmesi')}</h2>
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
        <h2 className="st">{T('2. Restrictions','٢. القيود الصريحة','2. Restrictions explicites','2. Kısıtlamalar')}</h2>
        <p>{T('The following are expressly prohibited without prior written permission from webek.org:','يُحظر صراحةً ما يلي دون إذن خطي مسبق من webek.org:','Les actions suivantes sont expressément interdites sans autorisation écrite préalable de webek.org :','Aşağıdakiler webek.org\'dan önceden yazılı izin olmaksızın açıkça yasaktır:')}</p>
        <ul>
          {(isAr?['نسخ البرنامج أو توزيعه أو نقله','الهندسة العكسية أو محاولة استخراج الكود المصدري','إنشاء منتجات أو خدمات مشتقة','بيع أو إعادة بيع البرنامج','إزالة أو تعديل أي علامات ملكية أو حقوق نشر','استخدام البرنامج لبناء منتج منافس مباشر','الوصول المباشر لقواعد البيانات متجاوزاً API الرسمي']
            :isFr?['Copier, distribuer ou transmettre le logiciel','Procéder à une ingénierie inverse ou tenter d\'extraire le code source','Créer des produits ou services dérivés','Vendre ou revendre le logiciel','Supprimer ou modifier les mentions de propriété','Utiliser le logiciel pour créer un produit concurrent','Accéder directement aux bases de données en contournant l\'API officielle']
            :isTr?['Yazılımı kopyalamak, dağıtmak veya iletmek','Tersine mühendislik uygulamak veya kaynak kodu çıkarmak','Türev ürünler veya hizmetler oluşturmak','Yazılımı satmak veya yeniden satmak','Mülkiyet bildirimlerini kaldırmak veya değiştirmek','Rakip ürün oluşturmak için yazılımı kullanmak','Resmi API\'yi atlatarak veritabanlarına doğrudan erişmek']
            :['Copying, distributing, or transmitting the software','Reverse engineering or attempting to extract the source code','Creating derivative products or services','Selling or reselling the software','Removing or modifying any proprietary notices','Using the software to build a direct competing product','Directly accessing databases bypassing the official API']
          ).map((item,i)=><li key={i}>{item}</li>)}
        </ul>
        <div className="wcard">
          <div className="wcard-i"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
          <p>{T('Violating these restrictions exposes you to legal liability and may result in legal action by webek.org.','انتهاك هذه القيود يعرضك للمساءلة القانونية وقد يؤدي إلى إجراءات قانونية من webek.org.','La violation de ces restrictions vous expose à des poursuites judiciaires par webek.org.','Bu kısıtlamaların ihlali webek.org tarafından yasal işlem başlatılmasına yol açabilir.')}</p>
        </div>
      </div>

      <div className="sec">
        <h2 className="st">{T('3. Intellectual Property','٣. الملكية الفكرية','3. Propriété intellectuelle','3. Fikri Mülkiyet')}</h2>
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
        <h2 className="st">{T('4. User Data','٤. بيانات المستخدم','4. Données utilisateur','4. Kullanıcı Verileri')}</h2>
        <p>{T('The data you create and import into WABEK belongs to you. You grant us a limited license to process this data solely to provide the service. You can export your data at any time. Upon account termination, your data is deleted within 30 days.','البيانات التي تنشئها وتستوردها في WABEK تخصك أنت. تمنحنا رخصة محدودة لمعالجة هذه البيانات لغرض تقديم الخدمة فقط. يمكنك تصدير بياناتك في أي وقت. عند إنهاء الحساب، تُحذف بياناتك خلال 30 يوماً.','Les données que vous créez dans WABEK vous appartiennent. Vous nous accordez une licence limitée pour les traiter dans le seul but de fournir le service. Exportez vos données à tout moment. Elles sont supprimées dans les 30 jours suivant la résiliation.','WABEK\'e aktardığınız veriler size aittir. Yalnızca hizmet sunmak için bu verileri işlememiz için sınırlı lisans verirsiniz. Verilerinizi istediğiniz zaman dışa aktarabilirsiniz. Hesap feshinde 30 gün içinde silinir.')}</p>
      </div>

      <div className="sec">
        <h2 className="st">{T('5. Reseller Program','٥. برنامج الموزعين','5. Programme revendeurs','5. Bayi Programı')}</h2>
        <p>{T('Organizations wishing to resell WABEK or offer it under their own brand (White Label) can apply for an official reseller license. Contact:','المؤسسات الراغبة في إعادة بيع WABEK أو تقديمه تحت علامتها (White Label) يمكنها التقدم لرخصة موزع. تواصل مع:','Les organisations souhaitant revendre WABEK sous leur marque peuvent demander une licence revendeur. Contactez :','WABEK\'i kendi markası altında yeniden satmak isteyen kuruluşlar bayi lisansı başvurusunda bulunabilir. İletişim:')} <strong>resellers@waabek.com</strong></p>
        <div className="pcard">
          <div className="pcard-i"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg></div>
          <p>{T('Resellers get: custom domain and logo, independent pricing, unified dashboard, direct support from webek.org, and early access to new features.','يحصل الموزعون على: نطاق وشعار مخصص، تسعير مستقل، لوحة تحكم موحدة، دعم مباشر من webek.org، ووصول مبكر للميزات.','Les revendeurs bénéficient : domaine et logo personnalisés, tarification indépendante, tableau de bord unifié, support direct webek.org, et accès anticipé aux nouvelles fonctionnalités.','Bayiler şunlara sahip olur: özel domain ve logo, bağımsız fiyatlandırma, birleşik panel, webek.org\'dan doğrudan destek ve yeni özelliklere erken erişim.')}</p>
        </div>
      </div>

      <div className="sec">
        <h2 className="st">{T('6. License Termination','٦. إنهاء الرخصة','6. Résiliation de la licence','6. Lisans Feshi')}</h2>
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
        <p className="text-sm font-bold text-ink">WABEK — webek.org</p>
        <p className="text-xs text-violet">
          {T('Proprietary software. All rights reserved.','برنامج مملوك. جميع الحقوق محفوظة.','Logiciel propriétaire. Tous droits réservés.','Tescilli yazılım. Tüm haklar saklıdır.')}
        </p>
        <p className="text-xs text-muted">
          {T('Unauthorized use is prohibited and subject to legal prosecution.','الاستخدام غير المصرح به محظور ويخضع للملاحقة القانونية.','Toute utilisation non autorisée est interdite et passible de poursuites judiciaires.','Yetkisiz kullanım yasaktır ve yasal kovuşturmaya konu olabilir.')}
        </p>
      </div>
    </LegalLayout>
  )
}
