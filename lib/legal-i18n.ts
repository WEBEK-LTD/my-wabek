// Legal pages translations - AR / FR / TR
// EN is the default fallback

export const legalT = {
  nav_home: { en: `Home`, ar: `الرئيسية`, fr: `Accueil`, tr: `Ana Sayfa` },
  last_updated: { en: `Last updated`, ar: `آخر تحديث`, fr: `Dernière mise à jour`, tr: `Son güncelleme` },

  // PRIVACY POLICY
  privacy_title: { en: `Privacy Policy`, ar: `سياسة الخصوصية`, fr: `Politique de confidentialité`, tr: `Gizlilik Politikası` },
  privacy_s1: { en: `1. Information We Collect`, ar: `١. المعلومات التي نجمعها`, fr: `1. Informations collectées`, tr: `1. Topladığımız Bilgiler` },
  privacy_s1_account: { en: `Account Information`, ar: `معلومات الحساب`, fr: `Informations du compte`, tr: `Hesap Bilgileri` },
  privacy_s1_account_p: {
    en: `When you register, we collect: full name, email address, phone number (for OTP verification), and password (stored as a secure hash).`,
    ar: `عند التسجيل نجمع: الاسم الكامل، البريد الإلكتروني، رقم الهاتف (للتحقق بـ OTP)، وكلمة المرور (مخزنة بشكل آمن).`,
    fr: `Lors de l'inscription, nous collectons : nom complet, adresse e-mail, numéro de téléphone (pour la vérification OTP) et mot de passe (stocké sous forme de hachage sécurisé).`,
    tr: `Kayıt olurken şunları topluyoruz: tam ad, e-posta adresi, telefon numarası (OTP doğrulaması için) ve şifre (güvenli hash olarak saklanır).`,
  },
  privacy_s1_usage: { en: `Usage Data`, ar: `بيانات الاستخدام`, fr: `Données d'utilisation`, tr: `Kullanım Verileri` },
  privacy_s1_usage_p: {
    en: `We automatically collect: IP addresses, browser type, device information, pages visited, timestamps, and API usage statistics.`,
    ar: `نجمع تلقائياً: عناوين IP، نوع المتصفح، معلومات الجهاز، الصفحات المزارة، الطوابع الزمنية، وإحصاءات استخدام API.`,
    fr: `Nous collectons automatiquement : adresses IP, type de navigateur, informations sur l'appareil, pages visitées, horodatages et statistiques d'utilisation de l'API.`,
    tr: `Otomatik olarak topluyoruz: IP adresleri, tarayıcı türü, cihaz bilgileri, ziyaret edilen sayfalar, zaman damgaları ve API kullanım istatistikleri.`,
  },
  privacy_s1_msg: { en: `Contact and Message Data`, ar: `بيانات جهات الاتصال والرسائل`, fr: `Données de contact et messages`, tr: `İletişim ve Mesaj Verileri` },
  privacy_s1_msg_p: {
    en: `We store contacts you import, messages sent through the platform, campaign data, and chatbot conversations. This data belongs to you.`,
    ar: `نحفظ جهات الاتصال التي تستوردها، الرسائل المرسلة عبر المنصة، بيانات الحملات، ومحادثات الروبوتات. هذه البيانات تخصك.`,
    fr: `Nous stockons les contacts que vous importez, les messages envoyés via la plateforme, les données de campagne et les conversations chatbot. Ces données vous appartiennent.`,
    tr: `İçe aktardığınız kişileri, platform üzerinden gönderilen mesajları, kampanya verilerini ve chatbot konuşmalarını saklarız. Bu veriler size aittir.`,
  },
  privacy_s1_pay: { en: `Payment Information`, ar: `معلومات الدفع`, fr: `Informations de paiement`, tr: `Ödeme Bilgileri` },
  privacy_s1_pay_p: {
    en: `Payment details are processed directly by Stripe. We store only your Stripe customer ID and never see or store full card numbers.`,
    ar: `تتم معالجة تفاصيل الدفع مباشرة بواسطة Stripe. نحفظ فقط معرف عميل Stripe الخاص بك ولا نرى أو نحفظ أرقام البطاقات الكاملة.`,
    fr: `Les détails de paiement sont traités directement par Stripe. Nous ne stockons que votre identifiant client Stripe et ne voyons jamais les numéros de carte complets.`,
    tr: `Ödeme bilgileri doğrudan Stripe tarafından işlenir. Yalnızca Stripe müşteri kimliğinizi saklarız ve tam kart numaralarını hiçbir zaman görmeyiz.`,
  },
  privacy_s2: { en: `2. How We Use Your Information`, ar: `٢. كيف نستخدم معلوماتك`, fr: `2. Utilisation de vos informations`, tr: `2. Bilgilerinizi Nasıl Kullanırız` },
  privacy_s2_no_sell: {
    en: `We do not sell your personal data or your contacts' data to third parties.`,
    ar: `لا نبيع بياناتك الشخصية أو بيانات جهات اتصالك لأطراف ثالثة.`,
    fr: `Nous ne vendons pas vos données personnelles ni les données de vos contacts à des tiers.`,
    tr: `Kişisel verilerinizi veya kişilerinizin verilerini üçüncü taraflara satmıyoruz.`,
  },
  privacy_s3: { en: `3. Data Sharing`, ar: `٣. مشاركة البيانات`, fr: `3. Partage des données`, tr: `3. Veri Paylaşımı` },
  privacy_s3_p: { en: `We share data only with:`, ar: `نشارك البيانات فقط مع:`, fr: `Nous partageons les données uniquement avec :`, tr: `Verileri yalnızca şunlarla paylaşırız:` },
  privacy_s4: { en: `4. Data Retention`, ar: `٤. الاحتفاظ بالبيانات`, fr: `4. Conservation des données`, tr: `4. Veri Saklama` },
  privacy_s4_p: {
    en: `We retain your data for as long as your account is active. Upon account deletion, personal data is removed within 30 days. Message logs may be retained for up to 90 days for abuse prevention.`,
    ar: `نحتفظ ببياناتك طالما حسابك نشط. عند حذف الحساب، تزال البيانات الشخصية خلال 30 يوماً. قد تحتفظ سجلات الرسائل لمدة تصل إلى 90 يوماً لمنع إساءة الاستخدام.`,
    fr: `Nous conservons vos données tant que votre compte est actif. Lors de la suppression du compte, les données personnelles sont supprimées dans les 30 jours. Les journaux de messages peuvent être conservés jusqu'à 90 jours pour prévenir les abus.`,
    tr: `Hesabınız aktif olduğu sürece verilerinizi saklarız. Hesap silindikten sonra kişisel veriler 30 gün içinde kaldırılır. Mesaj kayıtları kötüye kullanımı önlemek için 90 güne kadar saklanabilir.`,
  },
  privacy_s5: { en: `5. Your Rights`, ar: `٥. حقوقك`, fr: `5. Vos droits`, tr: `5. Haklarınız` },
  privacy_s5_rights: {
    en: `You have the right to access, correct, export, or delete your data at any time through Account Settings or by contacting support.`,
    ar: `يحق لك الوصول إلى بياناتك أو تصحيحها أو تصديرها أو حذفها في أي وقت من خلال إعدادات الحساب أو بالتواصل مع الدعم.`,
    fr: `Vous avez le droit d'accéder, corriger, exporter ou supprimer vos données à tout moment via les paramètres du compte ou en contactant le support.`,
    tr: `Hesap Ayarları üzerinden veya destek ekibiyle iletişime geçerek verilerinize her zaman erişme, düzeltme, dışa aktarma veya silme hakkına sahipsiniz.`,
  },
  privacy_s6: { en: `6. Security`, ar: `٦. الأمان`, fr: `6. Sécurité`, tr: `6. Güvenlik` },
  privacy_s6_p: {
    en: `We use TLS encryption in transit, AES-256 encryption at rest, regular security audits, and access controls. No system is 100% secure; use strong passwords and enable two-factor authentication.`,
    ar: `نستخدم تشفير TLS أثناء النقل، وتشفير AES-256 في التخزين، ومراجعات أمنية دورية، وضوابط وصول. لا يوجد نظام آمن 100%. استخدم كلمات مرور قوية وفعّل المصادقة الثنائية.`,
    fr: `Nous utilisons le chiffrement TLS en transit, AES-256 au repos, des audits de sécurité réguliers et des contrôles d'accès. Aucun système n'est sécurisé à 100%. Utilisez des mots de passe forts et activez la double authentification.`,
    tr: `Transit sırasında TLS, beklemede AES-256 şifrelemesi, düzenli güvenlik denetimleri ve erişim kontrolleri kullanıyoruz. Hiçbir sistem yüzde yüz güvenli değildir. Güçlü şifreler kullanın ve iki faktörlü doğrulamayı etkinleştirin.`,
  },
  privacy_contact: {
    en: `For privacy questions, contact us at privacy@waabek.com`,
    ar: `لأسئلة الخصوصية، تواصل معنا على privacy@waabek.com`,
    fr: `Pour toute question de confidentialité, contactez-nous à privacy@waabek.com`,
    tr: `Gizlilik sorularınız için privacy@waabek.com adresinden iletişime geçin.`,
  },

  // TERMS OF SERVICE
  terms_title: { en: `Terms of Service`, ar: `شروط الخدمة`, fr: `Conditions d'utilisation`, tr: `Hizmet Şartları` },
  terms_s1: { en: `1. Acceptance of Terms`, ar: `١. قبول الشروط`, fr: `1. Acceptation des conditions`, tr: `1. Şartların Kabulü` },
  terms_s1_p: {
    en: `By accessing or using WABEK, you agree to be bound by these Terms. If you do not agree, do not use the Service.`,
    ar: `باستخدام WABEK توافق على الالتزام بهذه الشروط. إذا كنت لا توافق، لا تستخدم الخدمة.`,
    fr: `En accédant ou utilisant WABEK, vous acceptez d'être lié par ces Conditions. Si vous n'êtes pas d'accord, n'utilisez pas le Service.`,
    tr: `WABEK'e erişerek veya kullanarak bu Şartlara bağlı olmayı kabul edersiniz. Kabul etmiyorsanız Hizmeti kullanmayın.`,
  },
  terms_s2: { en: `2. Acceptable Use`, ar: `٢. الاستخدام المقبول`, fr: `2. Utilisation acceptable`, tr: `2. Kabul Edilebilir Kullanım` },
  terms_s2_prohib: { en: `You must not use the Service to:`, ar: `لا يجوز استخدام الخدمة من أجل:`, fr: `Vous ne devez pas utiliser le Service pour :`, tr: `Hizmeti şu amaçlarla kullanamazsınız:` },
  terms_s3: { en: `3. Account Responsibility`, ar: `٣. مسؤولية الحساب`, fr: `3. Responsabilité du compte`, tr: `3. Hesap Sorumluluğu` },
  terms_s3_p: {
    en: `You are responsible for all activity under your account. Keep credentials secure and notify us immediately of any unauthorized access.`,
    ar: `أنت مسؤول عن جميع الأنشطة على حسابك. احتفظ ببيانات الدخول بأمان وأبلغنا فوراً عن أي وصول غير مصرح به.`,
    fr: `Vous êtes responsable de toute activité sous votre compte. Gardez vos identifiants en sécurité et informez-nous immédiatement de tout accès non autorisé.`,
    tr: `Hesabınızdaki tüm faaliyetlerden sorumlusunuz. Kimlik bilgilerini güvende tutun ve yetkisiz erişimi derhal bildirin.`,
  },
  terms_s4: { en: `4. WhatsApp Compliance`, ar: `٤. الامتثال لواتساب`, fr: `4. Conformité WhatsApp`, tr: `4. WhatsApp Uyumluluğu` },
  terms_s4_p: {
    en: `You must comply with Meta's WhatsApp Business Policy. Sending unsolicited messages, spam, or prohibited content may result in immediate account suspension.`,
    ar: `يجب الامتثال لسياسة واتساب للأعمال من Meta. قد يؤدي إرسال رسائل غير مرغوب فيها أو محتوى محظور إلى تعليق الحساب فوراً.`,
    fr: `Vous devez respecter la Politique WhatsApp Business de Meta. L'envoi de messages non sollicités ou de contenu interdit peut entraîner une suspension immédiate du compte.`,
    tr: `Meta'nın WhatsApp Business Politikasına uymanız gerekir. İstenmeyen mesaj veya yasak içerik göndermek hesabın derhal askıya alınmasına yol açabilir.`,
  },
  terms_s5: { en: `5. Service Availability`, ar: `٥. توافر الخدمة`, fr: `5. Disponibilité du service`, tr: `5. Hizmet Kullanılabilirliği` },
  terms_s5_p: {
    en: `We target 99.9% uptime but do not guarantee uninterrupted service. Scheduled maintenance will be announced in advance.`,
    ar: `نستهدف توافراً بنسبة 99.9% لكننا لا نضمن خدمة غير منقطعة. سيتم الإعلان عن الصيانة المجدولة مسبقاً.`,
    fr: `Nous visons 99,9 % de disponibilité mais ne garantissons pas un service ininterrompu. Les maintenances planifiées seront annoncées à l'avance.`,
    tr: `Yüzde 99,9 çalışma süresi hedefliyoruz ancak kesintisiz hizmet garantisi vermiyoruz. Planlı bakımlar önceden duyurulacaktır.`,
  },
  terms_s6: { en: `6. Limitation of Liability`, ar: `٦. حدود المسؤولية`, fr: `6. Limitation de responsabilité`, tr: `6. Sorumluluk Sınırlaması` },
  terms_s6_p: {
    en: `Our liability is limited to the fees you paid in the last 3 months. We are not liable for indirect, incidental, or consequential damages.`,
    ar: `تقتصر مسؤوليتنا على الرسوم التي دفعتها خلال الأشهر الثلاثة الأخيرة. لسنا مسؤولين عن الأضرار غير المباشرة أو العرضية.`,
    fr: `Notre responsabilité est limitée aux frais que vous avez payés au cours des 3 derniers mois. Nous ne sommes pas responsables des dommages indirects ou consécutifs.`,
    tr: `Sorumluluğumuz son 3 ayda ödediğiniz ücretlerle sınırlıdır. Dolaylı, tesadüfi veya sonuçsal zararlardan sorumlu değiliz.`,
  },
  terms_s7: { en: `7. Termination`, ar: `٧. الإنهاء`, fr: `7. Résiliation`, tr: `7. Fesih` },
  terms_s7_p: {
    en: `Either party may terminate at any time. We may suspend accounts that violate these Terms. Upon termination, your data will be available for export for 30 days.`,
    ar: `يمكن لأي طرف إنهاء الخدمة في أي وقت. يمكننا تعليق الحسابات التي تنتهك هذه الشروط. عند الإنهاء، ستكون بياناتك متاحة للتصدير لمدة 30 يوماً.`,
    fr: `L'une ou l'autre des parties peut résilier à tout moment. Nous pouvons suspendre les comptes qui enfreignent ces Conditions. À la résiliation, vos données seront disponibles pour export pendant 30 jours.`,
    tr: `Her iki taraf da istediği zaman feshedebilir. Bu Şartları ihlal eden hesapları askıya alabiliriz. Fesih sonrası verileriniz 30 gün boyunca dışa aktarılabilir.`,
  },
  terms_governing: {
    en: `Governing Law: These Terms are governed by applicable international law. Disputes shall be resolved through binding arbitration.`,
    ar: `القانون الحاكم: تخضع هذه الشروط للقانون الدولي المعمول به. تحسم النزاعات من خلال التحكيم الملزم.`,
    fr: `Droit applicable : Ces Conditions sont régies par le droit international applicable. Les litiges seront résolus par arbitrage contraignant.`,
    tr: `Yürürlükteki Hukuk: Bu Şartlar geçerli uluslararası hukuka tabidir. Anlaşmazlıklar bağlayıcı tahkim yoluyla çözülür.`,
  },

  // REFUND POLICY
  refund_title: { en: `Refund Policy`, ar: `سياسة الاسترداد`, fr: `Politique de remboursement`, tr: `İade Politikası` },
  refund_s1: { en: `1. Subscription Refunds`, ar: `١. استرداد الاشتراكات`, fr: `1. Remboursements d'abonnement`, tr: `1. Abonelik İadeleri` },
  refund_s1_p: {
    en: `Monthly subscriptions are non-refundable after the billing date. Annual subscriptions may receive a pro-rated refund within 14 days of payment if the service has not been substantially used.`,
    ar: `الاشتراكات الشهرية غير قابلة للاسترداد بعد تاريخ الفوترة. قد تحصل الاشتراكات السنوية على استرداد نسبي خلال 14 يوماً من الدفع إذا لم يتم استخدام الخدمة بشكل كبير.`,
    fr: `Les abonnements mensuels ne sont pas remboursables après la date de facturation. Les abonnements annuels peuvent recevoir un remboursement au prorata dans les 14 jours si le service n'a pas été substantiellement utilisé.`,
    tr: `Aylık abonelikler fatura tarihinden sonra iade edilemez. Yıllık abonelikler, hizmet önemli ölçüde kullanılmamışsa ödeme tarihinden itibaren 14 gün içinde orantılı iade alabilir.`,
  },
  refund_s2: { en: `2. Free Trial`, ar: `٢. الفترة التجريبية المجانية`, fr: `2. Essai gratuit`, tr: `2. Ücretsiz Deneme` },
  refund_s2_p: {
    en: `We offer a 14-day free trial on paid plans. No charge occurs until the trial ends. Cancel anytime before trial expiry to avoid being charged.`,
    ar: `نقدم تجربة مجانية لمدة 14 يوماً على الخطط المدفوعة. لا يتم أي خصم حتى انتهاء التجربة. يمكن الإلغاء في أي وقت قبل انتهاء التجربة لتجنب الرسوم.`,
    fr: `Nous offrons un essai gratuit de 14 jours sur les plans payants. Aucun débit n'est effectué jusqu'à la fin de l'essai. Annulez à tout moment avant l'expiration pour éviter d'être facturé.`,
    tr: `Ücretli planlarda 14 günlük ücretsiz deneme sunuyoruz. Deneme sona erene kadar ücret alınmaz. Ücretlendirilmemek için deneme süresi dolmadan istediğiniz zaman iptal edin.`,
  },
  refund_s3: { en: `3. Service Credits`, ar: `٣. رصيد الخدمة`, fr: `3. Crédits de service`, tr: `3. Hizmet Kredileri` },
  refund_s3_p: {
    en: `If the platform experiences downtime exceeding our SLA (99.9% monthly uptime), affected customers are eligible for service credits equal to 10x the downtime duration as a percentage of their monthly fee.`,
    ar: `إذا تجاوز التوقف عن العمل اتفاقية مستوى الخدمة (99.9% وقت تشغيل شهري)، يحق للعملاء المتضررين الحصول على رصيد خدمة يعادل 10 أضعاف مدة التوقف كنسبة من رسومهم الشهرية.`,
    fr: `Si la plateforme connaît une indisponibilité dépassant notre SLA (99,9 % de disponibilité mensuelle), les clients concernés ont droit à des crédits de service égaux à 10 fois la durée de l'indisponibilité.`,
    tr: `Platform SLA sınırını aşan bir kesinti yaşarsa, etkilenen müşteriler aylık ücretlerinin yüzdesi olarak kesinti süresinin 10 katı tutarında hizmet kredisi almaya hak kazanır.`,
  },
  refund_s4: { en: `4. How to Request a Refund`, ar: `٤. كيفية طلب الاسترداد`, fr: `4. Comment demander un remboursement`, tr: `4. İade Nasıl Talep Edilir` },
  refund_s4_p: {
    en: `Email billing@waabek.com with your account email, subscription plan, reason for refund, and payment date. We respond within 3 business days.`,
    ar: `أرسل بريداً إلكترونياً إلى billing@waabek.com مع بريدك الإلكتروني للحساب، خطة الاشتراك، سبب الاسترداد، وتاريخ الدفع. نرد خلال 3 أيام عمل.`,
    fr: `Envoyez un e-mail à billing@waabek.com avec l'e-mail de votre compte, le plan d'abonnement, la raison du remboursement et la date de paiement. Nous répondons dans les 3 jours ouvrables.`,
    tr: `billing@waabek.com adresine hesap e-postanız, abonelik planınız, iade nedeniniz ve ödeme tarihinizle e-posta gönderin. 3 iş günü içinde yanıtlarız.`,
  },

  // LICENSE
  license_title: { en: `Software License`, ar: `رخصة البرنامج`, fr: `Licence du logiciel`, tr: `Yazılım Lisansı` },
  license_s1: { en: `1. Grant of License`, ar: `١. منح الرخصة`, fr: `1. Octroi de licence`, tr: `1. Lisans Verilmesi` },
  license_s1_p: {
    en: `Subject to your subscription, we grant you a limited, non-exclusive, non-transferable license to access and use WABEK solely for your internal business purposes.`,
    ar: `وفقاً لاشتراكك، نمنحك رخصة محدودة وغير حصرية وغير قابلة للتحويل للوصول إلى WABEK واستخدامه لأغراض عملك الداخلية فقط.`,
    fr: `Sous réserve de votre abonnement, nous vous accordons une licence limitée, non exclusive et non transférable pour accéder à WABEK et l'utiliser uniquement pour vos besoins internes.`,
    tr: `Aboneliğinize tabi olarak, WABEK'e yalnızca dahili iş amaçlarınız için erişmeniz ve kullanmanız için size sınırlı, münhasır olmayan, devredilemez bir lisans veriyoruz.`,
  },
  license_s2: { en: `2. Restrictions`, ar: `٢. القيود`, fr: `2. Restrictions`, tr: `2. Kısıtlamalar` },
  license_s2_p: {
    en: `You may not: copy, modify, or distribute the software; reverse engineer or decompile; create derivative works; sublicense or resell without our written consent; or remove proprietary notices.`,
    ar: `لا يجوز: نسخ البرنامج أو تعديله أو توزيعه؛ أو هندسته العكسية؛ أو إنشاء أعمال مشتقة؛ أو إعادة بيعه دون إذن كتابي منا؛ أو إزالة الإشعارات المملوكة.`,
    fr: `Vous ne pouvez pas : copier, modifier ou distribuer le logiciel ; procéder à une ingénierie inverse ; créer des oeuvres dérivées ; sous-licencier ou revendre sans notre consentement écrit ; ni supprimer les mentions propriétaires.`,
    tr: `Yazılımı kopyalayamazsınız, değiştiremezsiniz veya dağıtamazsınız. Tersine mühendislik uygulayamazsınız. Yazılı onayımız olmadan alt lisans veremez veya yeniden satamazsınız. Tescilli bildirimleri kaldıramazsınız.`,
  },
  license_s3: { en: `3. Proprietary Rights`, ar: `٣. حقوق الملكية`, fr: `3. Droits de propriété`, tr: `3. Mülkiyet Hakları` },
  license_s3_p: {
    en: `WABEK and all related intellectual property are owned by webek.org. These Terms do not transfer any ownership rights to you.`,
    ar: `WABEK وجميع الملكية الفكرية ذات الصلة مملوكة لـ webek.org. هذه الشروط لا تنقل إليك أي حقوق ملكية.`,
    fr: `WABEK et toute la propriété intellectuelle associée appartiennent à webek.org. Ces conditions ne vous transfèrent aucun droit de propriété.`,
    tr: `WABEK ve ilgili tüm fikri mülkiyet webek.org'a aittir. Bu Şartlar size herhangi bir mülkiyet hakkı devretmez.`,
  },
}

export type LegalKey = keyof typeof legalT

export function lt(lang: string, key: LegalKey): string {
  const entry = legalT[key]
  if (!entry) return key
  return (entry as any)[lang] || (entry as any)['en'] || key
}
