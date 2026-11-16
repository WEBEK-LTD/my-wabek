import React from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { ArrowLeftIcon, BuildingOffice2Icon, CreditCardIcon, DocumentTextIcon, EnvelopeIcon, EyeIcon, LockClosedIcon, ScaleIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import { MarketingPage, PageHero, Section } from '@/components/marketing/MarketingPage'
import { IconTile } from '@/components/marketing/Blocks'
import { usePublicLang } from '@/components/marketing/usePublicLang'

const LOGO = '/brand/favicon-32.png'

const S: Record<string, Record<string, string>> = {
  title:      { en:'Legal', ar:'الوثائق القانونية', fr:'Légal', tr:'Yasal' },
  subtitle:   { en:'Our legal documents, policies, and agreements. We believe in full transparency.', ar:'وثائقنا القانونية وسياساتنا واتفاقياتنا. نؤمن بالشفافية الكاملة.', fr:'Nos documents juridiques, politiques et accords. Nous croyons en la transparence totale.', tr:'Hukuki belgelerimiz, politikalarımız ve anlaşmalarımız. Tam şeffaflığa inanıyoruz.' },
  updated:    { en:'Last updated', ar:'آخر تحديث', fr:'Dernière mise à jour', tr:'Son güncelleme' },
  read_doc:   { en:'Read document', ar:'قراءة الوثيقة', fr:'Lire le document', tr:'Belgeyi oku' },
  company:    { en:'WEBEK LTD · Company No. 16326894 · 71-75 Shelton Street, Covent Garden, London, WC2H 9JQ, United Kingdom', ar:'WEBEK LTD · رقم الشركة: 16326894 · 71-75 شيلتون ستريت، كوفنت غاردن، لندن، WC2H 9JQ، المملكة المتحدة', fr:'WEBEK LTD · Numéro d\'entreprise: 16326894 · 71-75 Shelton Street, Covent Garden, Londres, WC2H 9JQ, Royaume-Uni', tr:'WEBEK LTD · Şirket No: 16326894 · 71-75 Shelton Street, Covent Garden, Londra, WC2H 9JQ, Birleşik Krallık' },
  questions:  { en:'Questions about our legal documents?', ar:'أسئلة حول وثائقنا القانونية؟', fr:'Des questions sur nos documents juridiques ?', tr:'Hukuki belgelerimiz hakkında sorularınız mı var?' },
  contact_us: { en:'Contact us at', ar:'تواصل معنا على', fr:'Contactez-nous à', tr:'Bize ulaşın' },
}

const T = (lang: string, k: string) => S[k]?.[lang] || S[k]?.en || k

const DOCS: { href: string; icon: React.ElementType; title: Record<string, string>; desc: Record<string, string>; date: string }[] = [
  {
    href: '/legal/privacy',
    icon: ShieldCheckIcon,
    title: { en:'Privacy Policy', ar:'سياسة الخصوصية', fr:'Politique de confidentialité', tr:'Gizlilik Politikası' },
    desc:  { en:'How we collect, use, store, and protect your personal data. Your privacy matters to us.', ar:'كيف نجمع بياناتك الشخصية ونستخدمها ونخزنها ونحميها. خصوصيتك تهمنا.', fr:'Comment nous collectons, utilisons, stockons et protégeons vos données personnelles.', tr:'Kişisel verilerinizi nasıl topladığımızı, kullandığımızı ve koruduğumuzu açıklar.' },
    date:  'May 2025',
  },
  {
    href: '/legal/terms',
    icon: DocumentTextIcon,
    title: { en:'Terms of Service', ar:'شروط الخدمة', fr:'Conditions d\'utilisation', tr:'Hizmet Şartları' },
    desc:  { en:'The rules and agreements that govern your use of WABEK services. Please read carefully.', ar:'القواعد والاتفاقيات التي تحكم استخدامك لخدمات WABEK. يرجى القراءة بعناية.', fr:'Les règles et accords qui régissent votre utilisation des services WABEK.', tr:'WABEK hizmetlerinin kullanımını yöneten kurallar ve anlaşmalar.' },
    date:  'May 2025',
  },
  {
    href: '/legal/refund',
    icon: CreditCardIcon,
    title: { en:'Refund Policy', ar:'سياسة الاسترداد', fr:'Politique de remboursement', tr:'İade Politikası' },
    desc:  { en:'Our refund and cancellation terms. We offer a 14-day money-back guarantee on all paid plans.', ar:'شروط الاسترداد والإلغاء لدينا. نقدم ضمان استرداد المال لمدة 14 يوماً على جميع الخطط المدفوعة.', fr:'Nos conditions de remboursement et d\'annulation. Garantie de remboursement de 14 jours.', tr:'İade ve iptal şartlarımız. Tüm ücretli planlarda 14 günlük para iade garantisi.' },
    date:  'May 2025',
  },
  {
    href: '/legal/license',
    icon: LockClosedIcon,
    title: { en:'Software License', ar:'رخصة البرنامج', fr:'Licence du logiciel', tr:'Yazılım Lisansı' },
    desc:  { en:'The proprietary software license that governs the use of WABEK platform and its source code.', ar:'رخصة البرنامج المملوك التي تحكم استخدام منصة WABEK وشيفرتها المصدرية.', fr:'La licence logicielle propriétaire qui régit l\'utilisation de la plateforme WABEK.', tr:'WABEK platformunun ve kaynak kodunun kullanımını yöneten tescilli yazılım lisansı.' },
    date:  'May 2025',
  },
  {
    href: '/legal/accessibility',
    icon: EyeIcon,
    title: { en:'Accessibility Statement', ar:'بيان إمكانية الوصول', fr:'Déclaration d\'accessibilité', tr:'Erişilebilirlik Bildirimi' },
    desc:  { en:'Our commitment to making WABEK accessible to all users, regardless of ability or disability.', ar:'التزامنا بجعل WABEK في متناول جميع المستخدمين، بغض النظر عن قدراتهم.', fr:'Notre engagement à rendre WABEK accessible à tous les utilisateurs.', tr:'WABEK\'i tüm kullanıcılar için erişilebilir kılma taahhüdümüz.' },
    date:  'May 2025',
  },
]

export default function LegalIndexPage() {
  const { brandName } = useWhiteLabel()
  const name = brandName || 'WABEK'
  const { lang, setLang, dir, pick } = usePublicLang()

  return (<>
    <Head>
      <link rel="icon" href={LOGO} />
      <title>{T(lang, 'title')} | {name}</title>
      <meta name="description" content={T(lang, 'subtitle')} />
    </Head>
    <MarketingPage
      active="/legal"
      lang={lang}
      dir={dir}
      onLangChange={setLang}
      hero={<PageHero eyebrow={<span className="inline-flex items-center gap-1.5"><ScaleIcon className="h-4 w-4" aria-hidden="true" />WEBEK LTD</span>} title={T(lang, 'title')} subtitle={T(lang, 'subtitle')} />}
    >
      <Section className="pt-12 sm:pt-16">
        <ul className="grid gap-4 md:grid-cols-2">
          {DOCS.map(doc => (
            <li key={doc.href}>
              <Link
                href={doc.href}
                className="group flex h-full items-start gap-5 rounded-card border border-line bg-surface p-6 text-ink shadow-card transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:text-ink hover:shadow-card-hover sm:p-7"
              >
                <IconTile icon={doc.icon} size="lg" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-ink">{pick(doc.title)}</h2>
                    <span className="rounded-full bg-surface-3 px-2.5 py-0.5 text-xs text-muted">{T(lang, 'updated')}: <span dir="ltr">{doc.date}</span></span>
                  </div>
                  <p className="text-[15px] leading-relaxed text-body">{pick(doc.desc)}</p>
                  <span className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-link">
                    {T(lang, 'read_doc')}
                    <ArrowLeftIcon className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 ltr:rotate-180 ltr:group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-col items-center gap-3 rounded-card border border-line bg-surface-2 px-6 py-8 text-center">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
            <BuildingOffice2Icon className="h-5 w-5 text-brand-ink" aria-hidden="true" />
            WEBEK LTD
          </span>
          <p className="max-w-2xl text-[13px] leading-relaxed text-muted">{T(lang, 'company')}</p>
          <p className="text-sm text-body">
            {T(lang, 'questions')} {T(lang, 'contact_us')}{' '}
            <a href="mailto:legal@waabek.com" className="inline-flex items-center gap-1 font-semibold" dir="ltr">
              <EnvelopeIcon className="h-4 w-4" aria-hidden="true" />legal@waabek.com
            </a>
          </p>
        </div>
      </Section>
    </MarketingPage>
  </>)
}
