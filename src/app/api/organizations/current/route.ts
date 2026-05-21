import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/api-auth'
import { logger } from '@/lib/logger'
import { getCurrentOrganization, getOrganizationMembers } from '@/lib/services/organization-auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request)
    if (auth instanceof NextResponse) return auth
    const { userId } = auth

    const db = createServerClient()
    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })
    }

    const org = await getCurrentOrganization(userId)

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const members = await getOrganizationMembers(org.id)

    const { data: workspaces, error: wsError } = await db
      .from('workspaces')
      .select('id, name, slug')
      .eq('organization_id', org.id)
      .is('deleted_at', null)

    if (wsError) {
      logger.error('Failed to fetch workspaces', { orgId: org.id, err: wsError.message })
    }

    const workspaceWithCounts = (workspaces ?? []).map((ws) => ({
      ...ws,
      memberCount: 0,
    }))

    return NextResponse.json({
      org: {
        ...org,
        memberCount: members.length,
        workspaceCount: workspaceWithCounts.length,
      },
      workspaces: workspaceWithCounts,
    })
  } catch (error) {
    logger.error('GET /api/organizations/current failed', { err: error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
