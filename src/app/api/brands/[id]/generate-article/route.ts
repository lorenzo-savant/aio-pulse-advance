// PATH: src/app/api/brands/[id]/generate-article/route.ts
//
// POST → generates a Markdown article optimised against the 5 industry research
// AI-citation signals (clarity / EEAT / Q&A / structure / structured-
// data) and auto-scores it. Reuses brand context from the DB so the
// caller only sends the topic + intent + length + optional format hint.

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
import {
  generateArticle,
  type ArticleBrandContext,
  type ArticleIntent,
  type ArticleLength,
} from '@/lib/services/article-generator'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

const bodySchema = z.object({
  topic: z.string().min(3).max(300),
  intent: z.enum(['B1', 'B2', 'B3', 'B4', 'B5']),
  length: z.enum(['short', 'medium', 'long']).default('medium'),
  formatHint: z.enum(['paragraph', 'faq', 'comparison', 'how-to', 'table', 'list']).optional(),
})

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

async function loadBrandContext(
  db: NonNullable<ReturnType<typeof createServerClient>>,
  brandId: string,
  userId: string,
): Promise<ArticleBrandContext | null> {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data, error } = await (db as any)
    .from('brands')
    .select(
      'name, domain, description, industry, aliases, competitors, same_as, disambiguation, citation_format, legal_id, legal_id_type, language',
    )
    .eq('id', brandId)
    .eq('user_id', userId)
    .single()
  /* eslint-enable @typescript-eslint/no-explicit-any */
  if (error || !data) return null
  return {
    name: data.name,
    domain: data.domain,
    description: data.description,
    industry: data.industry,
    aliases: data.aliases,
    competitors: data.competitors,
    sameAs: data.same_as,
    disambiguation: data.disambiguation,
    citationFormat: data.citation_format,
    legalId: data.legal_id,
    legalIdType: data.legal_id_type,
    locale: data.language as ArticleBrandContext['locale'],
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params

  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const brand = await verifyBrandAccess(id, userId)
  if (!brand) return err('Brand not found or access denied', 404)

  const ip = getClientIp(req.headers)
  // Tighter than other routes — each call burns LLM tokens, may take
  // 10-30s on long-form generation. 5/min is generous for human use.
  const rate = await checkRateLimit(`generate-article:${ip}`, 5, 60_000)
  if (!rate.success) return err('Rate limit exceeded', 429)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON body', 400)
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  const brandContext = await loadBrandContext(db, id, userId)
  if (!brandContext) return err('Brand context not loadable', 404)

  try {
    const output = await generateArticle({
      brand: brandContext,
      topic: parsed.data.topic,
      intent: parsed.data.intent as ArticleIntent,
      length: parsed.data.length as ArticleLength,
      formatHint: parsed.data.formatHint,
    })
    return NextResponse.json({ success: true, data: output, timestamp: Date.now() })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    logger.warn('/api/generate-article failed', { brandId: id, err: message })
    return err(`Generation failed: ${message}`, 502)
  }
}
