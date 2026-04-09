'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  FileSearch,
  Globe,
  BarChart3,
  GitCompare,
  Clock,
  Building2,
  MessageSquare,
  Shield,
  Smile,
  Bell,
  X,
  Settings,
  LogOut,
  Loader2,
  BookOpen,
  Tag,
  Camera,
  Lightbulb,
  FileText,
  CreditCard,
  ClipboardCheck,
  Sparkles,
  Coins,
  Radio,
  GitBranch,
  Sparkle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/Button'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import type { User } from '@supabase/supabase-js'

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/dashboard/analytics', icon: BarChart3, label: 'Analytics' },
    ],
  },
  {
    label: 'Content Tools',
    items: [
      { href: '/dashboard/optimizer', icon: FileSearch, label: 'Content Optimizer' },
      { href: '/dashboard/audit', icon: ClipboardCheck, label: 'Content Audit' },
      { href: '/dashboard/recommendations', icon: Lightbulb, label: 'Recommendations' },
      { href: '/dashboard/monitor', icon: Globe, label: 'Engine Info' },
      { href: '/dashboard/competitor', icon: GitCompare, label: 'Competitor Analysis' },
      { href: '/dashboard/history', icon: Clock, label: 'Scan History' },
    ],
  },
  {
    label: 'AI Monitoring',
    items: [
      { href: '/dashboard/brands', icon: Building2, label: 'Brands' },
      { href: '/dashboard/prompts', icon: MessageSquare, label: 'Prompts' },
      { href: '/dashboard/sentiment', icon: Smile, label: 'Sentiment' },
      { href: '/dashboard/citations', icon: BarChart3, label: 'Citations' },
      { href: '/dashboard/snapshots', icon: Camera, label: 'Snapshots' },
      { href: '/dashboard/keywords', icon: Tag, label: 'Keywords' },
      { href: '/dashboard/alerts', icon: Bell, label: 'Alerts' },
      { href: '/dashboard/reports', icon: FileText, label: 'Reports' },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/dashboard/billing', icon: CreditCard, label: 'Billing' },
      { href: '/dashboard/credits', icon: Coins, label: 'Credits' },
      { href: '/dashboard/settings', icon: Settings, label: 'Settings' },
      { href: '/dashboard/docs', icon: BookOpen, label: 'Documentation' },
    ],
  },
]

const EXTRA_ITEMS = [
  { href: '/dashboard/monitoring', icon: Radio, label: 'Live Monitoring' },
  { href: '/dashboard/workflows', icon: GitBranch, label: 'Workflows' },
  { href: '/dashboard/onboarding', icon: Sparkle, label: 'Guided Setup', badge: 'Start' },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { sidebarOpen, setSidebarOpen } = useAppStore()
  const supabase = createSupabaseBrowserClient()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = (await supabase?.auth.getUser()) ?? { data: { user: null } }
      setUser(user)
      setLoading(false)
    }
    getUser()
  }, [])

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    const prefix = href.endsWith('/') ? href : href + '/'
    return pathname.startsWith(prefix) || (pathname === href)
  }

  const handleLogout = async () => {
    await supabase?.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const userEmail = user?.email || 'Dev User'
  const userInitial = user?.email?.charAt(0).toUpperCase() || 'D'

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-nav-border bg-nav-bg transition-transform duration-300',
          'lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-nav-border px-5">
          <Link className="flex items-center gap-2.5" href="/dashboard">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 shadow-lg shadow-brand-600/30">
              <span className="text-sm font-black text-white">A</span>
            </div>
            <span className="text-base font-black tracking-tight text-nav-text-hover">
              AIO Pulse
            </span>
          </Link>
          <button
            className="rounded-lg p-1.5 text-nav-text hover:text-nav-text-hover lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="mb-6">
              <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-widest text-nav-text">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all',
                        active
                          ? 'bg-nav-active-bg text-nav-text-active'
                          : 'text-nav-text hover:bg-nav-active-bg/50 hover:text-text-on-surface',
                      )}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <item.icon
                        className={cn(
                          'h-4 w-4 shrink-0',
                          active ? 'text-nav-active-text' : 'text-nav-text',
                        )}
                      />
                      {item.label}
                      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-500" />}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}

          {EXTRA_ITEMS.length > 0 && (
            <div className="mb-6">
              <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-widest text-nav-text">
                Tools
              </p>
              <div className="space-y-0.5">
                {EXTRA_ITEMS.map((item) => {
                  const active = isActive(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all',
                        active
                          ? 'bg-nav-active-bg text-nav-text-active'
                          : 'text-nav-text hover:bg-nav-active-bg/50 hover:text-text-on-surface',
                      )}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <item.icon
                        className={cn(
                          'h-4 w-4 shrink-0',
                          active ? 'text-nav-active-text' : 'text-nav-text',
                        )}
                      />
                      {item.label}
                      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-500" />}
                      {item.badge && (
                        <span className="ml-auto rounded bg-brand-500/20 px-1.5 py-0.5 text-[10px] font-black text-brand-400">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="border-t border-nav-border p-4">
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-surface-row px-3 py-2.5">
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-nav-text" />
            ) : (
              <>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600/20 text-xs font-black text-brand-600 text-text-on-surface">
                  {userInitial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-text-on-surface">
                    {user?.email?.split('@')[0] || 'Dev User'}
                  </p>
                  <p className="truncate text-[10px] text-text-muted-surface">
                    {user?.email || 'dev-user-local'}
                  </p>
                </div>
              </>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-nav-text hover:bg-surface-row-hover hover:text-red-600"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>
    </>
  )
}
