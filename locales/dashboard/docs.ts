// Legacy in-dashboard API reference (pages/dashboard/docs.tsx): page chrome only.
// The reference articles themselves are English content.
import { defineMessages } from '@/lib/i18n-local'

const messages = defineMessages({
  en: {
    title: 'Documentation',
    search_ph: 'Search docs…',
    no_results: 'No results for “{q}”',
    toggle_menu: 'Toggle the docs menu',
    copy_code: 'Copy code',
    copied: 'Copied',
    content_note: 'This reference is available in English. The full documentation is also available in Arabic.',
    open_docs: 'Open the documentation site',
  },
  ar: {
    title: 'التوثيق',
    search_ph: 'ابحث في التوثيق…',
    no_results: 'لا توجد نتائج لـ «{q}»',
    toggle_menu: 'إظهار قائمة التوثيق أو إخفاؤها',
    copy_code: 'نسخ الشيفرة',
    copied: 'تم النسخ',
    content_note: 'هذا المرجع متاح باللغة الإنجليزية، والتوثيق الكامل متاح أيضًا باللغة العربية.',
    open_docs: 'فتح موقع التوثيق',
  },
  fr: {
    title: 'Documentation',
    search_ph: 'Rechercher dans la documentation…',
    no_results: 'Aucun résultat pour « {q} »',
    toggle_menu: 'Afficher ou masquer le menu de la documentation',
    copy_code: 'Copier le code',
    copied: 'Copié',
    content_note: 'Cette référence est disponible en anglais. La documentation complète existe aussi en arabe.',
    open_docs: 'Ouvrir le site de documentation',
  },
  tr: {
    title: 'Dokümantasyon',
    search_ph: 'Dokümanlarda ara…',
    no_results: '“{q}” için sonuç yok',
    toggle_menu: 'Doküman menüsünü aç veya kapat',
    copy_code: 'Kodu kopyala',
    copied: 'Kopyalandı',
    content_note: 'Bu başvuru kaynağı İngilizce olarak sunulmaktadır. Tam dokümantasyon Arapça olarak da mevcuttur.',
    open_docs: 'Dokümantasyon sitesini aç',
  },
})

export default messages
