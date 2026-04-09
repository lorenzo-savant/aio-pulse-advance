export type WorkflowStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'retrying'

export type WorkflowType =
  | 'monitoring_run'
  | 'brand_setup'
  | 'alert_evaluation'
  | 'data_export'
  | 'health_score_calc'

export interface WorkflowStep {
  id: string
  name: string
  status: WorkflowStatus
  startedAt?: string
  completedAt?: string
  error?: string
  retryCount?: number
}

export interface WorkflowExecution {
  id: string
  type: WorkflowType
  brandId?: string
  promptId?: string
  status: WorkflowStatus
  steps: WorkflowStep[]
  startedAt: string
  completedAt?: string
  error?: string
  metadata?: Record<string, unknown>
}

export interface RetryConfig {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
}

export function calculateRetryDelay(attempt: number, config: RetryConfig): number {
  const delay = Math.min(
    config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt),
    config.maxDelayMs,
  )
  return delay + Math.random() * 1000
}

export function createWorkflow(
  type: WorkflowType,
  brandId?: string,
  promptId?: string,
  steps?: string[],
): WorkflowExecution {
  return {
    id: `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    type,
    brandId,
    promptId,
    status: 'pending',
    steps: (steps || getDefaultSteps(type)).map((name, i) => ({
      id: `step_${i}`,
      name,
      status: 'pending',
    })),
    startedAt: new Date().toISOString(),
  }
}

function getDefaultSteps(type: WorkflowType): string[] {
  switch (type) {
    case 'monitoring_run':
      return [
        'Initialize',
        'Fetch AI Engines',
        'Process Results',
        'Save to Database',
        'Check Alerts',
        'Complete',
      ]
    case 'brand_setup':
      return ['Create Brand', 'Setup Prompts', 'Configure Alerts', 'Complete']
    case 'alert_evaluation':
      return ['Load Rules', 'Evaluate Conditions', 'Send Notifications', 'Complete']
    case 'data_export':
      return ['Collect Data', 'Format Data', 'Generate Export', 'Notify User']
    case 'health_score_calc':
      return ['Load Data', 'Calculate Scores', 'Save Results', 'Complete']
    default:
      return ['Start', 'Process', 'Complete']
  }
}

export function updateWorkflowStep(
  workflow: WorkflowExecution,
  stepIndex: number,
  status: WorkflowStatus,
  error?: string,
): WorkflowExecution {
  const steps = [...workflow.steps]
  const currentStep = steps[stepIndex]
  if (!currentStep) return workflow

  steps[stepIndex] = {
    ...currentStep,
    status,
    completedAt:
      status === 'completed' || status === 'failed' ? new Date().toISOString() : undefined,
    startedAt: currentStep.startedAt || new Date().toISOString(),
    error,
  }

  let overallStatus = workflow.status
  if (status === 'running' && workflow.status === 'pending') {
    overallStatus = 'running'
  } else if (status === 'failed') {
    overallStatus = 'failed'
  } else if (status === 'completed' && steps.every((s) => s.status === 'completed')) {
    overallStatus = 'completed'
  }

  return {
    ...workflow,
    status: overallStatus,
    steps,
    completedAt: overallStatus === 'completed' ? new Date().toISOString() : undefined,
    error: status === 'failed' ? error : undefined,
  }
}

export function getWorkflowProgress(workflow: WorkflowExecution): number {
  if (workflow.steps.length === 0) return 0
  const completed = workflow.steps.filter((s) => s.status === 'completed').length
  return Math.round((completed / workflow.steps.length) * 100)
}

export function getStepStatusColor(status: WorkflowStatus): string {
  switch (status) {
    case 'completed':
      return 'text-emerald-400'
    case 'running':
      return 'text-brand-400'
    case 'failed':
      return 'text-red-400'
    case 'retrying':
      return 'text-amber-400'
    case 'cancelled':
      return 'text-gray-400'
    default:
      return 'text-gray-500'
  }
}

export function formatDuration(startedAt: string, completedAt?: string): string {
  const start = new Date(startedAt).getTime()
  const end = completedAt ? new Date(completedAt).getTime() : Date.now()
  const seconds = Math.floor((end - start) / 1000)

  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
}
