// PATH: src/app/docs/page.tsx
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Search, X, ChevronRight, ArrowUp, ArrowLeft, Menu } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { cn } from '@/lib/utils'
import { Reveal } from '@/components/Reveal'
import { Ornament } from '@/components/Ornament'
import { SiteHeader } from '@/components/SiteHeader'
import { getDocContent } from '@/content/docs'
import { isStepBlock, matchStepLine } from '@/content/docs/render'
import { DOC_ICONS } from '@/components/docs/docIcons'

// Content lives in src/content/docs/{en,it,sv}.ts and is resolved per locale,
// so this page owns the reading experience and owns none of the words.
export default function DocsPage() {
  const locale = useLocale()
  const DOCS = getDocContent(locale)
  const t = useTranslations('docs_ui')
  const tHeader = useTranslations('site_header')
  const [activeSection, setActiveSection] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})
  const mainRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        }
      },
      { rootMargin: '-10% 0px -85% 0px' },
    )

    const refs = sectionRefs.current
    Object.values(refs).forEach((el) => {
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
    // Re-observe when the rendered section set changes: filtering by search
    // swaps which sections exist, and switching locale replaces all of them.
  }, [searchQuery, locale])

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 600)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash && sectionRefs.current[hash]) {
      setTimeout(() => {
        sectionRefs.current[hash]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 300)
    }
  }, [])

  const scrollToSection = useCallback((id: string) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.history.replaceState(null, '', `#${id}`)
    setMobileNavOpen(false)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const filteredDocs = searchQuery.trim()
    ? DOCS.map((group) => ({
        ...group,
        sections: group.sections.filter(
          (s) =>
            s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.content.toLowerCase().includes(searchQuery.toLowerCase()),
        ),
      })).filter((g) => g.sections.length > 0)
    : DOCS

  const totalSections = filteredDocs.reduce((acc, g) => acc + g.sections.length, 0)

  const renderContent = (content: string) => {
    return content.split('\n\n').map((paragraph, i) => {
      if (paragraph.trim().startsWith('•')) {
        const items = paragraph.split('\n').filter((line) => line.trim().startsWith('•'))
        return (
          <ul key={i} className="mb-4 ml-1 space-y-2.5">
            {items.map((item, j) => {
              const raw = item.replace(/^•\s*/, '')
              const dashIdx = raw.indexOf(' — ')
              const term = dashIdx > -1 ? raw.slice(0, dashIdx) : null
              const def = dashIdx > -1 ? raw.slice(dashIdx + 3) : raw
              return (
                <li
                  key={j}
                  className="flex gap-3 text-[15px] leading-relaxed text-muted-foreground"
                >
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span>
                    {term && <strong className="font-semibold text-foreground">{term} — </strong>}
                    {def}
                  </span>
                </li>
              )
            })}
          </ul>
        )
      }

      // Step blocks: "<step-word> N — Title\nBody text..." in any locale.
      if (isStepBlock(paragraph)) {
        const lines = paragraph.split('\n')
        const bodyLines = lines.slice(1).join('\n').trim()
        const step = matchStepLine(lines[0] ?? '')
        if (step) {
          return (
            <div key={i} className="mb-5 flex gap-4">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-sm font-black text-accent-foreground shadow-md">
                {step.number}
              </span>
              <div className="flex-1">
                <h4 className="mb-1.5 text-base font-bold text-foreground">{step.title}</h4>
                {bodyLines && (
                  <p className="text-[15px] leading-relaxed text-muted-foreground">{bodyLines}</p>
                )}
              </div>
            </div>
          )
        }
      }

      // Definition blocks: 2+ lines containing "Term — Definition"
      if (paragraph.includes(' — ') && !paragraph.startsWith('•')) {
        const lines = paragraph.split('\n').filter(Boolean)
        const isDefinitionBlock = lines.filter((l) => l.includes(' — ')).length >= 2

        if (isDefinitionBlock) {
          return (
            <div key={i} className="mb-5 space-y-2.5">
              {lines.map((line, j) => {
                const dashIndex = line.indexOf(' — ')
                if (dashIndex > -1) {
                  const term = line.slice(0, dashIndex).trim()
                  const def = line.slice(dashIndex + 3).trim()
                  return (
                    <div key={j} className="text-[15px] leading-relaxed">
                      <span className="font-bold text-foreground">{term}</span>
                      <span className="mx-2 text-accent">—</span>
                      <span className="text-muted-foreground">{def}</span>
                    </div>
                  )
                }
                return (
                  <p key={j} className="text-[15px] leading-relaxed text-muted-foreground">
                    {line}
                  </p>
                )
              })}
            </div>
          )
        }
      }

      return (
        <p key={i} className="mb-4 text-[15px] leading-relaxed text-muted-foreground">
          {paragraph}
        </p>
      )
    })
  }

  return (
    <div className="relative min-h-screen overflow-x-clip bg-background transition-colors">
      <div className="pointer-events-none absolute -right-32 top-24 z-0 h-[280px] w-[280px] opacity-20">
        <Ornament variant="orbit" />
      </div>
      <SiteHeader
        navItems={[
          { label: tHeader('nav.features'), href: '/#features' },
          { label: tHeader('nav.capabilities'), href: '/#capabilities' },
          { label: tHeader('nav.industries'), href: '/#industries' },
          { label: tHeader('nav.docs'), href: '/docs', active: true },
          { label: tHeader('nav.dashboard'), href: '/dashboard' },
        ]}
        rightSlot={
          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="p-2 text-muted-foreground transition-colors hover:text-foreground lg:hidden"
            aria-label="Toggle mobile menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        }
      />

      {/* Mobile Navigation */}
      {mobileNavOpen && (
        <div className="border-b border-nav-border bg-nav-bg px-4 py-4 lg:hidden">
          <nav className="flex flex-col gap-4">
            <Link
              onClick={() => setMobileNavOpen(false)}
              className="text-muted-foreground"
              href="/#features"
            >
              {tHeader('nav.features')}
            </Link>
            <Link onClick={() => setMobileNavOpen(false)} className="text-accent" href="/docs">
              {tHeader('nav.docs')}
            </Link>
            <Link
              onClick={() => setMobileNavOpen(false)}
              className="text-muted-foreground"
              href="/dashboard"
            >
              {tHeader('nav.dashboard')}
            </Link>
            <Link
              onClick={() => setMobileNavOpen(false)}
              className="text-muted-foreground"
              href="/auth/login"
            >
              {tHeader('sign_in')}
            </Link>
            <Link
              onClick={() => setMobileNavOpen(false)}
              className="font-medium text-accent"
              href="/dashboard"
            >
              {tHeader('get_started')}
            </Link>
          </nav>
        </div>
      )}

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        {/* Back Link & Title */}
        <Reveal direction="up" className="mb-8">
          <Link
            href="/"
            className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-accent"
          >
            <ArrowLeft className="h-3 w-3" />
            {t('back_home')}
          </Link>
          <h1 className="text-3xl font-black tracking-tight text-foreground">{t('title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
        </Reveal>

        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-3 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            className="focus:ring-accent/20 w-full rounded-xl border border-input bg-input py-3 pl-11 pr-10 text-sm text-foreground placeholder-muted-foreground outline-none transition-colors focus:border-accent focus:ring-2"
            placeholder={t('search_placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-3 rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {searchQuery && (
            <p className="mt-2 text-xs text-muted-foreground">
              {totalSections === 1
                ? t('result_singular', { count: totalSections })
                : t('result_plural', { count: totalSections })}
            </p>
          )}
        </div>

        {/* Main layout with sidebar */}
        <div className="flex gap-10">
          {/* Sidebar - Desktop */}
          <aside className="hidden w-64 shrink-0 lg:block">
            <nav className="sticky top-24 max-h-[calc(100vh-8rem)] space-y-6 overflow-y-auto pb-20 pr-4">
              {filteredDocs.map((group) => {
                const GroupIcon = DOC_ICONS[group.icon]
                return (
                  <div key={group.id}>
                    <div className="mb-2 flex items-center gap-2">
                      <GroupIcon className="h-4 w-4 text-muted-foreground" />
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        {group.group}
                      </p>
                    </div>
                    <div className="space-y-1">
                      {group.sections.map((section) => (
                        <button
                          key={section.id}
                          onClick={() => scrollToSection(section.id)}
                          className={cn(
                            'block w-full rounded-lg px-3 py-2 text-left text-sm transition-all',
                            activeSection === section.id
                              ? 'bg-accent font-medium text-accent-foreground'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                          )}
                        >
                          {section.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </nav>
          </aside>

          {/* Content */}
          <main ref={mainRef} className="min-w-0 flex-1 pb-32">
            {filteredDocs.map((group) =>
              group.sections.map((section) => (
                <section
                  key={section.id}
                  id={section.id}
                  ref={(el) => {
                    sectionRefs.current[section.id] = el
                  }}
                  className="mb-16 scroll-mt-24"
                >
                  {/* Breadcrumb */}
                  <p className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <span>{group.group}</span>
                    <ChevronRight className="h-3 w-3" />
                    <span className="text-muted-foreground">{section.title}</span>
                  </p>

                  {/* Title */}
                  <h2 className="mb-6 text-2xl font-bold text-foreground">{section.title}</h2>

                  {/* Content */}
                  <div className="prose prose-slate dark:prose-invert max-w-none">
                    {renderContent(section.content)}
                  </div>

                  {/* Divider */}
                  <div className="mt-16 border-t border-input" />
                </section>
              )),
            )}

            {/* No results */}
            {totalSections === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Search className="mb-4 h-10 w-10 text-muted-foreground" />
                <p className="text-lg font-bold text-foreground">{t('no_results_title')}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('no_results_hint')}{' '}
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-accent hover:underline"
                  >
                    {t('clear_search')}
                  </button>
                  .
                </p>
              </div>
            )}
          </main>
        </div>

        {/* Back to top */}
        {showBackToTop && (
          <button
            onClick={scrollToTop}
            aria-label={t('back_to_top')}
            className="hover:border-accent/30 hover:bg-accent/10 fixed bottom-6 right-6 z-50 rounded-full border border-input bg-input p-3 shadow-lg transition-all"
          >
            <ArrowUp className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-nav-border bg-background py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} AEO Pulse. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
