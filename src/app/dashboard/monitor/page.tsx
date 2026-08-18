'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Shield,
  Zap,
  Globe,
  Brain,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/index'
import { Button } from '@/components/ui/Button'
import { getEngineSignals } from '@/lib/engine-signals'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

const ENGINES = [
  {
    id: 'chatgpt',
    name: 'ChatGPT / SearchGPT',
    company: 'OpenAI',
    icon: Zap,
    color: '#10b981',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    accent: 'text-emerald-400',
    indexingSpeed: 'Real-time',
    citationStyle: 'Inline with source links',
    strengths: ['Conversational retrieval', 'Multi-turn memory', 'Code & structured output'],
    docsUrl: 'https://platform.openai.com/docs',
  },
  {
    id: 'gemini',
    name: 'Gemini AI Overview',
    company: 'Google',
    icon: Globe,
    color: '#3b82f6',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    accent: 'text-blue-400',
    indexingSpeed: 'Hours to days',
    citationStyle: 'Source carousel + inline',
    strengths: ['Knowledge Graph integration', 'Multimodal understanding', 'Real-time indexing'],
    docsUrl: 'https://ai.google.dev/docs',
  },
  {
    id: 'perplexity',
    name: 'Perplexity AI',
    company: 'Perplexity',
    icon: Shield,
    color: '#a855f7',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    accent: 'text-purple-400',
    indexingSpeed: 'Near real-time',
    citationStyle: 'Numbered citations [1][2]',
    strengths: ['Fact density preference', 'Academic sources', 'Real-time search'],
    docsUrl: 'https://docs.perplexity.ai',
  },
]

const STATUS_MAP = {
  operational: {
    label: 'Operational',
    color: 'success',
    icon: CheckCircle2,
    dot: 'bg-emerald-500',
  },
  degraded: { label: 'Degraded', color: 'warning', icon: AlertTriangle, dot: 'bg-amber-500' },
  outage: { label: 'Outage', color: 'danger', icon: XCircle, dot: 'bg-red-500' },
  // Configured and reachable, but the account cannot pay for a call. The key
  // authenticates perfectly — that is exactly why nothing caught this before.
  no_credit: { label: 'No credit', color: 'danger', icon: XCircle, dot: 'bg-red-500' },
  // No API key set for this engine, so it is not being queried at all.
  unconfigured: { label: 'Not configured', color: 'warning', icon: AlertTriangle, dot: 'bg-muted' },
  // Nothing has been read yet. Honest default, and NEVER "operational" — this
  // page used to hardcode `status: 'operational'` and reported Claude as
  // healthy while its balance was empty.
  unknown: { label: 'Checking…', color: 'warning', icon: AlertTriangle, dot: 'bg-muted' },
} as const

type EngineStatus = keyof typeof STATUS_MAP

export interface ProviderHealth {
  id: string
  isConfigured: boolean
  isAvailable: boolean
  lastChecked: string
  model?: string
  creditExhausted: boolean | null
  creditDetail?: string
}

/** Live state for one engine card, derived from /api/providers/health. */
export interface EngineLiveState {
  status: EngineStatus
  model?: string
  lastChecked?: string
  detail?: string
}

/**
 * Order matters: an exhausted balance outranks reachability, because a key in
 * that state passes every liveness probe and then refuses every billed call.
 */
export function deriveStatus(p: ProviderHealth | undefined): EngineLiveState {
  if (!p) return { status: 'unknown' }
  if (!p.isConfigured) return { status: 'unconfigured', lastChecked: p.lastChecked }
  if (p.creditExhausted === true) {
    return {
      status: 'no_credit',
      model: p.model,
      lastChecked: p.lastChecked,
      detail: p.creditDetail,
    }
  }
  if (!p.isAvailable) return { status: 'outage', model: p.model, lastChecked: p.lastChecked }
  return { status: 'operational', model: p.model, lastChecked: p.lastChecked }
}

