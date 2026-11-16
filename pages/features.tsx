import React from 'react'
import Head from 'next/head'
import {
  BellAlertIcon, BoltIcon, ChartBarIcon, ChatBubbleLeftRightIcon, DevicePhoneMobileIcon, InboxStackIcon,
  KeyIcon, LinkIcon, MegaphoneIcon, RectangleStackIcon, SparklesIcon,
} from '@heroicons/react/24/outline'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import { Button } from '@/components/ui'
import { MarketingPage, PageHero, Section } from '@/components/marketing/MarketingPage'
import { CtaBand, IconTile } from '@/components/marketing/Blocks'
import { usePublicLang } from '@/components/marketing/usePublicLang'

type Tone = 'brand' | 'violet' | 'warning' | 'success'

const FEATURES: { icon: React.ElementType; tone: Tone; tk: string; dk: string; bk: string }[] = [
  { icon: MegaphoneIcon, tone: 'brand', tk: 'feat_campaigns_title', dk: 'feat_campaigns_desc', bk: 'feat_badge_marketing' },
  { icon: SparklesIcon, tone: 'violet', tk: 'feat_ai_title', dk: 'feat_ai_desc', bk: 'feat_badge_ai' },
  { icon: InboxStackIcon, tone: 'brand', tk: 'feat_inbox_title', dk: 'feat_inbox_desc', bk: 'feat_badge_support' },
  { icon: ChatBubbleLeftRightIcon, tone: 'warning', tk: 'feat_chatbot_title', dk: 'feat_chatbot_desc', bk: 'feat_badge_automation' },
  { icon: ChartBarIcon, tone: 'success', tk: 'feat_analytics_title', dk: 'feat_analytics_desc', bk: 'feat_badge_analytics' },
  { icon: BoltIcon, tone: 'warning', tk: 'feat_automation_title', dk: 'feat_automation_desc', bk: 'feat_badge_automation' },
  { icon: KeyIcon, tone: 'brand', tk: 'feat_otp_title', dk: 'feat_otp_desc', bk: 'feat_badge_security' },
  { icon: RectangleStackIcon, tone: 'success', tk: 'feat_quick_title', dk: 'feat_quick_desc', bk: 'feat_badge_support' },
  { icon: DevicePhoneMobileIcon, tone: 'violet', tk: 'feat_multi_title', dk: 'feat_multi_desc', bk: 'feat_badge_platform' },
  { icon: BellAlertIcon, tone: 'warning', tk: 'feat_notif_title', dk: 'feat_notif_desc', bk: 'feat_badge_platform' },
  { icon: LinkIcon, tone: 'brand', tk: 'integrations_title', dk: 'integrations_subtitle', bk: 'feat_badge_platform' },
]

export default function FeaturesPage() {
  const { brandName } = useWhiteLabel()
  const name = brandName || 'WABEK'
  const { lang, setLang, dir, t } = usePublicLang()
  const [lead, ...rest] = FEATURES

  return (
    <>
      <Head>
        <link rel="icon" href="/brand/favicon-32.png" />
        <title>{`${t('feat_title')} | ${name}`}</title>
      </Head>
      <MarketingPage
        active="/features"
        lang={lang}
        dir={dir}
        onLangChange={setLang}
        hero={
          <PageHero
            eyebrow={t('pub_product')}
            title={t('feat_title')}
            subtitle={t('feat_subtitle')}
            actions={
              <>
                <Button href="/auth/register" size="lg" className="rounded-[14px] px-7 shadow-glow">{t('pub_start_free')}</Button>
                <Button href="/pricing" variant="on-deep-ghost" size="lg" className="rounded-[14px] px-7">{t('mk_view_pricing')}</Button>
              </>
            }
          />
        }
      >
        <Section className="pt-14 sm:pt-16">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Lead feature: wide deep card */}
            <li className="relative overflow-hidden rounded-card bg-[#04282C] p-7 text-deep-ink shadow-hero sm:col-span-2 lg:col-span-2">
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_120%_at_100%_0%,#0E6C72,rgba(14,108,114,0)_60%)]" />
              <div className="relative flex h-full flex-col gap-4">
                <span className="w-fit rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-brand-green">{t(lead.bk)}</span>
                <IconTile icon={lead.icon} tone="deep" size="lg" />
                <h2 className="text-2xl font-bold text-deep-ink">{t(lead.tk)}</h2>
                <p className="max-w-xl text-base leading-[1.9] text-deep-muted">{t(lead.dk)}</p>
              </div>
            </li>
            {rest.map((f, i) => (
              <li
                key={i}
                className="group flex flex-col gap-4 rounded-card border border-line bg-surface p-6 shadow-card transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-line-strong hover:shadow-card-hover"
              >
                <div className="flex items-start justify-between gap-3">
                  <IconTile icon={f.icon} tone={f.tone} />
                  <span className="rounded-full bg-surface-3 px-2.5 py-1 text-[11px] font-semibold text-muted">{t(f.bk)}</span>
                </div>
                <h2 className="text-[17px] font-semibold text-ink">{t(f.tk)}</h2>
                <p className="text-[15px] leading-[1.85] text-body">{t(f.dk)}</p>
              </li>
            ))}
          </ul>
        </Section>

        <CtaBand
          title={t('feat_cta_title')}
          subtitle={t('feat_cta_subtitle')}
          actions={<Button href="/auth/register" size="xl" className="rounded-2xl px-8 text-lg font-bold">{t('pub_start_free')}</Button>}
        />
      </MarketingPage>
    </>
  )
}
