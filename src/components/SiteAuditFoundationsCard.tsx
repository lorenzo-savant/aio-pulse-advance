'use client'

// "Foundations" card for the Site Audit Hub. Binary presence checks for
// the AI-readiness essentials: HTTPS root, /llms.txt, /llms-full.txt,
// /sitemap.xml. Each renders as a green check or red cross with the
// probed URL + next-action hint when missing. See
// lib/services/site-audit-presence.ts for the probing logic.

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import {
  ShieldCheck,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface PresenceCheck {
  url: string
  exists: boolean
  status: number | null
  excerpt: string | null
  error?: string
}

interface FoundationsReport {
  domain: string
  httpsAvailable: boolean
  llmsTxt: PresenceCheck
  llmsFullTxt: PresenceCheck
  sitemap: PresenceCheck
  foundationsScore: number
  recommendations: string[]
}

interface CheckRowProps {
  label: string
  hint: string
  check: PresenceCheck | { exists: boolean; url?: string }
}

function CheckRow({ label, hint, check }: CheckRowProps) {
  const exists = check.exists
  const Icon = exists ? CheckCircle2 : XCircle
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg border px-3 py-2',
        exists ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-rose-500/30 bg-rose-500/5',
      )}
    >
      <Icon
        className={cn('mt-0.5 h-4 w-4 shrink-0', exists ? 'text-emerald-400' : 'text-rose-400')}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-foreground">{label}</span>
          {'url' in check && check.url && (
            <a
              href={check.url}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-muted-foreground hover:text-brand"
            >
              {check.url}
              <ExternalLink className="ml-0.5 inline h-3 w-3" />
            </a>
          )}
          {'status' in check && check.status != null && (
            <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              HTTP {check.status}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
        {'error' in check && check.error && (
          <p className="mt-0.5 text-[11px] text-rose-300">{check.error}</p>
        )}
      </div>
    </div>
  )
}

export function SiteAuditFoundationsCard({ brandId }: { brandId: string }) {
  const [data, setData] = useState<FoundationsReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    if (!brandId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/brands/${brandId}/site-audit-foundations`)
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.message || 'Audit failed')
      setData(j.data as FoundationsReport)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Audit failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId])

  const scoreClass =
    !data || data.foundationsScore < 50
      ? 'text-rose-400'
      : data.foundationsScore < 75
        ? 'text-amber-300'
        : 'text-emerald-400'

  return (
    <Card className="p-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-brand" />
          <h2 className="text-lg font-bold text-foreground">Foundations</h2>
        </div>
        <Button onClick={run} disabled={loading} size="sm" variant="outline">
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {loading ? 'Probing…' : 'Re-check'}
        </Button>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        Binary presence checks for the AI-readiness essentials. If any of these are missing, the
        heavier audits below (crawler access, citation capture, content quality) are running on a
        shaky foundation.
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
          Probing foundations…
        </div>
      )}

      {data && (
        <>
          {/* Score header */}
          <div className="bg-secondary/30 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
            <div className="flex items-baseline gap-2">
              <span className={cn('text-3xl font-black', scoreClass)}>{data.foundationsScore}</span>
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                / 100 foundations
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              Probed: <code className="text-foreground">{data.domain}</code>
            </span>
          </div>

          {/* Check rows */}
          <div className="mb-4 space-y-2">
            <CheckRow
              label="HTTPS root"
              hint="The brand's homepage resolves over HTTPS. Foundation for every other signal."
              check={{
                exists: data.httpsAvailable,
                url: `https://${data.domain}/`,
                status: data.httpsAvailable ? 200 : null,
                excerpt: null,
              }}
            />
            <CheckRow
              label="/llms.txt (short)"
              hint="The curated link-list variant for AI crawlers. Required by the llms.txt v0.2 spec."
              check={data.llmsTxt}
            />
            <CheckRow
              label="/llms-full.txt (long)"
              hint="The rich variant with Key Takeaways, FAQ, and embedded Schema.org JSON-LD."
              check={data.llmsFullTxt}
            />
            <CheckRow
              label="/sitemap.xml"
              hint="XML sitemap — speeds up AI-crawler discovery of new + updated pages."
              check={data.sitemap}
            />
          </div>

          {/* Recommendations */}
          {data.recommendations.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Next actions
              </p>
              <ul className="space-y-1.5">
                {data.recommendations.map((r, i) => (
                  <li
                    key={i}
                    className="bg-input/30 rounded-lg border border-input px-3 py-2 text-xs text-foreground"
                  >
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
