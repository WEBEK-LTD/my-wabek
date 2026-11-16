import React from 'react'
import Head from 'next/head'
import {
  ArrowTopRightOnSquareIcon, AtSymbolIcon, CalendarDaysIcon, BuildingOffice2Icon, ChatBubbleLeftRightIcon, CpuChipIcon,
  DevicePhoneMobileIcon, EnvelopeIcon, EyeIcon, GlobeAltIcon, GlobeEuropeAfricaIcon, HashtagIcon, InboxStackIcon,
  LanguageIcon, LightBulbIcon, LockClosedIcon, MapPinIcon, MegaphoneIcon, PhoneIcon, ShieldCheckIcon, WindowIcon,
} from '@heroicons/react/24/outline'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import { Button } from '@/components/ui'
import { MarketingPage, PageHero, Section } from '@/components/marketing/MarketingPage'
import { CtaBand, IconTile } from '@/components/marketing/Blocks'
import { usePublicLang } from '@/components/marketing/usePublicLang'

const LOGO = '/brand/favicon-32.png'

const S: Record<string, Record<string, string>> = {
  page_title:   { en:'About Us', ar:'من نحن', fr:'À propos', tr:'Hakkımızda' },
  hero_title:   { en:'Built by WEBEK LTD', ar:'مبني من قِبَل WEBEK LTD', fr:'Construit par WEBEK LTD', tr:'WEBEK LTD Tarafından İnşa Edildi' },
  hero_sub:     { en:'WABEK is the WhatsApp automation platform from WEBEK LTD, a UK-registered technology company building digital products for businesses worldwide.', ar:'WABEK هي منصة أتمتة واتساب من شركة WEBEK LTD، شركة تقنية مسجلة في المملكة المتحدة تبني منتجات رقمية للشركات حول العالم.', fr:'WABEK est la plateforme d\'automatisation WhatsApp de WEBEK LTD, une société technologique britannique qui construit des produits numériques pour les entreprises du monde entier.', tr:'WABEK, İngiltere\'de kayıtlı bir teknoloji şirketi olan WEBEK LTD\'nin WhatsApp otomasyon platformudur.' },
  mission_title:{ en:'Our Mission', ar:'مهمتنا', fr:'Notre Mission', tr:'Misyonumuz' },
  mission_body: { en:'We believe every business, from a small shop in Cairo to an enterprise in London, deserves powerful and affordable communication tools. WhatsApp has over 3 billion users worldwide. WABEK makes WhatsApp automation accessible to everyone, with no technical expertise required. We handle the complexity so you can focus on what matters: growing your business and serving your customers.', ar:'نؤمن بأن كل شركة، من محل صغير في القاهرة إلى مؤسسة في لندن، تستحق أدوات تواصل قوية وبأسعار معقولة. يضم واتساب أكثر من 3 مليار مستخدم حول العالم. يجعل WABEK أتمتة واتساب في متناول الجميع، دون الحاجة لخبرة تقنية. نحن نتولى التعقيد حتى تتمكن من التركيز على ما يهم: تنمية عملك وخدمة عملائك.', fr:'Nous croyons que chaque entreprise, d\'une petite boutique au Caire à une grande entreprise à Londres, mérite des outils de communication puissants et abordables. WhatsApp compte plus de 3 milliards d\'utilisateurs dans le monde. WABEK rend l\'automatisation WhatsApp accessible à tous, sans expertise technique requise.', tr:'Kahire\'deki küçük bir dükkandan Londra\'daki büyük bir şirkete kadar her işletmenin güçlü ve uygun fiyatlı iletişim araçlarına hak kazandığına inanıyoruz. WhatsApp\'ın dünya genelinde 3 milyardan fazla kullanıcısı var. WABEK, teknik uzmanlık gerektirmeden WhatsApp otomasyonunu herkes için erişilebilir kılıyor.' },
  company_title:{ en:'About WEBEK LTD', ar:'نبذة عن WEBEK LTD', fr:'À propos de WEBEK LTD', tr:'WEBEK LTD Hakkında' },
  company_body: { en:'WEBEK LTD is a United Kingdom registered technology company (Company number: 16326894), headquartered at 71-75 Shelton Street, Covent Garden, London. Founded to bridge the gap between enterprise-level digital tools and everyday businesses, WEBEK builds products that are powerful yet simple. From web hosting and domain names to website design, mobile apps, and AI-powered automation, WEBEK LTD serves clients across the UK, Middle East, Europe, and beyond. WABEK is our latest and most ambitious product, bringing world-class WhatsApp automation to businesses of all sizes.', ar:'WEBEK LTD هي شركة تقنية مسجلة في المملكة المتحدة (رقم الشركة: 16326894)، ومقرها في 71-75 شيلتون ستريت، كوفنت غاردن، لندن. تأسست لسد الفجوة بين الأدوات الرقمية على مستوى المؤسسات والشركات اليومية. تبني WEBEK منتجات قوية وبسيطة في آنٍ واحد. من استضافة الويب وأسماء النطاقات إلى تصميم المواقع وتطبيقات الجوال والأتمتة بالذكاء الاصطناعي، تخدم WEBEK LTD عملاء في المملكة المتحدة والشرق الأوسط وأوروبا وما هو أبعد. WABEK هو أحدث منتجاتنا وأكثرها طموحاً، يجلب أتمتة واتساب عالمية المستوى للشركات من جميع الأحجام.', fr:'WEBEK LTD est une société technologique enregistrée au Royaume-Uni (numéro: 16326894), dont le siège est au 71-75 Shelton Street, Covent Garden, Londres. Fondée pour combler le fossé entre les outils numériques d\'entreprise et les petites entreprises, WEBEK construit des produits puissants et simples. De l\'hébergement web aux noms de domaine, en passant par la conception de sites web, les applications mobiles et l\'automatisation IA, WEBEK LTD sert des clients au Royaume-Uni, au Moyen-Orient, en Europe et au-delà. WABEK est notre produit le plus récent et le plus ambitieux.', tr:'WEBEK LTD, 71-75 Shelton Street, Covent Garden, Londra adresinde genel merkezi bulunan bir Birleşik Krallık teknoloji şirketidir (Şirket numarası: 16326894). Kurumsal düzeydeki dijital araçlarla günlük işletmeler arasındaki uçurumu kapatmak için kurulan WEBEK, güçlü ama basit ürünler üretir. Web barındırmadan alan adlarına, web sitesi tasarımından mobil uygulamalara ve yapay zeka destekli otomasyona kadar WEBEK LTD, İngiltere, Orta Doğu, Avrupa ve ötesindeki müşterilere hizmet veriyor. WABEK, her ölçekteki işletmeye dünya standartlarında WhatsApp otomasyonu sunan en yeni ve en iddialı ürünümüzdür.' },
  services_title:{ en:'WEBEK Services', ar:'خدمات WEBEK', fr:'Services WEBEK', tr:'WEBEK Hizmetleri' },
  services_sub: { en:'Beyond WABEK, WEBEK LTD offers a full suite of digital services for businesses of all sizes.', ar:'بعيداً عن WABEK، تقدم WEBEK LTD مجموعة كاملة من الخدمات الرقمية للشركات من جميع الأحجام.', fr:'Au-delà de WABEK, WEBEK LTD propose une gamme complète de services numériques.', tr:'WABEK\'in ötesinde, WEBEK LTD her ölçekteki işletmeler için dijital hizmetler sunar.' },
  values_title: { en:'Our Values', ar:'قيمنا', fr:'Nos Valeurs', tr:'Değerlerimiz' },
  team_title:   { en:'A Global Team', ar:'فريق عالمي', fr:'Une Équipe Mondiale', tr:'Küresel Bir Ekip' },
  team_body:    { en:'Our team spans the UK, Egypt, Turkey, and beyond. We speak your language, literally. WABEK is available in English, Arabic, French, and Turkish, with more languages coming soon.', ar:'يمتد فريقنا عبر المملكة المتحدة ومصر وتركيا وما هو أبعد. نتحدث لغتك، حرفياً. WABEK متاح باللغات العربية والإنجليزية والفرنسية والتركية، مع المزيد قريباً.', fr:'Notre équipe s\'étend du Royaume-Uni à l\'Égypte, la Turquie et au-delà. Nous parlons votre langue. WABEK est disponible en anglais, arabe, français et turc.', tr:'Ekibimiz İngiltere, Mısır, Türkiye ve ötesine yayılmıştır. WABEK; İngilizce, Arapça, Fransızca ve Türkçe olarak kullanılabilir.' },
  cta_title:    { en:'Ready to automate your WhatsApp?', ar:'هل أنت مستعد لأتمتة واتساب؟', fr:'Prêt à automatiser votre WhatsApp ?', tr:'WhatsApp\'ınızı otomatikleştirmeye hazır mısınız?' },
  wabek_title:  { en:'What is WABEK?', ar:'ما هو WABEK؟', fr:'Qu\'est-ce que WABEK ?', tr:'WABEK Nedir?' },
  wabek_body1:  { en:'WABEK is a complete WhatsApp Business automation platform built for companies that want to communicate smarter. Whether you run a small e-commerce store or manage a large enterprise support team, WABEK gives you the tools to automate conversations, send bulk campaigns, build chatbots, and reply to customers with AI, all through WhatsApp.', ar:'WABEK هي منصة أتمتة واتساب للأعمال الكاملة، مصممة للشركات التي تريد التواصل بذكاء أكبر. سواء كنت تدير متجراً إلكترونياً صغيراً أو تدير فريق دعم مؤسسي كبيراً، يمنحك WABEK الأدوات اللازمة لأتمتة المحادثات وإرسال حملات جماعية وبناء روبوتات دردشة والرد على العملاء، كل ذلك عبر واتساب.', fr:'WABEK est une plateforme complète d\'automatisation WhatsApp Business conçue pour les entreprises qui veulent communiquer plus intelligemment. Que vous gériez une petite boutique en ligne ou une grande équipe de support, WABEK vous donne les outils pour automatiser les conversations, envoyer des campagnes, créer des chatbots et répondre aux clients.', tr:'WABEK, daha akıllı iletişim kurmak isteyen şirketler için tasarlanmış eksiksiz bir WhatsApp Business otomasyon platformudur. Küçük bir e-ticaret mağazası işletseniz de büyük bir kurumsal destek ekibini yönetseniz de WABEK, konuşmaları otomatikleştirme, toplu kampanyalar gönderme, chatbot oluşturma ve müşterilere WhatsApp üzerinden yanıt verme araçları sunar.' },
  wabek_body2:  { en:'WABEK supports both the official Meta WhatsApp Cloud API for businesses that need compliance and scale, and WhatsApp Web for those who want to get started quickly. With WABEK, you can manage multiple WhatsApp numbers, automate customer journeys, integrate with your website or CRM, and track every message with detailed analytics.', ar:'يدعم WABEK كلاً من واجهة برمجة تطبيقات Meta WhatsApp Cloud API الرسمية للشركات التي تحتاج إلى الامتثال والنطاق الواسع، وواتساب Web لمن يريد البدء بسرعة. مع WABEK، يمكنك إدارة أرقام واتساب متعددة وأتمتة رحلات العملاء والتكامل مع موقعك أو CRM وتتبع كل رسالة بتحليلات مفصلة.', fr:'WABEK prend en charge l\'API Meta WhatsApp Cloud officielle pour les entreprises nécessitant conformité et évolutivité, ainsi que WhatsApp Web. Avec WABEK, vous pouvez gérer plusieurs numéros WhatsApp, automatiser les parcours clients et intégrer votre site web ou CRM.', tr:'WABEK, uyumluluk ve ölçek isteyen işletmeler için resmi Meta WhatsApp Cloud API\'sini ve hızlı başlamak isteyenler için WhatsApp Web\'i destekler. WABEK ile birden fazla WhatsApp numarasını yönetebilir, müşteri yolculuklarını otomatikleştirebilir ve web siteniz veya CRM\'inizle entegre olabilirsiniz.' },
  cta_sub:      { en:'Start free today and grow your business on WhatsApp.', ar:'ابدأ مجانًا اليوم، ونمِّ أعمالك عبر واتساب.', fr:'Commencez gratuitement dès aujourd\'hui et développez votre activité sur WhatsApp.', tr:'Bugün ücretsiz başlayın ve işinizi WhatsApp\'ta büyütün.' },
  get_started:  { en:'Get Started Free', ar:'ابدأ مجاناً', fr:'Commencer Gratuitement', tr:'Ücretsiz Başla' },
  visit:        { en:'Visit Website', ar:'زيارة الموقع', fr:'Visiter le site', tr:'Web sitesini ziyaret et' },
  reg_uk:       { en:'UK Registered Company', ar:'شركة مسجلة في المملكة المتحدة', fr:'Société enregistrée au Royaume-Uni', tr:'İngiltere\'de Kayıtlı Şirket' },
  address_label:{ en:'Registered Address', ar:'العنوان المسجل', fr:'Adresse enregistrée', tr:'Kayıtlı Adres' },
  company_no:   { en:'Company Number', ar:'رقم الشركة', fr:'Numéro d\'entreprise', tr:'Şirket Numarası' },
  contact_label:{ en:'Get in Touch', ar:'تواصل معنا', fr:'Nous Contacter', tr:'İletişime Geçin' },
  websites:     { en:'Websites', ar:'المواقع الإلكترونية', fr:'Sites web', tr:'Web siteleri' },
  region_uk:    { en:'UK / Europe / Americas', ar:'المملكة المتحدة / أوروبا / الأمريكتان', fr:'Royaume-Uni / Europe / Amériques', tr:'İngiltere / Avrupa / Amerika' },
  region_mena:  { en:'Middle East / Turkey / MENA', ar:'الشرق الأوسط / تركيا / الشرق الأوسط وشمال أفريقيا', fr:'Moyen-Orient / Turquie / MENA', tr:'Orta Doğu / Türkiye / MENA' },
  founded:      { en:'Founded', ar:'سنة التأسيس', fr:'Fondée en', tr:'Kuruluş' },
  registered:   { en:'Registered', ar:'مسجلة في', fr:'Enregistrée au', tr:'Kayıtlı' },
  languages:    { en:'Languages', ar:'لغات الواجهة', fr:'Langues', tr:'Diller' },
  status_page:  { en:'Status Page', ar:'صفحة الحالة', fr:'Page de statut', tr:'Durum Sayfası' },
  support:      { en:'Support', ar:'الدعم', fr:'Support', tr:'Destek' },
}

