'use client'

// "Topic Finder" panel — surfaces ranked content opportunities by
// clustering the brand's CitationCapture gap list. Each cluster is a
// topic where the AI mentioned the brand but cited competitors / other
// authorities; the cluster's priority score (prompts × engine diversity
// × competitor diversity) tells the operator which topic to attack
// first. See lib/services/topic-finder.ts for the clustering logic.

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Compass, Loader2, AlertTriangle, TrendingUp, Layers, Target } from 'lucide-react'
import { cn } from '@/lib/utils'

type Format = 'paragraph' | 'faq' | 'comparison' | 'how-to' | 'table' | 'list'

interface TopicCluster {
  topic: string
  examples: string[]
  promptCount: number
  engineCount: number
  competitorCount: number
  topCompetitors: string[]
  suggestedFormat: Format
  priorityScore: number
}

interface TopicData {
  totalGapPrompts: number
  clusters: TopicCluster[]
  rejectedPhrases: string[]
  brand: { id: string; name: string }
  filters: { days: number; minClusterSize: number }
}

const FORMAT_LABELS: Record<Format, string> = {
  paragraph: 'Paragraph snippet',
  faq: 'FAQ block',
  comparison: 'Comparison table',
  'how-to': 'How-to guide',
  table: 'Pricing / data table',
  list: 'Ranked list',
}

const FORMAT_HINTS: Record<Format, string> = {
  paragraph: '40-60 word direct answer + H2 question; AI engines pull this verbatim.',
  faq: '3+ Q/A pairs with FAQPage JSON-LD schema; max AI-citation lift.',
  comparison: 'Side-by-side feature/price table; AI engines cite tables heavily.',
  'how-to': 'Numbered list ≥8 steps with HowTo schema; truncation lifts click-through.',
  table: 'Structured rows ≥5; clear column headers; numbered values.',
  list: 'Bulleted list ≥8 items; H2 + intro paragraph; ordered by relevance.',
}

function priorityClass(score: number): string {
  if (score >= 75) return 'text-rose-400'
  if (score >= 40) return 'text-amber-300'
  return 'text-muted-foreground'
}

export function TopicFinderPanel({ brandId }: { brandId: string }) {
  const [data, setData] = useState<TopicData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    if (!brandId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/brands/${brandId}/topic-finder?days=60`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (j.success) setData(j.data as TopicData)
        else setError(j.message || 'Failed to load topics')
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [brandId])

  if (loading && !data) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
        Clustering gap-list prompts into topics…
      </Card>
    )
  }
  if (error) return <Card className="p-6 text-sm text-rose-400">{error}</Card>
  if (!data) return null

  if (data.totalGapPrompts === 0) {
    return (
      <Card className="p-6">
        <div className="mb-2 flex items-center gap-2">
          <Compass className="h-4 w-4 text-brand" />
          <h2 className="text-lg font-bold text-foreground">Topic Finder</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          No citation-capture gaps in the last {data.filters.days} days — every brand mention either
          cited your site or was filtered as homonym noise. Topic Finder needs gap data to suggest
          topics.
        </p>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-brand" />
          <h2 className="text-lg font-bold text-foreground">Topic Finder</h2>
        </div>
        <span className="text-xs text-muted-foreground">
          {data.clusters.length} cluster{data.clusters.length === 1 ? '' : 's'} from{' '}
          {data.totalGapPrompts} gap prompt{data.totalGapPrompts === 1 ? '' : 's'}
        </span>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        Content priority queue derived from the citation-capture gap list. Each cluster is a topic
        where AI engines mentioned <b>{data.brand.name}</b> but cited other sources. Write the
        suggested format for the top-priority topic and the AI's authority anchor flips toward your
        site.
      </p>

      {data.clusters.length === 0 ? (
        <div className="bg-input/30 rounded-lg border border-input px-4 py-6 text-center text-sm text-muted-foreground">
          {data.totalGapPrompts} gap prompts but none clustered (min cluster size{' '}
          {data.filters.minClusterSize}). Lower the threshold or wait for more monitoring coverage.
        </div>
      ) : (
        <div className="space-y-2">
          {data.clusters.map((c) => {
            const isOpen = expanded === c.topic
            return (
              <button
                key={c.topic}
                onClick={() => setExpanded(isOpen ? null : c.topic)}
                className="bg-input/30 hover:bg-input/50 w-full rounded-lg border border-input px-3 py-2.5 text-left transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span
                      className={cn(
                        'shrink-0 text-lg font-black tabular-nums',
                        priorityClass(c.priorityScore),
                      )}
                      title="Priority = prompts × engines × competitors, normalised 0-100"
                    >
                      {c.priorityScore}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">{c.topic}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {c.promptCount} prompt{c.promptCount === 1 ? '' : 's'} · {c.engineCount}{' '}
                        engine{c.engineCount === 1 ? '' : 's'} · {c.competitorCount} competitor host
                        {c.competitorCount === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>
                  <span className="bg-brand/15 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand">
                    {FORMAT_LABELS[c.suggestedFormat]}
                  </span>
                </div>
                {isOpen && (
                  <div className="mt-3 space-y-2 border-t border-border pt-2">
                    <div className="bg-brand/5 rounded px-2 py-1.5 text-[11px] text-brand">
                      <Target className="mr-1 inline h-3 w-3" />
                      <b>Suggested format:</b> {FORMAT_HINTS[c.suggestedFormat]}
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        <Layers className="mr-1 inline h-3 w-3" />
                        Example prompts in this cluster
                      </p>
                      <ul className="space-y-0.5">
                        {c.examples.map((ex, i) => (
                          <li key={i} className="text-[11px] text-muted-foreground" title={ex}>
                            · &ldquo;{ex.length > 100 ? `${ex.slice(0, 100)}…` : ex}&rdquo;
                          </li>
                        ))}
                      </ul>
                    </div>
                    {c.topCompetitors.length > 0 && (
                      <div>
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          <TrendingUp className="mr-1 inline h-3 w-3" />
                          Hosts stealing this slot
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {c.topCompetitors.map((h) => (
                            <code
                              key={h}
                              className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-foreground"
                            >
                              {h}
                            </code>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

      {data.rejectedPhrases.length > 0 && (
        <details className="mt-4 text-[11px] text-muted-foreground">
          <summary className="cursor-pointer">
            Why some phrases were rejected ({data.rejectedPhrases.length})
          </summary>
          <ul className="mt-1 space-y-0.5 pl-3">
            {data.rejectedPhrases.map((p, i) => (
              <li key={i}>· {p}</li>
            ))}
          </ul>
        </details>
      )}

      {data.clusters.length === 0 && data.rejectedPhrases.length === 0 && (
        <div className="bg-input/30 mt-3 flex items-start gap-2 rounded-lg border border-input px-3 py-2 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Need more gap data — run monitoring on more prompts so clusters emerge.</span>
        </div>
      )}
    </Card>
  )
}
