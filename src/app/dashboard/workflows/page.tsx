// PATH: src/app/dashboard/workflows/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/Card'
import { SectionHelp } from '@/components/help/SectionHelp'
import { Badge } from '@/components/ui/index'
import { formatRelativeTime, cn } from '@/lib/utils'
import { PageTransition, StaggerGrid, StaggerItem, ExpandSection } from '@/components/ui/Motion'
import {
  Pause,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ChevronRight,
  AlertTriangle,
  Activity,
  Workflow,
} from 'lucide-react'
import type { Brand, WorkflowExecution } from '@/types'

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

// One-line explanation of what each job type actually does, surfaced in the
// expanded row so the list isn't just opaque labels.
const WORKFLOW_TYPE_DESC: Record<string, string> = {
  monitoring_run:
    'Queried one of your prompts across the selected AI engines, scored the responses, and updated the brand metrics.',
  brand_setup: 'Created and initialised a brand and its starter prompts.',
  alert_evaluation: 'Evaluated alert rules against the latest monitoring data.',
  data_export: 'Built an export of your monitoring data.',
  health_score_calc: 'Recomputed the brand health / AVI score from monitoring results.',
}

// Compact run duration, e.g. "3.2s" or "1m 04s".
function formatDuration(start?: string, end?: string): string | null {
  if (!start || !end) return null
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (!Number.isFinite(ms) || ms < 0) return null
  if (ms < 1000) return `${ms}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  const m = Math.floor(s / 60)
  return `${m}m ${String(Math.round(s % 60)).padStart(2, '0')}s`
}

// Read the engines list the monitoring run targeted from its metadata.
function metaEngines(meta: Record<string, unknown> | undefined): string[] {
  const e = meta?.['engines']
  return Array.isArray(e) ? e.filter((x): x is string => typeof x === 'string') : []
}
function metaPromptText(meta: Record<string, unknown> | undefined): string | null {
  const p = meta?.['promptText']
  return typeof p === 'string' && p.trim() ? p.trim() : null
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowExecution[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBrand, setSelectedBrand] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
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

      if (!workflowsRes.ok || !wJson.success) {
        // Surface the API error to the user instead of leaving them on an
        // empty list with no clue. Previously this just silently set
        // workflows=[] and the page looked broken.
        setError(wJson.message || `Failed to load workflows (HTTP ${workflowsRes.status})`)
      }

      setWorkflows(wJson.data || [])
      setBrands(bJson.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflows')
    } finally {
      setLoading(false)
    }
  }, [selectedBrand])

  useEffect(() => {
    loadData()
  }, [loadData])

  const rerunWorkflow = async (id: string) => {
    setError(null)
    try {
      const res = await fetch(`/api/workflows?id=${id}&action=rerun`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.message || `Rerun failed (HTTP ${res.status})`)
        return
      }
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rerun failed')
    }
  }

  const cancelWorkflow = async (id: string) => {
    setError(null)
    try {
      const res = await fetch(`/api/workflows?id=${id}&action=cancel`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.message || `Cancel failed (HTTP ${res.status})`)
        return
      }
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancel failed')
    }
  }

  const filteredWorkflows = workflows.filter(
    (w) => filterStatus === 'all' || w.status === filterStatus,
  )

  const runningCount = workflows.filter((w) => w.status === 'running').length
  const failedCount = workflows.filter((w) => w.status === 'failed').length
  const completedCount = workflows.filter((w) => w.status === 'completed').length

  const stats = [
    { label: 'Total', value: workflows.length, icon: Activity, color: 'brand' },
    { label: 'Running', value: runningCount, icon: Loader2, color: 'brand' },
    { label: 'Failed', value: failedCount, icon: XCircle, color: 'error' },
    { label: 'Completed', value: completedCount, icon: CheckCircle2, color: 'success' },
  ]

  return (
    <PageTransition>
      <div className="space-y-6">
        <SectionHelp section="workflows" />
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Pages / Workflows</p>
            <h1 className="mt-1 text-[34px] font-bold tracking-tight text-foreground">Workflows</h1>
            <p className="mt-1 text-muted-foreground">
              Every background job the platform runs — what ran, when, whether it succeeded, and the
              steps it went through.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              className="rounded-xl border border-border bg-input px-4 py-2 text-sm text-foreground"
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

        {/* Error banner */}
        {error && (
          <Card className="border-error/30 bg-error/5 flex items-start gap-2 p-4 text-sm text-error">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">
              <p className="font-medium">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-error/70 text-xs hover:text-error"
            >
              Dismiss
            </button>
          </Card>
        )}

        {/* What this page is for */}
        <Card className="bg-secondary/40 flex items-start gap-3 p-4 text-sm text-muted-foreground">
          <Activity className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">What you get from this page</p>
            <p>
              A complete audit trail of automated work. The most common job is a{' '}
              <span className="font-medium text-foreground">Monitoring Run</span>: it sends one of
              your prompts to the AI engines, scores the responses (citation, presence, sentiment)
              and updates your metrics. Use it to confirm checks actually ran, see which prompt and
              engines were used, how long each took, and to{' '}
              <span className="font-medium">Re-run</span> or{' '}
              <span className="font-medium">Cancel</span> a job. Expand any row for its steps and
              details.
            </p>
          </div>
        </Card>

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

        {/* Status Filter */}
        <div className="flex gap-1 rounded-xl bg-secondary p-1">
          {['all', 'running', 'completed', 'failed', 'pending'].map((s) => (
            <button
              key={s}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-semibold capitalize transition-all',
                filterStatus === s
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setFilterStatus(s)}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>

        {/* Workflow List */}
        <Card className="overflow-hidden">
          <div className="divide-y divide-border">
            {loading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-brand" />
              </div>
            ) : filteredWorkflows.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-12 text-center">
                <Workflow className="mb-1 h-10 w-10 text-muted-foreground" />
                {workflows.length === 0 ? (
                  // True empty state: there are no rows at all (not just a
                  // filter or brand-scope mismatch). Workflows are created
                  // when a monitoring check runs against a prompt — so guide
                  // the user there explicitly rather than leaving them at a
                  // dead end.
                  <>
                    <p className="font-medium text-foreground">No workflow executions yet</p>
                    <p className="max-w-sm text-sm text-muted-foreground">
                      A workflow is created every time a monitoring check runs against a prompt.
                      Open a prompt and click <span className="font-semibold">Run</span> to create
                      the first one.
                    </p>
                    <a
                      href="/dashboard/prompts"
                      className="bg-brand-gradient mt-3 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                    >
                      Go to Prompts
                    </a>
                  </>
                ) : (
                  // Rows exist but the active filter / status hides them all.
                  <p className="text-muted-foreground">
                    No workflow executions match the current filter.
                  </p>
                )}
              </div>
            ) : (
              filteredWorkflows.map((workflow) => {
                const statusConfig = getStatusConfig(workflow.status)
                const StatusIcon = statusConfig.icon
                const isExpanded = expandedId === workflow.id

                const brandName = brands.find((b) => b.id === workflow.brandId)?.name
                const duration = formatDuration(workflow.startedAt, workflow.completedAt)
                const promptText = metaPromptText(workflow.metadata)
                const engines = metaEngines(workflow.metadata)

                return (
                  <div key={workflow.id} className="transition-colors hover:bg-secondary">
                    <div
                      className="flex cursor-pointer items-center gap-4 p-4"
                      onClick={() => setExpandedId(isExpanded ? null : workflow.id)}
                    >
                      <StatusIcon
                        className={cn(
                          'h-5 w-5 shrink-0',
                          statusConfig.color,
                          workflow.status === 'running' && 'animate-spin',
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">
                          {WORKFLOW_TYPE_LABELS[workflow.type] || workflow.type}
                          {brandName && (
                            <span className="text-muted-foreground"> · {brandName}</span>
                          )}
                        </p>
                        {promptText && (
                          <p className="truncate text-sm text-muted-foreground">
                            &ldquo;{promptText}&rdquo;
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {formatRelativeTime(workflow.startedAt)}
                          {duration && <span> · took {duration}</span>}
                          {engines.length > 0 && <span> · {engines.length} engines</span>}
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
                            Re-run
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
                              Cancel
                            </button>
                          )}
                        </div>

                        {workflow.error && (
                          <div className="bg-error-muted/30 mb-4 rounded-lg border border-error-muted p-3">
                            <p className="text-xs text-error">{workflow.error}</p>
                          </div>
                        )}

                        {/* What this job did + its run details */}
                        <p className="text-foreground/80 mb-3 text-sm">
                          {WORKFLOW_TYPE_DESC[workflow.type] || 'Background job execution.'}
                        </p>
                        <div className="mb-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                          {brandName && (
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                Brand
                              </p>
                              <p className="text-foreground">{brandName}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                              Started
                            </p>
                            <p className="text-foreground">
                              {new Date(workflow.startedAt).toLocaleString()}
                            </p>
                          </div>
                          {duration && (
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                Duration
                              </p>
                              <p className="text-foreground">{duration}</p>
                            </div>
                          )}
                          {promptText && (
                            <div className="col-span-2 sm:col-span-3">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                Prompt
                              </p>
                              <p className="text-foreground">{promptText}</p>
                            </div>
                          )}
                          {engines.length > 0 && (
                            <div className="col-span-2 sm:col-span-3">
                              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                Engines
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {engines.map((e) => (
                                  <Badge key={e} variant="default" size="sm">
                                    {e}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

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
