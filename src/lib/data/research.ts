// ─────────────────────────────────────────────────────────────────────────────
// NOTICE — attribution + commercial-use licensing
// ─────────────────────────────────────────────────────────────────────────────
// This file is a derivative work. Concepts (the 6-layer visibility framework,
// "interpretability gap", "semantic monopolies", per-model behavior profiling)
// are synthesised from the public research notes at:
//
//   Kalyani Khona — "LLM Model Behavior Research" (2025)
//   https://github.com/kalyanikhona/llm-model-behavior-research
//
// That repository is licensed CC BY 4.0 *for educational and research use*;
// commercial use of verbatim research prose requires the author's permission.
// The strings below are paraphrased / rewritten, not copied — but if you ever
// surface them in a customer-facing artefact (PDF report, sales deck, blog
// post), keep the "Source:" attribution lines emitted by the builder functions
// below and confirm with the author for verbatim-quote usage.
//
// Wording rule: every claim in this file describes OBSERVED PATTERNS from
// external research, not verified internal model architecture. The hedging
// language ("tends to", "observed", "per research") is deliberate so the
// downstream LLM doesn't repeat these as established facts in user output.
// ─────────────────────────────────────────────────────────────────────────────

export interface ModelBehaviorProfile {
  engine: string
  label: string
  fineTuningPhilosophy: string
  contentPreferences: string[]
  contentWeaknesses: string[]
  attentionPatterns: string[]
  geoImplications: string[]
}

export interface VisibilityLayer {
  layer: number
  name: string
  description: string
  checkQuestions: string[]
}

export const MODEL_BEHAVIOR_PROFILES: ModelBehaviorProfile[] = [
  {
    engine: 'chatgpt',
    label: 'ChatGPT (OpenAI GPT-4o)',
    fineTuningPhilosophy:
      'Maximum helpfulness via RLHF — quick, actionable answers rewarded. "Helpful Assistant" approach.',
    contentPreferences: [
      'Lists, bullet points, structured comparisons',
      'Multiple options and alternatives — "choose your own adventure"',
      'Practical, actionable information with quantified benefits',
      'Quick-start sections, decision frameworks, tables',
      'Self-contained sentences with clear fact-per-token density',
    ],
    contentWeaknesses: [
      'Long paragraphs without clear extraction points',
      'Academic wall-of-text with buried conclusions',
      'Content requiring significant processing overhead',
    ],
    attentionPatterns: [
      'Observed: stronger response to lists and structured comparisons',
      'Observed: stronger response to quantified benefits and numbers',
      'Prefers scannable content structure — H2/H3 + bullets',
      'Observed: stronger response to "best", "top", "recommended" triggers',
    ],
    geoImplications: [
      'Best optimized with comparison tables and decision frameworks',
      'Include pros/cons for every product or approach mentioned',
      'Recommendation lists with pricing and features are highly citeable',
      'Front-load key facts in the first 100 words',
    ],
  },
  {
    engine: 'claude',
    label: 'Claude (Anthropic)',
    fineTuningPhilosophy:
      'Constitutional AI — helpful, harmless, honest (HHH). Trained on self-critique and long-document coherence.',
    contentPreferences: [
      'Reasoning chains with causal language ("because", "therefore", "evidence shows")',
      'Nuanced analysis acknowledging complexity and uncertainty',
      'Academic research-backed content with clear evidence',
      'Long-form analysis with structured arguments (claim → evidence → implication)',
      'Goal-exploration structure — starts with "why this matters"',
    ],
    contentWeaknesses: [
      'Pure comparison tables without reasoning context',
      'Unsubstantiated claims without evidence chain',
      'Overly promotional content lacking nuance',
    ],
    attentionPatterns: [
      'Observed: stronger response to causal language and reasoning chains',
      'Observed: stronger response to "because", "therefore", "evidence", "however"',
      'Better long-document coherence than other models',
      'Safety bias — overweights trustworthiness in ambiguous queries',
    ],
    geoImplications: [
      'Best optimized with claim + evidence + implication structure',
      'Include nuanced perspectives — acknowledge counterarguments',
      'Academic and authoritative sources are weighted more heavily',
      'Content that teaches concepts gets "explanation preference" boost',
    ],
  },
  {
    engine: 'gemini',
    label: 'Gemini (Google)',
    fineTuningPhilosophy:
      'Factual accuracy + multimodal integration. Leverages Google ecosystem. Trained on authority signals and freshness.',
    contentPreferences: [
      'Explicit authority signals — author bios, credentials, publication dates',
      'Factual precision — specific dates, numbers, named sources',
      'Recent/updated content with visible "last updated" dates',
      'Citation-heavy content with multiple authoritative sources',
      'E-E-A-T aligned content (experience, expertise, authoritativeness, trustworthiness)',
    ],
    contentWeaknesses: [
      'Content without attribution or publication dates',
      'Opinion pieces without supporting evidence',
      'Old/stale content without recent updates',
    ],
    attentionPatterns: [
      'Observed: stronger response to authority signals and source credibility',
      'Observed: stronger response to citations and named sources',
      'Temporal attention — dates, "latest", year markers trigger recency bias',
      'Observed: stronger response to traditional SEO signals and structured data',
    ],
    geoImplications: [
      'Best optimized with explicit author credentials and publication dates',
      'Include external validation quotes from recognized sources',
      'Update content regularly with visible changelog',
      'Structured data markup (JSON-LD Schema.org) is highly weighted',
    ],
  },
  {
    engine: 'perplexity',
    label: 'Perplexity AI',
    fineTuningPhilosophy:
      'Real-time factual synthesis with source diversity. Prioritizes cited, verifiable information.',
    contentPreferences: [
      'Fact-dense content with inline citations and source links',
      'Real-time data, statistics, and specific metrics',
      'Source diversity — content cited across multiple domains',
      'Current, recently published content with timestamps',
      'Primary sources linked directly in content',
    ],
    contentWeaknesses: [
      'Content without explicit source attribution',
      'Generic claims without supporting data',
      'Content only published on a single domain',
    ],
    attentionPatterns: [
      'Source diversity check — actively avoids single-source responses',
      'Real-time freshness triggers — content from last 48h weighted higher',
      'Observed: stronger response to numerical data and statistics',
      'Citation verification — prefers content with trackable sources',
    ],
    geoImplications: [
      'Best optimized with data-backed claims and inline citations',
      'Appear on multiple authoritative domains (not just your site)',
      'Deep research mode favors Wikipedia and academic sources',
      'General queries favor current, time-stamped content',
    ],
  },
  {
    engine: 'grok',
    label: 'Grok (xAI)',
    fineTuningPhilosophy:
      'Real-time social signal integration. Less filtered, more current-events driven.',
    contentPreferences: [
      'Recent content from social signals and news sources',
      'Real-time data — last 48 hours weighted significantly higher for trending topics',
      'Conversational, direct content without excessive hedging',
    ],
    contentWeaknesses: [
      'Old content without current context or updates',
      'Overly cautious, disclaimer-heavy content',
    ],
    attentionPatterns: [
      '"Recency addiction" — 70% of citations from last 48h for trending topics',
      'Social signal detection — content trending on X/Twitter gets priority',
    ],
    geoImplications: [
      'Best optimized with real-time content and current events tie-ins',
      'Social media presence on X directly influences citation probability',
      'Less relevant for evergreen brand monitoring — focus on news-driven brands',
    ],
  },
]

