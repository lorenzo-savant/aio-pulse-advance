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
  Download,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/index'
import { SectionHelp } from '@/components/help/SectionHelp'
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
              <p className="text-red-700 mb-2 text-[10px] font-black uppercase tracking-widest">
                {t('hallucination_flags')}
              </p>
              <div className="space-y-2">
                {result.hallucination_flags.map((flag, i) => (
                  <div
                    key={i}
                    className="border-red-500/20 bg-red-500/5 flex items-start gap-2 rounded-lg border px-3 py-2"
                  >
                    <AlertTriangle className="text-red-400 mt-0.5 h-3.5 w-3.5 shrink-0" />
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
  /**
   * Headline figures computed by the server over the WHOLE filtered set.
   *
   * They used to be derived from `results`, which holds one page. A rate can
   * survive that by luck; a count cannot. Against production the page reported
   * 0 hallucinations from a 30-row window while the table held 62 — they run at
   * roughly 3%, so a short window almost never contains one.
   */
  const [stats, setStats] = useState<{
    total: number
    mentioned: number | null
    hallucinated: number | null
    mentionRate: number | null
    partial: boolean
  } | null>(null)
  /** How many pages of results are currently on screen. */
  const [pagesLoaded, setPagesLoaded] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)

  const handleNewResult = useCallback(
    (newResult: Record<string, unknown>) => {
      setResults((prev) => [newResult as unknown as MonitoringResult, ...prev])
      setPagination((prev) => ({ ...prev, total: prev.total + 1 }))
      toast.success(t('new_result_received'))
    },
    [t],
  )

  const { isConnected } = useRealtimeResults(selectedBrand || '', handleNewResult)

  /** Rows per request. The endpoint caps at 100. */
  const PER_PAGE = 50

  const resultsUrl = useCallback(
    (page: number) => {
      const p = new URLSearchParams({ limit: String(PER_PAGE), page: String(page) })
      if (selectedBrand) p.set('brand_id', selectedBrand)
      if (selectedEngine) p.set('engine', selectedEngine)
      if (selectedLanguage) p.set('language', selectedLanguage)
      return `/api/monitoring?${p}`
    },
    [selectedBrand, selectedEngine, selectedLanguage],
  )

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [brandsRes, resultsRes] = await Promise.all([
        fetch('/api/brands'),
        fetch(resultsUrl(1)),
      ])
      const bJson = (await brandsRes.json()) as { success: boolean; data?: Brand[] }
      const rJson = (await resultsRes.json()) as {
        success: boolean
        data?: MonitoringResult[]
        pagination?: typeof pagination
        stats?: NonNullable<typeof stats>
      }
      setBrands(bJson.data ?? [])
      setResults(rJson.data ?? [])
      setPagesLoaded(1)
      if (rJson.pagination) setPagination(rJson.pagination)
      setStats(rJson.stats ?? null)
    } catch {
      toast.error(t('failed_to_load_data'))
    } finally {
      setLoading(false)
    }
    // `t` from next-intl is stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultsUrl])

  /**
   * Append the next page. The list used to stop at a hardcoded 30 rows with no
   * control to see past them, while the stat card above it announced the real
   * total — so the page told you 2130 results existed and showed you 30.
   */
  const loadMore = useCallback(async () => {
    if (loadingMore) return
    setLoadingMore(true)
    try {
      const next = pagesLoaded + 1
      const res = await fetch(resultsUrl(next))
      const json = (await res.json()) as {
        success: boolean
        data?: MonitoringResult[]
        pagination?: typeof pagination
      }
      if (!json.success) throw new Error('load failed')
      setResults((prev) => [...prev, ...(json.data ?? [])])
      setPagesLoaded(next)
      if (json.pagination) setPagination(json.pagination)
    } catch {
      toast.error(t('failed_to_load_data'))
    } finally {
      setLoadingMore(false)
    }
    // `t` from next-intl is stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingMore, pagesLoaded, resultsUrl])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // Prefer the server's aggregate over the whole filtered set. Falling back to
  // the loaded page is only for the moment before stats arrive, and it is
  // labelled as such below rather than passed off as the real figure.
  const mentionRate =
    stats?.mentionRate ??
    (results.length > 0
      ? Math.round((results.filter((r) => r.brand_mentioned).length / results.length) * 100)
      : 0)

  const hallucinationCount =
    stats?.hallucinated ?? results.filter((r) => r.has_hallucination).length

  /** True while the cards describe the loaded page rather than everything. */
  const statsArePartial = stats == null || stats.partial

  return (
    <div className="animate-in space-y-8">
      <SectionHelp section="monitoring" />
      <JourneyGuide
        step={2}
        title="Run AI engine checks and watch results stream in"
        lead="For every prompt, AEO Pulse sends the query to all 4 AI engines, captures their responses, and extracts brand mentions, sentiment, citations, and hallucinations."
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
          {/* Full evidence export: every prompt with its answer text, the links
              the engine cited and the searches it ran. Disabled without a brand
              because /api/export is brand-scoped — exporting "all brands" would
              cross a tenancy boundary. */}
          <Button
            variant="outline"
            disabled={!selectedBrand}
            title={selectedBrand ? t('export_hint') : t('export_needs_brand')}
            onClick={() => {
              if (!selectedBrand) return
              window.location.href = `/api/export?brand_id=${selectedBrand}&format=csv`
            }}
          >
            <Download className="h-4 w-4" />
            {t('export')}
          </Button>
        </div>
      </div>

      {/* Quick stats. These describe every row matching the current filters,
          counted by the server — not the rows that happen to be on screen. */}
      {statsArePartial && results.length > 0 && (
        <p className="text-xs text-amber-400">
          {stats?.partial
            ? 'Figures below cover the brand and engine filters, but not the language filter.'
            : 'Figures below describe the results loaded so far.'}
        </p>
      )}
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
          {/* The list is as long as it says it is. It used to stop at a
              hardcoded 30 rows with no control to go further, directly beneath
              a card announcing the real total. */}
          <p className="text-xs text-muted-foreground">
            {results.length >= pagination.total
              ? `${pagination.total} ${pagination.total === 1 ? 'result' : 'results'}`
              : `Showing ${results.length} of ${pagination.total} results`}
          </p>

          {results.map((result) => (
            <ResultCard key={result.id} result={result} />
          ))}

          {results.length < pagination.total && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  `Load ${Math.min(PER_PAGE, pagination.total - results.length)} more`
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
