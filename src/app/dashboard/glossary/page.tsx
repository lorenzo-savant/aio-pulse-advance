'use client'

import { useEffect, useState } from 'react'
import { Search, BookOpen } from 'lucide-react'

interface GlossaryTerm {
  term: string
  slug: string
  definition: string
  category: string
}

export default function GlossaryPage() {
  const [terms, setTerms] = useState<GlossaryTerm[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetch('/api/glossary')
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setTerms(res.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = query.trim()
    ? terms.filter(
        (t) =>
          t.term.toLowerCase().includes(query.toLowerCase()) ||
          t.definition.toLowerCase().includes(query.toLowerCase()),
      )
    : terms

  const categories = [...new Set(terms.map((t) => t.category))]

  return (
    <div className="animate-in">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-3xl font-black tracking-tight text-foreground">Glossary</h1>
        </div>
        <p className="mt-1 text-muted-foreground">
          Standard AI SEO / LLM Visibility terminology sourced from the{' '}
          <a
            href="https://github.com/mattbertramlive/ai-seo-llm-visibility-glossary"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Bertram glossary
          </a>
          . These terms are used by the AI when generating analysis and recommendations.
        </p>
      </div>

      <div className="relative mb-8 max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          className="focus:border-primary/50 w-full rounded-xl border border-border bg-secondary py-2.5 pl-10 pr-4 text-sm text-foreground placeholder-muted-foreground outline-none"
          placeholder="Search terms..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-3 py-12">
          <div className="border-primary/30 h-5 w-5 animate-spin rounded-full border-2 border-t-primary" />
          <p className="text-sm text-muted-foreground">Loading glossary...</p>
        </div>
      ) : (
        categories.map((cat) => {
          const catTerms = filtered.filter((t) => t.category === cat)
          if (catTerms.length === 0) return null
          return (
            <div key={cat} className="mb-10">
              <h2 className="mb-4 text-sm font-black uppercase tracking-widest text-muted-foreground">
                {cat}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {catTerms.map((t) => (
                  <div
                    key={t.slug}
                    className="hover:border-primary/30 rounded-xl border border-border bg-secondary p-5 transition-colors"
                  >
                    <h3 className="mb-2 font-bold text-foreground">{t.term}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{t.definition}</p>
                  </div>
                ))}
              </div>
            </div>
          )
        })
      )}

      {!loading && filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">No terms found.</p>
      )}

      <p className="border-border/60 border-t pt-6 text-xs text-muted-foreground">
        Dataset by{' '}
        <a
          href="https://www.matthewbertram.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Matthew Bertram
        </a>{' '}
        /{' '}
        <a
          href="https://www.ewrdigital.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          EWR Digital
        </a>{' '}
        &mdash;{' '}
        <a
          href="https://creativecommons.org/licenses/by/4.0/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          CC BY 4.0
        </a>
      </p>
    </div>
  )
}
