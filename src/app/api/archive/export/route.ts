// PATH: src/app/api/archive/export/route.ts
// POST /api/archive/export - Create export job
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { verifyBrandAccess } from '@/lib/authorize'

export async function POST(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return NextResponse.json({ success: false, message: 'Authentication failed' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 })
  }

  const { brand_id, format, date_from, date_to, tool_filters, options } = body as {
    brand_id?: string
    format?: string
    date_from?: string
    date_to?: string
    tool_filters?: string[]
    options?: {
      include_charts?: boolean
      include_sentiment_evolution?: boolean
      include_recommendations_summary?: boolean
    }
  }

  if (!brand_id) {
    return NextResponse.json({ success: false, message: 'brand_id is required' }, { status: 400 })
  }

  if (!format || !['pdf', 'xlsx', 'json', 'csv'].includes(format)) {
    return NextResponse.json({ success: false, message: 'Invalid format' }, { status: 400 })
  }

  // Validate date range (max 90 days)
  if (date_from && date_to) {
    const from = new Date(date_from)
    const to = new Date(date_to)
    const daysDiff = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)
    if (daysDiff > 90 || daysDiff < 0) {
      return NextResponse.json(
        { success: false, message: 'Date range cannot exceed 90 days' },
        { status: 400 },
      )
    }
  }

  const db = createServerClient()
  if (!db) {
    return NextResponse.json(
      { success: false, message: 'Database not configured' },
      { status: 503 },
    )
  }

  const brand = await verifyBrandAccess(brand_id, userId)
  if (!brand) {
    return NextResponse.json(
      { success: false, message: 'Brand not found or access denied' },
      { status: 403 },
    )
  }

  try {
    // Get organization_id
    const { data: brandData } = (await db
      .from('brands')
      .select('organization_id')
      .eq('id', brand_id)
      .single()) as any

    // Create export job
    const jobId = crypto.randomUUID()
    const { error: insertError } = await db.from('query_export_jobs' as any).insert({
      id: jobId,
      user_id: userId,
      organization_id: brandData?.organization_id,
      brand_id,
      format,
      date_from,
      date_to,
      tool_filters: tool_filters || [],
      include_charts: options?.include_charts ?? true,
      include_sentiment_evolution: options?.include_sentiment_evolution ?? true,
      include_recommendations_summary: options?.include_recommendations_summary ?? true,
      status: 'pending',
    } as any)

    if (insertError) throw insertError

    // In production, you would queue this job to a worker
    // For now, we'll process it synchronously or return job ID for polling

    return NextResponse.json({
      success: true,
      data: {
        jobId,
        status: 'pending',
        format,
        estimatedCompletionTime: new Date(Date.now() + 60000).toISOString(),
      },
    })
  } catch (error) {
    console.error('[archive/export] Error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to create export job' },
      { status: 500 },
    )
  }
}

// GET /api/archive/export?job_id=xxx - Get export job status
export async function GET(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return NextResponse.json({ success: false, message: 'Authentication failed' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const jobId = searchParams.get('job_id')

  if (!jobId) {
    return NextResponse.json({ success: false, message: 'job_id is required' }, { status: 400 })
  }

  const db = createServerClient()
  if (!db) {
    return NextResponse.json(
      { success: false, message: 'Database not configured' },
      { status: 503 },
    )
  }

  try {
    const { data: job, error } = (await db
      .from('query_export_jobs' as any)
      .select('*')
      .eq('id', jobId)
      .eq('user_id', userId)
      .single()) as any

    if (error || !job) {
      return NextResponse.json({ success: false, message: 'Job not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        jobId: job.id,
        status: job.status,
        progress: job.progress_percent,
        format: job.format,
        createdAt: job.created_at,
        completedAt: job.completed_at,
        fileUrl: job.file_url,
        expiresAt: job.expires_at,
        errorMessage: job.error_message,
      },
    })
  } catch (error) {
    console.error('[archive/export] Get error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to get job status' },
      { status: 500 },
    )
  }
}
