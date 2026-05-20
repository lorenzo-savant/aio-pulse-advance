import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { generatePrompts } from '@/lib/services/prompt-generator'
import type { Locale } from '@/lib/services/prompt-generator'

const schema = z.object({
  brand: z.string().min(1).max(200),
  industryId: z.string().min(1),
  locale: z.enum(['en', 'it', 'sv']),
  location: z.string().max(200).optional(),
})

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    )
  }

  const { brand, industryId, locale, location } = parsed.data

  const prompts = generatePrompts(brand, industryId, locale as Locale, location)

  if (prompts.length === 0) {
    return NextResponse.json(
      { success: false, message: 'Industry preset not found' },
      { status: 404 },
    )
  }

  return NextResponse.json({
    success: true,
    data: prompts,
    total: prompts.length,
  })
}
