// @ts-nocheck
import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import PublicNav from '@/components/PublicNav'
import PublicFooter from '@/components/PublicFooter'

const LOGO = 'https://res.cloudinary.com/dkl7ntpgw/image/upload/f_auto,q_auto/%D8%AA%D8%B5%D9%85%D9%8A%D9%85_%D8%A8%D8%AF%D9%88%D9%86_%D8%B9%D9%86%D9%88%D8%A7%D9%86_1_kejdrs'

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
  cta_sub:      { en:'Join thousands of businesses using WABEK to save time and grow faster.', ar:'انضم إلى آلاف الشركات التي تستخدم WABEK لتوفير الوقت والنمو بشكل أسرع.', fr:'Rejoignez des milliers d\'entreprises utilisant WABEK.', tr:'Zaman kazanmak ve daha hızlı büyümek için WABEK kullanan binlerce işletmeye katılın.' },
  get_started:  { en:'Get Started Free', ar:'ابدأ مجاناً', fr:'Commencer Gratuitement', tr:'Ücretsiz Başla' },
  visit:        { en:'Visit Website', ar:'زيارة الموقع', fr:'Visiter le site', tr:'Web sitesini ziyaret et' },
  reg_uk:       { en:'UK Registered Company', ar:'شركة مسجلة في المملكة المتحدة', fr:'Société enregistrée au Royaume-Uni', tr:'İngiltere\'de Kayıtlı Şirket' },
  address_label:{ en:'Registered Address', ar:'العنوان المسجل', fr:'Adresse enregistrée', tr:'Kayıtlı Adres' },
  company_no:   { en:'Company Number', ar:'رقم الشركة', fr:'Numéro d\'entreprise', tr:'Şirket Numarası' },
  contact_label:{ en:'Get in Touch', ar:'تواصل معنا', fr:'Nous Contacter', tr:'İletişime Geçin' },
}

const T = (lang: string, key: string) => S[key]?.[lang] || S[key]?.en || key

