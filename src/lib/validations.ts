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
