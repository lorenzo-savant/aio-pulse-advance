'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/index'
import { formatRelativeTime, cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { JourneyGuide } from '@/components/JourneyGuide'
import type { Brand, MonitoringResult } from '@/types'
import { useRealtimeResults } from '@/hooks/use-realtime'
import { useTranslations } from 'next-intl'

const ENGINE_COLORS: Record<string, string> = {
  chatgpt: '#10b981',
  gemini: '#3b82f6',
  perplexity: '#a855f7',
  claude: '#f97316',
}

function ResultCard({ result }: { result: MonitoringResult }) {
  const t = useTranslations('monitoring')
  const [expanded, setExpanded] = useState(false)
  const engineColor = ENGINE_COLORS[result.engine] ?? '#6366f1'

  return (
    <div className="bg-secondary/40 hover:border-border- rounded-2xl border transition-all">
      {/* Header */}
      <div className="flex items-center gap-4 p-4">
        {/* Engine badge */}
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-xs font-black uppercase text-foreground"
          style={{
            background: `${engineColor}20`,
            borderColor: `${engineColor}40`,
            color: engineColor,
          }}
        >
          {result.engine.slice(0, 3)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            {result.prompt?.language && (
              <Badge variant="default" size="sm">
                {result.prompt.language.toUpperCase()}
              </Badge>
            )}
            {result.brand_mentioned ? (
              <Badge dot variant="success">
                {t('mentioned')}
              </Badge>
            ) : (
              <Badge dot variant="danger">
                {t('not_found')}
              </Badge>
            )}
            {result.sentiment && (
              <Badge
                variant={
                  result.sentiment === 'positive'
                    ? 'success'
                    : result.sentiment === 'negative'
                      ? 'danger'
                      : 'default'
                }
              >
                {result.sentiment}
              </Badge>
            )}
            {result.has_hallucination && <Badge variant="danger">⚠ Hallucination</Badge>}
            {result.mention_position && (
              <Badge variant="info">Position #{result.mention_position}</Badge>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">"{result.prompt_text}"</p>
        </div>

        {/* Score */}
        <div className="shrink-0 text-center">
          <p
            className={cn(
              'text-xl font-black',
              result.visibility_score >= 70
                ? 'text-emerald-400'
                : result.visibility_score >= 40
                  ? 'text-brand-400'
                  : 'text-red-400',
            )}
          >
            {result.visibility_score}
          </p>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">score</p>
        </div>

        <button className="ml-2 hover:text-muted-foreground" onClick={() => setExpanded((v) => !v)}>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="animate-in space-y-4 border-t px-4 pb-4 pt-3">
          {/* AI Response */}
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {t('ai_response')}
            </p>
            <div className="bg-input/50 max-h-48 overflow-y-auto rounded-xl border p-3">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {result.response_text}
              </p>
            </div>
          </div>

          {/* Competitor mentions */}
          {result.competitor_mentions.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {t('competitor_mentions')}
              </p>
              <div className="flex flex-wrap gap-2">
                {result.competitor_mentions.map((c) => (
                  <div
                    key={c.name}
                    className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-1.5 text-xs"
                  >
                    <span className="font-bold text-amber-400">{c.name}</span>
                    <span className="ml-2 text-muted-foreground">
                      pos #{c.position} · {c.count}x
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hallucination flags */}
          {result.hallucination_flags.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-red-700">
                {t('hallucination_flags')}
              </p>
              <div className="space-y-2">
                {result.hallucination_flags.map((flag, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2"
                  >
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                    <div className="text-xs">
                      <p className="text-red-300">"{flag.text}"</p>
                      <p className="mt-0.5 text-muted-foreground">
                        {flag.type.replace(/_/g, ' ')} · severity: {flag.severity}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cited URLs */}
          {result.cited_urls.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {t('cited_urls')}
              </p>
              <div className="space-y-1">
                {result.cited_urls.map((url, i) => (
                  <a
                    key={i}
                    className="text-brand-400 block truncate text-xs hover:underline"
                    href={url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {url}
                  </a>
                ))}
              </div>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground">
            {formatRelativeTime(result.created_at)}
          </p>
        </div>
      )}
    </div>
  )
}

export default function MonitoringPage() {
  const t = useTranslations('monitoring')
  const tc = useTranslations('common')
  const [brands, setBrands] = useState<Brand[]>([])
  const [results, setResults] = useState<MonitoringResult[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBrand, setSelectedBrand] = useState('')
  const [selectedEngine, setSelectedEngine] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState('')
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 })

  const handleNewResult = useCallback(
    (newResult: Record<string, unknown>) => {
      setResults((prev) => [newResult as unknown as MonitoringResult, ...prev])
      setPagination((prev) => ({ ...prev, total: prev.total + 1 }))
      toast.success(t('new_result_received'))
    },
    [t],
  )

  const { isConnected } = useRealtimeResults(selectedBrand || '', handleNewResult)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [brandsRes, resultsRes] = await Promise.all([
        fetch('/api/brands'),
        fetch(
          `/api/monitoring?${selectedBrand ? `brand_id=${selectedBrand}&` : ''}${selectedEngine ? `engine=${selectedEngine}&` : ''}${selectedLanguage ? `language=${selectedLanguage}&` : ''}limit=30`,
        ),
      ])
      const bJson = (await brandsRes.json()) as { success: boolean; data?: Brand[] }
      const rJson = (await resultsRes.json()) as {
        success: boolean
        data?: MonitoringResult[]
        pagination?: typeof pagination
      }
      setBrands(bJson.data ?? [])
      setResults(rJson.data ?? [])
      if (rJson.pagination) setPagination(rJson.pagination)
    } catch {
      toast.error(t('failed_to_load_data'))
    } finally {
      setLoading(false)
    }
  }, [selectedBrand, selectedEngine, selectedLanguage])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const mentionRate =
    results.length > 0
      ? Math.round((results.filter((r) => r.brand_mentioned).length / results.length) * 100)
      : 0

  const hallucinationCount = results.filter((r) => r.has_hallucination).length

  return (
    <div className="animate-in space-y-8">
      <JourneyGuide
        step={2}
        title="Run AI engine checks and watch results stream in"
        lead="For every prompt, AIO Pulse sends the query to all 4 AI engines, captures their responses, and extracts brand mentions, sentiment, citations, and hallucinations."
        persistKey="monitoring"
        steps={[
          {
            label: 'Go to Prompts and click "Run" on one',
            description:
              'Or use the brand detail page — each brand has a "Run all prompts" button.',
          },
          {
            label: 'Wait 20-40 seconds per engine',
            description:
              'Each engine call is real (not cached). Costs ~1 credit per engine per prompt.',
          },
          {
            label: 'Results appear in this page live',
            description:
              'Sentiment label, brand mention position, cited URLs, competitor mentions — all automatic.',
          },
          {
            label: 'Schedule recurring runs',
            description:
              'Cron already runs daily prompts automatically once configured on the brand.',
          },
        ]}
        outcomes={[
          'Historic tracking of how your brand appears in AI',
          'AVI score computed from these results',
          'Sentiment / Citations / Keywords dashboards populated',
          'Alerts fire when thresholds trip',
        ]}
      />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">{t('page_title')}</h1>
          <p className="mt-1">{t('page_subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            {isConnected ? (
              <>
                <Wifi className="h-3.5 w-3.5 text-emerald-400 text-emerald-600" />
                <span className="text-emerald-400 text-emerald-600">{t('live')}</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">{t('offline')}</span>
              </>
            )}
          </div>
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            {t('refresh')}
          </Button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: t('total_results'),
            value: pagination.total,
            icon: Shield,
            color: 'text-primary',
          },
          {
            label: t('mention_rate'),
            value: `${mentionRate}%`,
            icon: CheckCircle2,
            color: 'text-emerald-400',
          },
          {
            label: t('hallucinations'),
            value: hallucinationCount,
            icon: AlertTriangle,
            color: 'text-red-400',
          },
          {
            label: t('engines_active'),
            value: 3,
            icon: XCircle,
            color: 'text-purple-600 text-purple-400',
          },
        ].map((s) => (
          <Card key={s.label} className="p-5 text-center">
            <s.icon className={cn('mx-auto mb-2 h-6 w-6', s.color)} />
            <p className="text-2xl font-black text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-widest">{t('brand_filter')}</span>
          <select
            className="rounded-xl border px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
          >
            <option value="">{t('all_brands')}</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {t('engine_filter')}
          </span>
          {['', 'chatgpt', 'gemini', 'perplexity'].map((e) => (
            <button
              key={e}
              className={cn(
                'rounded-xl border px-3 py-1.5 text-xs font-bold transition-all',
                selectedEngine === e
                  ? 'border-brand-500/50 bg-primary/15 text-brand-400'
                  : 'hover:text-muted-foreground',
              )}
              onClick={() => setSelectedEngine(e)}
            >
              {e || t('all_engines')}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {t('language_filter')}
          </span>
          {['', 'chatgpt', 'gemini', 'perplexity'].map((e) => (
            <button
              key={e}
              className={cn(
                'rounded-xl border px-3 py-1.5 text-xs font-bold transition-all',
                selectedEngine === e
                  ? 'border-brand-500/50 bg-primary/15 text-brand-400'
                  : 'hover:text-muted-foreground',
              )}
              onClick={() => setSelectedEngine(e)}
            >
              {e || 'All'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Language:
          </span>
          <select
            className="rounded-xl border bg-input px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
          >
            <option value="">All</option>
            <option value="en">English</option>
            <option value="sv">Swedish</option>
            <option value="de">German</option>
            <option value="fr">French</option>
            <option value="es">Spanish</option>
            <option value="no">Norwegian</option>
            <option value="da">Danish</option>
          </select>
        </div>
      </Card>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="text-brand-400 h-8 w-8 animate-spin" />
        </div>
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Shield className="mb-4 h-16 w-16" />
          <h2 className="mb-2 text-xl font-bold text-foreground">{t('no_results_yet')}</h2>
          <p className="">{t('no_results_desc')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {results.map((result) => (
            <ResultCard key={result.id} result={result} />
          ))}
        </div>
      )}
    </div>
  )
}
