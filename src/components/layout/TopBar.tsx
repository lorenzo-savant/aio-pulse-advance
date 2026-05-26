'use client'

import { useTheme } from 'next-themes'
import { Bell, User, Search, Menu, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useAppStore } from '@/lib/store'
import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import WorkspaceSwitcher from '@/components/workspace/WorkspaceSwitcher'

const BREADCRUMB_MAP: Record<string, string> = {
  '/dashboard': 'Main Dashboard',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/optimizer': 'Content Optimizer',
  '/dashboard/audit': 'Content Audit',
  '/dashboard/recommendations': 'Recommendations',
  '/dashboard/monitor': 'Engine Info',
  '/dashboard/competitor': 'Competitor Analysis',
  '/dashboard/history': 'Scan History',
  '/dashboard/brands': 'Brands',
  '/dashboard/prompts': 'Prompts',
  '/dashboard/sentiment': 'Sentiment',
  '/dashboard/citations': 'Citations',
  '/dashboard/snapshots': 'Snapshots',
  '/dashboard/keywords': 'Keywords',
  '/dashboard/alerts': 'Alerts',
  '/dashboard/reports': 'Reports',
  '/dashboard/billing': 'Billing',
  '/dashboard/credits': 'Credits',
  '/dashboard/settings': 'Settings',
  '/dashboard/docs': 'Documentation',
  '/dashboard/monitoring': 'Live Monitoring',
  '/dashboard/workflows': 'Workflows',
  '/dashboard/onboarding': 'Guided Setup',
}

function getBreadcrumb(pathname: string) {
  if (BREADCRUMB_MAP[pathname]) {
    return { section: 'Pages', title: BREADCRUMB_MAP[pathname] }
  }
  if (pathname.startsWith('/dashboard/brands/')) {
    return { section: 'Pages / Brands', title: 'Brand Detail' }
  }
  return { section: 'Pages', title: 'Dashboard' }
}

export function TopBar() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ type: string; id: string; name: string }[]>(
    [],
  )
  const [searching, setSearching] = useState(false)
  const [searchResultsOpen, setSearchResultsOpen] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [alertCount, setAlertCount] = useState(0)
  const searchRef = useRef<HTMLDivElement>(null)
  const mobileSearchRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const breadcrumb = getBreadcrumb(pathname)
  const userId = useAppStore((s) => s.userId)
  const currentWorkspaceId = useAppStore((s) => s.currentWorkspaceId) ?? ''

  useEffect(() => {
    setMounted(true)
    async function loadAlertCount() {
      try {
        const res = await fetch('/api/alerts?type=events&limit=1')
        if (res.ok) {
          const data = await res.json()
          const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
          const recent = (data.data || []).filter(
            (e: { created_at?: string; timestamp?: string }) => {
              const t = e.created_at || e.timestamp
              return t && new Date(t).getTime() > oneDayAgo
            },
          )
          setAlertCount(recent.length)
        }
      } catch {
        // silently fail
      }
    }
    loadAlertCount()
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mobileSearchOpen && mobileSearchRef.current) {
      mobileSearchRef.current.focus()
    }
  }, [mobileSearchOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileSearchOpen(false)
        setSearchResultsOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchResultsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const search = async () => {
      if (!searchQuery.trim() || searchQuery.length < 2) {
        setSearchResults([])
        return
      }
      setSearching(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`)
        const json = await res.json()
        setSearchResults(json.data || [])
      } catch (err) {
        console.error('Search error:', err)
      } finally {
        setSearching(false)
      }
    }
    const debounce = setTimeout(search, 300)
    return () => clearTimeout(debounce)
  }, [searchQuery])

  const handleResultClick = (result: { type: string; id: string }) => {
    setSearchResultsOpen(false)
    setSearchQuery('')
    if (result.type === 'brand') {
      router.push(`/dashboard/brands/${result.id}`)
    } else if (result.type === 'prompt') {
      router.push(`/dashboard/prompts?prompt_id=${result.id}`)
    }
  }

  return (
    <>
      {mobileSearchOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background p-4">
          <div className="flex items-center gap-3">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
            <input
              ref={mobileSearchRef}
              className="flex-1 bg-transparent text-lg text-foreground outline-none placeholder:text-muted-foreground"
              placeholder="Search brands, prompts..."
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setSearchResultsOpen(true)
              }}
              onKeyDown={(e) =>
                e.key === 'Enter' &&
                searchResults.length > 0 &&
                handleResultClick(searchResults[0]!)
              }
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setMobileSearchOpen(false)}
              aria-label="Close search"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          {searchResultsOpen && searchResults.length > 0 && (
            <div className="mt-4 flex-1 overflow-y-auto">
              {searchResults.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  className="flex w-full items-center gap-3 px-2 py-3 text-left hover:bg-secondary"
                  onClick={() => {
                    handleResultClick(result)
                    setMobileSearchOpen(false)
                  }}
                >
                  <span className="text-xs uppercase text-muted-foreground">{result.type}</span>
                  <span>{result.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <header className="navbar-horizon">
        <div className="flex items-center gap-4">
          <Button
            size="icon"
            variant="ghost"
            className="lg:hidden"
            onClick={toggleSidebar}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </Button>

          <div className="hidden lg:block">
            <WorkspaceSwitcher currentWorkspaceId={currentWorkspaceId} userId={userId ?? ''} />
          </div>

          <div className="flex flex-col">
            <span className="text-xs font-medium text-muted-foreground">{breadcrumb.section}</span>
            <span className="text-sm font-bold text-foreground">{breadcrumb.title}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative hidden max-w-xs flex-1 md:block" ref={searchRef}>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="w-full rounded-[30px] border-none bg-secondary py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-brand"
              placeholder="Search brands, prompts..."
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setSearchResultsOpen(true)
              }}
              onFocus={() => setSearchResultsOpen(true)}
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
            {searchResultsOpen && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-xl bg-card py-2 shadow-lg">
                {searchResults.map((result) => (
                  <button
                    key={`${result.type}-${result.id}`}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-secondary"
                    onClick={() => handleResultClick(result)}
                  >
                    <span className="text-xs uppercase text-muted-foreground">{result.type}</span>
                    <span>{result.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button
            size="icon"
            variant="ghost"
            className="md:hidden"
            onClick={() => setMobileSearchOpen(true)}
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </Button>

          <ThemeToggle />

          <Link href="/dashboard/alerts">
            <Button size="icon" variant="ghost" className="relative" aria-label="Notifications">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                <Bell className="h-4 w-4" aria-hidden="true" />
              </div>
              {alertCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[9px] font-bold text-white">
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              )}
              <span className="sr-only">Notifications</span>
            </Button>
          </Link>

          <div className="hidden h-6 w-px bg-border md:block" />

          <Link href="/dashboard/settings" className="hidden md:block">
            <Button size="sm" variant="ghost">
              <User className="h-4 w-4" />
              Settings
            </Button>
          </Link>
        </div>
      </header>
    </>
  )
}
