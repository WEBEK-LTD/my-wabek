// Translations for plan text that admins write in English in the `plans`
// table (name, description, features). Looked up case-insensitively by the
// English text; anything not listed is shown as written. See lib/plan-text.ts.
type Row = { ar: string; fr?: string; tr?: string }

const PLAN_TEXT: Record<string, Row> = {
  // names
  'free': { ar: 'مجانية', fr: 'Gratuit', tr: 'Ücretsiz' },
  // descriptions
  'for small businesses': { ar: 'للأنشطة التجارية الصغيرة', fr: 'Pour les petites entreprises', tr: 'Küçük işletmeler için' },
  'most popular for growing teams': { ar: 'الأكثر طلبًا للفرق النامية', fr: 'La plus choisie par les équipes en croissance', tr: 'Büyüyen ekiplerin en çok tercih ettiği' },
  'for large organizations': { ar: 'للمؤسسات الكبيرة', fr: 'Pour les grandes organisations', tr: 'Büyük kuruluşlar için' },
  'for growing businesses': { ar: 'للأنشطة التجارية النامية', fr: 'Pour les entreprises en croissance', tr: 'Büyüyen işletmeler için' },
  'for agencies': { ar: 'للوكالات', fr: 'Pour les agences', tr: 'Ajanslar için' },
  'for enterprises': { ar: 'للمؤسسات', fr: 'Pour les entreprises', tr: 'Kurumlar için' },
  // features
  'basic automation': { ar: 'أتمتة أساسية', fr: 'Automatisation de base', tr: 'Temel otomasyon' },
  'all automation': { ar: 'كل أدوات الأتمتة', fr: 'Toute l’automatisation', tr: 'Tüm otomasyonlar' },
  'automation': { ar: 'الأتمتة', fr: 'Automatisation', tr: 'Otomasyon' },
  'api access': { ar: 'الوصول إلى API', fr: 'Accès API', tr: 'API erişimi' },
  'priority support': { ar: 'دعم ذو أولوية', fr: 'Support prioritaire', tr: 'Öncelikli destek' },
  'dedicated support': { ar: 'دعم مخصّص', fr: 'Support dédié', tr: 'Özel destek' },
  '24/7 priority support': { ar: 'دعم ذو أولوية على مدار الساعة', fr: 'Support prioritaire 24/7', tr: '7/24 öncelikli destek' },
  'email support': { ar: 'دعم عبر البريد الإلكتروني', fr: 'Support par e-mail', tr: 'E-posta desteği' },
  'analytics': { ar: 'التحليلات', fr: 'Analyses', tr: 'Analitik' },
  'advanced analytics': { ar: 'تحليلات متقدمة', fr: 'Analyses avancées', tr: 'Gelişmiş analitik' },
  'analytics dashboard': { ar: 'لوحة التحليلات', fr: 'Tableau de bord analytique', tr: 'Analitik paneli' },
  'multiple instances': { ar: 'أكثر من رقم واتساب', fr: 'Plusieurs numéros WhatsApp', tr: 'Birden fazla WhatsApp numarası' },
  'multiple numbers': { ar: 'أكثر من رقم واتساب', fr: 'Plusieurs numéros WhatsApp', tr: 'Birden fazla WhatsApp numarası' },
  'whmcs integration': { ar: 'تكامل WHMCS', fr: 'Intégration WHMCS', tr: 'WHMCS entegrasyonu' },
  'woocommerce integration': { ar: 'تكامل WooCommerce', fr: 'Intégration WooCommerce', tr: 'WooCommerce entegrasyonu' },
  'wix integration': { ar: 'تكامل Wix', fr: 'Intégration Wix', tr: 'Wix entegrasyonu' },
  'unlimited contacts': { ar: 'جهات اتصال غير محدودة', fr: 'Contacts illimités', tr: 'Sınırsız kişi' },
  'unlimited messages': { ar: 'رسائل غير محدودة', fr: 'Messages illimités', tr: 'Sınırsız mesaj' },
  'unlimited numbers': { ar: 'أرقام غير محدودة', fr: 'Numéros illimités', tr: 'Sınırsız numara' },
  'custom integrations': { ar: 'تكاملات مخصّصة', fr: 'Intégrations personnalisées', tr: 'Özel entegrasyonlar' },
  'bulk campaigns': { ar: 'حملات جماعية', fr: 'Campagnes en masse', tr: 'Toplu kampanyalar' },
  'campaigns': { ar: 'الحملات', fr: 'Campagnes', tr: 'Kampanyalar' },
  'chatbot builder': { ar: 'منشئ روبوت المحادثة', fr: 'Constructeur de chatbot', tr: 'Chatbot oluşturucu' },
  'chatbot': { ar: 'روبوت المحادثة', fr: 'Chatbot', tr: 'Chatbot' },
  'ai auto-reply': { ar: 'الرد الآلي بالذكاء الاصطناعي', fr: 'Réponse automatique IA', tr: 'Yapay zeka otomatik yanıt' },
  'ai assistant': { ar: 'المساعد الذكي', fr: 'Assistant IA', tr: 'Yapay zeka asistanı' },
  'team inbox': { ar: 'صندوق وارد للفريق', fr: 'Boîte de réception d’équipe', tr: 'Ekip gelen kutusu' },
  'white label': { ar: 'العلامة البيضاء', fr: 'Marque blanche', tr: 'Beyaz etiket' },
  'full white label': { ar: 'علامة بيضاء كاملة', fr: 'Marque blanche complète', tr: 'Tam beyaz etiket' },
  'sla guarantee': { ar: 'ضمان مستوى الخدمة (SLA)', fr: 'Garantie SLA', tr: 'SLA garantisi' },
  'reseller program': { ar: 'برنامج الموزّعين', fr: 'Programme revendeur', tr: 'Bayi programı' },
  'sub-accounts': { ar: 'حسابات فرعية', fr: 'Sous-comptes', tr: 'Alt hesaplar' },
  'webhooks': { ar: 'Webhooks', fr: 'Webhooks', tr: 'Webhook’lar' },
}