/** "3 min ago" from a real timestamp, instead of a hardcoded string. */
function relativeTime(iso: string | undefined): string {
  if (!iso) return '—'
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`
}

const OPTIMIZATION_MATRIX = [
  { category: 'Structure', chatgpt: 85, gemini: 90, perplexity: 75 },
  { category: 'Fact Density', chatgpt: 80, gemini: 85, perplexity: 95 },
  { category: 'Entity Coverage', chatgpt: 75, gemini: 95, perplexity: 80 },
  { category: 'Readability', chatgpt: 90, gemini: 85, perplexity: 78 },
  { category: 'Authority Signals', chatgpt: 82, gemini: 88, perplexity: 90 },
]

function EngineCard({ engine, live }: { engine: (typeof ENGINES)[0]; live: EngineLiveState }) {
  const t = useTranslations('monitor')
  const [expanded, setExpanded] = useState(false)
  const status = STATUS_MAP[live.status]
  const signals = getEngineSignals(engine.id)
  const Icon = engine.icon

  return (
    <Card className={cn('border transition-all', engine.border)} interactive>
      <div className="p-6">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl border',
                engine.bg,
                engine.border,
              )}
            >
              <Icon className={cn('h-5 w-5', engine.accent)} />
            </div>
            <div>
              <p className="font-bold text-foreground">{engine.name}</p>
              <p className="text-xs text-muted-foreground">
                {engine.company}
                {live.model ? ` · ${live.model}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('inline-block h-2 w-2 animate-pulse rounded-full', status.dot)} />
            <Badge variant={status.color as 'success' | 'warning' | 'danger'}>{status.label}</Badge>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-input bg-input p-2.5">
            <p className="text-text-secondary-surface text-[10px] font-bold uppercase tracking-wider">
              {t('indexing')}
            </p>
            <p className="text-text-secondary-surface mt-0.5 text-xs font-semibold">
              {engine.indexingSpeed}
            </p>
          </div>
          <div className="rounded-lg border border-input bg-input p-2.5">
            <p className="text-text-secondary-surface text-[10px] font-bold uppercase tracking-wider">
              {t('citations')}
            </p>
            <p className="text-text-secondary-surface mt-0.5 text-xs font-semibold">
              {engine.citationStyle}
            </p>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-text-secondary-surface mb-2 text-[10px] font-black uppercase tracking-widest">
            {t('strengths')}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {engine.strengths.map((s) => (
              <span
                key={s}
                className={cn(
                  'rounded-lg border px-2 py-0.5 text-[10px] font-bold',
                  engine.bg,
                  engine.border,
                  engine.accent,
                )}
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        <button
          className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-left text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? t('hide') : t('show')} {t('optimization_signals')} ({signals.length})
        </button>

        {expanded && (
          <div className="animate-in mt-3 space-y-1.5">
            {signals.map((s, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg bg-secondary px-3 py-2">
                <span className={cn('mt-0.5 text-xs font-black', engine.accent)}>→</span>
                <p className="text-text-secondary-surface text-xs">{s}</p>
              </div>
            ))}
          </div>
        )}

        {live.detail && (
          <p className="border-red-500/20 bg-red-500/5 text-red-300 mt-3 rounded-lg border px-3 py-2 text-[11px]">
            {live.detail}
          </p>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-input pt-3">
          <span className="text-text-secondary-surface text-[10px]">
            {t('checked')} {relativeTime(live.lastChecked)}
          </span>
          <a
            className={cn(
              'flex items-center gap-1 text-[10px] font-bold transition-colors hover:underline',
              engine.accent,
            )}
            href={engine.docsUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            {t('docs')} <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
      </div>
    </Card>
  )
}

export default function MonitorPage() {
  const t = useTranslations('monitor')
  const [refreshing, setRefreshing] = useState(false)
  const [health, setHealth] = useState<ProviderHealth[] | null>(null)

  // This page performed ZERO network requests. Engine status, model names and
  // a literal "2 min ago" were hardcoded, so it reported every engine as
  // operational by construction — including, on 2026-08-07, a Claude key that
  // was returning a billing error on every single call.
  //
  // /api/providers/health already existed and had no consumers.
  const loadHealth = useCallback(async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/providers/health')
      const data = await res.json()
      setHealth(Array.isArray(data?.providers) ? data.providers : [])
    } catch {
      // Leave `health` as-is rather than inventing a status. An empty array
      // means "asked and got nothing"; null means "have not asked yet". Both
      // render as unknown, never as operational.
      setHealth((prev) => prev ?? [])
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadHealth()
  }, [loadHealth])

  const liveByEngine = useMemo(() => {
    const byId = new Map((health ?? []).map((p) => [p.id, p]))
    return new Map(ENGINES.map((e) => [e.id, deriveStatus(byId.get(e.id))]))
  }, [health])

  const states = [...liveByEngine.values()]
  const operationalCount = states.filter((s) => s.status === 'operational').length
  const allOperational = health !== null && operationalCount === ENGINES.length

  return (
    <div className="animate-in space-y-8">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">{t('page_title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('page_subtitle')}</p>
        </div>
        <Button loading={refreshing} size="sm" variant="outline" onClick={() => void loadHealth()}>
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          {t('refresh_status')}
        </Button>
      </div>

      <div
        className={cn(
          'flex items-center gap-3 rounded-2xl border px-5 py-4',
          allOperational
            ? 'border-emerald-500/20 bg-emerald-500/5'
            : 'border-amber-500/20 bg-amber-500/5',
        )}
      >
        <CheckCircle2
          className={cn('h-5 w-5', allOperational ? 'text-emerald-400' : 'text-amber-400')}
        />
        <div>
          <p className={cn('font-bold', allOperational ? 'text-emerald-300' : 'text-amber-300')}>
            {allOperational ? t('all_systems_operational') : t('partial_disruption')}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('engines_operational', {
              operational: operationalCount,
              total: ENGINES.length,
            })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {ENGINES.map((engine) => (
          <EngineCard
            key={engine.id}
            engine={engine}
            live={liveByEngine.get(engine.id) ?? { status: 'unknown' }}
          />
        ))}
      </div>

      <Card className="p-6">
        <h2 className="mb-6 text-lg font-bold text-foreground">{t('content_factor_importance')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-input">
                <th className="pb-3 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {t('factor')}
                </th>
                {ENGINES.map((e) => (
                  <th
                    key={e.id}
                    className={cn(
                      'pb-3 text-center text-[10px] font-black uppercase tracking-widest',
                      e.accent,
                    )}
                  >
                    {e.company}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {OPTIMIZATION_MATRIX.map((row) => (
                <tr key={row.category} className="border-input/50 border-b">
                  <td className="text-text-secondary-surface py-3 font-semibold">{row.category}</td>
                  {[row.chatgpt, row.gemini, row.perplexity].map((score, i) => (
                    <td key={i} className="py-3 text-center">
                      <div className="inline-flex flex-col items-center gap-1">
                        <span
                          className={cn(
                            'text-xs font-bold',
                            score >= 90
                              ? 'text-emerald-400'
                              : score >= 80
                                ? 'text-brand-400'
                                : 'text-muted-foreground',
                          )}
                        >
                          {score}%
                        </span>
                        <div className="bg-input-border h-1 w-12 rounded-full">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              score >= 90
                                ? 'bg-emerald-500'
                                : score >= 80
                                  ? 'bg-primary'
                                  : 'bg-input',
                            )}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
