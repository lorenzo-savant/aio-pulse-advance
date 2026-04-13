import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import {
  getTemplatesByCategories,
  hydratePrompt,
  type PromptCategory,
  type PromptLang,
} from '@/lib/prompt-library'
import { formatValidationError } from '@/lib/format-validation-error'
import type { BrandLanguage } from '@/types'

const seedSchema = z.object({
  brandId: z.string().uuid(),
  categories: z.array(z.string()).optional(),
  engines: z.array(z.enum(['chatgpt', 'gemini', 'perplexity', 'claude'])).optional(),
})

const DEFAULT_ENGINES = ['chatgpt', 'gemini', 'perplexity', 'claude'] as const
const BATCH_SIZE = 20

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

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

  const parsed = seedSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: formatValidationError(parsed.error), details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  const { brandId, categories, engines } = parsed.data

  const { data: brand, error: brandError } = await db
    .from('brands')
    .select('id, name, industry, competitors, domain, language')
    .eq('id', brandId)
    .eq('user_id', userId)
    .single()

  if (brandError || !brand) {
    return err('Brand not found or access denied', 404)
  }

  const brandName = brand.name || 'Unknown'
  const category = brand.industry || 'general'
  const competitors = (brand.competitors as string[]) || []
  const competitor = competitors[0] || 'alternatives'
  const competitor2 = competitors[1] || 'others'
  const brandLanguage: PromptLang = (brand.language as BrandLanguage) || 'en'

  const hydrationParams = {
    brand: brandName,
    category,
    competitor,
    competitor2,
    location: brandLanguage === 'sv' ? 'Sweden' : brandLanguage === 'it' ? 'Italy' : 'global',
    use_case: `${category} solutions`,
  }

  const validCategories = (categories as PromptCategory[] | undefined)?.filter(
    (c): c is PromptCategory =>
      [
        'discovery',
        'comparison',
        'recommendation',
        'problem',
        'reputation',
        'local',
        'negative',
        'expert',
      ].includes(c),
  )

  const templates = getTemplatesByCategories(validCategories || [])
  const templatesAvailable = templates.length

  const { data: existingPrompts } = await db
    .from('prompts')
    .select('id, text')
    .eq('brand_id', brandId)
    .eq('user_id', userId)

  const existingTexts = new Set((existingPrompts || []).map((p) => p.text.toLowerCase().trim()))
  const skippedIds: string[] = (existingPrompts || []).map((p) => p.id)

  const selectedEngines = engines && engines.length > 0 ? engines : DEFAULT_ENGINES

  const toInsert: Array<{
    brand_id: string
    user_id: string
    text: string
    language: string
    market: string
    category: string
    engines: string[]
    run_frequency: string
  }> = []

  for (const template of templates) {
    const hydratedText = hydratePrompt(template, brandLanguage, hydrationParams).trim()
    const textKey = hydratedText.toLowerCase()

    if (existingTexts.has(textKey)) continue

    existingTexts.add(textKey)
    toInsert.push({
      brand_id: brandId,
      user_id: userId,
      text: hydratedText,
      language: brandLanguage,
      market: brandLanguage === 'sv' ? 'Sweden' : brandLanguage === 'it' ? 'Italy' : 'global',
      category: template.category,
      engines: selectedEngines as unknown as string[],
      run_frequency: 'monthly',
    })
  }

  let created = 0

  if (toInsert.length > 0) {
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE)
      const { error: insertError } = await db.from('prompts').insert(batch)

      if (insertError) {
        logger.error('Batch insert error', { source: 'prompts/seed', error: String(insertError) })
        return err(`Insert failed: ${insertError.message}`)
      }

      created += batch.length
    }
  }

  const skippedDuplicates =
    toInsert.length === 0 && templatesAvailable > 0
      ? 0
      : templatesAvailable - created - skippedIds.length

  return NextResponse.json({
    success: true,
    brand: brandName,
    stats: {
      templatesAvailable,
      created,
      skippedDuplicates: skippedDuplicates < 0 ? 0 : skippedDuplicates,
      skippedIds: skippedIds.length,
    },
  })
}
