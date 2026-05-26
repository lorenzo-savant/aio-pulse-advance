'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  AlertTriangle,
  Smile,
  Frown,
  Meh,
  Brain,
  Loader2,
  Zap,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SectionHelp } from '@/components/help/SectionHelp'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Brand } from '@/types'
import { SentimentDriversPanel } from '@/components/SentimentDriversPanel'
import { HomonymAuditPanel } from '@/components/HomonymAuditPanel'

interface AspectBreakdown {
  aspect: string
  positive: number
  negative: number
  neutral: number
  total: number
  net: number
}

interface Theme {
  label: string
  size: number
  share: number
  avgSentiment: number | null
  sampleTexts: string[]
}

interface SentimentStats {
  sentimentCounts: { positive: number; negative: number; neutral: number }
  avgSentimentScore: number
  hallucinationCount: number
  hallucinationRate: number
  byEngine: Record<string, { avg: number; count: number }>
  timeline?: Array<{ date: string; avgScore: number; count: number }>
  aspectBreakdown?: AspectBreakdown[]
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

function SentimentGauge({
  score,
  negLabel,
  neuLabel,
  posLabel,
  scoreLabel,
}: {
  score: number
  negLabel: string
  neuLabel: string
  posLabel: string
  scoreLabel: string
}) {
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
          {negLabel}
        </text>
        <text x="89" y="18" fontSize="10" fill={GAUGE_LABEL_COLOR}>
          {neuLabel}
        </text>
        <text x="175" y="115" fontSize="10" fill={GAUGE_LABEL_COLOR}>
          {posLabel}
        </text>
      </svg>
      <div className="mt-1 text-center">
        <p className="text-3xl font-black" style={{ color }}>
          {score > 0 ? '+' : ''}
          {score.toFixed(2)}
        </p>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {scoreLabel}
        </p>
      </div>
    </div>
  )
}

