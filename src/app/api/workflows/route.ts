import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import { logger } from '@/lib/logger'
import type { WorkflowExecution, WorkflowStatus, WorkflowType } from '@/types'
import type { Json } from '@/types/database'

interface CreateWorkflowInput {
  type: WorkflowType
  brandId?: string
  promptId?: string
  userId?: string
  metadata?: Record<string, unknown>
}

async function createWorkflow(
  supabase: NonNullable<ReturnType<typeof createServerClient>>,
  input: CreateWorkflowInput,
): Promise<WorkflowExecution | null> {
  const workflowId = randomUUID()
  const now = new Date().toISOString()

  const steps = [
    {
      id: randomUUID(),
      name: 'Initializing',
      status: 'completed',
      startedAt: now,
      completedAt: now,
    },
    { id: randomUUID(), name: 'Processing', status: 'running', startedAt: now },
    { id: randomUUID(), name: 'Finalizing', status: 'pending', startedAt: now },
  ]

  const insertData = {
    id: workflowId,
    type: input.type,
    brand_id: input.brandId || null,
    prompt_id: input.promptId || null,
    user_id: input.userId || null,
    status: 'running',
    steps: steps as unknown as Json,
    metadata: (input.metadata || {}) as Json,
    started_at: now,
  }

  const { data, error } = await supabase
    .from('workflow_executions')
    .insert(insertData as never)
    .select()
    .single()

  if (error) {
    logger.error('[workflows] Failed to create workflow', {
      error: String(error),
      details: error.details,
      hint: error.hint,
      code: error.code,
      message: error.message,
    })
    return null
  }

  return {
    id: data.id,
    type: data.type as WorkflowType,
    brandId: data.brand_id || undefined,
    promptId: data.prompt_id || undefined,
    status: data.status as WorkflowStatus,
    steps: (data.steps || []) as unknown as WorkflowExecution['steps'],
    startedAt: data.started_at || now,
    completedAt: data.completed_at || undefined,
    error: data.error || undefined,
    metadata: (data.metadata as Record<string, unknown> | undefined) || undefined,
  }
}

async function completeWorkflow(
  supabase: NonNullable<ReturnType<typeof createServerClient>>,
  workflowId: string,
  status: 'completed' | 'failed',
  errorMsg?: string,
): Promise<void> {
  const { data } = await supabase
    .from('workflow_executions')
    .select('steps')
    .eq('id', workflowId)
    .single()

  if (!data) return

  const steps = (data.steps || []) as Array<{
    id: string
    name: string
    status: WorkflowStatus
    startedAt?: string
    completedAt?: string
    error?: string
  }>

  const now = new Date().toISOString()
  steps.forEach((step) => {
    if (step.status === 'running') {
      step.status = status
      step.completedAt = now
      if (status === 'failed') step.error = errorMsg
    }
  })

  await supabase
    .from('workflow_executions')
    .update({
      status,
      steps: steps as unknown as Json,
      completed_at: now,
      error: status === 'failed' ? errorMsg : null,
    })
    .eq('id', workflowId)
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request)
    if (auth instanceof NextResponse) return auth
    const { userId } = auth

    const supabase = createServerClient()
    if (!supabase) {
      return NextResponse.json(
        { success: false, message: 'Database not configured', data: [] },
        { status: 503 },
      )
    }
    const searchParams = request.nextUrl.searchParams
    const brandId = searchParams.get('brand_id')
    const limit = parseInt(searchParams.get('limit') || '50', 10) || 50

    // brand_id is OPTIONAL. The previous behavior (400 if missing) broke the
    // /dashboard/workflows landing experience: the page mounts with no brand
    // selected, fires GET with no brand_id, gets 400, shows zero workflows.
    // If a brand is given, enforce access on it. If omitted, fall back to
    // workflows the caller is entitled to see — either workflows scoped to
    // brands they have access to, or workflows directly owned by the user
    // (e.g. brand_setup before a brand exists, data exports, etc.).
    let query = supabase
      .from('workflow_executions')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit)

    if (brandId) {
      if (!(await verifyBrandAccess(brandId, userId))) {
        return NextResponse.json(
          { success: false, message: 'Forbidden', data: [] },
          { status: 403 },
        )
      }
      query = query.eq('brand_id', brandId)
    } else {
      // No brand specified — restrict to the rows the user owns directly
      // OR to brands they have access to. Workspace-level multi-tenancy
      // makes the second part complex; for now, scope strictly to
      // user_id = userId. Workflows for shared brands still show up when
      // the caller picks that brand in the dropdown.
      query = query.eq('user_id', userId)
    }

    const { data, error } = await query

    if (error) {
      logger.error('Failed to fetch workflows', { source: 'workflows', error: String(error) })
      return NextResponse.json(
        { success: false, message: 'Failed to fetch workflows', data: [] },
        { status: 500 },
      )
    }

    const workflows: WorkflowExecution[] = (data || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      type: row.type as WorkflowType,
      brandId: row.brand_id as string | undefined,
      promptId: row.prompt_id as string | undefined,
      status: row.status as WorkflowStatus,
      steps: (row.steps || []) as WorkflowExecution['steps'],
      startedAt: row.started_at as string,
      completedAt: row.completed_at as string | undefined,
      error: row.error as string | undefined,
      metadata: row.metadata as Record<string, unknown> | undefined,
    }))

    return NextResponse.json({
      success: true,
      data: workflows,
      timestamp: Date.now(),
    })
  } catch (err) {
    logger.error('Workflows API error', { source: 'workflows', error: String(err) })
    return NextResponse.json(
      { success: false, message: 'Internal server error', data: [] },
      { status: 500 },
    )
  }
}

