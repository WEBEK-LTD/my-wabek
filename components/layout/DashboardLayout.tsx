// @ts-nocheck
import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAuthStore } from '@/lib/store'
import toast from 'react-hot-toast'
import { subscribeToPush, getPushStatus } from '@/lib/push-client'
import { useQuery } from 'react-query'
import axios from 'axios'
import { formatDistanceToNow } from 'date-fns'
import clsx from 'clsx'
import { useTranslation } from '@/hooks/useTranslation'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import {
  HomeIcon, ChatBubbleLeftRightIcon, UserGroupIcon,
  MegaphoneIcon, BoltIcon, ChartBarIcon, CreditCardIcon,
  Cog6ToothIcon, ShieldCheckIcon, Bars3Icon, XMarkIcon,
  ArrowRightOnRectangleIcon, BellIcon, BuildingOfficeIcon,
  KeyIcon, BookOpenIcon, UserCircleIcon, ChevronDownIcon,
  FunnelIcon, CpuChipIcon, LinkIcon, SwatchIcon, SparklesIcon,
  DevicePhoneMobileIcon, CheckCircleIcon, ExclamationTriangleIcon,
  CurrencyDollarIcon,
  InformationCircleIcon, ShieldExclamationIcon,
} from '@heroicons/react/24/outline'

// All nav items with optional feature flag
const NAV_GROUPS = [
  {
    id: 'main', label: null,
    items: [
      { href: '/dashboard', icon: HomeIcon, label: 'Overview' },
      { href: '/dashboard/chat', icon: ChatBubbleLeftRightIcon, label: 'Live Chat' },
      { href: '/dashboard/support', icon: HomeIcon, label: 'Support' },
    ],
  },
  {
    id: 'messaging', label: 'Messaging', emoji: '📨',
    items: [
      { href: '/dashboard/campaigns', icon: MegaphoneIcon, label: 'Campaigns' },
      { href: '/dashboard/contacts', icon: UserGroupIcon, label: 'Contacts' },
      { href: '/dashboard/segments', icon: FunnelIcon, label: 'Segments' },
      { href: '/dashboard/quick-replies', icon: BoltIcon, label: 'Quick Replies' },
      { href: '/dashboard/links', icon: LinkIcon, label: 'Link Tracker' },
    ],
  },
  {
    id: 'automation', label: 'Automation', emoji: '🤖',
    items: [
      { href: '/dashboard/chatbot', icon: CpuChipIcon, label: 'Chatbot', feature: 'allow_chatbot' },
      { href: '/dashboard/ai', icon: SparklesIcon, label: 'AI Auto-Reply' },
      { href: '/dashboard/automation', icon: BoltIcon, label: 'Flows', feature: 'allow_automation' },
      { href: '/dashboard/otp', icon: ShieldCheckIcon, label: 'OTP' },
    ],
  },
  {
    id: 'analytics', label: 'Analytics', emoji: '📊',
    items: [
      { href: '/dashboard/analytics', icon: ChartBarIcon, label: 'Analytics', feature: 'allow_analytics' },
    ],
  },
  {
    id: 'integrations', label: 'Integrations', emoji: '🔗',
    items: [
      { href: '/dashboard/wix', icon: LinkIcon, label: 'Wix' },
      { href: '/dashboard/whmcs', icon: BuildingOfficeIcon, label: 'WHMCS' },
      { href: '/dashboard/integrations', icon: LinkIcon, label: 'Integrations', feature: 'allow_api_access' },
      { href: '/dashboard/api-keys', icon: KeyIcon, label: 'API Keys', feature: 'allow_api_access' },
    ],
  },
  {
    id: 'account', label: 'Account', emoji: '⚙️',
    items: [
      { href: '/dashboard/instances', icon: BuildingOfficeIcon, label: 'WhatsApp' },
      { href: '/dashboard/team', icon: UserGroupIcon, label: 'Team' },
      { href: '/dashboard/billing', icon: CreditCardIcon, label: 'Billing' },
      { href: '/dashboard/notifications', icon: BellIcon, label: 'Notifications' },
      { href: '/dashboard/settings', icon: Cog6ToothIcon, label: 'Settings' },
    ],
  },
  {
    id: 'business', label: 'Business', emoji: '🏢',
    items: [
      { href: '/dashboard/reseller', icon: CurrencyDollarIcon, label: 'Reseller', feature: 'allow_reseller' },
      { href: '/dashboard/sub-accounts', icon: UserGroupIcon, label: 'Sub-Accounts', feature: 'allow_sub_accounts' },
      { href: '/dashboard/white-label', icon: SwatchIcon, label: 'White Label', feature: 'allow_white_label' },
    ],
  },
  {
    id: 'help', label: null,
    items: [
      { href: '/dashboard/docs', icon: BookOpenIcon, label: 'Docs' },
    ],
  },
]
const ALL_NAV_ITEMS = NAV_GROUPS.flatMap(g => g.items)

