'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  FileSearch,
  Link2,
  Sparkles,
  AlertCircle,
  Copy,
  Check,
  Download,
  ChevronDown,
  ChevronUp,
  Target,
  TrendingUp,
  Brain,
  Users,
  BookOpen,
  Mic,
  BarChart3,
  SearchCheck,
  Lightbulb,
} from 'lucide-react'
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/index'
import { useAppStore } from '@/lib/store'
import { useToggle, useClipboard, useKeywordAnalysis } from '@/hooks'
import { exportAnalysisToCsv } from '@/lib/export'
import { cn } from '@/lib/utils'
import { ENGINES, ANALYSIS_MODELS, AI_PROVIDERS } from '@/lib/constants'
import type { AnalysisResult, EngineId, ModelId, AIProvider } from '@/types'

// ─── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const r = (size - 16) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color = score >= 80 ? '#10b981' : score >= 50 ? '#6366f1' : '#f43f5e'

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg className="-rotate-90" height={size} width={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={r}
          stroke="currentColor"
          strokeWidth="8"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={r}
          stroke={color}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth="8"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div className="absolute text-center">
        <span className="text-foreground text-2xl font-black">{score}</span>
        <span className="text-muted-foreground block text-[9px] font-bold uppercase tracking-widest">
          Score
        </span>
      </div>
    </div>
  )
}

// ─── Engine Card ──────────────────────────────────────────────────────────────

function EngineCard({ breakdown }: { breakdown: AnalysisResult['engineBreakdown'][0] }) {
  const statusColor = {
    optimal: 'success',
    'needs-work': 'warning',
    critical: 'danger',
  }[breakdown.status] as 'success' | 'warning' | 'danger'

  return (
    <div className="rounded-xl border border-input bg-secondary p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-foreground font-semibold">{breakdown.engine}</span>
        <div className="flex items-center gap-2">
          <Badge variant={statusColor}>{breakdown.status}</Badge>
          <span className="text-foreground text-lg font-black">{breakdown.score}</span>
        </div>
      </div>
      <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-input-border">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700',
            breakdown.score >= 80
              ? 'bg-emerald-500'
              : breakdown.score >= 50
                ? 'bg-primary'
                : 'bg-rose-500',
          )}
          style={{ width: `${breakdown.score}%` }}
        />
      </div>
      <p className="text-text-secondary-ui text-xs">{breakdown.details}</p>
    </div>
  )
}

// ─── Keyword Row with Density ──────────────────────────────────────────────

