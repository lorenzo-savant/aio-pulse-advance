import type { DataForSEOResult } from '@/lib/providers/dataforseo-provider'

export interface BrandDetectionResult {
  brandFound: boolean
  brandDomain: string
}

export interface OpportunityResult {
  aiOverviewPresent: boolean
  paaPresent: boolean
  organicTop3: boolean
  opportunityScore: number
}

export function detectBrandInAiOverview(
  aiOverviews: DataForSEOResult['aiOverviews'],
  brandDomain: string,
): boolean {
  if (!brandDomain || !aiOverviews || aiOverviews.length === 0) {
    return false
  }

  for (const overview of aiOverviews) {
    for (const link of overview.links || []) {
      if (link.url && link.url.includes(brandDomain)) {
        return true
      }
    }
  }

  return false
}

export function detectBrandInPaa(
  paaBoxes: DataForSEOResult['peopleAlsoAsk'],
  brandDomain: string,
): boolean {
  if (!brandDomain || !paaBoxes || paaBoxes.length === 0) {
    return false
  }

  for (const paa of paaBoxes) {
    for (const link of paa.links || []) {
      if (link.url && link.url.includes(brandDomain)) {
        return true
      }
    }
  }

  return false
}

export function detectBrandInOrganic(
  organicResults: DataForSEOResult['organicResults'],
  brandDomain: string,
): boolean {
  if (!brandDomain || !organicResults || organicResults.length === 0) {
    return false
  }

  for (const result of organicResults) {
    if (result.url && result.url.includes(brandDomain)) {
      return true
    }
  }

  return false
}

export function detectBrandInTop3(
  organicResults: DataForSEOResult['organicResults'],
  brandDomain: string,
): boolean {
  if (!brandDomain || !organicResults || organicResults.length === 0) {
    return false
  }

  for (const result of organicResults.slice(0, 3)) {
    if (result.url && result.url.includes(brandDomain)) {
      return true
    }
  }

  return false
}

export function calculateOpportunityScore(
  aiOverview: boolean,
  paa: boolean,
  top3: boolean,
): number {
  let score = 0
  if (aiOverview) score += 40
  if (paa) score += 30
  if (top3) score += 30
  return score
}

export function analyzeBrandPresence(
  serpData: DataForSEOResult,
  brandDomain: string,
): OpportunityResult {
  const aiOverviewPresent = detectBrandInAiOverview(serpData.aiOverviews || [], brandDomain)
  const paaPresent = detectBrandInPaa(serpData.peopleAlsoAsk || [], brandDomain)
  const organicTop3 = detectBrandInTop3(serpData.organicResults || [], brandDomain)

  return {
    aiOverviewPresent,
    paaPresent,
    organicTop3,
    opportunityScore: calculateOpportunityScore(aiOverviewPresent, paaPresent, organicTop3),
  }
}
