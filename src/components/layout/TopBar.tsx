'use client'

import { useTheme } from 'next-themes'
import { Sun, Moon, Bell, User, Search, Menu, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useAppStore } from '@/lib/store'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export function TopBar() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ type: string; id: string; name: string }[]>(
    [],
  )
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const isDark = theme === 'dark'
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
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
    setShowResults(false)
    setSearchQuery('')
    if (result.type === 'brand') {
      router.push(`/dashboard/brands/${result.id}`)
    } else if (result.type === 'prompt') {
      router.push(`/dashboard/prompts?prompt_id=${result.id}`)
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-nav-border bg-nav-bg/80 px-6 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <Button
          size="icon"
          variant="ghost"
          className="lg:hidden"
          onClick={toggleSidebar}
          aria-label="Apri menu"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>

        <div className="relative hidden max-w-xs flex-1 md:block" ref={searchRef}>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-nav-text" />
          <input
            className="w-full rounded-xl border border-surface-input-border bg-surface-input py-2 pl-10 pr-4 text-sm text-text-on-surface placeholder-text-muted-surface outline-none transition-all focus:border-primary-600 focus:ring-1 focus:ring-primary-600"
            placeholder="Search brands, prompts..."
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setShowResults(true)
            }}
            onFocus={() => setShowResults(true)}
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-nav-text" />
          )}
          {showResults && searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-xl border border-nav-border bg-page-bg-elevated py-2 shadow-xl">
              {searchResults.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-text-secondary-surface hover:bg-surface-row-hover"
                  onClick={() => handleResultClick(result)}
                >
                  <span className="text-xs uppercase text-text-muted-surface">{result.type}</span>
                  <span>{result.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />

        <Button size="icon" variant="ghost" className="relative" aria-label="Notifications">
          <Bell className="h-4 w-4" aria-hidden="true" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-brand-500" />
          <span className="sr-only">Notifications</span>
        </Button>

        <div className="h-6 w-px bg-nav-border" />

        <Link href="/dashboard/settings">
          <Button size="sm" variant="outline">
            <User className="h-4 w-4" />
            Settings
          </Button>
        </Link>
      </div>
    </header>
  )
}
