import { describe, it, expect } from 'vitest'
import { generatePrompts, getAllIndustryPresets } from '../services/prompt-generator'

// Regression pins for the ReCommerce/Relovie prompt bugs: English scaffolding
// leaking onto a Swedish brand, the {category} placeholder hydrated from the
// business model ("var köper jag prisjämförelse billigast"), and the empty
// {location} borrowing a seed keyword ("... prisjämförelse prisjämförelse").

const svPrompts = generatePrompts('Relovie AB', 'recommerce-comparison', 'sv', undefined, [
  'Blocket',
  'Tradera',
]).map((p) => p.userQuery)

describe('recommerce-comparison prompts (SV)', () => {
  it('are all native Swedish — no English scaffolding leaks', () => {
    const english =
      /\b(compare prices|cheapest|best site|review|reliable|buy second-hand|what is|how does|is .+ legit|safe to use)\b/i
    expect(svPrompts.filter((p) => english.test(p))).toEqual([])
  })

  it('use PRODUCT categories, never the business model', () => {
    expect(svPrompts.some((p) => p.includes('elektronik'))).toBe(true)
    expect(svPrompts.some((p) => /k[öo]per jag prisj[äa]mf[öo]relse/.test(p))).toBe(false)
    expect(svPrompts.some((p) => /prisj[äa]mf[öo]relse prisj[äa]mf[öo]relse/.test(p))).toBe(false)
  })

  it('have no empty-placeholder residue (trimmed, no double spaces)', () => {
    for (const p of svPrompts) {
      expect(p).toBe(p.trim())
      expect(p).not.toMatch(/\s{2,}/)
    }
  })

  it('include native comparison prompts against the real competitors', () => {
    expect(svPrompts).toContain('Relovie AB vs Blocket')
  })
})

describe('template engine — no empty output regressions', () => {
  it('every preset produces prompts for en/it/sv (the route 404s on empty)', () => {
    for (const preset of getAllIndustryPresets()) {
      for (const loc of ['en', 'it', 'sv'] as const) {
        expect(generatePrompts('T', preset.id, loc, undefined, ['C']).length).toBeGreaterThan(0)
      }
    }
  })
})
