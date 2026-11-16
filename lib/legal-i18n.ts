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


// ─────────────────────────────────────────────────────────────────────────────
// Legal documents shown on /legal/* (text moved out of the pages).
// Every entry has English and Arabic; French and Turkish where the documents
// exist in those languages. A missing language falls back to English, never Arabic.
// ─────────────────────────────────────────────────────────────────────────────

export type LegalText = { en: string; ar: string; fr?: string; tr?: string }
export type LegalList = { en: string[]; ar: string[]; fr?: string[]; tr?: string[] }
export interface LegalDoc { text: Record<string, LegalText>; lists: Record<string, LegalList>; toc?: LegalList }
export type LegalDocId = 'privacy' | 'terms' | 'refund' | 'license' | 'accessibility' | 'index'

function pickLang<T>(v: { en: T; ar: T; fr?: T; tr?: T } | undefined, lang: string): T | undefined {
  if (!v) return undefined
  const own = (v as Record<string, T | undefined>)[lang]
  return own !== undefined ? own : v.en
}

/** Text of a legal document in the visitor's language (English fallback). */
export function legalText(doc: LegalDocId, lang: string, key: string): string {
  return pickLang(legalDocs[doc]?.text[key], lang) ?? key
}
/** Bullet list of a legal document in the visitor's language (English fallback). */
export function legalList(doc: LegalDocId, lang: string, key: string): string[] {
  return pickLang(legalDocs[doc]?.lists[key], lang) ?? []
}
/** Original "Table of contents" labels of a document, if it had one. */
export function legalToc(doc: LegalDocId, lang: string): string[] | undefined {
  return pickLang(legalDocs[doc]?.toc, lang)
}

