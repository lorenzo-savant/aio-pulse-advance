import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { z } from 'zod'
import { generateLlmsTxt, generateLlmsFullTxt, LlmsInput } from '@/lib/services/llms-generator'
import { enrichLlmsInput } from '@/lib/services/llms-enrichment'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
import { logger } from '@/lib/logger'
import { formatValidationError } from '@/lib/format-validation-error'

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

const requestSchema = z.object({
  brandId: z.string().uuid(),
  products: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
      }),
    )
    .optional(),
  keyFacts: z
    .object({
      founded: z.string().optional(),
      headquarters: z.string().optional(),
      specialties: z.array(z.string()).optional(),
      employees: z.string().optional(),
    })
    .optional(),
  importantPages: z
    .array(
      z.object({
        title: z.string(),
        url: z.string(),
        description: z.string(),
      }),
    )
    .optional(),
  faqs: z
    .array(
      z.object({
        question: z.string(),
        answer: z.string(),
      }),
    )
    .optional(),
  /** When true, auto-enrich the file from the website + AEO + keywords + AI
   *  before generating. Manually-supplied fields above always take priority
   *  over enrichment. Default false — keeps the original lightweight behavior. */
  enrich: z.boolean().optional(),
  /** Per-source switches; only consulted when `enrich` is true. All default
   *  to true so a bare `{ enrich: true }` turns everything on. */
  enrichSources: z
    .object({
      scrapeSite: z.boolean().optional(),
      aeoFaqs: z.boolean().optional(),
      keywordSpecialties: z.boolean().optional(),
      aiSynthesis: z.boolean().optional(),
    })
    .optional(),
})

// GET /api/generate/llms-txt?brandId=xxx — retrieve version history
export async function GET(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return err('Authentication failed')
  }

  const ip = getClientIp(req.headers)
  const rateCheckGet = await checkRateLimit(`llms-txt-get:${ip}`, 30, 60_000)
  if (!rateCheckGet.success) {
    return NextResponse.json(
      { success: false, message: 'Rate limit exceeded. Try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rateCheckGet.resetAt - Date.now()) / 1000)) },
      },
    )
  }

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brandId')
  if (!brandId) return err('brandId is required', 400)

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  const { data, error: fetchErr } = await db
    .from('llms_txt_versions')
    .select('id, brand_id, version, llms_txt, llms_full_txt, input_data, created_at')
    .eq('brand_id', brandId)
    .eq('user_id', userId)
    .order('version', { ascending: false })
    .limit(10)

  if (fetchErr) return err(fetchErr.message)

  return NextResponse.json({ success: true, data: data || [] })
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

  const ip = getClientIp(req.headers)
  const rateCheck = await checkRateLimit(`llms-txt-post:${ip}`, 5, 60_000)
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
    return err('Invalid JSON body', 400)
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: formatValidationError(parsed.error),
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    )
  }

  const { brandId, products, keyFacts, importantPages, faqs, enrich, enrichSources } = parsed.data

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  const { data: brand, error: brandError } = await db
    .from('brands')
    .select('id, name, domain, description, industry, competitors, aliases')
    .eq('id', brandId)
    .eq('user_id', userId)
    .single()

  if (brandError || !brand) {
    return err('Brand not found or access denied', 404)
  }

  const domain = brand.domain || `${brand.name.toLowerCase().replace(/\s+/g, '')}.com`

  // Optional auto-enrichment. Runs the four data sources, then merges so that
  // any field the caller supplied MANUALLY wins over the enriched value.
  let enrichmentSources: Awaited<ReturnType<typeof enrichLlmsInput>>['sources'] | null = null
  let enrichedPatch: Partial<LlmsInput> = {}
  if (enrich) {
    try {
      const result = await enrichLlmsInput(
        db,
        {
          name: brand.name,
          domain,
          description: brand.description,
          industry: brand.industry,
          competitors: brand.competitors,
        },
        brandId,
        {
          scrapeSite: enrichSources?.scrapeSite ?? true,
          aeoFaqs: enrichSources?.aeoFaqs ?? true,
          keywordSpecialties: enrichSources?.keywordSpecialties ?? true,
          aiSynthesis: enrichSources?.aiSynthesis ?? true,
        },
      )
      enrichedPatch = result.patch
      enrichmentSources = result.sources
    } catch (enrichErr) {
      // Enrichment must never block generation — log and fall through to the
      // un-enriched input.
      logger.warn('generate/llms-txt: enrichment failed', { error: String(enrichErr) })
    }
  }

  const input: LlmsInput = {
    brandName: brand.name,
    domain,
    description: brand.description || enrichedPatch.description || undefined,
    industry: brand.industry || undefined,
    competitors: brand.competitors || undefined,
    aliases: brand.aliases || undefined,
    // Manual values win; otherwise fall back to whatever enrichment produced.
    products: products ?? enrichedPatch.products,
    keyFacts: keyFacts ?? enrichedPatch.keyFacts,
    importantPages: importantPages ?? enrichedPatch.importantPages,
    faqs: faqs ?? enrichedPatch.faqs,
  }

  const llmsTxt = generateLlmsTxt(input)
  const llmsFullTxt = generateLlmsFullTxt(input)

  // Persist version to database
  let version = 1
  try {
    const { data: latest } = await db
      .from('llms_txt_versions')
      .select('version')
      .eq('brand_id', brandId)
      .order('version', { ascending: false })
      .limit(1)
      .single()

    if (latest) version = latest.version + 1

    await db.from('llms_txt_versions').insert({
      brand_id: brandId,
      user_id: userId,
      llms_txt: llmsTxt,
      llms_full_txt: llmsFullTxt,
      input_data: { products, keyFacts, importantPages, faqs },
      version,
    })
  } catch (dbErr) {
    logger.error('Failed to save version', { source: 'generate/llms-txt', error: String(dbErr) })
  }

  const instructions = [
    `Upload llms.txt to: https://${domain}/llms.txt`,
    `Upload llms-full.txt to: https://${domain}/llms-full.txt`,
    'Ensure both files are accessible without authentication',
    `Add to robots.txt: Sitemap: https://${domain}/llms.txt`,
  ]

  return NextResponse.json({
    success: true,
    brand: brand.name,
    version,
    files: {
      'llms.txt': llmsTxt,
      'llms-full.txt': llmsFullTxt,
    },
    instructions,
    enrichment: enrichmentSources,
  })
}
