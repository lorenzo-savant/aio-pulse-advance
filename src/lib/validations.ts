import { z } from 'zod'

// ─── Analysis ─────────────────────────────────────────────────────────────────

export const analyzeTextSchema = z
  .object({
    input: z.string().min(1, 'Content is required').max(15_000, 'Content too long'),
    mode: z.enum(['text', 'url']),
    engine: z.enum(['all', 'chatgpt', 'gemini', 'perplexity', 'claude']).default('all'),
    provider: z.enum(['gemini', 'openai', 'perplexity', 'anthropic']).default('gemini'),
    model: z
      .enum([
        'default',
        'gemini-flash',
        'gemini-pro',
        'gpt-4o-mini',
        'gpt-4o',
        'claude-sonnet',
        'claude-haiku',
        'perplexity-sonar',
      ])
      .default('default'),
  })
  .refine(
    (d) => {
      if (d.mode !== 'url') return true
      try {
        const u = new URL(d.input.includes('://') ? d.input : `https://${d.input}`)
        return u.protocol === 'http:' || u.protocol === 'https:'
      } catch {
        return false
      }
    },
    { message: 'A valid http(s) URL is required for url mode', path: ['input'] },
  )

export type AnalyzeTextInput = z.infer<typeof analyzeTextSchema>

// ─── Competitor ───────────────────────────────────────────────────────────────

export const competitorSchema = z.object({
  primaryUrl: z.string().url('Invalid primary URL'),
  competitorUrls: z
    .array(z.string().url('Invalid URL'))
    .min(1, 'Add at least one competitor')
    .max(3, 'Maximum 3 competitors'),
})

export type CompetitorInput = z.infer<typeof competitorSchema>

// ─── Auth ─────────────────────────────────────────────────────────────────────

const passwordComplexity = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export type LoginInput = z.infer<typeof loginSchema>

export const registerSchema = loginSchema
  .extend({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })
  .refine((data) => passwordComplexity.safeParse(data.password).success, {
    message:
      'Password must be at least 8 characters with uppercase, lowercase, number, and special character',
    path: ['password'],
  })

export type RegisterInput = z.infer<typeof registerSchema>

export const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
})

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

export const updatePasswordSchema = z
  .object({
    password: passwordComplexity,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })

export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>

// ─── Search / Filter ─────────────────────────────────────────────────────────

export const searchSchema = z.object({
  query: z.string().max(200).optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().min(5).max(100).default(20),
})

export type SearchInput = z.infer<typeof searchSchema>

// ─── Public API (/api/v1/*) ────────────────────────────────────────────────
//
// These guard the externally-reachable, API-key-authenticated surface. Zod's
// default object stripping is load-bearing here: a brand row has system columns
// (id, user_id, slug, created_at, organization_id, workspace_id, ...) that a
// caller must never set. By listing ONLY the user-editable fields, `safeParse`
// silently drops everything else — closing the mass-assignment hole where
// `db.from('brands').update(body)` previously trusted the raw request body.

const brandColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'color must be a 6-digit hex like #6366f1')
const brandStringArray = z.array(z.string().max(255)).max(100)

export const publicBrandCreateSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(120),
  description: z.string().max(2000).nullish(),
  domain: z.string().max(255).nullish(),
  aliases: brandStringArray.nullish(),
  domains: brandStringArray.nullish(),
  competitors: brandStringArray.nullish(),
  industry: z.string().max(120).nullish(),
  language: z.string().min(2).max(12).nullish(),
  color: brandColor.nullish(),
})

export type PublicBrandCreateInput = z.infer<typeof publicBrandCreateSchema>

export const publicBrandUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().max(2000).nullish(),
    domain: z.string().max(255).nullish(),
    aliases: brandStringArray.nullish(),
    domains: brandStringArray.nullish(),
    competitors: brandStringArray.nullish(),
    industry: z.string().max(120).nullish(),
    language: z.string().min(2).max(12).nullish(),
    color: brandColor.nullish(),
    is_active: z.boolean().nullish(),
  })
  // After stripping non-allowlisted keys, require at least one real field so a
  // body of only system columns (now stripped to {}) is rejected, not no-op'd.
  .refine((d) => Object.keys(d).length > 0, { message: 'Provide at least one field to update' })

export type PublicBrandUpdateInput = z.infer<typeof publicBrandUpdateSchema>