export const legalDocs: Record<LegalDocId, LegalDoc> = {
  privacy: {
    text: {
      t1: { en: "Privacy Policy", ar: "سياسة الخصوصية", fr: "Politique de confidentialité", tr: "Gizlilik Politikası" },
      t2: { en: "Legal Document", ar: "وثيقة قانونية", fr: "Document légal", tr: "Yasal Belge" },
      t3: { en: "This policy describes how WABEK collects, stores, and uses your personal information. We take your privacy seriously.", ar: "تصف هذه السياسة كيفية جمع WABEK وتخزين واستخدام معلوماتك الشخصية. نأخذ خصوصيتك بجدية تامة.", fr: "Cette politique décrit comment WABEK collecte, stocke et utilise vos informations personnelles. Nous prenons votre vie privée très au sérieux.", tr: "Bu politika WABEK'in kişisel bilgilerinizi nasıl topladığını, sakladığını ve kullandığını açıklar." },
      t4: { en: "Last updated: January 1, 2025", ar: "آخر تحديث: ١ يناير ٢٠٢٥", fr: "Mise à jour : 1 janv. 2025", tr: "Son güncelleme: 1 Ocak 2025" },
      t5: { en: "1. Information We Collect", ar: "١. المعلومات التي نجمعها", fr: "1. Informations collectées", tr: "1. Topladığımız Bilgiler" },
      t6: { en: "Account Information", ar: "معلومات الحساب", fr: "Informations du compte", tr: "Hesap Bilgileri" },
      t7: { en: "When you create an account, we collect:", ar: "عند إنشاء حساب، نجمع:", fr: "Lors de la création d'un compte, nous collectons :", tr: "Hesap oluştururken şunları topluyoruz:" },
      t8: { en: "Usage Data", ar: "بيانات الاستخدام", fr: "Données d'utilisation", tr: "Kullanım Verileri" },
      t9: { en: "We automatically collect when you use the platform:", ar: "نجمع تلقائياً عند استخدامك للمنصة:", fr: "Nous collectons automatiquement lors de votre utilisation :", tr: "Platformu kullanırken otomatik olarak topluyoruz:" },
      t10: { en: "Contact and Message Data", ar: "بيانات جهات الاتصال والرسائل", fr: "Données de contacts et messages", tr: "Kişi ve Mesaj Verileri" },
      t11: { en: "Your data, your property.", ar: "بياناتك ملكيتك.", fr: "Vos données vous appartiennent.", tr: "Verileriniz size aittir." },
      t12: { en: "We process it on your behalf and never use it for our own purposes.", ar: "نعالجها نيابةً عنك ولا نستخدمها لأغراضنا الخاصة.", fr: "Nous la traitons en votre nom et ne l'utilisons pas à nos propres fins.", tr: "Bunu sizin adınıza işliyoruz ve kendi amaçlarımız için kullanmıyoruz." },
      t13: { en: "Payment Information", ar: "معلومات الدفع", fr: "Informations de paiement", tr: "Ödeme Bilgileri" },
      t14: { en: "Payments are processed directly by Stripe (PCI-DSS certified). We only store:", ar: "تتم المدفوعات مباشرةً بواسطة Stripe (معتمد PCI-DSS). نحفظ فقط:", fr: "Les paiements sont traités directement par Stripe (certifié PCI-DSS). Nous stockons uniquement :", tr: "Ödemeler doğrudan Stripe (PCI-DSS sertifikalı) tarafından işlenir. Yalnızca şunları saklarız:" },
      t15: { en: "2. How We Use Your Information", ar: "٢. كيف نستخدم معلوماتك", fr: "2. Utilisation de vos informations", tr: "2. Bilgilerinizi Nasıl Kullanırız" },
      t16: { en: "Explicit commitment:", ar: "التزام صريح:", fr: "Engagement explicite :", tr: "Açık taahhüt:" },
      t17: { en: "We do not sell your personal data or your contacts' data to any third party, and we do not use it for advertising targeting.", ar: "لا نبيع بياناتك الشخصية أو بيانات جهات اتصالك لأي طرف ثالث، ولا نستخدمها لاستهداف الإعلانات.", fr: "Nous ne vendons pas vos données à des tiers et ne les utilisons pas pour le ciblage publicitaire.", tr: "Kişisel verilerinizi üçüncü taraflara satmıyor ve reklam hedefleme için kullanmıyoruz." },
      t18: { en: "3. Data Sharing", ar: "٣. مشاركة البيانات", fr: "3. Partage des données", tr: "3. Veri Paylaşımı" },
      t19: { en: "We only share your data with:", ar: "نشارك بياناتك فقط مع:", fr: "Nous partageons vos données uniquement avec :", tr: "Verilerinizi yalnızca şunlarla paylaşırız:" },
      t20: { en: "payment processing (PCI-DSS certified)", ar: "معالجة المدفوعات (معتمد PCI-DSS)", fr: "traitement des paiements (certifié PCI-DSS)", tr: "ödeme işleme (PCI-DSS sertifikalı)" },
      t21: { en: "message delivery via Cloud API", ar: "تسليم الرسائل عبر Cloud API", fr: "livraison des messages via Cloud API", tr: "Cloud API aracılığıyla mesaj iletimi" },
      t22: { en: "AI features (no permanent conversation storage)", ar: "ميزات الذكاء الاصطناعي (بدون تخزين دائم)", fr: "fonctionnalités IA (sans stockage permanent)", tr: "yapay zeka özellikleri (kalıcı depolama yok)" },
      t23: { en: "Law enforcement", ar: "جهات إنفاذ القانون", fr: "Forces de l'ordre", tr: "Kolluk kuvvetleri" },
      t24: { en: "upon official legal request only", ar: "عند الطلب القانوني الرسمي فقط", fr: "sur demande légale officielle uniquement", tr: "yalnızca resmi yasal talep üzerine" },
      t25: { en: "4. Data Retention", ar: "٤. الاحتفاظ بالبيانات", fr: "4. Conservation des données", tr: "4. Veri Saklama" },
      t26: { en: "We retain your data as long as your account is active. Upon account deletion:", ar: "نحتفظ ببياناتك طالما حسابك نشط. عند حذف الحساب:", fr: "Nous conservons vos données tant que votre compte est actif. Lors de la suppression :", tr: "Hesabınız aktif olduğu sürece verilerinizi saklarız. Hesap silindiğinde:" },
      t27: { en: "5. Your Rights", ar: "٥. حقوقك", fr: "5. Vos droits", tr: "5. Haklarınız" },
      t28: { en: "Contact us at", ar: "تواصل معنا على", fr: "Contactez-nous à", tr: "Bize ulaşın:" },
      t29: { en: "— we respond within 72 hours.", ar: "— نرد خلال 72 ساعة.", fr: "— nous répondons dans les 72 heures.", tr: "— 72 saat içinde yanıt veririz." },
      t30: { en: "6. Security", ar: "٦. الأمان", fr: "6. Sécurité", tr: "6. Güvenlik" },
      t31: { en: "7. Cookies", ar: "٧. ملفات تعريف الارتباط", fr: "7. Cookies", tr: "7. Çerezler" },
      t32: { en: "We use only necessary cookies:", ar: "نستخدم ملفات تعريف الارتباط الضرورية فقط:", fr: "Nous utilisons uniquement les cookies nécessaires :", tr: "Yalnızca gerekli çerezleri kullanırız:" },
      t33: { en: "We do not use tracking or advertising cookies.", ar: "لا نستخدم ملفات تعريف الارتباط التتبعية أو الإعلانية.", fr: "Nous n'utilisons pas de cookies de suivi ou publicitaires.", tr: "İzleme veya reklam çerezleri kullanmıyoruz." },
      t34: { en: "8. Policy Updates", ar: "٨. تحديثات السياسة", fr: "8. Mises à jour", tr: "8. Politika Güncellemeleri" },
      t35: { en: "We may update this policy periodically. For significant changes, we will notify you via email and in-app notification 30 days before the changes take effect.", ar: "قد نحدّث هذه السياسة من وقت لآخر. للتغييرات الجوهرية، سنخطرك عبر البريد الإلكتروني وإشعار داخل التطبيق قبل 30 يوماً.", fr: "Nous pouvons mettre à jour cette politique. Pour les changements importants, nous vous notifierons par e-mail 30 jours avant.", tr: "Bu politikayı periyodik olarak güncelleyebiliriz. Önemli değişiklikler için değişiklikten 30 gün önce e-posta ile bilgilendireceğiz." },
      t36: { en: "9. Contact Us", ar: "٩. التواصل معنا", fr: "9. Nous contacter", tr: "9. İletişim" },
      t37: { en: "Privacy email:", ar: "بريد الخصوصية:", fr: "E-mail confidentialité :", tr: "Gizlilik e-postası:" },
      t38: { en: "Owner:", ar: "الجهة المالكة:", fr: "Propriétaire :", tr: "Sahibi:" },
      t39: { en: "WABEK is owned and operated by webek.org. All legal rights reserved to webek.org.", ar: "WABEK مملوكة وتديرها webek.org. جميع الحقوق القانونية محفوظة لـ webek.org.", fr: "WABEK est détenu et exploité par webek.org. Tous les droits légaux sont réservés à webek.org.", tr: "WABEK, webek.org tarafından sahiplenilmekte ve işletilmektedir. Tüm yasal haklar webek.org'a aittir." },
      t40: { en: "All rights reserved.", ar: "جميع الحقوق محفوظة.", fr: "Tous droits réservés.", tr: "Tüm haklar saklıdır." },
    },
    lists: {
      l1: {
        en: ["Full name and email address", "Phone number (for OTP verification)", "Password (stored as a secure hash — we never see it)", "Company name and timezone (optional)"],
        ar: ["الاسم الكامل وعنوان البريد الإلكتروني", "رقم الهاتف (للتحقق بـ OTP)", "كلمة المرور (مخزنة كـ hash آمن — لا نراها أبداً)", "اسم الشركة والمنطقة الزمنية (اختياري)"],
        fr: ["Nom complet et adresse e-mail", "Numéro de téléphone (pour OTP)", "Mot de passe (hachage sécurisé — jamais visible)", "Nom d'entreprise et fuseau horaire (optionnel)"],
        tr: ["Tam ad ve e-posta adresi", "Telefon numarası (OTP için)", "Şifre (güvenli hash — asla görünmez)", "Şirket adı ve saat dilimi (isteğe bağlı)"],
      },
      l2: {
        en: ["IP addresses, browser type, and operating system", "Pages visited and time spent on them", "Session timestamps and error logs", "API usage statistics and message counts"],
        ar: ["عناوين IP ونوع المتصفح ونظام التشغيل", "الصفحات التي تزورها والوقت المستغرق", "الطوابع الزمنية للجلسات وسجلات الأخطاء", "إحصاءات استخدام API وعدد الرسائل المرسلة"],
        fr: ["Adresses IP, type de navigateur, système d'exploitation", "Pages visitées et temps passé", "Horodatages des sessions et journaux d'erreurs", "Statistiques API et nombre de messages envoyés"],
        tr: ["IP adresleri, tarayıcı türü, işletim sistemi", "Ziyaret edilen sayfalar ve harcanan süre", "Oturum zaman damgaları ve hata günlükleri", "API istatistikleri ve gönderilen mesaj sayısı"],
      },
      l3: {
        en: ["Contacts you import or add manually", "Messages sent and received through the platform", "Campaign data and delivery statistics", "Chatbot conversations and automation flows"],
        ar: ["جهات الاتصال التي تستوردها أو تضيفها", "الرسائل المرسلة والمستقبلة عبر المنصة", "بيانات الحملات وإحصاءات التسليم", "محادثات روبوت الدردشة وتدفقات الأتمتة"],
        fr: ["Contacts importés ou ajoutés manuellement", "Messages envoyés et reçus", "Données de campagnes et statistiques de livraison", "Conversations chatbot et flux d'automatisation"],
        tr: ["İçe aktarılan veya eklenen kişiler", "Gönderilen ve alınan mesajlar", "Kampanya verileri ve teslimat istatistikleri", "Chatbot konuşmaları ve otomasyon akışları"],
      },
      l4: {
        en: ["Stripe customer ID (reference only)", "Last 4 digits and expiry date (display only)", "Invoice history and status"],
        ar: ["معرف عميل Stripe (رقم مرجعي فقط)", "آخر 4 أرقام من البطاقة وتاريخ انتهاء الصلاحية", "تاريخ الفواتير وحالتها"],
        fr: ["Identifiant client Stripe (référence uniquement)", "4 derniers chiffres et date d'expiration", "Historique et statut des factures"],
        tr: ["Stripe müşteri kimliği (yalnızca referans)", "Kartın son 4 hanesi ve son kullanma tarihi", "Fatura geçmişi ve durumu"],
      },
      l5: {
        en: ["Provide, improve, and maintain WABEK", "Send OTP codes and security notifications", "Process payments and manage subscriptions", "Respond to support requests", "Detect and prevent fraud and abuse", "Comply with legal and regulatory obligations", "Send product updates and necessary notifications"],
        ar: ["تقديم خدمة WABEK وتحسينها وصيانتها", "إرسال رموز التحقق OTP وإشعارات الأمان", "معالجة المدفوعات وإدارة الاشتراكات", "الرد على طلبات الدعم ورسائل التواصل", "اكتشاف الاحتيال وإساءة الاستخدام ومنعهما", "الامتثال للالتزامات القانونية والتنظيمية", "إرسال تحديثات المنتج والإشعارات الضرورية"],
        fr: ["Fournir, améliorer et maintenir WABEK", "Envoyer des codes OTP et notifications de sécurité", "Traiter les paiements et gérer les abonnements", "Répondre aux demandes de support", "Détecter et prévenir la fraude", "Respecter les obligations légales", "Envoyer les mises à jour produit nécessaires"],
        tr: ["WABEK'i sağlamak, geliştirmek ve sürdürmek", "OTP kodları ve güvenlik bildirimleri göndermek", "Ödemeleri işlemek ve abonelikleri yönetmek", "Destek taleplerine yanıt vermek", "Dolandırıcılığı tespit etmek ve önlemek", "Yasal yükümlülüklere uymak", "Ürün güncellemeleri ve bildirimler göndermek"],
      },
      l6: {
        en: ["Personal data deleted within 30 days", "Contacts and campaign data deleted within 30 days", "Message logs retained up to 90 days for fraud prevention", "Billing data deleted after 7 years per legal requirements"],
        ar: ["البيانات الشخصية تُحذف خلال 30 يوماً", "جهات الاتصال وبيانات الحملات خلال 30 يوماً", "سجلات الرسائل تُحتفظ حتى 90 يوماً لمنع الاحتيال", "بيانات الفواتير بعد 7 سنوات وفقاً للمتطلبات القانونية"],
        fr: ["Données personnelles supprimées dans les 30 jours", "Contacts et campagnes supprimés dans les 30 jours", "Journaux de messages conservés 90 jours max pour prévention", "Données de facturation supprimées après 7 ans (exigence légale)"],
        tr: ["Kişisel veriler 30 gün içinde silinir", "Kişiler ve kampanya verileri 30 gün içinde silinir", "Mesaj kayıtları dolandırıcılık önleme için 90 güne kadar saklanır", "Fatura verileri yasal gereğe uyarak 7 yıl sonra silinir"],
      },
      l7: {
        en: ["Right to access: export all your data from Account Settings", "Right to rectification: edit your information from your profile", "Right to erasure: permanently delete your account and all data", "Right to portability: export your data in JSON/CSV", "Right to object: unsubscribe from marketing communications"],
        ar: ["حق الوصول: تصدير جميع بياناتك من إعدادات الحساب", "حق التصحيح: تعديل معلوماتك من ملفك الشخصي", "حق الحذف: حذف حسابك وجميع بياناتك نهائياً", "حق النقل: تصدير بياناتك بتنسيق JSON/CSV", "حق الاعتراض: إلغاء الاشتراك في الاتصالات التسويقية"],
        fr: ["Droit d'accès : exportez vos données depuis les paramètres", "Droit de rectification : modifiez vos informations dans votre profil", "Droit à l'effacement : supprimez votre compte et toutes vos données", "Droit à la portabilité : exportez en JSON/CSV", "Droit d'opposition : désinscrivez-vous des communications marketing"],
        tr: ["Erişim hakkı: Hesap ayarlarından verilerinizi dışa aktarın", "Düzeltme hakkı: Bilgilerinizi profilinizden düzenleyin", "Silme hakkı: Hesabınızı ve tüm verilerinizi kalıcı olarak silin", "Taşınabilirlik hakkı: JSON/CSV olarak dışa aktarın", "İtiraz hakkı: Pazarlama iletişimlerinden çıkın"],
      },
      l8: {
        en: ["TLS 1.3 encryption for all data in transit", "AES-256 encryption for data at rest", "bcrypt password hashing (we never see your password)", "Two-factor authentication (2FA)", "Regular security audits and continuous monitoring", "Daily encrypted backups"],
        ar: ["تشفير TLS 1.3 لجميع البيانات أثناء النقل", "تشفير AES-256 للبيانات المحفوظة", "تجزئة bcrypt لكلمات المرور (لا نراها أبداً)", "مصادقة ثنائية العوامل (2FA)", "مراجعات أمنية دورية ومراقبة مستمرة", "نسخ احتياطية يومية مشفرة"],
        fr: ["Chiffrement TLS 1.3 en transit", "Chiffrement AES-256 au repos", "Hachage bcrypt des mots de passe", "Authentification à deux facteurs (2FA)", "Audits de sécurité réguliers", "Sauvegardes quotidiennes chiffrées"],
        tr: ["Transit için TLS 1.3 şifrelemesi", "Beklemedeki veriler için AES-256", "Şifre bcrypt karması", "İki faktörlü kimlik doğrulama (2FA)", "Düzenli güvenlik denetimleri", "Günlük şifreli yedeklemeler"],
      },
      l9: {
        en: ["Authentication session (expires on logout)", "Language preference and interface settings", "CSRF token for security protection"],
        ar: ["جلسة المصادقة (تنتهي عند تسجيل الخروج)", "تفضيل اللغة وإعدادات الواجهة", "رمز CSRF لحماية الأمان"],
        fr: ["Session d'authentification (expire à la déconnexion)", "Préférence de langue et paramètres", "Jeton CSRF pour la sécurité"],
        tr: ["Kimlik doğrulama oturumu (çıkışta sona erer)", "Dil tercihi ve arayüz ayarları", "Güvenlik için CSRF jetonu"],
      },
    },
    toc: {
      en: ["Information We Collect", "How We Use Your Information", "Data Sharing", "Data Retention", "Your Rights", "Security", "Cookies", "Policy Updates", "Contact Us"],
      ar: ["المعلومات التي نجمعها", "كيف نستخدم معلوماتك", "مشاركة البيانات", "الاحتفاظ بالبيانات", "حقوقك", "الأمان", "ملفات تعريف الارتباط", "تحديثات السياسة", "التواصل معنا"],
      fr: ["Informations collectées", "Utilisation", "Partage des données", "Conservation", "Vos droits", "Sécurité", "Cookies", "Mises à jour", "Nous contacter"],
      tr: ["Topladığımız Bilgiler", "Kullanım", "Veri Paylaşımı", "Saklama", "Haklarınız", "Güvenlik", "Çerezler", "Güncellemeler", "İletişim"],
    },
  },
  terms: {
    text: {
      t1: { en: "Terms of Service", ar: "شروط الخدمة", fr: "Conditions d'utilisation", tr: "Hizmet Şartları" },
      t2: { en: "Legal Document", ar: "وثيقة قانونية", fr: "Document légal", tr: "Yasal Belge" },
      t3: { en: "These terms govern your use of the WABEK platform. Please read them carefully before using the service.", ar: "تحكم هذه الشروط استخدامك لمنصة WABEK. يرجى قراءتها بعناية قبل استخدام الخدمة.", fr: "Ces conditions régissent votre utilisation de WABEK. Veuillez les lire attentivement avant d'utiliser le service.", tr: "Bu şartlar WABEK platformunu kullanımınızı düzenler. Lütfen hizmeti kullanmadan önce dikkatlice okuyun." },
      t4: { en: "Last updated: January 1, 2025", ar: "آخر تحديث: ١ يناير ٢٠٢٥", fr: "Mise à jour : 1 janv. 2025", tr: "Son güncelleme: 1 Ocak 2025" },
      t5: { en: "By using WABEK, you agree to these Terms. If you use the service on behalf of a company, you confirm that you are authorized to accept these Terms on its behalf.", ar: "باستخدامك لـ WABEK، فإنك توافق على هذه الشروط. إذا كنت تستخدم الخدمة نيابةً عن شركة، فإنك تؤكد أنك مفوض بقبول هذه الشروط باسمها.", fr: "En utilisant WABEK, vous acceptez ces conditions. Si vous utilisez le service au nom d'une entreprise, vous confirmez être autorisé à accepter ces conditions.", tr: "WABEK'i kullanarak bu Şartları kabul etmiş olursunuz. Şirketi adına kullanıyorsanız bu şartları kabul etmeye yetkili olduğunuzu onaylarsınız." },
      t6: { en: "1. Acceptance of Terms", ar: "١. قبول الشروط", fr: "1. Acceptation des conditions", tr: "1. Şartların Kabulü" },
      t7: { en: "By accessing or using WABEK, you acknowledge that you have read, understood, and agree to be bound by these Terms. These Terms are subject to periodic updates — we will notify you of significant changes 30 days before they take effect.", ar: "من خلال الوصول إلى WABEK أو استخدامه، فإنك تقر بأنك قرأت هذه الشروط وفهمتها وتوافق على الالتزام بها. تخضع هذه الشروط للتحديث الدوري — سنبلغك بالتغييرات الجوهرية قبل 30 يوماً.", fr: "En accédant à WABEK ou en l'utilisant, vous reconnaissez avoir lu et accepté ces conditions. Elles peuvent être mises à jour — nous vous notifierons 30 jours avant.", tr: "WABEK'e erişerek bu Şartları okuduğunuzu ve kabul ettiğinizi onaylarsınız. Önemli değişiklikler için 30 gün önceden bildirim yapılır." },
      t8: { en: "2. Service Description", ar: "٢. وصف الخدمة", fr: "2. Description du service", tr: "2. Hizmet Tanımı" },
      t9: { en: "WABEK is a comprehensive WhatsApp Business management SaaS platform owned and operated by webek.org. The platform enables:", ar: "WABEK هي منصة SaaS متكاملة لإدارة واتساب للأعمال مملوكة وتديرها webek.org. تتيح المنصة:", fr: "WABEK est une plateforme SaaS complète de gestion WhatsApp Business, détenue et exploitée par webek.org. La plateforme permet :", tr: "WABEK, webek.org tarafından sahiplenilen ve işletilen kapsamlı bir WhatsApp Business SaaS platformudur. Platform şunlara olanak tanır:" },
      t10: { en: "3. Acceptable Use", ar: "٣. الاستخدام المقبول", fr: "3. Utilisation acceptable", tr: "3. Kabul Edilebilir Kullanım" },
      t11: { en: "The following is prohibited:", ar: "يُحظر ما يلي:", fr: "Les actions suivantes sont interdites :", tr: "Aşağıdakiler yasaktır:" },
      t12: { en: "Violations may result in immediate account suspension and reporting WhatsApp-related violations to Meta.", ar: "انتهاك هذه القواعد قد يؤدي إلى تعليق الحساب فوراً وإبلاغ Meta بالانتهاكات المتعلقة بواتساب.", fr: "Les violations peuvent entraîner la suspension immédiate du compte et le signalement à Meta.", tr: "İhlaller, hesabın derhal askıya alınmasına ve Meta'ya bildirilmesine yol açabilir." },
      t13: { en: "4. Account Responsibility", ar: "٤. مسؤولية الحساب", fr: "4. Responsabilité du compte", tr: "4. Hesap Sorumluluğu" },
      t14: { en: "5. WhatsApp Compliance", ar: "٥. الامتثال لسياسات واتساب", fr: "5. Conformité WhatsApp", tr: "5. WhatsApp Uyumluluğu" },
      t15: { en: "Using WABEK requires full compliance with Meta's WhatsApp Business policies:", ar: "استخدام WABEK يلزمك بالامتثال التام لسياسات Meta:", fr: "L'utilisation de WABEK exige le plein respect des politiques Meta :", tr: "WABEK kullanımı Meta politikalarına tam uyumu zorunlu kılar:" },
      t16: { en: "You bear full responsibility for compliance. If Meta suspends your number due to your own violations, webek.org is not liable.", ar: "أنت تتحمل المسؤولية الكاملة عن الامتثال. إذا علّقت Meta رقمك بسبب انتهاكاتك، لا تتحمل webek.org أي مسؤولية.", fr: "Vous assumez l'entière responsabilité. Si Meta suspend votre numéro suite à vos violations, webek.org n'est pas responsable.", tr: "Uyum konusunda tam sorumluluk size aittir. Meta kendi ihlalleriniz nedeniyle numaranızı askıya alırsa webek.org sorumlu değildir." },
      t17: { en: "6. Service Availability", ar: "٦. توافر الخدمة", fr: "6. Disponibilité du service", tr: "6. Hizmet Kullanılabilirliği" },
      t18: { en: "We target 99.9% monthly uptime. Our SLA includes:", ar: "نستهدف توافراً بنسبة 99.9% شهرياً. تشمل اتفاقية SLA لدينا:", fr: "Nous visons 99,9 % de disponibilité mensuelle. Notre SLA comprend :", tr: "Aylık %99,9 çalışma süresi hedefliyoruz. SLA'mız şunları içerir:" },
      t19: { en: "7. Subscriptions and Billing", ar: "٧. الاشتراكات والفواتير", fr: "7. Abonnements et facturation", tr: "7. Abonelikler ve Faturalandırma" },
      t20: { en: "8. Limitation of Liability", ar: "٨. حدود المسؤولية", fr: "8. Limitation de responsabilité", tr: "8. Sorumluluk Sınırlaması" },
      t21: { en: "9. Termination", ar: "٩. الإنهاء", fr: "9. Résiliation", tr: "9. Fesih" },
      t22: { en: "10. Governing Law", ar: "١٠. القانون الحاكم", fr: "10. Droit applicable", tr: "10. Yürürlükteki Hukuk" },
      t23: { en: "These Terms are governed by applicable international law. Disputes shall first seek amicable resolution within 30 days, then through binding arbitration.", ar: "تخضع هذه الشروط للقانون الدولي المعمول به. تسعى النزاعات أولاً للتسوية الودية خلال 30 يوماً، ثم من خلال التحكيم الملزم.", fr: "Ces conditions sont régies par le droit international applicable. Les litiges cherchent d'abord un règlement amiable dans les 30 jours, puis par arbitrage contraignant.", tr: "Bu Şartlar geçerli uluslararası hukuka tabidir. Anlaşmazlıklar önce 30 gün içinde dostane çözüm arar, ardından bağlayıcı tahkime gider." },
      t24: { en: "All legal rights reserved.", ar: "جميع الحقوق القانونية محفوظة.", fr: "Tous les droits légaux réservés.", tr: "Tüm yasal haklar saklıdır." },
      t25: { en: "All rights reserved.", ar: "جميع الحقوق محفوظة.", fr: "Tous droits réservés.", tr: "Tüm haklar saklıdır." },
    },
    lists: {
      l1: {
        en: ["Sending personalized bulk WhatsApp campaigns", "Building chatbots without writing code", "Managing a shared team inbox", "Automating customer journeys and auto-replies", "Detailed analytics and reporting", "Integration with Wix, WordPress, WHMCS, and more"],
        ar: ["إرسال حملات رسائل واتساب الجماعية المخصصة", "بناء روبوتات دردشة بدون كتابة كود", "إدارة صندوق وارد مشترك لفريق العمل", "أتمتة رحلات العملاء والردود التلقائية", "التحليلات والتقارير المفصلة", "التكامل مع Wix وWordPress وWHMCS وغيرها"],
        fr: ["Envoi de campagnes WhatsApp personnalisées", "Création de chatbots sans code", "Gestion d'une boite de réception partagée", "Automatisation des parcours clients", "Analyses et rapports détaillés", "Intégration avec Wix, WordPress, WHMCS et plus"],
        tr: ["Toplu kişiselleştirilmiş WhatsApp kampanyaları", "Kodsuz chatbot oluşturma", "Ekip paylaşımlı gelen kutusu yönetimi", "Müşteri yolculuklarını otomatikleştirme", "Ayrıntılı analitik ve raporlama", "Wix, WordPress, WHMCS entegrasyonu"],
      },
      l2: {
        en: ["Sending spam without explicit consent", "Violating Meta WhatsApp Business policies", "Distributing harmful or illegal content", "Attempting to breach platform systems", "Impersonating other individuals or organizations", "Reselling the service without an official reseller agreement"],
        ar: ["إرسال رسائل غير مرغوب فيها بدون موافقة صريحة", "انتهاك سياسات واتساب للأعمال من Meta", "توزيع محتوى ضار أو مسيء أو غير قانوني", "محاولة اختراق أنظمة المنصة", "انتحال هوية أشخاص أو مؤسسات أخرى", "إعادة بيع الخدمة بدون اتفاقية موزع رسمية"],
        fr: ["Envoyer du spam sans consentement explicite", "Violer les politiques WhatsApp Business de Meta", "Distribuer du contenu nuisible ou illégal", "Tenter de pirater les systèmes de la plateforme", "Usurper l'identité d'autres personnes", "Revendre le service sans accord revendeur officiel"],
        tr: ["Onay olmadan spam göndermek", "Meta WhatsApp Business politikalarını ihlal etmek", "Zararlı veya yasa dışı içerik dağıtmak", "Platform sistemlerine saldırı girişiminde bulunmak", "Başkalarının kimliğine bürünmek", "Resmi bayi sözleşmesi olmadan hizmeti yeniden satmak"],
      },
      l3: {
        en: ["Maintaining the confidentiality of your login credentials", "Enabling two-factor authentication (2FA)", "Notifying us immediately at security@waabek.com of any breach", "Ensuring your team complies with these Terms", "Obtaining recipients' consent before sending any messages"],
        ar: ["الحفاظ على سرية بيانات تسجيل الدخول", "تفعيل المصادقة الثنائية (2FA)", "إبلاغنا فوراً على security@waabek.com عند الاختراق", "ضمان امتثال فريقك لهذه الشروط", "الحصول على موافقة المستلمين قبل إرسال أي رسائل"],
        fr: ["Maintenir la confidentialité de vos identifiants", "Activer l'authentification à deux facteurs (2FA)", "Nous informer immédiatement à security@waabek.com en cas de violation", "S'assurer que votre équipe respecte ces conditions", "Obtenir le consentement des destinataires avant tout envoi"],
        tr: ["Giriş bilgilerinin gizliliğini korumak", "İki faktörlü kimlik doğrulamayı (2FA) etkinleştirmek", "İhlal durumunda security@waabek.com'a derhal bildirmek", "Ekibinizin bu şartlara uymasını sağlamak", "Mesaj göndermeden önce alıcıların rızasını almak"],
      },
      l4: {
        en: ["48-hour advance notice for scheduled maintenance", "Live status page at waabek.com/status", "10x service credit for any SLA breach"],
        ar: ["إشعار مسبق بـ 48 ساعة للصيانة المجدولة", "صفحة حالة مباشرة على waabek.com/status", "رصيد خدمة 10x لأي تجاوز لاتفاقية SLA"],
        fr: ["Préavis de 48 heures pour la maintenance planifiée", "Page de statut en direct sur waabek.com/status", "Crédit service 10x pour tout dépassement du SLA"],
        tr: ["Planlı bakım için 48 saat önceden bildirim", "waabek.com/status'ta canlı durum sayfası", "SLA aşımı için 10x hizmet kredisi"],
      },
      l5: {
        en: ["Subscriptions auto-renew at the end of each billing cycle", "Cancellation available at any time from Account Settings", "Upgrades take effect immediately, downgrades at cycle end", "Price changes with 30 days advance notice"],
        ar: ["تُجدد الاشتراكات تلقائياً في نهاية كل دورة فوترة", "يمكن الإلغاء في أي وقت من إعدادات الحساب", "الترقية تسري فوراً، التخفيض في نهاية الدورة الحالية", "الأسعار قابلة للتغيير مع إشعار مسبق 30 يوماً"],
        fr: ["Les abonnements se renouvellent automatiquement", "Annulation possible à tout moment depuis les paramètres", "Mise à niveau immédiate, rétrogradation en fin de cycle", "Changements de prix avec préavis de 30 jours"],
        tr: ["Abonelikler otomatik olarak yenilenir", "Hesap ayarlarından istediğiniz zaman iptal edilebilir", "Yükseltme hemen, düşürme mevcut dönem sonunda", "Fiyat değişiklikleri 30 gün önceden bildirilir"],
      },
      l6: {
        en: ["Our total liability is limited to fees paid in the last 3 months", "We are not liable for indirect, incidental, or consequential damages", "We are not liable for WhatsApp service interruptions outside our control", "We are not liable for the content of messages you send"],
        ar: ["مسؤوليتنا الإجمالية تقتصر على رسوم الـ 3 أشهر الأخيرة", "لسنا مسؤولين عن الأضرار غير المباشرة أو العرضية", "لسنا مسؤولين عن انقطاع خدمة واتساب خارج عن سيطرتنا", "لسنا مسؤولين عن محتوى الرسائل التي ترسلها"],
        fr: ["Notre responsabilité totale est limitée aux frais des 3 derniers mois", "Nous ne sommes pas responsables des dommages indirects", "Nous ne sommes pas responsables des interruptions WhatsApp", "Nous ne sommes pas responsables du contenu de vos messages"],
        tr: ["Toplam sorumluluğumuz son 3 ayın ücretleriyle sınırlıdır", "Dolaylı veya sonuçsal zararlardan sorumlu değiliz", "WhatsApp hizmet kesintilerinden sorumlu değiliz", "Gönderdiğiniz mesajların içeriğinden sorumlu değiliz"],
      },
      l7: {
        en: ["You can cancel your account at any time from Account Settings", "We reserve the right to suspend accounts that violate these Terms without prior notice", "Upon termination, your data is exportable for 30 days then permanently deleted"],
        ar: ["يمكنك إلغاء حسابك في أي وقت من إعدادات الحساب", "نحتفظ بحق تعليق الحسابات المنتهكة دون إشعار مسبق", "عند الإنهاء، بياناتك متاحة للتصدير 30 يوماً ثم تُحذف نهائياً"],
        fr: ["Vous pouvez annuler votre compte à tout moment", "Nous nous réservons le droit de suspendre les comptes en violation", "Lors de la résiliation, vos données sont exportables pendant 30 jours puis supprimées"],
        tr: ["Hesabınızı istediğiniz zaman iptal edebilirsiniz", "İhlal eden hesapları askıya alma hakkını saklı tutarız", "Fesih sonrası verileriniz 30 gün dışa aktarılabilir, ardından silinir"],
      },
    },
    toc: {
      en: ["Acceptance of Terms", "Service Description", "Acceptable Use", "Account Responsibility", "WhatsApp Compliance", "Service Availability", "Subscriptions and Billing", "Limitation of Liability", "Termination", "Governing Law"],
      ar: ["قبول الشروط", "وصف الخدمة", "الاستخدام المقبول", "مسؤولية الحساب", "الامتثال لواتساب", "توافر الخدمة", "الاشتراكات والفواتير", "حدود المسؤولية", "الإنهاء", "القانون الحاكم"],
      fr: ["Acceptation", "Description du service", "Utilisation acceptable", "Responsabilité du compte", "Conformité WhatsApp", "Disponibilité", "Abonnements", "Limitation de responsabilité", "Résiliation", "Droit applicable"],
      tr: ["Kabul", "Hizmet Tanımı", "Kabul Edilebilir Kullanım", "Hesap Sorumluluğu", "WhatsApp Uyumluluğu", "Kullanılabilirlik", "Abonelikler", "Sorumluluk Sınırlaması", "Fesih", "Yürürlükteki Hukuk"],
    },
  },
  refund: {
    text: {
      t1: { en: "Refund Policy", ar: "سياسة الاسترداد", fr: "Politique de remboursement", tr: "İade Politikası" },
      t2: { en: "Legal Document", ar: "وثيقة قانونية", fr: "Document légal", tr: "Yasal Belge" },
      t3: { en: "We want you to be fully satisfied. Here is our clear refund policy.", ar: "نريدك أن تكون راضياً تماماً. إليك سياستنا الواضحة للاسترداد.", fr: "Nous voulons que vous soyez entièrement satisfait. Voici notre politique claire de remboursement.", tr: "Tamamen memnun olmanızı istiyoruz. İşte açık iade politikamız." },
      t4: { en: "Last updated: January 1, 2025", ar: "آخر تحديث: ١ يناير ٢٠٢٥", fr: "Mise à jour : 1 janv. 2025", tr: "Son güncelleme: 1 Ocak 2025" },
      t5: { en: "Refund Summary", ar: "ملخص سياسة الاسترداد", fr: "Résumé des remboursements", tr: "İade Özeti" },
      t6: { en: "Subscription Type", ar: "نوع الاشتراك", fr: "Type d'abonnement", tr: "Abonelik Türü" },
      t7: { en: "Refund Policy", ar: "سياسة الاسترداد", fr: "Politique", tr: "İade Politikası" },
      t8: { en: "Window", ar: "المهلة", fr: "Délai", tr: "Süre" },
      t9: { en: "Monthly", ar: "شهري", fr: "Mensuel", tr: "Aylık" },
      t10: { en: "Non-refundable", ar: "غير قابل للاسترداد", fr: "Non remboursable", tr: "İade edilemez" },
      t11: { en: "Annual", ar: "سنوي", fr: "Annuel", tr: "Yıllık" },
      t12: { en: "Pro-rated refund", ar: "استرداد نسبي", fr: "Remboursement au prorata", tr: "Orantılı iade" },
      t13: { en: "14 days", ar: "14 يوماً", fr: "14 jours", tr: "14 gün" },
      t14: { en: "Free trial", ar: "تجربة مجانية", fr: "Essai gratuit", tr: "Ücretsiz deneme" },
      t15: { en: "No charge", ar: "لا توجد رسوم", fr: "Aucun frais", tr: "Ücret yok" },
      t16: { en: "SLA breach", ar: "تجاوز SLA", fr: "Dépassement SLA", tr: "SLA aşımı" },
      t17: { en: "Service credit 10x", ar: "رصيد خدمة 10x", fr: "Crédit service 10x", tr: "Hizmet kredisi 10x" },
      t18: { en: "Automatic", ar: "تلقائي", fr: "Automatique", tr: "Otomatik" },
      t19: { en: "1. Free Trial Period", ar: "١. الفترة التجريبية المجانية", fr: "1. Période d'essai gratuit", tr: "1. Ücretsiz Deneme Dönemi" },
      t20: { en: "2. Monthly Subscription Refunds", ar: "٢. استرداد الاشتراكات الشهرية", fr: "2. Remboursements mensuels", tr: "2. Aylık Abonelik İadeleri" },
      t21: { en: "Monthly subscriptions are non-refundable after the billing date. Exceptions:", ar: "الاشتراكات الشهرية غير قابلة للاسترداد بعد تاريخ الفوترة. استثناءات:", fr: "Les abonnements mensuels ne sont pas remboursables après la date de facturation. Exceptions :", tr: "Aylık abonelikler fatura tarihinden sonra iade edilemez. İstisnalar:" },
      t22: { en: "3. Annual Subscription Refunds", ar: "٣. استرداد الاشتراكات السنوية", fr: "3. Remboursements annuels", tr: "3. Yıllık Abonelik İadeleri" },
      t23: { en: "Pro-rated refund available within 14 days of payment if:", ar: "استرداد نسبي متاح خلال 14 يوماً من الدفع إذا:", fr: "Remboursement au prorata disponible dans les 14 jours si :", tr: "Ödeme tarihinden itibaren 14 gün içinde orantılı iade şu durumda:" },
      t24: { en: "4. Service Credits (SLA)", ar: "٤. رصيد الخدمة (SLA)", fr: "4. Crédits de service (SLA)", tr: "4. Hizmet Kredisi (SLA)" },
      t25: { en: "If downtime exceeds our SLA (99.9% monthly = less than 44 min of interruption):", ar: "إذا تجاوز التوقف حد SLA (99.9% شهرياً = أقل من 44 دقيقة):", fr: "Si le temps d'arrêt dépasse notre SLA (99,9 % mensuel = moins de 44 min) :", tr: "Kesinti SLA sınırını aşarsa (aylık %99,9 = 44 dakikadan az):" },
      t26: { en: "5. How to Request a Refund", ar: "٥. كيفية طلب الاسترداد", fr: "5. Comment demander un remboursement", tr: "5. İade Nasıl Talep Edilir" },
      t27: { en: "Email", ar: "أرسل بريداً إلى", fr: "Envoyez un e-mail à", tr: "E-posta gönderin:" },
      t28: { en: "with:", ar: "مع:", fr: "avec :", tr: "ile:" },
      t29: { en: "We respond to all refund requests within 3 business days. If approved, the refund is processed within 5-10 business days.", ar: "نرد على جميع طلبات الاسترداد خلال 3 أيام عمل. عند الموافقة، يُعالج الاسترداد خلال 5-10 أيام عمل.", fr: "Nous répondons dans les 3 jours ouvrables. Si approuvé, le remboursement est traité dans les 5 à 10 jours ouvrables.", tr: "Tüm taleplere 3 iş günü içinde yanıt veriyoruz. Onaylanırsa 5-10 iş günü içinde işlenir." },
      t30: { en: "All rights reserved.", ar: "جميع الحقوق محفوظة.", fr: "Tous droits réservés.", tr: "Tüm haklar saklıdır." },
    },
    lists: {
      l1: {
        en: ["No charge during the 14-day trial period", "Full access to all features of the selected plan", "Free cancellation at any time during the trial", "Automatic conversion to paid plan if not cancelled"],
        ar: ["لا يتم خصم أي مبلغ خلال فترة التجربة (14 يوماً)", "وصول كامل لجميع ميزات الخطة المختارة", "إلغاء مجاني في أي وقت خلال فترة التجربة", "تحويل تلقائي إلى الخطة المدفوعة إذا لم يُلغ الاشتراك"],
        fr: ["Aucun frais pendant la période d'essai (14 jours)", "Accès complet à toutes les fonctionnalités", "Annulation gratuite à tout moment pendant l'essai", "Conversion automatique au plan payant si non annulé"],
        tr: ["Deneme süresi boyunca (14 gün) ücret alınmaz", "Seçilen planın tüm özelliklerine tam erişim", "Deneme süresince ücretsiz iptal", "İptal edilmezse otomatik olarak ücretli plana geçiş"],
      },
      l2: {
        en: ["A technical error on our side that affected your access for more than 72 hours", "Duplicate charges due to a system error", "Account subscribed accidentally and reported within 48 hours"],
        ar: ["خطأ فني من جانبنا أثر على وصولك للخدمة أكثر من 72 ساعة", "رسوم مكررة بسبب خطأ في النظام", "حساب اشترك به بشكل غير مقصود وأُبلغ عنه خلال 48 ساعة"],
        fr: ["Erreur technique de notre côté ayant affecté votre accès plus de 72 heures", "Frais en double dûs à une erreur système", "Compte souscrit accidentellement signalé dans les 48 heures"],
        tr: ["Hizmete erişiminizi 72 saatten fazla etkileyen teknik hata", "Sistem hatası nedeniyle mükerrer ücretlendirme", "48 saat içinde bildirilen yanlışlıkla abone olunan hesap"],
      },
      l3: {
        en: ["Request within 14 days of payment date", "Less than 100 messages sent (non-substantial use)", "No violation of Terms of Service", "Calculation: (remaining months / 12) × amount paid"],
        ar: ["طلب الاسترداد خلال 14 يوماً من الدفع", "أقل من 100 رسالة مرسلة (استخدام غير جوهري)", "لا توجد انتهاكات لشروط الخدمة", "صيغة الاسترداد: (الأشهر المتبقية / 12) × المبلغ المدفوع"],
        fr: ["Demande dans les 14 jours suivant le paiement", "Moins de 100 messages envoyés (utilisation non substantielle)", "Aucune violation des conditions", "Calcul : (mois restants / 12) × montant payé"],
        tr: ["Ödeme tarihinden itibaren 14 gün içinde talep", "100'den az mesaj gönderilmiş (önemli kullanım yok)", "Hizmet şartları ihlali yok", "Hesaplama: (kalan aylar / 12) × ödenen tutar"],
      },
      l4: {
        en: ["Service credit of 10x the excess duration as a % of your monthly fee", "Applied automatically to your next invoice", "Not convertible to cash", "Credit notification within 24 hours of incident closure"],
        ar: ["رصيد خدمة 10x مدة التجاوز كنسبة من رسومك الشهرية", "يُطبق تلقائياً على فاتورتك التالية", "لا يُحول إلى نقد", "إشعار بالرصيد خلال 24 ساعة من إغلاق الحادث"],
        fr: ["Crédit 10x la durée du dépassement en % de vos frais mensuels", "Appliqué automatiquement sur la prochaine facture", "Non convertible en espèces", "Notification dans les 24 heures suivant la clôture de l'incident"],
        tr: ["Aylık ücretin yüzdesi olarak fazlalık süresinin 10 katı kredi", "Bir sonraki faturaya otomatik uygulanır", "Nakde çevrilemez", "Olay kapandıktan sonra 24 saat içinde bildirim"],
      },
      l5: {
        en: ["Account email address", "Subscription type and payment date", "Stripe transaction ID", "Reason for the refund request"],
        ar: ["عنوان البريد الإلكتروني للحساب", "نوع الاشتراك وتاريخ الدفع", "رقم معرف المعاملة من Stripe", "سبب طلب الاسترداد"],
        fr: ["Adresse e-mail du compte", "Type d'abonnement et date de paiement", "Identifiant de transaction Stripe", "Raison de la demande"],
        tr: ["Hesap e-posta adresi", "Abonelik türü ve ödeme tarihi", "Stripe işlem kimliği", "İade talebinin nedeni"],
      },
    },
  },
  license: {
    text: {
      t1: { en: "Software License", ar: "رخصة البرنامج", fr: "Licence du logiciel", tr: "Yazılım Lisansı" },
      t2: { en: "Proprietary Software", ar: "برنامج مملوك", fr: "Logiciel propriétaire", tr: "Tescilli Yazılım" },
      t3: { en: "WABEK is proprietary software owned by webek.org. Read this license carefully before using the software.", ar: "WABEK برنامج مملوك لـ webek.org. اقرأ هذه الرخصة بعناية قبل استخدام البرنامج.", fr: "WABEK est un logiciel propriétaire appartenant à webek.org. Lisez attentivement cette licence avant d'utiliser le logiciel.", tr: "WABEK, webek.org'a ait tescilli bir yazılımdır. Yazılımı kullanmadan önce bu lisansı dikkatlice okuyun." },
      t4: { en: "Last updated: January 1, 2025", ar: "آخر تحديث: ١ يناير ٢٠٢٥", fr: "Mise à jour : 1 janv. 2025", tr: "Son güncelleme: 1 Ocak 2025" },
      t5: { en: "WABEK is entirely owned by", ar: "WABEK مملوكة بالكامل لـ", fr: "WABEK est entièrement détenu par", tr: "WABEK tamamen şuna aittir" },
      t6: { en: "All intellectual, commercial, and legal rights reserved", ar: "جميع الحقوق الفكرية والتجارية والقانونية محفوظة", fr: "Tous les droits intellectuels, commerciaux et juridiques réservés", tr: "Tüm fikri, ticari ve yasal haklar saklıdır" },
      t7: { en: "1. Grant of License", ar: "١. منح الرخصة", fr: "1. Octroi de licence", tr: "1. Lisans Verilmesi" },
      t8: { en: "Subject to your active subscription, webek.org grants you a license that is:", ar: "وفقاً لاشتراكك النشط، تمنحك webek.org رخصة:", fr: "Sous réserve de votre abonnement actif, webek.org vous accorde une licence qui est :", tr: "Aktif aboneliğinize tabi olarak webek.org size şu lisansı verir:" },
      t9: { en: "2. Restrictions", ar: "٢. القيود الصريحة", fr: "2. Restrictions explicites", tr: "2. Kısıtlamalar" },
      t10: { en: "The following are expressly prohibited without prior written permission from webek.org:", ar: "يُحظر صراحةً ما يلي دون إذن خطي مسبق من webek.org:", fr: "Les actions suivantes sont expressément interdites sans autorisation écrite préalable de webek.org :", tr: "Aşağıdakiler webek.org'dan önceden yazılı izin olmaksızın açıkça yasaktır:" },
      t11: { en: "Violating these restrictions exposes you to legal liability and may result in legal action by webek.org.", ar: "انتهاك هذه القيود يعرضك للمساءلة القانونية وقد يؤدي إلى إجراءات قانونية من webek.org.", fr: "La violation de ces restrictions vous expose à des poursuites judiciaires par webek.org.", tr: "Bu kısıtlamaların ihlali webek.org tarafından yasal işlem başlatılmasına yol açabilir." },
      t12: { en: "3. Intellectual Property", ar: "٣. الملكية الفكرية", fr: "3. Propriété intellectuelle", tr: "3. Fikri Mülkiyet" },
      t13: { en: "All intellectual property rights in WABEK are entirely owned by webek.org, including:", ar: "جميع حقوق الملكية الفكرية في WABEK مملوكة بالكامل لـ webek.org، وتشمل:", fr: "Tous les droits de propriété intellectuelle sur WABEK appartiennent entièrement à webek.org, notamment :", tr: "WABEK'deki tüm fikri mülkiyet hakları webek.org'a tamamen aittir:" },
      t14: { en: "4. User Data", ar: "٤. بيانات المستخدم", fr: "4. Données utilisateur", tr: "4. Kullanıcı Verileri" },
      t15: { en: "The data you create and import into WABEK belongs to you. You grant us a limited license to process this data solely to provide the service. You can export your data at any time. Upon account termination, your data is deleted within 30 days.", ar: "البيانات التي تنشئها وتستوردها في WABEK تخصك أنت. تمنحنا رخصة محدودة لمعالجة هذه البيانات لغرض تقديم الخدمة فقط. يمكنك تصدير بياناتك في أي وقت. عند إنهاء الحساب، تُحذف بياناتك خلال 30 يوماً.", fr: "Les données que vous créez dans WABEK vous appartiennent. Vous nous accordez une licence limitée pour les traiter dans le seul but de fournir le service. Exportez vos données à tout moment. Elles sont supprimées dans les 30 jours suivant la résiliation.", tr: "WABEK'e aktardığınız veriler size aittir. Yalnızca hizmet sunmak için bu verileri işlememiz için sınırlı lisans verirsiniz. Verilerinizi istediğiniz zaman dışa aktarabilirsiniz. Hesap feshinde 30 gün içinde silinir." },
      t16: { en: "5. Reseller Program", ar: "٥. برنامج الموزعين", fr: "5. Programme revendeurs", tr: "5. Bayi Programı" },
      t17: { en: "Organizations wishing to resell WABEK or offer it under their own brand (White Label) can apply for an official reseller license. Contact:", ar: "المؤسسات الراغبة في إعادة بيع WABEK أو تقديمه تحت علامتها (White Label) يمكنها التقدم لرخصة موزع. تواصل مع:", fr: "Les organisations souhaitant revendre WABEK sous leur marque peuvent demander une licence revendeur. Contactez :", tr: "WABEK'i kendi markası altında yeniden satmak isteyen kuruluşlar bayi lisansı başvurusunda bulunabilir. İletişim:" },
      t18: { en: "Resellers get: custom domain and logo, independent pricing, unified dashboard, direct support from webek.org, and early access to new features.", ar: "يحصل الموزعون على: نطاق وشعار مخصص، تسعير مستقل، لوحة تحكم موحدة، دعم مباشر من webek.org، ووصول مبكر للميزات.", fr: "Les revendeurs bénéficient : domaine et logo personnalisés, tarification indépendante, tableau de bord unifié, support direct webek.org, et accès anticipé aux nouvelles fonctionnalités.", tr: "Bayiler şunlara sahip olur: özel domain ve logo, bağımsız fiyatlandırma, birleşik panel, webek.org'dan doğrudan destek ve yeni özelliklere erken erişim." },
      t19: { en: "6. License Termination", ar: "٦. إنهاء الرخصة", fr: "6. Résiliation de la licence", tr: "6. Lisans Feshi" },
      t20: { en: "This license terminates automatically and immediately if:", ar: "تنتهي هذه الرخصة تلقائياً وفوراً إذا:", fr: "Cette licence se termine automatiquement et immédiatement si :", tr: "Bu lisans otomatik olarak ve derhal sona erer:" },
      t21: { en: "Proprietary software. All rights reserved.", ar: "برنامج مملوك. جميع الحقوق محفوظة.", fr: "Logiciel propriétaire. Tous droits réservés.", tr: "Tescilli yazılım. Tüm haklar saklıdır." },
      t22: { en: "Unauthorized use is prohibited and subject to legal prosecution.", ar: "الاستخدام غير المصرح به محظور ويخضع للملاحقة القانونية.", fr: "Toute utilisation non autorisée est interdite et passible de poursuites judiciaires.", tr: "Yetkisiz kullanım yasaktır ve yasal kovuşturmaya konu olabilir." },
    },
    lists: {
      l1: {
        en: ["Limited: restricted to what is expressly permitted", "Non-exclusive: similar licenses may be granted to others", "Non-transferable: you cannot transfer it to a third party", "Revocable: terminated upon violation of the Terms", "Personal: for your internal business use only"],
        ar: ["محدودة: تقتصر على ما هو مسموح به صراحةً", "غير حصرية: يمكن منح رخص مماثلة لآخرين", "غير قابلة للتحويل: لا يمكنك نقلها", "قابلة للإلغاء: تنتهي عند انتهاك الشروط", "شخصية: للاستخدام الداخلي لعملك فقط"],
        fr: ["Limitée : restreinte à ce qui est expressément autorisé", "Non exclusive : des licences similaires peuvent être accordées à d'autres", "Non transférable : vous ne pouvez pas la transférer", "Révocable : annulée en cas de violation", "Personnelle : pour votre usage interne uniquement"],
        tr: ["Sınırlı: Açıkça izin verilenlerle kısıtlı", "Münhasır olmayan: Benzer lisanslar başkalarına da verilebilir", "Devredilemez: Üçüncü tarafa devredemezsiniz", "İptal edilebilir: Şart ihlalinde iptal edilir", "Kişisel: Yalnızca dahili iş kullanımı için"],
      },
      l2: {
        en: ["Copying, distributing, or transmitting the software", "Reverse engineering or attempting to extract the source code", "Creating derivative products or services", "Selling or reselling the software", "Removing or modifying any proprietary notices", "Using the software to build a direct competing product", "Directly accessing databases bypassing the official API"],
        ar: ["نسخ البرنامج أو توزيعه أو نقله", "الهندسة العكسية أو محاولة استخراج الكود المصدري", "إنشاء منتجات أو خدمات مشتقة", "بيع أو إعادة بيع البرنامج", "إزالة أو تعديل أي علامات ملكية أو حقوق نشر", "استخدام البرنامج لبناء منتج منافس مباشر", "الوصول المباشر لقواعد البيانات متجاوزاً API الرسمي"],
        fr: ["Copier, distribuer ou transmettre le logiciel", "Procéder à une ingénierie inverse ou tenter d'extraire le code source", "Créer des produits ou services dérivés", "Vendre ou revendre le logiciel", "Supprimer ou modifier les mentions de propriété", "Utiliser le logiciel pour créer un produit concurrent", "Accéder directement aux bases de données en contournant l'API officielle"],
        tr: ["Yazılımı kopyalamak, dağıtmak veya iletmek", "Tersine mühendislik uygulamak veya kaynak kodu çıkarmak", "Türev ürünler veya hizmetler oluşturmak", "Yazılımı satmak veya yeniden satmak", "Mülkiyet bildirimlerini kaldırmak veya değiştirmek", "Rakip ürün oluşturmak için yazılımı kullanmak", "Resmi API'yi atlatarak veritabanlarına doğrudan erişmek"],
      },
      l3: {
        en: ["Source code, databases, and algorithms", "Design, interface, and visual experience", "Documentation, guides, and educational content", "Trademarks, logos, and product names", "Trade secrets and proprietary know-how"],
        ar: ["الكود المصدري وقواعد البيانات والخوارزميات", "التصميم والواجهة والتجربة البصرية", "الوثائق والأدلة والمحتوى التعليمي", "العلامات التجارية والشعارات وأسماء المنتجات", "الأسرار التجارية والمعرفة الخاصة"],
        fr: ["Code source, bases de données et algorithmes", "Design, interface et expérience visuelle", "Documentation, guides et contenu éducatif", "Marques déposées, logos et noms de produits", "Secrets commerciaux et savoir-faire propriétaire"],
        tr: ["Kaynak kodu, veritabanları ve algoritmalar", "Tasarım, arayüz ve görsel deneyim", "Belgeler, kılavuzlar ve eğitim içeriği", "Ticari markalar, logolar ve ürün adları", "Ticari sırlar ve tescilli bilgi birikimi"],
      },
      l4: {
        en: ["Your subscription expires or is cancelled without renewal", "Violation of any of the restrictions mentioned", "Termination of your account for violating Terms of Service", "Transfer of your company ownership to a third party"],
        ar: ["انتهاء أو إلغاء اشتراكك دون تجديد", "انتهاك أي من القيود المذكورة", "إنهاء حسابك بسبب انتهاك شروط الخدمة", "انتقال ملكية شركتك لطرف ثالث"],
        fr: ["Votre abonnement expire ou est annulé sans renouvellement", "Violation de l'une des restrictions", "Résiliation de votre compte pour violation des conditions", "Transfert de propriété de votre entreprise à un tiers"],
        tr: ["Aboneliğiniz yenilenmeden sona erer veya iptal edilir", "Kısıtlamalardan herhangi birinin ihlali", "Şart ihlali nedeniyle hesabınızın feshi", "Şirket mülkiyetinin üçüncü tarafa devri"],
      },
    },
  },
  accessibility: {
    text: {
      head_title: { en: "Accessibility Statement — {brand}", ar: "بيان إمكانية الوصول — {brand}" },
      title: { en: "Accessibility Statement", ar: "بيان إمكانية الوصول" },
      updated: { en: "Last updated: January 1, 2025", ar: "آخر تحديث: 1 يناير 2025" },
      s1_h: { en: "Our Commitment", ar: "التزامنا" },
      s1_p: { en: "{brand} is committed to ensuring digital accessibility for people with disabilities. We continually improve the user experience for everyone and apply relevant accessibility standards.", ar: "تلتزم {brand} بضمان إمكانية الوصول الرقمي للأشخاص ذوي الإعاقة، ونعمل باستمرار على تحسين تجربة الاستخدام للجميع وتطبيق معايير إمكانية الوصول ذات الصلة." },
      s2_h: { en: "Conformance Status", ar: "حالة المطابقة" },
      s2_p1_a: { en: "We aim to conform to the ", ar: "نسعى إلى مطابقة " },
      s2_p1_b: { en: "Web Content Accessibility Guidelines (WCAG) 2.1", ar: "إرشادات إمكانية الوصول إلى محتوى الويب (WCAG) 2.1" },
      s2_p1_c: { en: " at Level AA. These guidelines define requirements for designers and developers to improve accessibility for people with disabilities.", ar: " على المستوى AA، وهي إرشادات تحدّد متطلبات يلتزم بها المصممون والمطوّرون لتحسين إمكانية الوصول للأشخاص ذوي الإعاقة." },
      s2_p2: { en: "Our current implementation includes:", ar: "يتضمن تطبيقنا الحالي ما يلي:" },
      s3_h: { en: "Known Limitations", ar: "القيود المعروفة" },
      s3_p: { en: "We are aware of the following areas currently being improved:", ar: "ندرك وجود الجوانب التالية التي نعمل حاليًا على تحسينها:" },
      s4_h: { en: "Technical Specifications", ar: "المواصفات التقنية" },
      s4_p: { en: "Accessibility relies on the following technologies:", ar: "تعتمد إمكانية الوصول على التقنيات التالية:" },
      s5_h: { en: "Assistive Technology Compatibility", ar: "التوافق مع التقنيات المساعدة" },
      s5_p: { en: "The platform is designed to be compatible with:", ar: "صُمّمت المنصة لتكون متوافقة مع:" },
      s6_h: { en: "Feedback & Contact", ar: "الملاحظات والتواصل" },
      s6_p1: { en: "We welcome feedback on the accessibility of {brand}. If you encounter barriers or have suggestions for improvement, please contact us:", ar: "نرحّب بملاحظاتكم حول إمكانية الوصول إلى {brand}. إذا واجهتم أي عوائق أو كانت لديكم اقتراحات للتحسين، فيُرجى التواصل معنا:" },
      s6_email_l: { en: "Email:", ar: "البريد الإلكتروني:" },
      s6_time_l: { en: "Response time:", ar: "مدة الرد:" },
      s6_time: { en: "We aim to respond within 3 business days", ar: "نسعى إلى الرد خلال 3 أيام عمل" },
      s6_p2: { en: "We take accessibility feedback seriously and will work to resolve any issues reported.", ar: "نأخذ ملاحظات إمكانية الوصول بجدية، وسنعمل على حل أي مشكلة يُبلَّغ عنها." },
      s7_h: { en: "Formal Complaints", ar: "الشكاوى الرسمية" },
      s7_p: { en: "If you are not satisfied with our response, you may contact the relevant national accessibility authority or equality body in your country.", ar: "إذا لم تكن راضيًا عن ردّنا، فيمكنك التواصل مع الجهة الوطنية المختصة بإمكانية الوصول أو هيئة المساواة في بلدك." },
    },
    lists: {
      s2: {
        en: ["Sufficient color contrast ratios throughout the interface", "Keyboard navigation support for all interactive elements", "Descriptive labels for form inputs and buttons", "Responsive design supporting zoom up to 400%", "Screen reader compatible markup (ARIA labels where applicable)", "Focus indicators on interactive elements", "Consistent navigation across pages"],
        ar: ["نسب تباين ألوان كافية في جميع أنحاء الواجهة", "دعم التنقل بلوحة المفاتيح لجميع العناصر التفاعلية", "تسميات وصفية لحقول النماذج والأزرار", "تصميم متجاوب يدعم التكبير حتى 400%", "ترميز متوافق مع قارئات الشاشة (تسميات ARIA حيثما ينطبق ذلك)", "مؤشرات تركيز على العناصر التفاعلية", "تنقل متسق عبر الصفحات"],
      },
      s3: {
        en: ["The visual chatbot flow builder (drag-and-drop canvas) may have limited keyboard accessibility — a text-based alternative is in development", "Some data visualizations (charts) may not have full screen reader support — tabular data alternatives are planned", "Rich text campaign editor accessibility is being enhanced"],
        ar: ["قد تكون إمكانية الوصول بلوحة المفاتيح محدودة في منشئ تدفقات روبوت المحادثة المرئي (لوحة السحب والإفلات)، ويجري تطوير بديل نصي", "قد لا تحظى بعض التمثيلات المرئية للبيانات (الرسوم البيانية) بدعم كامل من قارئات الشاشة، ونخطط لتوفير بدائل في صورة جداول", "يجري تحسين إمكانية الوصول في محرر النصوص المنسّقة للحملات"],
      },
      s4: {
        en: ["HTML5 semantic markup", "CSS (with high contrast support)", "JavaScript (progressive enhancement where possible)", "WAI-ARIA roles and properties"],
        ar: ["ترميز HTML5 الدلالي", "CSS (مع دعم التباين العالي)", "JavaScript (مع التحسين التدريجي حيثما أمكن)", "أدوار وخصائص WAI-ARIA"],
      },
      s5: {
        en: ["Screen readers (NVDA, JAWS, VoiceOver)", "Browser zoom and text scaling", "Keyboard-only navigation", "High contrast browser modes", "Speech recognition software"],
        ar: ["قارئات الشاشة (NVDA وJAWS وVoiceOver)", "تكبير المتصفح وتغيير حجم النص", "التنقل باستخدام لوحة المفاتيح فقط", "أوضاع التباين العالي في المتصفحات", "برامج التعرّف على الكلام"],
      },
    },
  },
  index: {
    text: {
      title: { en: "Legal", ar: "الوثائق القانونية", fr: "Légal", tr: "Yasal" },
      subtitle: { en: "Our legal documents, policies, and agreements. We believe in full transparency.", ar: "وثائقنا القانونية وسياساتنا واتفاقياتنا. نؤمن بالشفافية الكاملة.", fr: "Nos documents juridiques, politiques et accords. Nous croyons en la transparence totale.", tr: "Hukuki belgelerimiz, politikalarımız ve anlaşmalarımız. Tam şeffaflığa inanıyoruz." },
      updated: { en: "Last updated", ar: "آخر تحديث", fr: "Dernière mise à jour", tr: "Son güncelleme" },
      read_doc: { en: "Read document", ar: "قراءة الوثيقة", fr: "Lire le document", tr: "Belgeyi oku" },
      company: { en: "WEBEK LTD · Company No. 16326894 · 71-75 Shelton Street, Covent Garden, London, WC2H 9JQ, United Kingdom", ar: "WEBEK LTD · رقم الشركة: 16326894 · 71-75 شيلتون ستريت، كوفنت غاردن، لندن، WC2H 9JQ، المملكة المتحدة", fr: "WEBEK LTD · Numéro d'entreprise: 16326894 · 71-75 Shelton Street, Covent Garden, Londres, WC2H 9JQ, Royaume-Uni", tr: "WEBEK LTD · Şirket No: 16326894 · 71-75 Shelton Street, Covent Garden, Londra, WC2H 9JQ, Birleşik Krallık" },
      questions: { en: "Questions about our legal documents?", ar: "أسئلة حول وثائقنا القانونية؟", fr: "Des questions sur nos documents juridiques ?", tr: "Hukuki belgelerimiz hakkında sorularınız mı var?" },
      contact_us: { en: "Contact us at", ar: "تواصل معنا على", fr: "Contactez-nous à", tr: "Bize ulaşın" },
      doc1_title: { en: "Privacy Policy", ar: "سياسة الخصوصية", fr: "Politique de confidentialité", tr: "Gizlilik Politikası" },
      doc1_desc: { en: "How we collect, use, store, and protect your personal data. Your privacy matters to us.", ar: "كيف نجمع بياناتك الشخصية ونستخدمها ونخزنها ونحميها. خصوصيتك تهمنا.", fr: "Comment nous collectons, utilisons, stockons et protégeons vos données personnelles.", tr: "Kişisel verilerinizi nasıl topladığımızı, kullandığımızı ve koruduğumuzu açıklar." },
      doc2_title: { en: "Terms of Service", ar: "شروط الخدمة", fr: "Conditions d'utilisation", tr: "Hizmet Şartları" },
      doc2_desc: { en: "The rules and agreements that govern your use of WABEK services. Please read carefully.", ar: "القواعد والاتفاقيات التي تحكم استخدامك لخدمات WABEK. يرجى القراءة بعناية.", fr: "Les règles et accords qui régissent votre utilisation des services WABEK.", tr: "WABEK hizmetlerinin kullanımını yöneten kurallar ve anlaşmalar." },
      doc3_title: { en: "Refund Policy", ar: "سياسة الاسترداد", fr: "Politique de remboursement", tr: "İade Politikası" },
      doc3_desc: { en: "Our refund and cancellation terms. We offer a 14-day money-back guarantee on all paid plans.", ar: "شروط الاسترداد والإلغاء لدينا. نقدم ضمان استرداد المال لمدة 14 يوماً على جميع الخطط المدفوعة.", fr: "Nos conditions de remboursement et d'annulation. Garantie de remboursement de 14 jours.", tr: "İade ve iptal şartlarımız. Tüm ücretli planlarda 14 günlük para iade garantisi." },
      doc4_title: { en: "Software License", ar: "رخصة البرنامج", fr: "Licence du logiciel", tr: "Yazılım Lisansı" },
      doc4_desc: { en: "The proprietary software license that governs the use of WABEK platform and its source code.", ar: "رخصة البرنامج المملوك التي تحكم استخدام منصة WABEK وشيفرتها المصدرية.", fr: "La licence logicielle propriétaire qui régit l'utilisation de la plateforme WABEK.", tr: "WABEK platformunun ve kaynak kodunun kullanımını yöneten tescilli yazılım lisansı." },
      doc5_title: { en: "Accessibility Statement", ar: "بيان إمكانية الوصول", fr: "Déclaration d'accessibilité", tr: "Erişilebilirlik Bildirimi" },
      doc5_desc: { en: "Our commitment to making WABEK accessible to all users, regardless of ability or disability.", ar: "التزامنا بجعل WABEK في متناول جميع المستخدمين، بغض النظر عن قدراتهم.", fr: "Notre engagement à rendre WABEK accessible à tous les utilisateurs.", tr: "WABEK'i tüm kullanıcılar için erişilebilir kılma taahhüdümüz." },
    },
    lists: {
    },
  },
}
