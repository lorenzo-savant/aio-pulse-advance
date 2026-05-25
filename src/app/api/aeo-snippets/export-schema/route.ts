// PATH: src/app/api/aeo-snippets/export-schema/route.ts
//
// Bulk FAQPage JSON-LD export — aggregates all AEO snippets for a brand
// (optionally filtered by keyword and gap_status) into a single FAQPage
// blob ready to paste into a page's <head>. The per-snippet route at
// /api/aeo-snippets/[id]/schema already exists, but operators rarely
// want one Q&A on a page — they want the whole cluster for a keyword
// rendered together. This route exists for that copy/paste workflow.
//
// GET /api/aeo-snippets/export-schema?brand_id=…&keyword=…&gap=…&format=json|html

import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { buildFAQPageJsonLd } from '@/lib/services/aeo-snippets'

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

export async function GET(req: NextRequest) {
  const userId = await auth(req)
  if (userId instanceof NextResponse) return userId

  const db = createServerClient() as any
  if (!db) {
    return NextResponse.json(
      { success: false, message: 'Database not configured' },
      { status: 503 },
    )
  }

  const brandId = req.nextUrl.searchParams.get('brand_id')
  if (!brandId) {
    return NextResponse.json({ success: false, message: 'brand_id is required' }, { status: 400 })
  }
  const keyword = req.nextUrl.searchParams.get('keyword')
  const gap = req.nextUrl.searchParams.get('gap')
  const format = (req.nextUrl.searchParams.get('format') || 'json').toLowerCase()
  const download = req.nextUrl.searchParams.get('download') === '1'

  const { data: brand } = await db
    .from('brands')
    .select('id, name')
    .eq('id', brandId)
    .eq('user_id', userId)
    .single()
  if (!brand) {
    return NextResponse.json({ success: false, message: 'Brand not found' }, { status: 404 })
  }

  let q = db
    .from('aeo_snippets')
    .select('question, answer, keyword')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: true })
    .limit(500)
  if (keyword) q = q.eq('keyword', keyword)
  if (gap && ['covered', 'gap', 'unknown'].includes(gap)) q = q.eq('gap_status', gap)

  const { data: rows, error } = await q
  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }

  const items = ((rows || []) as Array<{ question: string; answer: string }>).map((r) => ({
    question: r.question,
    answer: r.answer,
  }))
  const schema = buildFAQPageJsonLd(items)

  const slug = `${(brand.name as string) || 'brand'}${keyword ? `-${keyword}` : ''}`
    .replace(/\W+/g, '-')
    .toLowerCase()

  if (format === 'html') {
    const html = `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>\n`
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        ...(download
          ? { 'Content-Disposition': `attachment; filename="faq-schema-${slug}.html"` }
          : {}),
      },
    })
  }

  if (download) {
    return new NextResponse(JSON.stringify(schema, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/ld+json; charset=utf-8',
        'Content-Disposition': `attachment; filename="faq-schema-${slug}.jsonld"`,
      },
    })
  }

  return NextResponse.json({
    success: true,
    data: { schema, count: items.length, keyword: keyword || null },
    timestamp: Date.now(),
  })
}
