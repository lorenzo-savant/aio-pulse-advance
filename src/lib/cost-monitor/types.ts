import type { AIProviderId } from '@/lib/providers/types'

export interface CostLogEntry {
  id: string
  userId: string
  brandId: string | null
  provider: AIProviderId | string
  model: string | null
  agentType: string | null
  conversationId: string | null
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costUsd: number
  costCredits: number
  latencyMs: number | null
  endpoint: string | null
  success: boolean
  errorMessage: string | null
  cached: boolean
  budgetAlert: boolean
  createdAt: Date
}

export interface BudgetConfig {
  id: string
  userId: string
  brandId: string | null
  monthlyLimitUsd: number
  dailyLimitUsd: number | null
  alertThreshold: number
  providerLimits: Record<string, number>
  currentMonthSpend: number
  currentDaySpend: number
  lastAlertSent: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CostAnalytics {
  totalCost: number
  totalTokens: number
  totalRequests: number
  avgCostPerRequest: number
  avgTokensPerRequest: number
  avgLatencyMs: number
  providerBreakdown: Record<string, ProviderCostBreakdown>
  agentBreakdown: Record<string, AgentCostBreakdown>
  dailyTrend: DailyCost[]
  hourlyPeak: HourlyPeak[]
  successRate: number
  cacheHitRate: number
}

export interface ProviderCostBreakdown {
  provider: string
  totalCost: number
  totalTokens: number
  requestCount: number
  avgCostPerRequest: number
  avgLatencyMs: number
  successRate: number
}

export interface AgentCostBreakdown {
  agentType: string
  totalCost: number
  totalTokens: number
  requestCount: number
  avgCostPerRequest: number
}

export interface DailyCost {
  date: string
  cost: number
  tokens: number
  requests: number
}

export interface HourlyPeak {
  hour: number
  avgCost: number
  requestCount: number
}

export interface BudgetAlert {
  type: 'daily' | 'monthly' | 'provider'
  threshold: number
  currentSpend: number
  limit: number
  percentage: number
  message: string
  timestamp: Date
}

export interface CostEstimate {
  provider: AIProviderId | string
  model: string
  inputTokens: number
  outputTokens: number
  estimatedCostUsd: number
}

// Provider pricing per 1M tokens (USD)
export const PROVIDER_PRICING: Record<string, { input: number; output: number }> = {
  // Google Gemini
  // gemini-2.5-flash is the most-used model in the product and was ABSENT,
  // so every one of its calls fell through to `default` (1.0/2.0) — roughly
  // 13× its real input price, on the highest-volume path there is.
  'gemini-2.5-flash': { input: 0.075, output: 0.3 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  'gemini-2.0-flash-lite': { input: 0.075, output: 0.3 },
  'gemini-2.5-pro': { input: 1.25, output: 10.0 },
  'gemini-1.5-pro': { input: 1.25, output: 5.0 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },

  // Anthropic Claude
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-opus-4-20250514': { input: 15.0, output: 75.0 },
  'claude-3-5-haiku-20241022': { input: 0.8, output: 4.0 },

  // OpenAI
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  o3: { input: 10.0, output: 40.0 },

  // Perplexity
  'sonar-pro': { input: 3.0, output: 15.0 },
  sonar: { input: 1.0, output: 1.0 },

  // Azure OpenAI
  'azure-gpt-4o': { input: 2.5, output: 10.0 },
  'azure-gpt-4o-mini': { input: 0.15, output: 0.6 },

  // Default fallback pricing
  default: { input: 1.0, output: 2.0 },
}

/**
 * Cost in USD for `tokens` total tokens of a model, priced at its OUTPUT rate.
 *
 * Providers that only report a combined token count cannot split input from
 * output, so this deliberately takes the higher of the two rates. A budget
 * alert that fires slightly early is useful; one that fires late is not.
 */
export function estimateBlendedCost(model: string, tokens: number): number {
  const pricing = PROVIDER_PRICING[pricingKeyForProviderLabel(model)] ?? PROVIDER_PRICING.default!
  const rate = Math.max(pricing.input, pricing.output)
  return Math.round((Math.max(tokens, 0) / 1_000_000) * rate * 1_000_000) / 1_000_000
}

/**
 * Fold an ai-router provider label onto a key in PROVIDER_PRICING.
 *
 * The router emits `'<vendor>:<model>'` with an optional `+web` / `+search`
 * suffix for the grounded variants — `'gemini:flash-2.5'`,
 * `'openai:gpt-4o-mini+web'`, `'perplexity:sonar'`. None of those strings
 * matched a pricing key, so every routed call priced at `default` and every
 * cost row landed orphaned in the dashboards.
 *
 * The grounding suffix is dropped on purpose: it changes what the call does,
 * not the per-token price of the model that runs it.
 */
export function pricingKeyForProviderLabel(label: string): string {
  const raw = (label ?? '').toLowerCase().trim()
  if (!raw) return 'default'

  // Exact match first, so a plain model name still works.
  if (PROVIDER_PRICING[raw]) return raw

  const withoutGrounding = raw.split('+')[0] ?? raw
  if (PROVIDER_PRICING[withoutGrounding]) return withoutGrounding

  const [vendor, model] = withoutGrounding.split(':')
  if (!model) return PROVIDER_PRICING[withoutGrounding] ? withoutGrounding : 'default'

  // 'gemini:flash-2.5' → 'gemini-2.5-flash'; the router writes the version
  // after the tier, the price list writes it before.
  const candidates = [
    `${vendor}-${model}`,
    model,
    model.replace(/^([a-z]+)-([0-9.]+)$/, (_m, tier, version) => `${vendor}-${version}-${tier}`),
  ]
  for (const c of candidates) {
    if (PROVIDER_PRICING[c]) return c
  }

  return 'default'
}

// Map provider IDs to default models
export const PROVIDER_DEFAULT_MODELS: Record<string, string> = {
  gemini: 'gemini-2.0-flash',
  chatgpt: 'gpt-4o',
  perplexity: 'sonar',
  claude: 'claude-sonnet-4-20250514',
  'azure-openai': 'azure-gpt-4o',
  dataforseo: 'default',
  brightdata: 'default',
  gsc: 'default',
}
