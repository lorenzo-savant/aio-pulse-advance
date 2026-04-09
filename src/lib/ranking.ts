export interface ProviderRankingData {
  provider: string
  brandMentions: number
  totalCitations: number
  domainCitations: number
}

export interface RankingResult {
  rank: number
  winners: string[]
  brandMentions: number
  domainCitationsRatio: number
  totalCitations: number
  message: string
}

const EPSILON = 0.001

function areEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < EPSILON
}

function calculateDomainCitationsRatio(domainCitations: number, totalCitations: number): number {
  if (totalCitations === 0) return 0
  return (domainCitations / totalCitations) * 100
}

export function rankProviders(results: ProviderRankingData[]): RankingResult[] {
  if (results.length === 0) {
    return []
  }

  const sorted = [...results].sort((a, b) => {
    const aPrimary = a.brandMentions
    const bPrimary = b.brandMentions
    if (!areEqual(aPrimary, bPrimary)) {
      return bPrimary - aPrimary
    }

    const aRatio = calculateDomainCitationsRatio(a.domainCitations, a.totalCitations)
    const bRatio = calculateDomainCitationsRatio(b.domainCitations, b.totalCitations)
    if (!areEqual(aRatio, bRatio)) {
      return bRatio - aRatio
    }

    return b.totalCitations - a.totalCitations
  })

  const ranked: RankingResult[] = []
  let currentRank = 1
  let prevBrandMentions: number | null = null
  let prevRatio: number | null = null
  let prevTotalCitations: number | null = null
  let tiedProviders: string[] = []

  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i]!
    const ratio = calculateDomainCitationsRatio(item.domainCitations, item.totalCitations)

    const isFirst = prevBrandMentions === null
    const samePrimary = !isFirst && areEqual(prevBrandMentions!, item.brandMentions)
    const sameSecondary = !isFirst && areEqual(prevRatio!, ratio)
    const sameTertiary = !isFirst && areEqual(prevTotalCitations!, item.totalCitations)

    if (samePrimary && sameSecondary && sameTertiary) {
      tiedProviders.push(item.provider)
    } else {
      if (tiedProviders.length > 0) {
        ranked.push(createRankingResult(currentRank, tiedProviders, sorted[i - 1]!))
        currentRank += tiedProviders.length
        tiedProviders = []
      } else if (!isFirst) {
        ranked.push(createRankingResult(currentRank, [sorted[i - 1]!.provider], sorted[i - 1]!))
        currentRank++
      }

      tiedProviders.push(item.provider)
    }

    prevBrandMentions = item.brandMentions
    prevRatio = ratio
    prevTotalCitations = item.totalCitations
  }

  if (tiedProviders.length > 0 && sorted.length > 0) {
    const lastItem = sorted[sorted.length - 1]!
    ranked.push(createRankingResult(currentRank, tiedProviders, lastItem))
  }

  return ranked
}

function createRankingResult(
  rank: number,
  winners: string[],
  data: ProviderRankingData,
): RankingResult {
  const hasBrandMention = data.brandMentions > 0
  const hasDomainCitation = data.domainCitations > 0
  const ratio = calculateDomainCitationsRatio(data.domainCitations, data.totalCitations)

  let message: string
  if (!hasBrandMention && !hasDomainCitation) {
    message = 'No visibility detected'
  } else if (winners.length > 1) {
    message = `Tied at rank #${rank}: ${winners.join(' & ')}`
  } else {
    message = `Rank #${rank}: ${winners[0]}`
  }

  return {
    rank,
    winners,
    brandMentions: data.brandMentions,
    domainCitationsRatio: ratio,
    totalCitations: data.totalCitations,
    message,
  }
}

export function getTopProvider(results: ProviderRankingData[]): ProviderRankingData | null {
  const ranked = rankProviders(results)
  if (ranked.length === 0) return null

  const topRank = ranked[0]
  if (!topRank || topRank.winners.length === 0) return null

  return results.find((r) => r.provider === topRank.winners[0]) || null
}

export function getVisibilitySummary(results: ProviderRankingData[]): {
  totalMentions: number
  totalCitations: number
  averageRatio: number
  topProvider: string | null
} {
  const totalMentions = results.reduce((sum, r) => sum + r.brandMentions, 0)
  const totalCitations = results.reduce((sum, r) => sum + r.totalCitations, 0)
  const totalDomainCitations = results.reduce((sum, r) => sum + r.domainCitations, 0)
  const averageRatio =
    results.length > 0 ? (totalDomainCitations / Math.max(1, totalCitations)) * 100 : 0
  const top = getTopProvider(results)

  return {
    totalMentions,
    totalCitations,
    averageRatio,
    topProvider: top?.provider || null,
  }
}
