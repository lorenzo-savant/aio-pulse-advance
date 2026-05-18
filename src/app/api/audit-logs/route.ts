import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { listAuditLogs, type AuditLogFilters } from '@/lib/services/audit-log'
import { getCurrentOrganization, checkOrgPermission } from '@/lib/services/organization-auth'

export async function GET(request: NextRequest) {
  try {
    let userId: string
    try {
      userId = await getCurrentUserId(
        request.headers.get('authorization'),
        request.headers.get('cookie'),
      )
    } catch (e) {
      if (e instanceof AuthError)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }

    const db = createServerClient()
    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })
    }

    const org = await getCurrentOrganization(userId)
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    if (!(await checkOrgPermission(userId, org.id, 'view_audit_logs'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const filters: AuditLogFilters = {
      limit: parseInt(searchParams.get('limit') ?? '50'),
      offset: parseInt(searchParams.get('offset') ?? '0'),
    }

    if (searchParams.has('action')) filters.action = searchParams.get('action') as any
    if (searchParams.has('resourceType'))
      filters.resourceType = searchParams.get('resourceType') ?? undefined
    if (searchParams.has('from')) filters.from = new Date(searchParams.get('from')!)
    if (searchParams.has('to')) filters.to = new Date(searchParams.get('to')!)

    const logs = await listAuditLogs(org.id, filters)

    return NextResponse.json(logs)
  } catch (error) {
    logger.error('GET /api/audit-logs failed', { err: error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
