// PATH: src/app/api/organization-schema/route.ts
//
// GET /api/organization-schema?brand_id=…&format=script|json|graph
//
// Returns the brand's Schema.org Organization JSON-LD payload ready to
// paste into the <head> of their site. Three output formats:
//
//   - script (default) → complete <script type="application/ld+json">
//                        block, copy-paste into <head>.
//   - json             → raw JSON payload (for framework Head components
//                        that escape their own children).
//   - graph            → Organization + WebSite @graph bundle in one
//                        script tag — better rich-results coverage.
//
// The Content-Type and Content-Disposition headers are set so a curl /
// "save as" flow works naturally (e.g. ?format=script downloads as
// organization-schema.html, ?format=json as organization-schema.json).

import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/api-auth'
import { verifyBrandAccess } from '@/lib/authorize'
import { logger } from '@/lib/logger'
import {
  emitOrganizationScriptTag,
  emitOrganizationJsonLd,
  emitBrandKnowledgeGraph,
} from '@/lib/utils/organization-schema'
import type { LlmsInput } from '@/lib/services/llms-generator'

export const dynamic = 'force-dynamic'

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brand_id')
  const format = searchParams.get('format') ?? 'script'

  if (!brandId) return err('brand_id is required', 400)
  if (!['script', 'json', 'graph'].includes(format)) {
    return err('format must be one of: script, json, graph', 400)
  }

  const brand = await verifyBrandAccess(brandId, userId)
  if (!brand) return err('Brand not found or access denied', 404)

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  // Fetch the LLMO-specific fields (same_as, disambiguation,
  // citation_format) directly — they're not in the cached BrandAccess.
  // Use snake_case Supabase column names; map to camelCase for LlmsInput.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data: row, error } = await (db as any)
    .from('brands')
    .select('same_as, disambiguation, citation_format, domains')
    .eq('id', brandId)
    .single()
  /* eslint-enable @typescript-eslint/no-explicit-any */
  if (error) {
    logger.error('/api/organization-schema brand fetch failed', { err: String(error) })
    return err('Failed to load brand LLMO fields')
  }

  const input: LlmsInput = {
    brandName: brand.name,
    domain:
      brand.domain ||
      (Array.isArray(row?.domains) && row.domains.length > 0 ? String(row.domains[0]) : ''),
    description: brand.description ?? undefined,
    industry: brand.industry ?? undefined,
    aliases: brand.aliases ?? [],
    locale: brand.language ? `${brand.language}-${brand.language.toUpperCase()}` : undefined,
    sameAs: Array.isArray(row?.same_as) ? row.same_as : [],
    disambiguation: row?.disambiguation ?? undefined,
    citationFormat: row?.citation_format ?? undefined,
  }

  if (!input.domain) {
    return err('Brand has no domain — cannot emit a meaningful schema', 400)
  }

  if (format === 'json') {
    return new NextResponse(emitOrganizationJsonLd(input), {
      headers: {
        'Content-Type': 'application/ld+json; charset=utf-8',
        'Content-Disposition': 'inline; filename="organization-schema.json"',
        'Cache-Control': 'private, max-age=300',
      },
    })
  }

  if (format === 'graph') {
    const payload = emitBrandKnowledgeGraph(input)
    const json = JSON.stringify(payload, null, 2).replace(/<\/script>/gi, '<\\/script>')
    const script = `<script type="application/ld+json">\n${json}\n</script>`
    return new NextResponse(script, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': 'inline; filename="brand-knowledge-graph.html"',
        'Cache-Control': 'private, max-age=300',
      },
    })
  }

  // Default: script tag for direct <head> paste.
  return new NextResponse(emitOrganizationScriptTag(input), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': 'inline; filename="organization-schema.html"',
      'Cache-Control': 'private, max-age=300',
    },
  })
}
