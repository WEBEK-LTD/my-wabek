import type React from 'react'
import {
  InboxArrowDownIcon, PaperAirplaneIcon, CheckCircleIcon, UserPlusIcon, MegaphoneIcon, BellSlashIcon, BellAlertIcon,
  CpuChipIcon, CursorArrowRaysIcon,
} from '@heroicons/react/24/outline'
import type messages from '@/locales/dashboard/integrations'

type Key = keyof typeof messages.en

/**
 * Outgoing webhook events (same list and order as lib/outgoing-webhooks.ts
 * WEBHOOK_EVENTS). Labels: locales/dashboard/integrations (ev_<value>, ev_<value>_desc).
 */
export const EVENTS: Array<{ value: string; labelKey: Key; descKey: Key; icon: React.ElementType }> = [
  { value: 'message_received', labelKey: 'ev_message_received', descKey: 'ev_message_received_desc', icon: InboxArrowDownIcon },
  { value: 'message_sent', labelKey: 'ev_message_sent', descKey: 'ev_message_sent_desc', icon: PaperAirplaneIcon },
  { value: 'message_status', labelKey: 'ev_message_status', descKey: 'ev_message_status_desc', icon: CheckCircleIcon },
  { value: 'contact_created', labelKey: 'ev_contact_created', descKey: 'ev_contact_created_desc', icon: UserPlusIcon },
  { value: 'campaign_completed', labelKey: 'ev_campaign_completed', descKey: 'ev_campaign_completed_desc', icon: MegaphoneIcon },
  { value: 'opt_out', labelKey: 'ev_opt_out', descKey: 'ev_opt_out_desc', icon: BellSlashIcon },
  { value: 'opt_in', labelKey: 'ev_opt_in', descKey: 'ev_opt_in_desc', icon: BellAlertIcon },
  { value: 'chatbot_triggered', labelKey: 'ev_chatbot_triggered', descKey: 'ev_chatbot_triggered_desc', icon: CpuChipIcon },
  { value: 'link_clicked', labelKey: 'ev_link_clicked', descKey: 'ev_link_clicked_desc', icon: CursorArrowRaysIcon },
]

export const eventMeta = (v: string) => EVENTS.find(e => e.value === v)
