// PATH: src/app/api/aeo-snippets/export/route.ts
// CSV export of snippets for a brand (optionally filtered by keyword/gap).

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

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function GET(req: NextRequest) {
  const userId = await auth(req)
  if (userId instanceof NextResponse) return userId

  const db = createServerClient() as any
  if (!db) {
    return NextResponse.json({ success: false, message: 'Database not configured' }, { status: 503 })
  }

  const brandId = req.nextUrl.searchParams.get('brand_id')
  if (!brandId) {
    return NextResponse.json({ success: false, message: 'brand_id is required' }, { status: 400 })
  }

  const { data: brand } = await db
    .from('brands')
    .select('id, name')
    .eq('id', brandId)
    .eq('user_id', userId)
    .single()
  if (!brand) {
    return NextResponse.json({ success: false, message: 'Brand not found' }, { status: 404 })
  }

  const keyword = req.nextUrl.searchParams.get('keyword')
  const gap = req.nextUrl.searchParams.get('gap')

  let q = db
    .from('aeo_snippets')
    .select('keyword, question, answer, language, gap_status, covered_url, paa_source_url, created_at')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })
    .limit(1000)

  if (keyword) q = q.eq('keyword', keyword)
  if (gap && ['covered', 'gap', 'unknown'].includes(gap)) q = q.eq('gap_status', gap)

  const { data: rows, error } = await q
  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }

  const headers = [
    'keyword', 'question', 'answer', 'language',
    'gap_status', 'covered_url', 'paa_source_url', 'created_at',
  ]
  const lines = [headers.join(',')]
  for (const r of (rows || []) as Array<Record<string, unknown>>) {
    lines.push(headers.map((h) => csvEscape(r[h])).join(','))
  }
  const csv = lines.join('\n')

  const fname = `aeo-snippets-${(brand.name as string || 'brand').replace(/\W+/g, '-')}.csv`
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fname}"`,
    },
  })
}
