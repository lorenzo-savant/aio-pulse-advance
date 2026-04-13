// ─── Primitive Aliases ────────────────────────────────────────────────────────
export type Nullable<T> = T | null
export type Optional<T> = T | undefined
export type Awaitable<T> = T | Promise<T>

// ─── UI / Theme ───────────────────────────────────────────────────────────────
export type Theme = 'light' | 'dark' | 'system'
export type ColorVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'ghost'
export type SizeVariant = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

// ─── API ──────────────────────────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  data: T
  success: boolean
  message?: string
  timestamp: number
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: { page: number; perPage: number; total: number; totalPages: number }
}

// ─── AIO Pulse — Analysis ─────────────────────────────────────────────────────
export type EngineId = 'all' | 'chatgpt' | 'gemini' | 'perplexity' | 'claude'
export type MonitoringEngine = 'chatgpt' | 'gemini' | 'perplexity' | 'claude'
export type AIProvider = 'gemini' | 'openai' | 'perplexity' | 'anthropic'
export type ModelId =
  | 'default'
  | 'gemini-flash'
  | 'gemini-pro'
  | 'gpt-4o-mini'
  | 'gpt-4o'
  | 'claude-sonnet'
  | 'claude-haiku'
  | 'perplexity-sonar'
export type IntentType = 'Informational' | 'Navigational' | 'Transactional' | 'Commercial' | 'Mixed'
export type AnalysisMode = 'text' | 'url'

export interface Keyword {
  word: string
  impact: number
  difficulty: number
}
export interface KeywordWithDensity extends Keyword {
  count: number
  density: number
}

export interface AIOScore {
  engine: string
  score: number
  status: 'optimal' | 'needs-work' | 'critical'
  details: string
}

export interface AnalysisResult {
  id: string
  source: string
  type: AnalysisMode
  summary: string
  visibilityScore: number
  engineBreakdown: AIOScore[]
  suggestions: string[]
  keywords: Keyword[]
  analyzedText: string
  intent: IntentType
  intentConfidence: number
  intentSignals: string[]
  contentType: string
  contentTypeConfidence: number
  tone: string
  toneConfidence: number
  readingLevel: string
  audience: string
  timestamp: number
}

export interface ScanHistoryEntry extends AnalysisResult {
  engine: EngineId
  model: ModelId
}

// ─── BRANDS ───────────────────────────────────────────────────────────────────
export type BrandLanguage = 'en' | 'it' | 'sv'

export interface Brand {
  id: string
  user_id: string
  name: string
  slug: string
  description?: string | null
  domain?: string | null
  aliases: string[]
  domains: string[]
  competitors: string[]
  industry?: string | null
  color: string
  logo_url?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  language: BrandLanguage
  // White-label report settings
  report_logo_url?: string | null
  report_brand_name?: string | null
  report_primary_color?: string | null
}

export interface BrandCreateInput {
  name: string
  description?: string
  domain?: string
  aliases?: string[]
  domains?: string[]
  competitors?: string[]
  industry?: string
  color?: string
  language?: BrandLanguage
}

// ─── QUERY CATEGORIES (User Journey) ──────────────────────────────────────────
export type QueryCategory =
  | 'awareness' // Top of funnel: User is discovering a problem/solution
  | 'interest' // Learning more, comparing options
  | 'consideration' // Evaluating specific solutions
  | 'purchase' // Ready to buy, looking for pricing/buy links
  | 'comparison' // Comparing alternatives
  | 'alternative' // Looking for alternatives to a solution

export interface QueryCategoryInfo {
  id: QueryCategory
  name: string
  description: string
  color: string
  position: number
}

export const QUERY_CATEGORIES: QueryCategoryInfo[] = [
  {
    id: 'awareness',
    name: 'Awareness',
    description: 'Top of funnel: Discovery and problem recognition',
    color: '#8b5cf6',
    position: 1,
  },
  {
    id: 'interest',
    name: 'Interest',
    description: 'Learning phase: Research and information gathering',
    color: '#3b82f6',
    position: 2,
  },
  {
    id: 'consideration',
    name: 'Consideration',
    description: 'Evaluation phase: Comparing specific solutions',
    color: '#10b981',
    position: 3,
  },
  {
    id: 'purchase',
    name: 'Purchase',
    description: 'Bottom of funnel: Pricing, reviews, buying intent',
    color: '#f59e0b',
    position: 4,
  },
  {
    id: 'comparison',
    name: 'Comparison',
    description: 'Side-by-side product or service comparisons',
    color: '#ec4899',
    position: 5,
  },
  {
    id: 'alternative',
    name: 'Alternative',
    description: 'Finding alternatives to existing solutions',
    color: '#6366f1',
    position: 6,
  },
]

export function getCategoryById(id: QueryCategory): QueryCategoryInfo | undefined {
  return QUERY_CATEGORIES.find((c) => c.id === id)
}