export const VISIBILITY_LAYERS: VisibilityLayer[] = [
  {
    layer: 1,
    name: 'Crawlability',
    description:
      'Is the page technically accessible to web crawlers? If content cannot be crawled, it cannot be cited.',
    checkQuestions: [
      'Is the page accessible to web crawlers (robots.txt, no meta noindex)?',
      'Fast loading time (< 3 seconds)?',
      'Proper SSL certificate and HTTPS?',
    ],
  },
  {
    layer: 2,
    name: 'Parsability',
    description:
      'Can the LLM extract information cleanly from the HTML structure? Ambiguous structure = higher compute cost = may be ignored.',
    checkQuestions: [
      'Clear HTML structure with semantic markup (H1-H6 hierarchy)?',
      'Readable text extraction without excessive nesting?',
      'Semantic HTML5 tags (article, section, nav, aside)?',
    ],
  },
  {
    layer: 3,
    name: 'Relevance',
    description:
      'Does the content semantically align with the user query? Traditional SEO still matters here.',
    checkQuestions: [
      'Query-content alignment — does this page answer the likely question?',
      'Semantic similarity — does the content use related concepts, not just keywords?',
      'Intent matching — does the content format match search intent (list vs guide vs comparison)?',
    ],
  },
  {
    layer: 4,
    name: 'Efficiency (Semantic Density)',
    description:
      'How much information does the LLM get per token processed? High semantic density = preferred for synthesis.',
    checkQuestions: [
      'Front-loaded key information — is the answer in the first 100 words?',
      'Specific numbers and data over vague descriptors?',
      'One idea per paragraph with clear extraction points?',
      'Minimal filler words, adverbs, and redundant phrases?',
    ],
  },
  {
    layer: 5,
    name: 'Confidence',
    description:
      'Does the content carry enough authority signals for the LLM to trust it? Low confidence = omitted from synthesis.',
    checkQuestions: [
      'Authoritative signals — author bio, credentials, organization?',
      'Factual consistency — are claims verifiable and non-contradictory?',
      'Recent/updated content with visible timestamp?',
      'External validation — cited by other reputable sources?',
    ],
  },
  {
    layer: 6,
    name: 'Synthesis Priority (Computational ROI)',
    description:
      'Given finite compute budget, will the LLM prioritize this content over alternatives? The most competitive layer.',
    checkQuestions: [
      'Does the content add unique value not found in other sources?',
      'Does the content format match the LLM response structure (lists for ChatGPT, reasoning for Claude)?',
      'Is the content designed for the model-specific attention patterns?',
    ],
  },
]

