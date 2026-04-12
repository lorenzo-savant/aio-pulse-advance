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
import { motion, AnimatePresence } from 'framer-motion'
import { sidebarVariants, backdropVariants } from '@/lib/motion'

const NAV_SECTIONS = [
  {
    label: 'Getting Started',
    items: [
      { href: '/dashboard/onboarding', icon: Sparkle, label: 'Start Here', badge: 'Setup' },
      { href: '/dashboard/brands', icon: Building2, label: 'Brands' },
      { href: '/dashboard/prompts', icon: MessageSquare, label: 'Prompts' },
    ],
  },
  {
    label: 'Monitoring',
    items: [
      { href: '/dashboard/monitoring', icon: Radio, label: 'Live Monitoring' },
      { href: '/dashboard/sentiment', icon: Smile, label: 'Sentiment' },
      { href: '/dashboard/citations', icon: BarChart3, label: 'Citations' },
      { href: '/dashboard/snapshots', icon: Camera, label: 'Snapshots' },
      { href: '/dashboard/keywords', icon: Tag, label: 'Keywords' },
      { href: '/dashboard/alerts', icon: Bell, label: 'Alerts' },
      { href: '/dashboard/reports', icon: FileText, label: 'Reports' },
    ],
  },
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
      { href: '/dashboard/workflows', icon: GitBranch, label: 'Workflows' },
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

const EXTRA_ITEMS: Array<{ href: string; icon: typeof Sparkle; label: string; badge?: string }> = []

function SidebarContent({
  onClose,
  onItemClick,
}: {
  onClose?: () => void
  onItemClick?: () => void
}) {
  const pathname = usePathname()
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
    return pathname.startsWith(prefix) || pathname === href
  }

  const handleLogout = async () => {
    await supabase?.auth.signOut()
    useRouter().push('/auth/login')
    useRouter().refresh()
  }

  const userEmail = user?.email || 'Dev User'
  const userInitial = user?.email?.charAt(0).toUpperCase() || 'D'

  return (
    <div className="flex h-16 items-center justify-between px-5">
      <Link className="flex items-center gap-2.5" href="/dashboard">
        <div className="flex h-[34px] w-[34px] items-center justify-center rounded-xl bg-brand-gradient">
          <span className="text-sm font-black text-white">A</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[20px] font-extrabold tracking-tight text-foreground">AIO Pulse</span>
          <span className="text-[10px] font-medium text-muted-foreground">FREE</span>
        </div>
      </Link>
      {onClose && (
        <button
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary lg:hidden"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

function NavSection({
  label,
  items,
  onItemClick,
}: {
  label: string
  items: { href: string; icon: React.ElementType; label: string; badge?: string }[]
  onItemClick?: () => void
}) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    const prefix = href.endsWith('/') ? href : href + '/'
    return pathname.startsWith(prefix) || pathname === href
  }

  return (
    <div className="mb-6">
      <p className="mb-3 px-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="space-y-0.5">
        {items.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'nav-link-horizon',
                active && 'active',
              )}
              onClick={onItemClick}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.label}
              {active && (
                <span className="nav-link-indicator absolute right-0 top-1/2 h-9 w-1 -translate-y-1/2 rounded-full bg-brand" />
              )}
              {item.badge && !active && (
                <span className="ml-auto rounded bg-brand/20 px-1.5 py-0.5 text-[10px] font-bold text-brand">
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

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
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            key="backdrop"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Desktop sidebar (always visible) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[300px] flex-col bg-card shadow-[4px_0_30px_-10px_rgba(0,0,0,0.08)] lg:flex">
        <SidebarContent />

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_SECTIONS.map((section) => (
            <NavSection key={section.label} label={section.label} items={section.items} />
          ))}

          {EXTRA_ITEMS.length > 0 && (
            <NavSection label="Tools" items={EXTRA_ITEMS} />
          )}
        </nav>

        {/* Footer */}
        <div className="border-t border-border p-4">
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-secondary px-3 py-2.5">
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/20 text-xs font-black text-brand">
                  {userInitial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-foreground">
                    {user?.email?.split('@')[0] || 'Dev User'}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {user?.email || 'dev-user-local'}
                  </p>
                </div>
              </>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:bg-secondary hover:text-error"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile sidebar with animation */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            key="mobile-sidebar"
            variants={sidebarVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-y-0 left-0 z-40 flex w-[300px] flex-col bg-card shadow-[4px_0_30px_-10px_rgba(0,0,0,0.15)] lg:hidden"
          >
            <SidebarContent onClose={() => setSidebarOpen(false)} />

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto px-3 py-4">
              {NAV_SECTIONS.map((section) => (
                <NavSection
                  key={section.label}
                  label={section.label}
                  items={section.items}
                  onItemClick={() => setSidebarOpen(false)}
                />
              ))}

              {EXTRA_ITEMS.length > 0 && (
                <NavSection
                  label="Tools"
                  items={EXTRA_ITEMS}
                  onItemClick={() => setSidebarOpen(false)}
                />
              )}
            </nav>

            {/* Footer */}
            <div className="border-t border-border p-4">
              <div className="mb-3 flex items-center gap-3 rounded-xl bg-secondary px-3 py-2.5">
                {loading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/20 text-xs font-black text-brand">
                      {userInitial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-foreground">
                        {user?.email?.split('@')[0] || 'Dev User'}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {user?.email || 'dev-user-local'}
                      </p>
                    </div>
                  </>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-muted-foreground hover:bg-secondary hover:text-error"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}
