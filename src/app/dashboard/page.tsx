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
  Sparkles,
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

export default function DashboardPage() {
  const t = useTranslations('dashboard')
  const { stats } = useOverviewStats(60_000)
  const [workflows, setWorkflows] = useState<WorkflowExecution[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBrand, setSelectedBrand] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedBrand) params.set('brand_id', selectedBrand)
      params.set('limit', '8')

      const [workflowsRes, brandsRes] = await Promise.all([
        fetch(`/api/workflows?${params}`),
        fetch('/api/brands'),
      ])
      const wJson = await workflowsRes.json()
      const bJson = await brandsRes.json()
      setWorkflows(wJson.data || [])
      setBrands(bJson.data || [])
    } catch (err) {
      console.error('Failed to load dashboard:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedBrand])

  useEffect(() => {
    loadData()
  }, [loadData])

  const completedCount = workflows.filter((w) => w.status === 'completed').length
  const failedCount = workflows.filter((w) => w.status === 'failed').length
  const runningCount = workflows.filter((w) => w.status === 'running').length
  const lastRun = workflows[0]

  // At-a-glance KPIs — distinct from the per-job Workflows page. Each links to
  // the section that owns the number.
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

  // Quick jumps along the core flow.
  const quickLinks = [
    {
      label: 'GEO Score',
      desc: 'How well AI engines surface you',
      icon: Target,
      href: '/dashboard/geo-score',
    },
    {
      label: 'Citation Sources',
      desc: 'Where AI cites you',
      icon: Link2,
      href: '/dashboard/citation-sources',
    },
    {
      label: 'Strategy Advisor',
      desc: 'Prioritised next actions',
      icon: Sparkles,
      href: '/dashboard/advisor',
    },
    {
      label: 'Prompts',
      desc: 'Generate & manage prompts',
      icon: MessageSquare,
      href: '/dashboard/prompts',
    },
  ]

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Pages / Dashboard</p>
            <h1 className="mt-1 text-[34px] font-bold tracking-tight text-foreground">
              {t('page_subtitle')}
            </h1>
          </div>
          <select
            className="rounded-xl border border-border bg-input px-4 py-2 text-sm text-foreground"
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
          >
            <option value="">{t('all_brands')}</option>
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

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Recent activity — compact summary, not the full Workflows page */}
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
                          {brandName && (
                            <span className="text-muted-foreground"> · {brandName}</span>
                          )}
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

          {/* Quick jumps */}
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-bold text-foreground">Jump to</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {quickLinks.map(({ label, desc, icon: Icon, href }) => (
                <Link
                  key={label}
                  href={href}
                  className="bg-secondary/40 group flex items-start gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-secondary"
                >
                  <div className="bg-primary/15 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 text-sm font-semibold text-foreground">
                      {label}
                      <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
                    </p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </PageTransition>
  )
}
