import React from 'react'
import Head from 'next/head'
import { CheckIcon, CodeBracketIcon } from '@heroicons/react/24/outline'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import { Button } from '@/components/ui'
import { MarketingPage, PageHero, Section } from '@/components/marketing/MarketingPage'
import { CtaBand } from '@/components/marketing/Blocks'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/public/integrations'

type Key = keyof typeof messages.en

const INTEGRATIONS: { mark: string | null; grad: string; name: string; bk: Key; dk: Key; features: string[] }[] = [
  { mark: 'Wx', grad: 'linear-gradient(135deg,#12B5BE,#0E6C72)', name: 'Wix', bk: 'integ_official', dk: 'integ_wix_desc',
    features: ['order_confirmed', 'shipping_updates', 'abandoned_cart', 'refund_cancel', 'custom_templates', 'auto_account'] },
  { mark: 'WP', grad: 'linear-gradient(135deg,#0E6C72,#04282C)', name: 'WordPress & WooCommerce', bk: 'integ_plugin', dk: 'integ_wp_desc',
    features: ['new_order', 'payment_received', 'order_status', 'shipping_confirm', 'abandoned_cart', 'custom_webhooks'] },
  { mark: 'Zp', grad: 'linear-gradient(135deg,#E08A3C,#9A3412)', name: 'Zapier', bk: 'integ_nocode', dk: 'integ_zapier_desc',
    features: ['send_any_app', 'form_triggers', 'crm_integration', 'sheets_triggers', 'shopify_stripe', 'multi_step'] },
  { mark: 'WH', grad: 'linear-gradient(135deg,#12B5BE,#0B6E74)', name: 'WHMCS', bk: 'integ_module', dk: 'integ_whmcs_desc',
    features: ['invoice_alerts', 'ticket_replies', 'service_activation', 'domain_expiry', 'payment_confirm', 'ticket_updates'] },
  { mark: 'Me', grad: 'linear-gradient(135deg,#B59CF5,#5B3DB5)', name: 'Meta WhatsApp Cloud API', bk: 'integ_official_api', dk: 'integ_meta_desc',
    features: ['no_ban_risk', 'template_support', 'high_volume', 'webhook_status', 'media_support', 'green_tick'] },
  { mark: null, grad: 'linear-gradient(135deg,#1D6B4A,#04282C)', name: 'REST API', bk: 'integ_developer', dk: 'integ_api_desc',
    features: ['send_all_types', 'contact_endpoints', 'campaign_api', 'webhook_receipts', 'api_key_auth', 'full_docs'] },
]

export default function IntegrationsPage() {
  const { brandName } = useWhiteLabel()
  const name = brandName || 'WABEK'
  const { t, lang, dir } = useT(messages)

  return (
    <>
      <Head>
        <link rel="icon" href="/brand/favicon-32.png" />
        <title>{`${t('integ_title')} | ${name}`}</title>
      </Head>
      <MarketingPage
        active="/integrations"
        lang={lang}
        dir={dir}
        hero={
          <PageHero eyebrow={t('integrations')} title={t('integ_title')} subtitle={t('integ_subtitle')}>
            <ul className="mt-2 flex flex-wrap justify-center gap-2.5" aria-hidden="true">
              {INTEGRATIONS.map(i => (
                <li key={i.name} dir="ltr" className="rounded-xl border border-white/15 bg-white/[0.06] px-3.5 py-2 text-sm font-medium text-deep-ink">{i.name}</li>
              ))}
            </ul>
          </PageHero>
        }
      >
        <Section className="pt-14 sm:pt-16">
          <ul className="grid gap-5 lg:grid-cols-2">
            {INTEGRATIONS.map(intg => (
              <li
                key={intg.name}
                className="group flex flex-col gap-5 rounded-card border border-line bg-surface p-6 shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-card-hover sm:p-7"
              >
                <div className="flex items-start gap-4">
                  <span
                    aria-hidden="true"
                    dir="ltr"
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-card"
                    style={{ background: intg.grad }}
                  >
                    {intg.mark || <CodeBracketIcon className="h-7 w-7" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold text-ink" dir="ltr">{intg.name}</h2>
                      <span className="rounded-full bg-chip px-2.5 py-0.5 text-xs font-semibold text-chip-ink">{t(intg.bk)}</span>
                    </div>
                    <p className="mt-2 text-[15px] leading-[1.85] text-body">{t(intg.dk)}</p>
                  </div>
                </div>
                <ul className="grid gap-x-4 gap-y-2.5 border-t border-line-soft pt-5 sm:grid-cols-2">
                  {intg.features.map(fk => (
                    <li key={fk} className="flex items-start gap-2 text-sm text-ink">
                      <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-ink" strokeWidth={2.6} aria-hidden="true" />
                      <span>{t(`f_${fk}` as Key)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto">
                  <Button href="/auth/register" variant="secondary" size="sm">{t('integ_cta_start')}</Button>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <CtaBand
          title={t('integ_cta_title')}
          subtitle={t('integ_cta_subtitle')}
          actions={
            <>
              <Button href="/docs" size="xl" className="rounded-2xl px-8 text-lg font-bold">{t('integ_cta_docs')}</Button>
              <Button href="/auth/register" variant="on-deep-ghost" size="xl" className="rounded-2xl px-7">{t('integ_cta_start')}</Button>
            </>
          }
        />
      </MarketingPage>
    </>
  )
}
