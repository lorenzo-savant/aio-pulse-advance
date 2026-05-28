'use client'

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { AioLogo } from '@/components/brand/Logo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { LanguageSwitcherCompact } from '@/components/LanguageSwitcherCompact'
import { cn } from '@/lib/utils'

export interface SiteHeaderNavItem {
  label: string
  href: string
  /** Marks this link as the "current" page so it stays underlined. */
  active?: boolean
}

interface SiteHeaderProps {
  navItems?: SiteHeaderNavItem[]
  /** Primary CTA (right side). Pass `null` to hide. Defaults to "Get Started". */
  primaryCta?: { label: string; href: string } | null
  /** Secondary action (left of CTA). Pass `null` to hide. Defaults to "Sign in". */
  secondaryCta?: { label: string; href: string } | null
  /** Show the theme toggle next to the CTAs. Defaults to true. */
  showThemeToggle?: boolean
  /** Optional extra slot rendered on the right (before theme toggle). */
  rightSlot?: ReactNode
  className?: string
}

/**
 * Single source of truth for the marketing header across all public pages.
 * Sticky by default, gains a soft shadow + denser blur once the page scrolls.
 */
export function SiteHeader({
  navItems = [],
  primaryCta,
  secondaryCta,
  showThemeToggle = true,
  rightSlot,
  className,
}: SiteHeaderProps) {
  const t = useTranslations('site_header')
  const [scrolled, setScrolled] = useState(false)

  // Fall back to translated defaults if the caller didn't override them.
  // Using `null` explicitly hides a CTA; `undefined` means "use translated default".
  const resolvedPrimary =
    primaryCta === null ? null : (primaryCta ?? { label: t('get_started'), href: '/dashboard' })
  const resolvedSecondary =
    secondaryCta === null ? null : (secondaryCta ?? { label: t('sign_in'), href: '/auth/login' })

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'aio-site-header sticky top-0 z-50 w-full transition-all duration-300',
        scrolled
          ? 'bg-background/85 border-b border-border shadow-sm backdrop-blur-md backdrop-saturate-150'
          : 'bg-background/60 backdrop-blur-sm',
        className,
      )}
    >
      <div
        className={cn(
          'mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 transition-all duration-300',
          scrolled ? 'py-2.5' : 'py-4',
        )}
      >
        <Link href="/" aria-label="AIO Pulse" className="shrink-0">
          <AioLogo size={scrolled ? 32 : 36} />
        </Link>

        {navItems.length > 0 && (
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn('aio-nav-link', item.active && 'aio-nav-link--active')}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-2">
          {rightSlot}
          <LanguageSwitcherCompact ariaLabel={t('language_aria')} />
          {showThemeToggle && <ThemeToggle />}
          {resolvedSecondary && (
            <Link
              href={resolvedSecondary.href}
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
            >
              {resolvedSecondary.label}
            </Link>
          )}
          {resolvedPrimary && (
            <Link
              href={resolvedPrimary.href}
              className="shadow-accent/25 hover:bg-accent-hover inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-lg transition-all active:scale-95"
            >
              {resolvedPrimary.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
