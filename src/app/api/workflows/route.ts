import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createServerClient } from '@/lib/supabase'
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
    console.error(
      '[workflows] Failed to create workflow:',
      JSON.stringify({
        error: String(error),
        details: error.details,
        hint: error.hint,
        code: error.code,
        message: error.message,
      }),
    )
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

    let query = supabase
      .from('workflow_executions')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit)

    if (brandId) {
      query = query.eq('brand_id', brandId)
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

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    if (!supabase) {
      return NextResponse.json(
        { success: false, message: 'Database not configured' },
        { status: 503 },
      )
    }

    const body = await request.json()
    const { type, brandId, promptId, userId, metadata } = body as CreateWorkflowInput

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

    const workflow = await createWorkflow(supabase, { type, brandId, promptId, userId, metadata })

    if (!workflow) {
      return NextResponse.json(
        { success: false, message: 'Failed to create workflow' },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, data: workflow }, { status: 201 })
  } catch (err) {
    console.error('[workflows] POST error:', err)
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: String(err) },
      { status: 500 },
    )
  }
}

export { createWorkflow, completeWorkflow }