const T = (lang: string, key: string) => S[key]?.[lang] || S[key]?.en || key

type L = Record<string, string>

const SERVICES = [
  { icon: GlobeAltIcon, title: { en:'Web Hosting', ar:'استضافة المواقع', fr:'Hébergement Web', tr:'Web Hosting' }, desc: { en:'Shared, WordPress, and reseller hosting with 99.9% uptime, free SSL, and one-click installs.', ar:'استضافة مشتركة وووردبريس وإعادة البيع مع 99.9% وقت تشغيل وشهادة SSL مجانية.', fr:'Hébergement partagé, WordPress et revendeur avec 99.9% de disponibilité, SSL gratuit.', tr:'%99.9 çalışma süresi ve ücretsiz SSL ile paylaşımlı, WordPress ve bayi hosting.' }, href: 'https://webek.org/shared-hosting', cta: { en:'View Plans', ar:'عرض الخطط', fr:'Voir les plans', tr:'Planları Gör' } },
  { icon: WindowIcon, title: { en:'Website Design', ar:'تصميم المواقع', fr:'Conception de sites web', tr:'Web Tasarımı' }, desc: { en:'Professional website design and development packages — from starter sites to enterprise-level builds.', ar:'حزم تصميم وتطوير مواقع احترافية، من المواقع المبتدئة إلى حلول المؤسسات.', fr:'Packages de conception et développement de sites Web professionnels.', tr:'Başlangıç sitelerinden kurumsal yapılara kadar profesyonel web tasarımı paketleri.' }, href: 'https://webek.org/wordpress', cta: { en:'View Packages', ar:'عرض الحزم', fr:'Voir les packages', tr:'Paketleri Gör' } },
  { icon: DevicePhoneMobileIcon, title: { en:'Mobile App Development', ar:'تطوير تطبيقات الجوال', fr:'Développement d\'applications mobiles', tr:'Mobil Uygulama Geliştirme' }, desc: { en:'Custom iOS and Android mobile app development for businesses ready to go mobile.', ar:'تطوير تطبيقات جوال مخصصة لنظامي iOS وAndroid للشركات الراغبة في التحول للجوال.', fr:'Développement d\'applications mobiles iOS et Android sur mesure.', tr:'Mobil\'e geçmeye hazır işletmeler için özel iOS ve Android uygulama geliştirme.' }, href: 'https://www.webek.uk/mobileapp', cta: { en:'Learn More', ar:'اعرف المزيد', fr:'En savoir plus', tr:'Daha Fazla' } },
  { icon: CpuChipIcon, title: { en:'AI & Automation', ar:'الذكاء الاصطناعي والأتمتة', fr:'IA & Automatisation', tr:'Yapay Zeka & Otomasyon' }, desc: { en:'AI-powered systems and business automation tools, including WABEK, our flagship WhatsApp automation platform.', ar:'أنظمة مدعومة بالذكاء الاصطناعي وأدوات أتمتة الأعمال، بما في ذلك WABEK، منصة أتمتة واتساب الرائدة.', fr:'Systèmes alimentés par l\'IA et outils d\'automatisation, dont WABEK.', tr:'WABEK dahil yapay zeka destekli sistemler ve iş otomasyon araçları.' }, href: 'https://waabek.com', cta: { en:'Try WABEK', ar:'جرّب WABEK', fr:'Essayer WABEK', tr:'WABEK\'i Dene' } },
  { icon: AtSymbolIcon, title: { en:'Domain Names', ar:'أسماء النطاقات', fr:'Noms de domaine', tr:'Alan Adları' }, desc: { en:'Register, transfer, or manage your domain names with ease. Competitive prices and full management tools.', ar:'سجّل أو انقل أو أدر أسماء نطاقاتك بسهولة. أسعار تنافسية وأدوات إدارة كاملة.', fr:'Enregistrez, transférez ou gérez vos noms de domaine. Prix compétitifs.', tr:'Alan adlarınızı kolayca kaydedin, aktarın veya yönetin. Rekabetçi fiyatlar.' }, href: 'https://webek.org/domain-names', cta: { en:'Search Domains', ar:'ابحث عن النطاقات', fr:'Rechercher des domaines', tr:'Domain Ara' } },
  { icon: LockClosedIcon, title: { en:'SSL Certificates', ar:'شهادات SSL', fr:'Certificats SSL', tr:'SSL Sertifikaları' }, desc: { en:'Free SSL with every hosting plan. Secure your website and build customer trust with HTTPS.', ar:'شهادة SSL مجانية مع كل خطة استضافة. أمّن موقعك وابنِ ثقة العملاء مع HTTPS.', fr:'SSL gratuit avec chaque plan d\'hébergement. Sécurisez votre site.', tr:'Her hosting planıyla ücretsiz SSL. HTTPS ile sitenizi güvenceye alın.' }, href: 'https://webek.org', cta: { en:'Get SSL', ar:'احصل على SSL', fr:'Obtenir SSL', tr:'SSL Al' } },
]