export const webhookVerifySchema = z.object({
  payload: z.string().min(1, 'payload is required').max(100_000),
  signature: z.string().min(1, 'signature is required').max(2048),
  secret: z.string().min(1, 'secret is required').max(2048),
})

export type WebhookVerifyInput = z.infer<typeof webhookVerifySchema>

export const creditEstimateSchema = z
  .object({
    model: z.string().min(1, 'model is required').max(100),
    messages: z
      .array(z.object({ role: z.string().max(40), content: z.string().max(100_000) }))
      .max(500)
      .optional(),
    inputTokens: z.number().int().nonnegative().max(10_000_000).optional(),
    outputTokens: z.number().int().nonnegative().max(10_000_000).optional(),
  })
  .refine(
    (d) =>
      (d.messages && d.messages.length > 0) ||
      (typeof d.inputTokens === 'number' && typeof d.outputTokens === 'number'),
    { message: 'Either messages[] or inputTokens + outputTokens required' },
  )

export type CreditEstimateInput = z.infer<typeof creditEstimateSchema>

/** First human-readable message from a ZodError, for terse API error bodies. */
export function firstZodMessage(error: z.ZodError, fallback = 'Invalid request body'): string {
  return error.issues[0]?.message ?? fallback
}

// ─── Internal write handlers (LLM-cost / billing / RBAC surfaces) ───────────

// AI agent chat: `message` is the cost-bearing field (it's forwarded to an LLM
// and scanned for an audit URL), so cap its length. `context` is an internal
// blob the UI assembles and the handler reads with optional chaining — left as
// `any` so we don't impose a structural contract we'd have to keep in sync.
export const aiAgentMessageSchema = z.object({
  message: z.string().trim().min(1, 'Message required').max(10_000),
  agentId: z.string().max(100).optional(),
  brandId: z.string().max(100).optional(),
  conversationId: z.string().max(100).optional(),
  context: z.any().optional(),
})

export type AiAgentMessageInput = z.infer<typeof aiAgentMessageSchema>

// credits/use: `engines` drives the credit cost calc — bound the array so a
// malformed body can't balloon the deduction loop.
export const creditsUseSchema = z.object({
  engines: z.array(z.string().max(40)).min(1).max(10).optional(),
  provider: z.string().max(40).optional(),
  brand_id: z.string().max(100).optional(),
  query_id: z.string().max(100).optional(),
})

export type CreditsUseInput = z.infer<typeof creditsUseSchema>

// journey/analyze: each turn's `prompt` feeds downstream analysis. id/timestamp
// default so callers that omit them (the old handler never required them) keep
// working while the output stays structurally a JourneyTurn.
export const journeyAnalyzeSchema = z.object({
  turns: z
    .array(
      z.object({
        id: z.string().max(200).optional().default(''),
        prompt: z
          .string()
          .min(1, 'Each turn must have a prompt string')
          .max(8000, 'Turn prompt too long (max 8000 chars)'),
        response: z.string().max(50_000).optional(),
        timestamp: z.number().optional().default(0),
      }),
    )
    .min(1, 'turns array is required and must not be empty')
    .max(50, 'Too many turns (max 50)'),
  brandDomain: z.string().max(255).optional(),
})

export type JourneyAnalyzeInput = z.infer<typeof journeyAnalyzeSchema>

// workflows (create mode): the enum replaces the handler's manual validTypes
// check. userId is taken from the session, never the body, so it's absent here.
export const workflowCreateSchema = z.object({
  type: z.enum([
    'monitoring_run',
    'brand_setup',
    'alert_evaluation',
    'data_export',
    'health_score_calc',
  ]),
  brandId: z.string().max(100).optional(),
  promptId: z.string().max(100).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type WorkflowCreateInput = z.infer<typeof workflowCreateSchema>

// workspace members (RBAC): validate the target userId + role shape. The
// authorization (canManageMembers, last-owner protection) stays in the handler.
const workspaceRole = z.enum(['owner', 'admin', 'editor', 'viewer'])

export const workspaceMemberAddSchema = z.object({
  userId: z.string().min(1, 'userId and workspaceId required').max(100),
  role: workspaceRole.optional(),
})

export type WorkspaceMemberAddInput = z.infer<typeof workspaceMemberAddSchema>

export const workspaceMemberRoleSchema = z.object({
  userId: z.string().min(1, 'userId, role, and workspaceId required').max(100),
  role: workspaceRole,
})

export type WorkspaceMemberRoleInput = z.infer<typeof workspaceMemberRoleSchema>
