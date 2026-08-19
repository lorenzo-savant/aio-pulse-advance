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

// ─── AEO Pulse — Analysis ─────────────────────────────────────────────────────
export type EngineId = 'all' | 'chatgpt' | 'gemini' | 'perplexity' | 'claude'
export type MonitoringEngine = 'chatgpt' | 'gemini' | 'perplexity' | 'claude'

/**
 * Every engine the product has ever measured.
 *
 * Narrowed on 2026-08-17: this used to be what every reading surface iterated,
 * so a retired engine still appeared in per-engine charts and in client
 * reports. Claude's 4 usable results on a 427-result brand made that a liability
 * rather than a courtesy — a 0.9% series next to three real ones reads as a
 * finding, and a client asks about it.
 *
 * The rule now splits by purpose:
 *
 * - **Presentation** — per-engine charts, report tables, pickers, KPIs — uses
 *   `ACTIVE_ENGINES`. A retired engine is not shown.
 * - **Archive fidelity** — the raw CSV/JSON export, scan history, and label
 *   lookups like `ENGINE_LABEL` — keeps using this list, so nothing that was
 *   really collected becomes unreachable or renders as a bare slug.
 *
 * Retiring an engine stops it being measured and stops it being shown. It is
 * still not permission to delete or orphan the rows already in the database.
 */
export const ALL_ENGINES: readonly MonitoringEngine[] = [
  'chatgpt',
  'gemini',
  'perplexity',
  'claude',
] as const

/**
 * Engines a NEW run is allowed to use. Anything not listed here is never
 * called, whatever a stored prompt or an old request body asks for.
 *
 * Claude is out on cost. Measured over 1768 results (2026-05-18 → 2026-08-06):
 * 179 Claude runs cost $1.30 of a $2.01 total — 65% of the spend for 10% of
 * the runs, at $0.0072 per run against Gemini's $0.00015. That is the model's
 * list price ($3/$15 per million against $0.075/$0.30), not longer answers:
 * Gemini's replies were actually the longer ones.
 *
 * The engine stays in `MonitoringEngine` on purpose. 179 results already exist
 * with engine='claude' and they are real measurements; dropping it from the
 * type would make the archive unreadable to satisfy a billing decision.
 */
export const ACTIVE_ENGINES: readonly MonitoringEngine[] = [
  'chatgpt',
  'gemini',
  'perplexity',
] as const

/** True when this engine may be used for a new run. */
export function isActiveEngine(engine: string): engine is MonitoringEngine {
  return (ACTIVE_ENGINES as readonly string[]).includes(engine)
}
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
  /** Reference market the brand targets, e.g. "Sweden", "Italy B2B". Optional;
   *  generation derives one from `language` when this is empty. */
  market?: string | null
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
  market?: string
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
  type: 'factual_error' | 'attribution_error' | 'fabrication' | 'date_error' | 'unsupported_claim'
  /** Model's 0–1 confidence that this is a genuine hallucination (not a false positive). */
  confidence?: number
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
  sentiment_aspects: SentimentAspect[]
  cited_urls: string[]
  competitor_mentions: CompetitorMention[]
  /**
   * null = nothing assessed this result. Distinct from `false`, which means a
   * check ran and found nothing. The column is nullable in the database; the
   * type used to erase that, so an unassessed row was indistinguishable from a
   * verified-clean one.
   */
  has_hallucination: boolean | null
  hallucination_flags: HallucinationFlag[]
  /**
   * The provider that actually answered, after any router fallback
   * (e.g. 'gemini:flash-2.5'). `engine` above is only what was REQUESTED, and
   * the two diverge whenever a provider is unconfigured or errors. Null on rows
   * written before the column existed — unknown, not "the requested one".
   */
  response_provider?: string | null
  /**
   * Where cited_urls came from. 'brave_fallback' URLs answer the prompt's
   * query rather than the engine's response, so they are not evidence that the
   * engine cited anything and are excluded from citationRate.
   */
  citation_source?: CitationSource | null
  /**
   * Query fan-out: the search strings the engine actually ran for this prompt,
   * which are rarely the prompt itself (a Swedish prompt with diacritics and a
   * year came back as two searches with neither).
   *
   * NULL and [] mean different things and must never be merged:
   *   null → not captured. A row written before capture shipped, or a provider
   *          that does not expose its searches (Perplexity's sonar API).
   *   []   → the engine answered from model memory without searching.
   * See src/lib/services/fan-out.ts.
   */
  search_queries?: string[] | null
  created_at: string
  prompt?: Prompt
  brand?: Brand
}

/** Provenance of a row's cited_urls. Null means the row predates the column. */
export type CitationSource = 'engine' | 'brave_fallback'

// Fixed aspect taxonomy for aspect-based sentiment (ABSA). A closed set keeps
// the cross-run aggregation in /api/sentiment meaningful (no "price" vs
// "pricing" vs "cost" fragmentation).
export type SentimentAspectName =
  | 'pricing'
  | 'quality'
  | 'support'
  | 'reliability'
  | 'usability'
  | 'features'
  | 'reputation'
  | 'value'

export interface SentimentAspect {
  aspect: SentimentAspectName
  sentiment: SentimentLabel
}

// ─── WORK ORDERS ────────────────────────────────────────────────────────────
// Trackable recommendation: a unit of work with a status + GEO baseline/recheck
// deltas, so the advisor loop closes (did the action move the score?).
export type WorkOrderStatus = 'open' | 'in_progress' | 'done' | 'dismissed'

export interface WorkOrder {
  id: string
  brand_id: string
  user_id: string
  title: string
  category: string | null
  impact: string | null
  effort: string | null
  rationale: string | null
  actions: string[]
  status: WorkOrderStatus
  source: string
  baseline_geo_score: number | null
  recheck_geo_score: number | null
  recheck_delta: number | null
  created_at: string
  completed_at: string | null
  metadata: Record<string, unknown> | null
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
  | 'geo_score_drop' // GEO Score fell by >= threshold vs previous snapshot
  | 'geo_score_critical' // GEO Score dropped below absolute threshold (e.g. 60)

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