const SERVICES = [
  {
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg>`,
    title: { en:'Web Hosting', ar:'استضافة المواقع', fr:'Hébergement Web', tr:'Web Hosting' },
    desc: { en:'Shared, WordPress, and reseller hosting with 99.9% uptime, free SSL, and one-click installs.', ar:'استضافة مشتركة وووردبريس وإعادة البيع مع 99.9% وقت تشغيل وشهادة SSL مجانية.', fr:'Hébergement partagé, WordPress et revendeur avec 99.9% de disponibilité, SSL gratuit.', tr:'%99.9 çalışma süresi ve ücretsiz SSL ile paylaşımlı, WordPress ve bayi hosting.' },
    href: 'https://webek.org/shared-hosting',
    cta: { en:'View Plans', ar:'عرض الخطط', fr:'Voir les plans', tr:'Planları Gör' },
  },
  {
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>`,
    title: { en:'Website Design', ar:'تصميم المواقع', fr:'Conception de sites web', tr:'Web Tasarımı' },
    desc: { en:'Professional website design and development packages — from starter sites to enterprise-level builds.', ar:'حزم تصميم وتطوير مواقع احترافية، من المواقع المبتدئة إلى حلول المؤسسات.', fr:'Packages de conception et développement de sites Web professionnels.', tr:'Başlangıç sitelerinden kurumsal yapılara kadar profesyonel web tasarımı paketleri.' },
    href: 'https://webek.org/wordpress',
    cta: { en:'View Packages', ar:'عرض الحزم', fr:'Voir les packages', tr:'Paketleri Gör' },
  },
  {
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`,
    title: { en:'Mobile App Development', ar:'تطوير تطبيقات الجوال', fr:'Développement d\'applications mobiles', tr:'Mobil Uygulama Geliştirme' },
    desc: { en:'Custom iOS and Android mobile app development for businesses ready to go mobile.', ar:'تطوير تطبيقات جوال مخصصة لنظامي iOS وAndroid للشركات الراغبة في التحول للجوال.', fr:'Développement d\'applications mobiles iOS et Android sur mesure.', tr:'Mobil\'e geçmeye hazır işletmeler için özel iOS ve Android uygulama geliştirme.' },
    href: 'https://www.webek.uk/mobileapp',
    cta: { en:'Learn More', ar:'اعرف المزيد', fr:'En savoir plus', tr:'Daha Fazla' },
  },
  {
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-4 0v2M8 11h.01M16 11h.01M12 15h.01"/></svg>`,
    title: { en:'AI & Automation', ar:'الذكاء الاصطناعي والأتمتة', fr:'IA & Automatisation', tr:'Yapay Zeka & Otomasyon' },
    desc: { en:'AI-powered systems and business automation tools, including WABEK, our flagship WhatsApp automation platform.', ar:'أنظمة مدعومة بالذكاء الاصطناعي وأدوات أتمتة الأعمال، بما في ذلك WABEK، منصة أتمتة واتساب الرائدة.', fr:'Systèmes alimentés par l\'IA et outils d\'automatisation, dont WABEK.', tr:'WABEK dahil yapay zeka destekli sistemler ve iş otomasyon araçları.' },
    href: 'https://waabek.com',
    cta: { en:'Try WABEK', ar:'جرّب WABEK', fr:'Essayer WABEK', tr:'WABEK\'i Dene' },
  },
  {
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg>`,
    title: { en:'Domain Names', ar:'أسماء النطاقات', fr:'Noms de domaine', tr:'Alan Adları' },
    desc: { en:'Register, transfer, or manage your domain names with ease. Competitive prices and full management tools.', ar:'سجّل أو انقل أو أدر أسماء نطاقاتك بسهولة. أسعار تنافسية وأدوات إدارة كاملة.', fr:'Enregistrez, transférez ou gérez vos noms de domaine. Prix compétitifs.', tr:'Alan adlarınızı kolayca kaydedin, aktarın veya yönetin. Rekabetçi fiyatlar.' },
    href: 'https://webek.org/domain-names',
    cta: { en:'Search Domains', ar:'ابحث عن النطاقات', fr:'Rechercher des domaines', tr:'Domain Ara' },
  },
  {
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`,
    title: { en:'SSL Certificates', ar:'شهادات SSL', fr:'Certificats SSL', tr:'SSL Sertifikaları' },
    desc: { en:'Free SSL with every hosting plan. Secure your website and build customer trust with HTTPS.', ar:'شهادة SSL مجانية مع كل خطة استضافة. أمّن موقعك وابنِ ثقة العملاء مع HTTPS.', fr:'SSL gratuit avec chaque plan d\'hébergement. Sécurisez votre site.', tr:'Her hosting planıyla ücretsiz SSL. HTTPS ile sitenizi güvenceye alın.' },
    href: 'https://webek.org',
    cta: { en:'Get SSL', ar:'احصل على SSL', fr:'Obtenir SSL', tr:'SSL Al' },
  },
]

const VALUES = [
  { icon:`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22V12M20 22V8l-8-6-8 6v14"/><path d="M9 22V12h6v10"/></svg>`, title:{ en:'Reliability', ar:'الموثوقية', fr:'Fiabilité', tr:'Güvenilirlik' }, desc:{ en:'99.9% uptime guarantee across all our services. Your business never stops.', ar:'ضمان وقت تشغيل 99.9% عبر جميع خدماتنا. عملك لا يتوقف أبداً.', fr:'Garantie de disponibilité de 99.9%. Votre entreprise ne s\'arrête jamais.', tr:'Tüm hizmetlerimizde %99.9 çalışma süresi garantisi.' } },
  { icon:`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="4"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/><circle cx="12" cy="12" r="4"/></svg>`, title:{ en:'Innovation', ar:'الابتكار', fr:'Innovation', tr:'İnovasyon' }, desc:{ en:'We build the tools we wish existed. From AI chatbots to WhatsApp automation, always ahead of the curve.', ar:'نبني الأدوات التي تمنينا وجودها. من روبوتات الدردشة بالذكاء الاصطناعي إلى أتمتة واتساب.', fr:'Nous construisons les outils que nous souhaitons voir exister.', tr:'Var olmasını istediğimiz araçları inşa ediyoruz.' } },
  { icon:`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg>`, title:{ en:'Global Reach', ar:'الوصول العالمي', fr:'Portée mondiale', tr:'Küresel Erişim' }, desc:{ en:'Serving businesses in 50+ countries across the Middle East, Europe, Africa, and beyond.', ar:'نخدم الشركات في أكثر من 50 دولة في الشرق الأوسط وأوروبا وأفريقيا وما هو أبعد.', fr:'Au service d\'entreprises dans 50+ pays à travers le Moyen-Orient, l\'Europe, l\'Afrique.', tr:'Orta Doğu, Avrupa, Afrika ve ötesinde 50+ ülkede işletmelere hizmet veriyoruz.' } },
  { icon:`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>`, title:{ en:'Transparency', ar:'الشفافية', fr:'Transparence', tr:'Şeffaflık' }, desc:{ en:'No hidden fees. No lock-ins. Honest pricing, honest communication, and honest support.', ar:'لا رسوم خفية. لا إلزام. أسعار صادقة وتواصل صادق ودعم صادق.', fr:'Pas de frais cachés. Pas de verrouillage. Tarifs honnêtes.', tr:'Gizli ücret yok. Kilitlenme yok. Dürüst fiyatlandırma ve dürüst destek.' } },
]

