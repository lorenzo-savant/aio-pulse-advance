'use client'

// Borrow #2 — "claims vs. documented reality" competitive dimension.
// On-demand: the user enters a competitor domain; we fetch its
// pricing/docs/changelog (SSRF-hardened) and surface where marketing claims
// diverge from the docs. No automatic calls — runs only on button click.

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Loader2, ScanSearch } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Finding {
  dimension: string
  claim: string
  reality: string
  severity: 'low' | 'medium' | 'high'
}
interface PositioningResult {
  competitor: string
  findings: Finding[]
  summary: string
  pagesAnalyzed: Array<{ kind: string; url: string; ok: boolean }>
}

const SEVERITY_STYLES: Record<string, string> = {
  high: 'bg-red-500/10 text-red-400',
  medium: 'bg-amber-500/10 text-amber-300',
  low: 'bg-secondary text-muted-foreground',
}

export function CompetitorPositioningPanel() {
  const [domain, setDomain] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PositioningResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    if (!domain.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/competitor/positioning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domain.trim() }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Analysis failed')
      setResult(json.data as PositioningResult)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-6">
      <div className="mb-2 flex items-center gap-2">
        <ScanSearch className="h-4 w-4 text-brand" />
        <h2 className="text-lg font-bold text-foreground">Positioning — claims vs. reality</h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Fetch a competitor&rsquo;s pricing, docs and changelog and surface where their marketing
        claims diverge from what the documentation actually delivers (beta vs. GA, hidden limits,
        deprecated-but-advertised features). Runs only when you click.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void run()}
          placeholder="competitor.com"
          className="min-w-[220px] flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
        />
        <Button variant="outline" onClick={() => void run()} disabled={loading || !domain.trim()}>
          {loading ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <ScanSearch className="mr-1.5 h-3.5 w-3.5" />
          )}
          Analyze
        </Button>
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {result && (
        <div className="mt-5 space-y-3">
          {result.summary && <p className="text-sm text-foreground">{result.summary}</p>}
          {result.findings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No clear contradictions found (or the competitor&rsquo;s pages could not be fetched).
            </p>
          ) : (
            result.findings.map((f, i) => (
              <div key={i} className="rounded-lg border border-border p-3">
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                      SEVERITY_STYLES[f.severity] ?? SEVERITY_STYLES.low,
                    )}
                  >
                    {f.severity}
                  </span>
                  <span className="text-xs text-muted-foreground">{f.dimension}</span>
                </div>
                <p className="text-sm text-foreground">
                  <strong>Claim:</strong> {f.claim}
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Reality:</strong> {f.reality}
                </p>
              </div>
            ))
          )}
          <p className="text-xs text-muted-foreground">
            Pages analyzed:{' '}
            {result.pagesAnalyzed
              .filter((p) => p.ok)
              .map((p) => p.kind)
              .join(', ') || 'none'}
          </p>
        </div>
      )}
    </Card>
  )
}