const VALUES = [
  { icon: ShieldCheckIcon, title: { en:'Reliability', ar:'الموثوقية', fr:'Fiabilité', tr:'Güvenilirlik' }, desc: { en:'99.9% uptime guarantee across all our services. Your business never stops.', ar:'ضمان وقت تشغيل 99.9% عبر جميع خدماتنا. عملك لا يتوقف أبداً.', fr:'Garantie de disponibilité de 99.9%. Votre entreprise ne s\'arrête jamais.', tr:'Tüm hizmetlerimizde %99.9 çalışma süresi garantisi.' } },
  { icon: LightBulbIcon, title: { en:'Innovation', ar:'الابتكار', fr:'Innovation', tr:'İnovasyon' }, desc: { en:'We build the tools we wish existed. From AI chatbots to WhatsApp automation, always ahead of the curve.', ar:'نبني الأدوات التي تمنينا وجودها. من روبوتات الدردشة بالذكاء الاصطناعي إلى أتمتة واتساب.', fr:'Nous construisons les outils que nous souhaitons voir exister.', tr:'Var olmasını istediğimiz araçları inşa ediyoruz.' } },
  { icon: GlobeEuropeAfricaIcon, title: { en:'Global Reach', ar:'الوصول العالمي', fr:'Portée mondiale', tr:'Küresel Erişim' }, desc: { en:'Serving businesses across the Middle East, Europe, Africa, and beyond.', ar:'نخدم الشركات في الشرق الأوسط وأوروبا وأفريقيا وما هو أبعد.', fr:'Au service d\'entreprises à travers le Moyen-Orient, l\'Europe, l\'Afrique.', tr:'Orta Doğu, Avrupa, Afrika ve ötesinde işletmelere hizmet veriyoruz.' } },
  { icon: EyeIcon, title: { en:'Transparency', ar:'الشفافية', fr:'Transparence', tr:'Şeffaflık' }, desc: { en:'No hidden fees. No lock-ins. Honest pricing, honest communication, and honest support.', ar:'لا رسوم خفية. لا إلزام. أسعار صادقة وتواصل صادق ودعم صادق.', fr:'Pas de frais cachés. Pas de verrouillage. Tarifs honnêtes.', tr:'Gizli ücret yok. Kilitlenme yok. Dürüst fiyatlandırma ve dürüst destek.' } },
]

