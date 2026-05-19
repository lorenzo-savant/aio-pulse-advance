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
import { Badge } from '@/components/ui/index'
import { cn } from '@/lib/utils'
import { useChartTheme } from '@/hooks/useChartTheme'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Brand {
  id: string
  name: string
  color: string
}

interface DomainRow {
  domain: string
  count: number
  share: number
  owned: boolean
  engines: string[]
  sampleUrls: string[]
  lastSeen: string
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
}

interface SourcesData {
  summary: Summary
  domains: DomainRow[]
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
