export type AIProviderId =
  | 'gemini'
  | 'groq'
  | 'cerebras'
  | 'openrouter'
  | 'chatgpt'
  | 'perplexity'
  | 'dataforseo'

export interface AIProviderConfig {
  id: AIProviderId
  name: string
  enabled: boolean
  priority: number
  isAvailable: boolean
}

export interface AIProviderResult {
  success: boolean
  text?: string
  provider: AIProviderId
  error?: string
  latencyMs?: number
  tokensUsed?: number
  costEstimate?: number
}

export interface AIProviderRequest {
  prompt: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  model?: string
}

export interface AIProvider {
  id: AIProviderId
  name: string
  isConfigured(): boolean
  isAvailable(): Promise<boolean>
  execute(request: AIProviderRequest): Promise<AIProviderResult>
}

export const PROVIDER_PRIORITY: AIProviderId[] = [
  'chatgpt',
  'gemini',
  'perplexity',
  'groq',
  'cerebras',
  'openrouter',
  'dataforseo',
]

export const PROVIDER_NAMES: Record<AIProviderId, string> = {
  gemini: 'Google Gemini',
  groq: 'Groq (Llama)',
  cerebras: 'Cerebras',
  openrouter: 'OpenRouter',
  chatgpt: 'ChatGPT Search',
  perplexity: 'Perplexity',
  dataforseo: 'Google AI Overview',
}
