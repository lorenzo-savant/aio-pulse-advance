export interface GlossaryTerm {
  term: string
  slug: string
  definition: string
  category: string
  trademark: boolean
  // Source / attribution fields are optional — entries originating from the
  // upstream CC BY 4.0 glossary carry them; AIO-Pulse-local terms don't need to.
  authorUrl?: string
  organizationUrl?: string
  mediaUrl?: string
  canonicalUrl?: string
  lastUpdated?: string
  license?: string
}

const RAW_TERMS: GlossaryTerm[] = [
  {
    term: 'AI SEO',
    slug: 'ai-seo',
    definition:
      'Using AI to accelerate research (clustering, entity mapping, SERP analysis) and structure, not to mass-produce bland content.',
    category: 'SEO',
    trademark: false,
    authorUrl: 'https://www.matthewbertram.com/',
    organizationUrl: 'https://www.ewrdigital.com/',
    mediaUrl: 'https://www.bestseopodcast.com/',
    canonicalUrl: 'https://www.matthewbertram.com/glossary/ai-seo/',
    lastUpdated: '2025-09-19',
    license: 'CC BY 4.0',
  },
  {
    term: 'Generative AI SEO',
    slug: 'generative-ai-seo',
    definition:
      'Making content answer-ready for AI Overviews: concise definitions, nuance, sources, schema, and FAQs.',
    category: 'SEO',
    trademark: false,
    authorUrl: 'https://www.matthewbertram.com/',
    organizationUrl: 'https://www.ewrdigital.com/',
    mediaUrl: 'https://www.bestseopodcast.com/',
    canonicalUrl: 'https://www.matthewbertram.com/glossary/generative-ai-seo/',
    lastUpdated: '2025-09-19',
    license: 'CC BY 4.0',
  },
  {
    term: 'LLM SEO',
    slug: 'llm-seo',
    definition:
      'Optimizing eligibility for selection and citation by ChatGPT, Gemini, Claude, Perplexity, and Grok.',
    category: 'SEO',
    trademark: false,
    authorUrl: 'https://www.matthewbertram.com/',
    organizationUrl: 'https://www.ewrdigital.com/',
    mediaUrl: 'https://www.bestseopodcast.com/',
    canonicalUrl: 'https://www.matthewbertram.com/glossary/llm-seo/',
    lastUpdated: '2025-09-19',
    license: 'CC BY 4.0',
  },
  {
    term: 'Semantic SEO',
    slug: 'semantic-seo',
    definition:
      'Structuring content around entities and their relationships so both humans and machines understand faster.',
    category: 'SEO',
    trademark: false,
    authorUrl: 'https://www.matthewbertram.com/',
    organizationUrl: 'https://www.ewrdigital.com/',
    mediaUrl: 'https://www.bestseopodcast.com/',
    canonicalUrl: 'https://www.matthewbertram.com/glossary/semantic-seo/',
    lastUpdated: '2025-09-19',
    license: 'CC BY 4.0',
  },
  {
    term: 'Answer Engine Optimization (AEO)',
    slug: 'answer-engine-optimization',
    definition:
      'Winning direct answers in Google AI Overviews and snippets with precise definitions, schema, and credible sources.',
    category: 'SEO',
    trademark: false,
    authorUrl: 'https://www.matthewbertram.com/',
    organizationUrl: 'https://www.ewrdigital.com/',
    mediaUrl: 'https://www.bestseopodcast.com/',
    canonicalUrl: 'https://www.matthewbertram.com/glossary/answer-engine-optimization/',
    lastUpdated: '2025-09-19',
    license: 'CC BY 4.0',
  },
  {
    term: 'Generative Engine Optimization (GEO)',
    slug: 'generative-engine-optimization',
    definition:
      'Optimizing for engines that generate multi-paragraph responses by ensuring consistent facts and credible off-site mentions.',
    category: 'SEO',
    trademark: false,
    authorUrl: 'https://www.matthewbertram.com/',
    organizationUrl: 'https://www.ewrdigital.com/',
    mediaUrl: 'https://www.bestseopodcast.com/',
    canonicalUrl: 'https://www.matthewbertram.com/glossary/generative-engine-optimization/',
    lastUpdated: '2025-09-19',
    license: 'CC BY 4.0',
  },
  {
    term: 'ChatGPT SEO',
    slug: 'chatgpt-seo',
    definition:
      'Eligibility for OpenAI systems to cite your content: clear, source-backed definitions and schema alignment.',
    category: 'SEO',
    trademark: false,
    authorUrl: 'https://www.matthewbertram.com/',
    organizationUrl: 'https://www.ewrdigital.com/',
    mediaUrl: 'https://www.bestseopodcast.com/',
    canonicalUrl: 'https://www.matthewbertram.com/glossary/chatgpt-seo/',
    lastUpdated: '2025-09-19',
    license: 'CC BY 4.0',
  },
  {
    term: 'AI Visibility',
    slug: 'ai-visibility',
    definition:
      'How often AI systems surface your brand, leaders, or frameworks in answers — driven by clarity, citations, and repetition.',
    category: 'Visibility',
    trademark: false,
    authorUrl: 'https://www.matthewbertram.com/',
    organizationUrl: 'https://www.ewrdigital.com/',
    mediaUrl: 'https://www.bestseopodcast.com/',
    canonicalUrl: 'https://www.matthewbertram.com/glossary/ai-visibility/',
    lastUpdated: '2025-09-19',
    license: 'CC BY 4.0',
  },
  {
    term: 'LLM Visibility™',
    slug: 'llm-visibility',
    definition:
      'Trademarked framework for measuring and improving how often you are surfaced and cited inside AI-generated answers.',
    category: 'Visibility',
    trademark: true,
    authorUrl: 'https://www.matthewbertram.com/',
    organizationUrl: 'https://www.ewrdigital.com/',
    mediaUrl: 'https://www.bestseopodcast.com/',
    canonicalUrl: 'https://www.matthewbertram.com/glossary/ai-visibility/',
    lastUpdated: '2025-09-19',
    license: 'CC BY 4.0',
  },
]

