'use client'

// Audience declaration audit panel. Implements the agentic-web readiness
// gap from the Semrush piece: AI agents reward brands that EXPLICITLY
// declare who they serve (industries, personas, use cases). This panel
// fetches the brand's homepage on demand, looks for those signals, and
// scores them 0-100.

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Users, Loader2, ExternalLink, RefreshCw } from 'lucide-react'

interface AuditFinding {
  pattern: 'industry' | 'persona' | 'use_case' | 'audience_phrase'
  url: string
  label: string
}

interface AuditResult {
  homepageUrl: string
  fetched: boolean
  homepageHasAudiencePhrase: boolean
  audiencePhraseExamples: string[]
  verticalPagesCount: number
  personaPagesCount: number
  useCasePagesCount: number
  findings: AuditFinding[]
  score: number
  recommendation: string
  errors: string[]
}

interface ApiData {
  domain: string | null
  result: AuditResult | null
  message?: string
}

interface BrandLite {
  id: string
  name: string
}

const PATTERN_LABEL: Record<AuditFinding['pattern'], string> = {
  industry: 'Industry page',
  persona: 'Persona / role page',
  use_case: 'Use-case page',
  audience_phrase: 'Audience phrase',
}

const PATTERN_TONE: Record<AuditFinding['pattern'], string> = {
  industry: 'bg-sky-500/15 text-sky-300',
  persona: 'bg-emerald-500/15 text-emerald-300',
  use_case: 'bg-violet-500/15 text-violet-300',
  audience_phrase: 'bg-amber-500/15 text-amber-300',
}

function scoreTone(score: number): string {
  if (score >= 75) return 'text-emerald-300 bg-emerald-500/15'
  if (score >= 45) return 'text-sky-300 bg-sky-500/15'
  if (score >= 20) return 'text-amber-300 bg-amber-500/15'
  return 'text-rose-300 bg-rose-500/15'
}

export function AudienceDeclarationPanel({ brandId: brandIdProp }: { brandId?: string } = {}) {
  const [brands, setBrands] = useState<BrandLite[]>([])
  const [activeBrandId, setActiveBrandId] = useState<string>(brandIdProp ?? '')
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Sync internal state when parent changes the brand prop.
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

  useEffect(() => {
    if (!activeBrandId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/audience-audit?brand_id=${activeBrandId}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (!j.success) throw new Error(j.message || 'Failed')
        setData(j.data)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeBrandId, refreshKey])

  return (
    <Card className="p-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-brand" />
          <h2 className="text-lg font-bold text-foreground">Audience declaration audit</h2>
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
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading || !activeBrandId}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-foreground hover:bg-secondary disabled:opacity-50"
            title="Re-fetch the homepage"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Re-audit
          </button>
        </div>
      </div>

      <p className="mb-3 text-sm text-muted-foreground">
        AI agents reward brands that <b>explicitly</b> declare who they serve — industry pages,
        persona pages, use-case pages, and clear &ldquo;built for X&rdquo; copy on the homepage. We
        fetch your homepage and score those signals 0-100.
      </p>

      {error && (
        <p className="mb-3 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {error}
        </p>
      )}

      {data?.message && (
        <p className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          {data.message}
        </p>
      )}

      {loading && !data?.result && (
        <p className="text-sm text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          Fetching homepage…
        </p>
      )}

      {data?.result && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div
              className={`flex h-16 w-16 flex-col items-center justify-center rounded-full font-black ${scoreTone(data.result.score)}`}
            >
              <span className="text-xl leading-none">{data.result.score}</span>
              <span className="text-[9px] uppercase tracking-wider">/ 100</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">{data.result.homepageUrl}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{data.result.recommendation}</p>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="bg-input/30 rounded-md border border-input p-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Industry pages
              </p>
              <p className="mt-0.5 text-2xl font-black text-foreground">
                {data.result.verticalPagesCount}
              </p>
            </div>
            <div className="bg-input/30 rounded-md border border-input p-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Persona pages
              </p>
              <p className="mt-0.5 text-2xl font-black text-foreground">
                {data.result.personaPagesCount}
              </p>
            </div>
            <div className="bg-input/30 rounded-md border border-input p-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Use-case pages
              </p>
              <p className="mt-0.5 text-2xl font-black text-foreground">
                {data.result.useCasePagesCount}
              </p>
            </div>
            <div className="bg-input/30 rounded-md border border-input p-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                &ldquo;Built for…&rdquo; phrase
              </p>
              <p
                className={`mt-0.5 text-2xl font-black ${data.result.homepageHasAudiencePhrase ? 'text-emerald-300' : 'text-rose-300'}`}
              >
                {data.result.homepageHasAudiencePhrase ? 'Yes' : 'No'}
              </p>
            </div>
          </div>

          {data.result.audiencePhraseExamples.length > 0 && (
            <div className="mb-4">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Audience phrases found
              </p>
              <ul className="space-y-1">
                {data.result.audiencePhraseExamples.map((p) => (
                  <li
                    key={p}
                    className="bg-input/30 rounded border border-input px-2 py-1 text-xs italic text-foreground"
                  >
                    “{p}”
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.result.findings.filter((f) => f.pattern !== 'audience_phrase').length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Audience pages detected
              </p>
              <div className="space-y-1">
                {data.result.findings
                  .filter((f) => f.pattern !== 'audience_phrase')
                  .map((f) => (
                    <div
                      key={f.url}
                      className="bg-input/30 flex items-center justify-between gap-2 rounded-md border border-input px-3 py-1.5"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${PATTERN_TONE[f.pattern]}`}
                        >
                          {PATTERN_LABEL[f.pattern]}
                        </span>
                        <span className="truncate font-mono text-xs text-foreground">
                          {f.label}
                        </span>
                      </div>
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-muted-foreground hover:text-brand"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {data.result.errors.length > 0 && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              Notes: {data.result.errors.join(' · ')}
            </p>
          )}
        </>
      )}
    </Card>
  )
}
