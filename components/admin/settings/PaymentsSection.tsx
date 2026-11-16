import React from 'react'
import { ArrowPathIcon, BanknotesIcon, CreditCardIcon, GiftIcon, KeyIcon } from '@heroicons/react/24/outline'
import { Button, Card, CardHeader } from '@/components/ui'
import { useAdminT } from '../i18n'
import { Notice } from '../shared'

/** Payments are configured through env vars and the plans/payouts pages; this section points there. */
export function PaymentsSection() {
  const { tr } = useAdminT()
  return (
    <div className="space-y-5">
      <Card className="space-y-4">
        <CardHeader icon={CreditCardIcon} title="Stripe" subtitle={tr('الاشتراكات الشهرية والسنوية تُدار عبر Stripe.', 'Monthly and yearly subscriptions are billed through Stripe.')} />
        <Notice tone="info" icon={KeyIcon} title={tr('المفاتيح في متغيرات البيئة', 'Keys live in environment variables')}>
          {tr('تُقرأ مفاتيح Stripe من متغيرات البيئة على الخادم (مثل STRIPE_SECRET_KEY) ولا تُخزَّن في إعدادات المنصة ولا تُعرض هنا.',
            'Stripe keys are read from server environment variables (e.g. STRIPE_SECRET_KEY); they are not stored in platform settings or shown here.')}
        </Notice>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: ArrowPathIcon, title: tr('مزامنة الباقات', 'Sync plans'), desc: tr('أنشئ أسعار Stripe لكل باقة مدفوعة.', 'Create Stripe prices for each paid plan.'), href: '/admin/plans', cta: tr('الباقات', 'Plans') },
            { icon: GiftIcon, title: tr('رموز الهدايا', 'Gift codes'), desc: tr('فعّل باقات دون دفع.', 'Activate plans without payment.'), href: '/admin/plans', cta: tr('الهدايا', 'Gifts') },
            { icon: BanknotesIcon, title: tr('مدفوعات الموزّعين', 'Reseller payouts'), desc: tr('سجّل تحويلات العمولات.', 'Record commission transfers.'), href: '/admin/payouts', cta: tr('المدفوعات', 'Payouts') },
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
