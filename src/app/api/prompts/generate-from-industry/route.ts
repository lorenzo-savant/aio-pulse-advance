import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { generatePrompts } from '@/lib/services/prompt-generator'
import type { Locale } from '@/lib/services/prompt-generator'
import { augmentWithAiPrompts } from '@/lib/services/prompt-generator-ai'
import { logger } from '@/lib/logger'

const schema = z.object({
  brand: z.string().min(1).max(200),
  brandDomain: z.string().max(200).optional(),
  industryId: z.string().min(1),
  locale: z.enum(['en', 'it', 'sv']),
  location: z.string().max(200).optional(),
  competitors: z.array(z.string().min(1).max(200)).max(20).optional(),
  /** When true, augments the static template output with 5-10 AI-generated
   *  prompts via Groq (or fallback Gemini/OpenAI). Default false — keeps
   *  the original deterministic behavior unless explicitly opted in. */
  withAi: z.boolean().optional(),
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

  const { brand, brandDomain, industryId, locale, location, competitors, withAi } = parsed.data

  // 1. Static template engine — always runs. Deterministic, free.
  //    Pass the brand's real competitors so "vs <competitor>" prompts use
  //    them instead of the preset's generic placeholders. brandDomain
  //    enables the homonym anchor — short single-word brands get rendered
  //    as "Brand (domain.tld)" inside templates so AI engines lock onto
  //    THIS entity instead of guessing between same-named alternatives.
  const prompts = generatePrompts(
    brand,
    industryId,
    locale as Locale,
    location,
    competitors,
    brandDomain,
  )

  if (prompts.length === 0) {
    return NextResponse.json(
      { success: false, message: 'Industry preset not found' },
      { status: 404 },
    )
  }

  // 2. Optional AI augmentation. Only when caller opts in AND we have at
  //    least one LLM key configured. Soft-fails so the static prompts
  //    still ship if Groq is unreachable / parse error / etc.
  let aiPrompts: Awaited<ReturnType<typeof augmentWithAiPrompts>>['prompts'] = []
  let aiProvider: string | null = null
  let aiModel: string | null = null
  let aiError: string | null = null

  if (withAi) {
    const haveAnyKey =
      !!process.env['GROQ_API_KEY'] ||
      !!process.env['GEMINI_API_KEY'] ||
      !!process.env['OPENAI_API_KEY']
    if (!haveAnyKey) {
      aiError = 'No LLM provider configured (set GROQ_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY)'
    } else {
      try {
        const existingPromptTexts = prompts.map((p) => p.userQuery)
        const result = await augmentWithAiPrompts({
          brand,
          brandDomain: brandDomain ?? null,
          industryId,
          locale: locale as Locale,
          competitors: competitors ?? [],
          existingPrompts: existingPromptTexts,
          location: location ?? null,
        })
        aiPrompts = result.prompts
        aiProvider = result.provider
        aiModel = result.model
      } catch (err) {
        aiError = err instanceof Error ? err.message : String(err)
        logger.warn('generate-from-industry: AI augmentation failed', { err: aiError })
      }
    }
  }

  return NextResponse.json({
    success: true,
    data: prompts,
    total: prompts.length,
    ai: withAi
      ? {
          prompts: aiPrompts,
          total: aiPrompts.length,
          provider: aiProvider,
          model: aiModel,
          error: aiError,
        }
      : null,
  })
}