const WABEK_POINTS = [
  { icon: InboxStackIcon, title: {en:'Live Chat Inbox',ar:'صندوق المحادثات المباشرة',fr:'Boîte de réception',tr:'Canlı Sohbet Gelen Kutusu'}, desc: {en:'Manage all WhatsApp conversations from one shared inbox.',ar:'أدر جميع محادثات واتساب من صندوق وارد مشترك واحد.',fr:'Gérez toutes les conversations WhatsApp depuis une boîte de réception partagée.',tr:'Tüm WhatsApp konuşmalarını tek bir paylaşımlı gelen kutusundan yönetin.'} },
  { icon: MegaphoneIcon, title: {en:'Bulk Campaigns',ar:'حملات جماعية',fr:'Campagnes en masse',tr:'Toplu Kampanyalar'}, desc: {en:'Send personalised WhatsApp messages to thousands of contacts at once.',ar:'أرسل رسائل واتساب مخصصة لآلاف جهات الاتصال دفعة واحدة.',fr:'Envoyez des messages WhatsApp personnalisés à des milliers de contacts.',tr:'Binlerce kişiye aynı anda kişiselleştirilmiş WhatsApp mesajları gönderin.'} },
  { icon: ChatBubbleLeftRightIcon, title: {en:'Chatbot Builder',ar:'منشئ الشات بوت',fr:'Constructeur de chatbot',tr:'Chatbot Oluşturucu'}, desc: {en:'Build powerful WhatsApp chatbots with no coding required.',ar:'بنِ روبوتات دردشة واتساب قوية بدون أي كتابة كود.',fr:'Créez des chatbots WhatsApp puissants sans coder.',tr:'Kod yazmadan güçlü WhatsApp chatbotları oluşturun.'} },
  { icon: DevicePhoneMobileIcon, title: {en:'Multi-Instance',ar:'أرقام متعددة',fr:'Multi-instance',tr:'Çoklu Hesap'}, desc: {en:'Connect multiple WhatsApp numbers and manage them from one dashboard.',ar:'اربط أرقام واتساب متعددة وأدرها من لوحة تحكم واحدة.',fr:'Connectez plusieurs numéros WhatsApp et gérez-les depuis un tableau de bord.',tr:'Birden fazla WhatsApp numarasını bağlayın ve tek panelden yönetin.'} },
]

