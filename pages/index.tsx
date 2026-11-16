import React from 'react'
import Head from 'next/head'
import Link from 'next/link'
import {
  ArrowLeftIcon, BoltIcon, ChartBarIcon, ChatBubbleLeftRightIcon, InboxStackIcon,
  MegaphoneIcon, SparklesIcon,
} from '@heroicons/react/24/outline'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import { Button, Logo } from '@/components/ui'
import { MarketingPage, Section } from '@/components/marketing/MarketingPage'
import { CtaBand, FaqList, FeatureRow, IconTile, LogoStrip, MiniUiCard, StatsBand } from '@/components/marketing/Blocks'
import { ProductPreview } from '@/components/marketing/ProductPreview'
import { PlanCards, usePublicPlans } from '@/components/marketing/plans'
import { IntegrationLogo, IntegrationLogoKey } from '@/components/marketing/IntegrationLogo'
import HeroIllustration from '@/components/HeroIllustration'
import TestimonialsSection from '@/components/TestimonialsSection'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/public/home'

type Key = keyof typeof messages.en

// Partner names of the original strip, plus the apps listed by the redesign.
const PARTNERS = ['Wix', 'WordPress', 'Shopify', 'Stripe', 'Zapier', 'Meta', 'Google', 'Cloudflare', 'WhatsApp', 'cPanel', 'WHMCS', 'WEBEK', 'WhatsApp Cloud API', 'WooCommerce']

const FEATURES: { icon: React.ElementType; tk: Key; dk: Key; tone: 'brand' | 'violet' | 'warning' | 'success' }[] = [
  { icon: MegaphoneIcon, tk: 'feat_campaigns_title', dk: 'feat_campaigns_desc', tone: 'brand' },
  { icon: SparklesIcon, tk: 'feat_ai_title', dk: 'feat_ai_desc', tone: 'violet' },
  { icon: InboxStackIcon, tk: 'feat_inbox_title', dk: 'feat_inbox_desc', tone: 'brand' },
  { icon: ChatBubbleLeftRightIcon, tk: 'feat_chatbot_title', dk: 'feat_chatbot_desc', tone: 'warning' },
  { icon: ChartBarIcon, tk: 'feat_analytics_title', dk: 'feat_analytics_desc', tone: 'success' },
  { icon: BoltIcon, tk: 'feat_automation_title', dk: 'feat_automation_desc', tone: 'violet' },
]

const STEPS = [1, 2, 3, 4] as const
const FAQ = [1, 2, 3, 4, 5, 6] as const

const INTEGRATIONS: { logo: IntegrationLogoKey; name: string; bk: Key; dk: Key }[] = [
  { logo: 'wix', name: 'Wix', bk: 'integ_official', dk: 'integ_wix_desc' },
  { logo: 'wordpress', name: 'WordPress', bk: 'integ_plugin', dk: 'integ_wp_desc' },
  { logo: 'zapier', name: 'Zapier', bk: 'integ_nocode', dk: 'integ_zapier_desc' },
  { logo: 'whmcs', name: 'WHMCS', bk: 'integ_module', dk: 'integ_whmcs_desc' },
  { logo: 'meta', name: 'Meta Cloud API', bk: 'integ_official_api', dk: 'integ_meta_desc' },
  { logo: 'api', name: 'REST API', bk: 'integ_developer', dk: 'integ_api_desc' },
]

