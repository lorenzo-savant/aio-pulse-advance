// PATH: src/app/dashboard/recommendations/page.tsx
'use client'

import { useState, useEffect } from 'react'
import {
  Lightbulb,
  RefreshCw,
  Target,
  Zap,
  TrendingUp,
  ArrowUpRight,
  Filter,
  AlertCircle,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/index'
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

// ─── Constants ───────────────────────────────────────────────────────────────

const PRIORITY_STYLES = {
  high: 'bg-red-500/15 text-red-400 border-red-500/20',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  low: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
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
  chatgpt: 'bg-emerald-500/15 text-emerald-400',
  gemini: 'bg-orange-500/15 text-orange-400',
  perplexity: 'bg-blue-500/15 text-blue-400',
  claude: 'bg-purple-500/15 text-purple-400',
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function RecommendationsPage() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null)
  const [data, setData] = useState<RecommendationsData | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')

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
    async function loadSaved() {
      try {
        const res = await fetch(`/api/recommendations?brand_id=${selectedBrand!.id}&limit=1`)
        const d = await res.json()
        if (d.success && d.data?.length > 0) {
          const latest = d.data[0]
          setData({
            recommendations: latest.recommendations || [],
            summary: latest.summary || '',
          })
          setSavedAt(latest.created_at)
        }
      } catch {
        // Silently fail — user can generate fresh
      }
    }
    loadSaved()
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Lightbulb className="h-8 w-8 text-amber-400" />
            <h1 className="text-3xl font-black tracking-tight text-foreground">
              Recommendations
            </h1>
          </div>
          <p className="mt-1 text-muted-foreground">
            AI-powered content recommendations based on your monitoring data.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {brands.length > 1 && (
            <select
              className="rounded-lg border border-input bg-secondary px-3 py-2 text-sm text-foreground"
              value={selectedBrand?.id || ''}
              onChange={(e) => {
                const b = brands.find((b) => b.id === e.target.value)
                if (b) {
                  setSelectedBrand(b)
                  setData(null)
                  setSavedAt(null)
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
          <Button loading={loading} onClick={generate} disabled={!selectedBrand}>
            <RefreshCw className="h-4 w-4" />
            {loading ? 'Generating...' : data ? 'Regenerate' : 'Generate'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {savedAt && data && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Last generated: {new Date(savedAt).toLocaleString('sv-SE')}</span>
          <span className="text-foreground">·</span>
          <span>Data loaded from history</span>
        </div>
      )}

      {data?.summary && (
        <Card className="border-brand-500/20 bg-primary/5 p-5">
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
                  ? 'bg-brand-600 text-white'
                  : 'bg-secondaryrow text-muted-foreground hover:text-foreground',
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
                    ? 'bg-brand-600 text-white'
                    : 'bg-secondaryrow text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setFilterPriority(p)}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="h-4 w-px bg-input-border" />
          <div className="flex flex-wrap gap-1">
            <button
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                filterCategory === 'all'
                  ? 'bg-brand-600 text-white'
                  : 'bg-secondaryrow text-muted-foreground hover:text-foreground',
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
                    ? 'bg-brand-600 text-white'
                    : 'bg-secondaryrow text-muted-foreground hover:text-foreground',
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filtered.map((rec, i) => {
            const ImpactIcon = IMPACT_ICONS[rec.impact] || TrendingUp
            return (
              <Card key={i} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      <Badge variant="default" size="sm" className={PRIORITY_STYLES[rec.priority]}>
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
                        ? 'bg-amber-500/15'
                        : rec.impact === 'medium'
                          ? 'bg-blue-500/15'
                          : 'bg-secondaryrow',
                    )}
                  >
                    <ImpactIcon
                      className={cn(
                        'h-5 w-5',
                        rec.impact === 'high'
                          ? 'text-amber-400'
                          : rec.impact === 'medium'
                            ? 'text-blue-400'
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
                        ENGINE_COLORS[e] || 'bg-secondaryrow text-muted-foreground',
                      )}
                    >
                      {e}
                    </span>
                  ))}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {!data && !loading && (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <Lightbulb className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-bold text-muted-foreground">No recommendations yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a brand and click Generate to get AI-powered content recommendations based on
            your monitoring data.
          </p>
        </Card>
      )}
    </div>
  )
}
