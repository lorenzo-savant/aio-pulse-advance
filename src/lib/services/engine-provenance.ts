// PATH: src/lib/services/engine-provenance.ts
//
// Provenance check for per-engine statistics.
//
// The router's cross-provider fallback keeps a run alive when an engine's own
// provider fails, and records who actually answered in
// monitoring_results.response_provider (migration 20260805090000). The comment
// in ai-router.ts promised "a run served by OpenAI is never counted as a
// Gemini measurement" — but nothing enforced it: verified on 2026-08-18,
// every per-engine surface counted fallback-served rows as measurements of
// the requested engine. During the week gemini-2.5-flash was retired (404),
// ALL 119 engine=gemini rows were served by openai:gpt-4o-mini and still
// appeared in Gemini breakdowns, snapshots and health scores.
//
// The rule this module enforces:
// - PER-ENGINE presentation (engine breakdown tables, per-engine snapshot
//   series, engine_breakdown in health scores) counts a row only when the
//   answering provider belongs to the engine's own family.
// - AGGREGATE surfaces (the 'all' snapshot bucket, brand-level mention rates)
//   keep every row: a fallback-served answer is still a real AI answer to the
//   prompt — it is just not a measurement of the engine it was requested for.
// - Rows with response_provider = NULL predate the provenance column. They are
//   unknowable and are counted as matching: the alternative silently empties
//   months of history, and rewriting the past is not this module's job.

import type { MonitoringEngine } from '@/types'

const ENGINE_PROVIDER_PREFIX: Record<MonitoringEngine, string> = {
  chatgpt: 'openai:',
  gemini: 'gemini:',
  perplexity: 'perplexity:',
  claude: 'anthropic:',
}

/** True when the row's answering provider belongs to the engine it was
 *  requested for (or when provenance is unknowable — NULL/legacy rows). */
export function providerMatchesEngine(
  engine: string,
  responseProvider: string | null | undefined,
): boolean {
  if (responseProvider == null || responseProvider === '') return true
  const prefix = ENGINE_PROVIDER_PREFIX[engine as MonitoringEngine]
  // Unknown engine string: nothing to check against — do not drop data.
  if (!prefix) return true
  return responseProvider.startsWith(prefix)
}
