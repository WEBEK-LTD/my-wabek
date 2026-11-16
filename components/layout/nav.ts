import type { ElementType } from 'react'
import {
  HomeIcon, ChatBubbleLeftRightIcon, UserGroupIcon, PaperAirplaneIcon,
  CpuChipIcon, ChartBarIcon, PuzzlePieceIcon, AdjustmentsHorizontalIcon,
  UsersIcon, CreditCardIcon, BuildingStorefrontIcon, LifebuoyIcon,
  DocumentDuplicateIcon, Cog6ToothIcon, SparklesIcon, MagnifyingGlassCircleIcon,
  ClipboardDocumentListIcon, SignalIcon,
} from '@heroicons/react/24/outline'

export interface NavItem {
  href: string
  /** i18n key (lib/i18n.ts) */
  labelKey: string
  /** Plan feature flag; the item is shown locked and the page gated when false. */
  feature?: string
  /** Extra route prefixes that count as this item (e.g. legacy in-app pages). */
  match?: string[]
  /** Match `href` exactly instead of as a prefix. */
  exact?: boolean
  /** Hidden for accounts installed through Wix (billing is handled by Wix). */
  hideForWix?: boolean
  /** Opens outside the app shell (public page). */
  external?: boolean
}

export interface NavSection {
  id: string
  labelKey: string
  icon: ElementType
  items: NavItem[]
  /** Live counter shown on the section ("inbox" = unread conversations). */
  badge?: 'inbox'
}

/* ── Customer dashboard: 8 primary sections ──────────────── */
export const DASHBOARD_SECTIONS: NavSection[] = [
  {
    id: 'home', labelKey: 'nav_home', icon: HomeIcon,
    items: [{ href: '/dashboard', labelKey: 'sub_overview', exact: true }],
  },
  {
    id: 'inbox', labelKey: 'nav_inbox', icon: ChatBubbleLeftRightIcon, badge: 'inbox',
    items: [{ href: '/dashboard/chat', labelKey: 'sub_inbox' }],
  },
  {
    id: 'contacts', labelKey: 'nav_contacts', icon: UserGroupIcon,
    items: [
      { href: '/dashboard/contacts', labelKey: 'sub_all_contacts' },
      { href: '/dashboard/segments', labelKey: 'sub_segments' },
    ],
  },
  {
    id: 'campaigns', labelKey: 'nav_campaigns', icon: PaperAirplaneIcon,
    items: [
      { href: '/dashboard/campaigns', labelKey: 'sub_campaigns' },
      { href: '/dashboard/otp', labelKey: 'sub_otp' },
    ],
  },
  {
    id: 'automation', labelKey: 'nav_automation', icon: CpuChipIcon,
    items: [
      { href: '/dashboard/chatbot', labelKey: 'sub_chatbot', feature: 'allow_chatbot' },
      { href: '/dashboard/automation', labelKey: 'sub_flows', feature: 'allow_automation' },
      { href: '/dashboard/ai', labelKey: 'sub_ai' },
      { href: '/dashboard/quick-replies', labelKey: 'sub_quick_replies' },
    ],
  },
  {
    id: 'reports', labelKey: 'nav_reports', icon: ChartBarIcon,
    items: [{ href: '/dashboard/analytics', labelKey: 'sub_analytics', feature: 'allow_analytics' }],
  },
  {
    id: 'integrations', labelKey: 'nav_integrations', icon: PuzzlePieceIcon,
    items: [
      { href: '/dashboard/instances', labelKey: 'sub_numbers' },
      { href: '/dashboard/integrations', labelKey: 'sub_webhooks', feature: 'allow_api_access' },
      { href: '/dashboard/wix', labelKey: 'sub_wix' },
      { href: '/dashboard/whmcs', labelKey: 'sub_whmcs' },
      { href: '/dashboard/api-keys', labelKey: 'sub_api_keys', feature: 'allow_api_access' },
      { href: '/dashboard/links', labelKey: 'sub_links' },
    ],
  },
  {
    id: 'settings', labelKey: 'nav_settings', icon: AdjustmentsHorizontalIcon,
    items: [
      { href: '/dashboard/settings', labelKey: 'sub_account' },
      { href: '/dashboard/team', labelKey: 'sub_team' },
      { href: '/dashboard/sub-accounts', labelKey: 'sub_sub_accounts', feature: 'allow_sub_accounts' },
      { href: '/dashboard/billing', labelKey: 'sub_billing', hideForWix: true },
      { href: '/dashboard/white-label', labelKey: 'sub_white_label', feature: 'allow_white_label' },
      { href: '/dashboard/reseller', labelKey: 'sub_reseller', feature: 'allow_reseller' },
      { href: '/dashboard/notifications', labelKey: 'sub_notifications' },
      { href: '/dashboard/support', labelKey: 'sub_support' },
      // Public developer docs; the legacy in-app page still belongs to this section.
      { href: '/docs', labelKey: 'sub_docs', external: true, match: ['/dashboard/docs'] },
    ],
  },
]

