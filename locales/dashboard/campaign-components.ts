// components/campaigns: CampaignRow, DeliveryBar, Funnel, Stepper, WhatsAppPreview.
import { defineMessages } from '@/lib/i18n-local'

export default defineMessages({
  en: {
    // CampaignRow
    row_recipients: '{n} recipients',
    row_delivered: 'Delivered',
    row_read: 'Read',
    row_failed: '{n} failed',
    row_not_started: 'Sending hasn’t started yet',
    row_resume: 'Resume',
    row_start_now: 'Start now',
    row_start: 'Start',
    row_pause: 'Pause',
    row_details: 'Details',
    row_options: 'Campaign options',
    row_view_report: 'View report',
    row_delete: 'Delete campaign',

    // DeliveryBar
    bar_summary: '{processed} of {total} processed: {read} read, {delivered} delivered, {sent} sent, {failed} failed',
    bar_aria: 'Sending progress',

    // Funnel
    funnel_aria: 'Delivery funnel',
    funnel_of: ' of “{label}”',

    // Stepper
    stepper_aria: 'Campaign creation steps',
    step_n: 'Step {n}',
    step_n_label: 'Step {n}: {label}',
    step_of: 'Step {n} of {total}: {label}',

    // WhatsAppPreview
    sample_name: 'Sarah',
    sample_company: 'My Company',
    preview_placeholder: 'Your message will appear here…',
    preview_aria: 'Preview of the message as it appears in WhatsApp',
    preview_contact: 'Contact',
    preview_online: 'online',
  },
  ar: {
    row_recipients: '{n} مستلم',
    row_delivered: 'وصلت',
    row_read: 'قُرئت',
    row_failed: 'فشلت {n}',
    row_not_started: 'لم يبدأ الإرسال بعد',
    row_resume: 'استئناف',
    row_start_now: 'ابدأ الآن',
    row_start: 'ابدأ',
    row_pause: 'إيقاف مؤقت',
    row_details: 'التفاصيل',
    row_options: 'خيارات الحملة',
    row_view_report: 'عرض التقرير',
    row_delete: 'حذف الحملة',

    bar_summary: 'تمت معالجة {processed} من {total}: قُرئت {read}، وصلت {delivered}، أُرسلت {sent}، فشلت {failed}',
    bar_aria: 'تقدّم الإرسال',

    funnel_aria: 'مسار التسليم',
    funnel_of: ' من «{label}»',

    stepper_aria: 'خطوات إنشاء الحملة',
    step_n: 'الخطوة {n}',
    step_n_label: 'الخطوة {n}: {label}',
    step_of: 'الخطوة {n} من {total}: {label}',

    sample_name: 'سارة',
    sample_company: 'شركتي',
    preview_placeholder: 'ستظهر رسالتك هنا…',
    preview_aria: 'معاينة الرسالة كما تظهر في واتساب',
    preview_contact: 'جهة الاتصال',
    preview_online: 'متصل الآن',
  },
  fr: {
    row_recipients: '{n} destinataires',
    row_delivered: 'Distribués',
    row_read: 'Lus',
    row_failed: '{n} en échec',
    row_not_started: 'L’envoi n’a pas encore commencé',
    row_resume: 'Reprendre',
    row_start_now: 'Lancer maintenant',
    row_start: 'Lancer',
    row_pause: 'Mettre en pause',
    row_details: 'Détails',
    row_options: 'Options de la campagne',
    row_view_report: 'Voir le rapport',
    row_delete: 'Supprimer la campagne',

    bar_summary: '{processed} sur {total} traités : {read} lus, {delivered} distribués, {sent} envoyés, {failed} en échec',
    bar_aria: 'Progression de l’envoi',

    funnel_aria: 'Entonnoir de distribution',
    funnel_of: ' de « {label} »',

    stepper_aria: 'Étapes de création de la campagne',
    step_n: 'Étape {n}',
    step_n_label: 'Étape {n} : {label}',
    step_of: 'Étape {n} sur {total} : {label}',

    sample_name: 'Sarah',
    sample_company: 'Ma société',
    preview_placeholder: 'Votre message apparaîtra ici…',
    preview_aria: 'Aperçu du message tel qu’il apparaît dans WhatsApp',
    preview_contact: 'Contact',
    preview_online: 'en ligne',
  },
  tr: {
    row_recipients: '{n} alıcı',
    row_delivered: 'Teslim',
    row_read: 'Okunma',
    row_failed: '{n} başarısız',
    row_not_started: 'Gönderim henüz başlamadı',
    row_resume: 'Devam et',
    row_start_now: 'Şimdi başlat',
    row_start: 'Başlat',
    row_pause: 'Duraklat',
    row_details: 'Ayrıntılar',
    row_options: 'Kampanya seçenekleri',
    row_view_report: 'Raporu görüntüle',
    row_delete: 'Kampanyayı sil',

    bar_summary: '{total} içinden {processed} işlendi: {read} okundu, {delivered} teslim edildi, {sent} gönderildi, {failed} başarısız',
    bar_aria: 'Gönderim ilerlemesi',

    funnel_aria: 'Teslimat hunisi',
    funnel_of: ' (“{label}” içinden)',

    stepper_aria: 'Kampanya oluşturma adımları',
    step_n: 'Adım {n}',
    step_n_label: 'Adım {n}: {label}',
    step_of: 'Adım {n} / {total}: {label}',

    sample_name: 'Selin',
    sample_company: 'Şirketim',
    preview_placeholder: 'Mesajınız burada görünecek…',
    preview_aria: 'Mesajın WhatsApp’ta görünen önizlemesi',
    preview_contact: 'Kişi',
    preview_online: 'çevrimiçi',
  },
})
