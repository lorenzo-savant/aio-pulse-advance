// PATH: src/app/dashboard/advisor/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Sparkles,
  Send,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Target,
  Gauge,
  Lightbulb,
  ListChecks,
  Quote,
  Plus,
  Check,
  Layers,
  History,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/index'
import { cn } from '@/lib/utils'
import type { WorkOrder, WorkOrderStatus } from '@/types'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Brand {
  id: string
  name: string
  color: string
  domain?: string | null
  language?: string | null
}

interface Recommendation {
  title: string
  rationale: string
  category?: string
  impact: 'high' | 'medium' | 'low'
  effort: 'high' | 'medium' | 'low'
  actions: string[]
  sources: string[]
}

interface NewPrompt {
  text: string
  intentBucket: string
  priority: 'high' | 'medium' | 'low'
}

interface Strategy {
  summary: string
  recommendations: Recommendation[]
  newPrompts?: NewPrompt[]
  confidence: number
}

// The advisor returns the full context it reasoned over. We don't validate
// every field client-side — just render the parts we want to surface.
interface AdvisorContext {
  brand: {
    id: string
    name: string
    domain: string | null
    language: string | null
    industry: string | null
  }
  health: {
    date: string | null
    aviScore: number
    citationRate: number
    mentionRate: number
    recommendationRate: number
    sentimentScore: number
    positionAvg: number
    hallucinationRate: number
  } | null
  weekDelta: { aviDelta: number; citationRateDelta: number } | null
  monitoring: { last7Days: number; perEngineLast7Days: Record<string, number> }
  prompts: { active: number; byLanguage: Record<string, number> }
  aeo: { total: number; gap: number; covered: number } | null
  siteAudit: { score: number; grade: string; url: string; hasLlmsTxt: boolean | null } | null
}

interface AdvisorResponse {
  context: AdvisorContext
  strategy: Strategy
  provider: string
  model: string
}

interface HistoryEntry {
  id: string
  summary: string
  confidence: number
  created_at: string
  question: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const IMPACT_COLOR: Record<Recommendation['impact'], string> = {
  high: 'success',
  medium: 'warning',
  low: 'default',
}

// Effort is inverted: low effort is good (green), high effort is bad (red).
const EFFORT_COLOR: Record<Recommendation['effort'], string> = {
  low: 'success',
  medium: 'warning',
  high: 'danger',
}

function formatConfidence(n: number): { label: string; tone: string } {
  if (n >= 0.7) return { label: `${Math.round(n * 100)}% confidence`, tone: 'text-emerald-400' }
  if (n >= 0.4) return { label: `${Math.round(n * 100)}% confidence`, tone: 'text-amber-400' }
  return { label: `${Math.round(n * 100)}% confidence (sparse data)`, tone: 'text-red-400' }
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AdvisorPage() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null)
  const [language, setLanguage] = useState<'en' | 'it' | 'sv'>('en')
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AdvisorResponse | null>(null)
  const [showContext, setShowContext] = useState(false)
  const [creatingPrompts, setCreatingPrompts] = useState<Set<string>>(new Set())
  const [createdPrompts, setCreatedPrompts] = useState<Set<string>>(new Set())
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [creatingWO, setCreatingWO] = useState<Set<string>>(new Set())

  const loadWorkOrders = useCallback(async (brandId: string) => {
    try {
      const res = await fetch(`/api/work-orders?brand_id=${brandId}`)
      const json = await res.json()
      if (json.success) setWorkOrders(json.data as WorkOrder[])
    } catch {
      /* silent */
    }
  }, [])

