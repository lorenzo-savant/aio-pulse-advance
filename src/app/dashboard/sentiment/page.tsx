'use client'

import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, Smile, Frown, Meh, Brain, Loader2, Zap } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Brand } from '@/types'

interface SentimentStats {
  sentimentCounts: { positive: number; negative: number; neutral: number }
  avgSentimentScore: number
  hallucinationCount: number
  hallucinationRate: number
  byEngine: Record<string, { avg: number; count: number }>
  totalResults: number
  mentionedResults: number
}

interface SentimentAnalysis {
  sentiment: 'positive' | 'negative' | 'neutral'
  score: number
  confidence: number
  reasoning: string
  aspects: Array<{ aspect: string; sentiment: string; explanation: string }>
}

const SENTIMENT_CONFIG = {
  positive: {
    icon: Smile,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    bar: '#10b981',
  },
  negative: {
    icon: Frown,
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    bar: '#f43f5e',
  },
  neutral: {
    icon: Meh,
    color: 'text-muted-foreground',
    bg: 'bg-input',
    border: 'border-input',
    bar: '#6b7280',
  },
}

const ENGINE_COLORS: Record<string, string> = {
  chatgpt: '#10b981',
  gemini: '#3b82f6',
  perplexity: '#a855f7',
  claude: '#f97316',
}

const TICK_COLOR = 'rgb(var(--color-text-muted-on-surface))'
const GRID_COLOR = 'rgb(var(--color-nav-border))'
const TRACK_COLOR = 'rgb(var(--color-ring-track))'
const GAUGE_LABEL_COLOR = 'rgb(var(--color-text-muted-on-surface))'

const TOOLTIP_STYLE = () => ({
  contentStyle: {
    background: 'rgb(var(--color-page-bg-elevated))',
    border: '1px solid rgb(var(--color-nav-border))',
    borderRadius: 8,
    fontSize: 12,
    color: 'rgb(var(--color-text-on-surface))',
  },
  labelStyle: { color: 'rgb(var(--color-text-on-surface))', fontWeight: 700 },
})