export function getCategoryColor(id: QueryCategory): string {
  return getCategoryById(id)?.color ?? '#6b7280'
}

// ─── PROMPTS ──────────────────────────────────────────────────────────────────
export type PromptCategory = QueryCategory | 'custom'
export type RunFrequency = 'hourly' | 'daily' | 'weekly'

export interface Prompt {
  id: string
  brand_id: string
  user_id: string
  text: string
  language: string
  market: string
  category: PromptCategory | null
  engines: MonitoringEngine[]
  is_active: boolean
  run_frequency: RunFrequency
  last_run_at: string | null
  created_at: string
  updated_at: string
  brand?: Brand
}

export interface PromptCreateInput {
  brand_id: string
  text: string
  language?: string
  market?: string
  category?: PromptCategory
  engines?: MonitoringEngine[]
  run_frequency?: RunFrequency
}

// ─── MONITORING RESULTS ───────────────────────────────────────────────────────
export type SentimentLabel = 'positive' | 'negative' | 'neutral'
export type MentionType = 'direct' | 'indirect' | 'none'

export interface CompetitorMention {
  name: string
  position: number
  count: number
}

export interface HallucinationFlag {
  text: string
  severity: 'low' | 'medium' | 'high'
  type: 'factual_error' | 'attribution_error' | 'fabrication' | 'date_error'
}

export interface MonitoringResult {
  id: string
  prompt_id: string
  brand_id: string
  user_id: string
  engine: MonitoringEngine
  query_text?: string | null
  prompt_text: string
  response_text: string
  brand_mentioned: boolean
  mention_position: number | null
  mention_count: number
  mention_type: MentionType | null
  visibility_score: number
  sentiment: SentimentLabel | null
  sentiment_score: number | null
  cited_urls: string[]
  competitor_mentions: CompetitorMention[]
  has_hallucination: boolean
  hallucination_flags: HallucinationFlag[]
  created_at: string
  prompt?: Prompt
  brand?: Brand
}

// ─── ALERTS ───────────────────────────────────────────────────────────────────
export type AlertType =
  | 'mention_new'
  | 'mention_lost'
  | 'sentiment_drop'
  | 'sentiment_spike'
  | 'competitor_ahead'
  | 'hallucination'
  | 'visibility_change'
  | 'citation_rate_change'

export interface AlertCondition {
  threshold?: number
  operator?: 'gt' | 'lt' | 'gte' | 'lte' | 'eq'
  engine?: MonitoringEngine | 'all'
  competitor?: string
  sentiment?: SentimentLabel
}

export interface AlertRule {
  id: string
  brand_id: string
  user_id: string
  name: string
  type: AlertType
  condition: AlertCondition
  channels: string[]
  email: string | null
  webhook_url: string | null
  is_active: boolean
  last_fired_at: string | null
  created_at: string
  brand?: Brand
}

export interface AlertEvent {
  id: string
  alert_rule_id: string
  brand_id: string
  user_id: string
  type: AlertType
  title: string
  message: string
  data: Record<string, unknown>
  channels_sent: string[]
  is_read: boolean
  created_at: string
  brand?: Brand
  alert_rule?: AlertRule
}

export interface AlertRuleCreateInput {
  brand_id: string
  name: string
  type: AlertType
  condition: AlertCondition
  channels?: string[]
  email?: string
  webhook_url?: string
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export interface StatCard {
  title: string
  value: string | number
  change: number
  suffix?: string
}
export interface EngineStatItem {
  name: string
  score: number
  color: string
}

// ─── TEAM ───────────────────────────────────────────────────────────────────────
export type TeamRole = 'owner' | 'editor' | 'viewer'
export type TeamStatus = 'pending' | 'accepted' | 'declined'

export interface TeamMember {
  id: string
  brand_id: string
  user_id: string | null
  email: string
  role: TeamRole
  invited_by: string
  status: TeamStatus
  created_at: string
  updated_at: string
}

export interface BrandInvitation {
  id: string
  brand_id: string
  email: string
  role: TeamRole
  invited_by: string
  token: string
  expires_at: string
  created_at: string
}

export type WorkflowStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'retrying'
export type WorkflowType =
  | 'monitoring_run'
  | 'brand_setup'
  | 'alert_evaluation'
  | 'data_export'
  | 'health_score_calc'

export interface WorkflowStep {
  id: string
  name: string
  status: WorkflowStatus
  startedAt?: string
  completedAt?: string
  error?: string
}

export interface WorkflowExecution {
  id: string
  type: WorkflowType
  brandId?: string
  promptId?: string
  status: WorkflowStatus
  steps: WorkflowStep[]
  startedAt: string
  completedAt?: string
  error?: string
  metadata?: Record<string, unknown>
}
