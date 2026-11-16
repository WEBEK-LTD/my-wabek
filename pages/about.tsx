import React from 'react'
import Head from 'next/head'
import {
  ArrowTopRightOnSquareIcon, AtSymbolIcon, BuildingOffice2Icon, ChatBubbleLeftRightIcon, CpuChipIcon,
  DevicePhoneMobileIcon, EnvelopeIcon, EyeIcon, GlobeAltIcon, GlobeEuropeAfricaIcon, HashtagIcon, InboxStackIcon,
  LightBulbIcon, LockClosedIcon, MapPinIcon, MegaphoneIcon, PhoneIcon, ShieldCheckIcon, WindowIcon,
} from '@heroicons/react/24/outline'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import { Button } from '@/components/ui'
import { MarketingPage, PageHero, Section } from '@/components/marketing/MarketingPage'
import { CtaBand, IconTile } from '@/components/marketing/Blocks'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/public/about'

const LOGO = '/brand/favicon-32.png'

type Key = keyof typeof messages.en

const SERVICES: { icon: React.ElementType; n: 1 | 2 | 3 | 4 | 5 | 6; href: string }[] = [
  { icon: GlobeAltIcon, n: 1, href: 'https://webek.org/shared-hosting' },
  { icon: WindowIcon, n: 2, href: 'https://webek.org/wordpress' },
  { icon: DevicePhoneMobileIcon, n: 3, href: 'https://www.webek.uk/mobileapp' },
  { icon: CpuChipIcon, n: 4, href: 'https://waabek.com' },
  { icon: AtSymbolIcon, n: 5, href: 'https://webek.org/domain-names' },
  { icon: LockClosedIcon, n: 6, href: 'https://webek.org' },
]
const VALUES = [
  { icon: ShieldCheckIcon, n: 1 }, { icon: LightBulbIcon, n: 2 }, { icon: GlobeEuropeAfricaIcon, n: 3 }, { icon: EyeIcon, n: 4 },
] as const
const WABEK_POINTS = [
  { icon: InboxStackIcon, n: 1 }, { icon: MegaphoneIcon, n: 2 }, { icon: ChatBubbleLeftRightIcon, n: 3 }, { icon: DevicePhoneMobileIcon, n: 4 },
] as const
const LANGS = [1, 2, 3, 4] as const
const REGIONS = [1, 2, 3, 4] as const

const ext = { target: '_blank', rel: 'noopener noreferrer' }

export default function AboutPage() {
  const { brandName } = useWhiteLabel()
  const name = brandName || 'WABEK'
  const { t, lang, dir } = useT(messages)
  const tx = (key: Key) => t(key)
  const outArrow = <ArrowTopRightOnSquareIcon className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />

  const facts = [
    { label: tx('founded'), value: '2024' },
    { label: tx('registered'), value: 'UK' },
    { label: tx('countries'), value: '50+' },
    { label: tx('products'), value: '4' },
    { label: tx('company_no'), value: '16326894' },
    { label: tx('languages'), value: '4' },
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
      hero={
        <PageHero
          eyebrow={tx('company_no_eyebrow')}
          title={tx('hero_title')}
          subtitle={tx('hero_sub')}
          actions={
            <>
              <Button href="/auth/register" size="lg" className="rounded-[14px] px-7 shadow-glow">{tx('get_started')}</Button>
              <Button href="https://webek.org" variant="on-deep-ghost" size="lg" iconEnd={ArrowTopRightOnSquareIcon} className="rounded-[14px] px-7 rtl:[&_svg]:-scale-x-100">webek.org</Button>
            </>
          }
        >
          <dl aria-label={tx('facts_label')} className="mt-6 grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3">
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
                  <p className="font-semibold text-deep-ink">{tx(`pt${f.n}_title`)}</p>
                  <p className="mt-1 text-sm leading-relaxed text-deep-muted">{tx(`pt${f.n}_desc`)}</p>
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
              <h3 className="text-[17px] font-semibold text-ink">{tx(`svc${svc.n}_title`)}</h3>
              <p className="flex-1 text-[15px] leading-[1.85] text-body">{tx(`svc${svc.n}_desc`)}</p>
              <a href={svc.href} {...ext} className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold">
                {tx(`svc${svc.n}_cta`)} {outArrow}
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
              <h3 className="text-base font-semibold text-ink">{tx(`val${v.n}_title`)}</h3>
              <p className="text-sm leading-[1.8] text-body">{tx(`val${v.n}_desc`)}</p>
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
                  <MapPinIcon className="h-4 w-4 text-brand-ink" aria-hidden="true" />{tx(`region${r}`)}
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
                <span className="text-sm font-semibold text-ink">{tx(`lang${l}`)}</span>
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