/** Patterns with a captured part: "Everything in Pro", "14-day trial", "500 messages/month"… */
const PATTERNS: { re: RegExp; ar: string; fr: string; tr: string }[] = [
  { re: /^everything in (.+)$/i, ar: 'كل ما في باقة $1', fr: 'Tout ce qui est inclus dans $1', tr: '$1 planındaki her şey' },
  { re: /^(\d+)[- ]day (?:free )?trial$/i, ar: 'تجربة مجانية لمدة $1 يومًا', fr: 'Essai gratuit de $1 jours', tr: '$1 günlük ücretsiz deneme' },
  { re: /^([\d,.]+) messages ?(?:\/|per |a )month$/i, ar: '$1 رسالة شهريًا', fr: '$1 messages/mois', tr: 'Ayda $1 mesaj' },
  { re: /^([\d,.]+) contacts$/i, ar: '$1 جهة اتصال', fr: '$1 contacts', tr: '$1 kişi' },
  { re: /^1 whatsapp number$/i, ar: 'رقم واتساب واحد', fr: '1 numéro WhatsApp', tr: '1 WhatsApp numarası' },
  { re: /^(\d+) whatsapp numbers$/i, ar: '$1 أرقام واتساب', fr: '$1 numéros WhatsApp', tr: '$1 WhatsApp numarası' },
  { re: /^(\d+) team members?$/i, ar: '$1 أعضاء في الفريق', fr: '$1 membres d’équipe', tr: '$1 ekip üyesi' },
]

export function lookupPlanText(text: string, lang: string): string | null {
  if (lang !== 'ar' && lang !== 'fr' && lang !== 'tr') return null
  const key = text.trim().replace(/\s+/g, ' ').toLowerCase()
  const row = PLAN_TEXT[key]
  if (row) return row[lang] ?? null
  for (const p of PATTERNS) {
    const m = text.trim().match(p.re)
    if (m) return p[lang].replace('$1', m[1])
  }
  return null
}
