import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import type { WorkflowExecution, WorkflowStatus, WorkflowType } from '@/types'

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
      console.error('Failed to fetch workflows:', error)
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
    console.error('Workflows API error:', err)
    return NextResponse.json(
      { success: false, message: 'Internal server error', data: [] },
      { status: 500 },
    )
  }
}