function ManualAnalyzer({ brands }: { brands: Brand[] }) {
  const t = useTranslations('sentiment')
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

  const MODE_LABELS: Record<string, string> = {
    both: t('mode_both'),
    sentiment: t('mode_sentiment'),
    hallucination: t('mode_hallucination'),
  }

  const analyze = async () => {
    if (!text.trim() || !brandId) {
      toast.error(t('enter_text'))
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
      toast.error(err instanceof Error ? err.message : t('analysis_failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-input bg-card p-6">
      <div className="mb-5 flex items-center gap-3">
        <Brain className="h-5 w-5 text-brand" />
        <h2 className="text-lg font-bold text-foreground">{t('manual_analyzer')}</h2>
        <span className="text-xs text-muted-foreground">{t('paste_ai_response')}</span>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {t('brand_label')}
            </label>
            <select
              className="w-full rounded-xl border border-input bg-input px-4 py-2.5 text-sm text-foreground outline-none focus:border-brand"
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
            >
              <option value="">{t('select_brand')}</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {t('analysis_mode')}
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
                  {MODE_LABELS[m]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <textarea
          className="placeholder-text-muted-surface w-full resize-none rounded-xl border border-input bg-input px-4 py-3 text-sm text-foreground outline-none focus:border-brand"
          placeholder={t('textarea_placeholder')}
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <Button className="w-full" loading={loading} onClick={analyze}>
          <Zap className="h-4 w-4" />
          {loading ? t('analyzing') : t('analyze_text')}
        </Button>
      </div>

      {result && (
        <div className="animate-in mt-6 space-y-4 border-t border-border pt-5">
          {result.sentiment && (
            <div>
              <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {t('sentiment_result')}
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
                      {t('score')}: {result.sentiment.score > 0 ? '+' : ''}
                      {result.sentiment.score.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('confidence')}: {result.sentiment.confidence}%
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
                {t('hallucination_check')}
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
                    <span className="text-emerald-500">&#10003;</span>
                  )}
                  <span
                    className={cn(
                      'font-bold',
                      result.hallucination.has_hallucination ? 'text-red-400' : 'text-emerald-500',
                    )}
                  >
                    {result.hallucination.has_hallucination
                      ? t('issues_detected', { count: result.hallucination.flags.length })
                      : t('no_hallucinations')}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {t('confidence')}: {result.hallucination.confidence}%
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{result.hallucination.summary}</p>
                {result.hallucination.flags.map((flag, i) => (
                  <div
                    key={i}
                    className="mt-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs"
                  >
                    <p className="font-bold text-red-400">&quot;{flag.text}&quot;</p>
                    <p className="mt-0.5 text-muted-foreground">
                      {flag.type} &middot; {flag.severity} {t('severity')}
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

function InfoSection() {
  const t = useTranslations('sentiment')
  const [open, setOpen] = useState(false)

  return (
    <Card className="border-border bg-card">
      <button
        className="flex w-full items-center justify-between px-6 py-4 text-left"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <Info className="h-5 w-5 text-brand" />
          <span className="text-sm font-bold text-foreground">{t('guide_title')}</span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="border-t border-border px-6 pb-6 pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {t('guide_what_is')?.split('.')[0]}
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">{t('guide_what_is')}</p>
            </div>
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {t('guide_how_it_works')?.split('.')[0]}
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t('guide_how_it_works')}
              </p>
            </div>
            <div className="md:col-span-2">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {t('guide_what_to_do')?.split('.')[0]}
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t('guide_what_to_do')}
              </p>
            </div>
            <div className="border-brand-500/10 bg-brand-500/5 rounded-lg border p-4">
              <p className="mb-1 text-xs font-bold text-brand">
                {t('guide_sentiment_value')?.split('.')[0]}
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t('guide_sentiment_value')}
              </p>
            </div>
            <div className="rounded-lg border border-red-500/10 bg-red-500/5 p-4">
              <p className="mb-1 text-xs font-bold text-red-500">
                {t('guide_hallucination_value')?.split('.')[0]}
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t('guide_hallucination_value')}
              </p>
            </div>
          </div>
          <div className="mt-4 border-t border-border pt-3">
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              {t('guide_industry_terms')}
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {t('guide_footer_disclaimer')}
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}

interface SentimentSource {
  domain: string
  owned: boolean
  mentions: number
  avgSentiment: number
  skew: 'positive' | 'negative' | 'neutral'
  pos: number
  neg: number
  neu: number
  engines: string[]
}

interface SourcesData {
  summary: {
    totalAnalyzed: number
    negativeSources: number
    positiveSources: number
    minMentions: number
    ownedDomain: string | null
  }
  sources: SentimentSource[]
  topNegative: SentimentSource[]
  topPositive: SentimentSource[]
}

function SourceRow({ s }: { s: SentimentSource }) {
  const tone =
    s.skew === 'negative'
      ? 'bg-rose-500/10 text-rose-400'
      : s.skew === 'positive'
        ? 'bg-emerald-500/10 text-emerald-400'
        : 'bg-input text-muted-foreground'
  return (
    <div className="bg-input/40 flex flex-col gap-2 rounded-lg border border-input px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">{s.domain}</span>
          {s.owned && (
            <span className="shrink-0 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
              your domain
            </span>
          )}
          <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-bold', tone)}>
            {s.avgSentiment > 0 ? '+' : ''}
            {s.avgSentiment.toFixed(2)}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span>{s.mentions} mentions</span>
          <span>·</span>
          <span className="text-emerald-400/80">+{s.pos}</span>
          <span className="text-rose-400/80">−{s.neg}</span>
          <span>={s.neu}</span>
          {s.engines.length > 0 && (
            <>
              <span>·</span>
              <span className="capitalize">{s.engines.join(', ')}</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SentimentPage() {
  const t = useTranslations('sentiment')
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrand, setSelectedBrand] = useState('')
  const [stats, setStats] = useState<SentimentStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [themes, setThemes] = useState<Theme[]>([])
  const [loadingThemes, setLoadingThemes] = useState(false)
  // Sentiment-by-source (closes Semrush best-practice #5 — "look at sentiment
  // sources / triggers"). Aggregates by cited domain so the user can see
  // WHERE the AI is getting its negative impressions from.
  const [sourcesData, setSourcesData] = useState<SourcesData | null>(null)
  const [loadingSources, setLoadingSources] = useState(false)

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

  // Themes: what the AI engines associate with the brand (semantic clusters of
  // the responses). Best-effort — empty if embeddings/migration unavailable.
  useEffect(() => {
    if (!selectedBrand) return
    let cancelled = false
    setLoadingThemes(true)
    fetch(`/api/themes?brand_id=${selectedBrand}`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setThemes(j.success ? (j.data?.themes ?? []) : [])
      })
      .catch(() => {
        if (!cancelled) setThemes([])
      })
      .finally(() => {
        if (!cancelled) setLoadingThemes(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedBrand])

  // Sentiment by source: which cited domains correlate with negative vs
  // positive sentiment. Pure aggregation over monitoring_results (no new API).
  useEffect(() => {
    if (!selectedBrand) return
    let cancelled = false
    setLoadingSources(true)
    fetch(`/api/sentiment/by-source?brand_id=${selectedBrand}&days=30`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setSourcesData(j.success ? (j.data ?? null) : null)
      })
      .catch(() => {
        if (!cancelled) setSourcesData(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingSources(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedBrand])

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
      <SectionHelp section="sentiment" />
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">{t('page_title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('page_subtitle')}</p>
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

      <InfoSection />

      {loadingStats ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="flex flex-col items-center justify-center border-input bg-card p-8">
              <SentimentGauge
                score={stats.avgSentimentScore}
                negLabel={t('neg_label')}
                neuLabel={t('neu_label')}
                posLabel={t('pos_label')}
                scoreLabel={t('sentiment_score_label')}
              />
              <div className="mt-6 flex gap-4 text-center">
                <div>
                  <p className="text-lg font-black text-emerald-500">
                    {stats.sentimentCounts.positive}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{t('positive')}</p>
                </div>
                <div>
                  <p className="text-lg font-black text-muted-foreground">
                    {stats.sentimentCounts.neutral}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{t('neutral')}</p>
                </div>
                <div>
                  <p className="text-lg font-black text-red-500">
                    {stats.sentimentCounts.negative}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{t('negative')}</p>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-4 lg:col-span-2">
              {[
                {
                  label: t('total_analyzed'),
                  value: stats.totalResults,
                  icon: Brain,
                  color: 'text-brand',
                },
                {
                  label: t('with_brand_mention'),
                  value: stats.mentionedResults,
                  icon: Smile,
                  color: 'text-emerald-500',
                },
                {
                  label: t('hallucinations'),
                  value: stats.hallucinationCount,
                  icon: AlertTriangle,
                  color: 'text-red-500',
                },
                {
                  label: t('hallucination_rate'),
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
              <h2 className="mb-6 text-lg font-bold text-foreground">{t('average_sentiment')}</h2>
              <ResponsiveContainer height={220} width="100%">
                <BarChart data={engineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                  <XAxis dataKey="engine" tick={{ fontSize: 11, fill: TICK_COLOR }} />
                  <YAxis domain={[-1, 1]} tick={{ fontSize: 11, fill: TICK_COLOR }} />
                  <Tooltip
                    {...TOOLTIP_STYLE()}
                    formatter={(v: number) => [
                      v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2),
                      t('score'),
                    ]}
                  />
                  <Bar dataKey="score" name={t('average_sentiment')} radius={[4, 4, 0, 0]}>
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

          {stats.timeline && stats.timeline.length >= 2 && (
            <Card className="border-border bg-secondary p-6">
              <h2 className="mb-6 text-lg font-bold text-foreground">{t('trend_title')}</h2>
              <ResponsiveContainer height={220} width="100%">
                <LineChart data={stats.timeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: TICK_COLOR }} />
                  <YAxis domain={[-1, 1]} tick={{ fontSize: 11, fill: TICK_COLOR }} />
                  <Tooltip
                    {...TOOLTIP_STYLE()}
                    formatter={(v: number) => [
                      v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2),
                      t('score'),
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgScore"
                    name={t('average_sentiment')}
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}

          {stats.aspectBreakdown && stats.aspectBreakdown.length > 0 && (
            <Card className="border-border bg-secondary p-6">
              <h2 className="text-lg font-bold text-foreground">{t('aspect_title')}</h2>
              <p className="mb-5 text-sm text-muted-foreground">{t('aspect_hint')}</p>
              <div className="space-y-3">
                {stats.aspectBreakdown.map((a) => {
                  const pct = (n: number) => (a.total > 0 ? (n / a.total) * 100 : 0)
                  return (
                    <div key={a.aspect} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-sm font-semibold capitalize text-foreground">
                        {t(`aspects.${a.aspect}`)}
                      </span>
                      <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-input">
                        <div style={{ width: `${pct(a.positive)}%` }} className="bg-emerald-500" />
                        <div style={{ width: `${pct(a.neutral)}%` }} className="bg-gray-500" />
                        <div style={{ width: `${pct(a.negative)}%` }} className="bg-rose-500" />
                      </div>
                      <span
                        className={cn(
                          'w-12 shrink-0 text-right text-sm font-bold',
                          a.net > 0.15
                            ? 'text-emerald-500'
                            : a.net < -0.15
                              ? 'text-rose-500'
                              : 'text-muted-foreground',
                        )}
                      >
                        {a.net > 0 ? `+${a.net.toFixed(2)}` : a.net.toFixed(2)}
                      </span>
                      <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">
                        ×{a.total}
                      </span>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {/* Themes — semantic clusters of the responses that mention the brand */}
          {(themes.length > 0 || loadingThemes) && (
            <Card className="border-border bg-secondary p-6">
              <h2 className="text-lg font-bold text-foreground">{t('themes_title')}</h2>
              <p className="mb-5 text-sm text-muted-foreground">{t('themes_hint')}</p>
              {loadingThemes && themes.length === 0 ? (
                <p className="text-sm text-muted-foreground">…</p>
              ) : (
                <div className="space-y-3">
                  {themes.map((th, i) => (
                    <div key={i} className="bg-input/40 rounded-xl border border-input p-3">
                      <div className="flex items-center gap-3">
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold capitalize text-foreground">
                          {th.label}
                        </span>
                        {th.avgSentiment != null && (
                          <span
                            className={cn(
                              'shrink-0 rounded-full px-2 py-0.5 text-xs font-bold',
                              th.avgSentiment > 0.15
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : th.avgSentiment < -0.15
                                  ? 'bg-rose-500/10 text-rose-400'
                                  : 'bg-input text-muted-foreground',
                            )}
                          >
                            {th.avgSentiment > 0 ? '+' : ''}
                            {th.avgSentiment.toFixed(2)}
                          </span>
                        )}
                        <span className="w-12 shrink-0 text-right text-sm font-black text-foreground">
                          {th.share}%
                        </span>
                        <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">
                          ×{th.size}
                        </span>
                      </div>
                      {th.sampleTexts[0] && (
                        <p className="mt-1.5 line-clamp-2 text-xs italic text-muted-foreground">
                          “{th.sampleTexts[0].slice(0, 160)}…”
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* Sentiment by Source — which cited domains drive the AI's framing.
              Closes the Semrush "look at sentiment sources / triggers"
              best-practice. Hidden when no sources are aggregated yet. */}
          {sourcesData &&
            (sourcesData.topNegative.length > 0 || sourcesData.topPositive.length > 0) && (
              <Card className="border-border bg-secondary p-6">
                <h2 className="text-lg font-bold text-foreground">Sentiment by Source</h2>
                <p className="mb-5 text-sm text-muted-foreground">
                  Which cited domains correlate with negative vs. positive AI responses (
                  {sourcesData.summary.totalAnalyzed} analyzed, min{' '}
                  {sourcesData.summary.minMentions} mentions). Fix or counter the sources at the top
                  of the negative list to shift the AI&rsquo;s framing of your brand.
                </p>

                {sourcesData.topNegative.length > 0 && (
                  <div className="mb-6">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-rose-400">
                      Most-negative sources ({sourcesData.summary.negativeSources})
                    </p>
                    <div className="space-y-2">
                      {sourcesData.topNegative.slice(0, 10).map((s) => (
                        <SourceRow key={s.domain} s={s} />
                      ))}
                    </div>
                  </div>
                )}

                {sourcesData.topPositive.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                      Most-positive sources ({sourcesData.summary.positiveSources})
                    </p>
                    <div className="space-y-2">
                      {sourcesData.topPositive.slice(0, 5).map((s) => (
                        <SourceRow key={s.domain} s={s} />
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )}
          {loadingSources && !sourcesData && (
            <Card className="border-border bg-secondary p-6 text-sm text-muted-foreground">
              Loading sentiment-by-source…
            </Card>
          )}

          {stats.totalResults === 0 && (
            <div className="rounded-2xl border border-input bg-secondary px-6 py-10 text-center">
              <p className="mb-2 text-lg font-bold text-foreground">{t('no_data')}</p>
              <p className="text-muted-foreground">{t('run_monitoring')}</p>
            </div>
          )}

          {/* Which aspects (pricing, support, ease-of-use, …) drive positive vs
              negative AI portrayal of the brand. Mined from monitoring_results
              with the lexical sentiment engine — see service/sentiment-drivers.ts */}
          {selectedBrand && <SentimentDriversPanel brandId={selectedBrand} />}

          {/* Homonym audit — flags mentions where the AI confused this brand
              with a same-named entity (Acasting ↔ Acast podcast, etc). Flagged
              rows are excluded from the SoV + sentiment metrics so the numbers
              above reflect only real brand mentions. */}
          {selectedBrand && <HomonymAuditPanel brandId={selectedBrand} />}
        </>
      ) : null}

      <ManualAnalyzer brands={brands} />
    </div>
  )
}
