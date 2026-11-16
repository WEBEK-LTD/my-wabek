import React from 'react'
import { ArrowPathIcon, BanknotesIcon, CreditCardIcon, GiftIcon, KeyIcon } from '@heroicons/react/24/outline'
import { Button, Card, CardHeader } from '@/components/ui'
import { useAdminT } from '../i18n'
import { Notice } from '../shared'
import messages from '@/locales/admin/settings/payments'

/** Payments are configured through env vars and the plans/payouts pages; this section points there. */
export function PaymentsSection() {
  const { t } = useAdminT(messages)
  return (
    <div className="space-y-5">
      <Card className="space-y-4">
        <CardHeader icon={CreditCardIcon} title="Stripe" subtitle={t('monthlyYearlySubscriptionsBilled')} />
        <Notice tone="info" icon={KeyIcon} title={t('keysLiveEnvironmentVariables')}>
          {t('stripeKeysReadServer')}
        </Notice>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: ArrowPathIcon, title: t('syncPlans'), desc: t('createStripePricesEach'), href: '/admin/plans', cta: t('plans') },
            { icon: GiftIcon, title: t('giftCodes'), desc: t('activatePlansWithoutPayment'), href: '/admin/plans', cta: t('gifts') },
            { icon: BanknotesIcon, title: t('resellerPayouts'), desc: t('recordCommissionTransfers'), href: '/admin/payouts', cta: t('payouts') },
          ].map(x => (
            <div key={x.title} className="flex flex-col gap-2 rounded-xl border border-line-soft bg-surface-2 p-4">
              <x.icon className="h-5 w-5 text-brand-ink" aria-hidden="true" />
              <p className="text-sm font-semibold text-ink">{x.title}</p>
              <p className="flex-1 text-xs text-muted">{x.desc}</p>
              <Button size="xs" variant="secondary" href={x.href} className="self-start">{x.cta}</Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
