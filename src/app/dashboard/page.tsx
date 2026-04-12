'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/index'
import { formatRelativeTime, cn } from '@/lib/utils'
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ChevronRight,
  AlertTriangle,
  Activity,
} from 'lucide-react'
import type { Brand, WorkflowExecution } from '@/types'
import { PageTransition, StaggerGrid, StaggerItem, ExpandSection } from '@/components/ui/Motion'
import { AVIScoreCard } from '@/components/dashboard/AVIScoreCard'

const STATUS_CONFIG: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  completed: { color: 'text-success', icon: CheckCircle2, label: 'Completed' },
  running: { color: 'text-brand', icon: Loader2, label: 'Running' },
  failed: { color: 'text-error', icon: XCircle, label: 'Failed' },
  pending: { color: 'text-muted-foreground', icon: Clock, label: 'Pending' },
  retrying: { color: 'text-warning', icon: AlertTriangle, label: 'Retrying' },
  cancelled: { color: 'text-muted-foreground', icon: XCircle, label: 'Cancelled' },
}

function getStatusConfig(status: string): {
  color: string
  icon: React.ElementType
  label: string
} {
  return STATUS_CONFIG[status] || STATUS_CONFIG.pending!
}

const WORKFLOW_TYPE_LABELS: Record<string, string> = {
  monitoring_run: 'Monitoring Run',
  brand_setup: 'Brand Setup',
  alert_evaluation: 'Alert Evaluation',
  data_export: 'Data Export',
  health_score_calc: 'Health Score',
}

export default function WorkflowStatusPage() {
  const t = useTranslations('dashboard')
  const [workflows, setWorkflows] = useState<WorkflowExecution[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBrand, setSelectedBrand] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedBrand) params.set('brand_id', selectedBrand)
      params.set('limit', '50')

      const [workflowsRes, brandsRes] = await Promise.all([
        fetch(`/api/workflows?${params}`),
        fetch('/api/brands'),
      ])

      const wJson = await workflowsRes.json()
      const bJson = await brandsRes.json()

      setWorkflows(wJson.data || [])
      setBrands(bJson.data || [])
    } catch (err) {
      console.error('Failed to load workflows:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedBrand])

  useEffect(() => {
    loadData()
  }, [loadData])

  const rerunWorkflow = async (id: string) => {
    try {
      const res = await fetch(`/api/workflows?id=${id}&action=rerun`, { method: 'POST' })
      if (res.ok) {
        loadData()
      }
    } catch (err) {
      console.error('Failed to rerun workflow:', err)
    }
  }

  const cancelWorkflow = async (id: string) => {
    try {
      const res = await fetch(`/api/workflows?id=${id}&action=cancel`, { method: 'POST' })
      if (res.ok) {
        loadData()
      }
    } catch (err) {
      console.error('Failed to cancel workflow:', err)
    }
  }

  const runningCount = workflows.filter((w) => w.status === 'running').length
  const failedCount = workflows.filter((w) => w.status === 'failed').length
  const completedCount = workflows.filter((w) => w.status === 'completed').length

  const stats = [
    { label: t('total'), value: workflows.length, icon: Activity, color: 'brand' },
    { label: t('running'), value: runningCount, icon: Loader2, color: 'brand' },
    { label: t('failed'), value: failedCount, icon: XCircle, color: 'error' },
    { label: t('completed'), value: completedCount, icon: CheckCircle2, color: 'success' },
  ]

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Pages / Dashboard</p>
            <h1 className="mt-1 text-[34px] font-bold tracking-tight text-foreground">
              {t('page_subtitle')}
            </h1>
          </div>
          <div className="flex items-center gap-4">
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
        </div>

        {/* AVI Score Widget */}
        <AVIScoreCard brandId={selectedBrand || undefined} />

        {/* Stats */}
        <StaggerGrid className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <StaggerItem key={label}>
              <div className="stat-card card-horizon">
                <div
                  className={cn(
                    'stat-icon',
                    color === 'brand' && 'bg-brand-gradient',
                    color === 'error' && 'bg-gradient-to-br from-error to-red-600',
                    color === 'success' && 'bg-gradient-to-br from-success to-emerald-600',
                  )}
                >
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{label}</p>
                  <p className="text-[34px] font-bold leading-none tracking-tight text-foreground">
                    {value}
                  </p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerGrid>

        {/* Workflow List */}
        <Card className="overflow-hidden">
          <div className="divide-y divide-border">
            {loading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-brand" />
              </div>
            ) : workflows.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">{t('no_workflows')}</div>
            ) : (
              workflows.map((workflow) => {
                const statusConfig = getStatusConfig(workflow.status)
                const StatusIcon = statusConfig.icon
                const isExpanded = expandedId === workflow.id

                return (
                  <div key={workflow.id} className="transition-colors hover:bg-secondary">
                    <div
                      className="flex cursor-pointer items-center gap-4 p-4"
                      onClick={() => setExpandedId(isExpanded ? null : workflow.id)}
                    >
                      <StatusIcon className={cn('h-5 w-5 shrink-0', statusConfig.color)} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">
                          {WORKFLOW_TYPE_LABELS[workflow.type] || workflow.type}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatRelativeTime(workflow.startedAt)}
                        </p>
                      </div>
                      <Badge
                        variant={
                          workflow.status === 'completed'
                            ? 'success'
                            : workflow.status === 'failed'
                              ? 'danger'
                              : 'default'
                        }
                      >
                        {statusConfig.label}
                      </Badge>
                      <ChevronRight
                        className={cn(
                          'h-5 w-5 text-muted-foreground transition-transform',
                          isExpanded && 'rotate-90',
                        )}
                      />
                    </div>

                    {/* Expanded Details */}
                    <ExpandSection isOpen={isExpanded}>
                      <div className="border-t border-border bg-secondary p-4">
                        <div className="mb-4 flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              rerunWorkflow(workflow.id)
                            }}
                            className="hover:bg-brand-muted/80 flex items-center gap-1 rounded-lg bg-brand-muted px-3 py-1.5 text-xs font-medium text-brand"
                          >
                            <RotateCcw className="h-3 w-3" />
                            {t('rerun')}
                          </button>
                          {workflow.status === 'running' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                cancelWorkflow(workflow.id)
                              }}
                              className="hover:bg-error-muted/80 flex items-center gap-1 rounded-lg bg-error-muted px-3 py-1.5 text-xs font-medium text-error"
                            >
                              <Pause className="h-3 w-3" />
                              {t('cancel')}
                            </button>
                          )}
                        </div>

                        {workflow.error && (
                          <div className="bg-error-muted/30 mb-4 rounded-lg border border-error-muted p-3">
                            <p className="text-xs text-error">{workflow.error}</p>
                          </div>
                        )}

                        {/* Steps */}
                        <div className="space-y-2">
                          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            {t('steps')}
                          </p>
                          {workflow.steps.map((step, i) => {
                            const stepStatus = getStatusConfig(step.status)
                            const StepIcon = stepStatus.icon
                            return (
                              <div key={i} className="flex items-center gap-3 text-sm">
                                <StepIcon className={cn('h-4 w-4', stepStatus.color)} />
                                <span className="text-foreground/70">{step.name}</span>
                                {step.error && (
                                  <span className="max-w-xs truncate text-xs text-error">
                                    {step.error}
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </ExpandSection>
                  </div>
                )
              })
            )}
          </div>
        </Card>
      </div>
    </PageTransition>
  )
}
