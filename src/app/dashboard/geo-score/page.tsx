// PATH: src/app/dashboard/geo-score/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Gauge,
  RefreshCw,
  AlertCircle,
  Lightbulb,
  Globe,
  ArrowUpRight,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui/Card'
import { GroundedAnswerPanel } from '@/components/GroundedAnswerPanel'
import { SectionHelp } from '@/components/help/SectionHelp'
import { cn } from '@/lib/utils'
import { useChartTheme } from '@/hooks/useChartTheme'
import {
  ENGINE_COLORS as ENGINE_PALETTE,
  engineColor,
  GRADE_COLORS,
  SCORE_BAND_COLORS,
  scoreColor,
} from '@/lib/chart-tokens'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Brand {
  id: string
  name: string
  color: string
  domain?: string | null
}

interface Pillar {
  key: string
  label: string
  score: number
  weight: number
  contribution: number
}

interface GeoRecommendation {
  pillar: string
  label: string
  weight: number
  currentScore: number
  upliftPts: number
  why: string
  actions: string[]
}

interface SiteAudit {
  score: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  url: string
  cachedAt: string
  expiresAt: string
  topIssues: string[]
}

interface GeoData {
  score: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  delta: number
  previousScore: number
  pillars: Pillar[]
  recommendations: GeoRecommendation[]
  history: { date: string; score: number }[]
  engineBreakdown: { engine: string; visibility: number }[]
  date: string | null
  hasData: boolean
  /** Latest cached static site audit (from /api/audit/technical). */
  siteAudit: SiteAudit | null
  /** Number of monitoring responses backing the score in the period. */
  sampleSize?: number
  /** Sample-size confidence in the score. */
  confidence?: 'low' | 'medium' | 'high'
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Grade + engine palettes come from chart-tokens.ts so all dashboards agree
// on which colour represents Gemini vs Perplexity vs Claude.
const GRADE_COLOR = GRADE_COLORS
const ENGINE_COLORS = ENGINE_PALETTE

// scoreAccent maps a 0-100 score to the canonical band colour. Thresholds
// match the citation worthiness rubric (80/65/45/25) and the AI SEO grade
// thresholds (85/70/55/40); using the shared scoreColor() keeps both
// rubrics rendered with the same green/amber/orange/red.
const scoreAccent = scoreColor

// Qualitative band for a 0–100 pillar/score, with a matching colour. Used by
// the colour-coded Score-by-Category table so each number reads as a verdict,
// not just a digit. Thresholds intentionally a bit looser than the strict
// rubric so most pillar scores get a non-red label.
// Returns the catalog slug (geo_dashboard.rating_<slug>) plus the band colour,
// so the caller localises the verdict.
function scoreRating(score: number): { slug: string; color: string } {
  if (score >= 70) return { slug: 'excellent', color: SCORE_BAND_COLORS.excellent }
  if (score >= 55) return { slug: 'good', color: SCORE_BAND_COLORS.moderate }
  if (score >= 40) return { slug: 'fair', color: SCORE_BAND_COLORS.weak }
  return { slug: 'weak', color: SCORE_BAND_COLORS.poor }
}

// Pillar keys the UI knows how to name. Labels, descriptions and
// recommendation copy all live in the message catalog under geo_dashboard.*,
// keyed by these slugs — the API still sends its own English strings, which we
// deliberately ignore so the page follows the user's locale.
const PILLAR_KEYS = ['citation', 'presence', 'authority', 'position', 'trust'] as const

function isPillarKey(key: string): key is (typeof PILLAR_KEYS)[number] {
  return (PILLAR_KEYS as readonly string[]).includes(key)
}

function periodDays(p: string): number {
  if (p === '7d') return 7
  if (p === '60d') return 60
  if (p === '90d') return 90
  return 30
}

// Inline link that connects the live GEO Score to the static site audit at
// /dashboard/audit. Deliberately small — it lives inside the gauge card and
// reads as "by the way, here's the related static-readiness score", not as a
// competing widget.
function SiteAuditLine({
  audit,
  fallbackDomain,
}: {
  audit: GeoData['siteAudit']
  fallbackDomain: string | null
}) {
  const t = useTranslations('geo_dashboard')
  if (audit) {
    const href = `/dashboard/audit?url=${encodeURIComponent(audit.url)}`
    return (
      <a
        href={href}
        className="mt-8 flex w-full items-center gap-2 border-t border-border pt-6 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <Globe className="h-3.5 w-3.5" />
        <span>
          {t('site_readiness')}{' '}
          <span className="font-bold" style={{ color: scoreAccent(audit.score) }}>
            {audit.score}
          </span>{' '}
          ({audit.grade})
        </span>
        <ArrowUpRight className="ml-auto h-3.5 w-3.5" />
      </a>
    )
  }
  if (!fallbackDomain) return null
  const href = `/dashboard/audit?url=${encodeURIComponent(fallbackDomain)}`
  return (
    <a
      href={href}
      className="mt-5 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      <Globe className="h-3.5 w-3.5" />
      <span>{t('run_site_audit', { domain: fallbackDomain })}</span>
      <ArrowUpRight className="ml-auto h-3.5 w-3.5" />
    </a>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function GeoScorePage() {
  const t = useTranslations('geo_dashboard')
  const tg = useTranslations('geoScore')
  const { tooltipStyle, gridColor, axisColor } = useChartTheme()
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null)
  const [period, setPeriod] = useState('30d')
  const [data, setData] = useState<GeoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/brands')
        const json = await res.json()
        const list = json.data || json || []
        setBrands(list)
        if (list.length > 0) setSelectedBrand(list[0])
        else setLoading(false)
      } catch {
        setError(t('failed_load_brands'))
        setLoading(false)
      }
    }
    load()
  }, [])

  const fetchScore = useCallback(async () => {
    if (!selectedBrand) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/geo-score?brand_id=${selectedBrand.id}&period=${period}`)
      const json = await res.json()
      if (!res.ok || !json.success) {
        setError(json.message || `API error: ${res.status}`)
        setData(null)
        return
      }
      setData(json.data)
    } catch {
      setError(t('failed_load_score'))
    } finally {
      setLoading(false)
    }
  }, [selectedBrand, period])

  useEffect(() => {
    fetchScore()
  }, [fetchScore])

  const trend: 'up' | 'down' | 'neutral' =
    !data || data.delta === 0 ? 'neutral' : data.delta > 0 ? 'up' : 'down'
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus

  const chartData = (data?.history || []).map((h) => ({
    date: new Date(h.date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }),
    score: h.score,
  }))

  return (
    <div className="animate-in space-y-8">
      <SectionHelp section="geo-score" />

      {/*
        Scores moved on 2026-08-07 for a reason that has nothing to do with
        brand performance, and a customer comparing this week's report to last
        week's deserves to know that before they draw a conclusion.

        `mention_position` records which SENTENCE first names the brand, capped
        at 20. It was being normalised as though it were a 1-5 search rank, so
        any brand first named from the fifth sentence onward scored zero on
        Answer Position — 24% of stored rows, on a pillar worth 15%.

        Dated on purpose: this stops being useful once no one is comparing
        against a pre-correction report, and it should be deleted then rather
        than left to become furniture.
      */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
        <p className="text-sm font-semibold text-amber-300">{t('methodology_title')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('methodology_body')}</p>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">{tg('page_title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('page_subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {brands.length > 1 && (
            <select
              className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              value={selectedBrand?.id || ''}
              onChange={(e) => {
                const b = brands.find((x) => x.id === e.target.value)
                if (b) setSelectedBrand(b)
              }}
            >
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
          <select
            className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="7d">{t('last_days', { count: 7 })}</option>
            <option value="30d">{t('last_days', { count: 30 })}</option>
            <option value="60d">{t('last_days', { count: 60 })}</option>
            <option value="90d">{t('last_days', { count: 90 })}</option>
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="border-red-900/50 bg-red-900/10 text-red-400 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {/* No data */}
      {!loading && (!data || !data.hasData) && !error && (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <Gauge className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-bold text-foreground">{t('no_score')}</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">{t('no_score_hint')}</p>
        </Card>
      )}

      {/* Content */}
      {!loading && data && data.hasData && (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Score gauge */}
            <Card className="flex flex-col items-center justify-center p-10 text-center">
              <p className="mb-8 text-sm font-medium uppercase tracking-wider text-muted-foreground">
                {tg('page_title')}
              </p>
              {/* Slightly bigger frame so the grade badge sits outside the
                  gauge arc with breathing room (was h-44/w-44). */}
              <div className="relative flex h-52 w-52 items-center justify-center">
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                  {/* Background ring: same colour as the score arc at low opacity
                      so the gauge reads as one coherent shape, not two stripes. */}
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="none"
                    stroke={scoreAccent(data.score)}
                    strokeOpacity={0.15}
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="none"
                    stroke={scoreAccent(data.score)}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${(data.score / 100) * 276.46} 276.46`}
                    className="transition-all duration-700"
                  />
                </svg>
                {/* Score number + grade, stacked and centered INSIDE the ring.
                    The grade used to float as an absolute corner badge that
                    overlapped the arc; centering it under the number removes
                    the overlap and reads cleaner. */}
                <div className="flex flex-col items-center justify-center gap-1.5">
                  <span
                    className="text-6xl font-black leading-none"
                    style={{ color: scoreAccent(data.score) }}
                  >
                    {data.score.toFixed(0)}
                  </span>
                  <span
                    className="rounded-full px-3 py-0.5 text-sm font-black leading-none text-white"
                    style={{ backgroundColor: GRADE_COLOR[data.grade] }}
                  >
                    {data.grade}
                  </span>
                </div>
              </div>
              {/* Delta + previous-score block. mt-10 (40px) gives the gauge
                  room to breathe; the two lines are intentionally bunched
                  via gap-1 so they read as one trend statement. */}
              <div className="mt-10 flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    'flex items-center gap-2 text-sm font-semibold',
                    trend === 'up'
                      ? 'text-emerald-400'
                      : trend === 'down'
                        ? 'text-red-400'
                        : 'text-muted-foreground',
                  )}
                >
                  <TrendIcon className="h-4 w-4" />
                  <span>
                    {data.delta > 0 ? '+' : ''}
                    {data.delta.toFixed(1)} vs {t('days_ago', { count: periodDays(period) })}
                  </span>
                </div>
                {data.previousScore > 0 && Math.abs(data.delta) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    was {data.previousScore.toFixed(1)}
                  </p>
                )}
              </div>

              {/* Sample-size confidence — a score from few responses isn't
                  presented as certain (no false precision). */}
              {data.confidence && (
                <div className="mt-4 flex justify-center">
                  <span
                    className={cn(
                      'rounded-full px-3 py-1 text-xs font-bold',
                      data.confidence === 'high'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : data.confidence === 'medium'
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-input text-muted-foreground',
                    )}
                  >
                    {data.confidence} confidence
                    {typeof data.sampleSize === 'number' && (
                      <span className="font-normal opacity-70">
                        {' '}
                        · {data.sampleSize} response{data.sampleSize === 1 ? '' : 's'}
                      </span>
                    )}
                  </span>
                </div>
              )}

              {/* Inline link to the static site audit — connects this live
                  visibility score to the static readiness audit that already
                  exists at /dashboard/audit, without a parallel card. */}
              <SiteAuditLine
                audit={data.siteAudit}
                fallbackDomain={selectedBrand?.domain ?? null}
              />
            </Card>

            {/* Pillars */}
            <Card className="p-6 lg:col-span-2">
              <h2 className="mb-1 text-lg font-bold text-foreground">{tg('breakdown.title')}</h2>
              <p className="mb-6 text-sm text-muted-foreground">{t('breakdown_hint')}</p>
              <div className="space-y-5">
                {data.pillars.map((p) => (
                  <div key={p.key}>
                    <div className="mb-1.5 flex justify-between text-sm font-medium">
                      <span className="text-muted-foreground">
                        {isPillarKey(p.key) ? t(`pillar_${p.key}`) : p.label}{' '}
                        <span className="text-xs opacity-60">
                          {t('weight_suffix', { pct: Math.round(p.weight * 100) })}
                        </span>
                      </span>
                      <span className="font-bold text-foreground">
                        {p.score.toFixed(0)}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {t('pts_suffix', { pts: p.contribution.toFixed(1) })}
                        </span>
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.min(p.score, 100)}%`,
                          backgroundColor: scoreAccent(p.score),
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* GEO Score by Category — colour-coded clarity table */}
          <Card className="p-6">
            <h2 className="mb-1 text-lg font-bold text-foreground">{t('by_category')}</h2>
            <p className="mb-5 text-sm text-muted-foreground">
              {t('by_category_hint')}
              <span className="ml-1 font-semibold text-emerald-500">{t('rating_excellent')}</span> ·
              <span className="ml-1 font-semibold text-amber-500">{t('rating_good')}</span> ·
              <span className="ml-1 font-semibold text-orange-500">{t('rating_fair')}</span> ·
              <span className="text-red-500 ml-1 font-semibold">{t('rating_weak')}</span>.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      {tg('breakdown.category')}
                    </th>
                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      {t('col_what')}
                    </th>
                    <th className="px-3 py-2 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      {tg('breakdown.score')}
                    </th>
                    <th className="px-3 py-2 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      {t('col_rating')}
                    </th>
                    <th className="px-3 py-2 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      {tg('breakdown.weight')}
                    </th>
                    <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      {t('col_contribution')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.pillars.map((p) => {
                    const rating = scoreRating(p.score)
                    return (
                      <tr key={p.key} className="border-border/50 border-b">
                        <td className="px-3 py-3 font-semibold text-foreground">
                          {isPillarKey(p.key) ? t(`pillar_${p.key}`) : p.label}
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">
                          {isPillarKey(p.key) ? t(`desc_${p.key}`) : ''}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span
                            className="inline-block min-w-[3rem] rounded-md px-2 py-1 text-sm font-black"
                            style={{ color: rating.color, backgroundColor: `${rating.color}1a` }}
                          >
                            {p.score.toFixed(0)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span
                            className="rounded-full px-2.5 py-0.5 text-xs font-bold"
                            style={{ color: rating.color, backgroundColor: `${rating.color}1a` }}
                          >
                            {t(`rating_${rating.slug}`)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center text-muted-foreground">
                          {Math.round(p.weight * 100)}%
                        </td>
                        <td className="px-3 py-3 text-right font-semibold text-foreground">
                          {t('pts_suffix', { pts: p.contribution.toFixed(1) })}
                        </td>
                      </tr>
                    )
                  })}
                  {/* Total row */}
                  <tr className="border-t-2 border-border">
                    <td className="px-3 py-3 font-black text-foreground" colSpan={2}>
                      {t('total_score')}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className="inline-block min-w-[3rem] rounded-md px-2 py-1 text-base font-black"
                        style={{
                          color: scoreAccent(data.score),
                          backgroundColor: `${scoreAccent(data.score)}1a`,
                        }}
                      >
                        {data.score.toFixed(0)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className="rounded-full px-2.5 py-0.5 text-xs font-black text-white"
                        style={{ backgroundColor: GRADE_COLOR[data.grade] }}
                      >
                        {t('grade_label', { grade: data.grade })}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center text-muted-foreground">100%</td>
                    <td className="px-3 py-3 text-right font-black text-foreground">
                      {t('pts_suffix', { pts: data.score.toFixed(1) }).replace('+', '')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              {t('grade_scale')} <span className="font-semibold text-emerald-500">A ≥ 85</span> ·
              <span className="ml-1 font-semibold text-green-500">B ≥ 70</span> ·
              <span className="ml-1 font-semibold text-amber-500">C ≥ 55</span> ·
              <span className="ml-1 font-semibold text-orange-500">D ≥ 40</span> ·
              <span className="text-red-500 ml-1 font-semibold">F &lt; 40</span>.{' '}
              {t('grade_scale_tail')}
            </p>
          </Card>

          {/* Ask why, before being told what to do: the panel explains the
              numbers above it, and the recommendations below act on them. */}
          {selectedBrand && (
            <GroundedAnswerPanel
              brandId={selectedBrand.id}
              pillars={data.pillars.map((p) => ({ key: p.key, score: p.score }))}
              days={periodDays(period)}
              hasHistory={(data.history?.length ?? 0) > 1}
            />
          )}

          {/* Recommendations */}
          {data.recommendations.length > 0 && (
            <Card className="p-6">
              <div className="mb-1 flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-amber-400" />
                <h2 className="text-lg font-bold text-foreground">{t('improve_title')}</h2>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">{t('improve_hint')}</p>
              <div className="space-y-3">
                {data.recommendations.map((rec, i) => (
                  <div
                    key={rec.pillar}
                    className="bg-secondary/40 rounded-xl border border-border p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="bg-primary/15 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-primary">
                        {i + 1}
                      </span>
                      <span className="font-semibold text-foreground">
                        {isPillarKey(rec.pillar) ? t(`pillar_${rec.pillar}`) : rec.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t('rec_now_weight', {
                          score: rec.currentScore,
                          pct: Math.round(rec.weight * 100),
                        })}
                      </span>
                      <span className="ml-auto rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-400">
                        {t('rec_uplift', { pts: rec.upliftPts })}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {isPillarKey(rec.pillar) ? t(`why_${rec.pillar}`) : rec.why}
                    </p>
                    <ul className="mt-3 space-y-1.5">
                      {(isPillarKey(rec.pillar)
                        ? [1, 2, 3].map((n) => t(`action_${rec.pillar}_${n}`))
                        : rec.actions
                      ).map((a, j) => (
                        <li key={j} className="flex gap-2 text-sm leading-relaxed text-foreground">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Trend */}
            <Card className="p-6">
              <h2 className="mb-6 text-lg font-bold text-foreground">{t('trend_title')}</h2>
              {chartData.length > 1 ? (
                <ResponsiveContainer height={240} width="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: axisColor }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: axisColor }} />
                    <Tooltip {...tooltipStyle} />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke={SCORE_BAND_COLORS.excellent}
                      strokeWidth={2.5}
                      dot={false}
                      name={tg('page_title')}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  {t('trend_need_data')}
                </p>
              )}
            </Card>

            {/* Engine breakdown */}
            <Card className="p-6">
              <h2 className="mb-6 text-lg font-bold text-foreground">
                {t('visibility_by_engine')}
              </h2>
              {data.engineBreakdown.length > 0 ? (
                <div className="space-y-5">
                  {data.engineBreakdown.map((e) => (
                    <div key={e.engine}>
                      <div className="mb-1.5 flex justify-between text-sm font-medium">
                        <span className="capitalize text-muted-foreground">{e.engine}</span>
                        <span className="font-bold text-foreground">
                          {e.visibility.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.min(e.visibility, 100)}%`,
                            backgroundColor: engineColor(e.engine),
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  {t('no_engine_data')}
                </p>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