/* ── Platform admin ─────────────────────────────────────── */
export const ADMIN_SECTIONS: NavSection[] = [
  {
    id: 'overview', labelKey: 'admin_overview', icon: HomeIcon,
    items: [
      { href: '/admin', labelKey: 'admin_dashboard', exact: true },
      { href: '/admin/analytics', labelKey: 'admin_analytics' },
    ],
  },
  { id: 'users', labelKey: 'admin_users', icon: UsersIcon, items: [{ href: '/admin/users', labelKey: 'admin_users' }] },
  { id: 'plans', labelKey: 'admin_plans', icon: CreditCardIcon, items: [{ href: '/admin/plans', labelKey: 'admin_plans' }] },
  {
    id: 'resellers', labelKey: 'admin_resellers', icon: BuildingStorefrontIcon,
    items: [
      { href: '/admin/resellers', labelKey: 'admin_resellers' },
      { href: '/admin/payouts', labelKey: 'admin_payouts' },
    ],
  },
  { id: 'support', labelKey: 'admin_support', icon: LifebuoyIcon, items: [{ href: '/admin/support', labelKey: 'admin_tickets' }] },
  { id: 'wa-templates', labelKey: 'admin_wa_templates', icon: DocumentDuplicateIcon, items: [{ href: '/admin/wa-templates', labelKey: 'admin_wa_templates' }] },
  {
    id: 'settings', labelKey: 'admin_settings', icon: Cog6ToothIcon,
    items: [
      { href: '/admin/settings', labelKey: 'admin_platform' },
      { href: '/admin/whatsapp', labelKey: 'admin_system_whatsapp' },
    ],
  },
  { id: 'ai', labelKey: 'admin_ai', icon: SparklesIcon, items: [{ href: '/admin/ai-settings', labelKey: 'admin_ai' }] },
  { id: 'seo', labelKey: 'admin_seo', icon: MagnifyingGlassCircleIcon, items: [{ href: '/admin/seo', labelKey: 'admin_seo' }] },
  { id: 'logs', labelKey: 'admin_logs', icon: ClipboardDocumentListIcon, items: [{ href: '/admin/logs', labelKey: 'admin_logs' }] },
  { id: 'status', labelKey: 'admin_status', icon: SignalIcon, items: [{ href: '/admin/service-status', labelKey: 'admin_status' }] },
]

/* ── Matching helpers ───────────────────────────────────── */

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(prefix + '/')
}

export function isItemActive(item: NavItem, pathname: string): boolean {
  if (item.exact ? pathname === item.href : matchesPrefix(pathname, item.href)) return true
  return !!item.match?.some(m => matchesPrefix(pathname, m))
}

/** Active section + item for a route (longest matching href wins). */
export function findActive(sections: NavSection[], pathname: string): { section?: NavSection; item?: NavItem } {
  let best: { section?: NavSection; item?: NavItem; len: number } = { len: -1 }
  for (const section of sections) {
    for (const item of section.items) {
      if (isItemActive(item, pathname) && item.href.length > best.len) best = { section, item, len: item.href.length }
    }
  }
  return { section: best.section, item: best.item }
}

export interface ItemVisibility {
  features?: Record<string, unknown>
  isWix?: boolean
}

export function isItemVisible(item: NavItem, { isWix }: ItemVisibility): boolean {
  return !(item.hideForWix && isWix)
}

/** Locked = the plan explicitly turns the feature off (unknown flags are allowed). */
export function isItemLocked(item: NavItem, { features }: ItemVisibility): boolean {
  return !!item.feature && !!features && features[item.feature] === false
}