interface WorkflowRow {
  id: string
  type: string
  brand_id: string | null
  prompt_id: string | null
  user_id: string | null
  status: string
  steps: unknown
}

// Load a workflow by id and enforce that the caller can act on it: brand-scoped
// workflows require brand access, otherwise the caller must own the row.
async function loadAccessibleWorkflow(
  supabase: NonNullable<ReturnType<typeof createServerClient>>,
  workflowId: string,
  userId: string,
): Promise<WorkflowRow | NextResponse> {
  const { data, error } = await supabase
    .from('workflow_executions')
    .select('id, type, brand_id, prompt_id, user_id, status, steps')
    .eq('id', workflowId)
    .single()

  if (error || !data) {
    return NextResponse.json({ success: false, message: 'Workflow not found' }, { status: 404 })
  }

  const row = data as unknown as WorkflowRow
  const hasAccess = row.brand_id
    ? !!(await verifyBrandAccess(row.brand_id, userId))
    : row.user_id === userId
  if (!hasAccess) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
  }
  return row
}

// Cancel: mark the workflow (and any still-open steps) cancelled. Terminal
// workflows cannot be cancelled.
async function cancelWorkflowExecution(
  supabase: NonNullable<ReturnType<typeof createServerClient>>,
  row: WorkflowRow,
): Promise<NextResponse> {
  if (!['running', 'pending', 'retrying'].includes(row.status)) {
    return NextResponse.json(
      { success: false, message: `Cannot cancel a ${row.status} workflow` },
      { status: 409 },
    )
  }

  const now = new Date().toISOString()
  const steps = (Array.isArray(row.steps) ? row.steps : []) as Array<{
    id: string
    name: string
    status: string
    startedAt?: string
    completedAt?: string
    error?: string
  }>
  for (const step of steps) {
    if (step.status === 'running' || step.status === 'pending') {
      step.status = 'cancelled'
      step.completedAt = now
    }
  }

  const { error } = await supabase
    .from('workflow_executions')
    .update({
      status: 'cancelled',
      steps: steps as unknown as Json,
      completed_at: now,
      error: 'Cancelled by user',
    })
    .eq('id', row.id)

  if (error) {
    logger.error('[workflows] cancel failed', { error: String(error), id: row.id })
    return NextResponse.json(
      { success: false, message: 'Failed to cancel workflow' },
      { status: 500 },
    )
  }
  return NextResponse.json({ success: true, data: { id: row.id, status: 'cancelled' } })
}

