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
  Link2,
  Target,
  TrendingUp,
  Filter,
  ShieldCheck,
  Wand2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/Button'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import type { User } from '@supabase/supabase-js'
import { motion, AnimatePresence } from 'framer-motion'
import { sidebarVariants, backdropVariants } from '@/lib/motion'
import { useOverviewStats, type OverviewStats } from '@/hooks/useOverviewStats'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { useTranslations } from 'next-intl'

type NavBadgeKind = 'count' | 'alert' | 'setup' | 'lock'

interface NavItem {
  href: string
  icon: React.ElementType
  labelKey: string
  badgeKey?: string
  lockedTooltipKey?: string
  badge?: (stats: OverviewStats) => { text: string; kind: NavBadgeKind } | null
  lockedUntil?: (stats: OverviewStats) => boolean
}

interface NavSection {
  /** Step number badge. Omitted for the standalone Overview header. */
  step?: number
  labelKey: string
  descriptionKey?: string
  items: NavItem[]
}

// Exported so the Breadcrumb (and any future nav-derived UI) reuses the exact
// same workflow model — single source of truth for section/step/order.
export const NAV_SECTIONS: NavSection[] = [
  {
    // Standalone overview — it summarizes every step, so it sits above the
    // numbered flow rather than inside "3 · Insights".
    labelKey: 'sidebar.sections.overview.label',
    items: [{ href: '/dashboard', icon: LayoutDashboard, labelKey: 'sidebar.items.dashboard' }],
  },
  {
    step: 1,
    labelKey: 'sidebar.sections.setup.label',
    descriptionKey: 'sidebar.sections.setup.description',
    items: [
      {
        href: '/dashboard/onboarding',
        icon: Sparkle,
        labelKey: 'sidebar.items.start_here',
        badge: (s) => (s.brands === 0 ? { text: 'Begin', kind: 'setup' } : null),
      },
      {
        href: '/dashboard/brands',
        icon: Building2,
        labelKey: 'sidebar.items.brands',
        badge: (s) => ({ text: String(s.brands), kind: 'count' }),
      },
      {
        // Prompts now hosts the AI generator inline ("Generate (AI)" button),
        // so the standalone tool page no longer needs its own nav entry.
        href: '/dashboard/prompts',
        icon: MessageSquare,
        labelKey: 'sidebar.items.prompts',
        badge: (s) => ({ text: String(s.prompts), kind: 'count' }),
      },
    ],
  },
  {
    step: 2,
    labelKey: 'sidebar.sections.monitor.label',
    descriptionKey: 'sidebar.sections.monitor.description',
    items: [
      {
        href: '/dashboard/monitoring',
        icon: Radio,
        labelKey: 'sidebar.items.live_monitoring',
        badge: (s) =>
          s.prompts === 0
            ? { text: 'Setup first', kind: 'lock' }
            : s.monitoringRuns === 0
              ? { text: 'Run first check', kind: 'alert' }
              : null,
        lockedUntil: (s) => s.prompts === 0,
      },
      { href: '/dashboard/workflows', icon: GitBranch, labelKey: 'sidebar.items.workflows' },
      {
        href: '/dashboard/alerts',
        icon: Bell,
        labelKey: 'sidebar.items.alerts',
        badge: (s) => (s.unreadAlerts > 0 ? { text: String(s.unreadAlerts), kind: 'alert' } : null),
      },
    ],
  },
  {
    step: 3,
    labelKey: 'sidebar.sections.insights.label',
    descriptionKey: 'sidebar.sections.insights.description',
    // Ordered by data-flow priority: top-level KPIs first, then where the
    // AI engines find/cite you, then drilled-down analyses, then archives.
    // Each item generates a measurable signal the next ones build on.
    items: [
      // GEO Score first — the composite headline now that the overview lives
      // up top as its own entry.
      {
        href: '/dashboard/geo-score',
        icon: Target,
        labelKey: 'sidebar.items.geo_score',
      },
      // ── Where AI finds you (the foundation of every other insight) ─────
      {
        href: '/dashboard/citation-sources',
        icon: Link2,
        labelKey: 'sidebar.items.citation_sources',
      },
      {
        href: '/dashboard/citations',
        icon: BarChart3,
        labelKey: 'sidebar.items.citations',
        lockedUntil: (s) => !s.hasData,
      },
      // ── Quality / character of the citations ──────────────────────────
      {
        href: '/dashboard/sentiment',
        icon: Smile,
        labelKey: 'sidebar.items.sentiment',
        lockedUntil: (s) => !s.hasData,
      },
      // ── Actionable Q&A / content ──────────────────────────────────────
      {
        href: '/dashboard/aeo-snippets',
        icon: Sparkles,
        labelKey: 'sidebar.items.aeo_snippets',
      },
      {
        href: '/dashboard/keywords',
        icon: Tag,
        labelKey: 'sidebar.items.keywords',
        lockedUntil: (s) => !s.hasData,
      },
      // ── Unified reports ───────────────────────────────────────────────
      {
        href: '/dashboard/ai-funnel',
        icon: Filter,
        labelKey: 'sidebar.items.ai_funnel',
      },
      // ── Comparative + historical ──────────────────────────────────────
      { href: '/dashboard/competitor', icon: GitCompare, labelKey: 'sidebar.items.competitor' },
      {
        href: '/dashboard/snapshots',
        icon: Camera,
        labelKey: 'sidebar.items.snapshots',
        lockedUntil: (s) => !s.hasData,
      },
      {
        href: '/dashboard/reports',
        icon: FileText,
        labelKey: 'sidebar.items.reports',
        lockedUntil: (s) => !s.hasData,
      },
      { href: '/dashboard/history', icon: Clock, labelKey: 'sidebar.items.scan_history' },
    ],
  },
  {
    step: 4,
    labelKey: 'sidebar.sections.optimize.label',
    descriptionKey: 'sidebar.sections.optimize.description',
    // Strategy Advisor first because it synthesizes everything from Step 3
    // into a ranked action list. Recommendations is the persistent surface
    // for those actions. Content Audit feeds the Advisor; Content
    // Optimizer is the drill-down editing tool. Engine Info is reference.
    items: [
      {
        href: '/dashboard/advisor',
        icon: Sparkles,
        labelKey: 'sidebar.items.strategy_advisor',
      },
      {
        href: '/dashboard/recommendations',
        icon: Lightbulb,
        labelKey: 'sidebar.items.recommendations',
      },
      { href: '/dashboard/audit', icon: ClipboardCheck, labelKey: 'sidebar.items.content_audit' },
      {
        href: '/dashboard/optimizer',
        icon: FileSearch,
        labelKey: 'sidebar.items.content_optimizer',
      },
      // Site Audit Hub — consolidates the AI-readiness checks
      // (foundations / crawler access / citation capture / quality)
      // that otherwise live scattered across the Insights surfaces.
      {
        href: '/dashboard/site-audit',
        icon: ShieldCheck,
        labelKey: 'sidebar.items.site_audit',
      },
      // Content Generator — AI-citation-optimised article drafting,
      // auto-scored against the same 5 signals the Site Audit measures.
      // Closes the measure → create loop.
      {
        href: '/dashboard/content-generator',
        icon: Wand2,
        labelKey: 'sidebar.items.content_generator',
      },
      { href: '/dashboard/monitor', icon: Globe, labelKey: 'sidebar.items.engine_info' },
    ],
  },
  {
    step: 5,
    labelKey: 'sidebar.sections.account.label',
    // Account section ordered by frequency of need + operational adjacency:
    // Billing + Credits are the commercial layer, API Costs is the
    // operational view of where the credits actually go. Settings and
    // Documentation are infrequent reference items.
    items: [
      { href: '/dashboard/billing', icon: CreditCard, labelKey: 'sidebar.items.billing' },
      { href: '/dashboard/credits', icon: Coins, labelKey: 'sidebar.items.credits' },
      { href: '/dashboard/api-costs', icon: TrendingUp, labelKey: 'sidebar.items.api_costs' },
      { href: '/dashboard/settings', icon: Settings, labelKey: 'sidebar.items.settings' },
      { href: '/dashboard/docs', icon: BookOpen, labelKey: 'sidebar.items.documentation' },
    ],
  },
]

