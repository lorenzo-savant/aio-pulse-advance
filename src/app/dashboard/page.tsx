'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/index'
import { formatRelativeTime, cn } from '@/lib/utils'
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  Activity,
  Building2,
  MessageSquare,
  Radio,
  Bell,
  Target,
  Link2,
  Quote,
  Smile,
  Sparkles,
  Tag,
  GitCompare,
  Camera,
  ArrowUpRight,
} from 'lucide-react'
import type { Brand, WorkflowExecution } from '@/types'
import { PageTransition } from '@/components/ui/Motion'
import { AVIScoreCard } from '@/components/dashboard/AVIScoreCard'
import { useOverviewStats } from '@/hooks/useOverviewStats'

const STATUS_CONFIG: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  completed: { color: 'text-success', icon: CheckCircle2, label: 'Completed' },
  running: { color: 'text-brand', icon: Loader2, label: 'Running' },
  failed: { color: 'text-error', icon: XCircle, label: 'Failed' },
  pending: { color: 'text-muted-foreground', icon: Clock, label: 'Pending' },
  retrying: { color: 'text-warning', icon: AlertTriangle, label: 'Retrying' },
  cancelled: { color: 'text-muted-foreground', icon: XCircle, label: 'Cancelled' },
}

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.pending!
}

const WORKFLOW_TYPE_LABELS: Record<string, string> = {
  monitoring_run: 'Monitoring Run',
  brand_setup: 'Brand Setup',
  alert_evaluation: 'Alert Evaluation',
  data_export: 'Data Export',
  health_score_calc: 'Health Score',
}

// One aggregated tile per Insights section — value + sublabel, drill-down link.
interface SectionTile {
  key: string
  label: string
  value: string
  sub: string
  icon: React.ElementType
  href: string
}

async function safeJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const json = await res.json()
    return json?.success === false ? null : json
  } catch {
    return null
  }
}

