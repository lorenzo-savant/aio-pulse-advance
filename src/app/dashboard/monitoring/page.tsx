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
import type { Brand, MonitoringResult } from '@/types'
import { useRealtimeResults } from '@/hooks/use-realtime'

const ENGINE_COLORS: Record<string, string> = {
  chatgpt: '#10b981',
  gemini: '#3b82f6',
  perplexity: '#a855f7',
  claude: '#f97316',
}

function ResultCard({ result }: { result: MonitoringResult }) {
  const [expanded, setExpanded] = useState(false)
  const engineColor = ENGINE_COLORS[result.engine] ?? '#6366f1'

  return (
    <div className="bg-surface-/40 hover:border-surface- rounded-2xl border transition-all">
      {/* Header */}
      <div className="flex items-center gap-4 p-4">
        {/* Engine badge */}
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-xs font-black uppercase text-white"
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
                Mentioned
              </Badge>
            ) : (
              <Badge dot variant="danger">
                Not found
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
          <p className="text-surface- truncate text-xs">"{result.prompt_text}"</p>
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
          <p className="text-surface- text-[9px] uppercase tracking-wider">score</p>
        </div>

        <button className="hover:text-surface- ml-2" onClick={() => setExpanded((v) => !v)}>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="animate-in space-y-4 border-t px-4 pb-4 pt-3">
          {/* AI Response */}
          <div>
            <p className="text-surface- mb-2 text-[10px] font-black uppercase tracking-widest">
              AI Response
            </p>
            <div className="max-h-48 overflow-y-auto rounded-xl border bg-surface-input/50 p-3">
              <p className="text-surface- text-sm leading-relaxed">{result.response_text}</p>
            </div>
          </div>

          {/* Competitor mentions */}
          {result.competitor_mentions.length > 0 && (
            <div>
              <p className="text-surface- mb-2 text-[10px] font-black uppercase tracking-widest">
                Competitor Mentions
              </p>
              <div className="flex flex-wrap gap-2">
                {result.competitor_mentions.map((c) => (
                  <div
                    key={c.name}
                    className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-1.5 text-xs"
                  >
                    <span className="font-bold text-amber-400">{c.name}</span>
                    <span className="text-surface- ml-2">
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
                Hallucination Flags
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
                      <p className="text-surface- mt-0.5">
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
              <p className="text-surface- mb-2 text-[10px] font-black uppercase tracking-widest">
                Cited URLs
              </p>
              <div className="space-y-1">
                {result.cited_urls.map((url, i) => (
                  <a
                    key={i}
                    className="block truncate text-xs text-brand-400 hover:underline"
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

          <p className="text-surface- text-[10px]">{formatRelativeTime(result.created_at)}</p>
        </div>
      )}
    </div>
  )
}

export default function MonitoringPage() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [results, setResults] = useState<MonitoringResult[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBrand, setSelectedBrand] = useState('')
  const [selectedEngine, setSelectedEngine] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState('')
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 })

  const handleNewResult = useCallback((newResult: Record<string, unknown>) => {
    setResults((prev) => [newResult as unknown as MonitoringResult, ...prev])
    setPagination((prev) => ({ ...prev, total: prev.total + 1 }))
    toast.success('New monitoring result received!')
  }, [])

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
      toast.error('Failed to load monitoring data')
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">Monitoring Results</h1>
          <p className="mt-1">Live AI engine response analysis for your brands.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            {isConnected ? (
              <>
                <Wifi className="h-3.5 w-3.5 text-emerald-400 text-emerald-600" />
                <span className="text-emerald-400 text-emerald-600">Live</span>
              </>
            ) : (
              <>
                <WifiOff className="text-surface- h-3.5 w-3.5" />
                <span className="text-surface-">Offline</span>
              </>
            )}
          </div>
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: 'Total Results',
            value: pagination.total,
            icon: Shield,
            color: 'text-brand-600 text-brand-400',
          },
          {
            label: 'Mention Rate',
            value: `${mentionRate}%`,
            icon: CheckCircle2,
            color: 'text-emerald-600 text-emerald-400',
          },
          {
            label: 'Hallucinations',
            value: hallucinationCount,
            icon: AlertTriangle,
            color: 'text-red-600 text-red-400',
          },
          {
            label: 'Engines Active',
            value: 3,
            icon: XCircle,
            color: 'text-purple-600 text-purple-400',
          },
        ].map((s) => (
          <Card key={s.label} className="p-5 text-center">
            <s.icon className={cn('mx-auto mb-2 h-6 w-6', s.color)} />
            <p className="text-2xl font-black text-white">{s.value}</p>
            <p className="text-surface- text-xs">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-widest">Brand:</span>
          <select
            className="rounded-xl border px-3 py-1.5 text-xs text-white outline-none focus:border-brand-500"
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
          >
            <option value="">All brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-surface- text-xs font-bold uppercase tracking-widest">Engine:</span>
          {['', 'chatgpt', 'gemini', 'perplexity'].map((e) => (
            <button
              key={e}
              className={cn(
                'rounded-xl border px-3 py-1.5 text-xs font-bold transition-all',
                selectedEngine === e
                  ? 'border-brand-500/50 bg-brand-500/15 text-brand-400'
                  : 'hover:text-surface-',
              )}
              onClick={() => setSelectedEngine(e)}
            >
              {e || 'All'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-surface- text-xs font-bold uppercase tracking-widest">
            Language:
          </span>
          <select
            className="rounded-xl border bg-surface-input px-3 py-1.5 text-xs text-dashboard-text outline-none focus:border-brand-500"
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
          <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
        </div>
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Shield className="mb-4 h-16 w-16" />
          <h2 className="mb-2 text-xl font-bold text-white">No results yet</h2>
          <p className="">
            Run a prompt from the Prompts page to start collecting monitoring data.
          </p>
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