export interface SemanticMonopoly {
  category: string
  dominantBrands: string[]
  nicheStrategy: string
}

export const SEMANTIC_MONOPOLIES: SemanticMonopoly[] = [
  {
    category: 'CRM',
    dominantBrands: ['HubSpot', 'Salesforce'],
    nicheStrategy:
      'Position as "CRM for [specific industry/use case]" — e.g., "CRM for real estate agents", "CRM for solopreneurs under $1k/year"',
  },
  {
    category: 'Spreadsheet / Accounting',
    dominantBrands: ['Excel', 'Google Sheets'],
    nicheStrategy:
      'Position as "[niche] alternative to spreadsheets" — e.g., "CRM that replaces spreadsheets for agencies"',
  },
  {
    category: 'Video Conferencing',
    dominantBrands: ['Zoom', 'Google Meet'],
    nicheStrategy:
      'Position as "[specific feature]-focused alternative" — e.g., "AI meeting notes without Zoom"',
  },
  {
    category: 'Project Management',
    dominantBrands: ['Asana', 'Trello', 'Jira'],
    nicheStrategy:
      'Target specific workflow or team size — e.g., "Project management for creative agencies under 20 people"',
  },
  {
    category: 'SEO / Marketing',
    dominantBrands: ['Semrush', 'Ahrefs', 'Moz'],
    nicheStrategy:
      'Position as AI-native alternative — e.g., "AI-powered SEO for non-technical founders"',
  },
]

export function buildModelBehaviorContext(): string {
  const blocks = MODEL_BEHAVIOR_PROFILES.map(
    (p) => `### ${p.label}
Fine-tuning philosophy: ${p.fineTuningPhilosophy}
Content preferences: ${p.contentPreferences.join('; ')}
Attention patterns: ${p.attentionPatterns.join('; ')}
Optimization guidance: ${p.geoImplications.join('; ')}`,
  )

  return [
    '## LLM Model Behavior Profiles — observed patterns',
    'Source: Kalyani Khona — "LLM Model Behavior Research" (2025), CC BY 4.0',
    'IMPORTANT: the items below describe OBSERVED behaviors reported by external research, not verified internal model architecture. Treat them as optimization guidance, NOT as established facts to repeat to users in customer-facing output.',
    '',
    ...blocks,
  ].join('\n\n')
}

export function buildVisibilityLayerContext(): string {
  const layers = VISIBILITY_LAYERS.map(
    (l) => `Layer ${l.layer} — ${l.name}: ${l.description}
  Check: ${l.checkQuestions.map((q) => `☐ ${q}`).join('\n  ')}`,
  )

  return [
    '## 6-Layer Visibility Filter Framework — research framework',
    'Source: Kalyani Khona GEO research (2025), CC BY 4.0',
    'Per this research framework, content must pass through all six layers to be cited by an LLM. Failure at any layer is hypothesised to mean invisibility regardless of optimization at other layers. Use as a structural checklist, not as a guaranteed model for any specific engine.',
    '',
    ...layers,
  ].join('\n\n')
}

export function buildInterpretabilityGapContext(): string {
  return `## The Interpretability Gap — research framing
Source: Kalyani Khona — "The Interpretability Gap in LLM Model Behavior" (2025), CC BY 4.0
Per this research: the same optimized content tends to perform differently for different users, at different times, and across different model versions. The reported drivers are:
- Temperature settings introducing controlled randomness
- Context-dependent reasoning shifting with each interaction
- Model updates deployed without announcement
- A/B testing by platforms creating response variability

Treat all recommendations below as observed behavioral patterns, not guaranteed outcomes. The recommended resilient AEO strategy is a portfolio approach — multiple content variants across platforms — rather than betting on a single optimization tactic.`
}

export function buildSemanticMonopolyContext(brandCategory?: string): string {
  if (brandCategory) {
    const match = SEMANTIC_MONOPOLIES.find(
      (m) => m.category.toLowerCase() === brandCategory.toLowerCase(),
    )
    if (match) {
      return `## Semantic Monopoly — research observation
Source: Kalyani Khona research (2025), CC BY 4.0
Your brand appears to compete in the "${match.category}" category, which the cited research observes as dominated by ${match.dominantBrands.join(' and ')} — these brands appear to have built strong semantic association during LLM training (2019-2024). Per this observation, competing head-on for generic terms like "best ${match.category.toLowerCase()}" tends to underperform.

Suggested niche strategy: ${match.nicheStrategy}`
    }
  }

  const generalAdvice = SEMANTIC_MONOPOLIES.map(
    (m) =>
      `- "${m.category}" — observed to be dominated by ${m.dominantBrands.join(', ')}. Suggested niche strategy: ${m.nicheStrategy}`,
  ).join('\n')

  return `## Semantic Monopoly — research observation
Source: Kalyani Khona research (2025), CC BY 4.0
The cited research observes that certain brands appear to have built strong semantic association during LLM training (2019-2024), creating de-facto "semantic monopolies":
${generalAdvice}

When generating recommendations, consider whether the brand competes in one of these categories and suggest niche positioning as an alternative.`
}
