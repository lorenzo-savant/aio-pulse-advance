'use client'

import { useState, useEffect } from 'react'
import {
  Search,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Tag,
  BarChart3,
  Loader2,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/index'
import { cn } from '@/lib/utils'

interface KeywordData {
  id: string
  brand_id: string
  keyword: string
  frequency: number
  mention_correlation: number
  engines: string[]
  first_seen: string | null
  last_seen: string | null
}

interface Brand {
  id: string
  name: string
  color: string
}

const ENGINE_COLORS: Record<string, string> = {
  chatgpt: '#10b981',
  gemini: '#3b82f6',
  perplexity: '#a855f7',
  claude: '#f97316',
}

export default function KeywordsPage() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null)
  const [keywords, setKeywords] = useState<KeywordData[]>([])
  const [correlatedKeywords, setCorrelatedKeywords] = useState<KeywordData[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [tab, setTab] = useState<'all' | 'correlated'>('all')
  const [error, setError] = useState<string | null>(null)

  // Fetch brands
  useEffect(() => {
    async function loadBrands() {
      try {
        const res = await fetch('/api/brands')
        const data = await res.json()
        const list = data.data || data || []
        setBrands(list)
        if (list.length > 0) setSelectedBrand(list[0])
      } catch {
        console.error('Failed to load brands')
      }
    }
    loadBrands()
  }, [])

  // Fetch keywords when brand changes
  const fetchKeywords = async () => {
    if (!selectedBrand) return
    setLoading(true)
    setError(null)
    try {
      const [allRes, correlatedRes] = await Promise.all([
        fetch(`/api/keywords?brand_id=${selectedBrand.id}&limit=100`),
        fetch(`/api/keywords?brand_id=${selectedBrand.id}&type=correlated&limit=20`),
      ])
      const allData = await allRes.json()
      const correlatedData = await correlatedRes.json()
      if (!allRes.ok) setError(allData.message || 'Failed to load keywords')
      setKeywords(allData.data || [])
      setCorrelatedKeywords(correlatedData.data || [])
    } catch (e) {
      console.error('Failed to load keywords', e)
      setError('Failed to load keywords')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchKeywords()
  }, [selectedBrand])

  // Refresh keywords
  const handleRefresh = async () => {
    if (!selectedBrand) return
    setRefreshing(true)
    try {
      await fetch('/api/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: selectedBrand.id, action: 'refresh' }),
      })
      await fetchKeywords()
    } catch {
      console.error('Failed to refresh keywords')
    } finally {
      setRefreshing(false)
    }
  }

  const filteredKeywords = (tab === 'correlated' ? correlatedKeywords : keywords).filter(
    (k) => !searchQuery || k.keyword.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const maxFrequency = Math.max(...keywords.map((k) => k.frequency), 1)

  const getCorrelationBadge = (correlation: number) => {
    if (correlation > 0.7) return { variant: 'success' as const, label: 'High' }
    if (correlation > 0.3) return { variant: 'warning' as const, label: 'Medium' }
    if (correlation > 0) return { variant: 'default' as const, label: 'Low' }
    return { variant: 'default' as const, label: 'None' }
  }

  return (
    <div className="animate-in space-y-8 bg-page-bg">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">Keyword Tracking</h1>
          <p className="mt-1 text-surface-400">
            Track keywords that correlate with brand mentions in AI responses.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {brands.length > 1 && (
            <select
              className="text-text-primary-ui rounded-lg border border-surface-input-border bg-surface-input px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
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
          <Button variant="primary" onClick={handleRefresh} disabled={refreshing || !selectedBrand}>
            <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', refreshing && 'animate-spin')} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="text-text-muted-ui absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <input
          className="text-text-primary-ui placeholder-text-muted-ui w-full rounded-xl border border-surface-input-border bg-surface-input py-2.5 pl-10 pr-4 text-sm outline-none focus:border-brand-500"
          placeholder="Search keywords..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-nav-border pb-0">
        {[
          { id: 'all', label: `All Keywords (${keywords.length})` },
          { id: 'correlated', label: `Correlated (${correlatedKeywords.length})` },
        ].map((t) => (
          <button
            key={t.id}
            className={cn(
              'border-b-2 px-4 pb-3 text-sm font-bold transition-colors',
              tab === t.id
                ? 'border-brand-600 text-brand-600'
                : 'text-text-muted-ui hover:text-text-secondary-ui border-transparent',
            )}
            onClick={() => setTab(t.id as typeof tab)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
        </div>
      )}

      {/* No data */}
      {!loading && filteredKeywords.length === 0 && (
        <Card className="flex flex-col items-center justify-center border border-surface-input-border bg-card p-12 text-center">
          <Tag className="text-text-muted-ui mb-4 h-12 w-12" />
          <h3 className="text-text-secondary-ui text-lg font-bold">No keywords tracked yet</h3>
          <p className="text-text-muted-ui mt-2 max-w-md text-sm">
            Run monitoring and click &quot;Refresh&quot; to extract keywords from AI responses.
          </p>
        </Card>
      )}

      {/* Keywords Grid */}
      {!loading && filteredKeywords.length > 0 && (
        <>
          {/* Keyword Cloud Preview */}
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-bold text-white">Keyword Cloud</h2>
            <div className="flex flex-wrap gap-2">
              {filteredKeywords.slice(0, 30).map((kw) => {
                const size = 0.75 + (kw.frequency / maxFrequency) * 0.75
                const corr = kw.mention_correlation
                return (
                  <span
                    key={kw.id}
                    className={cn(
                      'inline-block rounded-full px-3 py-1 transition-transform hover:scale-110',
                      corr > 0.5
                        ? 'bg-brand-500/20 text-brand-300'
                        : corr > 0
                          ? 'bg-blue-500/20 text-blue-300'
                          : 'bg-surface-800 text-surface-400',
                    )}
                    style={{ fontSize: `${size}rem` }}
                  >
                    {kw.keyword}
                  </span>
                )
              })}
            </div>
          </Card>

          {/* Keywords Table */}
          <Card className="p-6">
            <h2 className="mb-5 text-lg font-bold text-white">Keyword Details</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-800">
                    <th className="pb-3 text-left text-[10px] font-black uppercase tracking-widest text-surface-500">
                      Keyword
                    </th>
                    <th className="pb-3 text-center text-[10px] font-black uppercase tracking-widest text-surface-500">
                      Frequency
                    </th>
                    <th className="pb-3 text-center text-[10px] font-black uppercase tracking-widest text-surface-500">
                      Correlation
                    </th>
                    <th className="pb-3 text-center text-[10px] font-black uppercase tracking-widest text-surface-500">
                      Engines
                    </th>
                    <th className="pb-3 text-center text-[10px] font-black uppercase tracking-widest text-surface-500">
                      Last Seen
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredKeywords.slice(0, 50).map((kw) => {
                    const corrBadge = getCorrelationBadge(kw.mention_correlation)
                    return (
                      <tr key={kw.id} className="border-b border-surface-800/50">
                        <td className="py-3">
                          <span className="font-medium text-white">{kw.keyword}</span>
                        </td>
                        <td className="py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-800">
                              <div
                                className="h-full rounded-full bg-brand-500"
                                style={{ width: `${(kw.frequency / maxFrequency) * 100}%` }}
                              />
                            </div>
                            <span className="text-surface-300">{kw.frequency}</span>
                          </div>
                        </td>
                        <td className="py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {kw.mention_correlation > 0.1 && (
                              <TrendingUp className="h-4 w-4 text-emerald-400" />
                            )}
                            {kw.mention_correlation < -0.1 && (
                              <TrendingDown className="h-4 w-4 text-red-400" />
                            )}
                            {kw.mention_correlation >= -0.1 && kw.mention_correlation <= 0.1 && (
                              <Minus className="h-4 w-4 text-surface-500" />
                            )}
                            <Badge variant={corrBadge.variant}>{corrBadge.label}</Badge>
                            <span className="text-xs text-surface-500">
                              ({kw.mention_correlation.toFixed(2)})
                            </span>
                          </div>
                        </td>
                        <td className="py-3 text-center">
                          <div className="flex justify-center gap-1">
                            {kw.engines?.map((eng) => (
                              <span
                                key={eng}
                                className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold"
                                style={{
                                  backgroundColor: `${ENGINE_COLORS[eng] || '#6b7280'}20`,
                                  color: ENGINE_COLORS[eng] || '#6b7280',
                                }}
                              >
                                {eng}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 text-center text-surface-400">
                          {kw.last_seen
                            ? new Date(kw.last_seen).toLocaleDateString('sv-SE', {
                                month: 'short',
                                day: 'numeric',
                              })
                            : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
