'use client'

// AI SEO 2026 readiness scorecard — hero panel for /dashboard/ai-funnel.
// Aggregates existing signals (monitoring volume, multi-engine cover,
// mention rate, own-domain citation share, FAQPage schema, llms.txt,
// branded search uplift, competitor coverage) into a single A-F grade
// + itemised punch list. Closes the gap from the Semrush 2026 piece.

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { CheckCircle2, XCircle, AlertCircle, HelpCircle, Loader2, Gauge } from 'lucide-react'

type CheckStatus = 'pass' | 'warn' | 'fail' | 'unknown'

interface ReadinessCheck {
  id: string
  label: string
  status: CheckStatus
  detail: string
  remedy: string
}

interface ReadinessReport {
  brandId: string
  score: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  passed: number
  total: number
  checks: ReadinessCheck[]
}

interface BrandLite {
  id: string
  name: string
}

const STATUS_ICON: Record<CheckStatus, typeof CheckCircle2> = {
  pass: CheckCircle2,
  warn: AlertCircle,
  fail: XCircle,
  unknown: HelpCircle,
}

const STATUS_TONE: Record<CheckStatus, string> = {
  pass: 'text-emerald-400',
  warn: 'text-amber-400',
  fail: 'text-rose-400',
  unknown: 'text-muted-foreground',
}

const GRADE_TONE: Record<ReadinessReport['grade'], string> = {
  A: 'text-emerald-300 bg-emerald-500/15',
  B: 'text-sky-300 bg-sky-500/15',
  C: 'text-amber-300 bg-amber-500/15',
  D: 'text-orange-300 bg-orange-500/15',
  F: 'text-rose-300 bg-rose-500/15',
}

export function AISeoReadinessPanel({ brandId: brandIdProp }: { brandId?: string } = {}) {
  const [brands, setBrands] = useState<BrandLite[]>([])
  const [activeBrandId, setActiveBrandId] = useState<string>(brandIdProp ?? '')
  const [report, setReport] = useState<ReadinessReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

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
    fetch(`/api/ai-seo-readiness?brand_id=${activeBrandId}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (!j.success) throw new Error(j.message || 'Failed')
        setReport(j.data)
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
  }, [activeBrandId])

  if (loading && !report) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
        Computing AI SEO readiness…
      </Card>
    )
  }
  if (error) {
    return (
      <Card className="border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-300">{error}</Card>
    )
  }
  if (!report) return null

  return (
    <Card className="p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-brand" />
          <h2 className="text-lg font-bold text-foreground">AI SEO 2026 readiness</h2>
        </div>
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
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div
          className={`flex h-20 w-20 flex-col items-center justify-center rounded-full font-black ${GRADE_TONE[report.grade]}`}
        >
          <span className="text-3xl leading-none">{report.grade}</span>
          <span className="text-[10px] uppercase tracking-wider">{report.score}/100</span>
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-black text-foreground">
            {report.passed}/{report.total} checks passing
          </p>
          <p className="text-sm text-muted-foreground">
            Aggregated from monitoring, citations, schema, llms.txt, branded search, and competitor
            data. Click any row for the fix.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        {report.checks.map((c) => {
          const Icon = STATUS_ICON[c.status]
          const open = expanded === c.id
          return (
            <button
              key={c.id}
              onClick={() => setExpanded((cur) => (cur === c.id ? null : c.id))}
              className="bg-input/30 hover:bg-input/50 block w-full rounded-md border border-input p-3 text-left transition-colors"
            >
              <div className="flex items-start gap-2">
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${STATUS_TONE[c.status]}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-foreground">{c.label}</span>
                    <span
                      className={`shrink-0 text-[10px] font-bold uppercase tracking-wider ${STATUS_TONE[c.status]}`}
                    >
                      {c.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{c.detail}</p>
                  {open && c.status !== 'pass' && (
                    <p className="bg-brand/5 border-brand/20 mt-2 rounded border px-2 py-1.5 text-xs text-foreground">
                      <span className="font-bold text-brand">Fix:</span> {c.remedy}
                    </p>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </Card>
  )
}
