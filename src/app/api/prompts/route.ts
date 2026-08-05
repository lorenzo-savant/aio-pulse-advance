// PATH: src/app/api/prompts/route.ts
import { formatValidationError } from '@/lib/format-validation-error'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Json } from '@/types/database'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { parsePaginationParams, paginatedResponse } from '@/lib/api-utils'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
import { embedText, mostSimilar, NEAR_DUPLICATE_THRESHOLD } from '@/lib/services/semantic'
import { getAccessibleBrandIds, requireBrandRole } from '@/lib/authorize'
import { logger } from '@/lib/logger'

/* eslint-disable @typescript-eslint/no-explicit-any */

const PROMPT_RATE_LIMIT = 50

// ─── Validation ───────────────────────────────────────────────────────────────

const promptSchema = z.object({
  brand_id: z.string().uuid(),
  text: z.string().min(5).max(500),
  language: z.string().default('en'),
  market: z.string().default('global'),
  category: z.enum(['awareness', 'comparison', 'alternative', 'features', 'custom']).optional(),
  engines: z
    .array(z.enum(['chatgpt', 'gemini', 'perplexity', 'claude']))
    .min(1)
    .default(['chatgpt', 'gemini', 'perplexity', 'claude']),
  run_frequency: z.enum(['hourly', 'daily', 'weekly']).default('daily'),
})

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

// ─── GET /api/prompts ─────────────────────────────────────────────────────────
// Returns prompts for the authenticated user.
// ?brand_id=uuid  → filter by brand
// ?page=1&limit=20 → pagination
export async function GET(req: NextRequest) {
  const identifier = getClientIp(req.headers)
  const { success, remaining, resetAt } = await checkRateLimit(identifier, PROMPT_RATE_LIMIT)

  const response = await getPromptsHandler(req)

  response.headers.set('X-RateLimit-Limit', String(PROMPT_RATE_LIMIT))
  response.headers.set('X-RateLimit-Remaining', String(remaining))
  response.headers.set('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)))

  if (!success) {
    return NextResponse.json(
      {
        success: false,
        message: 'Rate limit exceeded',
        retryAfter: Math.ceil((resetAt - Date.now()) / 1000),
      },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)) } },
    )
  }

  return response
}

async function getPromptsHandler(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return err('Authentication failed')
  }

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brand_id')
  const { page, limit, offset } = parsePaginationParams(searchParams, {
    defaultLimit: 20,
    maxLimit: 100,
  })

  // Scope by BRAND, not by author. A prompt belongs to the brand it was written
  // for, so every collaborator on that brand sees it — filtering on
  // `user_id = <viewer>` returned only the viewer's own prompts and left an
  // invited colleague looking at an empty brand.
  const accessibleBrandIds = await getAccessibleBrandIds(db, userId)

  if (brandId && !accessibleBrandIds.includes(brandId)) {
    return err('Brand not found or access denied', 404)
  }

  const scope = brandId ? [brandId] : accessibleBrandIds

  const query = db
    .from('prompts')
    .select('*, brand:brands(name, color, slug)', { count: 'exact' })
    .in('brand_id', scope)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const { data, error, count } = await query
  if (error) return err(error.message)

  return NextResponse.json({
    success: true,
    ...paginatedResponse(data || [], count, page, limit),
    timestamp: Date.now(),
  })
}

// ─── POST /api/prompts ────────────────────────────────────────────────────────
// Creates a new prompt.
export async function POST(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return err('Authentication failed')
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON body', 400)
  }

  const parsed = promptSchema.safeParse(body)
  if (!parsed.success) {
    logger.debug('Validation failed', {
      source: 'prompts',
      errors: parsed.error.flatten().fieldErrors,
    })
    return NextResponse.json(
      {
        success: false,
        message: formatValidationError(parsed.error),
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    )
  }

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  // Creating a prompt is a write on the brand: owners and editors may, viewers
  // may not. Ownership alone was too narrow — an editor invited to collaborate
  // could not add a single prompt to the brand they were invited to work on.
  const gate = await requireBrandRole(parsed.data.brand_id, userId, 'editor')
  if ('response' in gate) return gate.response

  // Semantic dedup (best-effort): embed the new prompt and compare against the
  // brand's existing prompt embeddings. A near-duplicate is reported as a
  // non-blocking `similar` warning — we still create the prompt. Soft-fails
  // entirely (no OPENAI_API_KEY / no migration) so creation never breaks.
  const embedding = await embedText(parsed.data.text)
  let similar: { text: string; score: number } | null = null
  if (embedding) {
    try {
      const { data: rows } = await (db as any)
        .from('prompt_embeddings')
        .select('text, embedding')
        .eq('brand_id', parsed.data.brand_id)
        .limit(500)
      const candidates = ((rows ?? []) as Array<{ text: string; embedding: unknown }>)
        .filter((r) => Array.isArray(r.embedding))
        .map((r) => ({ text: r.text, embedding: r.embedding as number[] }))
      const best = mostSimilar(embedding, candidates)
      if (best && best.score >= NEAR_DUPLICATE_THRESHOLD) {
        similar = { text: best.text, score: best.score }
      }
    } catch {
      /* table may not exist yet — skip dedup */
    }
  }

  // Insert prompt - user_id must be UUID
  const { data, error } = await db
    .from('prompts')
    .insert({ ...parsed.data, user_id: userId })
    .select()
    .single()

  if (error) {
    logger.error('Insert error', { source: 'prompts', error: String(error) })
    return err(error.message)
  }

  // Persist the embedding for future dedup (best-effort).
  if (embedding && data?.id) {
    try {
      await (db as any).from('prompt_embeddings').upsert({
        prompt_id: data.id,
        brand_id: parsed.data.brand_id,
        user_id: userId,
        text: parsed.data.text,
        embedding: embedding as unknown as Json,
      })
    } catch {
      /* non-critical */
    }
  }

  return NextResponse.json({ success: true, data, similar, timestamp: Date.now() }, { status: 201 })
}

// ─── DELETE /api/prompts ──────────────────────────────────────────────────────
// ?id=uuid → deletes the prompt
export async function DELETE(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return err('Authentication failed')
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return err('id query parameter is required', 400)

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  // Delete by brand permission, not by authorship: a prompt is the brand's, and
  // an editor must be able to remove one a colleague wrote. Matching on
  // `user_id` also failed silently — deleting someone else's prompt reported
  // success while removing nothing.
  const { data: prompt } = await db.from('prompts').select('brand_id').eq('id', id).maybeSingle()

  if (!prompt) return err('Prompt not found', 404)

  const gate = await requireBrandRole(String(prompt.brand_id), userId, 'editor')
  if ('response' in gate) return gate.response

  const { error } = await db.from('prompts').delete().eq('id', id)

  if (error) return err(error.message)
  return NextResponse.json({ success: true, data: null, timestamp: Date.now() })
}
