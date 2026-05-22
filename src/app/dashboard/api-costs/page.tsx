// PATH: src/app/dashboard/api-costs/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw,
  AlertCircle,
  Loader2,
  Search,
  Bot,
  Coins,
  TrendingUp,
  ExternalLink,
  Download,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHelp } from '@/components/help/SectionHelp'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

// ─── Types (mirror /api/api-costs response) ────────────────────────────────

interface SerpProvider {
  provider: 'brave' | 'dataforseo' | 'serpapi'
  configured: boolean
  calls: number
  costCents: number
  costUsd: number
  capCents: number | null
  capCalls: number | null
  utilization: number
  label: string
}

interface AiProvider {
  provider: string
  configured: boolean
  calls: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costCents: number
  costUsd: number
}

interface Credits {
  purchased: number
  used: number
  balance: number
  earliestExpiry: string | null
}

interface ApiCostOverview {
  month: string
  totalSpendCents: number
  totalSpendUsd: number
  serp: { providers: SerpProvider[]; totalCostCents: number; totalCostUsd: number }
  ai: { providers: AiProvider[]; totalCostCents: number; totalCostUsd: number }
  credits: Credits
}

type Granularity = 'day' | 'week' | 'month'
type ExportFormat = 'csv' | 'xlsx' | 'pdf'

// ─── Helpers ───────────────────────────────────────────────────────────────

function dollars(cents: number): string {
  if (cents === 0) return '$0.00'
  return `$${(cents / 100).toFixed(2)}`
}

