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
import { CtaBand, FaqList, FeatureRow, IconTile, MiniUiCard } from '@/components/marketing/Blocks'
import { ProductPreview } from '@/components/marketing/ProductPreview'
import { PlanCards, usePublicPlans } from '@/components/marketing/plans'
import { usePublicLang } from '@/components/marketing/usePublicLang'

const APPS = ['WhatsApp Cloud API', 'WooCommerce', 'WordPress', 'Wix', 'WHMCS', 'Zapier']

const FEATURES = [
  { icon: MegaphoneIcon, tk: 'feat_campaigns_title', dk: 'feat_campaigns_desc', tone: 'brand' as const },
  { icon: SparklesIcon, tk: 'feat_ai_title', dk: 'feat_ai_desc', tone: 'violet' as const },
  { icon: InboxStackIcon, tk: 'feat_inbox_title', dk: 'feat_inbox_desc', tone: 'brand' as const },
  { icon: ChatBubbleLeftRightIcon, tk: 'feat_chatbot_title', dk: 'feat_chatbot_desc', tone: 'warning' as const },
  { icon: ChartBarIcon, tk: 'feat_analytics_title', dk: 'feat_analytics_desc', tone: 'success' as const },
  { icon: BoltIcon, tk: 'feat_automation_title', dk: 'feat_automation_desc', tone: 'violet' as const },
]

const STEPS = ['step1', 'step2', 'step3', 'step4']
const FAQ = [1, 2, 3, 4, 5, 6]

export default function HomePage() {
  const { brandName, customLogo } = useWhiteLabel()
  const name = brandName || 'WABEK'
  const { lang, setLang, dir, t } = usePublicLang()
  const plans = usePublicPlans()

  const arrow = <ArrowLeftIcon className="h-4 w-4 ltr:rotate-180" aria-hidden="true" />

  const hero = (
    <>
      <section className="relative mx-auto flex max-w-[1280px] flex-col items-center gap-6 px-4 pt-12 text-center sm:gap-[26px] sm:px-8 sm:pt-[70px]">
        <Logo src={customLogo} name={brandName} size={110} wordmark={false} hiRes glow decorative />
        <h1 className="max-w-[1000px] whitespace-pre-line text-[38px] font-bold leading-[1.2] tracking-[-0.5px] text-deep-ink sm:text-[56px] lg:text-[72px] lg:leading-[1.15] lg:tracking-[-1px]">
          {t('mk_home_h1')}
        </h1>
        <p className="max-w-[640px] text-[17px] font-light leading-[1.8] text-deep-muted sm:text-xl">{t('mk_home_sub')}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button href="/auth/register" size="xl" className="rounded-2xl px-8 text-[17px] font-bold shadow-glow">
            {t('pub_start_free')}
          </Button>
          <Button href="/docs" variant="on-deep-ghost" size="xl" className="rounded-2xl px-[30px] text-[17px]">
            {t('mk_read_docs')}
          </Button>
        </div>
      </section>
      <ProductPreview t={t} lang={lang} />
    </>
  )

  return (
    <>
      <Head>
        <link rel="icon" href="/brand/favicon-32.png" />
        <title>{name} — WhatsApp Business Platform</title>
        <meta name="description" content="Send campaigns, build AI chatbots, manage team inbox, and automate WhatsApp." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <MarketingPage active="/" lang={lang} dir={dir} onLangChange={setLang} hero={hero} rings>
        {/* Integrations strip */}
        <section aria-labelledby="home-apps" className="mx-auto max-w-[1280px] px-4 pb-2 pt-14 sm:px-8 sm:pt-[60px]">
          <h2 id="home-apps" className="mb-6 text-center text-sm font-medium text-muted">{t('mk_integrations_strip')}</h2>
          <ul className="flex flex-wrap justify-center gap-3 sm:gap-3.5">
            {APPS.map(a => (
              <li key={a}>
                <Link
                  href="/integrations"
                  dir="ltr"
                  className="inline-flex rounded-[14px] border border-line bg-surface px-5 py-3 text-[15px] font-medium text-body shadow-card transition-[border-color,color,transform] hover:-translate-y-0.5 hover:border-line-strong hover:text-ink sm:px-[22px] sm:text-base"
                >
                  {a}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Feature rows */}
        <section id="features" aria-label={t('features_title')} className="mx-auto flex max-w-[1280px] scroll-mt-24 flex-col gap-20 px-4 pb-5 pt-20 sm:px-8 sm:pt-[90px]">
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
        </section>

        {/* All features */}
        <Section
          title={t('features_title')}
          subtitle={t('features_subtitle')}
          className="pt-24 sm:pt-28"
        >
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(f => (
              <li key={f.tk} className="group flex flex-col gap-4 rounded-card border border-line bg-surface p-6 shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-card-hover">
                <IconTile icon={f.icon} tone={f.tone} />
                <h3 className="text-[17px] font-semibold text-ink">{t(f.tk)}</h3>
                <p className="text-[15px] leading-[1.85] text-body">{t(f.dk)}</p>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex justify-center">
            <Link href="/features" className="inline-flex items-center gap-1.5 text-[15px] font-semibold">
              {t('features_link')} {arrow}
            </Link>
          </div>
        </Section>

        {/* Steps */}
        <Section title={t('steps_title')} subtitle={t('steps_subtitle')} className="pt-4">
          <ol className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-[12%] top-[34px] hidden h-px bg-gradient-to-l from-brand-teal/0 via-brand-teal/40 to-brand-green/0 lg:block" />
            {STEPS.map((s, i) => (
              <li key={s} className="relative flex flex-col gap-3 rounded-card border border-line bg-surface p-6 shadow-card">
                <span className="tabular flex h-11 w-11 items-center justify-center rounded-full bg-brand-gradient text-base font-bold text-[#04282C] shadow-glow">{i + 1}</span>
                <h3 className="text-base font-semibold text-ink">{t(`${s}_title`)}</h3>
                <p className="text-sm leading-[1.8] text-body">{t(`${s}_desc`)}</p>
              </li>
            ))}
          </ol>
        </Section>

        {/* Pricing teaser */}
        <Section id="pricing" title={t('mk_pricing_title')} subtitle={t('pricing_subtitle')} className="scroll-mt-24">
          <PlanCards {...plans} onRetry={plans.reload} t={t} maxFeatures={4} />
          <div className="mt-8 flex justify-center">
            <Link href="/pricing" className="inline-flex items-center gap-1.5 text-[15px] font-semibold">
              {t('pricing_link')} {arrow}
            </Link>
          </div>
        </Section>

        {/* FAQ */}
        <Section title={t('faq_title')} narrow>
          <FaqList items={FAQ.map(n => ({ q: t(`faq${n}_q`), a: t(`faq${n}_a`) }))} />
        </Section>

        <CtaBand
          title={t('mk_cta_title')}
          subtitle={t('mk_cta_note')}
          actions={
            <>
              <Button href="/auth/register" size="xl" className="rounded-2xl px-[34px] text-lg font-bold">{t('pub_start_free')}</Button>
              <Button href="/pricing" variant="on-deep-ghost" size="xl" className="rounded-2xl px-7">{t('mk_view_pricing')}</Button>
            </>
          }
        />
      </MarketingPage>
    </>
  )
}
