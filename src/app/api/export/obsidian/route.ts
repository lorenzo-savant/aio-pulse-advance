// PATH: src/app/api/export/obsidian/route.ts
import { formatValidationError } from '@/lib/format-validation-error'
import { type NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId, AuthError } from '@/lib/supabase'
import { z } from 'zod'
import { verifyBrandAccess } from '@/lib/authorize'
import { generateObsidianExport, type ObsidianExportRequest } from '@/lib/services/obsidian-export'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'

const obsidianExportSchema = z.object({
  brandId: z.string().uuid(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
  types: z.array(z.enum(['snapshot', 'hallucination', 'prompt-test', 'brand-overview'])).min(1),
})

export async function POST(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    }
    return NextResponse.json({ success: false, message: 'Authentication failed' }, { status: 401 })
  }

  const ip = getClientIp(req.headers)
  const rateCheck = await checkRateLimit(`export-obsidian:${ip}`, 10, 60_000)
  if (!rateCheck.success) {
    return NextResponse.json(
      { success: false, message: 'Rate limit exceeded. Try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) },
      },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const parseResult = obsidianExportSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json(
      {
        success: false,
        message: formatValidationError(parseResult.error),
        errors: parseResult.error.flatten(),
      },
      { status: 400 },
    )
  }

  const { brandId, dateFrom, dateTo, types } = parseResult.data

  const brand = await verifyBrandAccess(brandId, userId)
  if (!brand) {
    return NextResponse.json(
      { success: false, message: 'Brand not found or access denied' },
      { status: 404 },
    )
  }

  const request: ObsidianExportRequest = {
    brandId,
    brandName: brand.name,
    dateFrom,
    dateTo,
    types,
  }

  const notes = await generateObsidianExport(userId, request)

  return NextResponse.json({
    success: true,
    brand: brand.name,
    dateRange: { from: dateFrom, to: dateTo },
    noteCount: notes.length,
    notes: notes.map((n) => ({
      filename: n.filename,
      path: n.path,
      content: n.content,
    })),
  })
}
