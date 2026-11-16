import React, { useState } from 'react'
import Head from 'next/head'
import { CreditCardIcon, LockClosedIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import { Button } from '@/components/ui'
import { cn } from '@/components/ui/utils'
import { MarketingPage, PageHero, Section } from '@/components/marketing/MarketingPage'
import { CtaBand, FaqList } from '@/components/marketing/Blocks'
import { Cycle, PlanCards, PlanComparison, hasYearly, maxYearlySaving, usePublicPlans } from '@/components/marketing/plans'
import { usePublicLang } from '@/components/marketing/usePublicLang'

const LOGO = '/brand/favicon-32.png'

type L = Record<string, string>

// Plan limits are no longer quoted here: they come from the plan data shown above the FAQ.
const FAQS: { q: L; a: L }[] = [
  { q: { en: 'Is there a free plan?', ar: 'هل توجد باقة مجانية؟', fr: 'Y a-t-il un plan gratuit ?', tr: 'Ücretsiz plan var mı?' },
    a: { en: 'Yes. The free plan and its limits are listed in the plans and the comparison table on this page. No credit card required.', ar: 'نعم. تجد الباقة المجانية وحدودها في بطاقات الباقات وجدول المقارنة في هذه الصفحة، دون الحاجة إلى بطاقة ائتمان.', fr: 'Oui. Le plan gratuit et ses limites figurent dans les offres et le tableau comparatif de cette page. Aucune carte bancaire requise.', tr: 'Evet. Ücretsiz plan ve limitleri bu sayfadaki planlarda ve karşılaştırma tablosunda yer alır. Kredi kartı gerekmez.' } },
  { q: { en: 'Can I cancel at any time?', ar: 'هل يمكنني الإلغاء في أي وقت؟', fr: 'Puis-je annuler à tout moment ?', tr: 'İstediğim zaman iptal edebilir miyim?' },
    a: { en: 'Absolutely. No contracts, no cancellation fees. Cancel anytime from your billing dashboard and your account stays active until the end of the billing period.', ar: 'بالتأكيد. لا توجد عقود ولا رسوم إلغاء، ويمكنك الإلغاء في أي وقت ويظل حسابك نشطًا حتى نهاية فترة الفوترة.', fr: "Absolument. Pas de contrats, pas de frais d'annulation. Annulez à tout moment.", tr: 'Kesinlikle. Sözleşme yok, iptal ücreti yok. İstediğiniz zaman iptal edin.' } },
  { q: { en: 'What payment methods do you accept?', ar: 'ما طرق الدفع المقبولة؟', fr: 'Quels modes de paiement acceptez-vous ?', tr: 'Hangi ödeme yöntemlerini kabul ediyorsunuz?' },
    a: { en: 'We accept all major credit cards (Visa, Mastercard, Amex), PayPal, and bank transfers for annual plans. Payments are processed securely via Stripe.', ar: 'نقبل جميع بطاقات الائتمان الرئيسية (فيزا وماستركارد وأمريكان إكسبريس) وباي بال، والتحويل البنكي للباقات السنوية. وتجري معالجة المدفوعات بأمان عبر Stripe.', fr: 'Nous acceptons toutes les cartes de crédit majeures, PayPal et virements bancaires.', tr: "Tüm büyük kredi kartlarını, PayPal'ı ve yıllık planlar için banka transferini kabul ediyoruz." } },
  { q: { en: 'Do you offer a free trial?', ar: 'هل تقدّمون تجربة مجانية؟', fr: 'Offrez-vous un essai gratuit ?', tr: 'Ücretsiz deneme sunuyor musunuz?' },
    a: { en: 'Yes! All paid plans include a 14-day free trial. No credit card required to start. You can upgrade, downgrade, or cancel at any time.', ar: 'نعم. تشمل جميع الباقات المدفوعة تجربة مجانية لمدة 14 يومًا، ولا تحتاج إلى بطاقة ائتمان للبدء.', fr: 'Oui ! Tous les plans payants incluent un essai gratuit de 14 jours. Pas de carte de crédit requise.', tr: 'Evet! Tüm ücretli planlar 14 günlük ücretsiz deneme içerir. Kredi kartı gerekmez.' } },
  { q: { en: 'Can I switch plans anytime?', ar: 'هل يمكنني تغيير الباقة في أي وقت؟', fr: 'Puis-je changer de plan à tout moment ?', tr: 'Planımı istediğim zaman değiştirebilir miyim?' },
    a: { en: 'Yes. You can upgrade or downgrade your plan at any time. Upgrades take effect immediately. Downgrades take effect at the next billing cycle.', ar: 'نعم. يمكنك الترقية أو التخفيض في أي وقت؛ تسري الترقية فورًا، ويسري التخفيض في دورة الفوترة التالية.', fr: 'Oui. Vous pouvez changer de plan à tout moment. Les mises à niveau prennent effet immédiatement.', tr: 'Evet. İstediğiniz zaman planınızı yükseltebilir veya düşürebilirsiniz.' } },
  { q: { en: 'Is my WhatsApp account safe?', ar: 'هل حسابي على واتساب آمن؟', fr: 'Mon compte WhatsApp est-il sécurisé ?', tr: 'WhatsApp hesabım güvende mi?' },
    a: { en: "Yes. WABEK uses the official WhatsApp Business API (Meta Cloud API), which is fully compliant with Meta's terms of service. Your account is never at risk of being banned.", ar: 'نعم. يستخدم WABEK واجهة واتساب للأعمال الرسمية (Meta Cloud API) المتوافقة تمامًا مع شروط خدمة Meta، فلن يتعرّض حسابك للحظر.', fr: "Oui. WABEK utilise l'API WhatsApp Business officielle (Meta Cloud API), entièrement conforme.", tr: 'Evet. WABEK resmi WhatsApp Business API\'sini kullanır. Hesabınız asla ban riski taşımaz.' } },
]

const STRINGS: Record<string, L> = {
  title: { en: 'Simple, Transparent Pricing', ar: 'أسعار بسيطة وشفافة', fr: 'Tarification simple et transparente', tr: 'Basit ve Şeffaf Fiyatlandırma' },
  subtitle: { en: "Start free. Upgrade when you're ready. Cancel anytime.", ar: 'ابدأ مجانًا، ورقِّ باقتك عندما تكون مستعدًا، وألغِ في أي وقت.', fr: 'Commencez gratuitement. Mettez à niveau quand vous êtes prêt.', tr: 'Ücretsiz başlayın. Hazır olduğunuzda yükseltin. İstediğiniz zaman iptal edin.' },
  monthly: { en: 'Monthly', ar: 'شهري', fr: 'Mensuel', tr: 'Aylık' },
  annual: { en: 'Annual', ar: 'سنوي', fr: 'Annuel', tr: 'Yıllık' },
  save: { en: 'Save up to {n}%', ar: 'وفّر حتى {n}%', fr: "Jusqu'à {n} % d'économie", tr: '%{n}’e varan tasarruf' },
  billing: { en: 'Billing period', ar: 'دورة الفوترة', fr: 'Période de facturation', tr: 'Faturalama dönemi' },
  trial: { en: '14-day free trial', ar: 'تجربة مجانية لمدة 14 يومًا', fr: 'Essai gratuit 14 jours', tr: '14 günlük ücretsiz deneme' },
  no_card: { en: 'No credit card required', ar: 'لا حاجة إلى بطاقة ائتمان', fr: 'Aucune carte de crédit requise', tr: 'Kredi kartı gerekmez' },
  stripe: { en: 'Secure payments via Stripe', ar: 'مدفوعات آمنة عبر Stripe', fr: 'Paiements sécurisés via Stripe', tr: 'Stripe ile güvenli ödeme' },
  compare: { en: 'Compare all features', ar: 'مقارنة جميع المزايا', fr: 'Comparer toutes les fonctionnalités', tr: 'Tüm özellikleri karşılaştır' },
  compare_sub: { en: 'Limits and features exactly as configured for each plan.', ar: 'الحدود والمزايا كما هي مضبوطة لكل باقة.', fr: 'Limites et fonctionnalités telles que configurées pour chaque offre.', tr: 'Her plan için yapılandırıldığı şekliyle limitler ve özellikler.' },
  faq_title: { en: 'Frequently Asked Questions', ar: 'الأسئلة الشائعة', fr: 'Questions fréquemment posées', tr: 'Sık Sorulan Sorular' },
  faq_sub: { en: 'Everything you need to know about pricing.', ar: 'كل ما تحتاج إلى معرفته عن الأسعار.', fr: 'Tout ce que vous devez savoir sur les tarifs.', tr: 'Fiyatlandırma hakkında bilmeniz gereken her şey.' },
  cta_title: { en: 'Ready to get started?', ar: 'هل أنت مستعد للبدء؟', fr: 'Prêt à commencer ?', tr: 'Başlamaya hazır mısınız?' },
  cta_sub: { en: 'Start free and upgrade whenever you need more.', ar: 'ابدأ مجانًا، ورقِّ باقتك متى احتجت إلى المزيد.', fr: "Commencez gratuitement et passez à l'offre supérieure quand vous en avez besoin.", tr: 'Ücretsiz başlayın, daha fazlasına ihtiyaç duyduğunuzda yükseltin.' },
  get_started: { en: 'Get Started Free', ar: 'ابدأ مجانًا', fr: 'Commencer gratuitement', tr: 'Ücretsiz Başla' },
  contact: { en: 'Contact Sales', ar: 'تواصل مع المبيعات', fr: 'Contacter les ventes', tr: 'Satışa Ulaşın' },
}

export default function PricingPage() {
  const { brandName } = useWhiteLabel()
  const name = brandName || 'WABEK'
  const { lang, setLang, dir, t, pick } = usePublicLang()
  const [cycle, setCycle] = useState<Cycle>('monthly')
  const plans = usePublicPlans()
  const T = (key: string) => pick(STRINGS[key])
  const yearly = hasYearly(plans.plans)
  const saving = maxYearlySaving(plans.plans)

  const toggle = yearly && (
    <div role="radiogroup" aria-label={T('billing')} className="mt-2 inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.06] p-1">
      {(['monthly', 'yearly'] as Cycle[]).map(c => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={cycle === c}
          onClick={() => setCycle(c)}
          className={cn(
            'inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors',
            cycle === c ? 'bg-[#EAF7F5] text-[#04282C]' : 'text-deep-muted hover:text-white',
          )}
        >
          {c === 'monthly' ? T('monthly') : T('annual')}
          {c === 'yearly' && saving > 0 && (
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', cycle === c ? 'bg-brand-gradient text-[#04282C]' : 'bg-brand-green/20 text-brand-green')}>
              {T('save').replace('{n}', String(saving))}
            </span>
          )}
        </button>
      ))}
    </div>
  )

  return (
    <>
      <Head>
        <link rel="icon" href={LOGO} />
        <title>{`${T('title')} | ${name}`}</title>
        <meta name="description" content={T('subtitle')} />
      </Head>
      <MarketingPage
        active="/pricing"
        lang={lang}
        dir={dir}
        onLangChange={setLang}
        hero={<PageHero eyebrow={t('pricing')} title={T('title')} subtitle={T('subtitle')} className="pb-28 sm:pb-32">{toggle}</PageHero>}
      >
        <section aria-label={t('pricing')} className="relative mx-auto -mt-20 max-w-[1280px] px-4 sm:px-8">
          <PlanCards {...plans} onRetry={plans.reload} cycle={cycle} t={t} labels={{ cta: T('get_started') }} />
          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted">
            <li className="inline-flex items-center gap-2"><ShieldCheckIcon className="h-5 w-5 text-brand-ink" aria-hidden="true" />{T('trial')}</li>
            <li className="inline-flex items-center gap-2"><CreditCardIcon className="h-5 w-5 text-brand-ink" aria-hidden="true" />{T('no_card')}</li>
            <li className="inline-flex items-center gap-2"><LockClosedIcon className="h-5 w-5 text-brand-ink" aria-hidden="true" />{T('stripe')}</li>
          </ul>
        </section>

        {!plans.loading && !plans.error && plans.plans.length > 0 && (
          <Section title={T('compare')} subtitle={T('compare_sub')}>
            <PlanComparison plans={plans.plans} t={t} caption={T('compare')} />
          </Section>
        )}

        <Section title={T('faq_title')} subtitle={T('faq_sub')} narrow>
          <FaqList items={FAQS.map(f => ({ q: pick(f.q), a: pick(f.a) }))} />
        </Section>

        <CtaBand
          title={T('cta_title')}
          subtitle={T('cta_sub')}
          actions={
            <>
              <Button href="/auth/register" size="xl" className="rounded-2xl px-8 text-lg font-bold">{T('get_started')}</Button>
              <Button href="/support#contact" variant="on-deep-ghost" size="xl" className="rounded-2xl px-7">{T('contact')}</Button>
            </>
          }
        />
      </MarketingPage>
    </>
  )
}
