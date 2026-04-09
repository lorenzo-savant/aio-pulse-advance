import type { QueryCategory } from '@/types'

interface CategoryKeywords {
  awareness: string[]
  interest: string[]
  consideration: string[]
  purchase: string[]
  comparison: string[]
  alternative: string[]
}

const CATEGORY_KEYWORDS: CategoryKeywords = {
  awareness: [
    'what is',
    'how does',
    'why is',
    'what are',
    'introduction to',
    'basics of',
    'getting started',
    'beginner guide',
    'learn about',
    'overview of',
    'what does',
    'explain',
    'definition of',
    'meaning of',
    'types of',
    'examples of',
  ],
  interest: [
    'best',
    'top',
    'how to',
    'guide to',
    'tutorial',
    'review',
    'benefits of',
    'features of',
    'pros and cons',
    'vs',
    'compared to',
    'difference between',
    'advantages',
    'disadvantages',
    'use cases',
    'how can i',
    'where to',
  ],
  consideration: [
    'pricing',
    'cost',
    'price',
    'plans',
    'subscription',
    'free trial',
    'is it worth',
    'should i',
    'reviews',
    'testimonials',
    'case studies',
    'integrations',
    'compatibility',
    'requirements',
    'setup',
    'installation',
  ],
  purchase: [
    'buy',
    'purchase',
    'order',
    'discount',
    'coupon',
    'deal',
    'offer',
    'pricing plans',
    'get started',
    'start free',
    'sign up',
    'subscribe',
    'license',
    'quote',
    'contact sales',
    'request demo',
    'add to cart',
  ],
  comparison: [
    'vs',
    'versus',
    'compare',
    'comparison',
    'difference between',
    'x or y',
    'better than',
    'alternative to',
    'competitors',
    'rival',
    'opposite',
    'comparative analysis',
    'side by side',
    'head to head',
  ],
  alternative: [
    'alternative',
    'replace',
    'replacement',
    'instead of',
    'other than',
    'similar to',
    'like',
    'open source',
    'free alternative',
    'cheaper',
    'better alternative',
    'switch from',
    'migrate from',
    'moving from',
  ],
}

export function classifyQuery(query: string): QueryCategory {
  const lowerQuery = query.toLowerCase()

  const scores: Record<QueryCategory, number> = {
    awareness: 0,
    interest: 0,
    consideration: 0,
    purchase: 0,
    comparison: 0,
    alternative: 0,
  }

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [
    QueryCategory,
    string[],
  ][]) {
    for (const keyword of keywords) {
      if (lowerQuery.includes(keyword)) {
        scores[category]++
      }
    }
  }

  if (lowerQuery.includes(' vs ') || lowerQuery.includes(' versus ')) {
    scores.comparison += 2
  }

  if (lowerQuery.includes(' alternative') || lowerQuery.includes(' instead ')) {
    scores.alternative += 2
  }

  if (/\b(buy|price|plan|cost|discount|order)\b/i.test(lowerQuery)) {
    scores.purchase += 2
  }

  let maxScore = 0
  let detectedCategory: QueryCategory = 'interest'

  for (const [category, score] of Object.entries(scores) as [QueryCategory, number][]) {
    if (score > maxScore) {
      maxScore = score
      detectedCategory = category
    }
  }

  return detectedCategory
}

export function getCategoryLabel(category: QueryCategory): string {
  const labels: Record<QueryCategory, string> = {
    awareness: 'Awareness',
    interest: 'Interest',
    consideration: 'Consideration',
    purchase: 'Purchase',
    comparison: 'Comparison',
    alternative: 'Alternative',
  }
  return labels[category]
}

export function getCategoryDescription(category: QueryCategory): string {
  const descriptions: Record<QueryCategory, string> = {
    awareness: 'Top of funnel: User is discovering a problem or solution',
    interest: 'Learning phase: User is researching and comparing options',
    consideration: 'Evaluation phase: User is comparing specific solutions',
    purchase: 'Bottom of funnel: User is ready to buy or subscribe',
    comparison: 'Side-by-side comparison between alternatives',
    alternative: 'User is looking for alternatives to a current solution',
  }
  return descriptions[category]
}
