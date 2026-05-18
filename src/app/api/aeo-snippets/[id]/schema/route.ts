// PATH: src/app/api/aeo-snippets/[id]/schema/route.ts
// Returns the FAQPage JSON-LD for a single snippet (ready to paste into HTML).

import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'

/* eslint-disable @typescript-eslint/no-explicit-any */

async function auth(req: NextRequest): Promise<string | NextResponse> {
  try {
    return await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    }
    return NextResponse.json({ success: false, message: 'Authentication failed' }, { status: 401 })
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const userId = await auth(req)
  if (userId instanceof NextResponse) return userId

  const { id } = await ctx.params
  const db = createServerClient() as any
  if (!db) {
    return NextResponse.json(
      { success: false, message: 'Database not configured' },
      { status: 503 },
    )
  }

  const { data: snippet } = await db
    .from('aeo_snippets')
    .select('id, brand_id, schema_jsonld, question, answer')
    .eq('id', id)
    .single()
  if (!snippet) {
    return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 })
  }

  const { data: brand } = await db
    .from('brands')
    .select('id')
    .eq('id', snippet.brand_id as string)
    .eq('user_id', userId)
    .single()
  if (!brand) {
    return NextResponse.json({ success: false, message: 'Access denied' }, { status: 403 })
  }

  return NextResponse.json({ success: true, data: snippet, timestamp: Date.now() })
}
