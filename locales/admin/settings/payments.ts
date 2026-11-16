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
    monthlyYearlySubscriptionsBilled: 'Les abonnements mensuels et annuels sont facturés via Stripe.',
    keysLiveEnvironmentVariables: 'Les clés se trouvent dans les variables d’environnement',
    stripeKeysReadServer: 'Les clés Stripe sont lues depuis les variables d’environnement du serveur (par ex. STRIPE_SECRET_KEY) ; elles ne sont ni stockées dans les paramètres de la plateforme ni affichées ici.',
    syncPlans: 'Synchroniser les forfaits',
    createStripePricesEach: 'Créer les prix Stripe de chaque forfait payant.',
    activatePlansWithoutPayment: 'Activer des forfaits sans paiement.',
    gifts: 'Cadeaux',
    recordCommissionTransfers: 'Enregistrer les versements de commissions.',
  },
  tr: {
    ...common.tr,
    monthlyYearlySubscriptionsBilled: 'Aylık ve yıllık abonelikler Stripe üzerinden faturalandırılır.',
    keysLiveEnvironmentVariables: 'Anahtarlar ortam değişkenlerinde bulunur',
    stripeKeysReadServer: 'Stripe anahtarları sunucu ortam değişkenlerinden okunur (ör. STRIPE_SECRET_KEY); platform ayarlarında saklanmaz ve burada gösterilmez.',
    syncPlans: 'Planları eşitle',
    createStripePricesEach: 'Her ücretli plan için Stripe fiyatları oluşturun.',
    activatePlansWithoutPayment: 'Ödeme olmadan plan etkinleştirin.',
    gifts: 'Hediyeler',
    recordCommissionTransfers: 'Komisyon transferlerini kaydedin.',
  },
})