// Full-precision dollars so accumulating sub-cent AI costs stay visible:
// 4 decimals under $1 (e.g. $0.0123), 2 decimals above.
function dollarsPrecise(usd: number): string {
  if (usd === 0) return '$0.00'
  if (Math.abs(usd) < 1) return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(2)}`
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function utilColor(util: number): string {
  if (util >= 0.95) return 'bg-red-500'
  if (util >= 0.8) return 'bg-amber-500'
  if (util >= 0.5) return 'bg-emerald-500'
  return 'bg-emerald-500/60'
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

// Pretty labels + docs links for the AI providers we know about.
const AI_PROVIDER_META: Record<string, { label: string; docs: string }> = {
  gemini: { label: 'Google Gemini', docs: 'https://ai.google.dev/pricing' },
  openai: { label: 'OpenAI', docs: 'https://openai.com/pricing' },
  chatgpt: { label: 'OpenAI (ChatGPT)', docs: 'https://openai.com/pricing' },
  anthropic: { label: 'Anthropic Claude', docs: 'https://www.anthropic.com/pricing' },
  claude: { label: 'Anthropic Claude', docs: 'https://www.anthropic.com/pricing' },
  groq: { label: 'Groq', docs: 'https://console.groq.com/docs/pricing' },
  perplexity: { label: 'Perplexity', docs: 'https://docs.perplexity.ai/guides/pricing' },
}

const SERP_PROVIDER_META: Record<SerpProvider['provider'], { label: string; docs: string }> = {
  brave: {
    label: 'Brave Search',
    docs: 'https://api.search.brave.com/app/dashboard',
  },
  dataforseo: {
    label: 'DataForSEO',
    docs: 'https://app.dataforseo.com/api-dashboard',
  },
  serpapi: {
    label: 'SerpApi (legacy)',
    docs: 'https://serpapi.com/dashboard',
  },
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function ApiCostsPage() {
  const [data, setData] = useState<ApiCostOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Export controls (by date range + granularity + format).
  const [granularity, setGranularity] = useState<Granularity>('day')
  const [from, setFrom] = useState(() => isoDate(new Date(Date.now() - 30 * 86400000)))
  const [to, setTo] = useState(() => isoDate(new Date()))

  const exportCosts = useCallback(
    (format: ExportFormat) => {
      const p = new URLSearchParams({ format, granularity })
      if (from) p.set('from', from)
      if (to) p.set('to', `${to}T23:59:59.999Z`) // inclusive end-of-day
      const url = `/api/api-costs/export?${p.toString()}`
      if (format === 'pdf') {
        window.open(url, '_blank', 'noopener') // renders + auto-prints
        return
      }
      // CSV / Excel: server sets Content-Disposition; an anchor click downloads
      // without navigating away.
      const a = document.createElement('a')
      a.href = url
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
    },
    [granularity, from, to],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/api-costs')
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.message || `HTTP ${res.status}`)
      }
      setData(json.data as ApiCostOverview)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load API costs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="animate-in space-y-8">
      <SectionHelp section="api-costs" />
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-black tracking-tight text-foreground">
            <TrendingUp className="h-7 w-7 text-brand" />
            API Costs & Usage
          </h1>
          <p className="mt-1 text-muted-foreground">
            Month-to-date spend across every paid API surface — SERP providers, AI providers, and
            your credit ledger. Refreshed live from each provider&rsquo;s usage table.
          </p>
        </div>
        <Button variant="ghost" onClick={load} disabled={loading}>
          {loading ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          )}
          Refresh
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <Card className="flex items-start gap-2 border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">{error}</p>
          </div>
        </Card>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
        </div>
      )}

      {data && (
        <>
          {/* Top summary */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="p-6">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Total Spend ({data.month})
              </p>
              <p className="mt-2 text-4xl font-black text-foreground">
                {dollarsPrecise(data.totalSpendUsd)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                SERP + AI providers, current month
              </p>
            </Card>
            <Card className="p-6">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                SERP Providers
              </p>
              <p className="mt-2 text-4xl font-black text-foreground">
                {dollars(data.serp.totalCostCents)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Brave, DataForSEO
                {data.serp.providers.find((p) => p.provider === 'serpapi')
                  ? ', SerpApi (legacy)'
                  : ''}
              </p>
            </Card>
            <Card className="p-6">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                AI Providers
              </p>
              <p className="mt-2 text-4xl font-black text-foreground">
                {dollarsPrecise(data.ai.totalCostUsd)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {data.ai.providers.filter((p) => p.configured).length} of {data.ai.providers.length}{' '}
                keys configured
              </p>
            </Card>
          </div>

          {/* Export breakdown (by date range, granularity & format) */}
          <Card className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <Download className="h-4 w-4 text-brand" />
              <h2 className="text-lg font-bold text-foreground">Export cost breakdown</h2>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              Per-period × provider AI spend at full decimal precision, for the range below. CSV and
              Excel download; PDF opens a print-ready view. Excel keeps the cost column as a real
              number.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Granularity
                <select
                  value={granularity}
                  onChange={(e) => setGranularity(e.target.value as Granularity)}
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                >
                  <option value="day">Daily</option>
                  <option value="week">Weekly</option>
                  <option value="month">Monthly</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                From
                <input
                  type="date"
                  value={from}
                  max={to}
                  onChange={(e) => setFrom(e.target.value)}
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                To
                <input
                  type="date"
                  value={to}
                  min={from}
                  onChange={(e) => setTo(e.target.value)}
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
              </label>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => exportCosts('csv')}>
                  <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
                </Button>
                <Button variant="outline" onClick={() => exportCosts('xlsx')}>
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Excel
                </Button>
                <Button variant="outline" onClick={() => exportCosts('pdf')}>
                  <Download className="mr-1.5 h-3.5 w-3.5" /> PDF
                </Button>
              </div>
            </div>
          </Card>

          {/* SERP detail */}
          <Card className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <Search className="h-4 w-4 text-brand" />
              <h2 className="text-lg font-bold text-foreground">SERP API Usage</h2>
            </div>
            <div className="space-y-4">
              {data.serp.providers.map((p) => {
                const meta = SERP_PROVIDER_META[p.provider]
                const utilPct = Math.round(p.utilization * 100)
                return (
                  <div key={p.provider} className="space-y-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <div>
                        <a
                          href={meta.docs}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-semibold text-foreground hover:text-brand"
                        >
                          {meta.label}
                          <ExternalLink className="ml-1 inline h-3 w-3" />
                        </a>
                        <span
                          className={cn(
                            'ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                            p.configured
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {p.configured ? 'configured' : 'not configured'}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground">
                          {p.costCents > 0 ? dollars(p.costCents) : 'Free tier'}
                          {p.capCents && p.costCents > 0 && (
                            <span className="text-muted-foreground"> / {dollars(p.capCents)}</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatNumber(p.calls)} call{p.calls === 1 ? '' : 's'}
                          {p.capCalls && <span> / {formatNumber(p.capCalls)} limit</span>}
                        </p>
                      </div>
                    </div>
                    {(p.capCalls || p.capCents) && p.configured && (
                      <div className="bg-secondary/60 h-2 overflow-hidden rounded-full">
                        <div
                          className={cn(
                            'h-full transition-all duration-500',
                            utilColor(p.utilization),
                          )}
                          style={{ width: `${Math.min(utilPct, 100)}%` }}
                        />
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">{p.label}</p>
                  </div>
                )
              })}
              {data.serp.providers.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No SERP providers configured. Set{' '}
                  <code className="rounded bg-secondary px-1">BRAVE_API_KEYS</code> or{' '}
                  <code className="rounded bg-secondary px-1">DATAFORSEO_LOGIN</code>+
                  <code className="rounded bg-secondary px-1">DATAFORSEO_KEY</code> in your env.
                </p>
              )}
            </div>
          </Card>

          {/* AI detail */}
          <Card className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <Bot className="h-4 w-4 text-brand" />
              <h2 className="text-lg font-bold text-foreground">AI Provider Usage</h2>
            </div>
            {data.ai.totalCostUsd === 0 && (
              <p className="mb-4 text-sm text-muted-foreground">
                No AI spend logged this month yet — providers below show their configured status.
                Costs are recorded in{' '}
                <code className="rounded bg-secondary px-1">ai_cost_logs</code> when monitoring runs
                or advisor calls hit a provider.
              </p>
            )}
            {data.ai.providers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No AI providers known.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="pb-2 pr-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Provider
                      </th>
                      <th className="pb-2 pr-4 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Calls
                      </th>
                      <th className="pb-2 pr-4 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Input tokens
                      </th>
                      <th className="pb-2 pr-4 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Output tokens
                      </th>
                      <th className="pb-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Cost
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ai.providers.map((p) => {
                      const meta = AI_PROVIDER_META[p.provider] ?? {
                        label: p.provider,
                        docs: '',
                      }
                      return (
                        <tr key={p.provider} className="border-border/50 border-b">
                          <td className="py-3 pr-4">
                            {meta.docs ? (
                              <a
                                href={meta.docs}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-foreground hover:text-brand"
                              >
                                {meta.label}
                                <ExternalLink className="ml-1 inline h-3 w-3" />
                              </a>
                            ) : (
                              <span className="font-semibold text-foreground">{meta.label}</span>
                            )}
                            <span
                              className={cn(
                                'ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                                p.configured
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : 'bg-muted text-muted-foreground',
                              )}
                            >
                              {p.configured ? 'configured' : 'not configured'}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-right text-foreground">
                            {formatNumber(p.calls)}
                          </td>
                          <td className="py-3 pr-4 text-right text-muted-foreground">
                            {formatNumber(p.inputTokens)}
                          </td>
                          <td className="py-3 pr-4 text-right text-muted-foreground">
                            {formatNumber(p.outputTokens)}
                          </td>
                          <td className="py-3 text-right font-bold text-foreground">
                            {dollarsPrecise(p.costUsd)}
                          </td>
                        </tr>
                      )
                    })}
                    <tr className="font-bold">
                      <td className="py-3 pr-4 text-foreground">Total</td>
                      <td className="py-3 pr-4 text-right text-foreground">
                        {formatNumber(data.ai.providers.reduce((s, p) => s + p.calls, 0))}
                      </td>
                      <td className="py-3 pr-4 text-right text-muted-foreground">—</td>
                      <td className="py-3 pr-4 text-right text-muted-foreground">—</td>
                      <td className="py-3 text-right text-foreground">
                        {dollarsPrecise(data.ai.totalCostUsd)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Credits */}
          <Card className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <Coins className="h-4 w-4 text-brand" />
              <h2 className="text-lg font-bold text-foreground">Credits Ledger</h2>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Purchased
                </p>
                <p className="mt-1 text-2xl font-bold text-foreground">
                  {formatNumber(data.credits.purchased)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Used
                </p>
                <p className="mt-1 text-2xl font-bold text-foreground">
                  {formatNumber(data.credits.used)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Balance
                </p>
                <p
                  className={cn(
                    'mt-1 text-2xl font-bold',
                    data.credits.balance <= 0
                      ? 'text-red-400'
                      : data.credits.balance < 100
                        ? 'text-amber-400'
                        : 'text-emerald-400',
                  )}
                >
                  {formatNumber(data.credits.balance)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Earliest expiry
                </p>
                <p className="mt-1 text-sm font-bold text-foreground">
                  {data.credits.earliestExpiry
                    ? new Date(data.credits.earliestExpiry).toLocaleDateString()
                    : '—'}
                </p>
              </div>
            </div>
            {data.credits.balance <= 0 && data.credits.purchased > 0 && (
              <p className="mt-4 text-xs text-amber-400">
                ⚠ All credits used. Top up from the{' '}
                <a href="/dashboard/credits" className="underline">
                  Credits page
                </a>
                .
              </p>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
