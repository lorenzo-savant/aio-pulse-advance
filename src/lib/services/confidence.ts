// PATH: src/lib/services/confidence.ts
//
// Sample-size confidence labelling (idea from the AI-Visibility-Readiness
// framework, which insists a metric's trustworthiness scales with how many
// observations back it — "a single round of 20 queries is a LOW-confidence
// signal, not a definitive answer"). We attach this to data-derived metrics so
// the UI never presents a verdict built on 6 scans as if it were certain.

export type ConfidenceLevel = 'low' | 'medium' | 'high'

/**
 * Map a sample size (number of monitored responses backing a metric) to a
 * confidence level. Thresholds chosen to match the existing Market Position
 * bands: < 10 = low, < 30 = medium, ≥ 30 = high.
 */
export function sampleConfidence(n: number): ConfidenceLevel {
  if (n >= 30) return 'high'
  if (n >= 10) return 'medium'
  return 'low'
}
