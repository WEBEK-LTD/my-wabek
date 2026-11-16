import { defineMessages } from '@/lib/i18n-local'
import common from './common'

export default defineMessages({
  en: {
    ...common.en,
    set: 'Set',
    enterNewValue: 'Enter the new value',
    hide: 'Hide',
    show: 'Show',
    notSet: 'Not set',
    leaveEmptyKeepStored: 'Leave empty to keep the stored value.',
    couldNotLoadData: 'Could not load data',
    tryAgain: 'Try again',
    copied: 'Copied',
    pagination: 'Pagination',
    previous: 'Previous',
    page: 'Page {page} of {pages}',
    next: 'Next',
    close: 'Close',
  },
  ar: {
    ...common.ar,
    set: 'محفوظ',
    enterNewValue: 'أدخل القيمة الجديدة',
    hide: 'إخفاء',
    show: 'إظهار',
    notSet: 'غير مضبوط',
    leaveEmptyKeepStored: 'اترك الحقل فارغًا للإبقاء على القيمة المحفوظة.',
    couldNotLoadData: 'تعذّر تحميل البيانات',
    tryAgain: 'إعادة المحاولة',
    copied: 'تم النسخ',
    pagination: 'التنقل بين الصفحات',
    previous: 'السابق',
    page: 'صفحة {page} من {pages}',
    next: 'التالي',
    close: 'إغلاق',
  },
  fr: {
    ...common.fr,

  },
  tr: {
    ...common.tr,

  },
})
