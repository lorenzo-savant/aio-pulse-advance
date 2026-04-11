import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { z } from 'zod'
import { generateLlmsTxt, generateLlmsFullTxt, LlmsInput } from '@/lib/services/llms-generator'

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
})

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

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  const { brandId, products, keyFacts, importantPages, faqs } = parsed.data

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  const { data: brand, error: brandError } = await (db as any)
    .from('brands')
    .select('id, name, domain, description, industry, competitors, aliases')
    .eq('id', brandId)
    .eq('user_id', userId)
    .single()

  if (brandError || !brand) {
    return err('Brand not found or access denied', 404)
  }

  const domain = brand.domain || `${brand.name.toLowerCase().replace(/\s+/g, '')}.com`

  const input: LlmsInput = {
    brandName: brand.name,
    domain,
    description: brand.description || undefined,
    industry: brand.industry || undefined,
    competitors: brand.competitors || undefined,
    aliases: brand.aliases || undefined,
    products,
    keyFacts,
    importantPages,
    faqs,
  }

  const llmsTxt = generateLlmsTxt(input)
  const llmsFullTxt = generateLlmsFullTxt(input)

  const instructions = [
    `Upload llms.txt to: https://${domain}/llms.txt`,
    `Upload llms-full.txt to: https://${domain}/llms-full.txt`,
    'Ensure both files are accessible without authentication',
    `Add to robots.txt: Sitemap: https://${domain}/llms.txt`,
  ]

  return NextResponse.json({
    success: true,
    brand: brand.name,
    files: {
      'llms.txt': llmsTxt,
      'llms-full.txt': llmsFullTxt,
    },
    instructions,
  })
}
