'use client'

// "AI Crawler Access Audit" panel — fetches the brand's robots.txt and
// reports which AI crawlers can actually reach it. Foundational health
// check: if GPTBot is blocked, nothing else AEO Pulse measures about
// ChatGPT visibility is meaningful. See lib/services/crawler-access-audit.ts
// for the bot list + parser + rationale.

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import {
  Bot,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ExternalLink,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type AccessVerdict =
  | 'allowed'
  | 'wildcard_blocked'
  | 'explicitly_blocked'
  | 'restricted'
  | 'unknown'

interface AiBot {
  id: string
  label: string
  engine: string
  docs: string
}

interface BotVerdict {
  bot: AiBot
  verdict: AccessVerdict
  disallowPaths: string[]
  allowPaths: string[]
  matchedGroup: 'specific' | 'wildcard' | 'none'
}

interface AuditSummary {
  totalBots: number
  blocked: number
  restricted: number
  allowed: number
  blockedEngines: string[]
}

interface AuditData {
  domain: string
  robotsUrl: string
  robotsExists: boolean
  statusCode: number
  content: string | null
  contentTruncated?: boolean
  sitemaps: string[]
  verdicts: BotVerdict[]
  summary: AuditSummary
  note?: string
}

interface BrandLite {
  id: string
  name: string
}

const VERDICT_META: Record<
  AccessVerdict,
  { label: string; color: string; bg: string; icon: typeof CheckCircle2 }
> = {
  allowed: {
    label: 'Allowed',
    color: 'text-emerald-300',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    icon: CheckCircle2,
  },
  explicitly_blocked: {
    label: 'Explicitly blocked',
    color: 'text-rose-300',
    bg: 'bg-rose-500/10 border-rose-500/40',
    icon: XCircle,
  },
  wildcard_blocked: {
    label: 'Blocked via *',
    color: 'text-rose-300',
    bg: 'bg-rose-500/10 border-rose-500/40',
    icon: XCircle,
  },
  restricted: {
    label: 'Restricted (subpaths)',
    color: 'text-amber-300',
    bg: 'bg-amber-500/10 border-amber-500/30',
    icon: AlertTriangle,
  },
  unknown: {
    label: 'Unknown',
    color: 'text-muted-foreground',
    bg: 'bg-secondary/40 border-border',
    icon: AlertTriangle,
  },
}

export function CrawlerAccessPanel({ brandId: brandIdProp }: { brandId?: string } = {}) {
  const [brands, setBrands] = useState<BrandLite[]>([])
  const [activeBrandId, setActiveBrandId] = useState<string>(brandIdProp ?? '')
  const [data, setData] = useState<AuditData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showRobots, setShowRobots] = useState(false)

  useEffect(() => {
    if (brandIdProp) setActiveBrandId(brandIdProp)
  }, [brandIdProp])

  useEffect(() => {
    if (brandIdProp) return
    let cancelled = false
    fetch('/api/brands')
      .then((r) => r.json() as Promise<{ data?: BrandLite[] }>)
      .then((j) => {
        if (cancelled) return
        const list = j.data ?? []
        setBrands(list)
        if (!activeBrandId && list[0]) setActiveBrandId(list[0].id)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandIdProp])

  async function runAudit() {
    if (!activeBrandId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/brands/${activeBrandId}/crawler-audit`)
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.message || 'Audit failed')
      setData(j.data as AuditData)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Audit failed')
    } finally {
      setLoading(false)
    }
  }

  // Run automatically on first brand-id resolution; subsequent re-runs
  // require the explicit button (fetches the brand's own site).
  useEffect(() => {
    if (activeBrandId && !data) void runAudit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBrandId])

  const verdicts = data?.verdicts ?? []
  const summary = data?.summary
  const hasBlockedEngines = summary && summary.blocked > 0

  return (
    <Card className="p-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-brand" />
          <h2 className="text-lg font-bold text-foreground">AI Crawler Access</h2>
        </div>
        <div className="flex items-center gap-2">
          {brands.length > 1 && !brandIdProp && (
            <select
              value={activeBrandId}
              onChange={(e) => setActiveBrandId(e.target.value)}
              className="rounded-md border border-border bg-background px-2.5 py-1 text-xs text-foreground"
            >
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
          <Button
            onClick={runAudit}
            disabled={loading || !activeBrandId}
            size="sm"
            variant="outline"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {loading ? 'Auditing…' : 'Re-audit'}
          </Button>
        </div>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        Fetches your <code className="text-foreground">robots.txt</code> and checks which AI
        crawlers can actually reach the site. If GPTBot / PerplexityBot / ClaudeBot are blocked, the
        brand is structurally invisible to those engines — every other AEO Pulse metric for that
        engine is capped.
      </p>

      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !data && (
        <div className="text-sm text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          Fetching robots.txt…
        </div>
      )}

      {data && summary && (
        <>
          {/* Headline */}
          {hasBlockedEngines ? (
            <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm">
              <p className="font-bold text-rose-300">
                {summary.blocked} of {summary.totalBots} AI crawlers blocked
              </p>
              <p className="mt-1 text-rose-200/90">
                Engines impacted: {summary.blockedEngines.join(', ')}. AEO Pulse cannot accurately
                measure visibility for these engines while the block is active.
              </p>
            </div>
          ) : summary.restricted > 0 ? (
            <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
              <p className="font-bold text-amber-300">
                All {summary.totalBots} AI crawlers can reach the root
              </p>
              <p className="mt-1 text-amber-200/90">
                {summary.restricted} crawler(s) have subpath restrictions — root pages are citeable,
                but specific sections (e.g. /admin) won't be.
              </p>
            </div>
          ) : (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-300">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                All {summary.totalBots} AI crawlers are allowed.{' '}
                {data.note ?? `Fetched ${data.robotsUrl}.`}
              </span>
            </div>
          )}

          {/* Per-bot list */}
          <div className="mb-4 space-y-1.5">
            {verdicts.map((v) => {
              const meta = VERDICT_META[v.verdict]
              const Icon = meta.icon
              return (
                <div
                  key={v.bot.id}
                  className={cn('flex items-start gap-2 rounded-lg border px-3 py-2', meta.bg)}
                >
                  <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', meta.color)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">{v.bot.label}</span>
                        <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                          {v.bot.engine}
                        </span>
                        {v.bot.docs && (
                          <a
                            href={v.bot.docs}
                            target="_blank"
                            rel="noreferrer"
                            className="text-muted-foreground hover:text-brand"
                            title="Bot documentation"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      <span
                        className={cn('text-xs font-bold uppercase tracking-wider', meta.color)}
                      >
                        {meta.label}
                      </span>
                    </div>
                    {v.disallowPaths.length > 0 && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Disallow:{' '}
                        {v.disallowPaths.slice(0, 3).map((p, i) => (
                          <span key={i}>
                            <code className="rounded bg-secondary px-1 py-0.5 text-[10px] text-foreground">
                              {p || '(empty)'}
                            </code>
                            {i < Math.min(2, v.disallowPaths.length - 1) ? ' · ' : ''}
                          </span>
                        ))}
                        {v.disallowPaths.length > 3 && (
                          <span> · +{v.disallowPaths.length - 3} more</span>
                        )}
                      </p>
                    )}
                    {(v.verdict === 'explicitly_blocked' || v.verdict === 'wildcard_blocked') && (
                      <p className="mt-1 text-[11px] text-rose-200/80">
                        Fix: remove the <code className="text-foreground">Disallow: /</code> for{' '}
                        <code className="text-foreground">{v.bot.label}</code> (or for{' '}
                        <code className="text-foreground">*</code>) in{' '}
                        <code className="text-foreground">{data.robotsUrl}</code>.
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Sitemaps */}
          {data.sitemaps.length > 0 && (
            <div className="bg-input/30 mb-4 rounded-lg border border-input px-3 py-2 text-xs text-muted-foreground">
              <span className="font-bold text-foreground">Sitemaps declared:</span>{' '}
              {data.sitemaps.slice(0, 3).map((s, i) => (
                <span key={s}>
                  <a
                    href={s}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand hover:underline"
                  >
                    {s}
                  </a>
                  {i < Math.min(2, data.sitemaps.length - 1) ? ' · ' : ''}
                </span>
              ))}
              {data.sitemaps.length > 3 && <span> · +{data.sitemaps.length - 3} more</span>}
            </div>
          )}

          {/* Raw content (collapsed) */}
          {data.content && (
            <div>
              <button
                onClick={() => setShowRobots((s) => !s)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {showRobots ? 'Hide' : 'Show'} raw robots.txt
                {data.contentTruncated ? ' (truncated)' : ''}
              </button>
              {showRobots && (
                <pre className="bg-input/40 mt-2 max-h-64 overflow-auto rounded-lg border border-input p-3 text-[11px] text-muted-foreground">
                  {data.content}
                </pre>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  )
}
