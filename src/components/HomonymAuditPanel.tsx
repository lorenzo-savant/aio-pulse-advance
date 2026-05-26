'use client'

// "Homonym Audit" panel — surfaces the false-positive brand mentions an
// LLM classifier flagged as actually being about a homonym (Acasting ↔
// Acast podcast hosting; Savant ↔ "savant" as adjective; etc). The
// confusion rate is the headline metric — high % = your brand name is
// causing AI engines real entity-resolution trouble, and the SOV /
// sentiment numbers were inflated by junk before this panel existed.

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { ShieldCheck, Loader2, AlertTriangle, RefreshCw } from 'lucide-react'

interface FlaggedMention {
  id: string
  engine: string | null
  response_excerpt: string
  reason: string | null
  audited_at: string | null
}

interface AuditStats {
  totalMentions: number
  auditedMentions: number
  flaggedMentions: number
  pendingMentions: number
  confusionRate: number
  recentFlagged: FlaggedMention[]
}

interface RunSummary {
  scanned: number
  audited: number
  flagged: number
  ambiguous: number
  errors: number
  skipped: number
}

interface BrandLite {
  id: string
  name: string
}

export function HomonymAuditPanel({ brandId: brandIdProp }: { brandId?: string } = {}) {
  const [brands, setBrands] = useState<BrandLite[]>([])
  const [activeBrandId, setActiveBrandId] = useState<string>(brandIdProp ?? '')
  const [stats, setStats] = useState<AuditStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [migrationPending, setMigrationPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRun, setLastRun] = useState<RunSummary | null>(null)

  // Keep internal state in sync when the parent's brand prop changes.
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

  async function reload() {
    if (!activeBrandId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/brands/${activeBrandId}/homonym-audit`)
      const j = await res.json()
      if (!res.ok || !j.success) {
        if (j.code === 'AUDIT_MIGRATION_PENDING') {
          setMigrationPending(true)
          return
        }
        throw new Error(j.message || 'Failed to load audit stats')
      }
      setMigrationPending(false)
      setStats(j.data as AuditStats)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBrandId])

  async function runAudit() {
    if (!activeBrandId) return
    setRunning(true)
    setError(null)
    try {
      const res = await fetch(`/api/brands/${activeBrandId}/homonym-audit`, { method: 'POST' })
      const j = await res.json()
      if (!res.ok || !j.success) {
        if (j.code === 'AUDIT_MIGRATION_PENDING') {
          setMigrationPending(true)
          return
        }
        throw new Error(j.message || 'Audit failed')
      }
      setLastRun(j.data.summary as RunSummary)
      setStats(j.data.stats as AuditStats)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Audit failed')
    } finally {
      setRunning(false)
    }
  }

  if (migrationPending) {
    return (
      <Card className="p-4 text-xs text-amber-300">
        <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5" />
        Homonym audit not yet enabled — apply migration{' '}
        <code className="rounded bg-amber-500/20 px-1">
          20260526400000_monitoring_results_confusion.sql
        </code>
        .
      </Card>
    )
  }

  if (loading && !stats) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
        Loading homonym audit…
      </Card>
    )
  }

  if (error) return <Card className="p-6 text-sm text-rose-400">{error}</Card>
  if (!stats) return null

  const rateClass =
    stats.confusionRate >= 25
      ? 'text-rose-400'
      : stats.confusionRate >= 10
        ? 'text-amber-300'
        : 'text-emerald-400'

  return (
    <Card className="p-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-brand" />
          <h2 className="text-lg font-bold text-foreground">Homonym Audit</h2>
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
          <button
            onClick={runAudit}
            disabled={running || !activeBrandId}
            className="hover:bg-brand/90 inline-flex items-center gap-1 rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-brand-foreground transition-colors disabled:opacity-50"
          >
            {running ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {running ? 'Auditing…' : 'Run audit'}
          </button>
        </div>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        For every response that mentioned your brand by name, an LLM checks whether the answer is
        actually about <b>your</b> brand or a homonym (Acasting vs Acast podcast, Savant vs the word
        &ldquo;savant&rdquo;, etc.). Flagged mentions are excluded from Share of Voice and Sentiment
        Drivers.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div className="bg-secondary/40 rounded-lg border border-border px-3 py-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Confusion rate</p>
          <p className={`text-xl font-black ${rateClass}`}>{stats.confusionRate.toFixed(1)}%</p>
          <p className="text-[10px] text-muted-foreground">of audited mentions</p>
        </div>
        <div className="bg-secondary/40 rounded-lg border border-border px-3 py-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Flagged</p>
          <p className="text-xl font-black text-rose-400">{stats.flaggedMentions}</p>
          <p className="text-[10px] text-muted-foreground">false-positive mentions</p>
        </div>
        <div className="bg-secondary/40 rounded-lg border border-border px-3 py-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Audited</p>
          <p className="text-xl font-black text-foreground">{stats.auditedMentions}</p>
          <p className="text-[10px] text-muted-foreground">of {stats.totalMentions} total</p>
        </div>
        <div className="bg-secondary/40 rounded-lg border border-border px-3 py-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Pending</p>
          <p className="text-xl font-black text-amber-300">{stats.pendingMentions}</p>
          <p className="text-[10px] text-muted-foreground">not yet audited</p>
        </div>
      </div>

      {lastRun && (
        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-300">
          Last run: scanned {lastRun.scanned} · audited {lastRun.audited} · flagged{' '}
          {lastRun.flagged}
          {lastRun.errors > 0 && ` · errors ${lastRun.errors}`}
          {lastRun.skipped > 0 && ` · skipped ${lastRun.skipped} (too short)`}
        </div>
      )}

      {stats.recentFlagged.length === 0 ? (
        <div className="bg-input/30 rounded-lg border border-input px-4 py-6 text-center text-sm text-muted-foreground">
          {stats.auditedMentions === 0
            ? 'No mentions audited yet. Click "Run audit" to classify your brand mentions.'
            : 'No homonym confusion detected — every audited mention is actually about your brand.'}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Recent flagged mentions ({stats.recentFlagged.length})
          </p>
          {stats.recentFlagged.map((m) => (
            <div key={m.id} className="bg-input/40 rounded-lg border border-rose-500/20 px-3 py-2">
              <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span className="rounded bg-rose-500/15 px-1.5 py-0.5 font-bold uppercase tracking-wider text-rose-300">
                  {m.engine ?? 'unknown'}
                </span>
                <span>{m.audited_at?.slice(0, 10)}</span>
              </div>
              {m.reason && <p className="mb-1 text-xs font-medium text-rose-300">{m.reason}</p>}
              <p className="text-xs text-muted-foreground">{m.response_excerpt}…</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
