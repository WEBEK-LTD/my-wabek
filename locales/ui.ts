// Shared UI kit (components/ui): default dialog buttons and list punctuation
// used in chart labels for screen readers.
import { defineMessages } from '@/lib/i18n-local'

const messages = defineMessages({
  en: {
    cancel: 'Cancel',
    confirm: 'Confirm',
    list_sep: ', ',
    segment_pct: '{label} {pct}%',
  },
  ar: {
    cancel: 'إلغاء',
    confirm: 'تأكيد',
    list_sep: '، ',
    segment_pct: '{label} {pct}%',
  },
  fr: {
    cancel: 'Annuler',
    confirm: 'Confirmer',
    list_sep: ', ',
    segment_pct: '{label} {pct} %',
  },
  tr: {
    cancel: 'İptal',
    confirm: 'Onayla',
    list_sep: ', ',
    segment_pct: '{label} %{pct}',
  },
})

export default messages
