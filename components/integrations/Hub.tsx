// Integration cards (WordPress/WooCommerce, WHMCS, Wix, Zapier/Webhooks) and the Zapier/Make guides.
import React from 'react'
import Link from 'next/link'
import {
  ArrowDownTrayIcon, ShoppingCartIcon, ServerStackIcon, Squares2X2Icon, BoltIcon, BookOpenIcon, KeyIcon,
  PaperAirplaneIcon, ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline'
import { Badge, Button, Card, CardHeader, cn } from '@/components/ui'
import { StepList } from '@/components/settings/Shared'
import { CodeBlock, CopyField } from '@/components/campaigns/copy'
import { ForwardArrowIcon } from '@/components/campaigns/icons'
import { rich } from '@/components/campaigns/rich'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/dashboard/integrations'

function Tile({ icon: Icon, className }: { icon: React.ElementType; className?: string }) {
  return (
    <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-card', className)}>
      <Icon className="h-6 w-6" aria-hidden="true" />
    </span>
  )
}

export function IntegrationHub({ onOpenTab }: { onOpenTab: (tab: string) => void }) {
  const { t } = useT(messages)
  return (
    <div className="space-y-5">
      {/* WordPress / WooCommerce — featured */}
      <Card padding="none" className="overflow-hidden">
        <div className="grid grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="relative bg-deep-hero p-6 text-deep-ink sm:p-7">
            <div aria-hidden="true" className="pointer-events-none absolute -end-12 -top-16 h-48 w-48 rounded-full bg-brand-green/20 blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-3">
                <Tile icon={ShoppingCartIcon} className="bg-brand-gradient text-[#04282C]" />
                <div>
                  <h2 className="text-lg font-bold text-deep-ink">{t('wp_title')}</h2>
                  <p className="text-sm text-deep-muted">{t('wp_sub')}</p>
                </div>
              </div>
              <ul className="mt-5 space-y-2 text-sm text-deep-muted">
                <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-green" aria-hidden="true" />{t('wp_b1')}</li>
                <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-green" aria-hidden="true" />{t('wp_b2')}</li>
                <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-green" aria-hidden="true" />{t('wp_b3')}</li>
              </ul>
              <div className="mt-6 flex flex-wrap gap-2.5">
                <a href="/downloads/wabek-wordpress-plugin.zip" download className="inline-flex h-11 items-center gap-2 rounded-btn bg-brand-gradient px-4 text-sm font-semibold text-[#04282C] shadow-glow transition hover:brightness-105">
                  <ArrowDownTrayIcon className="h-5 w-5" aria-hidden="true" />{t('wp_download')}
                </a>
                <Button variant="on-deep-ghost" icon={BookOpenIcon} href="/docs/integrations/wordpress">{t('guide')}</Button>
              </div>
            </div>
          </div>
          <div className="p-6 sm:p-7">
            <p className="mb-4 text-sm font-semibold text-ink">{t('wp_steps_title')}</p>
            <StepList steps={[
              { title: t('wp_s1_t'), body: <>{rich(t('wp_s1_b'), { file: <code dir="ltr" className="font-mono text-[12.5px]">wabek-wordpress-plugin.zip</code> })}</> },
              { title: t('wp_s2_t'), body: t('wp_s2_b') },
              { title: t('wp_s3_t'), body: <>{rich(t('wp_s3_b'), { link: <Link href="/dashboard/api-keys" className="text-link hover:text-link-hover">{t('api_keys')}</Link> })}</> },
              { title: t('wp_s4_t'), body: t('wp_s4_b') },
            ]} />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* WHMCS */}
        <Card interactive className="flex flex-col">
          <div className="flex items-start gap-3">
            <Tile icon={ServerStackIcon} className="bg-violet-bg text-violet" />
            <div className="min-w-0">
              <h3 className="font-semibold text-ink">WHMCS</h3>
              <p className="text-sm text-muted">{t('whmcs_sub')}</p>
            </div>
          </div>
          <div className="mt-auto flex flex-wrap gap-2 pt-5">
            <Button size="sm" variant="dark" href="/dashboard/whmcs" iconEnd={ForwardArrowIcon}>{t('whmcs_setup')}</Button>
            <a href="/downloads/wabek-whmcs-addon.zip" download className="inline-flex h-9 items-center gap-1.5 rounded-btn border border-line-strong bg-surface px-3 text-sm font-medium text-ink transition hover:bg-surface-2">
              <ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" />{t('addon_zip')}
            </a>
          </div>
        </Card>

        {/* Wix */}
        <Card interactive className="flex flex-col">
          <div className="flex items-start gap-3">
            <Tile icon={Squares2X2Icon} className="bg-warning-bg text-warning" />
            <div className="min-w-0">
              <h3 className="font-semibold text-ink">Wix</h3>
              <p className="text-sm text-muted">{t('wix_sub')}</p>
            </div>
          </div>
          <div className="mt-auto flex flex-wrap gap-2 pt-5">
            <Button size="sm" variant="dark" href="/dashboard/wix" iconEnd={ForwardArrowIcon}>{t('wix_setup')}</Button>
            <Button size="sm" variant="ghost" icon={BookOpenIcon} href="/docs/integrations/wix">{t('guide')}</Button>
          </div>
        </Card>

        {/* Zapier / Webhooks */}
        <Card interactive className="flex flex-col">
          <div className="flex items-start gap-3">
            <Tile icon={BoltIcon} className="bg-chip text-brand-ink" />
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 font-semibold text-ink">{t('zap_title')}</h3>
              <p className="text-sm text-muted">{t('zap_sub')}</p>
            </div>
          </div>
          <div className="mt-auto flex flex-wrap gap-2 pt-5">
            <Button size="sm" variant="dark" onClick={() => onOpenTab('webhooks')} iconEnd={ForwardArrowIcon}>{t('tab_webhooks')}</Button>
            <Button size="sm" variant="secondary" onClick={() => onOpenTab('automation')}>{t('tab_automation')}</Button>
          </div>
        </Card>
      </div>

      <Card variant="muted" className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <KeyIcon className="h-6 w-6 shrink-0 text-brand-ink" aria-hidden="true" />
        <p className="flex-1 text-sm text-body">{t('api_note')}</p>
        <Button size="sm" variant="secondary" href="/dashboard/api-keys">{t('api_keys')}</Button>
      </Card>
    </div>
  )
}