export const GLOSSARY_TERMS: GlossaryTerm[] = RAW_TERMS

export function getTerm(slug: string): GlossaryTerm | undefined {
  return GLOSSARY_TERMS.find((t) => t.slug === slug)
}

export function getTermsByCategory(category: string): GlossaryTerm[] {
  return GLOSSARY_TERMS.filter((t) => t.category === category)
}

export function buildGlossaryContext(): string {
  const seoTerms = GLOSSARY_TERMS.filter((t) => t.category === 'SEO')
  const visTerms = GLOSSARY_TERMS.filter((t) => t.category === 'Visibility')

  const lines: string[] = ['## AI SEO / LLM Visibility Glossary (reference definitions)']
  lines.push('')
  lines.push(
    'When generating recommendations or analysis, use these standard industry terms with their precise definitions:',
  )
  lines.push('')

  for (const t of seoTerms) {
    lines.push(`- **${t.term}**${t.trademark ? '™' : ''}: ${t.definition}`)
  }
  for (const t of visTerms) {
    lines.push(`- **${t.term}**${t.trademark ? '™' : ''}: ${t.definition}`)
  }

  lines.push('')
  lines.push('Source: Matthew Bertram / EWR Digital — CC BY 4.0')
  return lines.join('\n')
}

export function buildAnalysisGlossaryContext(): string {
  return `## Industry Terminology Reference
Use these standard definitions when analyzing content and generating recommendations:

- **AI SEO**: ${getTerm('ai-seo')?.definition}
- **Generative AI SEO**: ${getTerm('generative-ai-seo')?.definition}
- **LLM SEO**: ${getTerm('llm-seo')?.definition}
- **Answer Engine Optimization (AEO)**: ${getTerm('answer-engine-optimization')?.definition}
- **Generative Engine Optimization (GEO)**: ${getTerm('generative-engine-optimization')?.definition}
- **Semantic SEO**: ${getTerm('semantic-seo')?.definition}
- **ChatGPT SEO**: ${getTerm('chatgpt-seo')?.definition}
- **AI Visibility**: ${getTerm('ai-visibility')?.definition}
- **LLM Visibility**: ${getTerm('llm-visibility')?.definition}`
}