  const createWorkOrder = async (rec: Recommendation) => {
    if (!selectedBrand || creatingWO.has(rec.title)) return
    setCreatingWO((s) => new Set(s).add(rec.title))
    try {
      const res = await fetch('/api/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: selectedBrand.id,
          title: rec.title,
          category: rec.category,
          impact: rec.impact,
          effort: rec.effort,
          rationale: rec.rationale,
          actions: rec.actions,
          source: 'advisor',
        }),
      })
      const json = await res.json()
      if (json.success) setWorkOrders((w) => [json.data as WorkOrder, ...w])
    } catch {
      /* silent */
    } finally {
      setCreatingWO((s) => {
        const next = new Set(s)
        next.delete(rec.title)
        return next
      })
    }
  }

  const updateWorkOrderStatus = async (id: string, status: WorkOrderStatus) => {
    try {
      const res = await fetch('/api/work-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      const json = await res.json()
      if (json.success) {
        setWorkOrders((w) => w.map((wo) => (wo.id === id ? (json.data as WorkOrder) : wo)))
      }
    } catch {
      /* silent */
    }
  }

  const loadHistory = useCallback(async (brandId: string) => {
    setHistoryLoading(true)
    try {
      const res = await fetch(`/api/advisor?brand_id=${brandId}&limit=10`)
      const json = await res.json()
      if (json.success) setHistory(json.data)
    } catch {
      /* silent */
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  const createPrompt = async (p: NewPrompt) => {
    if (!selectedBrand || createdPrompts.has(p.text)) return
    setCreatingPrompts((s) => new Set(s).add(p.text))
    try {
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: selectedBrand.id,
          text: p.text,
          language: result?.context?.brand?.language || 'en',
        }),
      })
      if (res.ok) {
        setCreatedPrompts((s) => new Set(s).add(p.text))
      }
    } catch {
      /* silent */
    } finally {
      setCreatingPrompts((s) => {
        const next = new Set(s)
        next.delete(p.text)
        return next
      })
    }
  }

  // Picks a starting language for the selector: the brand's own language when
  // it's one we support, else English.
  const langForBrand = (b: Brand | null): 'en' | 'it' | 'sv' =>
    b?.language === 'it' || b?.language === 'sv' ? b.language : 'en'

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/brands')
        const json = await res.json()
        const list = json.data || json || []
        setBrands(list)
        if (list.length > 0) {
          setSelectedBrand(list[0])
          setLanguage(langForBrand(list[0]))
          loadHistory(list[0].id)
        }
      } catch {
        setError('Failed to load brands')
      }
    })()
  }, [loadHistory])

  // Load work orders whenever the selected brand changes (initial + switches).
  useEffect(() => {
    if (selectedBrand) loadWorkOrders(selectedBrand.id)
  }, [selectedBrand, loadWorkOrders])

  const ask = async () => {
    if (!selectedBrand) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const body: { brand_id: string; question?: string; language: 'en' | 'it' | 'sv' } = {
        brand_id: selectedBrand.id,
        language,
      }
      if (question.trim().length > 0) body.question = question.trim()
      const res = await fetch('/api/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setError(json.message || `API error: ${res.status}`)
        return
      }
      setResult(json.data)
      loadHistory(selectedBrand.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to call advisor')
    } finally {
      setLoading(false)
    }
  }

  const confidence = result ? formatConfidence(result.strategy.confidence) : null

  return (
    <div className="animate-in space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-black tracking-tight text-foreground">
            <Sparkles className="h-7 w-7 text-primary" />
            Strategy Advisor
          </h1>
          <p className="mt-1 text-muted-foreground">
            Asks an LLM (Groq → Gemini → OpenAI fallback) for prioritised actions, grounded in this
            brand&rsquo;s live data: AVI delta, monitoring, prompts, AEO gaps, and the cached
            site-readiness audit.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          {/* Brand selector — always visible so the focus is explicit */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Brand
            </label>
            <select
              className="min-w-[180px] rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none disabled:opacity-50"
              value={selectedBrand?.id || ''}
              disabled={brands.length === 0}
              onChange={(e) => {
                const b = brands.find((x) => x.id === e.target.value)
                if (b) {
                  setSelectedBrand(b)
                  setLanguage(langForBrand(b))
                  loadHistory(b.id)
                }
              }}
            >
              {brands.length === 0 && <option value="">No brands yet</option>}
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Advice language — defaults to the brand's language, overridable */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Advice language
            </label>
            <select
              className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'en' | 'it' | 'sv')}
            >
              <option value="en">🇬🇧 English</option>
              <option value="it">🇮🇹 Italiano</option>
              <option value="sv">🇸🇪 Svenska</option>
            </select>
          </div>
        </div>
      </div>

      {/* Question input */}
      <Card className="p-6">
        <label className="mb-2 block text-sm font-medium text-foreground">
          What do you want to know for {selectedBrand?.name || 'this brand'}?
        </label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder='Leave blank for: "What are the most important things to do this week for this brand? Rank by impact × effort."'
          rows={3}
          className="w-full resize-none rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Output is structured: 1–3 ranked recommendations with rationale, actions, and the
            specific data facts they&rsquo;re grounded in.
          </p>
          <Button size="sm" variant="primary" onClick={ask} disabled={loading || !selectedBrand}>
            {loading ? (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="mr-1.5 h-3.5 w-3.5" />
            )}
            {loading ? 'Thinking…' : 'Ask'}
          </Button>
        </div>
      </Card>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-900/50 bg-red-900/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">{error}</p>
            {error.toLowerCase().includes('no llm provider') && (
              <p className="mt-1 text-xs text-red-400/80">
                Set <code className="rounded bg-red-900/20 px-1 py-0.5">GROQ_API_KEY</code> in
                .env.local (free at console.groq.com/keys) and restart the dev server.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <>
          {/* Summary + provider */}
          <Card className="p-6">
            <div className="mb-3 flex items-center gap-2">
              <Badge variant="brand">{result.provider}</Badge>
              <span className="text-xs text-muted-foreground">{result.model}</span>
              {confidence && (
                <span className={cn('ml-auto text-xs font-semibold', confidence.tone)}>
                  {confidence.label}
                </span>
              )}
            </div>
            <p className="text-sm leading-relaxed text-foreground">{result.strategy.summary}</p>
          </Card>

          {/* Recommendations */}
          <div className="space-y-4">
            {result.strategy.recommendations.map((rec, idx) => (
              <Card key={idx} className="p-6">
                <div className="mb-3 flex items-start gap-3">
                  <span className="bg-primary/15 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-black text-primary">
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold leading-tight text-foreground">{rec.title}</h3>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge
                        variant={IMPACT_COLOR[rec.impact] as 'success' | 'warning' | 'default'}
                      >
                        <Target className="mr-1 h-3 w-3" />
                        Impact: {rec.impact}
                      </Badge>
                      <Badge variant={EFFORT_COLOR[rec.effort] as 'success' | 'warning' | 'danger'}>
                        <Gauge className="mr-1 h-3 w-3" />
                        Effort: {rec.effort}
                      </Badge>
                    </div>
                  </div>
                </div>

                <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                  {rec.rationale}
                </p>

                {rec.actions.length > 0 && (
                  <div className="mb-4">
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      <ListChecks className="h-3.5 w-3.5" /> Actions
                    </div>
                    <ul className="space-y-1.5">
                      {rec.actions.map((a, i) => (
                        <li key={i} className="flex gap-2 text-sm leading-relaxed text-foreground">
                          <span className="select-none text-primary">•</span>
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {rec.sources.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      <Quote className="h-3.5 w-3.5" /> Based on
                    </div>
                    <ul className="space-y-1">
                      {rec.sources.map((s, i) => (
                        <li key={i} className="text-xs italic text-muted-foreground">
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(() => {
                  const tracked = workOrders.some((w) => w.title === rec.title)
                  const isCreating = creatingWO.has(rec.title)
                  return (
                    <div className="mt-4 border-t border-border pt-3">
                      <Button
                        size="sm"
                        variant={tracked ? 'ghost' : 'outline'}
                        disabled={tracked || isCreating}
                        onClick={() => createWorkOrder(rec)}
                      >
                        {tracked ? (
                          <>
                            <Check className="mr-1.5 h-3.5 w-3.5" /> Tracked as work order
                          </>
                        ) : (
                          <>
                            <ListChecks className="mr-1.5 h-3.5 w-3.5" />{' '}
                            {isCreating ? 'Adding…' : 'Create work order'}
                          </>
                        )}
                      </Button>
                    </div>
                  )
                })()}
              </Card>
            ))}
          </div>

          {/* Suggested New Prompts — actionable, one-click create */}
          {result.strategy.newPrompts && result.strategy.newPrompts.length > 0 && (
            <Card className="p-6">
              <div className="mb-4 flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">Suggested New Prompts</h2>
                <span className="ml-auto text-xs text-muted-foreground">
                  Based on {result.context.brand.industry || 'industry'} patterns
                </span>
              </div>
              <div className="space-y-3">
                {result.strategy.newPrompts.map((p, idx) => {
                  const isCreating = creatingPrompts.has(p.text)
                  const isCreated = createdPrompts.has(p.text)
                  return (
                    <div
                      key={idx}
                      className="bg-secondary/30 flex items-start gap-3 rounded-lg border border-border px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{p.text}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge
                            variant={
                              p.priority === 'high'
                                ? 'success'
                                : p.priority === 'medium'
                                  ? 'warning'
                                  : 'default'
                            }
                          >
                            {p.priority}
                          </Badge>
                          <Badge variant="brand">{p.intentBucket}</Badge>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={isCreated ? 'ghost' : 'primary'}
                        disabled={isCreating || isCreated}
                        onClick={() => createPrompt(p)}
                        className="shrink-0"
                      >
                        {isCreating ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : isCreated ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Plus className="h-3.5 w-3.5" />
                        )}
                        {isCreating ? 'Creating…' : isCreated ? 'Created' : 'Create'}
                      </Button>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {/* History panel — previous recommendations, helps track what was advised */}
          <Card className="p-6">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-bold text-foreground">Previous Recommendations</h2>
            </div>
            {historyLoading ? (
              <p className="mt-3 text-sm text-muted-foreground">Loading history…</p>
            ) : history.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No previous recommendations yet. Run the advisor to get started.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {history.map((entry) => (
                  <div
                    key={entry.id}
                    className="bg-secondary/20 flex items-start gap-3 rounded-lg border border-border px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm text-foreground">{entry.summary}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{new Date(entry.created_at).toLocaleDateString()}</span>
                        {entry.question && <span>· Q: {entry.question}</span>}
                        <span>· {Math.round(entry.confidence * 100)}% confidence</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Context panel — collapsed by default, transparency for debugging */}
          <Card className="p-6">
            <button
              onClick={() => setShowContext((v) => !v)}
              className="flex w-full items-center gap-2 text-sm font-bold text-foreground transition-colors hover:text-primary"
            >
              {showContext ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <Lightbulb className="h-4 w-4 text-muted-foreground" />
              <span>Context the strategist saw</span>
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {result.context.monitoring.last7Days} monitoring runs ·{' '}
                {result.context.prompts.active} active prompts · {result.context.aeo?.total ?? 0}{' '}
                AEO snippets
              </span>
            </button>
            {showContext && (
              <pre className="bg-secondary/40 mt-4 max-h-96 overflow-auto rounded-lg border border-border p-4 text-xs leading-relaxed text-muted-foreground">
                {JSON.stringify(result.context, null, 2)}
              </pre>
            )}
          </Card>
        </>
      )}

      {/* Work Orders — persists across visits (closes the advisor loop):
          create from a recommendation, mark done, and we re-check the GEO
          score to attribute movement. Shows whenever any exist for the brand. */}
      {workOrders.length > 0 && (
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Work Orders</h2>
            <span className="ml-auto text-xs text-muted-foreground">
              Track actions → re-verify GEO impact
            </span>
          </div>
          <div className="space-y-2">
            {workOrders.map((wo) => (
              <div
                key={wo.id}
                className="bg-secondary/30 flex items-start gap-3 rounded-lg border border-border px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'text-sm font-medium',
                      wo.status === 'done'
                        ? 'text-muted-foreground line-through'
                        : wo.status === 'dismissed'
                          ? 'text-muted-foreground'
                          : 'text-foreground',
                    )}
                  >
                    {wo.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    {wo.category && <Badge variant="default">{wo.category}</Badge>}
                    {wo.impact && <span>impact {wo.impact}</span>}
                    {wo.status === 'done' && wo.recheck_delta != null && (
                      <span
                        className={cn(
                          'font-bold',
                          wo.recheck_delta > 0
                            ? 'text-emerald-400'
                            : wo.recheck_delta < 0
                              ? 'text-red-400'
                              : 'text-muted-foreground',
                        )}
                      >
                        GEO {wo.recheck_delta > 0 ? '+' : ''}
                        {wo.recheck_delta} since created
                      </span>
                    )}
                  </div>
                </div>
                <select
                  value={wo.status}
                  onChange={(e) => updateWorkOrderStatus(wo.id, e.target.value as WorkOrderStatus)}
                  className="shrink-0 rounded-lg border border-input bg-input px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In progress</option>
                  <option value="done">Done</option>
                  <option value="dismissed">Dismissed</option>
                </select>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
