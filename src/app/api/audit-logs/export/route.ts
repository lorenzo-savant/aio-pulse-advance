import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { listAuditLogs } from '@/lib/services/audit-log'
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
    const filters: any = {
      limit: 10000,
      offset: 0,
    }

    if (searchParams.has('from')) filters.from = new Date(searchParams.get('from')!)
    if (searchParams.has('to')) filters.to = new Date(searchParams.get('to')!)

    const logs = await listAuditLogs(org.id, filters)

    const headers = [
      'id',
      'action',
      'actor_id',
      'actor_type',
      'resource_type',
      'resource_id',
      'ip_address',
      'user_agent',
      'metadata',
      'created_at',
    ]

    const csvRows = [
      headers.join(','),
      ...logs.map((log: any) =>
        headers
          .map((h) => {
            const value = log[h]
            if (value === null || value === undefined) return ''
            const raw = typeof value === 'object' ? JSON.stringify(value) : String(value)
            // CSV formula-injection guard (Excel/Sheets).
            const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw
            return `"${safe.replace(/"/g, '""')}"`
          })
          .join(','),
      ),
    ]

    const csvContent = csvRows.join('\n')

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (error) {
    logger.error('GET /api/audit-logs/export failed', { err: error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