export default function AboutPage() {
  const { brandName } = useWhiteLabel()
  const name = brandName || 'WABEK'
  const [lang, setLang] = useState<string>(() => typeof window !== 'undefined' ? localStorage.getItem('lang') || 'en' : 'en')
  const isRTL = lang === 'ar'
  const dir = isRTL ? 'rtl' : 'ltr'

  useEffect(() => {
    const h = (e:any) => { setLang(e.detail); localStorage.setItem('lang', e.detail) }
    window.addEventListener('langchange', h)
    return () => window.removeEventListener('langchange', h)
  }, [])

  return (<>
    <Head>
      <link rel="icon" href={LOGO} />
      <title>{T(lang,'page_title')} | {name}</title>
      <meta name="description" content={T(lang,'hero_sub')} />
    </Head>
    <div style={{background:'#fff',minHeight:'100vh',direction:dir}}>
      <PublicNav active="/about" onLangChange={setLang} />
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111b21}
        .sw{max-width:1100px;margin:0 auto;padding:0 24px}
        .grid2{display:grid;grid-template-columns:1fr 1fr;gap:24px}
        .grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
        .grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}
        .svc-card{background:#fff;border:1px solid #e9edef;border-radius:16px;padding:28px 24px;transition:all .2s;display:flex;flex-direction:column}
        .svc-card:hover{border-color:#25D366;box-shadow:0 8px 32px rgba(37,211,102,.1);transform:translateY(-3px)}
        .val-card{background:#f9fafb;border-radius:16px;padding:24px}
        @media(max-width:900px){.grid3{grid-template-columns:repeat(2,1fr)}.grid4{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:560px){.grid2,.grid3,.grid4{grid-template-columns:1fr}}
      `}</style>

      {/* ── Hero ── */}
      <section style={{background:'linear-gradient(135deg,#f0fdf4 0%,#fff 60%)',padding:'80px 0 60px',borderBottom:'1px solid #e9edef'}}>
        <div className="sw" style={{textAlign:'center'}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:8,background:'#fff',border:'1px solid #e9edef',borderRadius:100,padding:'6px 18px',fontSize:12,fontWeight:700,color:'#25D366',marginBottom:20,boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2.5" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            WEBEK LTD • Company No. 16326894
          </div>
          <h1 style={{fontSize:'clamp(28px,5vw,52px)',fontWeight:900,lineHeight:1.1,marginBottom:20,color:'#111b21'}}>{T(lang,'hero_title')}</h1>
          <p style={{fontSize:18,color:'#54656f',maxWidth:620,margin:'0 auto 32px',lineHeight:1.7}}>{T(lang,'hero_sub')}</p>
          <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
            <Link href="/auth/register" style={{background:'#25D366',color:'#0F172A',padding:'13px 30px',borderRadius:10,fontSize:15,fontWeight:700,textDecoration:'none'}}>{T(lang,'get_started')} →</Link>
            <a href="https://webek.org" target="_blank" rel="noopener" style={{background:'#fff',color:'#374151',padding:'13px 30px',borderRadius:10,fontSize:15,fontWeight:600,textDecoration:'none',border:'1px solid #e9edef'}}>webek.org ↗</a>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section style={{padding:'48px 0',borderBottom:'1px solid #f3f4f6'}}>
        <div className="sw">
          <div className="grid4">
            {[
              { n:'2024', l:{ en:'Founded', ar:'سنة التأسيس', fr:'Fondée en', tr:'Kuruluş' } },
              { n:'UK', l:{ en:'Registered', ar:'مسجلة في', fr:'Enregistrée au', tr:'Kayıtlı' } },
              { n:'50+', l:{ en:'Countries served', ar:'دولة نخدمها', fr:'Pays desservis', tr:'Hizmet verilen ülke' } },
              { n:'4', l:{ en:'Products & services', ar:'منتجات وخدمات', fr:'Produits & services', tr:'Ürünler & hizmetler' } },
            ].map(s => (
              <div key={s.n} style={{textAlign:'center',padding:'20px 16px',background:'#f9fafb',borderRadius:14}}>
                <p style={{fontSize:32,fontWeight:900,color:'#25D366',marginBottom:4}}>{s.n}</p>
                <p style={{fontSize:13,color:'#54656f'}}>{s.l[lang]||s.l.en}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Mission + Company ── */}
      <section style={{padding:'72px 0',borderBottom:'1px solid #f3f4f6'}}>
        <div className="sw">
          <div className="grid2" style={{gap:48,alignItems:'start'}}>
            <div>
              <span style={{display:'inline-block',background:'#f0fdf4',color:'#25D366',borderRadius:8,padding:'4px 14px',fontSize:12,fontWeight:700,marginBottom:16,border:'1px solid #bbf7d0'}}>🎯 {T(lang,'mission_title')}</span>
              <h2 style={{fontSize:'clamp(22px,3vw,32px)',fontWeight:800,marginBottom:16,color:'#111b21',lineHeight:1.2}}>{T(lang,'mission_title')}</h2>
              <p style={{fontSize:16,color:'#54656f',lineHeight:1.8}}>{T(lang,'mission_body')}</p>
            </div>
            <div>
              <span style={{display:'inline-block',background:'#eef2ff',color:'#4338ca',borderRadius:8,padding:'4px 14px',fontSize:12,fontWeight:700,marginBottom:16,border:'1px solid #c7d2fe'}}>🏢 {T(lang,'company_title')}</span>
              <h2 style={{fontSize:'clamp(22px,3vw,32px)',fontWeight:800,marginBottom:16,color:'#111b21',lineHeight:1.2}}>{T(lang,'company_title')}</h2>
              <p style={{fontSize:16,color:'#54656f',lineHeight:1.8,marginBottom:20}}>{T(lang,'company_body')}</p>
              <div style={{background:'#f9fafb',border:'1px solid #e9edef',borderRadius:12,padding:'20px',fontSize:13}}>
                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                  <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
                    <span style={{color:'#25D366',flexShrink:0}}>📌</span>
                    <div>
                      <p style={{fontWeight:700,color:'#111b21',marginBottom:2}}>{T(lang,'address_label')}</p>
                      <p style={{color:'#54656f',lineHeight:1.6}}>71-75 Shelton Street, Covent Garden<br/>London, WC2H 9JQ<br/>United Kingdom</p>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:12}}>
                    <span style={{color:'#25D366'}}>🔢</span>
                    <div>
                      <p style={{fontWeight:700,color:'#111b21',marginBottom:2}}>{T(lang,'company_no')}</p>
                      <p style={{color:'#54656f'}}>16326894</p>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:12}}>
                    <span style={{color:'#25D366'}}>🌐</span>
                    <div>
                      <p style={{fontWeight:700,color:'#111b21',marginBottom:2}}>Websites</p>
                      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                        <a href="https://webek.org" target="_blank" style={{color:'#25D366',fontWeight:600}}>webek.org</a>
                        <span style={{color:'#d1d5db'}}>·</span>
                        <a href="https://www.webek.uk" target="_blank" style={{color:'#25D366',fontWeight:600}}>webek.uk</a>
                        <span style={{color:'#d1d5db'}}>·</span>
                        <a href="https://waabek.com" target="_blank" style={{color:'#25D366',fontWeight:600}}>waabek.com</a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── What is WABEK ── */}
      <section style={{padding:'72px 0',borderBottom:'1px solid #f3f4f6'}}>
        <div className="sw">
          <div className="grid2" style={{gap:48,alignItems:'start'}}>
            <div>
              <span style={{display:'inline-block',background:'#f0fdf4',color:'#25D366',borderRadius:8,padding:'4px 14px',fontSize:12,fontWeight:700,marginBottom:16,border:'1px solid #bbf7d0'}}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2.5" strokeLinecap="round" style={{display:'inline',marginInlineEnd:4}}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                WABEK
              </span>
              <h2 style={{fontSize:'clamp(22px,3vw,34px)',fontWeight:900,marginBottom:16,color:'#111b21',lineHeight:1.2}}>{T(lang,'wabek_title')}</h2>
              <p style={{fontSize:15,color:'#54656f',lineHeight:1.8,marginBottom:16}}>{T(lang,'wabek_body1')}</p>
              <p style={{fontSize:15,color:'#54656f',lineHeight:1.8}}>{T(lang,'wabek_body2')}</p>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              {[
                {icon:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>', title:{en:'Live Chat Inbox',ar:'صندوق المحادثات المباشرة',fr:'Boîte de réception',tr:'Canlı Sohbet Gelen Kutusu'}, desc:{en:'Manage all WhatsApp conversations from one shared inbox.',ar:'أدر جميع محادثات واتساب من صندوق وارد مشترك واحد.',fr:'Gérez toutes les conversations WhatsApp depuis une boîte de réception partagée.',tr:'Tüm WhatsApp konuşmalarını tek bir paylaşımlı gelen kutusundan yönetin.'}},
                {icon:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2L15 22 11 13 2 9l20-7z"/></svg>', title:{en:'Bulk Campaigns',ar:'حملات جماعية',fr:'Campagnes en masse',tr:'Toplu Kampanyalar'}, desc:{en:'Send personalised WhatsApp messages to thousands of contacts at once.',ar:'أرسل رسائل واتساب مخصصة لآلاف جهات الاتصال دفعة واحدة.',fr:'Envoyez des messages WhatsApp personnalisés à des milliers de contacts.',tr:'Binlerce kişiye aynı anda kişiselleştirilmiş WhatsApp mesajları gönderin.'}},
                {icon:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-4 0v2M8 11h.01M16 11h.01"/></svg>', title:{en:'Chatbot Builder',ar:'منشئ الشات بوت',fr:'Constructeur de chatbot',tr:'Chatbot Oluşturucu'}, desc:{en:'Build powerful WhatsApp chatbots with no coding required.',ar:'بنِ روبوتات دردشة واتساب قوية بدون أي كتابة كود.',fr:'Créez des chatbots WhatsApp puissants sans coder.',tr:'Kod yazmadan güçlü WhatsApp chatbotları oluşturun.'}},
                {icon:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>', title:{en:'Multi-Instance',ar:'متعدد المثيلات',fr:'Multi-instance',tr:'Çoklu Hesap'}, desc:{en:'Connect multiple WhatsApp numbers and manage them from one dashboard.',ar:'اربط أرقام واتساب متعددة وأدرها من لوحة تحكم واحدة.',fr:'Connectez plusieurs numéros WhatsApp et gérez-les depuis un tableau de bord.',tr:'Birden fazla WhatsApp numarasını bağlayın ve tek panelden yönetin.'}},
              ].map((f,i)=>(
                <div key={i} style={{display:'flex',gap:14,alignItems:'flex-start',background:'#f9fafb',borderRadius:12,padding:'16px'}}>
                  <div style={{width:36,height:36,borderRadius:8,background:'#f0fdf4',border:'1px solid #bbf7d0',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}} dangerouslySetInnerHTML={{__html:f.icon}} />
                  <div>
                    <p style={{fontWeight:700,color:'#111b21',fontSize:14,marginBottom:4}}>{f.title[lang]||f.title.en}</p>
                    <p style={{color:'#54656f',fontSize:13,lineHeight:1.6}}>{f.desc[lang]||f.desc.en}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── WEBEK Services ── */}
      <section style={{padding:'72px 0',background:'#f9fafb',borderBottom:'1px solid #f3f4f6'}}>
        <div className="sw">
          <div style={{textAlign:'center',marginBottom:48}}>
            <span style={{display:'inline-block',background:'#fff',border:'1px solid #e9edef',borderRadius:100,padding:'6px 18px',fontSize:12,fontWeight:700,color:'#374151',marginBottom:16}}>🛠️ WEBEK LTD</span>
            <h2 style={{fontSize:'clamp(24px,4vw,36px)',fontWeight:900,marginBottom:12,color:'#111b21'}}>{T(lang,'services_title')}</h2>
            <p style={{fontSize:16,color:'#54656f',maxWidth:500,margin:'0 auto'}}>{T(lang,'services_sub')}</p>
          </div>
          <div className="grid3">
            {SERVICES.map(svc => (
              <div key={svc.href} className="svc-card">
                <div style={{width:48,height:48,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:16}} dangerouslySetInnerHTML={{__html:svc.icon}} />
                <h3 style={{fontSize:17,fontWeight:800,color:'#111b21',marginBottom:10}}>{svc.title[lang]||svc.title.en}</h3>
                <p style={{fontSize:14,color:'#54656f',lineHeight:1.7,flex:1,marginBottom:20}}>{svc.desc[lang]||svc.desc.en}</p>
                <a href={svc.href} target="_blank" rel="noopener"
                  style={{display:'inline-flex',alignItems:'center',gap:6,color:'#25D366',fontWeight:700,fontSize:14,textDecoration:'none'}}>
                  {svc.cta[lang]||svc.cta.en} <span>↗</span>
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Values ── */}
      <section style={{padding:'72px 0',borderBottom:'1px solid #f3f4f6'}}>
        <div className="sw">
          <div style={{textAlign:'center',marginBottom:48}}>
            <h2 style={{fontSize:'clamp(24px,4vw,36px)',fontWeight:900,color:'#111b21'}}>{T(lang,'values_title')}</h2>
          </div>
          <div className="grid4">
            {VALUES.map(v => (
              <div key={v.icon} className="val-card">
                <div style={{width:40,height:40,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:12}} dangerouslySetInnerHTML={{__html:v.icon}} />
                <h3 style={{fontSize:15,fontWeight:800,color:'#111b21',marginBottom:8}}>{v.title[lang]||v.title.en}</h3>
                <p style={{fontSize:13,color:'#54656f',lineHeight:1.6}}>{v.desc[lang]||v.desc.en}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Global Team ── */}
      <section style={{padding:'72px 0',background:'#f9fafb',borderBottom:'1px solid #f3f4f6'}}>
        <div className="sw">
          <div className="grid2" style={{alignItems:'center',gap:48}}>
            <div>
              <h2 style={{fontSize:'clamp(24px,4vw,36px)',fontWeight:900,color:'#111b21',marginBottom:16}}>{T(lang,'team_title')}</h2>
              <p style={{fontSize:16,color:'#54656f',lineHeight:1.8}}>{T(lang,'team_body')}</p>
              <div style={{display:'flex',gap:12,marginTop:24,flexWrap:'wrap'}}>
                {['🇬🇧 UK','🇪🇬 Egypt','🇹🇷 Turkey','🌍 Global'].map(f => (
                  <span key={f} style={{background:'#fff',border:'1px solid #e9edef',borderRadius:100,padding:'6px 16px',fontSize:13,fontWeight:600,color:'#374151'}}>{f}</span>
                ))}
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              {[
                {n:'🇸🇦',l:{en:'Arabic',ar:'العربية',fr:'Arabe',tr:'Arapça'}},
                {n:'🇺🇸',l:{en:'English',ar:'الإنجليزية',fr:'Anglais',tr:'İngilizce'}},
                {n:'🇫🇷',l:{en:'French',ar:'الفرنسية',fr:'Français',tr:'Fransızca'}},
                {n:'🇹🇷',l:{en:'Turkish',ar:'التركية',fr:'Turc',tr:'Türkçe'}},
              ].map(lng => (
                <div key={lng.n} style={{background:'#fff',border:'1px solid #e9edef',borderRadius:12,padding:'20px',textAlign:'center'}}>
                  <div style={{fontSize:28,marginBottom:6}}>{lng.n}</div>
                  <p style={{fontSize:13,fontWeight:600,color:'#374151'}}>{lng.l[lang]||lng.l.en}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Contact ── */}
      <section style={{padding:'72px 0',borderBottom:'1px solid #f3f4f6'}}>
        <div className="sw" style={{textAlign:'center'}}>
          <h2 style={{fontSize:'clamp(22px,4vw,32px)',fontWeight:900,marginBottom:8,color:'#111b21'}}>{T(lang,'contact_label')}</h2>
          <p style={{fontSize:15,color:'#54656f',marginBottom:16}}>support@waabek.com</p>
          <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:24,maxWidth:400,margin:'0 auto 24px'}}>
            <div style={{background:'#f9fafb',border:'1px solid #e9edef',borderRadius:12,padding:'14px 18px',textAlign:isRTL?'right':'left'}}>
              <p style={{fontSize:11,fontWeight:700,color:'#8696a0',textTransform:'uppercase',letterSpacing:.5,marginBottom:4}}>
                {{'en':'🇬🇧 UK / Europe / Americas','ar':'🇬🇧 المملكة المتحدة / أوروبا / أمريكا','fr':'🇬🇧 Royaume-Uni / Europe / Amériques','tr':'🇬🇧 İngiltere / Avrupa / Amerika'}[lang]||'🇬🇧 UK / Europe / Americas'}
              </p>
              <a href="tel:+447878704062" style={{fontSize:18,fontWeight:800,color:'#25D366',textDecoration:'none'}}>+44 7878 704062</a>
              <p style={{fontSize:11,color:'#adb5bd',marginTop:2}}>
                <a href="https://wa.me/447878704062" target="_blank" style={{color:'#25D366',fontWeight:600,textDecoration:'none'}}>WhatsApp ↗</a>
              </p>
            </div>
            <div style={{background:'#f9fafb',border:'1px solid #e9edef',borderRadius:12,padding:'14px 18px',textAlign:isRTL?'right':'left'}}>
              <p style={{fontSize:11,fontWeight:700,color:'#8696a0',textTransform:'uppercase',letterSpacing:.5,marginBottom:4}}>
                {{'en':'🇹🇷 Middle East / Turkey / MENA','ar':'🇹🇷 الشرق الأوسط / تركيا / منطقة الشرق الأوسط وشمال أفريقيا','fr':'🇹🇷 Moyen-Orient / Turquie / MENA','tr':'🇹🇷 Orta Doğu / Türkiye / MENA'}[lang]||'🇹🇷 Middle East / Turkey / MENA'}
              </p>
              <a href="tel:+905418477976" style={{fontSize:18,fontWeight:800,color:'#25D366',textDecoration:'none'}}>+90 541 847 79 76</a>
              <p style={{fontSize:11,color:'#adb5bd',marginTop:2}}>
                <a href="https://wa.me/905418477976" target="_blank" style={{color:'#25D366',fontWeight:600,textDecoration:'none'}}>WhatsApp ↗</a>
              </p>
            </div>
          </div>
          <div style={{display:'inline-flex',gap:16,flexWrap:'wrap',justifyContent:'center'}}>
            {[
              {label:{en:'Status Page',ar:'صفحة الحالة',fr:'Page de statut',tr:'Durum Sayfası'},href:'/status'},
              {label:{en:'Support',ar:'الدعم',fr:'Support',tr:'Destek'},href:'/support'},
              {label:{en:'webek.org',ar:'webek.org',fr:'webek.org',tr:'webek.org'},href:'https://webek.org'},
              {label:{en:'webek.uk',ar:'webek.uk',fr:'webek.uk',tr:'webek.uk'},href:'https://www.webek.uk'},
            ].map(l => (
              <a key={l.href} href={l.href} target={l.href.startsWith('http')?'_blank':undefined}
                style={{background:'#f9fafb',border:'1px solid #e9edef',borderRadius:10,padding:'10px 20px',fontSize:14,fontWeight:600,color:'#374151',textDecoration:'none'}}>
                {l.label[lang]||l.label.en}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{background:'linear-gradient(135deg,#25D366,#128C7E)',padding:'80px 24px',textAlign:'center'}}>
        <h2 style={{fontSize:'clamp(26px,4vw,42px)',fontWeight:900,color:'#0F172A',marginBottom:12}}>{T(lang,'cta_title')}</h2>
        <p style={{fontSize:17,color:'rgba(255,255,255,.85)',marginBottom:36,maxWidth:500,margin:'0 auto 36px'}}>{T(lang,'cta_sub')}</p>
        <Link href="/auth/register" style={{background:'#fff',color:'#25D366',padding:'15px 40px',borderRadius:10,fontSize:16,fontWeight:800,textDecoration:'none',display:'inline-block'}}>
          {T(lang,'get_started')} →
        </Link>
      </section>

      <PublicFooter lang={lang} onLangChange={setLang} />
    </div>
  </>)
}
