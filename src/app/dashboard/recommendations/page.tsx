// PATH: src/app/dashboard/recommendations/page.tsx
'use client'

import { useState, useEffect } from 'react'
import {
  Lightbulb,
  RefreshCw,
  Zap,
  TrendingUp,
  ArrowUpRight,
  Filter,
  AlertCircle,
  Calendar,
  FileText,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHelp } from '@/components/help/SectionHelp'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/index'
import { PageTransition, StaggerGrid, StaggerItem } from '@/components/ui/Motion'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Recommendation {
  title: string
  priority: 'high' | 'medium' | 'low'
  impact: 'high' | 'medium' | 'low'
  engines: string[]
  description: string
  category: string
}

interface RecommendationsData {
  recommendations: Recommendation[]
  summary: string
}

interface Brand {
  id: string
  name: string
}

interface WeeklyReview {
  id: string
  brand_id: string
  week_number: number
  year: number
  week_start: string
  week_end: string
  metrics: {
    aviScoreCurrent: number
    aviDelta: number
    totalMonitoringRuns: number
    newHallucinations: number
    mentionRate: number
    citationRate: number
    avgSentiment: number
  }
  markdown?: string
  summary?: string
  created_at: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PRIORITY_STYLES = {
  high: 'bg-error-muted text-error border-error-muted',
  medium: 'bg-warning-muted text-warning border-warning-muted',
  low: 'bg-success-muted text-success border-success-muted',
}

const IMPACT_ICONS = {
  high: Zap,
  medium: TrendingUp,
  low: ArrowUpRight,
}

const CATEGORY_LABELS: Record<string, string> = {
  content_creation: 'Content Creation',
  content_optimization: 'Content Optimization',
  technical_seo: 'Technical SEO',
  authority_building: 'Authority Building',
  competitive_strategy: 'Competitive Strategy',
}

const ENGINE_COLORS: Record<string, string> = {
  chatgpt: 'bg-success-muted text-success',
  gemini: 'bg-warning-muted text-warning',
  perplexity: 'bg-brand-muted text-brand',
  claude: 'bg-purple-500/15 text-purple-400',
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function RecommendationsPage() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null)
  const [data, setData] = useState<RecommendationsData | null>(null)
  const [weeklyReviews, setWeeklyReviews] = useState<WeeklyReview[]>([])
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<'recommendations' | 'weekly'>('recommendations')

  useEffect(() => {
    async function loadBrands() {
      try {
        const res = await fetch('/api/brands')
        const d = await res.json()
        const list = d.data || d || []
        setBrands(list)
        if (list.length > 0) setSelectedBrand(list[0])
      } catch {
        setError('Failed to load brands')
      }
    }
    loadBrands()
  }, [])

  useEffect(() => {
    if (!selectedBrand) return

    async function loadData() {
      try {
        // Load saved recommendations
        const recRes = await fetch(`/api/recommendations?brand_id=${selectedBrand!.id}&limit=1`)
        const recData = await recRes.json()
        if (recData.success && recData.data?.length > 0) {
          const latest = recData.data[0]
          setData({
            recommendations: latest.recommendations || [],
            summary: latest.summary || '',
          })
          setSavedAt(latest.created_at)
        } else {
          setData(null)
          setSavedAt(null)
        }

        // Load weekly reviews
        const wrRes = await fetch(`/api/reviews/weekly?brandId=${selectedBrand!.id}&limit=12`)
        const wrData = await wrRes.json()
        setWeeklyReviews(wrData.reviews || [])
      } catch {
        // Silent fail
      }
    }
    loadData()
  }, [selectedBrand])

