import { defineMessages } from '@/lib/i18n-local'
import common from '../common'

export default defineMessages({
  en: {
    ...common.en,
    monthlyYearlySubscriptionsBilled: 'Monthly and yearly subscriptions are billed through Stripe.',
    keysLiveEnvironmentVariables: 'Keys live in environment variables',
    stripeKeysReadServer: 'Stripe keys are read from server environment variables (e.g. STRIPE_SECRET_KEY); they are not stored in platform settings or shown here.',
    syncPlans: 'Sync plans',
    createStripePricesEach: 'Create Stripe prices for each paid plan.',
    activatePlansWithoutPayment: 'Activate plans without payment.',
    gifts: 'Gifts',
    recordCommissionTransfers: 'Record commission transfers.',
  },
  ar: {
    ...common.ar,
    monthlyYearlySubscriptionsBilled: 'الاشتراكات الشهرية والسنوية تُدار عبر Stripe.',
    keysLiveEnvironmentVariables: 'المفاتيح في متغيرات البيئة',
    stripeKeysReadServer: 'تُقرأ مفاتيح Stripe من متغيرات البيئة على الخادم (مثل STRIPE_SECRET_KEY) ولا تُخزَّن في إعدادات المنصة ولا تُعرض هنا.',
    syncPlans: 'مزامنة الباقات',
    createStripePricesEach: 'أنشئ أسعار Stripe لكل باقة مدفوعة.',
    activatePlansWithoutPayment: 'فعّل باقات دون دفع.',
    gifts: 'الهدايا',
    recordCommissionTransfers: 'سجّل تحويلات العمولات.',
  },
  fr: {
    ...common.fr,

  },
  tr: {
    ...common.tr,

  },
})
