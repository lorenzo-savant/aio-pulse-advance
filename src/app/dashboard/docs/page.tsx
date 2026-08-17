// PATH: src/app/dashboard/docs/page.tsx
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, ChevronRight, ArrowUp } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { cn } from '@/lib/utils'
import { getDocContent } from '@/content/docs'
import { isStepBlock, matchStepLine } from '@/content/docs/render'
import { DOC_ICONS } from '@/components/docs/docIcons'

// Same content as the public /docs page, resolved through the shared locale
// module: this page owns the in-dashboard chrome only. The 850-line copy of
// the documentation that used to live here is gone — two copies drifted.
export default function DocsPage() {
  const locale = useLocale()
  const DOCS = getDocContent(locale)
  const t = useTranslations('docs_ui')
  const [activeSection, setActiveSection] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})
  const mainRef = useRef<HTMLDivElement>(null)

  // Track active section via IntersectionObserver
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
  }, [searchQuery, locale])

  // Show "back to top" after scrolling
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 600)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Load from URL hash on mount
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

  // Filter sections by search
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

  // Render content with basic formatting
  const renderContent = (content: string) => {
    return content.split('\n\n').map((paragraph, i) => {
      // Bullet points
      if (paragraph.trim().startsWith('•')) {
        const items = paragraph.split('\n').filter((line) => line.trim().startsWith('•'))
        return (
          <ul key={i} className="mb-4 ml-1 space-y-2">
            {items.map((item, j) => (
              <li
                key={j}
                className="flex gap-2.5 text-[15px] leading-relaxed text-muted-foreground"
              >
                <span className="bg-primary/60 mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" />
                <span>{item.replace(/^•\s*/, '')}</span>
              </li>
            ))}
          </ul>
        )
      }

      // Steps — the step word is localised, so match it per locale.
      if (isStepBlock(paragraph)) {
        const lines = paragraph.split('\n').filter(Boolean)
        return (
          <div key={i} className="mb-4 space-y-3">
            {lines.map((line, j) => {
              const step = matchStepLine(line)
              if (step) {
                return (
                  <div key={j} className="flex gap-3">
                    <span className="bg-primary/15 text-brand-400 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold">
                      {step.number}
                    </span>
                    <p className="text-[15px] leading-relaxed text-muted-foreground">
                      {step.title}
                    </p>
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

      // Key-value definitions (lines with " — ")
      if (paragraph.includes(' — ') && !paragraph.startsWith('•')) {
        const lines = paragraph.split('\n').filter(Boolean)
        const isDefinitionBlock = lines.filter((l) => l.includes(' — ')).length >= 2

        if (isDefinitionBlock) {
          return (
            <div key={i} className="mb-5 space-y-3">
              {lines.map((line, j) => {
                const dashIndex = line.indexOf(' — ')
                if (dashIndex > -1) {
                  const term = line.slice(0, dashIndex).trim()
                  const def = line.slice(dashIndex + 3).trim()
                  return (
                    <div key={j}>
                      <span className="text-brand-700 bg-secondary/80 text-brand-300 rounded bg-secondary px-1.5 py-0.5 text-sm font-semibold">
                        {term}
                      </span>
                      <span className="ml-2 text-[15px] leading-relaxed text-muted-foreground">
                        {def}
                      </span>
                    </div>
                  )
                }
                return (
                  <p
                    key={j}
                    className="text-[15px] leading-relaxed text-foreground text-muted-foreground"
                  >
                    {line}
                  </p>
                )
              })}
            </div>
          )
        }
      }

      // Regular paragraph
      return (
        <p
          key={i}
          className="mb-4 text-[15px] leading-relaxed text-foreground text-muted-foreground"
        >
          {paragraph}
        </p>
      )
    })
  }

  return (
    <div className="animate-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tight text-foreground">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Search */}
      <div className="relative mb-8">
        <Search className="absolute left-4 top-3 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          className="focus:border-primary/50 w-full rounded-xl border border-border bg-secondary py-3 pl-11 pr-10 text-sm text-foreground placeholder-muted-foreground outline-none transition-colors"
          placeholder={t('search_placeholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-3 rounded p-0.5 text-muted-foreground hover:text-muted-foreground"
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

      {/* Mobile nav toggle */}
      <button
        onClick={() => setMobileNavOpen(!mobileNavOpen)}
        className="mb-4 flex w-full items-center justify-between rounded-xl border border-border bg-secondary px-4 py-3 text-sm font-medium text-foreground text-muted-foreground lg:hidden"
      >
        <span>{t('jump_to_section')}</span>
        <ChevronRight
          className={cn('h-4 w-4 transition-transform', mobileNavOpen && 'rotate-90')}
        />
      </button>

      {/* Mobile nav dropdown */}
      {mobileNavOpen && (
        <div className="mb-6 rounded-xl border border-border bg-secondary p-4 lg:hidden">
          {filteredDocs.map((group) => (
            <div key={group.id} className="mb-3">
              <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {group.group}
              </p>
              {group.sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => scrollToSection(section.id)}
                  className="block w-full py-1.5 text-left text-sm text-muted-foreground hover:text-primary"
                >
                  {section.title}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Main layout */}
      <div className="flex gap-10">
        {/* Sidebar — desktop only */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <nav className="sticky top-24">
            <div className="max-h-[calc(100vh-8rem)] space-y-5 overflow-y-auto pb-20 pr-2">
              {filteredDocs.map((group) => {
                const GroupIcon = DOC_ICONS[group.icon]
                return (
                  <div key={group.id}>
                    <div className="mb-2 flex items-center gap-2">
                      <GroupIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        {group.group}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      {group.sections.map((section) => (
                        <button
                          key={section.id}
                          onClick={() => scrollToSection(section.id)}
                          className={cn(
                            'block w-full rounded-lg px-3 py-1.5 text-left text-[13px] transition-colors',
                            activeSection === section.id
                              ? 'bg-primary/10 text-brand-400 font-semibold'
                              : 'text-muted-foreground hover:text-muted-foreground',
                          )}
                        >
                          {section.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
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
                className="mb-14 scroll-mt-24"
              >
                {/* Breadcrumb */}
                <p className="mb-2 text-xs text-muted-foreground">
                  {group.group}
                  <ChevronRight className="mx-1 inline h-3 w-3" />
                  {section.title}
                </p>

                {/* Title */}
                <h2 className="mb-5 text-xl font-bold text-foreground">{section.title}</h2>

                {/* Content */}
                <div>{renderContent(section.content)}</div>

                {/* Divider */}
                <div className="border-border/60 border-border/60 mt-14 border-t" />
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
                  className="text-brand-400 text-primary hover:underline"
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
          className="hover:border-primary/30 hover:bg-primary/10 fixed bottom-6 right-6 z-50 rounded-full border border-border bg-secondary p-3 shadow-xl transition-all"
        >
          <ArrowUp className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
    </div>
  )
}
