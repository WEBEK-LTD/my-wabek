// Team member permissions — shared by the server (lib/auth.ts) and the dashboard UI.
// No server-only imports here.
//
// Every dashboard section has one level per member: none (hidden) · view · edit.
// The account owner always has everything. Billing, team, sub-accounts,
// white label and reseller stay owner-only (see OWNER_ONLY_HREFS).

export type PermLevel = 'none' | 'view' | 'edit'
export type MemberRoleName = 'admin' | 'agent' | 'viewer'

export const PERM_GROUPS = [
  'inbox',        // Chats, quick replies
  'contacts',     // Contacts, segments
  'campaigns',    // Campaigns, OTP
  'automation',   // Chatbot, flows, AI
  'analytics',    // Reports
  'numbers',      // WhatsApp numbers
  'integrations', // Webhooks, API keys, Wix, WHMCS
  'links',        // Short links
] as const
export type PermGroup = (typeof PERM_GROUPS)[number]

export type PermissionMap = Record<PermGroup, PermLevel>

export const PERM_PRESETS = ['admin', 'developer', 'marketing', 'support', 'viewer', 'custom'] as const
export type PermPreset = (typeof PERM_PRESETS)[number]

const all = (l: PermLevel): PermissionMap =>
  Object.fromEntries(PERM_GROUPS.map(g => [g, l])) as PermissionMap

export const PRESET_MAPS: Record<Exclude<PermPreset, 'custom'>, PermissionMap> = {
  admin: all('edit'),
  developer: { ...all('none'), integrations: 'edit', numbers: 'edit', links: 'edit', analytics: 'view', automation: 'view' },
  marketing: { ...all('none'), campaigns: 'edit', contacts: 'edit', links: 'edit', automation: 'edit', analytics: 'view', inbox: 'view', numbers: 'view' },
  support: { ...all('none'), inbox: 'edit', contacts: 'edit', numbers: 'view' },
  viewer: { ...all('view'), integrations: 'none' },
}

/** Stored team role for a preset: admin keeps full rights; read-only presets map to viewer. */
export function roleForPreset(preset: PermPreset, map: PermissionMap): MemberRoleName {
  if (preset === 'admin') return 'admin'
  return Object.values(map).some(l => l === 'edit') ? 'agent' : 'viewer'
}

/** Members created before per-section permissions existed. */
function legacyMap(role: MemberRoleName): PermissionMap {
  if (role === 'admin') return all('edit')
  if (role === 'agent') return { ...all('view'), inbox: 'edit', contacts: 'edit', integrations: 'none' }
  return PRESET_MAPS.viewer
}

const LEVELS: ReadonlySet<string> = new Set(['none', 'view', 'edit'])

/** Sanitise a stored/posted `{ preset, areas }` value. Returns null when unusable. */
export function parseStoredPermissions(raw: unknown): { preset: PermPreset; areas: PermissionMap } | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as { preset?: unknown; areas?: unknown }
  if (!r.areas || typeof r.areas !== 'object') return null // e.g. only { instances } from an invite
  const preset = (PERM_PRESETS as readonly string[]).includes(String(r.preset)) ? (r.preset as PermPreset) : 'custom'
  const src = (r.areas && typeof r.areas === 'object' ? r.areas : {}) as Record<string, unknown>
  const areas = all('none')
  for (const g of PERM_GROUPS) if (LEVELS.has(String(src[g]))) areas[g] = src[g] as PermLevel
  return { preset, areas }
}

/** Effective section levels for a team member. */
export function effectivePermissions(role: MemberRoleName, stored: unknown): PermissionMap {
  if (role === 'admin') return all('edit')
  return parseStoredPermissions(stored)?.areas || legacyMap(role)
}

export function presetOf(role: MemberRoleName, stored: unknown): PermPreset {
  if (role === 'admin') return 'admin'
  const p = parseStoredPermissions(stored)
  if (p) return p.preset
  return role === 'viewer' ? 'viewer' : 'support'
}

export const levelAllows = (have: PermLevel | undefined, need: 'view' | 'edit') =>
  need === 'view' ? have === 'view' || have === 'edit' : have === 'edit'

// ── Dashboard pages ──────────────────────────────────────────────────────────
// Which group a dashboard route belongs to. Routes not listed are personal or
// always visible (overview, profile, notifications, support, docs).
export const HREF_GROUPS: Record<string, PermGroup> = {
  '/dashboard/chat': 'inbox',
  '/dashboard/quick-replies': 'inbox',
  '/dashboard/contacts': 'contacts',
  '/dashboard/segments': 'contacts',
  '/dashboard/campaigns': 'campaigns',
  '/dashboard/otp': 'campaigns',
  '/dashboard/chatbot': 'automation',
  '/dashboard/automation': 'automation',
  '/dashboard/ai': 'automation',
  '/dashboard/analytics': 'analytics',
  '/dashboard/instances': 'numbers',
  '/dashboard/integrations': 'integrations',
  '/dashboard/api-keys': 'integrations',
  '/dashboard/wix': 'integrations',
  '/dashboard/whmcs': 'integrations',
  '/dashboard/links': 'links',
}

/** Owner-only pages (never shown to team members). */
export const OWNER_ONLY_HREFS = [
  '/dashboard/team', '/dashboard/billing', '/dashboard/sub-accounts', '/dashboard/white-label', '/dashboard/reseller',
]

const under = (path: string, href: string) => path === href || path.startsWith(href + '/')

export function groupForPath(path: string): PermGroup | null {
  let best: { g: PermGroup; len: number } | null = null
  for (const [href, g] of Object.entries(HREF_GROUPS)) if (under(path, href) && (!best || href.length > best.len)) best = { g, len: href.length }
  return best?.g || null
}

/**
 * Whether a team member may open a dashboard route. `perms` null = account owner.
 */
export function canOpenPath(path: string, perms: PermissionMap | null | undefined): boolean {
  if (!perms) return true
  if (OWNER_ONLY_HREFS.some(h => under(path, h))) return false
  const g = groupForPath(path)
  return !g || perms[g] !== 'none'
}
