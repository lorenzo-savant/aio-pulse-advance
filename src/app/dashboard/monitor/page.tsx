'use client'

import { useState } from 'react'
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
    status: 'operational' as const,
    version: 'GPT-4o + SearchGPT',
    indexingSpeed: 'Real-time',
    citationStyle: 'Inline with source links',
    strengths: ['Conversational retrieval', 'Multi-turn memory', 'Code & structured output'],
    lastChecked: '2 min ago',
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
    status: 'operational' as const,
    version: 'Gemini 1.5 Pro',
    indexingSpeed: 'Hours to days',
    citationStyle: 'Source carousel + inline',
    strengths: ['Knowledge Graph integration', 'Multimodal understanding', 'Real-time indexing'],
    lastChecked: '5 min ago',
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
    status: 'operational' as const,
    version: 'Sonar Large (Llama 3.1)',
    indexingSpeed: 'Near real-time',
    citationStyle: 'Numbered citations [1][2]',
    strengths: ['Fact density preference', 'Academic sources', 'Real-time search'],
    lastChecked: '1 min ago',
    docsUrl: 'https://docs.perplexity.ai',
  },
  {
    id: 'claude',
    name: 'Claude AI',
    company: 'Anthropic',
    icon: Brain,
    color: '#f97316',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    accent: 'text-orange-400',
    status: 'operational' as const,
    version: 'Claude 3.5 Sonnet',
    indexingSpeed: 'Context-based',
    citationStyle: 'Integrated synthesis',
    strengths: ['Long-form reasoning', 'Nuanced analysis', 'Safety-first responses'],
    lastChecked: '3 min ago',
    docsUrl: 'https://docs.anthropic.com',
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
} as const

type EngineStatus = keyof typeof STATUS_MAP

const OPTIMIZATION_MATRIX = [
  { category: 'Structure', chatgpt: 85, gemini: 90, perplexity: 75, claude: 70 },
  { category: 'Fact Density', chatgpt: 80, gemini: 85, perplexity: 95, claude: 88 },
  { category: 'Entity Coverage', chatgpt: 75, gemini: 95, perplexity: 80, claude: 72 },
  { category: 'Readability', chatgpt: 90, gemini: 85, perplexity: 78, claude: 92 },
  { category: 'Authority Signals', chatgpt: 82, gemini: 88, perplexity: 90, claude: 78 },
]

function EngineCard({ engine }: { engine: (typeof ENGINES)[0] }) {
  const t = useTranslations('monitor')
  const [expanded, setExpanded] = useState(false)
  const status = STATUS_MAP[engine.status as EngineStatus]
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
                {engine.company} · {engine.version}
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

        <div className="mt-4 flex items-center justify-between border-t border-input pt-3">
          <span className="text-text-secondary-surface text-[10px]">
            {t('checked')} {engine.lastChecked}
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
  const tc = useTranslations('common')
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = () => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 1500)
  }

  const allOperational = ENGINES.every((e) => e.status === 'operational')

  return (
    <div className="animate-in space-y-8">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">{t('page_title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('page_subtitle')}</p>
        </div>
        <Button loading={refreshing} size="sm" variant="outline" onClick={handleRefresh}>
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
              operational: ENGINES.filter((e) => e.status === 'operational').length,
              total: ENGINES.length,
            })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {ENGINES.map((engine) => (
          <EngineCard key={engine.id} engine={engine} />
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
                  {[row.chatgpt, row.gemini, row.perplexity, row.claude].map((score, i) => (
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