function SentimentGauge({ score }: { score: number }) {
  const deg = ((score + 1) / 2) * 180
  const color = score > 0.2 ? '#10b981' : score < -0.2 ? '#f43f5e' : '#6b7280'

  return (
    <div className="relative flex flex-col items-center">
      <svg viewBox="0 0 200 110" className="w-48">
        <path
          d="M 10 100 A 90 90 0 0 1 190 100"
          fill="none"
          stroke={TRACK_COLOR}
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M 10 100 A 90 90 0 0 1 190 100"
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${(deg / 180) * 283} 283`}
          style={{ transition: 'all 1s ease' }}
        />
        <line
          x1="100"
          y1="100"
          x2={100 + 70 * Math.cos(((deg - 180) * Math.PI) / 180)}
          y2={100 + 70 * Math.sin(((deg - 180) * Math.PI) / 180)}
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          style={{ transition: 'all 1s ease' }}
        />
        <circle cx="100" cy="100" r="5" fill={color} />
        <text x="6" y="115" fontSize="10" fill={GAUGE_LABEL_COLOR}>
          Neg
        </text>
        <text x="89" y="18" fontSize="10" fill={GAUGE_LABEL_COLOR}>
          Neu
        </text>
        <text x="175" y="115" fontSize="10" fill={GAUGE_LABEL_COLOR}>
          Pos
        </text>
      </svg>
      <div className="mt-1 text-center">
        <p className="text-3xl font-black" style={{ color }}>
          {score > 0 ? '+' : ''}
          {score.toFixed(2)}
        </p>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Sentiment Score
        </p>
      </div>
    </div>
  )
}

function ManualAnalyzer({ brands }: { brands: Brand[] }) {
  const [text, setText] = useState('')
  const [brandId, setBrandId] = useState('')
  const [mode, setMode] = useState<'both' | 'sentiment' | 'hallucination'>('both')
  const [result, setResult] = useState<{
    sentiment?: SentimentAnalysis
    hallucination?: {
      has_hallucination: boolean
      confidence: number
      flags: Array<{ text: string; severity: string; type: string }>
      summary: string
    }
  } | null>(null)
  const [loading, setLoading] = useState(false)

  const analyze = async () => {
    if (!text.trim() || !brandId) {
      toast.error('Enter text and select a brand')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/sentiment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, brand_id: brandId, mode }),
      })
      const json = (await res.json()) as {
        success: boolean
        data?: typeof result
        message?: string
      }
      if (!json.success) throw new Error(json.message)
      setResult(json.data ?? null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-input bg-card p-6">
      <div className="mb-5 flex items-center gap-3">
        <Brain className="h-5 w-5 text-brand" />
        <h2 className="text-lg font-bold text-foreground">Manual Analyzer</h2>
        <span className="text-xs text-muted-foreground">Paste any AI response to analyze</span>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Brand
            </label>
            <select
              className="w-full rounded-xl border border-input bg-input px-4 py-2.5 text-sm text-foreground outline-none focus:border-brand"
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
            >
              <option value="">Select brand...</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Analysis Mode
            </label>
            <div className="flex gap-2">
              {(['both', 'sentiment', 'hallucination'] as const).map((m) => (
                <button
                  key={m}
                  className={cn(
                    'flex-1 rounded-xl border py-2.5 text-xs font-bold transition-all',
                    mode === m
                      ? 'border-brand-500/50 bg-primary/15 text-brand'
                      : 'border-input bg-input text-muted-foreground hover:border-input',
                  )}
                  onClick={() => setMode(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        <textarea
          className="placeholder-text-muted-surface w-full resize-none rounded-xl border border-input bg-input px-4 py-3 text-sm text-foreground outline-none focus:border-brand"
          placeholder="Paste an AI-generated response here to analyze sentiment and detect hallucinations..."
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <Button className="w-full" loading={loading} onClick={analyze}>
          <Zap className="h-4 w-4" />
          {loading ? 'Analyzing...' : 'Analyze Text'}
        </Button>
      </div>

      {result && (
        <div className="animate-in mt-6 space-y-4 border-t border-border pt-5">
          {result.sentiment && (
            <div>
              <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Sentiment Result
              </p>
              <div
                className={cn(
                  'rounded-xl border p-4',
                  SENTIMENT_CONFIG[result.sentiment.sentiment].border,
                  SENTIMENT_CONFIG[result.sentiment.sentiment].bg,
                )}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span
                    className={cn(
                      'text-lg font-black capitalize',
                      SENTIMENT_CONFIG[result.sentiment.sentiment].color,
                    )}
                  >
                    {result.sentiment.sentiment}
                  </span>
                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground">
                      Score: {result.sentiment.score > 0 ? '+' : ''}
                      {result.sentiment.score.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Confidence: {result.sentiment.confidence}%
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{result.sentiment.reasoning}</p>
                {result.sentiment.aspects.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {result.sentiment.aspects.map((a, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <span
                          className={cn(
                            'font-bold',
                            SENTIMENT_CONFIG[a.sentiment as keyof typeof SENTIMENT_CONFIG]?.color ??
                              'text-muted-foreground',
                          )}
                        >
                          {a.aspect}:
                        </span>
                        <span className="text-muted-foreground">{a.explanation}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {result.hallucination && (
            <div>
              <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Hallucination Check
              </p>
              <div
                className={cn(
                  'rounded-xl border p-4',
                  result.hallucination.has_hallucination
                    ? 'border-red-500/20 bg-red-500/5'
                    : 'border-emerald-500/20 bg-emerald-500/5',
                )}
              >
                <div className="mb-2 flex items-center gap-2">
                  {result.hallucination.has_hallucination ? (
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                  ) : (
                    <span className="text-emerald-500">✓</span>
                  )}
                  <span
                    className={cn(
                      'font-bold',
                      result.hallucination.has_hallucination ? 'text-red-400' : 'text-emerald-500',
                    )}
                  >
                    {result.hallucination.has_hallucination
                      ? `${result.hallucination.flags.length} issue(s) detected`
                      : 'No hallucinations detected'}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    Confidence: {result.hallucination.confidence}%
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{result.hallucination.summary}</p>
                {result.hallucination.flags.map((flag, i) => (
                  <div
                    key={i}
                    className="mt-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs"
                  >
                    <p className="font-bold text-red-400">"{flag.text}"</p>
                    <p className="mt-0.5 text-muted-foreground">
                      {flag.type} · {flag.severity} severity
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

export default function SentimentPage() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrand, setSelectedBrand] = useState('')
  const [stats, setStats] = useState<SentimentStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)

  useEffect(() => {
    fetch('/api/brands')
      .then((r) => r.json() as Promise<{ data?: Brand[] }>)
      .then((j) => {
        setBrands(j.data ?? [])
        if (j.data?.[0]) setSelectedBrand(j.data[0].id)
      })
      .catch(() => {})
  }, [])

  const loadStats = useCallback(async (brandId: string) => {
    if (!brandId) return
    setLoadingStats(true)
    try {
      const res = await fetch(`/api/sentiment?brand_id=${brandId}`)
      const json = (await res.json()) as { success: boolean; data?: SentimentStats }
      if (json.success) setStats(json.data ?? null)
    } catch {
      /* ignore */
    } finally {
      setLoadingStats(false)
    }
  }, [])

  useEffect(() => {
    if (selectedBrand) void loadStats(selectedBrand)
  }, [selectedBrand, loadStats])

  const engineData = stats
    ? Object.entries(stats.byEngine).map(([engine, d]) => ({
        engine,
        score: parseFloat(d.avg.toFixed(2)),
        count: d.count,
        color: ENGINE_COLORS[engine] ?? '#6366f1',
      }))
    : []

  return (
    <div className="animate-in space-y-8">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">
            Sentiment & Hallucinations
          </h1>
          <p className="mt-1 text-muted-foreground">
            How AI systems feel about your brand — and what they get wrong.
          </p>
        </div>
        {brands.length > 0 && (
          <select
            className="rounded-xl border border-input bg-input px-4 py-2.5 text-sm text-foreground outline-none focus:border-brand"
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
          >
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {loadingStats ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="flex flex-col items-center justify-center border-input bg-card p-8">
              <SentimentGauge score={stats.avgSentimentScore} />
              <div className="mt-6 flex gap-4 text-center">
                <div>
                  <p className="text-lg font-black text-emerald-500">
                    {stats.sentimentCounts.positive}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Positive</p>
                </div>
                <div>
                  <p className="text-lg font-black text-muted-foreground">
                    {stats.sentimentCounts.neutral}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Neutral</p>
                </div>
                <div>
                  <p className="text-lg font-black text-red-500">
                    {stats.sentimentCounts.negative}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Negative</p>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-4 lg:col-span-2">
              {[
                {
                  label: 'Total Analyzed',
                  value: stats.totalResults,
                  icon: Brain,
                  color: 'text-brand',
                },
                {
                  label: 'With Brand Mention',
                  value: stats.mentionedResults,
                  icon: Smile,
                  color: 'text-emerald-500',
                },
                {
                  label: 'Hallucinations',
                  value: stats.hallucinationCount,
                  icon: AlertTriangle,
                  color: 'text-red-500',
                },
                {
                  label: 'Hallucination Rate',
                  value: `${(stats.hallucinationRate * 100).toFixed(1)}%`,
                  icon: AlertTriangle,
                  color: stats.hallucinationRate > 0.1 ? 'text-red-500' : 'text-emerald-500',
                },
              ].map((s) => (
                <Card key={s.label} className="border-input bg-card p-5">
                  <s.icon className={cn('mb-2 h-5 w-5', s.color)} />
                  <p className="text-2xl font-black text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </Card>
              ))}
            </div>
          </div>

          {engineData.length > 0 && (
            <Card className="border-border bg-secondary p-6">
              <h2 className="mb-6 text-lg font-bold text-foreground">
                Average Sentiment by Engine
              </h2>
              <ResponsiveContainer height={220} width="100%">
                <BarChart data={engineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                  <XAxis dataKey="engine" tick={{ fontSize: 11, fill: TICK_COLOR }} />
                  <YAxis domain={[-1, 1]} tick={{ fontSize: 11, fill: TICK_COLOR }} />
                  <Tooltip
                    {...TOOLTIP_STYLE()}
                    formatter={(v: number) => [v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2), 'Score']}
                  />
                  <Bar dataKey="score" name="Sentiment Score" radius={[4, 4, 0, 0]}>
                    {engineData.map((entry) => (
                      <Cell
                        key={entry.engine}
                        fill={entry.score > 0 ? '#10b981' : entry.score < 0 ? '#f43f5e' : '#6b7280'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {stats.totalResults === 0 && (
            <div className="rounded-2xl border border-input bg-secondary px-6 py-10 text-center">
              <p className="mb-2 text-lg font-bold text-foreground">No data yet</p>
              <p className="text-muted-foreground">
                Run monitoring checks from the Prompts page to populate sentiment data.
              </p>
            </div>
          )}
        </>
      ) : null}

      <ManualAnalyzer brands={brands} />
    </div>
  )
}
