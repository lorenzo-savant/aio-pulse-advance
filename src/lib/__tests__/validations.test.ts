import { describe, it, expect } from 'vitest'
import {
  analyzeTextSchema,
  competitorSchema,
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  updatePasswordSchema,
  searchSchema,
} from '../validations'

describe('analyzeTextSchema', () => {
  it('validates correct input', () => {
    const result = analyzeTextSchema.safeParse({
      input: 'Test content',
      mode: 'text',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty input', () => {
    const result = analyzeTextSchema.safeParse({
      input: '',
      mode: 'text',
    })
    expect(result.success).toBe(false)
  })

  it('rejects too long input', () => {
    const result = analyzeTextSchema.safeParse({
      input: 'a'.repeat(15001),
      mode: 'text',
    })
    expect(result.success).toBe(false)
  })

  it('validates engine options', () => {
    const result = analyzeTextSchema.safeParse({
      input: 'Test',
      mode: 'text',
      engine: 'gemini',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid engine', () => {
    const result = analyzeTextSchema.safeParse({
      input: 'Test',
      mode: 'text',
      engine: 'invalid',
    })
    expect(result.success).toBe(false)
  })
})

describe('competitorSchema', () => {
  it('validates correct competitor data', () => {
    const result = competitorSchema.safeParse({
      primaryUrl: 'https://example.com',
      competitorUrls: ['https://competitor1.com', 'https://competitor2.com'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid primary URL', () => {
    const result = competitorSchema.safeParse({
      primaryUrl: 'not-a-url',
      competitorUrls: ['https://competitor.com'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects no competitors', () => {
    const result = competitorSchema.safeParse({
      primaryUrl: 'https://example.com',
      competitorUrls: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects too many competitors', () => {
    const result = competitorSchema.safeParse({
      primaryUrl: 'https://example.com',
      competitorUrls: ['https://a.com', 'https://b.com', 'https://c.com', 'https://d.com'],
    })
    expect(result.success).toBe(false)
  })
})

describe('loginSchema', () => {
  it('validates correct login', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'invalid-email',
      password: 'password123',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: '',
    })
    expect(result.success).toBe(false)
  })
})

describe('registerSchema', () => {
  it('validates correct registration', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'Password1!',
      confirmPassword: 'Password1!',
      name: 'John Doe',
    })
    expect(result.success).toBe(true)
  })

  it('rejects mismatched passwords', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'Password1!',
      confirmPassword: 'Password2!',
      name: 'John Doe',
    })
    expect(result.success).toBe(false)
  })

  it('rejects short password', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'Pass1!',
      confirmPassword: 'Pass1!',
      name: 'John Doe',
    })
    expect(result.success).toBe(false)
  })

  it('rejects password without uppercase', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'password1!',
      confirmPassword: 'password1!',
      name: 'John Doe',
    })
    expect(result.success).toBe(false)
  })

  it('rejects password without number', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'Password!!',
      confirmPassword: 'Password!!',
      name: 'John Doe',
    })
    expect(result.success).toBe(false)
  })

  it('rejects password without special character', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'Password1',
      confirmPassword: 'Password1',
      name: 'John Doe',
    })
    expect(result.success).toBe(false)
  })

  it('rejects short name', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'Password1!',
      confirmPassword: 'Password1!',
      name: 'J',
    })
    expect(result.success).toBe(false)
  })
})

describe('forgotPasswordSchema', () => {
  it('validates correct email', () => {
    const result = forgotPasswordSchema.safeParse({
      email: 'test@example.com',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = forgotPasswordSchema.safeParse({
      email: 'invalid',
    })
    expect(result.success).toBe(false)
  })
})

describe('updatePasswordSchema', () => {
  it('validates matching passwords', () => {
    const result = updatePasswordSchema.safeParse({
      password: 'Password1!',
      confirmPassword: 'Password1!',
    })
    expect(result.success).toBe(true)
  })

  it('rejects mismatched passwords', () => {
    const result = updatePasswordSchema.safeParse({
      password: 'Password1!',
      confirmPassword: 'Password2!',
    })
    expect(result.success).toBe(false)
  })
})

describe('searchSchema', () => {
  it('validates correct search params', () => {
    const result = searchSchema.safeParse({
      query: 'test search',
      page: 1,
      perPage: 20,
    })
    expect(result.success).toBe(true)
  })

  it('applies defaults', () => {
    const result = searchSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.perPage).toBe(20)
    }
  })

  it('coerces string numbers', () => {
    const result = searchSchema.safeParse({
      page: '2',
      perPage: '10',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(2)
      expect(result.data.perPage).toBe(10)
    }
  })

  it('rejects invalid perPage', () => {
    const result = searchSchema.safeParse({
      perPage: 200,
    })
    expect(result.success).toBe(false)
  })
})