  const generate = async () => {
    if (!selectedBrand) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: selectedBrand.id }),
      })
      const d = await res.json()
      if (!d.success) throw new Error(d.message)
      setData(d.data)
      setSavedAt(new Date().toISOString())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate recommendations')
    } finally {
      setLoading(false)
    }
  }

  const filtered =
    data?.recommendations.filter((r) => {
      if (filterCategory !== 'all' && r.category !== filterCategory) return false
      if (filterPriority !== 'all' && r.priority !== filterPriority) return false
      return true
    }) || []

  const categories = data ? Array.from(new Set(data.recommendations.map((r) => r.category))) : []

  return (
    <PageTransition>
      <div className="space-y-6">
        <SectionHelp section="recommendations" />
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Pages / Recommendations</p>
            <h1 className="mt-1 text-[34px] font-bold tracking-tight text-foreground">
              Recommendations
            </h1>
            <p className="mt-1 text-muted-foreground">
              AI-powered insights and weekly review digests.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {brands.length > 1 && (
              <select
                className="rounded-xl border border-border bg-input px-3 py-2 text-sm text-foreground"
                value={selectedBrand?.id || ''}
                onChange={(e) => {
                  const b = brands.find((b) => b.id === e.target.value)
                  if (b) {
                    setSelectedBrand(b)
                    setData(null)
                    setSavedAt(null)
                    setWeeklyReviews([])
                  }
                }}
              >
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
            {activeTab === 'recommendations' && (
              <Button loading={loading} onClick={generate} disabled={!selectedBrand}>
                <RefreshCw className="h-4 w-4" />
                {loading ? 'Generating...' : data ? 'Regenerate' : 'Generate'}
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl bg-secondary p-1">
          <button
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all',
              activeTab === 'recommendations'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setActiveTab('recommendations')}
          >
            <Lightbulb className="h-4 w-4" />
            Recommendations
          </button>
          <button
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all',
              activeTab === 'weekly'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setActiveTab('weekly')}
          >
            <Calendar className="h-4 w-4" />
            Weekly Reviews
            {weeklyReviews.length > 0 && (
              <Badge variant="default" size="sm">
                {weeklyReviews.length}
              </Badge>
            )}
          </button>
        </div>

        {error && (
          <div className="bg-error-muted/30 flex items-start gap-3 rounded-xl border border-error-muted px-4 py-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
            <p className="text-sm text-error">{error}</p>
          </div>
        )}

        {/* ─── Recommendations Tab ─── */}
        {activeTab === 'recommendations' && (
          <>
            {savedAt && data && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Last generated: {new Date(savedAt).toLocaleString('sv-SE')}</span>
              </div>
            )}

            {data?.summary && (
              <Card className="border-brand/20 bg-brand-muted/30 p-5">
                <p className="text-sm leading-relaxed text-muted-foreground">{data.summary}</p>
              </Card>
            )}

            {data && (
              <div className="flex flex-wrap items-center gap-3">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <div className="flex gap-1">
                  <button
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                      filterPriority === 'all'
                        ? 'bg-brand text-white'
                        : 'bg-secondary text-muted-foreground hover:text-foreground',
                    )}
                    onClick={() => setFilterPriority('all')}
                  >
                    All
                  </button>
                  {['high', 'medium', 'low'].map((p) => (
                    <button
                      key={p}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all',
                        filterPriority === p
                          ? 'bg-brand text-white'
                          : 'bg-secondary text-muted-foreground hover:text-foreground',
                      )}
                      onClick={() => setFilterPriority(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <div className="h-4 w-px bg-border" />
                <div className="flex flex-wrap gap-1">
                  <button
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                      filterCategory === 'all'
                        ? 'bg-brand text-white'
                        : 'bg-secondary text-muted-foreground hover:text-foreground',
                    )}
                    onClick={() => setFilterCategory('all')}
                  >
                    All Categories
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                        filterCategory === c
                          ? 'bg-brand text-white'
                          : 'bg-secondary text-muted-foreground hover:text-foreground',
                      )}
                      onClick={() => setFilterCategory(c)}
                    >
                      {CATEGORY_LABELS[c] || c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {filtered.length > 0 && (
              <StaggerGrid className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {filtered.map((rec, i) => {
                  const ImpactIcon = IMPACT_ICONS[rec.impact] || TrendingUp
                  return (
                    <StaggerItem key={i}>
                      <Card className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="mb-2 flex flex-wrap gap-1.5">
                              <Badge
                                variant="default"
                                size="sm"
                                className={PRIORITY_STYLES[rec.priority]}
                              >
                                {rec.priority} priority
                              </Badge>
                              <Badge variant="default" size="sm">
                                {CATEGORY_LABELS[rec.category] || rec.category}
                              </Badge>
                            </div>
                            <h3 className="text-sm font-bold text-foreground">{rec.title}</h3>
                            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                              {rec.description}
                            </p>
                          </div>
                          <div
                            className={cn(
                              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                              rec.impact === 'high'
                                ? 'bg-warning-muted'
                                : rec.impact === 'medium'
                                  ? 'bg-brand-muted'
                                  : 'bg-secondary',
                            )}
                          >
                            <ImpactIcon
                              className={cn(
                                'h-5 w-5',
                                rec.impact === 'high'
                                  ? 'text-warning'
                                  : rec.impact === 'medium'
                                    ? 'text-brand'
                                    : 'text-muted-foreground',
                              )}
                            />
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1">
                          {rec.engines.map((e) => (
                            <span
                              key={e}
                              className={cn(
                                'rounded-md px-2 py-0.5 text-[9px] font-bold uppercase',
                                ENGINE_COLORS[e] || 'bg-secondary text-muted-foreground',
                              )}
                            >
                              {e}
                            </span>
                          ))}
                        </div>
                      </Card>
                    </StaggerItem>
                  )
                })}
              </StaggerGrid>
            )}

            {!data && !loading && (
              <Card className="flex flex-col items-center justify-center p-12 text-center">
                <Lightbulb className="mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="text-lg font-bold text-muted-foreground">No recommendations yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Select a brand and click Generate to get AI-powered content recommendations.
                </p>
              </Card>
            )}
          </>
        )}

        {/* ─── Weekly Reviews Tab ─── */}
        {activeTab === 'weekly' && (
          <>
            {weeklyReviews.length === 0 ? (
              <Card className="flex flex-col items-center justify-center p-12 text-center">
                <Calendar className="mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="text-lg font-bold text-muted-foreground">No weekly reviews yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Weekly reviews are generated automatically every Monday. Check back soon.
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {weeklyReviews.map((review) => {
                  const m = review.metrics || ({} as any)
                  const aviDelta = m.aviDelta ?? 0
                  const summary = review.summary || (review as any).summary || ''
                  const weekLabel = `W${review.week_number || '?'} ${review.year || ''}`
                  const period =
                    review.week_start && review.week_end
                      ? `${review.week_start} — ${review.week_end}`
                      : new Date(review.created_at).toLocaleDateString('sv-SE')

                  return (
                    <Card key={review.id} className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="mb-2 flex items-center gap-2">
                            <FileText className="h-4 w-4 text-brand" />
                            <span className="text-sm font-bold text-foreground">{weekLabel}</span>
                            <span className="text-xs text-muted-foreground">{period}</span>
                          </div>
                          {summary && (
                            <p className="mb-3 text-xs text-muted-foreground">{summary}</p>
                          )}
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                AVI Score
                              </p>
                              <p className="text-lg font-bold text-foreground">
                                {(m.aviScoreCurrent ?? 0).toFixed(1)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                AVI Delta
                              </p>
                              <p
                                className={cn(
                                  'text-lg font-bold',
                                  aviDelta > 0
                                    ? 'text-success'
                                    : aviDelta < 0
                                      ? 'text-error'
                                      : 'text-foreground',
                                )}
                              >
                                {aviDelta > 0 ? '+' : ''}
                                {aviDelta.toFixed(1)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                Scans
                              </p>
                              <p className="text-lg font-bold text-foreground">
                                {m.totalMonitoringRuns ?? 0}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                Hallucinations
                              </p>
                              <p
                                className={cn(
                                  'text-lg font-bold',
                                  (m.newHallucinations ?? 0) > 0 ? 'text-error' : 'text-foreground',
                                )}
                              >
                                {m.newHallucinations ?? 0}
                              </p>
                            </div>
                          </div>
                        </div>
                        <Badge variant={aviDelta >= 0 ? 'success' : 'danger'} className="shrink-0">
                          {aviDelta >= 0 ? 'Improving' : 'Declining'}
                        </Badge>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </PageTransition>
  )
}
