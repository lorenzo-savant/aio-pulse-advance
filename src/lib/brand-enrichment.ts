import type { Brand } from '@/types'

export interface BrandContextOptions {
  includeDomain?: boolean
  includeAliases?: boolean
  includeCompetitors?: boolean
  includeIndustry?: boolean
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
