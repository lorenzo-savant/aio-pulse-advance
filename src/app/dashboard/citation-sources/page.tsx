// PATH: src/app/dashboard/citation-sources/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Link2, RefreshCw, AlertCircle, ExternalLink, Globe } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHelp } from '@/components/help/SectionHelp'
import { Badge } from '@/components/ui/index'
import { cn } from '@/lib/utils'
import { useChartTheme } from '@/hooks/useChartTheme'
import { CitationFreshnessPanel } from '@/components/CitationFreshnessPanel'
import { EngineFormatAffinityPanel } from '@/components/EngineFormatAffinityPanel'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Brand {
  id: string
  name: string
  color: string
}

type CitationType = 'informational' | 'product' | 'multimedia'
type CitationDepth = 'root' | 'hub' | 'leaf'

interface TypeBreakdown {
  informational: number
  product: number
  multimedia: number
}

interface DepthBreakdown {
  root: number
  hub: number
  leaf: number
}

type TrustCategory =
  | 'institutional'
  | 'wiki'
  | 'official_press'
  | 'community'
  | 'social'
  | 'aggregator'
  | 'commercial'
  | 'unknown'

interface DomainRow {
  domain: string
  count: number
  share: number
  owned: boolean
  engines: string[]
  sampleUrls: string[]
  dominantType: CitationType
  typeBreakdown: TypeBreakdown
  depthBreakdown: DepthBreakdown
  deepPageRate: number
  trustScore: number
  trustCategory: TrustCategory
  trustReasoning: string[]
  avgSentiment: number | null
  lastSeen: string
}

interface SidebarBreakdown {
  ugc: number
  authority: number
  owned: number
  other: number
}

interface SidebarDominance {
  totalCitations: number
  totalResponses: number
  citations: SidebarBreakdown
  citationShare: SidebarBreakdown
  responseCoverage: SidebarBreakdown
  responseCoverageShare: SidebarBreakdown
  sidebarScore: number
}

interface Summary {
  totalResponses: number
  responsesWithSources: number
  sourcedRate: number
  totalCitations: number
  uniqueDomains: number
  ownedCitations: number
  externalCitations: number
  ownedShare: number
  ownedDomain: string | null
  citationTypeBreakdown: TypeBreakdown
  citationDepthBreakdown: DepthBreakdown
  deepPageRate: number
  sidebarDominance?: SidebarDominance
}

interface OwnedPageRow {
  url: string
  count: number
  share: number
  engines: string[]
  lastSeen: string
}

interface SourcesData {
  summary: Summary
  domains: DomainRow[]
  ownedPages: OwnedPageRow[]
  engineBreakdown: { engine: string; count: number }[]
  timeline: { date: string; count: number }[]
}