export function AutomationGuides({ appUrl }: { appUrl: string }) {
  const { t } = useT(messages)
  const apiKey = 'YOUR_API_KEY'
  const trigger = `${appUrl}/api/webhooks/trigger`
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader icon={PaperAirplaneIcon} title={t('trigger_title')}
          subtitle={t('trigger_sub')}
          action={<Button size="sm" variant="ghost" icon={BookOpenIcon} href="/docs/integrations/zapier-webhooks">{t('guide')}</Button>} />
        <div className="mt-4 space-y-3">
          <CopyField label="POST" value={trigger} />
          <CopyField label="Header" value={`X-API-Key: ${apiKey}`} />
          <CodeBlock label="Body (JSON)" code={`{
  "to": "201234567890",
  "message": "Hello {{name}}!",
  "instance_id": "optional"
}`} />
          <p className="text-xs text-muted">
            {rich(t('trigger_note'), {
              key: <code dir="ltr" className="font-mono">YOUR_API_KEY</code>,
              link: <Link href="/dashboard/api-keys" className="text-link hover:text-link-hover">{t('api_keys')}</Link>,
              send: <code dir="ltr" className="font-mono">/api/v1/send</code>,
            })}
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader icon={BoltIcon} title={t('zapier_title')} subtitle={<span className="flex items-center gap-2">{t('zapier_sub')} <Badge size="sm" tone="neutral"><span dir="ltr">Webhooks by Zapier</span></Badge></span>} />
          <StepList className="mt-5" steps={[
            { title: t('zs1_t'), body: t('zs1_b') },
            { title: t('zs2_t'), body: t('zs2_b') },
            { title: t('zs3_t'), body: <span dir="ltr" className="block whitespace-pre-line text-start font-mono text-[12.5px]">{`URL: ${trigger}\nMethod: POST\nData Pass-Through: No`}</span> },
            { title: t('zs4_t'), body: <span dir="ltr" className="block whitespace-pre-line text-start font-mono text-[12.5px]">{`X-API-Key: ${apiKey}\nContent-Type: application/json`}</span> },
            { title: t('zs5_t'), body: <span className="whitespace-pre-line">{t('zs5_b')}</span> },
          ]} />
        </Card>
        <Card>
          <CardHeader icon={ArrowsRightLeftIcon} title={t('make_title')} subtitle={t('make_sub')} />
          <StepList className="mt-5" steps={[
            { title: t('ms1_t'), body: t('ms1_b') },
            { title: t('ms2_t'), body: t('ms2_b') },
            { title: t('ms3_t'), body: <span dir="ltr" className="block whitespace-pre-line text-start font-mono text-[12.5px]">{`URL: ${trigger}\nMethod: POST\nBody type: Raw\nContent type: JSON (application/json)`}</span> },
            { title: t('ms4_t'), body: <span dir="ltr" className="block whitespace-pre-line text-start font-mono text-[12.5px]">{`Name: X-API-Key\nValue: ${apiKey}`}</span> },
            { title: t('ms5_t'), body: <span dir="ltr" className="block text-start font-mono text-[12.5px]">{'{"to": "{{phone}}", "message": "{{message}}"}'}</span> },
          ]} />
        </Card>
      </div>
    </div>
  )
}