function KeywordRow({
  kw,
}: {
  kw: { word: string; impact: number; difficulty: number; count?: number; density?: number }
}) {
  const densityStatus =
    kw.density !== undefined
      ? kw.density < 0.5
        ? 'low'
        : kw.density > 4
          ? 'high'
          : 'optimal'
      : null

  return (
    <div className="flex items-center gap-3 rounded-lg border border-input bg-secondary px-3 py-2">
      <span className="text-foreground flex-1 text-sm font-medium">{kw.word}</span>
      <div className="flex items-center gap-2 text-xs">
        {kw.count !== undefined && (
          <>
            <span className="text-muted-foreground">{kw.count}x</span>
            <span className="text-muted-foreground">|</span>
          </>
        )}
        <span className="text-emerald-500">Impact {kw.impact}</span>
        <span className="text-muted-foreground">|</span>
        <span className="text-amber-500">Diff {kw.difficulty}</span>
        {densityStatus && (
          <>
            <span className="text-muted-foreground">|</span>
            <span
              className={cn(
                'font-semibold',
                densityStatus === 'optimal'
                  ? 'text-emerald-500'
                  : densityStatus === 'high'
                    ? 'text-red-500'
                    : 'text-amber-500',
              )}
            >
              {kw.density?.toFixed(1)}%
            </span>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Intent Mapping ───────────────────────────────────────────────────────────

function IntentMapping({
  intent,
  confidence,
  signals,
}: {
  intent: string
  confidence: number
  signals: string[]
}) {
  const intentTypes = [
    'Informational',
    'Navigational',
    'Transactional',
    'Commercial',
    'Mixed',
  ] as const
  const currentIndex = intentTypes.indexOf(intent as (typeof intentTypes)[number])

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center gap-2">
        <SearchCheck className="h-5 w-5 text-primary" />
        <h2 className="text-foreground text-lg font-bold">Intent Mapping</h2>
      </div>

      <div className="mb-5 space-y-2">
        {intentTypes.map((type, idx) => {
          const isActive = type === intent
          const isPast = idx < currentIndex
          return (
            <div key={type} className="flex items-center gap-3">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-all',
                  isActive
                    ? 'bg-primary text-foreground'
                    : isPast
                      ? 'text-muted-foreground'
                      : 'text-muted-foreground bg-secondary',
                )}
              >
                {isActive ? Math.round(confidence) : idx + 1}
              </div>
              <span
                className={cn(
                  'text-sm font-medium',
                  isActive ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {type}
              </span>
              {isActive && (
                <span className="ml-auto rounded-lg bg-primary/20 px-2 py-0.5 text-xs font-semibold text-primary">
                  Active
                </span>
              )}
            </div>
          )
        })}
      </div>

      {signals.length > 0 && (
        <div className="border-t pt-4">
          <p className="text-muted-foreground mb-2 text-[10px] font-black uppercase tracking-widest">
            Detected Intent Signals
          </p>
          <div className="flex flex-wrap gap-1.5">
            {signals.map((s) => (
              <span
                key={s}
                className="text-text-secondary-ui rounded-lg border border-input bg-secondary px-2 py-0.5 text-xs"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

// ─── Keyword Density Analysis ─────────────────────────────────────────────────

function KeywordDensityAnalysis({
  keywords,
  analyzedText,
}: {
  keywords: { word: string; impact: number; difficulty: number }[]
  analyzedText?: string
}) {
  const densityData = (() => {
    if (!analyzedText || keywords.length === 0) return []
    const text = analyzedText.toLowerCase()
    const words = text.match(/\b[\w'-]+\b/g) ?? []
    const totalWords = words.length
    if (totalWords === 0) return []

    return keywords
      .map((kw) => {
        const regex = new RegExp(
          `\\b${kw.word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
          'gi',
        )
        const count = (text.match(regex) ?? []).length
        const density = (count / totalWords) * 100
        return { ...kw, count, density }
      })
      .sort((a, b) => b.density - a.density)
  })()

  const stats = {
    total: densityData.length,
    optimal: densityData.filter((k) => k.density >= 0.5 && k.density <= 4).length,
    low: densityData.filter((k) => k.density < 0.5).length,
    high: densityData.filter((k) => k.density > 4).length,
    avgDensity:
      densityData.length > 0
        ? densityData.reduce((a, b) => a + b.density, 0) / densityData.length
        : 0,
  }

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h2 className="text-foreground text-lg font-bold">Keyword Density Analysis</h2>
        </div>
        <Badge variant="brand">{stats.total} keywords</Badge>
      </div>

      <div className="mb-4 grid grid-cols-4 gap-3">
        {[
          {
            label: 'Optimal',
            value: stats.optimal,
            color: 'text-emerald-500',
            bg: 'bg-emerald-500/20',
          },
          { label: 'Low', value: stats.low, color: 'text-amber-500', bg: 'bg-amber-500/20' },
          { label: 'High', value: stats.high, color: 'text-red-500', bg: 'bg-red-500/20' },
          {
            label: 'Avg %',
            value: `${stats.avgDensity.toFixed(1)}%`,
            color: 'text-muted-foreground',
            bg: 'bg-secondary border-input',
          },
        ].map((stat) => (
          <div key={stat.label} className={cn('rounded-lg border p-3', stat.bg)}>
            <p className="text-muted-foreground text-xs">{stat.label}</p>
            <p className={cn('text-lg font-bold', stat.color)}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {densityData.map((kw) => {
          const status = kw.density < 0.5 ? 'low' : kw.density > 4 ? 'high' : 'optimal'
          const barWidth = Math.min(100, kw.density * 20)

          return (
            <div key={kw.word} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-foreground text-sm font-medium">{kw.word}</span>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{kw.count} occurrences</span>
                  <span
                    className={cn(
                      'font-semibold',
                      status === 'optimal'
                        ? 'text-emerald-500'
                        : status === 'high'
                          ? 'text-red-500'
                          : 'text-amber-500',
                    )}
                  >
                    {kw.density.toFixed(2)}%
                  </span>
                </div>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-input-border">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    status === 'optimal'
                      ? 'bg-emerald-500'
                      : status === 'high'
                        ? 'bg-red-500'
                        : 'bg-amber-500',
                  )}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 rounded-lg border border-input bg-secondary px-3 py-2">
        <p className="text-muted-foreground text-xs">
          <span className="text-foreground font-semibold">Target density:</span> 0.5% - 4.0%
          per keyword
        </p>
      </div>
    </Card>
  )
}

// ─── Engine Recommendations ─────────────────────────────────────────────────

function EngineRecommendations({ selectedEngine }: { selectedEngine: EngineId }) {
  const recommendations: Record<EngineId, string[]> = {
    all: [
      'Create clear, scannable headings that match common query patterns',
      'Include authoritative citations and source links',
      'Structure content with bullet points and numbered lists',
      'Add FAQ sections using question-answer format',
      'Ensure content demonstrates E-E-A-T signals (experience, expertise, author credentials)',
    ],
    chatgpt: [
      'Define key terms clearly in the first paragraph',
      'Use numbered lists for step-by-step content',
      'Include concrete examples with measurable outcomes',
      'Add FAQ sections with question-answer format',
      'Cite authoritative sources explicitly',
    ],
    gemini: [
      'Optimize for Knowledge Graph entity recognition',
      'Use structured data / schema markup',
      'Include geographic and temporal signals',
      'Improve E-E-A-T signals (author bio, credentials)',
      'Add clear topic headings that match search queries',
    ],
    perplexity: [
      'Increase factual density with statistics and data',
      'Add publication dates and source attribution',
      'Use direct, declarative sentence structures',
      'Include numerical data and comparative metrics',
      'Add primary source links and citations',
    ],
    claude: [
      'Develop logical argument chains with clear reasoning',
      'Acknowledge nuance, counterarguments, and edge cases',
      'Use precise technical language appropriate to context',
      'Structure content with clear conceptual hierarchy',
      'Include comparative analysis and synthesis',
    ],
  }

  const tips = recommendations[selectedEngine]

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-primary" />
        <h2 className="text-foreground text-lg font-bold">
          {selectedEngine === 'all'
            ? 'Cross-Engine'
            : ENGINES.find((e) => e.id === selectedEngine)?.label}{' '}
          Recommendations
        </h2>
      </div>

      <div className="space-y-3">
        {tips.map((tip, idx) => (
          <div
            key={idx}
            className="flex items-start gap-3 rounded-lg border border-input bg-secondary px-4 py-3"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-black text-primary">
              {idx + 1}
            </span>
            <p className="text-text-secondary-ui text-sm leading-relaxed">{tip}</p>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OptimizerPage() {
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<'text' | 'url'>('text')
  const [engine, setEngine] = useState<EngineId>('all')
  const [provider, setProvider] = useState<AIProvider>('gemini')
  const [model, setModel] = useState<ModelId>('default')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [history, setHistory] = useState<
    Array<{
      id: string
      input: string
      input_mode: string
      visibility_score: number
      summary: string
      created_at: string
      raw_response: any
    }>
  >([])
  const [showHistory, setShowHistory] = useState(false)
  const { value: showDetails, toggle: toggleDetails } = useToggle(false)

  const filteredModels = ANALYSIS_MODELS.filter((m) => m.provider === provider)

  // Load analysis history on mount
  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch('/api/analyze?limit=10')
        const d = await res.json()
        if (d.success && d.data?.length > 0) {
          setHistory(d.data)
        }
      } catch {
        // Silently fail
      }
    }
    loadHistory()
  }, [])

  const { copied, copy } = useClipboard()
  const addScan = useAppStore((s) => s.addScan)

  const { radarData } = useKeywordAnalysis(
    result?.keywords ?? [],
    result?.analyzedText,
    result?.visibilityScore ?? 0,
  )

  const handleAnalyze = useCallback(async () => {
    if (!input.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: input.trim(), mode, engine, model, provider }),
      })

      const json = (await res.json()) as {
        success: boolean
        data?: AnalysisResult
        message?: string
      }

      if (!json.success || !json.data) {
        throw new Error(json.message ?? 'Analysis failed')
      }

      setResult(json.data)
      addScan(json.data, engine, model)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [input, mode, engine, model, addScan])

  const charCount = input.length
  const charLimit = 15000

  return (
    <div className="animate-in space-y-8 bg-background">
      {/* Header */}
      <div>
        <h1 className="text-foreground text-3xl font-black tracking-tight">
          Content Optimizer
        </h1>
        <p className="text-muted-foreground mt-1">
          Analyze content for AI search visibility & citation readiness.
        </p>
      </div>

      {/* Previous Analyses */}
      {history.length > 0 && (
        <Card className="border border-input bg-card p-4">
          <button
            className="flex w-full items-center justify-between"
            onClick={() => setShowHistory(!showHistory)}
          >
            <span className="text-foreground text-sm font-bold">
              Previous Analyses ({history.length})
            </span>
            {showHistory ? (
              <ChevronUp className="text-muted-foreground h-4 w-4" />
            ) : (
              <ChevronDown className="text-muted-foreground h-4 w-4" />
            )}
          </button>
          {showHistory && (
            <div className="mt-3 space-y-2">
              {history.map((h) => (
                <button
                  key={h.id}
                  className="flex w-full items-center gap-3 rounded-lg border border-input bg-secondary px-3 py-2 text-left transition-all hover:bg-secondaryhover"
                  onClick={() => {
                    if (h.raw_response) {
                      setResult(h.raw_response as AnalysisResult)
                      setInput(h.input?.substring(0, 200) || '')
                    }
                  }}
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black',
                      (h.visibility_score || 0) >= 80
                        ? 'bg-emerald-500/15 text-emerald-500'
                        : (h.visibility_score || 0) >= 50
                          ? 'bg-primary/15 text-primary'
                          : 'bg-red-500/15 text-red-500',
                    )}
                  >
                    {h.visibility_score || 0}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground truncate text-xs font-medium">
                      {h.input_mode === 'url'
                        ? h.input
                        : h.summary || h.input?.substring(0, 80) + '...'}
                    </p>
                    <p className="text-muted-foreground text-[10px]">
                      {new Date(h.created_at).toLocaleString('sv-SE')} · {h.input_mode}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Input Card */}
      <Card className="border border-input bg-card p-6">
        {/* Mode Toggle */}
        <div className="mb-6 flex items-center gap-2">
          {(['text', 'url'] as const).map((m) => (
            <button
              key={m}
              className={cn(
                'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all',
                mode === m
                  ? 'bg-primary text-foreground shadow-lg shadow-brand-600/25'
                  : 'text-text-secondary-ui border border-input hover:bg-secondaryhover',
              )}
              onClick={() => setMode(m)}
            >
              {m === 'text' ? <FileSearch className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
              {m === 'text' ? 'Paste Text' : 'Analyze URL'}
            </button>
          ))}
        </div>

        {/* Input */}
        {mode === 'text' ? (
          <div className="space-y-1">
            <textarea
              className="text-foreground placeholder-muted-foreground w-full resize-none rounded-xl border border-input bg-input px-4 py-3 font-mono text-sm outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary"
              maxLength={charLimit}
              placeholder="Paste your content here — article, landing page copy, blog post, product description..."
              rows={10}
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <div className="flex justify-end">
              <span
                className={cn(
                  'text-xs',
                  charCount > charLimit * 0.9 ? 'text-amber-500' : 'text-muted-foreground',
                )}
              >
                {charCount.toLocaleString()} / {charLimit.toLocaleString()}
              </span>
            </div>
          </div>
        ) : (
          <input
            className="text-foreground placeholder-muted-foreground w-full rounded-xl border border-input bg-input px-4 py-3 text-sm outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary"
            placeholder="https://example.com/your-page"
            type="url"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        )}

        {/* Options row */}
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
          {/* Provider */}
          <div className="space-y-1">
            <label className="text-muted-foreground text-[10px] font-black uppercase tracking-widest">
              AI Provider
            </label>
            <div className="flex flex-wrap gap-2">
              {AI_PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-xs font-bold transition-all',
                    provider === p.id
                      ? 'border-brand-500/50 bg-primary/15 text-primary'
                      : 'text-muted-foreground border-input hover:bg-secondaryhover',
                  )}
                  onClick={() => {
                    setProvider(p.id)
                    const firstModel = ANALYSIS_MODELS.find((m) => m.provider === p.id)
                    if (firstModel) setModel(firstModel.id)
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Model */}
          <div className="space-y-1">
            <label className="text-muted-foreground text-[10px] font-black uppercase tracking-widest">
              Model
            </label>
            <select
              className="text-foreground rounded-xl border border-input bg-input px-3 py-2 text-sm outline-none focus:border-primary"
              value={model}
              onChange={(e) => setModel(e.target.value as ModelId)}
            >
              {filteredModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Engine */}
          <div className="flex-1 space-y-1">
            <label className="text-muted-foreground text-[10px] font-black uppercase tracking-widest">
              Target Engine
            </label>
            <div className="flex flex-wrap gap-2">
              {ENGINES.map((e) => (
                <button
                  key={e.id}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-xs font-bold transition-all',
                    engine === e.id
                      ? 'border-brand-500/50 bg-primary/15 text-primary'
                      : 'text-muted-foreground border-input hover:bg-secondaryhover',
                  )}
                  onClick={() => setEngine(e.id)}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>

          <Button
            className="sm:w-48"
            disabled={!input.trim()}
            loading={loading}
            size="lg"
            onClick={handleAnalyze}
          >
            <Sparkles className="h-5 w-5" />
            {loading ? 'Analyzing...' : 'Analyze'}
          </Button>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
      </Card>

      {/* Results */}
      {result && (
        <div className="animate-in space-y-6">
          {/* Top row: score + summary */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Score */}
            <Card className="flex flex-col items-center justify-center p-8">
              <ScoreRing score={result.visibilityScore} size={140} />
              <p className="text-foreground mt-4 text-center text-sm font-semibold">
                Overall Visibility Score
              </p>
              <div className="mt-4 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copy(JSON.stringify(result, null, 2))}
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => exportAnalysisToCsv(result)}>
                  <Download className="h-3.5 w-3.5" />
                  CSV
                </Button>
              </div>
            </Card>

            {/* Summary */}
            <Card className="p-6 lg:col-span-2">
              <p className="text-muted-foreground mb-4 text-[10px] font-black uppercase tracking-widest">
                AI Summary
              </p>
              <p className="text-text-secondary-ui leading-relaxed">{result.summary}</p>

              {/* Meta badges */}
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  {
                    icon: Target,
                    label: 'Intent',
                    value: result.intent,
                    conf: result.intentConfidence,
                  },
                  {
                    icon: BookOpen,
                    label: 'Type',
                    value: result.contentType,
                    conf: result.contentTypeConfidence,
                  },
                  { icon: Mic, label: 'Tone', value: result.tone, conf: result.toneConfidence },
                  { icon: Brain, label: 'Level', value: result.readingLevel, conf: null },
                ].map(({ icon: Icon, label, value, conf }) => (
                  <div
                    key={label}
                    className="rounded-lg border border-input bg-secondary p-3"
                  >
                    <Icon className="text-muted-foreground mb-1.5 h-3.5 w-3.5" />
                    <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
                      {label}
                    </p>
                    <p className="text-foreground mt-0.5 text-sm font-semibold">{value}</p>
                    {conf !== null && conf !== undefined && (
                      <p className="text-muted-foreground text-[10px]">{conf}% confidence</p>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-lg border border-input bg-secondary px-3 py-2">
                <Users className="text-muted-foreground h-3.5 w-3.5" />
                <p className="text-text-secondary-ui text-xs">
                  <span className="text-foreground font-semibold">Audience: </span>
                  {result.audience}
                </p>
              </div>
            </Card>
          </div>

          {/* Intent Mapping + Engine Breakdown */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <IntentMapping
              intent={result.intent}
              confidence={result.intentConfidence}
              signals={result.intentSignals}
            />
            <div>
              <h2 className="text-foreground mb-4 text-lg font-bold">
                Engine-by-Engine Breakdown
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {result.engineBreakdown.map((b) => (
                  <EngineCard key={b.engine} breakdown={b} />
                ))}
              </div>
            </div>
          </div>

          {/* Keywords + Radar */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Keywords */}
            <Card className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-foreground text-lg font-bold">Keywords</h2>
                <Badge variant="brand">{result.keywords.length} found</Badge>
              </div>
              <div className="space-y-2">
                {(() => {
                  const text = result.analyzedText.toLowerCase()
                  const words = text.match(/\b[\w'-]+\b/g) ?? []
                  const totalWords = words.length
                  return result.keywords.map((kw) => {
                    const regex = new RegExp(
                      `\\b${kw.word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
                      'gi',
                    )
                    const count = (text.match(regex) ?? []).length
                    const density = totalWords > 0 ? (count / totalWords) * 100 : 0
                    return <KeywordRow key={kw.word} kw={{ ...kw, count, density }} />
                  })
                })()}
              </div>
            </Card>

            {/* Radar Chart */}
            <Card className="p-6">
              <h2 className="text-foreground mb-4 text-lg font-bold">SEO Radar</h2>
              <ResponsiveContainer height={260} width="100%">
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                  <Radar
                    dataKey="A"
                    fill="#6366f1"
                    fillOpacity={0.25}
                    name="Score"
                    stroke="#6366f1"
                    strokeWidth={2}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Keyword Density Analysis */}
          <KeywordDensityAnalysis keywords={result.keywords} analyzedText={result.analyzedText} />

          {/* Engine Recommendations */}
          <EngineRecommendations selectedEngine={engine} />

          {/* Suggestions */}
          <Card className="p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-foreground text-lg font-bold">
                <TrendingUp className="mr-2 inline h-5 w-5 text-primary" />
                Improvement Suggestions
              </h2>
              <button
                className="hover:text-foreground text-muted-foreground flex items-center gap-1 text-xs"
                onClick={toggleDetails}
              >
                {showDetails ? 'Collapse' : 'Expand all'}
                {showDetails ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            <div className="space-y-3">
              {result.suggestions.map((s, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 rounded-xl border border-input bg-secondary px-4 py-3"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11px] font-black text-primary">
                    {i + 1}
                  </span>
                  <p className="text-text-secondary-ui text-sm leading-relaxed">{s}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