const ENGINE_COLORS: Record<string, string> = {
  chatgpt: '#10b981',
  gemini: '#3b82f6',
  perplexity: '#a855f7',
  claude: '#f97316',
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  suffix,
  subtitle,
  accent = 'brand',
}: {
  title: string
  value: string | number
  suffix?: string
  subtitle?: string
  accent?: 'brand' | 'emerald' | 'red' | 'amber'
}) {
  const accentMap = {
    brand: 'text-primary',
    emerald: 'text-emerald-400',
    red: 'text-red-400',
    amber: 'text-amber-400',
  }
  return (
    <Card className="p-5">
      <p className="mb-2 text-sm font-medium text-muted-foreground">{title}</p>
      <div className="flex items-baseline gap-1">
        <p className={cn('text-3xl font-black', accentMap[accent])}>{value}</p>
        {suffix && <span className="text-lg font-bold text-muted-foreground">{suffix}</span>}
      </div>
      {subtitle && <p className="mt-2 text-xs text-muted-foreground">{subtitle}</p>}
    </Card>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CitationSourcesPage() {
  const { tooltipStyle } = useChartTheme()
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null)
  const [engine, setEngine] = useState('all')
  const [days, setDays] = useState('30')
  const [data, setData] = useState<SourcesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/brands')
        const json = await res.json()
        const list = json.data || json || []
        setBrands(list)
        if (list.length > 0) setSelectedBrand(list[0])
        else setLoading(false)
      } catch {
        setError('Failed to load brands')
        setLoading(false)
      }
    }
    load()
  }, [])

  const fetchSources = useCallback(async () => {
    if (!selectedBrand) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/citation-sources?brand_id=${selectedBrand.id}&engine=${engine}&days=${days}`,
      )
      const json = await res.json()
      if (!res.ok || !json.success) {
        setError(json.message || `API error: ${res.status}`)
        setData(null)
        return
      }
      setData(json.data)
    } catch {
      setError('Failed to load citation sources')
    } finally {
      setLoading(false)
    }
  }, [selectedBrand, engine, days])

  useEffect(() => {
    fetchSources()
  }, [fetchSources])

  const summary = data?.summary
  const hasData = !!summary && summary.totalCitations > 0

  const timelineData = (data?.timeline || []).map((t) => ({
    date: new Date(t.date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }),
    count: t.count,
  }))

  const maxDomainCount = data?.domains[0]?.count || 1

  return (
    <div className="animate-in space-y-8">
      <SectionHelp section="citation-sources" />
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Citation Sources</h1>
          <p className="mt-1 text-muted-foreground">
            Which domains AI engines cite when answering prompts about your brand.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {brands.length > 1 && (
            <select
              className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              value={selectedBrand?.id || ''}
              onChange={(e) => {
                const b = brands.find((x) => x.id === e.target.value)
                if (b) setSelectedBrand(b)
              }}
            >
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
          <select
            className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            value={engine}
            onChange={(e) => setEngine(e.target.value)}
          >
            <option value="all">All Engines</option>
            <option value="chatgpt">ChatGPT</option>
            <option value="gemini">Gemini</option>
            <option value="perplexity">Perplexity</option>
            <option value="claude">Claude</option>
          </select>
          <select
            className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            value={days}
            onChange={(e) => setDays(e.target.value)}
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="180">Last 180 days</option>
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-900/50 bg-red-900/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {/* No data */}
      {!loading && !hasData && !error && (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <Link2 className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-bold text-foreground">No citation sources yet</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Run the monitoring cron so AI responses are captured. Sources are extracted from the
            URLs each engine cites in its answers.
          </p>
        </Card>
      )}

      {/* Content */}
      {!loading && hasData && summary && data && (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard
              title="Total Citations"
              value={summary.totalCitations}
              subtitle={`Across ${summary.totalResponses} AI responses`}
              accent="brand"
            />
            <StatCard
              title="Unique Domains"
              value={summary.uniqueDomains}
              subtitle="Distinct sources cited"
              accent="brand"
            />
            <StatCard
              title="Your Domain Share"
              value={summary.ownedShare.toFixed(1)}
              suffix="%"
              subtitle={
                summary.ownedDomain
                  ? `${summary.ownedCitations} cites to ${summary.ownedDomain}`
                  : 'No brand domain set'
              }
              accent={
                summary.ownedShare > 20 ? 'emerald' : summary.ownedShare > 5 ? 'amber' : 'red'
              }
            />
            <StatCard
              title="Sourced Responses"
              value={summary.sourcedRate.toFixed(1)}
              suffix="%"
              subtitle={`${summary.responsesWithSources} of ${summary.totalResponses} cited a source`}
              accent={summary.sourcedRate > 50 ? 'emerald' : 'amber'}
            />
          </div>

          {/* Owned vs external */}
          <Card className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <Globe className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-bold text-foreground">Your Domain vs External</h2>
            </div>
            <div className="flex h-4 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-primary transition-all duration-700"
                style={{ width: `${summary.ownedShare}%` }}
              />
              <div
                className="h-full bg-amber-500/70 transition-all duration-700"
                style={{ width: `${100 - summary.ownedShare}%` }}
              />
            </div>
            <div className="mt-3 flex justify-between text-sm">
              <span className="text-primary">
                <span className="font-bold">{summary.ownedCitations}</span> your domain
              </span>
              <span className="text-amber-400">
                <span className="font-bold">{summary.externalCitations}</span> external
              </span>
            </div>
          </Card>

          {/* Citation type mix — informational / product / multimedia */}
          {(() => {
            const t = summary.citationTypeBreakdown
            const total = t.informational + t.product + t.multimedia
            if (total === 0) return null
            const pct = (n: number) => (n / total) * 100
            return (
              <Card className="p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-lg font-bold text-foreground">Citation Type Mix</h2>
                </div>
                <p className="mb-3 text-xs text-muted-foreground">
                  How the AI engines cite your space: informational links (articles, docs, wiki),
                  product links (shopping pages), or multimedia (image/video/audio sources).
                </p>
                <div className="flex h-4 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full bg-sky-500/80 transition-all duration-700"
                    style={{ width: `${pct(t.informational)}%` }}
                    title={`${t.informational} informational`}
                  />
                  <div
                    className="h-full bg-violet-500/80 transition-all duration-700"
                    style={{ width: `${pct(t.product)}%` }}
                    title={`${t.product} product`}
                  />
                  <div
                    className="h-full bg-amber-500/80 transition-all duration-700"
                    style={{ width: `${pct(t.multimedia)}%` }}
                    title={`${t.multimedia} multimedia`}
                  />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-sky-400">
                      <span className="font-bold">{t.informational}</span> informational
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {pct(t.informational).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-violet-400">
                      <span className="font-bold">{t.product}</span> product
                    </p>
                    <p className="text-xs text-muted-foreground">{pct(t.product).toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-amber-400">
                      <span className="font-bold">{t.multimedia}</span> multimedia
                    </p>
                    <p className="text-xs text-muted-foreground">{pct(t.multimedia).toFixed(1)}%</p>
                  </div>
                </div>
              </Card>
            )
          })()}

          {/* Citation depth — root / hub / leaf + deep-page rate */}
          {(() => {
            const d = summary.citationDepthBreakdown
            const total = d.root + d.hub + d.leaf
            if (total === 0) return null
            const pct = (n: number) => (n / total) * 100
            const rate = summary.deepPageRate
            const rateAccent =
              rate >= 70 ? 'text-emerald-400' : rate >= 40 ? 'text-amber-400' : 'text-rose-400'
            return (
              <Card className="p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-5 w-5 text-muted-foreground" />
                    <h2 className="text-lg font-bold text-foreground">Citation Depth</h2>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Deep-page rate
                    </p>
                    <p className={cn('text-2xl font-black leading-none', rateAccent)}>
                      {rate.toFixed(1)}%
                    </p>
                  </div>
                </div>
                <p className="mb-3 text-xs text-muted-foreground">
                  Where on a domain the AI engines pull citations from: the <b>homepage</b> (root),
                  a <b>section landing</b> (hub like /blog, /docs, /pricing), or a <b>deep page</b>{' '}
                  (leaf — a specific article, doc, or product). AI engines favour deep subpages even
                  when ranking the homepage, so a high deep-page rate means your content is earning
                  the citation.
                </p>
                <div className="flex h-4 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full bg-rose-500/80 transition-all duration-700"
                    style={{ width: `${pct(d.root)}%` }}
                    title={`${d.root} homepage`}
                  />
                  <div
                    className="h-full bg-amber-500/80 transition-all duration-700"
                    style={{ width: `${pct(d.hub)}%` }}
                    title={`${d.hub} hub`}
                  />
                  <div
                    className="h-full bg-emerald-500/80 transition-all duration-700"
                    style={{ width: `${pct(d.leaf)}%` }}
                    title={`${d.leaf} deep page`}
                  />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-rose-400">
                      <span className="font-bold">{d.root}</span> homepage
                    </p>
                    <p className="text-xs text-muted-foreground">{pct(d.root).toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-amber-400">
                      <span className="font-bold">{d.hub}</span> hub
                    </p>
                    <p className="text-xs text-muted-foreground">{pct(d.hub).toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-emerald-400">
                      <span className="font-bold">{d.leaf}</span> deep page
                    </p>
                    <p className="text-xs text-muted-foreground">{pct(d.leaf).toFixed(1)}%</p>
                  </div>
                </div>
              </Card>
            )
          })()}

          {/* Sidebar dominance — UGC vs Authority vs Owned mix + score */}
          {summary.sidebarDominance &&
            summary.sidebarDominance.totalCitations > 0 &&
            (() => {
              const sd = summary.sidebarDominance
              const pct = (n: number) => (sd.totalCitations > 0 ? (n / sd.totalCitations) * 100 : 0)
              const scoreAccent =
                sd.sidebarScore >= 50
                  ? 'text-emerald-400'
                  : sd.sidebarScore >= 20
                    ? 'text-amber-400'
                    : 'text-rose-400'
              return (
                <Card className="p-6">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Link2 className="h-5 w-5 text-muted-foreground" />
                      <h2 className="text-lg font-bold text-foreground">Sidebar Dominance</h2>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Sidebar score
                      </p>
                      <p className={cn('text-2xl font-black leading-none', scoreAccent)}>
                        {sd.sidebarScore.toFixed(1)}%
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        of {sd.totalResponses} responses cite you
                      </p>
                    </div>
                  </div>
                  <p className="mb-3 text-xs text-muted-foreground">
                    AI engines lean heavily on a few <strong>UGC</strong> (Reddit/Quora/YouTube) and{' '}
                    <strong>authority</strong> (Wikipedia, major media, .edu/.gov) sources per the
                    Semrush AI Mode study. This view shows how citations split between UGC,
                    authoritative sources, your own pages, and other sites.
                  </p>
                  <div className="flex h-4 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full bg-emerald-500/80 transition-all duration-700"
                      style={{ width: `${pct(sd.citations.owned)}%` }}
                      title={`${sd.citations.owned} owned`}
                    />
                    <div
                      className="h-full bg-sky-500/80 transition-all duration-700"
                      style={{ width: `${pct(sd.citations.authority)}%` }}
                      title={`${sd.citations.authority} authority`}
                    />
                    <div
                      className="h-full bg-violet-500/80 transition-all duration-700"
                      style={{ width: `${pct(sd.citations.ugc)}%` }}
                      title={`${sd.citations.ugc} UGC`}
                    />
                    <div
                      className="bg-muted-foreground/40 h-full transition-all duration-700"
                      style={{ width: `${pct(sd.citations.other)}%` }}
                      title={`${sd.citations.other} other`}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <div>
                      <p className="text-emerald-400">
                        <span className="font-bold">{sd.citations.owned}</span> owned
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {sd.citationShare.owned.toFixed(1)}% citations · in{' '}
                        {sd.responseCoverageShare.owned.toFixed(1)}% of responses
                      </p>
                    </div>
                    <div>
                      <p className="text-sky-400">
                        <span className="font-bold">{sd.citations.authority}</span> authority
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {sd.citationShare.authority.toFixed(1)}% citations
                      </p>
                    </div>
                    <div>
                      <p className="text-violet-400">
                        <span className="font-bold">{sd.citations.ugc}</span> UGC
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Reddit/Quora/YouTube · {sd.citationShare.ugc.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">
                        <span className="font-bold">{sd.citations.other}</span> other
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {sd.citationShare.other.toFixed(1)}% citations
                      </p>
                    </div>
                  </div>
                </Card>
              )
            })()}

          {/* Citation freshness — correlation between age and citation count */}
          <CitationFreshnessPanel brandId={selectedBrand?.id ?? undefined} />

          {/* Engine × content-format affinity — which engine prefers which kind */}
          <EngineFormatAffinityPanel brandId={selectedBrand?.id ?? undefined} />

          {/* Top domains */}
          <Card className="p-6">
            <h2 className="mb-6 text-lg font-bold text-foreground">Top Cited Domains</h2>
            <div className="space-y-3">
              {data.domains.map((d) => (
                <div
                  key={d.domain}
                  className="bg-secondary/30 flex flex-col gap-2 rounded-lg border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-foreground">{d.domain}</span>
                      {d.owned && (
                        <Badge variant="success" className="shrink-0">
                          Your domain
                        </Badge>
                      )}
                      <span
                        className={cn(
                          'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                          d.dominantType === 'product'
                            ? 'bg-violet-500/15 text-violet-300'
                            : d.dominantType === 'multimedia'
                              ? 'bg-amber-500/15 text-amber-300'
                              : 'bg-sky-500/15 text-sky-300',
                        )}
                        title={`${d.typeBreakdown.informational} info · ${d.typeBreakdown.product} product · ${d.typeBreakdown.multimedia} multimedia`}
                      >
                        {d.dominantType}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                          d.trustScore >= 60
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : d.trustScore >= 30
                              ? 'bg-amber-500/15 text-amber-300'
                              : 'bg-rose-500/15 text-rose-300',
                        )}
                        title={`AI Trust ${d.trustScore}/100 — ${d.trustReasoning.join(' · ')}`}
                      >
                        Trust {d.trustScore}
                      </span>
                      {d.sampleUrls[0] && (
                        <a
                          href={d.sampleUrls[0]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
                          title={d.sampleUrls[0]}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-700',
                          d.owned ? 'bg-primary' : 'bg-amber-500/70',
                        )}
                        style={{ width: `${(d.count / maxDomainCount) * 100}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {d.engines.map((e) => (
                        <span
                          key={e}
                          className="rounded px-1.5 py-0.5 text-[10px] font-medium capitalize text-white"
                          style={{ backgroundColor: ENGINE_COLORS[e] || '#6b7280' }}
                        >
                          {e}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-foreground">{d.count}</p>
                    <p className="text-xs text-muted-foreground">{d.share.toFixed(1)}% of cites</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Your Cited Pages — page-level breakdown of citations to YOUR domain */}
          {data.ownedPages.length > 0 && (
            <Card className="p-6">
              <h2 className="mb-1 text-lg font-bold text-foreground">Your Cited Pages</h2>
              <p className="mb-5 text-xs text-muted-foreground">
                Which specific pages on {data.summary.ownedDomain ?? 'your domain'} the AI engines
                actually cited. Use this to see which content earns citations and double down on it.
              </p>
              <div className="space-y-2">
                {data.ownedPages.map((p) => {
                  const maxOwnedCount = data.ownedPages[0]?.count || 1
                  return (
                    <div
                      key={p.url}
                      className="bg-secondary/30 flex flex-col gap-2 rounded-lg border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-w-0 truncate text-sm font-medium text-foreground hover:text-primary"
                            title={p.url}
                          >
                            {p.url}
                          </a>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        </div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-700"
                            style={{ width: `${(p.count / maxOwnedCount) * 100}%` }}
                          />
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {p.engines.map((e) => (
                            <span
                              key={e}
                              className="rounded px-1.5 py-0.5 text-[10px] font-medium capitalize text-white"
                              style={{ backgroundColor: ENGINE_COLORS[e] || '#6b7280' }}
                            >
                              {e}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black text-foreground">{p.count}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.share.toFixed(1)}% of yours
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Timeline */}
            <Card className="p-6">
              <h2 className="mb-6 text-lg font-bold text-foreground">Citations Over Time</h2>
              {timelineData.length > 1 ? (
                <ResponsiveContainer height={240} width="100%">
                  <LineChart data={timelineData}>
                    <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <Tooltip {...tooltipStyle} />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      dot={false}
                      name="Citations"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Not enough data points to show a trend yet.
                </p>
              )}
            </Card>

            {/* Engine breakdown */}
            <Card className="p-6">
              <h2 className="mb-6 text-lg font-bold text-foreground">Citations by Engine</h2>
              {data.engineBreakdown.length > 0 ? (
                <div className="space-y-5">
                  {data.engineBreakdown.map((e) => {
                    const pct =
                      summary.totalCitations > 0 ? (e.count / summary.totalCitations) * 100 : 0
                    return (
                      <div key={e.engine}>
                        <div className="mb-1.5 flex justify-between text-sm font-medium">
                          <span className="capitalize text-muted-foreground">{e.engine}</span>
                          <span className="font-bold text-foreground">{e.count}</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${Math.min(pct, 100)}%`,
                              backgroundColor: ENGINE_COLORS[e.engine] || '#6b7280',
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  No per-engine data available.
                </p>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
