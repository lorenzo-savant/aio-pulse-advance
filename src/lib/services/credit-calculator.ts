// PATH: src/lib/services/credit-calculator.ts
// Credit Calculator — Model pricing and cost estimation

export interface ModelPricing {
  input: number
  output: number
}

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  'claude-3.5-sonnet': { input: 3.0, output: 15.0 },
  'claude-3-opus': { input: 15.0, output: 75.0 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },
  'gemini-2.5-flash': { input: 0.075, output: 0.3 },
  'gemini-2.0-flash': { input: 0.0, output: 0.0 },
  'gemini-2.0-flash-lite': { input: 0.0, output: 0.0 },
  'gemini-1.5-pro': { input: 1.25, output: 5.0 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },
  'sonar-small': { input: 0.2, output: 0.2 },
  'sonar-medium': { input: 0.6, output: 0.6 },
}

export function getProviderFromModel(model: string): string {
  const modelToProvider: Record<string, string> = {
    'gpt-4o': 'openai',
    'gpt-4o-mini': 'openai',
    'gpt-4-turbo': 'openai',
    'gpt-3.5-turbo': 'openai',
    'claude-3.5-sonnet': 'anthropic',
    'claude-3-opus': 'anthropic',
    'claude-3-haiku': 'anthropic',
    'gemini-2.5-flash': 'gemini',
    'gemini-2.0-flash': 'gemini',
    'gemini-2.0-flash-lite': 'gemini',
    'gemini-1.5-pro': 'gemini',
    'gemini-1.5-flash': 'gemini',
    'sonar-small': 'perplexity',
    'sonar-medium': 'perplexity',
  }
  return modelToProvider[model] || 'unknown'
}

export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model]
  if (!pricing) return 0

  const inputCost = (inputTokens / 1000) * pricing.input
  const outputCost = (outputTokens / 1000) * pricing.output

  return Math.round((inputCost + outputCost) * 100) / 100
}

function estimateTokensFromText(text: string): number {
  return Math.ceil(text.length / 4)
}

function countMessageTokens(messages: Message[]): { input: number; output: number } {
  let inputTokens = 0
  let outputTokens = 0

  for (const msg of messages) {
    const tokens = estimateTokensFromText(msg.content)

    if (msg.role === 'user' || msg.role === 'system') {
      inputTokens += tokens
    } else {
      outputTokens += tokens
    }
  }

  return { input: inputTokens, output: outputTokens }
}

export function estimateCost(model: string, messages: Message[]): number {
  const { input, output } = countMessageTokens(messages)
  return calculateCost(model, input, output)
}

export function getModelPricing(model: string): ModelPricing | null {
  return MODEL_PRICING[model] || null
}

export function getAllModels(): string[] {
  return Object.keys(MODEL_PRICING)
}