// Rerun: re-dispatch the real job. Only monitoring_run has a concrete
// executor, so we delegate to the canonical /api/monitoring pipeline (which
// records its own fresh workflow_executions row). No logic is duplicated and
// there is no fake "flip the status" rerun.
async function rerunWorkflowExecution(
  request: NextRequest,
  row: WorkflowRow,
): Promise<NextResponse> {
  if (row.type !== 'monitoring_run' || !row.prompt_id) {
    return NextResponse.json(
      {
        success: false,
        message: `Rerun is only supported for monitoring_run workflows with a prompt (got "${row.type}")`,
      },
      { status: 400 },
    )
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const cookie = request.headers.get('cookie')
  const authz = request.headers.get('authorization')
  if (cookie) headers.cookie = cookie
  if (authz) headers.authorization = authz

  let res: Response
  try {
    res = await fetch(new URL('/api/monitoring', request.nextUrl.origin), {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt_id: row.prompt_id }),
    })
  } catch (e) {
    logger.error('[workflows] rerun dispatch failed', { error: String(e), id: row.id })
    return NextResponse.json(
      { success: false, message: 'Failed to dispatch monitoring rerun' },
      { status: 502 },
    )
  }

  const payload = (await res.json().catch(() => ({}))) as { message?: string }
  return NextResponse.json(
    {
      success: res.ok,
      message: res.ok ? 'Monitoring rerun dispatched' : (payload.message ?? 'Rerun failed'),
      data: { rerunOf: row.id, promptId: row.prompt_id, monitoring: payload },
    },
    { status: res.ok ? 202 : res.status },
  )
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request)
    if (auth instanceof NextResponse) return auth
    const { userId } = auth

    const supabase = createServerClient()
    if (!supabase) {
      return NextResponse.json(
        { success: false, message: 'Database not configured' },
        { status: 503 },
      )
    }

    // ── Action mode: POST /api/workflows?id=<id>&action=rerun|cancel ─────────
    const actionId = request.nextUrl.searchParams.get('id')
    const action = request.nextUrl.searchParams.get('action')
    if (action) {
      if (!actionId) {
        return NextResponse.json(
          { success: false, message: 'id query param is required for this action' },
          { status: 400 },
        )
      }
      if (action !== 'rerun' && action !== 'cancel') {
        return NextResponse.json(
          { success: false, message: `Unknown action "${action}". Use rerun or cancel.` },
          { status: 400 },
        )
      }
      const loaded = await loadAccessibleWorkflow(supabase, actionId, userId)
      if (loaded instanceof NextResponse) return loaded
      return action === 'cancel'
        ? cancelWorkflowExecution(supabase, loaded)
        : rerunWorkflowExecution(request, loaded)
    }

    // ── Create mode: POST /api/workflows  { type, brandId, promptId, ... } ───
    const body = await request.json()
    const { type, brandId, promptId, metadata } = body as CreateWorkflowInput

    if (!type) {
      return NextResponse.json(
        { success: false, message: 'Workflow type is required' },
        { status: 400 },
      )
    }

    const validTypes: WorkflowType[] = [
      'monitoring_run',
      'brand_setup',
      'alert_evaluation',
      'data_export',
      'health_score_calc',
    ]
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        {
          success: false,
          message: `Invalid workflow type. Must be one of: ${validTypes.join(', ')}`,
        },
        { status: 400 },
      )
    }

    // A workflow scoped to a brand requires access to that brand.
    if (brandId && !(await verifyBrandAccess(brandId, userId))) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }

    // userId is taken from the authenticated session, never from the body.
    const workflow = await createWorkflow(supabase, { type, brandId, promptId, userId, metadata })

    if (!workflow) {
      return NextResponse.json(
        { success: false, message: 'Failed to create workflow' },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, data: workflow }, { status: 201 })
  } catch (err) {
    logger.error('[workflows] POST error', { err })
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}

export { createWorkflow, completeWorkflow }
