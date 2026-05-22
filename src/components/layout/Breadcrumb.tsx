'use client'

// Nav-derived breadcrumb + "next step" guide. Reuses NAV_SECTIONS (the single
// source of truth in Sidebar) so the trail and the workflow ordering can never
// drift from the sidebar. Renders:
//
//   Dashboard  ›  3 · Insights  ›  GEO Score          Next: Sentiment →
//
// The "Next" link walks the numbered Setup→Monitor→Insights→Optimize flow
// (steps 1–4) so a user always knows the next action. Overview/Account pages
// show the trail but no next-step (they sit outside the linear flow).

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ChevronRight, ArrowRight } from 'lucide-react'
import { NAV_SECTIONS } from './Sidebar'

function matchesHref(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  const prefix = href.endsWith('/') ? href : href + '/'
  return pathname === href || pathname.startsWith(prefix)
}

export function Breadcrumb() {
  const pathname = usePathname()
  const t = useTranslations()

  // Find the deepest (longest-href) nav item matching the current path.
  let current: { sectionLabelKey: string; itemLabelKey: string; href: string } | null = null
  let bestLen = -1
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (matchesHref(pathname, item.href) && item.href.length > bestLen) {
        bestLen = item.href.length
        current = {
          sectionLabelKey: section.labelKey,
          itemLabelKey: item.labelKey,
          href: item.href,
        }
      }
    }
  }

  // Not a nav page, or the dashboard root itself → no breadcrumb.
  if (!current || current.href === '/dashboard') return null

  // Linear workflow (steps 1–4) for the "next step" hint.
  const flow = NAV_SECTIONS.filter((s) => s.step !== undefined && s.step <= 4).flatMap(
    (s) => s.items,
  )
  const idx = flow.findIndex((i) => i.href === current!.href)
  const next = idx >= 0 && idx < flow.length - 1 ? flow[idx + 1] : null

  return (
    <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center justify-between gap-2">
      <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <li>
          <Link href="/dashboard" className="hover:text-foreground">
            {t('breadcrumb.home')}
          </Link>
        </li>
        <li aria-hidden className="flex items-center">
          <ChevronRight className="h-3.5 w-3.5 opacity-50" />
        </li>
        <li className="hidden sm:block">{t(current.sectionLabelKey)}</li>
        <li aria-hidden className="hidden items-center sm:flex">
          <ChevronRight className="h-3.5 w-3.5 opacity-50" />
        </li>
        <li aria-current="page" className="font-semibold text-foreground">
          {t(current.itemLabelKey)}
        </li>
      </ol>

      {next && (
        <Link
          href={next.href}
          className="hover:border-brand/40 inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-brand"
        >
          <span className="text-muted-foreground/70">{t('breadcrumb.next')}:</span>
          {t(next.labelKey)}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </nav>
  )
}