export default function HomePage() {
  const { brandName, customLogo } = useWhiteLabel()
  const name = brandName || 'WABEK'
  const { t, lang, dir, locale } = useT(messages)
  const plans = usePublicPlans()

  const arrow = <ArrowLeftIcon className="h-4 w-4 ltr:rotate-180" aria-hidden="true" />
  const more = (href: string, label: string) => (
    <div className="mt-8 flex justify-center">
      <Link href={href} className="inline-flex items-center gap-1.5 text-[15px] font-semibold">{label} {arrow}</Link>
    </div>
  )

  const hero = (
    <>
      <section className="relative mx-auto flex max-w-[1280px] flex-col items-center gap-6 px-4 pt-12 text-center sm:gap-[26px] sm:px-8 sm:pt-[70px]">
        <Logo src={customLogo} name={brandName} size={110} wordmark={false} hiRes glow decorative />
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-[13px] font-medium text-deep-muted">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-green" />
          {t('hero_badge')}
        </span>
        <h1 className="max-w-[1000px] text-[38px] font-bold leading-[1.2] tracking-[-0.5px] text-deep-ink sm:text-[56px] lg:text-[72px] lg:leading-[1.15] lg:tracking-[-1px]">
          {t('hero_title1')}<br />{t('hero_title2')} <span className="text-gradient">{t('hero_title3')}</span>
        </h1>
        <p className="max-w-[640px] text-[17px] font-light leading-[1.8] text-deep-muted sm:text-xl">{t('hero_sub')}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button href="/auth/register" size="xl" className="rounded-2xl px-8 text-[17px] font-bold shadow-glow">
            {t('hero_cta1')}
          </Button>
          <Button href="/features" variant="on-deep-ghost" size="xl" className="rounded-2xl px-[30px] text-[17px]">
            {t('hero_cta2')}
          </Button>
        </div>
        <p className="text-[13px] text-deep-muted">
          {t('hero_note')} <Link href="/docs" className="font-semibold text-deep-ink underline-offset-4 hover:underline">{t('mk_read_docs')}</Link>
        </p>
      </section>
      <ProductPreview />
    </>
  )

  return (
    <>
      <Head>
        <link rel="icon" href="/brand/favicon-32.png" />
        <title>{t('meta_title', { name })}</title>
        <meta name="description" content={t('meta_description')} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <MarketingPage active="/" lang={lang} dir={dir} hero={hero} rings>
        {/* Hero cards (campaign, inbox, auto-reply, chat) */}
        <HeroIllustration />

        {/* Stats */}
        <StatsBand
          label={t('stats_label')}
          locale={locale}
          items={[
            { value: 10, suffix: 'M+', label: t('stat1'), duration: 2000 },
            { value: 99.9, decimals: 1, suffix: '%', label: t('stat2'), duration: 2500 },
            { value: 1, suffix: 's', label: t('stat3'), duration: 1200 },
            { value: 50, suffix: '+', label: t('stat4'), duration: 1800 },
          ]}
        />

        {/* Partners */}
        <LogoStrip title={t('partners_title')} names={PARTNERS} />

        {/* Product rows */}
        <Section title={t('mk_home_h1')} subtitle={t('mk_home_sub')} className="pt-20 sm:pt-24">
          <div id="product" className="flex scroll-mt-24 flex-col gap-20">
            <FeatureRow
              kicker={t('mk_row1_k')}
              title={t('mk_row1_t')}
              description={t('mk_row1_d')}
              points={[t('mk_row1_p1'), t('mk_row1_p2'), t('mk_row1_p3')]}
              panel="linear-gradient(150deg, #0E6C72, #04282C)"
              visual={
                <MiniUiCard
                  title={t('mk_row1_mock')}
                  tag={t('mk_row1_tag')}
                  note={t('mk_illustrative')}
                  rows={[
                    { color: '#F5C26B', label: t('mk_row1_m1'), value: t('mk_row1_v1') },
                    { color: '#5FD6D0', label: t('mk_row1_m2'), value: t('mk_row1_v2') },
                    { color: '#B59CF5', label: t('mk_row1_m3'), value: t('mk_row1_v3') },
                  ]}
                />
              }
            />
            <FeatureRow
              reverse
              kicker={t('mk_row2_k')}
              title={t('mk_row2_t')}
              description={t('mk_row2_d')}
              points={[t('mk_row2_p1'), t('mk_row2_p2'), t('mk_row2_p3')]}
              panel="linear-gradient(150deg, #1D6B4A, #0B3B2E)"
              visual={
                <MiniUiCard
                  title={t('mk_row2_mock')}
                  tag={t('mk_row2_tag')}
                  note={t('mk_illustrative')}
                  rows={[
                    { color: '#8BE07A', label: t('mk_row2_m1'), value: '412' },
                    { color: '#12B5BE', label: t('mk_row2_m2'), value: '27' },
                    { color: '#F5C26B', label: t('mk_row2_m3'), value: '4.8 / 5' },
                  ]}
                />
              }
            />
            <FeatureRow
              kicker={t('mk_row3_k')}
              title={t('mk_row3_t')}
              description={t('mk_row3_d')}
              points={[t('mk_row3_p1'), t('mk_row3_p2'), t('mk_row3_p3')]}
              panel="linear-gradient(150deg, #12B5BE, #1D6B4A)"
              action={<Button href="/docs" variant="secondary" iconEnd={ArrowLeftIcon} className="ltr:[&_svg]:rotate-180">{t('mk_read_docs')}</Button>}
              visual={
                <MiniUiCard
                  mono
                  title="POST /api/v1/send"
                  tag="200 OK"
                  rows={[
                    { color: '#12B5BE', label: 'to: "+20100…"', value: 'string', mono: true },
                    { color: '#8BE07A', label: 'template: "order_update"', value: 'string', mono: true },
                    { color: '#F5C26B', label: 'status: "queued"', value: '42ms', mono: true },
                  ]}
                />
              }
            />
          </div>
        </Section>

        {/* Features */}
        <Section id="features" title={t('features_title')} subtitle={t('features_subtitle')} className="scroll-mt-24 pt-8">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(f => (
              <li key={f.tk} className="group flex flex-col gap-4 rounded-card border border-line bg-surface p-6 shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-card-hover">
                <IconTile icon={f.icon} tone={f.tone} />
                <h3 className="text-[17px] font-semibold text-ink">{t(f.tk)}</h3>
                <p className="text-[15px] leading-[1.85] text-body">{t(f.dk)}</p>
              </li>
            ))}
          </ul>
          {more('/features', t('features_link'))}
        </Section>

        {/* Steps */}
        <Section title={t('steps_title')} subtitle={t('steps_subtitle')} className="pt-4">
          <ol className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-[12%] top-[34px] hidden h-px bg-gradient-to-l from-brand-teal/0 via-brand-teal/40 to-brand-green/0 lg:block" />
            {STEPS.map(n => (
              <li key={n} className="relative flex flex-col gap-3 rounded-card border border-line bg-surface p-6 shadow-card">
                <span className="tabular flex h-11 w-11 items-center justify-center rounded-full bg-brand-gradient text-base font-bold text-[#04282C] shadow-glow">{n}</span>
                <h3 className="text-base font-semibold text-ink">{t(`step${n}_title`)}</h3>
                <p className="text-sm leading-[1.8] text-body">{t(`step${n}_desc`)}</p>
              </li>
            ))}
          </ol>
        </Section>

        {/* Integrations */}
        <Section title={t('integrations_title')} subtitle={t('integrations_subtitle')} className="pt-4">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {INTEGRATIONS.map(i => (
              <li key={i.name} className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6 shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-card-hover">
                <div className="flex items-center gap-3">
                  <IntegrationLogo logo={i.logo} />
                  <div className="min-w-0">
                    <span className="mb-1 inline-flex rounded-full bg-chip px-2.5 py-0.5 text-[11px] font-semibold text-chip-ink">{t(i.bk)}</span>
                    <h3 className="text-[17px] font-semibold text-ink" dir="ltr">{i.name}</h3>
                  </div>
                </div>
                <p className="text-[15px] leading-[1.85] text-body">{t(i.dk)}</p>
              </li>
            ))}
          </ul>
          {more('/integrations', t('integrations_link'))}
        </Section>

        {/* Pricing */}
        <Section id="pricing" eyebrow={t('mk_pricing_title')} title={t('pricing_title')} subtitle={t('pricing_subtitle')} className="scroll-mt-24">
          <PlanCards {...plans} onRetry={plans.reload} maxFeatures={4} />
          {more('/pricing', t('pricing_link'))}
        </Section>

        {/* Testimonials */}
        <TestimonialsSection name={name} />

        {/* FAQ */}
        <Section title={t('faq_title')} narrow>
          <FaqList items={FAQ.map(n => ({ q: t(`faq${n}_q`), a: t(`faq${n}_a`) }))} />
        </Section>

        <CtaBand
          eyebrow={t('mk_cta_title')}
          title={t('cta_title')}
          subtitle={t('cta_subtitle')}
          note={<>{t('cta_note')}<br />{t('mk_cta_note')}</>}
          actions={
            <>
              <Button href="/auth/register" size="xl" className="rounded-2xl px-[34px] text-lg font-bold">{t('cta_btn')}</Button>
              <Button href="/pricing" variant="on-deep-ghost" size="xl" className="rounded-2xl px-7">{t('pricing_link')}</Button>
            </>
          }
        />
      </MarketingPage>
    </>
  )
}
