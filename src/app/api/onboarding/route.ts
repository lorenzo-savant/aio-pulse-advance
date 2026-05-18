import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { slugify } from '@/lib/utils'
import { formatValidationError } from '@/lib/format-validation-error'
import { getTemplatesByCategories, hydratePrompt, type PromptLang } from '@/lib/prompt-library'
import { logger } from '@/lib/logger'
import type { BrandLanguage } from '@/types'

const schema = z.object({
  brandName: z.string().min(1).max(100),
  domain: z
    .preprocess(
      (v) =>
        typeof v === 'string' && v.length > 0 && !/^https?:\/\//i.test(v) ? `https://${v}` : v,
      z.string().url().optional().or(z.literal('')),
    )
    .optional(),
  industry: z.string().max(100).optional(),
  competitors: z.array(z.string()).max(10).optional().default([]),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .default('#0070F3'),
  language: z.enum(['en', 'it', 'sv']).optional().default('en'),
  seedPrompts: z.boolean().optional().default(true),
})

// Categorie default per il primo seed di prompts post-onboarding.
// Coprono il funnel di intent base (discovery → comparison → recommendation)
// per dare al nuovo utente dati interessanti al primo scan.
const DEFAULT_SEED_CATEGORIES = ['discovery', 'comparison', 'recommendation'] as const
const DEFAULT_ENGINES = ['chatgpt', 'gemini', 'perplexity', 'claude'] as const

export async function POST(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const data = schema.parse(body)
    const db = createServerClient()

    if (!db) {
      return NextResponse.json(
        { success: false, message: 'Database not configured' },
        { status: 503 },
      )
    }

    const slug = slugify(data.brandName)
    const now = new Date().toISOString()

    const { data: brand, error } = await db
      .from('brands')
      .insert({
        user_id: userId,
        name: data.brandName,
        slug,
        domain: data.domain || null,
        industry: data.industry || null,
        competitors: data.competitors,
        color: data.color,
        language: data.language,
        is_active: true,
        created_at: now,
        updated_at: now,
      })
      .select('id, name, slug, industry, competitors, language')
      .single()

    if (error) {
      if (error.message?.includes('unique')) {
        return NextResponse.json(
          { success: false, message: 'Brand already exists' },
          { status: 409 },
        )
      }
      return NextResponse.json({ success: false, message: error.message }, { status: 500 })
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Area B (CF audit) — Onboarding completion: auto-seed default prompts so
    // the new user has something meaningful in the dashboard immediately,
    // instead of an empty state. The user can then trigger the first monitoring
    // scan with one click from the UI.
    // Failure to seed prompts is logged but NOT fatal — brand creation succeeds.
    // ─────────────────────────────────────────────────────────────────────────
    let promptsCreated = 0
    if (data.seedPrompts) {
      try {
        const brandLanguage: PromptLang = (brand.language as BrandLanguage) || data.language || 'en'
        const competitors = (brand.competitors as string[]) || []
        const hydrationParams = {
          brand: brand.name || data.brandName,
          category: brand.industry || data.industry || 'general',
          competitor: competitors[0] || 'alternatives',
          competitor2: competitors[1] || 'others',
          location: brandLanguage === 'sv' ? 'Sweden' : brandLanguage === 'it' ? 'Italy' : 'global',
          use_case: `${brand.industry || data.industry || 'general'} solutions`,
        }

        const templates = getTemplatesByCategories([...DEFAULT_SEED_CATEGORIES])
        const market =
          brandLanguage === 'sv' ? 'Sweden' : brandLanguage === 'it' ? 'Italy' : 'global'

        const toInsert = templates.map((template) => ({
          brand_id: brand.id,
          user_id: userId,
          text: hydratePrompt(template, brandLanguage, hydrationParams).trim(),
          language: brandLanguage,
          market,
          category: template.category,
          engines: [...DEFAULT_ENGINES] as unknown as string[],
          run_frequency: 'monthly',
        }))

        if (toInsert.length > 0) {
          const { error: seedError, count } = await db
            .from('prompts')
            .insert(toInsert, { count: 'exact' })

          if (seedError) {
            logger.warn('Onboarding prompt seed failed (non-fatal)', {
              source: 'onboarding',
              brandId: brand.id,
              error: String(seedError),
            })
          } else {
            promptsCreated = count ?? toInsert.length
          }
        }
      } catch (seedException) {
        // Mai bloccare onboarding per errori di seed — log e prosegui
        logger.warn('Onboarding prompt seed exception (non-fatal)', {
          source: 'onboarding',
          brandId: brand.id,
          error: String(seedException),
        })
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          brand,
          promptsCreated,
          nextStep: promptsCreated > 0 ? 'run_first_scan' : 'create_prompts',
        },
        message: `Brand "${brand.name}" created${
          promptsCreated > 0 ? ` with ${promptsCreated} default prompts` : ''
        }`,
      },
      { status: 201 },
    )
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: formatValidationError(e), errors: e.errors },
        { status: 422 },
      )
    }
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  const db = createServerClient()
  if (!db) {
    return NextResponse.json(
      { success: false, message: 'Database not configured' },
      { status: 503 },
    )
  }
  const { data: brands } = await db
    .from('brands')
    .select('id, name, slug, created_at')
    .eq('user_id', userId)

  return NextResponse.json({
    success: true,
    data: {
      totalBrands: brands?.length || 0,
      brands: brands || [],
      hasOnboarded: (brands?.length || 0) > 0,
    },
  })
}