const notifIcons = {
  success: CheckCircleIcon,
  warning: ExclamationTriangleIcon,
  error: ExclamationTriangleIcon,
  info: InformationCircleIcon,
  message: ChatBubbleLeftRightIcon,
  campaign: MegaphoneIcon,
  system: Cog6ToothIcon,
}


// ── Collapsible Nav Groups ────────────────────────────────
function NavGroups({ groups, features, isActive, unreadCount, pathname, isWix }: {
  groups: typeof NAV_GROUPS
  features: Record<string, boolean>
  isActive: (href: string) => boolean
  unreadCount: number
  pathname: string
}) {
  // Auto-open group containing active route
  const getDefaultOpen = () => {
    const open: Record<string, boolean> = {}
    groups.forEach(g => {
      if (g.label && g.items.some(i => isActive(i.href))) open[g.id] = true
    })
    return open
  }
  const [open, setOpen] = useState<Record<string, boolean>>(getDefaultOpen)

  return (
    <>
      {groups.map(group => {
        const visibleItems = group.items.filter(item => (!item.feature || features[item.feature as string]) && (item.href !== '/dashboard/billing' || !isWix))
        if (!visibleItems.length) return null

        // Groups without label render flat
        if (!group.label) {
          return (
            <div key={group.id}>
              {visibleItems.map(item => (
                <NavItem key={item.href} item={item} isActive={isActive} unreadCount={unreadCount} />
              ))}
            </div>
          )
        }

        const isGroupOpen = open[group.id] ?? false
        const hasActive = visibleItems.some(i => isActive(i.href))

        return (
          <div key={group.id}>
            {/* Group header */}
            <button
              onClick={() => setOpen(o => ({ ...o, [group.id]: !o[group.id] }))}
              className={clsx(
                'w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-colors mt-1',
                hasActive ? 'text-brand-400' : 'text-gray-500 hover:text-gray-300'
              )}
            >
              <span className="flex items-center gap-1.5">
                <span>{group.emoji}</span>
                <span>{group.label}</span>
              </span>
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round"
                className={clsx("transition-transform duration-200", isGroupOpen ? "rotate-180" : "")}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Group items */}
            {isGroupOpen && (
              <div className="ml-2 border-l border-[#1E293B] pl-2 space-y-0.5 mb-1">
                {visibleItems.map(item => (
                  <NavItem key={item.href} item={item} isActive={isActive} unreadCount={unreadCount} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

function NavItem({ item, isActive, unreadCount }: {
  item: { href: string; icon: any; label: string }
  isActive: (href: string) => boolean
  unreadCount: number
}) {
  const active = isActive(item.href)
  const Icon = typeof item.icon === 'string' ? HomeIcon : item.icon
  return (
    <Link href={item.href}
      className={clsx(
        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all',
        active ? 'bg-[#2563EB] text-white font-medium rounded-lg' : 'text-[#CBD5E1] hover:bg-[rgba(59,130,246,0.12)] hover:text-white rounded-lg'
      )}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="truncate">{item.label}</span>
      {item.href === '/dashboard/notifications' && unreadCount > 0 && (
        <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  )
}


// ── Collapsible Sidebar Nav ───────────────────────────────
function CollapsibleNav({ groups, features, isActive, setSidebarOpen, brandColor, unreadCount, pathname, isWix }: any) {
  const getDefaultOpen = () => {
    const open: Record<string, boolean> = {}
    groups.forEach((g: any) => {
      if (g.label && g.items.some((i: any) => isActive(i.href))) open[g.id] = true
    })
    return open
  }
  const [open, setOpen] = useState<Record<string, boolean>>(getDefaultOpen)

  const NavLink = ({ item }: { item: any }) => {
    const active = isActive(item.href)
    const Icon = typeof item.icon === 'string' ? HomeIcon : item.icon
    return (
      <Link href={item.href} onClick={() => setSidebarOpen(false)}
        className={clsx('flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all mb-0.5',
          active ? 'text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-[rgba(59,130,246,0.10)]'
        )}
        style={active ? { backgroundColor: brandColor + '20', color: brandColor } : {}}>
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">{item.label}</span>
        {item.href === '/dashboard/notifications' && unreadCount > 0 && (
          <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full text-gray-900 min-w-[18px] text-center"
            style={{ backgroundColor: brandColor }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Link>
    )
  }

  return (
    <>
      {groups.map((group: any) => {
        const visibleItems = group.items.filter((item: any) => (!item.feature || features[item.feature] !== false) && (item.href !== '/dashboard/billing' || !isWix))
        if (!visibleItems.length) return null

        if (!group.label) {
          return (
            <div key={group.id} className="mb-1">
              {visibleItems.map((item: any) => <NavLink key={item.href} item={item} />)}
            </div>
          )
        }

        const isOpen = open[group.id] ?? false
        const hasActive = visibleItems.some((i: any) => isActive(i.href))

        return (
          <div key={group.id} className="mb-1">
            <button
              onClick={() => setOpen(o => ({ ...o, [group.id]: !o[group.id] }))}
              className={clsx(
                'w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors',
                hasActive ? 'text-blue-300' : 'text-slate-400 hover:text-slate-200'
              )}
            >
              <span className="flex items-center gap-1.5">
                <span className="text-sm">{group.emoji}</span>
                <span>{group.label}</span>
              </span>
              <ChevronDownIcon className={clsx('w-3 h-3 transition-transform duration-200', isOpen && 'rotate-180')} />
            </button>
            {isOpen && (
              <div className="ml-3 border-l border-white/5 pl-2 mt-0.5">
                {visibleItems.map((item: any) => <NavLink key={item.href} item={item} />)}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

export default function DashboardLayout({ children, title = 'Dashboard' }) {
  const { user, logout } = useAuthStore()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [pushStatus, setPushStatus] = useState<string>('')
  const [vapidKey, setVapidKey] = useState('')

  useEffect(() => {
    // Load VAPID key and auto-prompt if not subscribed
    fetch('/api/admin/seo').then(r=>r.json()).then(d => {
      const key = d.push?.vapid_public
      if (key) {
        setVapidKey(key)
        getPushStatus().then(s => setPushStatus(s))
      }
    }).catch(()=>{})
  }, [])
  const [profileOpen, setProfileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)

  // White label
  const { brandName, brandColor, brandLogo, brandSecondaryColor, favIcon, hidePoweredBy, customCss, customFooter } = useWhiteLabel()

  // Push notifications
  const requestPushPermission = async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return
    if (Notification.permission === 'granted') return
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return
    try {
      const reg = await navigator.serviceWorker.ready
      const { data: seoData } = await axios.get('/api/admin/seo').catch(() => ({ data: {} }))
      const vapidKey = seoData?.push?.vapid_public || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) return
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      })
      await axios.post('/api/push/subscribe', { subscription: sub.toJSON() })
    } catch (e) { console.error('Push subscribe error:', e) }
  }

  // Auto-request push on first load (after delay)
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const timer = setTimeout(() => {
      if (Notification.permission === 'default') requestPushPermission()
    }, 5000)
    return () => clearTimeout(timer)
  }, [])

  // Language / RTL
  const { t, isRTL } = useTranslation()
  const lang = user?.language || 'en'

  // Notifications
  const { data: notifData, refetch: refetchNotifs } = useQuery('notifications',
    () => axios.get('/api/notifications?limit=10').then(r => r.data),
    { refetchInterval: 30000, retry: false }
  )
  const notifications = notifData?.notifications || []
  const unreadCount = notifications.filter(n => !n.is_read).length

  // Plan features — controls what nav items show
  const { data: planData } = useQuery('plan-features',
    () => axios.get('/api/billing/plan-features').then(r => r.data),
    { staleTime: 60000, retry: false }
  )
  const features = planData?.features || {}
  const planName = planData?.plan?.name || ''

  // Plan expiry warning
  const { data: meData } = useQuery('me', () => axios.get('/api/auth/me').then(r => r.data), { staleTime: 300000 })
  const planExpiresAt = meData?.user?.plan_expires_at
  const daysLeft = planExpiresAt ? Math.ceil((new Date(planExpiresAt).getTime() - Date.now()) / 86400000) : null
  const planExpired = daysLeft !== null && daysLeft <= 0
  const planExpiringSoon = daysLeft !== null && daysLeft > 0 && daysLeft <= 7

  const markAllRead = async () => {
    await axios.put('/api/notifications', { action: 'mark_all_read' })
    refetchNotifs()
  }

  const isActive = (href: string) =>
    href === '/dashboard' ? router.pathname === href : router.pathname.startsWith(href)

  return (
    <>
      <Head>
        <title>{title}{brandName ? ` | ${brandName}` : ''}</title>
        <link rel="icon" href={favIcon || "https://res.cloudinary.com/dkl7ntpgw/image/upload/f_auto,q_auto/%D8%AA%D8%B5%D9%85%D9%8A%D9%85_%D8%A8%D8%AF%D9%88%D9%86_%D8%B9%D9%86%D9%88%D8%A7%D9%86_1_kejdrs"} />
        {customCss && <style>{customCss}</style>}
      </Head>

      <div className={`flex h-screen overflow-hidden bg-[#F8FAFC] ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <aside className={clsx(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[#1E293B] bg-[#0F172A] transition-transform duration-300 flex-shrink-0 w-56',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          'md:static md:translate-x-0'
        )}>
          {/* Logo */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-[#1E293B] flex-shrink-0">
            {brandLogo ? (
              <img src={brandLogo} alt={brandName} className="w-10 h-10 object-contain rounded-xl flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
                style={{ backgroundColor: brandColor }}>
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                  <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.96 9.96 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/>
                </svg>
              </div>
            )}
            <span className="font-display font-bold text-white font-bold text-sm truncate">{brandName}</span>
            <button onClick={() => setSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-white ml-auto text-gray-400">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto py-2 px-2">
            <CollapsibleNav
              groups={NAV_GROUPS}
              features={features}
              isActive={isActive}
              setSidebarOpen={setSidebarOpen}
              brandColor={brandColor}
              unreadCount={unreadCount}
              pathname={router.pathname}
              isWix={!!meData?.user?.wix_instance_id}
            />
          </nav>

          {/* Footer */}
          <div className="px-3 py-2 border-t border-[#1E293B] space-y-1.5">
            <div className="flex justify-center gap-2 flex-wrap">
              <a href="/legal/terms" target="_blank" className="text-[9px] text-gray-700 hover:text-gray-500 transition-colors">Terms</a>
              <span className="text-gray-800 text-[9px]">·</span>
              <a href="/legal/privacy" target="_blank" className="text-[9px] text-gray-700 hover:text-gray-500 transition-colors">Privacy</a>
              <span className="text-gray-800 text-[9px]">·</span>
              <a href="/legal/refund" target="_blank" className="text-[9px] text-gray-700 hover:text-gray-500 transition-colors">Refund</a>
            </div>
            {!hidePoweredBy && (
              <p className="text-[9px] text-gray-700 text-center">
                {customFooter || `Powered by ${brandName || 'webek.org'}`}
              </p>
            )}
          </div>
        </aside>

        {/* Main */}
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          {/* Topbar */}
          <header className="h-16 bg-white border-b border-[#E2E8F0] flex items-center px-5 gap-3 flex-shrink-0 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
            {/* Mobile menu button */}
            <button onClick={() => setSidebarOpen(true)} className="md:hidden text-slate-600 hover:text-slate-900">
              <Bars3Icon className="w-6 h-6" />
            </button>

            <h1 className="font-display font-bold text-[#0F172A] font-semibold text-base flex-1 truncate">{title}</h1>

            <div className="flex items-center gap-2">
              {/* Notifications */}
              <div className="relative">
                <button onClick={() => { setNotifOpen(v => !v); setProfileOpen(false) }}
                  className="p-2 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-blue-50 relative transition-colors">
                  <BellIcon className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ backgroundColor: brandColor }} />
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 top-10 w-[calc(100vw-2rem)] md:w-80 max-w-sm bg-white border border-[#E2E8F0] rounded-2xl shadow-[0_8px_30px_rgba(15,23,42,0.12)] z-50 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <p className="font-semibold text-[#0F172A] text-sm">Notifications</p>
                      {unreadCount > 0 && (
                        <button onClick={markAllRead} className="text-xs text-brand-400 hover:text-brand-300">Mark all read</button>
                      )}
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="text-center text-gray-500 text-sm py-8">No notifications</p>
                      ) : notifications.map(n => {
                        const Icon = notifIcons[n.type] || InformationCircleIcon
                        return (
                          <Link key={n.id} href={n.link || '/dashboard/notifications'}
                            onClick={() => setNotifOpen(false)}
                            className={clsx('flex items-start gap-3 px-4 py-3 hover:bg-[#F8FAFC] transition-colors border-b border-[#E2E8F0] last:border-0', !n.is_read && 'bg-blue-50')}>
                            <Icon className={clsx('w-4 h-4 mt-0.5 flex-shrink-0', n.type === 'success' ? 'text-brand-400' : n.type === 'warning' ? 'text-yellow-400' : n.type === 'error' ? 'text-red-400' : n.type === 'message' ? 'text-purple-400' : 'text-gray-400')} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-[#0F172A] truncate">{n.title}</p>
                              {n.body && <p className="text-xs text-gray-500 truncate">{n.body}</p>}
                              <p className="text-[10px] text-gray-600 mt-0.5">
                                {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                              </p>
                            </div>
                            {!n.is_read && <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: brandColor }} />}
                          </Link>
                        )
                      })}
                    </div>
                    <div className="px-4 py-2 border-t border-wabek-border">
                      <Link href="/dashboard/notifications" onClick={() => setNotifOpen(false)}
                        className="text-xs text-brand-400 hover:text-brand-300 block text-center">
                        View all notifications →
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Profile */}
              <div className="relative">
                <button onClick={() => { setProfileOpen(v => !v); setNotifOpen(false) }}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#F8FAFC] transition-colors">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-gray-900 flex-shrink-0"
                    style={{ backgroundColor: brandColor }}>
                    {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-xs font-medium text-gray-900 leading-tight truncate max-w-24">{user?.name || 'User'}</p>
                    <p className="text-[10px] text-gray-500 leading-tight">{user?.role === 'admin' ? '⭐ Admin' : '👤 User'}</p>
                  </div>
                  <ChevronDownIcon className="w-3 h-3 text-gray-400 hidden sm:block" />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-10 w-48 bg-white border border-[#E2E8F0] rounded-2xl shadow-[0_8px_30px_rgba(15,23,42,0.12)] z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-wabek-border">
                      <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                      <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                    </div>
                    {user?.role === 'admin' && (
                      <Link href="/admin" onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC]">
                        <ShieldCheckIcon className="w-4 h-4" /> Admin Panel
                      </Link>
                    )}
                    <Link href="/dashboard/settings" onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC]">
                      <Cog6ToothIcon className="w-4 h-4" /> Settings
                    </Link>
                    {!meData?.user?.wix_instance_id && (
                      <Link href="/dashboard/billing" onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC]">
                        <CreditCardIcon className="w-4 h-4" /> Billing
                      </Link>
                    )}
                    <div className="border-t border-wabek-border">
                      <button onClick={logout}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/10 w-full">
                        <ArrowRightOnRectangleIcon className="w-4 h-4" /> Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#F8FAFC]">
            {children}
          </main>
        </div>
      </div>
    </>
  )
}
