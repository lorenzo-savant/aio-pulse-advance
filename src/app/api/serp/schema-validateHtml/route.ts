import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { validateHtml } from '@/lib/services/schema-validator'
import { requireUser, rateLimitGate } from '@/lib/api-auth'
import { firstZodMessage } from '@/lib/validations'

export const runtime = 'nodejs'
export const maxDuration = 60

const schemaValidateHtmlSchema = z.object({
  html: z.string().min(1, 'Missing required field: html').max(5_000_000),
  url: z.string().max(2048).optional(),
})

export async function POST(request: NextRequest) {
  // Auth + rate limit gate — schema validation runs a 60s-budget CPU-bound
  // cheerio parse on user-supplied HTML; previously unauthenticated, so any
  // attacker could feed arbitrarily large payloads. 30/min/user is generous
  // for legit dashboard use.
  const auth = await requireUser(request)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const rl = await rateLimitGate(request, `schema-validate:${userId}`, 30)
  if (rl) return rl

  try {
    const parsed = schemaValidateHtmlSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodMessage(parsed.error) }, { status: 400 })
    }
    const { html, url } = parsed.data

    const result = await validateHtml(html, url)

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    return NextResponse.json(
      {
        error: `Error validating schema: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 },
    )
  }
}
