// PATH: src/lib/services/fact-verifier.ts
//
// Compares the operator's declared ground-truth facts (brand_facts
// table) against the claims AI engines actually make about the brand
// (extracted from monitoring_results via the claim-divergence util).
// Surfaces contradictions so the operator can push corrections.
//
// Pure composer — reads existing tables, runs the existing regex
// extractor, returns a structured contradiction report. Zero LLM calls.

import { createServerClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { extractClaims, type ClaimType, type ExtractedClaim } from '@/lib/utils/claim-divergence'

export interface BrandFact {
  id: string
  brand_id: string
  fact_type: ClaimType
  value: string
  notes: string | null
  updated_at: string
}

export interface FactContradiction {
  factType: ClaimType
  expectedValue: string
  observedValue: string
  engines: string[]
  // Up to 3 example contexts where the contradiction appeared, so the
  // operator can see exactly what the AI said.
  contexts: string[]
}

export interface FactVerificationReport {
  totalFacts: number
  factsChecked: number
  contradictions: FactContradiction[]
  // For each declared fact, did ANY engine state the matching value?
  // (helps spot facts that AI doesn't know at all — worth pushing into
  // structured data or PR even if not actively wrong.)
  factsCovered: Array<{ factType: ClaimType; covered: boolean; engines: string[] }>
}

// Compare two normalised claim values for equality. Today this is exact
// match (the regex extractors already normalise). Kept as a function so
// future fact types can plug in fuzzy matching without changing callers.
function valuesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

export interface ResponseForVerification {
  engine: string
  responseText: string | null
}

export function verifyFacts(
  facts: BrandFact[],
  responses: ResponseForVerification[],
): FactVerificationReport {
  // Index extracted claims by type → list of {value, engine, context}
  const byType = new Map<ClaimType, Array<{ value: string; engine: string; context: string }>>()
  for (const r of responses) {
    if (!r.responseText) continue
    const claims: ExtractedClaim[] = extractClaims(r.responseText)
    for (const c of claims) {
      let arr = byType.get(c.type)
      if (!arr) {
        arr = []
        byType.set(c.type, arr)
      }
      arr.push({ value: c.value, engine: r.engine, context: c.context })
    }
  }

  const contradictions: FactContradiction[] = []
  const factsCovered: FactVerificationReport['factsCovered'] = []
  let factsChecked = 0

  for (const fact of facts) {
    const seen = byType.get(fact.fact_type) ?? []
    if (seen.length === 0) {
      factsCovered.push({ factType: fact.fact_type, covered: false, engines: [] })
      continue
    }
    factsChecked++

    // Group observed values; bucket the engines that stated each.
    const groups = new Map<string, { engines: Set<string>; contexts: string[] }>()
    for (const s of seen) {
      let g = groups.get(s.value)
      if (!g) {
        g = { engines: new Set(), contexts: [] }
        groups.set(s.value, g)
      }
      g.engines.add(s.engine)
      if (g.contexts.length < 3) g.contexts.push(s.context)
    }

    const matchGroup = Array.from(groups.entries()).find(([v]) => valuesMatch(v, fact.value))
    const enginesNamingTruth = matchGroup ? Array.from(matchGroup[1].engines).sort() : []
    factsCovered.push({
      factType: fact.fact_type,
      covered: enginesNamingTruth.length > 0,
      engines: enginesNamingTruth,
    })

    for (const [observed, { engines, contexts }] of groups.entries()) {
      if (valuesMatch(observed, fact.value)) continue
      contradictions.push({
        factType: fact.fact_type,
        expectedValue: fact.value,
        observedValue: observed,
        engines: Array.from(engines).sort(),
        contexts,
      })
    }
  }

  return {
    totalFacts: facts.length,
    factsChecked,
    contradictions: contradictions.sort((a, b) => b.engines.length - a.engines.length),
    factsCovered,
  }
}

export async function runFactVerification(brandId: string): Promise<FactVerificationReport> {
  const db = createServerClient()
  if (!db) {
    return { totalFacts: 0, factsChecked: 0, contradictions: [], factsCovered: [] }
  }

  const since = new Date()
  since.setDate(since.getDate() - 180)

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [factsRes, monitoringRes] = await Promise.all([
    (db as any).from('brand_facts').select('*').eq('brand_id', brandId),
    (db as any)
      .from('monitoring_results')
      .select('engine, response_text, created_at')
      .eq('brand_id', brandId)
      .gte('created_at', since.toISOString())
      .not('response_text', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5000),
  ])
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (factsRes.error) {
    logger.warn('fact-verifier: brand_facts query failed (non-fatal)', {
      err: String(factsRes.error),
    })
  }
  if (monitoringRes.error) {
    logger.warn('fact-verifier: monitoring query failed (non-fatal)', {
      err: String(monitoringRes.error),
    })
  }

  const facts = (factsRes.data ?? []) as BrandFact[]
  const responses = (
    (monitoringRes.data ?? []) as Array<{
      engine: string
      response_text: string | null
    }>
  ).map((r) => ({ engine: r.engine, responseText: r.response_text }))

  return verifyFacts(facts, responses)
}
