import { defineMessages } from '@/lib/i18n-local'
import common from '../common'

export default defineMessages({
  en: {
    ...common.en,
    testEmailSent: 'Test email sent',
    smtpTestFailed: 'SMTP test failed',
    smtpSettingsSaved: 'SMTP settings saved',
    mailServerSmtp: 'Mail server (SMTP)',
    usedEmailNotificationsPassword: 'Used for email notifications, password resets and support replies.',
    incomplete: 'Incomplete',
    host: 'Host',
    port: 'Port',
    security: 'Security',
    none: 'None',
    usernameFullEmail: 'Username (full email)',
    password: 'Password',
    name: 'From name',
    email: 'From email',
    saveSmtpSettings: 'Save SMTP settings',
    sendTestEmail: 'Send a test email',
    usesValuesShownAbove: 'Uses the values shown above, even before saving.',
    send: 'Send to',
    quickSetupMyMailbux: 'Quick setup: my.mailbux.com',
  },
  ar: {
    ...common.ar,
    testEmailSent: 'أُرسل البريد التجريبي',
    smtpTestFailed: 'فشل اختبار SMTP',
    smtpSettingsSaved: 'حُفظت إعدادات البريد',
    mailServerSmtp: 'خادم البريد (SMTP)',
    usedEmailNotificationsPassword: 'يُستخدم لإشعارات البريد وإعادة تعيين كلمات المرور وردود الدعم.',
    incomplete: 'غير مكتمل',
    host: 'المضيف',
    port: 'المنفذ',
    security: 'التشفير',
    none: 'بدون',
    usernameFullEmail: 'اسم المستخدم (البريد كاملًا)',
    password: 'كلمة المرور',
    name: 'اسم المرسل',
    email: 'بريد المرسل',
    saveSmtpSettings: 'حفظ إعدادات البريد',
    sendTestEmail: 'اختبار الإرسال',
    usesValuesShownAbove: 'يستخدم القيم الظاهرة أعلاه، حتى قبل الحفظ.',
    send: 'أرسل إلى',
    quickSetupMyMailbux: 'إعداد سريع: my.mailbux.com',
  },
  fr: {
    ...common.fr,

  },
  tr: {
    ...common.tr,

  },
})
