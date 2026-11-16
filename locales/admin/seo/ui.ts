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

  },
  tr: {
    ...common.tr,

  },
})
