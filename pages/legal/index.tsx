import React from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { ArrowLeftIcon, BuildingOffice2Icon, CreditCardIcon, DocumentTextIcon, EnvelopeIcon, EyeIcon, LockClosedIcon, ScaleIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import { MarketingPage, PageHero, Section } from '@/components/marketing/MarketingPage'
import { IconTile } from '@/components/marketing/Blocks'
import { localeFor, useT } from '@/lib/i18n-local'
import messages from '@/locales/public/marketing'
import { legalText } from '@/lib/legal-i18n'

const LOGO = '/brand/favicon-32.png'

const DOCS: { href: string; icon: React.ElementType; n: 1 | 2 | 3 | 4 | 5; date: string }[] = [
  { href: '/legal/privacy', icon: ShieldCheckIcon, n: 1, date: '2025-05-01' },
  { href: '/legal/terms', icon: DocumentTextIcon, n: 2, date: '2025-05-01' },
  { href: '/legal/refund', icon: CreditCardIcon, n: 3, date: '2025-05-01' },
  { href: '/legal/license', icon: LockClosedIcon, n: 4, date: '2025-05-01' },
  { href: '/legal/accessibility', icon: EyeIcon, n: 5, date: '2025-05-01' },
]

export default function LegalIndexPage() {
  const { brandName } = useWhiteLabel()
  const name = brandName || 'WABEK'
  const { lang, dir } = useT(messages)
  const T = (k: string) => legalText('index', lang, k)
  // "May 2025"
  const month = (iso: string) => {
    try { return new Intl.DateTimeFormat(localeFor(lang), { year: 'numeric', month: 'long' }).format(new Date(iso)) } catch { return iso }
  }

  return (<>
    <Head>
      <link rel="icon" href={LOGO} />
      <title>{`${T('title')} | ${name}`}</title>
      <meta name="description" content={T('subtitle')} />
    </Head>
    <MarketingPage
      active="/legal"
      lang={lang}
      dir={dir}
      hero={<PageHero eyebrow={<span className="inline-flex items-center gap-1.5"><ScaleIcon className="h-4 w-4" aria-hidden="true" />WEBEK LTD</span>} title={T('title')} subtitle={T('subtitle')} />}
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
                    <h2 className="text-lg font-semibold text-ink">{T(`doc${doc.n}_title`)}</h2>
                    <span className="rounded-full bg-surface-3 px-2.5 py-0.5 text-xs text-muted">{T('updated')}: <time dateTime={doc.date}>{month(doc.date)}</time></span>
                  </div>
                  <p className="text-[15px] leading-relaxed text-body">{T(`doc${doc.n}_desc`)}</p>
                  <span className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-link">
                    {T('read_doc')}
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
          <p className="max-w-2xl text-[13px] leading-relaxed text-muted">{T('company')}</p>
          <p className="text-sm text-body">
            {T('questions')} {T('contact_us')}{' '}
            <a href="mailto:legal@waabek.com" className="inline-flex items-center gap-1 font-semibold" dir="ltr">
              <EnvelopeIcon className="h-4 w-4" aria-hidden="true" />legal@waabek.com
            </a>
          </p>
        </div>
      </Section>
    </MarketingPage>
  </>)
}
