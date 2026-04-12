export type AIProviderId =
  | 'gemini'
  | 'chatgpt'
  | 'perplexity'
  | 'claude'
  | 'dataforseo'
  | 'azure-openai'

export interface AIProviderConfig {
  id: AIProviderId
  name: string
  enabled: boolean
  priority: number
  isAvailable: boolean
  latencyMs?: number
}

export interface AIProviderResult {
  success: boolean
  text?: string
  provider: AIProviderId
  error?: string
  latencyMs?: number
  tokensUsed?: number
  costEstimate?: number
  cached?: boolean
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

export interface ProviderTimeoutConfig {
  warningMs: number
  timeoutMs: number
  maxRetries: number
}

export const DEFAULT_TIMEOUT_CONFIG: Record<AIProviderId, ProviderTimeoutConfig> = {
  perplexity: { warningMs: 1500, timeoutMs: 45000, maxRetries: 1 },
  gemini: { warningMs: 2000, timeoutMs: 60000, maxRetries: 2 },
  'azure-openai': { warningMs: 2000, timeoutMs: 60000, maxRetries: 2 },
  claude: { warningMs: 2500, timeoutMs: 60000, maxRetries: 1 },
  chatgpt: { warningMs: 3000, timeoutMs: 90000, maxRetries: 1 },
  dataforseo: { warningMs: 3000, timeoutMs: 120000, maxRetries: 1 },
}

export const DEFAULT_PROVIDER_PRIORITY: AIProviderId[] = [
  'perplexity',
  'gemini',
  'claude',
  'azure-openai',
  'chatgpt',
  'dataforseo',
]

export const PROVIDER_PRIORITY: AIProviderId[] = [
  'perplexity',
  'gemini',
  'claude',
  'azure-openai',
  'chatgpt',
  'dataforseo',
]

export const PROVIDER_NAMES: Record<AIProviderId, string> = {
  gemini: 'Google Gemini',
  chatgpt: 'ChatGPT Search',
  perplexity: 'Perplexity',
  claude: 'Anthropic Claude',
  dataforseo: 'Google AI Overview',
  'azure-openai': 'Azure OpenAI',
}
