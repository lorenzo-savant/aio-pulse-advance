// Pure constants — safe to import from client components.
// Extracted from gemini.ts to avoid pulling server-only deps (dns/promises).

// Based on Kalyani Khona — "LLM Model Behavior Research" (2025)
// Each engine has distinct attention patterns shaped by fine-tuning philosophy
export const ENGINE_SIGNALS: Record<string, string[]> = {
  chatgpt: [
    'Use scannable lists and comparison tables for list-detection attention heads',
    'Front-load key facts in first 100 words for efficient extraction',
    'Include quantified benefits — strong attention to numbers and metrics',
    'Offer multiple options with pros/cons for RLHF "helpful assistant" preference',
    'Add FAQ sections matching conversational training data',
  ],
  gemini: [
    'Include author credentials and publication dates for authority signal attention',
    'Use JSON-LD structured data markup — high citation-source weighting',
    'Cite multiple authoritative sources with inline attribution',
    'Update content regularly — highest recency bias of all models',
    'Align with E-E-A-T signals (experience, expertise, trustworthiness)',
  ],
  perplexity: [
    'Achieve source diversity — appear on multiple authoritative domains',
    'Add inline citations with direct links for every factual claim',
    'Include time-stamped current data and statistics',
    'Use declarative sentence structure for efficient extraction',
    'For deep research: ensure Wikipedia and academic source presence',
  ],
  claude: [
    'Build reasoning chains with causal language ("because", "therefore")',
    'Acknowledge nuance and counterarguments — Constitutional AI safety bias',
    'Include evidence-backed claims with explicit reasoning chain structure',
    'Use authoritative academic sources — higher scholarly trust weighting',
    'Structure content as claim → evidence → implication',
  ],
}

export function getEngineSignals(engineId: string): string[] {
  return ENGINE_SIGNALS[engineId.toLowerCase()] ?? []
}
