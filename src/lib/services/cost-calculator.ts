// PATH: src/lib/services/cost-calculator.ts
// Cost Calculator — tracks query costs and credits
//
// Pricing model (approximate):
// - OpenAI GPT-4o-mini: $0.003 per 1K input tokens
// - Google Gemini: $0.0005 per 1K input tokens
// - Perplexity: $0.005 per 1K input tokens
// - Anthropic Claude: $0.008 per 1K input tokens
// - Groq: $0.0001 per 1K input tokens (very cheap)
// - Cerebras: $0.00006 per 1K input tokens (free!)

export interface CostBreakdown {
  provider: string
  inputTokens: number
  outputTokens: number
  inputCost: number
  outputCost: number
  totalCost: number
}

export interface QueryCostSummary {
  breakdown: CostBreakdown[]
  totalCost: number
  estimatedCreditsNeeded: number
  providerCount: number
  executionTimeMs: number
}

const PROVIDER_PRICING: Record<string, { inputPer1K: number; outputPer1K: number }> = {
  'openai:gpt-4o-mini': { inputPer1K: 0.003, outputPer1K: 0.003 },
  'openai:gpt-4o': { inputPer1K: 0.015, outputPer1K: 0.015 },
  'gemini:flash-2.0': { inputPer1K: 0.0005, outputPer1K: 0.0005 },
  'gemini:pro-2.0': { inputPer1K: 0.0075, outputPer1K: 0.015 },
  'perplexity:llama-3.1-sonar': { inputPer1K: 0.005, outputPer1K: 0.005 },
  'perplexity:llama-3.1-sonar-large': { inputPer1K: 0.005, outputPer1K: 0.005 },
  'anthropic:claude-3-haiku': { inputPer1K: 0.002, outputPer1K: 0.01 },
  'anthropic:claude-3-sonnet': { inputPer1K: 0.015, outputPer1K: 0.075 },
  'groq:llama-70b': { inputPer1K: 0.0001, outputPer1K: 0.0001 },
  'groq:mixtral-8x7b': { inputPer1K: 0.0001, outputPer1K: 0.0001 },
  'cerebras:llama-8b': { inputPer1K: 0.00006, outputPer1K: 0.00006 },
}

const CREDIT_CONVERSION_RATE = 1000 // 1 credit = $0.001

/**
 * Estimate tokens from text (rough approximation)
 * Average token is ~4 characters for English text
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Calculate cost for a single provider query
 */
export function calculateProviderCost(
  provider: string,
  inputText: string,
  outputText: string,
): CostBreakdown {
  const pricing = PROVIDER_PRICING[provider]

  if (!pricing) {
    return {
      provider,
      inputTokens: estimateTokens(inputText),
      outputTokens: estimateTokens(outputText),
      inputCost: 0,
      outputCost: 0,
      totalCost: 0,
    }
  }

  const inputTokens = estimateTokens(inputText)
  const outputTokens = estimateTokens(outputText)

  const inputCost = (inputTokens / 1000) * pricing.inputPer1K
  const outputCost = (outputTokens / 1000) * pricing.outputPer1K

  return {
    provider,
    inputTokens,
    outputTokens,
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
  }
}

/**
 * Calculate total cost for orchestrated query
 */
export function calculateOrchestratedCost(
  responses: Array<{ provider: string; content: string }>,
  executionTimeMs: number,
  failureCount: number = 0,
): QueryCostSummary {
  const breakdown: CostBreakdown[] = []
  let totalCost = 0

  for (const response of responses) {
    const cost = calculateProviderCost(
      response.provider,
      '', // Input not needed for cost calc
      response.content,
    )
    breakdown.push(cost)
    totalCost += cost.totalCost
  }

  // Add overhead for failures (retry cost)
  const failureOverhead = failureCount * 0.001 // $0.001 per failed provider

  // Add timing overhead
  const timingOverhead = (executionTimeMs / 1000) * 0.00001

  const finalCost = totalCost + failureOverhead + timingOverhead
  const estimatedCreditsNeeded = Math.ceil(finalCost * CREDIT_CONVERSION_RATE)

  return {
    breakdown,
    totalCost: Math.round(finalCost * 10000) / 10000, // Round to 4 decimal places
    estimatedCreditsNeeded,
    providerCount: responses.length,
    executionTimeMs,
  }
}

/**
 * Calculate average cost per query for reporting
 */
export function calculateAverageCost(
  results: Array<{ costCredits: number | null; executionTimeMs: number | null }>,
): { avgCredits: number; avgTimeMs: number; totalQueries: number } {
  if (results.length === 0) {
    return { avgCredits: 0, avgTimeMs: 0, totalQueries: 0 }
  }

  const validResults = results.filter((r) => r.costCredits !== null && r.executionTimeMs !== null)

  if (validResults.length === 0) {
    return { avgCredits: 0, avgTimeMs: 0, totalQueries: results.length }
  }

  const totalCredits = validResults.reduce((sum, r) => sum + (r.costCredits || 0), 0)
  const totalTime = validResults.reduce((sum, r) => sum + (r.executionTimeMs || 0), 0)

  return {
    avgCredits: Math.round((totalCredits / validResults.length) * 100) / 100,
    avgTimeMs: Math.round(totalTime / validResults.length),
    totalQueries: results.length,
  }
}

/**
 * Get provider cost info for display
 */
export function getProviderCostInfo(provider: string): {
  name: string
  inputPer1K: string
  outputPer1K: string
  isFree: boolean
} {
  const pricing = PROVIDER_PRICING[provider]

  if (!pricing) {
    return {
      name: provider,
      inputPer1K: 'Unknown',
      outputPer1K: 'Unknown',
      isFree: false,
    }
  }

  return {
    name: provider,
    inputPer1K: `$${pricing.inputPer1K.toFixed(4)}`,
    outputPer1K: `$${pricing.outputPer1K.toFixed(4)}`,
    isFree: pricing.inputPer1K === 0.00006,
  }
}

/**
 * Estimate daily/monthly costs based on query volume
 */
export function estimateMonthlyCost(
  queriesPerDay: number,
  avgProvidersPerQuery: number,
  avgInputLength: number,
  avgOutputLength: number,
): { daily: number; monthly: number; yearly: number } {
  const avgCostPerProvider = calculateProviderCost(
    'openai:gpt-4o-mini', // Baseline
    'a'.repeat(avgInputLength),
    'a'.repeat(avgOutputLength),
  ).totalCost

  const avgCostPerQuery = avgCostPerProvider * avgProvidersPerQuery
  const daily = avgCostPerQuery * queriesPerDay
  const monthly = daily * 30
  const yearly = daily * 365

  return {
    daily: Math.round(daily * 100) / 100,
    monthly: Math.round(monthly * 100) / 100,
    yearly: Math.round(yearly * 100) / 100,
  }
}
