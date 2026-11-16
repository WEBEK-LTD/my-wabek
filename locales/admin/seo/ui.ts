import { defineMessages } from '@/lib/i18n-local'
import common from '../common'

export default defineMessages({
  en: {
    ...common.en,
    good: 'Good',
    fair: 'Fair',
    poor: 'Poor',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    noTitle: '(no title)',
    metaDescriptionWillAppear: 'Your meta description will appear here…',
  },
  ar: {
    ...common.ar,
    good: 'جيد',
    fair: 'مقبول',
    poor: 'ضعيف',
    high: 'عالية',
    medium: 'متوسطة',
    low: 'منخفضة',
    noTitle: '(بلا عنوان)',
    metaDescriptionWillAppear: 'سيظهر وصف Meta هنا…',
  },
  fr: {
    ...common.fr,
    good: 'Bon',
    fair: 'Correct',
    poor: 'Faible',
    high: 'Élevée',
    medium: 'Moyenne',
    low: 'Faible',
    noTitle: '(sans titre)',
    metaDescriptionWillAppear: 'Votre meta description apparaîtra ici…',
  },
  tr: {
    ...common.tr,
    good: 'İyi',
    fair: 'Orta',
    poor: 'Zayıf',
    high: 'Yüksek',
    medium: 'Orta',
    low: 'Düşük',
    noTitle: '(başlık yok)',
    metaDescriptionWillAppear: 'Meta açıklamanız burada görünecek…',
  },
})
