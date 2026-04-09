'use client'

import { useState, useEffect, useCallback } from 'react'
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

const STATUS_CONFIG: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  completed: { color: 'text-emerald-400', icon: CheckCircle2, label: 'Completed' },
  running: { color: 'text-primary', icon: Loader2, label: 'Running' },
  failed: { color: 'text-red-400', icon: XCircle, label: 'Failed' },
  pending: { color: 'text-muted-foreground', icon: Clock, label: 'Pending' },
  retrying: { color: 'text-amber-400', icon: AlertTriangle, label: 'Retrying' },
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Workflow Status</h1>
          <p className="mt-1 text-muted-foreground">Track and manage background job executions.</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            className="rounded-xl border border-input bg-input px-4 py-2 text-sm text-foreground"
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
          >
            <option value="">All Brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-4 text-center">
          <Activity className="mx-auto mb-2 h-6 w-6 text-primary" />
          <p className="text-2xl font-black text-foreground">{workflows.length}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </Card>
        <Card className="p-4 text-center">
          <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-primary" />
          <p className="text-2xl font-black text-foreground">{runningCount}</p>
          <p className="text-xs text-muted-foreground">Running</p>
        </Card>
        <Card className="p-4 text-center">
          <XCircle className="mx-auto mb-2 h-6 w-6 text-red-400 text-red-600" />
          <p className="text-2xl font-black text-foreground">{failedCount}</p>
          <p className="text-xs text-muted-foreground">Failed</p>
        </Card>
        <Card className="p-4 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-400 text-emerald-600" />
          <p className="text-2xl font-black text-foreground">
            {workflows.filter((w) => w.status === 'completed').length}
          </p>
          <p className="text-xs text-muted-foreground">Completed</p>
        </Card>
      </div>

      {/* Workflow List */}
      <Card className="overflow-hidden">
        <div className="divide-y divide-border">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : workflows.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              No workflow executions found
            </div>
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
                  {isExpanded && (
                    <div className="animate-in slide-in-from-top-2 bg-secondary/50 border-t border-border bg-secondary p-4">
                      <div className="mb-4 flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            rerunWorkflow(workflow.id)
                          }}
                          className="bg-brand-100 text-brand-700 hover:bg-brand-200 bg-primary/20 text-primary brand-500/30 flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Re-run
                        </button>
                        {workflow.status === 'running' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              cancelWorkflow(workflow.id)
                            }}
                            className="flex items-center gap-1 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/30"
                          >
                            <Pause className="h-3 w-3" />
                            Cancel
                          </button>
                        )}
                      </div>

                      {workflow.error && (
                        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                          <p className="text-xs text-red-400">{workflow.error}</p>
                        </div>
                      )}

                      {/* Steps */}
                      <div className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                          Steps
                        </p>
                        {workflow.steps.map((step, i) => {
                          const stepStatus = getStatusConfig(step.status)
                          const StepIcon = stepStatus.icon
                          return (
                            <div key={i} className="flex items-center gap-3 text-sm">
                              <StepIcon className={cn('h-4 w-4', stepStatus.color)} />
                              <span className="text-foreground/70">{step.name}</span>
                              {step.error && (
                                <span className="max-w-xs truncate text-xs text-red-400">
                                  {step.error}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </Card>
    </div>
  )
}
