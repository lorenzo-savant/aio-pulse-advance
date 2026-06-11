import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { generateLlmstxt } from '@/lib/audit/generators'
import { requireUser, rateLimitGate, isValidHttpUrl } from '@/lib/api-auth'
import { firstZodMessage } from '@/lib/validations'
import { SsrfError } from '@/lib/utils/safe-fetch'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const llmsTxtBodySchema = z.object({
  url: z.string().refine(isValidHttpUrl, 'A valid http(s) URL is required'),
  includePaths: z.array(z.string().max(2048)).max(100).optional(),
  excludePaths: z.array(z.string().max(2048)).max(100).optional(),
  maxUrls: z.number().int().positive().max(1000).optional(),
})

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth

  const limited = await rateLimitGate(req, 'audit-llmstxt', 10)
  if (limited) return limited

  try {
    const parsed = llmsTxtBodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: firstZodMessage(parsed.error) }, { status: 400 })
    }
    const { url, includePaths, excludePaths, maxUrls } = parsed.data

    const llmstxt = await generateLlmstxt({
      siteUrl: url,
      includePaths: includePaths ?? [],
      excludePaths: excludePaths ?? [],
      maxUrls: maxUrls ?? 200,
    })

    return NextResponse.json({ llmstxt })
  } catch (err) {
    if (err instanceof SsrfError) {
      return NextResponse.json({ error: 'URL not allowed' }, { status: 400 })
    }
    logger.error('llms.txt generation error', { err })
    return NextResponse.json({ error: 'llms.txt generation failed' }, { status: 500 })
  }
}
