// PATH: src/app/api/brands/[id]/llms-text/route.ts
//
// GET /api/brands/[id]/llms-text?variant=short|full
//
// Returns the latest persisted llms.txt (or llms-full.txt) for a brand
// as text/plain, with a Content-Disposition that makes browsers offer
// "Save as" with a sensible filename. The operator points the browser
// at this URL, hits Ctrl+S, then uploads the file to the brand site's
// root (the AI crawlers fetch `acasting.se/llms.txt`, not
// `aio-pulse-advance.app/api/...`).
//
// Reads the most-recent llms_txt_versions row — generation itself is
// done via POST /api/generate/llms-txt; this endpoint is a delivery
// helper so the operator never has to copy JSON out of a console.

import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params

  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const brand = await verifyBrandAccess(id, userId)
  if (!brand) {
    return NextResponse.json(
      { success: false, message: 'Brand not found or access denied' },
      { status: 404 },
    )
  }

  const variant = req.nextUrl.searchParams.get('variant') === 'full' ? 'full' : 'short'

  const db = createServerClient()
  if (!db) {
    return NextResponse.json(
      { success: false, message: 'Database not configured' },
      { status: 503 },
    )
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data, error } = await (db as any)
    .from('llms_txt_versions')
    .select('llms_txt, llms_full_txt, created_at')
    .eq('brand_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (error || !data) {
    logger.warn('llms-text: no version exists yet', { brandId: id })
    return NextResponse.json(
      {
        success: false,
        message:
          'No llms.txt has been generated yet. Generate one first via POST /api/generate/llms-txt or the dashboard.',
      },
      { status: 404 },
    )
  }

  const body = variant === 'full' ? (data.llms_full_txt as string) : (data.llms_txt as string)
  if (!body || body.trim().length === 0) {
    return NextResponse.json(
      { success: false, message: `Latest version has no ${variant} body — regenerate.` },
      { status: 404 },
    )
  }

  const filename = variant === 'full' ? 'llms-full.txt' : 'llms.txt'
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, max-age=60',
    },
  })
}
