import type React from 'react'
import {
  InboxArrowDownIcon, PaperAirplaneIcon, CheckCircleIcon, UserPlusIcon, MegaphoneIcon, BellSlashIcon, BellAlertIcon,
  CpuChipIcon, CursorArrowRaysIcon,
} from '@heroicons/react/24/outline'

/** Outgoing webhook events (same list and order as lib/outgoing-webhooks.ts WEBHOOK_EVENTS). */
export const EVENTS: Array<{ value: string; label: string; desc: string; icon: React.ElementType }> = [
  { value: 'message_received', label: 'رسالة واردة', desc: 'عندما يرسل إليك جهة اتصال رسالة', icon: InboxArrowDownIcon },
  { value: 'message_sent', label: 'رسالة صادرة', desc: 'عند إرسال أي رسالة صادرة (API وصندوق المحادثات والحملات والروبوتات)', icon: PaperAirplaneIcon },
  { value: 'message_status', label: 'حالة الرسالة', desc: 'عندما تصل رسالة صادرة أو تُقرأ أو تفشل', icon: CheckCircleIcon },
  { value: 'contact_created', label: 'جهة اتصال جديدة', desc: 'عند إنشاء جهة اتصال جديدة', icon: UserPlusIcon },
  { value: 'campaign_completed', label: 'اكتمال حملة', desc: 'عند انتهاء حملة من الإرسال', icon: MegaphoneIcon },
  { value: 'opt_out', label: 'إلغاء الاشتراك', desc: 'عندما يلغي جهة اتصال اشتراكه (STOP) أو يُلغى يدويًا', icon: BellSlashIcon },
  { value: 'opt_in', label: 'إعادة الاشتراك', desc: 'عندما يعيد جهة اتصال اشتراكه (START) أو يُعاد يدويًا', icon: BellAlertIcon },
  { value: 'chatbot_triggered', label: 'تشغيل روبوت المحادثة', desc: 'عند بدء مسار روبوت محادثة', icon: CpuChipIcon },
  { value: 'link_clicked', label: 'نقر رابط', desc: 'عند فتح رابط مختصر مُتتبَّع', icon: CursorArrowRaysIcon },
]

export const eventMeta = (v: string) => EVENTS.find(e => e.value === v)