export default function DashboardPage() {
  const t = useTranslations('dashboard')
  const { stats } = useOverviewStats(60_000)
  const [workflows, setWorkflows] = useState<WorkflowExecution[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBrand, setSelectedBrand] = useState('')
  const [tiles, setTiles] = useState<SectionTile[] | null>(null)

  // Load brands once + pick a default brand (the section tiles need a brand_id).
  useEffect(() => {
    fetch('/api/brands')
      .then((r) => r.json())
      .then((j) => {
        const list: Brand[] = j.data || j || []
        setBrands(list)
        setSelectedBrand((cur) => cur || list[0]?.id || '')
      })
      .catch(() => {})
  }, [])

  const loadWorkflows = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedBrand) params.set('brand_id', selectedBrand)
      params.set('limit', '8')
      const wJson = await safeJson(`/api/workflows?${params}`)
      setWorkflows(wJson?.data || [])
    } finally {
      setLoading(false)
    }
  }, [selectedBrand])

  useEffect(() => {
    loadWorkflows()
  }, [loadWorkflows])

  // Control-tower tiles: fetch each Insights section in parallel for the
  // selected brand. Each tile soft-fails to "—" so one bad section never
  // blanks the grid.
  useEffect(() => {
    if (!selectedBrand) {
      setTiles(null)
      return
    }
    const b = selectedBrand
    let cancelled = false
    ;(async () => {
      const [geo, cite, sentiment, aeo, keywords, competitor, snapshots] = await Promise.all([
        safeJson(`/api/geo-score?brand_id=${b}&period=30d`),
        safeJson(`/api/citation-sources?brand_id=${b}&engine=all&days=30`),
        safeJson(`/api/sentiment?brand_id=${b}`),
        safeJson(`/api/aeo-snippets?brand_id=${b}&limit=100`),
        safeJson(`/api/keywords?brand_id=${b}&limit=100`),
        safeJson(`/api/competitor?brand_id=${b}&limit=10`),
        safeJson(`/api/snapshots?brand_id=${b}&engine=all&category=all`),
      ])
      if (cancelled) return

      const dash = (v: unknown) => (v === undefined || v === null ? '—' : String(v))
      const sentPct =
        typeof sentiment?.data?.avgSentimentScore === 'number'
          ? `${Math.round(((sentiment.data.avgSentimentScore + 1) / 2) * 100)}%`
          : '—'
      const keywordCount = Array.isArray(keywords?.data) ? keywords.data.length : 0
      const competitorCount = Array.isArray(competitor?.data) ? competitor.data.length : 0
      const snapList = snapshots?.data?.snapshots
      const latestSnap = snapshots?.data?.latest?.scan_date

      setTiles([
        {
          key: 'geo',
          label: 'GEO Score',
          value: geo?.data?.grade ? `${geo.data.grade}` : dash(geo?.data?.score),
          sub: geo?.data ? `${dash(geo.data.score)}/100` : 'no data yet',
          icon: Target,
          href: '/dashboard/geo-score',
        },
        {
          key: 'citation-sources',
          label: 'Citation Sources',
          value: dash(cite?.data?.summary?.uniqueDomains),
          sub: 'domains cite you',
          icon: Link2,
          href: '/dashboard/citation-sources',
        },
        {
          key: 'citations',
          label: 'Citations',
          value: dash(cite?.data?.summary?.totalCitations),
          sub:
            typeof cite?.data?.summary?.sourcedRate === 'number'
              ? `${Math.round(cite.data.summary.sourcedRate)}% sourced`
              : 'total citations',
          icon: Quote,
          href: '/dashboard/citations',
        },
        {
          key: 'sentiment',
          label: 'Sentiment',
          value: sentPct,
          sub: 'avg sentiment',
          icon: Smile,
          href: '/dashboard/sentiment',
        },
        {
          key: 'aeo',
          label: 'AEO Snippets',
          value: dash(aeo?.data?.counts?.total),
          sub:
            typeof aeo?.data?.counts?.covered === 'number'
              ? `${aeo.data.counts.covered} covered`
              : 'Q&A snippets',
          icon: Sparkles,
          href: '/dashboard/aeo-snippets',
        },
        {
          key: 'keywords',
          label: 'Keywords',
          value: keywordCount > 0 ? String(keywordCount) : '—',
          sub: 'tracked',
          icon: Tag,
          href: '/dashboard/keywords',
        },
        {
          key: 'competitor',
          label: 'Competitor',
          value: competitorCount > 0 ? String(competitorCount) : '—',
          sub: 'comparisons',
          icon: GitCompare,
          href: '/dashboard/competitor',
        },
        {
          key: 'snapshots',
          label: 'Snapshots',
          value: Array.isArray(snapList) ? String(snapList.length) : '—',
          sub: latestSnap ? `latest ${new Date(latestSnap).toLocaleDateString()}` : 'point-in-time',
          icon: Camera,
          href: '/dashboard/snapshots',
        },
      ])
    })()
    return () => {
      cancelled = true
    }
  }, [selectedBrand])

  const completedCount = workflows.filter((w) => w.status === 'completed').length
  const failedCount = workflows.filter((w) => w.status === 'failed').length
  const runningCount = workflows.filter((w) => w.status === 'running').length
  const lastRun = workflows[0]

  const kpis = [
    { label: 'Brands', value: stats.brands, icon: Building2, href: '/dashboard/brands' },
    {
      label: 'Active Prompts',
      value: stats.prompts,
      icon: MessageSquare,
      href: '/dashboard/prompts',
    },
    {
      label: 'Monitoring Runs',
      value: stats.monitoringRuns,
      icon: Radio,
      href: '/dashboard/monitoring',
    },
    { label: 'Unread Alerts', value: stats.unreadAlerts, icon: Bell, href: '/dashboard/alerts' },
  ]

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Pages / Overview</p>
            <h1 className="mt-1 text-[34px] font-bold tracking-tight text-foreground">
              {t('page_subtitle')}
            </h1>
          </div>
          <select
            className="rounded-xl border border-border bg-input px-4 py-2 text-sm text-foreground"
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
          >
            {brands.length === 0 && <option value="">{t('all_brands')}</option>}
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* AVI Score — the hero metric */}
        <AVIScoreCard brandId={selectedBrand || undefined} />

        {/* KPI row */}
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
          {kpis.map(({ label, value, icon: Icon, href }) => (
            <Link
              key={label}
              href={href}
              className="stat-card card-horizon group transition-transform hover:-translate-y-0.5"
            >
              <div className="stat-icon bg-brand-gradient">
                <Icon className="h-6 w-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
                  {label}
                  <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
                </p>
                <p className="text-[34px] font-bold leading-none tracking-tight text-foreground">
                  {value}
                </p>
              </div>
            </Link>
          ))}
        </div>

        {/* Insights at a glance — control tower (one tile per Insights section) */}
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-brand" />
            <h2 className="text-lg font-bold text-foreground">Insights at a glance</h2>
            <span className="text-xs text-muted-foreground">· click any tile to drill in</span>
          </div>
          {!selectedBrand ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Add a brand to see insights.
            </p>
          ) : !tiles ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-brand" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {tiles.map((tile) => (
                <Link
                  key={tile.key}
                  href={tile.href}
                  className="bg-secondary/40 group rounded-xl border border-border p-4 transition-colors hover:bg-secondary"
                >
                  <div className="flex items-center justify-between">
                    <tile.icon className="h-4 w-4 text-brand" />
                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-70" />
                  </div>
                  <p className="mt-2 text-2xl font-black leading-none text-foreground">
                    {tile.value}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-foreground">{tile.label}</p>
                  <p className="text-[11px] text-muted-foreground">{tile.sub}</p>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Recent activity — compact, links to Workflows */}
        <Card className="p-6">
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-brand" />
              <h2 className="text-lg font-bold text-foreground">Recent activity</h2>
            </div>
            <Link
              href="/dashboard/workflows"
              className="flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
            >
              Manage in Workflows
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">
            {workflows.length} recent job{workflows.length === 1 ? '' : 's'} · {completedCount}{' '}
            completed · {failedCount} failed · {runningCount} running
            {lastRun && <> · last {formatRelativeTime(lastRun.startedAt)}</>}
          </p>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-brand" />
            </div>
          ) : workflows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('no_workflows')}</p>
          ) : (
            <div className="divide-y divide-border">
              {workflows.slice(0, 6).map((w) => {
                const sc = getStatusConfig(w.status)
                const Icon = sc.icon
                const brandName = brands.find((b) => b.id === w.brandId)?.name
                return (
                  <div key={w.id} className="flex items-center gap-3 py-2.5">
                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0',
                        sc.color,
                        w.status === 'running' && 'animate-spin',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">
                        {WORKFLOW_TYPE_LABELS[w.type] || w.type}
                        {brandName && <span className="text-muted-foreground"> · {brandName}</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeTime(w.startedAt)}
                      </p>
                    </div>
                    <Badge
                      variant={
                        w.status === 'completed'
                          ? 'success'
                          : w.status === 'failed'
                            ? 'danger'
                            : 'default'
                      }
                    >
                      {sc.label}
                    </Badge>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>
    </PageTransition>
  )
}