const LANGS: L[] = [
  { en: 'Arabic', ar: 'العربية', fr: 'Arabe', tr: 'Arapça' },
  { en: 'English', ar: 'الإنجليزية', fr: 'Anglais', tr: 'İngilizce' },
  { en: 'French', ar: 'الفرنسية', fr: 'Français', tr: 'Fransızca' },
  { en: 'Turkish', ar: 'التركية', fr: 'Turc', tr: 'Türkçe' },
]
const REGIONS: L[] = [
  { en: 'UK', ar: 'المملكة المتحدة', fr: 'Royaume-Uni', tr: 'İngiltere' },
  { en: 'Egypt', ar: 'مصر', fr: 'Égypte', tr: 'Mısır' },
  { en: 'Turkey', ar: 'تركيا', fr: 'Turquie', tr: 'Türkiye' },
  { en: 'Global', ar: 'حول العالم', fr: 'International', tr: 'Küresel' },
]

const ext = { target: '_blank', rel: 'noopener noreferrer' }

export default function AboutPage() {
  const { brandName } = useWhiteLabel()
  const name = brandName || 'WABEK'
  const { lang, setLang, dir, pick } = usePublicLang()
  const tx = (key: string) => T(lang, key)
  const outArrow = <ArrowTopRightOnSquareIcon className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />

  const facts = [
    { icon: CalendarDaysIcon, label: tx('founded'), value: '2024' },
    { icon: BuildingOffice2Icon, label: tx('registered'), value: 'UK' },
    { icon: HashtagIcon, label: tx('company_no'), value: '16326894' },
    { icon: LanguageIcon, label: tx('languages'), value: '4' },
  ]

  return (<>
    <Head>
      <link rel="icon" href={LOGO} />
      <title>{`${tx('page_title')} | ${name}`}</title>
      <meta name="description" content={tx('hero_sub')} />
    </Head>
    <MarketingPage
      active="/about"
      lang={lang}
      dir={dir}
      onLangChange={setLang}
      hero={
        <PageHero
          eyebrow={<span dir="ltr">WEBEK LTD · Company No. 16326894</span>}
          title={tx('hero_title')}
          subtitle={tx('hero_sub')}
          actions={
            <>
              <Button href="/auth/register" size="lg" className="rounded-[14px] px-7 shadow-glow">{tx('get_started')}</Button>
              <Button href="https://webek.org" variant="on-deep-ghost" size="lg" iconEnd={ArrowTopRightOnSquareIcon} className="rounded-[14px] px-7 rtl:[&_svg]:-scale-x-100">webek.org</Button>
            </>
          }
        >
          <dl className="mt-6 grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            {facts.map(f => (
              <div key={f.label} className="flex flex-col items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-4">
                <dt className="order-2 text-xs text-deep-muted">{f.label}</dt>
                <dd className="tabular order-1 text-2xl font-bold text-deep-ink" dir="ltr">{f.value}</dd>
              </div>
            ))}
          </dl>
        </PageHero>
      }
    >
      {/* Mission + company */}
      <Section className="pt-14 sm:pt-20">
        <div className="grid gap-6 lg:grid-cols-2">
          <article className="flex flex-col gap-4 rounded-card border border-line bg-surface p-7 shadow-card sm:p-8">
            <IconTile icon={LightBulbIcon} tone="warning" />
            <h2 className="text-2xl font-bold text-ink">{tx('mission_title')}</h2>
            <p className="text-base leading-[1.95] text-body">{tx('mission_body')}</p>
          </article>
          <article className="flex flex-col gap-4 rounded-card border border-line bg-surface p-7 shadow-card sm:p-8">
            <IconTile icon={BuildingOffice2Icon} />
            <h2 className="text-2xl font-bold text-ink">{tx('company_title')}</h2>
            <p className="text-base leading-[1.95] text-body">{tx('company_body')}</p>
            <dl className="mt-2 grid gap-4 rounded-2xl bg-surface-2 p-5 text-sm">
              <div className="flex gap-3">
                <MapPinIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-ink" aria-hidden="true" />
                <div>
                  <dt className="font-semibold text-ink">{tx('address_label')}</dt>
                  <dd className="mt-0.5 leading-relaxed text-body" dir="ltr">71-75 Shelton Street, Covent Garden<br />London, WC2H 9JQ<br />United Kingdom</dd>
                </div>
              </div>
              <div className="flex gap-3">
                <HashtagIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-ink" aria-hidden="true" />
                <div>
                  <dt className="font-semibold text-ink">{tx('company_no')}</dt>
                  <dd className="tabular mt-0.5 text-body">16326894</dd>
                </div>
              </div>
              <div className="flex gap-3">
                <GlobeAltIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-ink" aria-hidden="true" />
                <div>
                  <dt className="font-semibold text-ink">{tx('websites')}</dt>
                  <dd className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 font-semibold" dir="ltr">
                    <a href="https://webek.org" {...ext}>webek.org</a>
                    <a href="https://www.webek.uk" {...ext}>webek.uk</a>
                    <a href="https://waabek.com" {...ext}>waabek.com</a>
                  </dd>
                </div>
              </div>
            </dl>
          </article>
        </div>
      </Section>

      {/* What is WABEK */}
      <Section className="pt-0">
        <div className="grid items-start gap-10 rounded-[30px] bg-[#04282C] p-7 text-deep-ink sm:p-10 lg:grid-cols-2 lg:gap-14">
          <div className="flex flex-col gap-4">
            <span className="w-fit rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-brand-green" dir="ltr">WABEK</span>
            <h2 className="text-[28px] font-bold leading-tight text-deep-ink sm:text-[34px]">{tx('wabek_title')}</h2>
            <p className="text-base leading-[1.95] text-deep-muted">{tx('wabek_body1')}</p>
            <p className="text-base leading-[1.95] text-deep-muted">{tx('wabek_body2')}</p>
          </div>
          <ul className="flex flex-col gap-3">
            {WABEK_POINTS.map((f, i) => (
              <li key={i} className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                <IconTile icon={f.icon} tone="deep" size="sm" />
                <div>
                  <p className="font-semibold text-deep-ink">{pick(f.title)}</p>
                  <p className="mt-1 text-sm leading-relaxed text-deep-muted">{pick(f.desc)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* WEBEK services */}
      <Section eyebrow={<span dir="ltr">WEBEK LTD</span>} title={tx('services_title')} subtitle={tx('services_sub')} className="pt-4">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map(svc => (
            <li key={svc.href} className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6 shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-card-hover">
              <IconTile icon={svc.icon} />
              <h3 className="text-[17px] font-semibold text-ink">{pick(svc.title)}</h3>
              <p className="flex-1 text-[15px] leading-[1.85] text-body">{pick(svc.desc)}</p>
              <a href={svc.href} {...ext} className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold">
                {pick(svc.cta)} {outArrow}
              </a>
            </li>
          ))}
        </ul>
      </Section>

      {/* Values */}
      <Section title={tx('values_title')} className="pt-4">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((v, i) => (
            <li key={i} className="flex flex-col gap-3 rounded-card bg-surface-2 p-6 ring-1 ring-line">
              <IconTile icon={v.icon} tone={(['brand', 'warning', 'success', 'violet'] as const)[i]} />
              <h3 className="text-base font-semibold text-ink">{pick(v.title)}</h3>
              <p className="text-sm leading-[1.8] text-body">{pick(v.desc)}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* Team + languages */}
      <Section className="pt-4">
        <div className="grid items-center gap-10 rounded-[30px] border border-line bg-surface p-7 shadow-card sm:p-10 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <h2 className="text-[28px] font-bold text-ink sm:text-[34px]">{tx('team_title')}</h2>
            <p className="text-base leading-[1.95] text-body">{tx('team_body')}</p>
            <ul className="flex flex-wrap gap-2 pt-2">
              {REGIONS.map((r, i) => (
                <li key={i} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3.5 py-1.5 text-sm font-medium text-ink">
                  <MapPinIcon className="h-4 w-4 text-brand-ink" aria-hidden="true" />{pick(r)}
                </li>
              ))}
            </ul>
          </div>
          <ul className="grid grid-cols-2 gap-3">
            {LANGS.map((l, i) => (
              <li key={i} className="flex flex-col items-center gap-2 rounded-2xl bg-surface-2 p-5 text-center ring-1 ring-line">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-gradient text-sm font-bold text-[#04282C]" dir="ltr" aria-hidden="true">
                  {(['AR', 'EN', 'FR', 'TR'])[i]}
                </span>
                <span className="text-sm font-semibold text-ink">{pick(l)}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* Contact */}
      <Section id="contact" title={tx('contact_label')} className="pt-4" narrow>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { label: tx('region_uk'), tel: '+447878704062', shown: '+44 7878 704062', wa: 'https://wa.me/447878704062' },
            { label: tx('region_mena'), tel: '+905418477976', shown: '+90 541 847 79 76', wa: 'https://wa.me/905418477976' },
          ].map(c => (
            <div key={c.tel} className="flex flex-col gap-2 rounded-card border border-line bg-surface p-6 shadow-card">
              <span className="text-xs font-semibold text-muted">{c.label}</span>
              <a href={`tel:${c.tel}`} className="inline-flex items-center gap-2 text-lg font-bold" dir="ltr">
                <PhoneIcon className="h-5 w-5" aria-hidden="true" />{c.shown}
              </a>
              <a href={c.wa} {...ext} className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold">
                WhatsApp {outArrow}
              </a>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a href="mailto:support@waabek.com" className="inline-flex items-center gap-2 rounded-btn border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink hover:border-line-strong" dir="ltr">
            <EnvelopeIcon className="h-4 w-4 text-brand-ink" aria-hidden="true" />support@waabek.com
          </a>
          <Button href="/status" variant="secondary" size="sm">{tx('status_page')}</Button>
          <Button href="/support" variant="secondary" size="sm">{tx('support')}</Button>
          <Button href="https://webek.org" variant="ghost" size="sm">webek.org</Button>
          <Button href="https://www.webek.uk" variant="ghost" size="sm">webek.uk</Button>
        </div>
      </Section>

      <CtaBand
        title={tx('cta_title')}
        subtitle={tx('cta_sub')}
        actions={<Button href="/auth/register" size="xl" className="rounded-2xl px-8 text-lg font-bold">{tx('get_started')}</Button>}
      />
    </MarketingPage>
  </>)
}
