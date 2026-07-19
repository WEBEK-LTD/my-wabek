import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Head from 'next/head'
import { useAuthStore } from '@/lib/store'
import { useAdminAuth } from '@/hooks/useAuth'
import {
  HomeIcon, UserGroupIcon, CreditCardIcon, ChartBarIcon,
  ClipboardDocumentListIcon, Cog6ToothIcon, Bars3Icon,
  XMarkIcon, ArrowRightOnRectangleIcon, ShieldCheckIcon,
  ArrowLeftIcon, DevicePhoneMobileIcon, BanknotesIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

const adminNav = [
  { href: '/admin', icon: HomeIcon, label: 'Dashboard' },
  { href: '/admin/users', icon: UserGroupIcon, label: 'Users' },
  { href: '/admin/plans', icon: CreditCardIcon, label: 'Plans' },
  { href: '/admin/analytics', icon: ChartBarIcon, label: 'Analytics' },
  { href: '/admin/logs', icon: ClipboardDocumentListIcon, label: 'System Logs' },
  { href: '/admin/whatsapp', icon: DevicePhoneMobileIcon, label: 'WhatsApp OTP' },
  { href: '/admin/resellers', icon: UserGroupIcon, label: 'Resellers' },
  { href: '/admin/payouts', icon: BanknotesIcon, label: 'Payouts' },
  { href: '/admin/seo', icon: MagnifyingGlassIcon, label: 'SEO Manager' },
  { href: '/admin/settings', icon: Cog6ToothIcon, label: 'Settings' },
  { href: '/admin/ai-settings', icon: Cog6ToothIcon, label: '🤖 AI Settings' },
  { href: '/admin/service-status', icon: Cog6ToothIcon, label: '🟢 Service Status' },
  { href: '/admin/support', icon: Cog6ToothIcon, label: '🎫 Support Tickets' },
  { href: '/admin/wa-templates', icon: Cog6ToothIcon, label: '📋 WA Templates' },
]

export default function AdminLayout({ children, title = 'Admin' }: { children: React.ReactNode; title?: string }) {
  const { user, logout } = useAuthStore()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  useAdminAuth()

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-5 border-b border-wabek-border">
        <div className="w-9 h-9 bg-red-600 rounded-xl flex items-center justify-center">
          <ShieldCheckIcon className="w-5 h-5 text-gray-900" />
        </div>
        <div>
          <span className="font-display font-bold text-lg text-gray-900">WABEK</span>
          <p className="text-xs text-red-400 -mt-0.5 font-semibold uppercase tracking-wider">Admin Panel</p>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {adminNav.map((item) => {
          const active = router.pathname === item.href || (item.href !== '/admin' && router.pathname.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href}
              className={active ? 'nav-link-active' : 'nav-link'}
              onClick={() => setSidebarOpen(false)}>
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {item.label}
            </Link>
          )
        })}
        <div className="pt-4">
          <Link href="/dashboard" className="nav-link">
            <ArrowLeftIcon className="w-5 h-5 flex-shrink-0" />
            Back to App
          </Link>
        </div>
      </nav>
      <div className="border-t border-wabek-border p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-red-900 border border-red-700 flex items-center justify-center text-red-400 font-bold text-sm flex-shrink-0">
            {user?.name?.[0]?.toUpperCase() || 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
            <p className="text-xs text-red-400 truncate">Administrator</p>
          </div>
          <button onClick={logout} className="text-[#CBD5E1] hover:text-red-400 transition-colors p-1">
            <ArrowRightOnRectangleIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <Head><title>{title} – WABEK Admin</title></Head>
      <div className="flex h-screen bg-slate-100 overflow-hidden">
        <aside className="hidden lg:flex flex-col w-64 bg-wabek-card border-r border-wabek-border flex-shrink-0">
          <SidebarContent />
        </aside>
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
            <aside className="absolute left-0 top-0 bottom-0 w-64 bg-wabek-card border-r border-wabek-border z-10">
              <button onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 text-slate-600 hover:text-slate-900">
                <XMarkIcon className="w-5 h-5" />
              </button>
              <SidebarContent />
            </aside>
          </div>
        )}
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="h-14 bg-wabek-card border-b border-red-900/40 flex items-center gap-4 px-4 flex-shrink-0">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-600 hover:text-slate-900">
              <Bars3Icon className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-3 flex-1">
              <span className="px-2 py-0.5 bg-red-900/50 border border-red-800 text-red-400 text-xs font-bold rounded uppercase tracking-wider">Admin</span>
              <h1 className="font-display font-semibold text-gray-900 text-lg">{title}</h1>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto p-4 lg:p-6 animate-fade-in">
            {children}
          </main>
        </div>
      </div>
    </>
  )
}