function SidebarContent({
  onClose,
  onItemClick,
}: {
  onClose?: () => void
  onItemClick?: () => void
}) {
  // This component only renders the brand header. Auth/logout/nav-active state
  // lives in the main Sidebar component below — the previous copy here was dead
  // code and included an invalid useRouter() call inside a callback.
  return (
    <div className="flex h-16 items-center justify-between px-5">
      <Link className="flex items-center gap-2.5" href="/dashboard">
        <div className="bg-brand-gradient flex h-[34px] w-[34px] items-center justify-center rounded-xl">
          <span className="text-sm font-black text-white">A</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[20px] font-extrabold tracking-tight text-foreground">
            AEO Pulse
          </span>
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

function BadgePill({ text, kind }: { text: string; kind: NavBadgeKind }) {
  const styles: Record<NavBadgeKind, string> = {
    count: 'bg-secondary text-muted-foreground',
    alert: 'bg-amber-500/20 text-amber-300',
    setup: 'bg-primary/20 text-primary',
    lock: 'bg-secondary text-muted-foreground opacity-70',
  }
  return (
    <span className={cn('ml-auto rounded px-1.5 py-0.5 text-[10px] font-bold', styles[kind])}>
      {text}
    </span>
  )
}

function NavSection({
  section,
  stats,
  onItemClick,
}: {
  section: NavSection
  stats: OverviewStats
  onItemClick?: () => void
}) {
  const pathname = usePathname()
  const t = useTranslations()

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    const prefix = href.endsWith('/') ? href : href + '/'
    return pathname.startsWith(prefix) || pathname === href
  }

  return (
    <div className="mb-5">
      <div className="mb-2.5 flex items-center gap-2 px-4">
        {section.step !== undefined && (
          <span className="bg-primary/15 flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-black text-primary">
            {section.step}
          </span>
        )}
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {t(section.labelKey)}
        </p>
      </div>
      {section.descriptionKey && (
        <p className="text-muted-foreground/70 mb-2 px-4 text-[10px]">
          {t(section.descriptionKey)}
        </p>
      )}
      <div className="space-y-0.5">
        {section.items.map((item) => {
          const active = isActive(item.href)
          const badge = item.badge?.(stats) ?? null
          const locked = item.lockedUntil?.(stats) ?? false
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'nav-link-horizon',
                active && 'active',
                locked && !active && 'opacity-50',
              )}
              onClick={onItemClick}
              title={locked ? t('sidebar.badges.locked_tooltip') : undefined}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {t(item.labelKey)}
              {active && (
                <span className="nav-link-indicator absolute right-0 top-1/2 h-9 w-1 -translate-y-1/2 rounded-full bg-brand" />
              )}
              {badge && !active && <BadgePill text={badge.text} kind={badge.kind} />}
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
  const { stats } = useOverviewStats(60_000)

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = (await supabase?.auth.getUser()) ?? { data: { user: null } }
      setUser(user)
      setLoading(false)
    }
    getUser()
    // supabase?.auth is stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            <NavSection key={section.labelKey} section={section} stats={stats} />
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-border p-4">
          <LanguageSwitcher />
          <div className="mb-3 mt-2 flex items-center gap-3 rounded-xl bg-secondary px-3 py-2.5">
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="bg-brand/20 flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black text-brand">
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
          <Link
            href="/trust"
            className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <Shield className="h-3.5 w-3.5" />
            Trust Center
          </Link>
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
                  key={section.labelKey}
                  section={section}
                  stats={stats}
                  onItemClick={() => setSidebarOpen(false)}
                />
              ))}
            </nav>

            {/* Footer */}
            <div className="border-t border-border p-4">
              <LanguageSwitcher />
              <div className="mb-3 mt-2 flex items-center gap-3 rounded-xl bg-secondary px-3 py-2.5">
                {loading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <div className="bg-brand/20 flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black text-brand">
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
              <Link
                href="/trust"
                className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
                onClick={() => setSidebarOpen(false)}
              >
                <Shield className="h-3.5 w-3.5" />
                Trust Center
              </Link>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}
