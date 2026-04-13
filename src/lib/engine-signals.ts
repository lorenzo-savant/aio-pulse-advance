// Pure constants — safe to import from client components.
// Extracted from gemini.ts to avoid pulling server-only deps (dns/promises).

export const ENGINE_SIGNALS: Record<string, string[]> = {
  chatgpt: [
    'Define key terms clearly in the first paragraph',
    'Use numbered lists for step-by-step content',
    'Include concrete examples with measurable outcomes',
    'Add FAQ sections with question-answer format',
    'Cite authoritative sources explicitly',
  ],
  gemini: [
    'Optimize for Knowledge Graph entity recognition',
    'Use structured data / schema markup',
    'Include geographic and temporal signals',
    'Improve E-E-A-T signals (author bio, credentials)',
    'Add clear topic headings that match search queries',
  ],
  perplexity: [
    'Increase factual density with statistics and data',
    'Add publication dates and source attribution',
    'Use direct, declarative sentence structures',
    'Include numerical data and comparative metrics',
    'Add primary source links and citations',
  ],
  claude: [
    'Develop logical argument chains with clear reasoning',
    'Acknowledge nuance, counterarguments, and edge cases',
    'Use precise technical language appropriate to context',
    'Structure content with clear conceptual hierarchy',
    'Include comparative analysis and synthesis',
  ],
}

export function getEngineSignals(engineId: string): string[] {
  return ENGINE_SIGNALS[engineId.toLowerCase()] ?? []
}
