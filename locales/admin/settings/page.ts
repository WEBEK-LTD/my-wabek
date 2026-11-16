import { defineMessages } from '@/lib/i18n-local'
import common from '../common'

export default defineMessages({
  en: {
    ...common.en,
    general: 'General',
    platformRegistrationBrand: 'Platform, registration, brand',
    securityOtp: 'Security & OTP',
    verificationCodesSign: 'Verification codes, sign-in',
    emailSmtp: 'Email (SMTP)',
    mailServerTest: 'Mail server, test',
    payments: 'Payments',
    integrations: 'Integrations',
    trackingWebmasterPush: 'Tracking, webmaster, push',
    platformSettings: 'Platform settings',
    platformWideSettingsEvery: 'Platform-wide settings for every user. Secrets are shown masked and only sent when you change them.',
    settingsSections: 'Settings sections',
    unsavedChanges_one: '{n} unsaved change',
    unsavedChanges_other: '{n} unsaved changes',
  },
  ar: {
    ...common.ar,
    general: 'عام',
    platformRegistrationBrand: 'المنصة، التسجيل، الهوية',
    securityOtp: 'الأمان وOTP',
    verificationCodesSign: 'رموز التحقق، الدخول',
    emailSmtp: 'البريد (SMTP)',
    mailServerTest: 'خادم الإرسال، الاختبار',
    payments: 'المدفوعات',
    integrations: 'التكاملات',
    trackingWebmasterPush: 'التتبّع، مشرفو المواقع، الإشعارات',
    platformSettings: 'إعدادات المنصة',
    platformWideSettingsEvery: 'إعدادات عامة تنطبق على كل المستخدمين. القيم السرية تظهر مقنّعة ولا تُرسل إلا عند تغييرها.',
    settingsSections: 'أقسام الإعدادات',
    unsavedChanges_one: '{n} تغيير غير محفوظ',
    unsavedChanges_other: '{n} تغيير غير محفوظ',
  },
  fr: {
    ...common.fr,

  },
  tr: {
    ...common.tr,

  },
})
