import type { Brand } from '@/types'

export interface BrandContextOptions {
  includeDomain?: boolean
  includeAliases?: boolean
  includeCompetitors?: boolean
  includeIndustry?: boolean
}

// ─── Brand-name disambiguation hints ────────────────────────────────────────
//
// Some brand names are ambiguous (homophone with a well-known platform, or
// confusable with a common industry term). For those cases we surface an
// explicit "NOT to be confused with X" line in the context, so the LLM
// doesn't conflate the brand with the more famous look-alike.
//
// Match is lowercase substring on the brand name. Add new entries as the
// confusion surfaces in monitoring data — keep them narrow (one specific
// brand collision per entry, not "be careful in general").
const DISAMBIGUATION_HINTS: Array<{ match: RegExp; warning: string }> = [
  {
    // Acasting (any TLD: .se / .ai / .com) → not Acast (the Swedish podcast
    // hosting platform). Observed in Citation Sources data: feeds.acast.com
    // appearing as a "citation source" for Acasting-targeted prompts.
    match: /\bacasting\b/i,
    warning:
      'IMPORTANT DISAMBIGUATION: This brand is "Acasting" — NOT to be confused with ' +
      '"Acast" (the Swedish podcast hosting platform at acast.com / feeds.acast.com). ' +
      'These are entirely different companies. Do not cite acast.com, feeds.acast.com, ' +
      'or other Acast podcast platform URLs when answering about this brand.',
  },
]

function disambiguationFor(brandName: string): string | null {
  const lower = brandName.toLowerCase()
  for (const hint of DISAMBIGUATION_HINTS) {
    if (hint.match.test(lower)) return hint.warning
  }
  return null
}

export function buildBrandContext(brand: Brand | null, options: BrandContextOptions = {}): string {
  if (!brand) return ''

  const {
    includeDomain = true,
    includeAliases = true,
    includeCompetitors = true,
    includeIndustry = true,
  } = options

  const parts: string[] = []

  parts.push(`Brand: ${brand.name}`)
  if (brand.industry && includeIndustry) parts.push(`Industry: ${brand.industry}`)
  if (brand.description) parts.push(`Description: ${brand.description}`)
  if (brand.domain && includeDomain) parts.push(`Primary Domain: ${brand.domain}`)
  if (includeAliases && brand.aliases.length)
    parts.push(`Also Known As: ${brand.aliases.join(', ')}`)
  if (brand.domains.length) parts.push(`Related Domains: ${brand.domains.join(', ')}`)
  if (includeCompetitors && brand.competitors.length) {
    parts.push(`Competitors: ${brand.competitors.join(', ')}`)
  }

  const disambig = disambiguationFor(brand.name)
  if (disambig) parts.push(disambig)

  return parts.join('\n')
}

export function enrichPromptWithBrandContext(
  prompt: string,
  brand: Brand | null,
  options: BrandContextOptions = {},
): string {
  const context = buildBrandContext(brand, options)
  if (!context) return prompt

  return `Context:\n${context}\n\nQuery:\n${prompt}`
}
