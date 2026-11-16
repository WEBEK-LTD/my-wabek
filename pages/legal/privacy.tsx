// @ts-nocheck
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import { LegalLayout } from '@/components/marketing/LegalLayout'
import { usePublicLang } from '@/components/marketing/usePublicLang'

export default function PrivacyPage() {
  const { brandName } = useWhiteLabel()
  const name = brandName || 'WABEK'
  const { lang, setLang, dir } = usePublicLang()
  const isAr = lang==='ar', isFr = lang==='fr', isTr = lang==='tr'
  const T = (en:string, ar:string, fr:string, tr:string) =>
    isAr?ar:isFr?fr:isTr?tr:en

  return (
    <LegalLayout
      lang={lang}
      dir={dir}
      onLangChange={setLang}
      active="/legal/privacy"
      headTitle={`${T('Privacy Policy','سياسة الخصوصية','Politique de confidentialité','Gizlilik Politikası')} | ${name}`}
      eyebrow={T('Legal Document','وثيقة قانونية','Document légal','Yasal Belge')}
      title={T('Privacy Policy','سياسة الخصوصية','Politique de confidentialité','Gizlilik Politikası')}
      description={T(
            'This policy describes how WABEK collects, stores, and uses your personal information. We take your privacy seriously.',
            'تصف هذه السياسة كيفية جمع WABEK وتخزين واستخدام معلوماتك الشخصية. نأخذ خصوصيتك بجدية تامة.',
            'Cette politique décrit comment WABEK collecte, stocke et utilise vos informations personnelles. Nous prenons votre vie privée très au sérieux.',
            'Bu politika WABEK\'in kişisel bilgilerinizi nasıl topladığını, sakladığını ve kullandığını açıklar.'
          )}
      updated={T('Last updated: January 1, 2025','آخر تحديث: ١ يناير ٢٠٢٥','Mise à jour : 1 janv. 2025','Son güncelleme: 1 Ocak 2025')}
      meta={<><span className="rounded-full bg-chip px-3 py-1 text-xs font-medium text-chip-ink" dir="ltr">webek.org</span></>}
    >

      <div className="sec">
        <h2 className="st">{T('1. Information We Collect','١. المعلومات التي نجمعها','1. Informations collectées','1. Topladığımız Bilgiler')}</h2>
        <h3 className="sh">{T('Account Information','معلومات الحساب','Informations du compte','Hesap Bilgileri')}</h3>
        <p>{T('When you create an account, we collect:','عند إنشاء حساب، نجمع:','Lors de la création d\'un compte, nous collectons :','Hesap oluştururken şunları topluyoruz:')}</p>
        <ul>
          {(isAr?['الاسم الكامل وعنوان البريد الإلكتروني','رقم الهاتف (للتحقق بـ OTP)','كلمة المرور (مخزنة كـ hash آمن — لا نراها أبداً)','اسم الشركة والمنطقة الزمنية (اختياري)']
            :isFr?['Nom complet et adresse e-mail','Numéro de téléphone (pour OTP)','Mot de passe (hachage sécurisé — jamais visible)','Nom d\'entreprise et fuseau horaire (optionnel)']
            :isTr?['Tam ad ve e-posta adresi','Telefon numarası (OTP için)','Şifre (güvenli hash — asla görünmez)','Şirket adı ve saat dilimi (isteğe bağlı)']
            :['Full name and email address','Phone number (for OTP verification)','Password (stored as a secure hash — we never see it)','Company name and timezone (optional)']
          ).map((item,i)=><li key={i}>{item}</li>)}
        </ul>
        <h3 className="sh">{T('Usage Data','بيانات الاستخدام','Données d\'utilisation','Kullanım Verileri')}</h3>
        <p>{T('We automatically collect when you use the platform:','نجمع تلقائياً عند استخدامك للمنصة:','Nous collectons automatiquement lors de votre utilisation :','Platformu kullanırken otomatik olarak topluyoruz:')}</p>
        <ul>
          {(isAr?['عناوين IP ونوع المتصفح ونظام التشغيل','الصفحات التي تزورها والوقت المستغرق','الطوابع الزمنية للجلسات وسجلات الأخطاء','إحصاءات استخدام API وعدد الرسائل المرسلة']
            :isFr?['Adresses IP, type de navigateur, système d\'exploitation','Pages visitées et temps passé','Horodatages des sessions et journaux d\'erreurs','Statistiques API et nombre de messages envoyés']
            :isTr?['IP adresleri, tarayıcı türü, işletim sistemi','Ziyaret edilen sayfalar ve harcanan süre','Oturum zaman damgaları ve hata günlükleri','API istatistikleri ve gönderilen mesaj sayısı']
            :['IP addresses, browser type, and operating system','Pages visited and time spent on them','Session timestamps and error logs','API usage statistics and message counts']
          ).map((item,i)=><li key={i}>{item}</li>)}
        </ul>
        <h3 className="sh">{T('Contact and Message Data','بيانات جهات الاتصال والرسائل','Données de contacts et messages','Kişi ve Mesaj Verileri')}</h3>
        <ul>
          {(isAr?['جهات الاتصال التي تستوردها أو تضيفها','الرسائل المرسلة والمستقبلة عبر المنصة','بيانات الحملات وإحصاءات التسليم','محادثات روبوت الدردشة وتدفقات الأتمتة']
            :isFr?['Contacts importés ou ajoutés manuellement','Messages envoyés et reçus','Données de campagnes et statistiques de livraison','Conversations chatbot et flux d\'automatisation']
            :isTr?['İçe aktarılan veya eklenen kişiler','Gönderilen ve alınan mesajlar','Kampanya verileri ve teslimat istatistikleri','Chatbot konuşmaları ve otomasyon akışları']
            :['Contacts you import or add manually','Messages sent and received through the platform','Campaign data and delivery statistics','Chatbot conversations and automation flows']
          ).map((item,i)=><li key={i}>{item}</li>)}
        </ul>
        <div className="icard">
          <div className="icard-i"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
          <p><strong>{T('Your data, your property.','بياناتك ملكيتك.','Vos données vous appartiennent.','Verileriniz size aittir.')}</strong> {T('We process it on your behalf and never use it for our own purposes.','نعالجها نيابةً عنك ولا نستخدمها لأغراضنا الخاصة.','Nous la traitons en votre nom et ne l\'utilisons pas à nos propres fins.','Bunu sizin adınıza işliyoruz ve kendi amaçlarımız için kullanmıyoruz.')}</p>
        </div>
        <h3 className="sh">{T('Payment Information','معلومات الدفع','Informations de paiement','Ödeme Bilgileri')}</h3>
        <p>{T('Payments are processed directly by Stripe (PCI-DSS certified). We only store:','تتم المدفوعات مباشرةً بواسطة Stripe (معتمد PCI-DSS). نحفظ فقط:','Les paiements sont traités directement par Stripe (certifié PCI-DSS). Nous stockons uniquement :','Ödemeler doğrudan Stripe (PCI-DSS sertifikalı) tarafından işlenir. Yalnızca şunları saklarız:')}</p>
        <ul>
          {(isAr?['معرف عميل Stripe (رقم مرجعي فقط)','آخر 4 أرقام من البطاقة وتاريخ انتهاء الصلاحية','تاريخ الفواتير وحالتها']
            :isFr?['Identifiant client Stripe (référence uniquement)','4 derniers chiffres et date d\'expiration','Historique et statut des factures']
            :isTr?['Stripe müşteri kimliği (yalnızca referans)','Kartın son 4 hanesi ve son kullanma tarihi','Fatura geçmişi ve durumu']
            :['Stripe customer ID (reference only)','Last 4 digits and expiry date (display only)','Invoice history and status']
          ).map((item,i)=><li key={i}>{item}</li>)}
        </ul>
      </div>

      <div className="sec">
        <h2 className="st">{T('2. How We Use Your Information','٢. كيف نستخدم معلوماتك','2. Utilisation de vos informations','2. Bilgilerinizi Nasıl Kullanırız')}</h2>
        <ul>
          {(isAr?['تقديم خدمة WABEK وتحسينها وصيانتها','إرسال رموز التحقق OTP وإشعارات الأمان','معالجة المدفوعات وإدارة الاشتراكات','الرد على طلبات الدعم ورسائل التواصل','اكتشاف الاحتيال وإساءة الاستخدام ومنعهما','الامتثال للالتزامات القانونية والتنظيمية','إرسال تحديثات المنتج والإشعارات الضرورية']
            :isFr?['Fournir, améliorer et maintenir WABEK','Envoyer des codes OTP et notifications de sécurité','Traiter les paiements et gérer les abonnements','Répondre aux demandes de support','Détecter et prévenir la fraude','Respecter les obligations légales','Envoyer les mises à jour produit nécessaires']
            :isTr?['WABEK\'i sağlamak, geliştirmek ve sürdürmek','OTP kodları ve güvenlik bildirimleri göndermek','Ödemeleri işlemek ve abonelikleri yönetmek','Destek taleplerine yanıt vermek','Dolandırıcılığı tespit etmek ve önlemek','Yasal yükümlülüklere uymak','Ürün güncellemeleri ve bildirimler göndermek']
            :['Provide, improve, and maintain WABEK','Send OTP codes and security notifications','Process payments and manage subscriptions','Respond to support requests','Detect and prevent fraud and abuse','Comply with legal and regulatory obligations','Send product updates and necessary notifications']
          ).map((item,i)=><li key={i}>{item}</li>)}
        </ul>
        <div className="icard">
          <div className="icard-i"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg></div>
          <p><strong>{T('Explicit commitment:','التزام صريح:','Engagement explicite :','Açık taahhüt:')}</strong> {T('We do not sell your personal data or your contacts\' data to any third party, and we do not use it for advertising targeting.','لا نبيع بياناتك الشخصية أو بيانات جهات اتصالك لأي طرف ثالث، ولا نستخدمها لاستهداف الإعلانات.','Nous ne vendons pas vos données à des tiers et ne les utilisons pas pour le ciblage publicitaire.','Kişisel verilerinizi üçüncü taraflara satmıyor ve reklam hedefleme için kullanmıyoruz.')}</p>
        </div>
      </div>

      <div className="sec">
        <h2 className="st">{T('3. Data Sharing','٣. مشاركة البيانات','3. Partage des données','3. Veri Paylaşımı')}</h2>
        <p>{T('We only share your data with:','نشارك بياناتك فقط مع:','Nous partageons vos données uniquement avec :','Verilerinizi yalnızca şunlarla paylaşırız:')}</p>
        <ul>
          <li><strong>Stripe</strong> — {T('payment processing (PCI-DSS certified)','معالجة المدفوعات (معتمد PCI-DSS)','traitement des paiements (certifié PCI-DSS)','ödeme işleme (PCI-DSS sertifikalı)')}</li>
          <li><strong>Meta / WhatsApp</strong> — {T('message delivery via Cloud API','تسليم الرسائل عبر Cloud API','livraison des messages via Cloud API','Cloud API aracılığıyla mesaj iletimi')}</li>
          <li><strong>Anthropic (Claude)</strong> — {T('AI features (no permanent conversation storage)','ميزات الذكاء الاصطناعي (بدون تخزين دائم)','fonctionnalités IA (sans stockage permanent)','yapay zeka özellikleri (kalıcı depolama yok)')}</li>
          <li><strong>{T('Law enforcement','جهات إنفاذ القانون','Forces de l\'ordre','Kolluk kuvvetleri')}</strong> — {T('upon official legal request only','عند الطلب القانوني الرسمي فقط','sur demande légale officielle uniquement','yalnızca resmi yasal talep üzerine')}</li>
        </ul>
      </div>

      <div className="sec">
        <h2 className="st">{T('4. Data Retention','٤. الاحتفاظ بالبيانات','4. Conservation des données','4. Veri Saklama')}</h2>
        <p>{T('We retain your data as long as your account is active. Upon account deletion:','نحتفظ ببياناتك طالما حسابك نشط. عند حذف الحساب:','Nous conservons vos données tant que votre compte est actif. Lors de la suppression :','Hesabınız aktif olduğu sürece verilerinizi saklarız. Hesap silindiğinde:')}</p>
        <ul>
          {(isAr?['البيانات الشخصية تُحذف خلال 30 يوماً','جهات الاتصال وبيانات الحملات خلال 30 يوماً','سجلات الرسائل تُحتفظ حتى 90 يوماً لمنع الاحتيال','بيانات الفواتير بعد 7 سنوات وفقاً للمتطلبات القانونية']
            :isFr?['Données personnelles supprimées dans les 30 jours','Contacts et campagnes supprimés dans les 30 jours','Journaux de messages conservés 90 jours max pour prévention','Données de facturation supprimées après 7 ans (exigence légale)']
            :isTr?['Kişisel veriler 30 gün içinde silinir','Kişiler ve kampanya verileri 30 gün içinde silinir','Mesaj kayıtları dolandırıcılık önleme için 90 güne kadar saklanır','Fatura verileri yasal gereğe uyarak 7 yıl sonra silinir']
            :['Personal data deleted within 30 days','Contacts and campaign data deleted within 30 days','Message logs retained up to 90 days for fraud prevention','Billing data deleted after 7 years per legal requirements']
          ).map((item,i)=><li key={i}>{item}</li>)}
        </ul>
      </div>

      <div className="sec">
        <h2 className="st">{T('5. Your Rights','٥. حقوقك','5. Vos droits','5. Haklarınız')}</h2>
        <ul>
          {(isAr?['حق الوصول: تصدير جميع بياناتك من إعدادات الحساب','حق التصحيح: تعديل معلوماتك من ملفك الشخصي','حق الحذف: حذف حسابك وجميع بياناتك نهائياً','حق النقل: تصدير بياناتك بتنسيق JSON/CSV','حق الاعتراض: إلغاء الاشتراك في الاتصالات التسويقية']
            :isFr?['Droit d\'accès : exportez vos données depuis les paramètres','Droit de rectification : modifiez vos informations dans votre profil','Droit à l\'effacement : supprimez votre compte et toutes vos données','Droit à la portabilité : exportez en JSON/CSV','Droit d\'opposition : désinscrivez-vous des communications marketing']
            :isTr?['Erişim hakkı: Hesap ayarlarından verilerinizi dışa aktarın','Düzeltme hakkı: Bilgilerinizi profilinizden düzenleyin','Silme hakkı: Hesabınızı ve tüm verilerinizi kalıcı olarak silin','Taşınabilirlik hakkı: JSON/CSV olarak dışa aktarın','İtiraz hakkı: Pazarlama iletişimlerinden çıkın']
            :['Right to access: export all your data from Account Settings','Right to rectification: edit your information from your profile','Right to erasure: permanently delete your account and all data','Right to portability: export your data in JSON/CSV','Right to object: unsubscribe from marketing communications']
          ).map((item,i)=><li key={i}>{item}</li>)}
        </ul>
        <p>{T('Contact us at','تواصل معنا على','Contactez-nous à','Bize ulaşın:')} <strong>privacy@waabek.com</strong> {T('— we respond within 72 hours.','— نرد خلال 72 ساعة.','— nous répondons dans les 72 heures.','— 72 saat içinde yanıt veririz.')}</p>
      </div>

      <div className="sec">
        <h2 className="st">{T('6. Security','٦. الأمان','6. Sécurité','6. Güvenlik')}</h2>
        <ul>
          {(isAr?['تشفير TLS 1.3 لجميع البيانات أثناء النقل','تشفير AES-256 للبيانات المحفوظة','تجزئة bcrypt لكلمات المرور (لا نراها أبداً)','مصادقة ثنائية العوامل (2FA)','مراجعات أمنية دورية ومراقبة مستمرة','نسخ احتياطية يومية مشفرة']
            :isFr?['Chiffrement TLS 1.3 en transit','Chiffrement AES-256 au repos','Hachage bcrypt des mots de passe','Authentification à deux facteurs (2FA)','Audits de sécurité réguliers','Sauvegardes quotidiennes chiffrées']
            :isTr?['Transit için TLS 1.3 şifrelemesi','Beklemedeki veriler için AES-256','Şifre bcrypt karması','İki faktörlü kimlik doğrulama (2FA)','Düzenli güvenlik denetimleri','Günlük şifreli yedeklemeler']
            :['TLS 1.3 encryption for all data in transit','AES-256 encryption for data at rest','bcrypt password hashing (we never see your password)','Two-factor authentication (2FA)','Regular security audits and continuous monitoring','Daily encrypted backups']
          ).map((item,i)=><li key={i}>{item}</li>)}
        </ul>
      </div>

      <div className="sec">
        <h2 className="st">{T('7. Cookies','٧. ملفات تعريف الارتباط','7. Cookies','7. Çerezler')}</h2>
        <p>{T('We use only necessary cookies:','نستخدم ملفات تعريف الارتباط الضرورية فقط:','Nous utilisons uniquement les cookies nécessaires :','Yalnızca gerekli çerezleri kullanırız:')}</p>
        <ul>
          {(isAr?['جلسة المصادقة (تنتهي عند تسجيل الخروج)','تفضيل اللغة وإعدادات الواجهة','رمز CSRF لحماية الأمان']
            :isFr?['Session d\'authentification (expire à la déconnexion)','Préférence de langue et paramètres','Jeton CSRF pour la sécurité']
            :isTr?['Kimlik doğrulama oturumu (çıkışta sona erer)','Dil tercihi ve arayüz ayarları','Güvenlik için CSRF jetonu']
            :['Authentication session (expires on logout)','Language preference and interface settings','CSRF token for security protection']
          ).map((item,i)=><li key={i}>{item}</li>)}
        </ul>
        <p className="text-sm text-muted">{T('We do not use tracking or advertising cookies.','لا نستخدم ملفات تعريف الارتباط التتبعية أو الإعلانية.','Nous n\'utilisons pas de cookies de suivi ou publicitaires.','İzleme veya reklam çerezleri kullanmıyoruz.')}</p>
      </div>

      <div className="sec">
        <h2 className="st">{T('8. Policy Updates','٨. تحديثات السياسة','8. Mises à jour','8. Politika Güncellemeleri')}</h2>
        <p>{T('We may update this policy periodically. For significant changes, we will notify you via email and in-app notification 30 days before the changes take effect.','قد نحدّث هذه السياسة من وقت لآخر. للتغييرات الجوهرية، سنخطرك عبر البريد الإلكتروني وإشعار داخل التطبيق قبل 30 يوماً.','Nous pouvons mettre à jour cette politique. Pour les changements importants, nous vous notifierons par e-mail 30 jours avant.','Bu politikayı periyodik olarak güncelleyebiliriz. Önemli değişiklikler için değişiklikten 30 gün önce e-posta ile bilgilendireceğiz.')}</p>
      </div>

      <div className="sec">
        <h2 className="st">{T('9. Contact Us','٩. التواصل معنا','9. Nous contacter','9. İletişim')}</h2>
        <ul>
          <li><strong>{T('Privacy email:','بريد الخصوصية:','E-mail confidentialité :','Gizlilik e-postası:')}</strong> privacy@waabek.com</li>
          <li><strong>{T('Owner:','الجهة المالكة:','Propriétaire :','Sahibi:')}</strong> webek.org</li>
        </ul>
        <div className="icard">
          <div className="icard-i"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
          <p>{T('WABEK is owned and operated by webek.org. All legal rights reserved to webek.org.','WABEK مملوكة وتديرها webek.org. جميع الحقوق القانونية محفوظة لـ webek.org.','WABEK est détenu et exploité par webek.org. Tous les droits légaux sont réservés à webek.org.','WABEK, webek.org tarafından sahiplenilmekte ve işletilmektedir. Tüm yasal haklar webek.org\'a aittir.')}</p>
        </div>
      </div>

      <div className="lfooter">
        <p className="text-xs text-muted">© 2025 webek.org — WABEK. {T('All rights reserved.','جميع الحقوق محفوظة.','Tous droits réservés.','Tüm haklar saklıdır.')}</p>
      </div>
    </LegalLayout>
  )
}
