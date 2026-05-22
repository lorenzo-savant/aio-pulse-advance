// PATH: src/lib/geo/geo-knowledge.ts
//
// Structured research dataset from the GEO literature (awesome-generative-engine-optimization,
// Princeton/Georgia Tech paper, Conductor 2026 benchmarks, Kevin Indig 2026 analysis, etc.).
//
// This is the single source of truth for "what does the research say about how
// AI engines cite content?" Used by the Strategy Advisor to calibrate recommendations
// and by the platform to tune extraction strategies per engine.

export interface EngineCitationProfile {
  engine: string
  /** Share of AI referral traffic this engine drives. */
  trafficShare: number
  /** Top content domains / types this engine favors (domain -> percentage). */
  topCitationSources: Array<{ source: string; share: number }>
  /** Known ranking / reranking structure. */
  rankingArchitecture: string
  /** Content freshness bias (how much recency matters). */
  freshnessBias: 'high' | 'medium' | 'low'
  /** Whether llms.txt is known to be consumed. */
  llmsTxtSupport: 'confirmed' | 'unconfirmed' | 'none'
  /** Optimisation levers specific to this engine. */
  optimizationLevers: string[]
}

export interface GeoTactic {
  id: string
  name: string
  description: string
  impact: string
  source: string
  applicableEngines: string[]
}

export interface GeoMarketFact {
  fact: string
  source: string
  date?: string
}

export interface GeoKnowledge {
  engineProfiles: EngineCitationProfile[]
  tactics: GeoTactic[]
  marketFacts: GeoMarketFact[]
  llmsTxt: {
    summary: string
    adoptionRate: string
    notableImplementations: string[]
  }
  contentFreshness: {
    summary: string
    citedWithinMonths: number
    multiplierVsOld: number
  }
}

export const GEO_KNOWLEDGE: GeoKnowledge = {
  engineProfiles: [
    {
      engine: 'ChatGPT / SearchGPT',
      trafficShare: 87.4,
      topCitationSources: [
        { source: 'Wikipedia', share: 47.9 },
        { source: 'News & media outlets', share: 15.2 },
        { source: 'Reddit', share: 8.1 },
        { source: 'Academic / .edu', share: 6.8 },
        { source: 'Government / .gov', share: 4.3 },
      ],
      rankingArchitecture:
        'GPT-5 mini-powered search with citation attribution. Retrieval favors authoritative, structured, recently-updated content. 24% of responses generated without fetching online content (relying on training data).',
      freshnessBias: 'high',
      llmsTxtSupport: 'unconfirmed',
      optimizationLevers: [
        'Cite authoritative primary sources prominently',
        'Keep content fresh — <3 months old is 3× more likely to be cited',
        'Wikipedia presence is critical (47.9% of top citations)',
        'Structured data helps retrieval accuracy',
        'Conversational query formats outperform keyword lists',
      ],
    },
    {
      engine: 'Gemini',
      trafficShare: 4.1,
      topCitationSources: [
        { source: 'Reddit', share: 22.3 },
        { source: 'Wikipedia', share: 18.7 },
        { source: 'News outlets', share: 14.5 },
        { source: 'YouTube / transcripts', share: 9.2 },
      ],
      rankingArchitecture:
        'Multimodal retrieval (text + image + video). Google Knowledge Graph integration. Heavier reliance on structured data and entity recognition than other engines.',
      freshnessBias: 'medium',
      llmsTxtSupport: 'unconfirmed',
      optimizationLevers: [
        'Leverage Google Knowledge Graph / entity recognition',
        'Optimize for multimodal (text + images + video)',
        'YouTube content with transcripts performs well',
        'Reddit discussions influence citations significantly',
        'Schema.org structured data improves entity extraction',
      ],
    },
    {
      engine: 'Perplexity',
      trafficShare: 5.8,
      topCitationSources: [
        { source: 'Reddit', share: 46.7 },
        { source: 'News outlets', share: 18.3 },
        { source: 'Wikipedia', share: 12.1 },
        { source: 'Technical docs / GitHub', share: 7.9 },
      ],
      rankingArchitecture:
        '3-layer reranking system: (1) initial retrieval, (2) relevance scoring, (3) source authority rerank. Heavily weights community-voted content (Reddit, Stack Overflow). Citation sidebar with inline source links.',
      freshnessBias: 'high',
      llmsTxtSupport: 'unconfirmed',
      optimizationLevers: [
        'Reddit presence is critical (46.7% of citations)',
        'Community engagement / upvotes boost authority signal',
        'Technical documentation ranks well for developer queries',
        'Recent content (<6 months) strongly preferred',
        `Inline citations require clear attribution in source content`,
      ],
    },
    {
      engine: 'Claude',
      trafficShare: 2.7,
      topCitationSources: [
        { source: 'Technical docs', share: 28.4 },
        { source: 'Wikipedia', share: 20.1 },
        { source: 'Academic papers', share: 15.6 },
        { source: 'News outlets', share: 12.3 },
      ],
      rankingArchitecture:
        'Constitutional AI-based answer generation. Longer, more analytical responses. Heavier weight on depth and authority than recency. PDF and document parsing capabilities.',
      freshnessBias: 'low',
      llmsTxtSupport: 'confirmed',
      optimizationLevers: [
        'Deep, authoritative long-form content performs best',
        'Academic and technical sourcing is valued',
        'PDF availability helps (Claude parses uploaded documents)',
        'llms.txt is supported — implement it',
        'Factual accuracy and source quality > recency',
      ],
    },
    {
      engine: 'Google AI Overviews',
      trafficShare: 0,
      topCitationSources: [
        { source: 'Google-indexed web pages', share: 65 },
        { source: 'Google Knowledge Graph', share: 20 },
        { source: 'Shopping / product feeds', share: 15 },
      ],
      rankingArchitecture:
        "AI-generated answer box within traditional SERP. Uses Google's ranking signals + generative AI. Triggered for ~13-16% of queries (2025). Navigational AI Overviews grew from <1% to >10% in 2025.",
      freshnessBias: 'medium',
      llmsTxtSupport: 'none',
      optimizationLevers: [
        'Traditional SEO signals still matter (backlinks, authority)',
        'Google Business Profile optimization for local queries',
        'Structured data (Product, FAQ, HowTo schemas)',
        'E-E-A-T signals are critical',
        'Ads appear alongside ~40% of AI Overviews',
      ],
    },
  ],

  tactics: [
    {
      id: 'cite-sources',
      name: 'Cite authoritative primary sources',
      description:
        'Content that explicitly cites authoritative primary sources (peer-reviewed papers, government data, industry reports) is 40% more likely to be cited by AI engines. The Princeton/GEO paper identified this as the single most effective tactic.',
      impact: '40% visibility improvement',
      source: 'Princeton / Georgia Tech GEO paper (2024)',
      applicableEngines: ['ChatGPT', 'Claude', 'Gemini', 'Perplexity'],
    },
    {
      id: 'use-statistics',
      name: 'Include specific statistics and data',
      description:
        'Pages with verifiable statistics and numerical data are cited more frequently. AI engines prefer content that makes falsifiable claims with supporting numbers.',
      impact: '35% visibility improvement',
      source: 'Princeton / Georgia Tech GEO paper (2024)',
      applicableEngines: ['ChatGPT', 'Claude', 'Gemini', 'Perplexity'],
    },
    {
      id: 'use-quotations',
      name: 'Include quotable expert statements',
      description:
        'Direct quotations from recognized experts or official sources increase citation likelihood. AI engines use quotes as reliable, attributable content.',
      impact: '28% visibility improvement',
      source: 'Princeton / Georgia Tech GEO paper (2024)',
      applicableEngines: ['ChatGPT', 'Claude', 'Gemini', 'Perplexity'],
    },
    {
      id: 'structured-formatting',
      name: 'Format key facts as tables and lists',
      description:
        'Content that presents comparisons and specs in tables and scannable lists is cited markedly more often — table-formatted answers see roughly a 2.5× citation rate vs the same facts in prose. Answer engines extract structured, list-detectable content more reliably.',
      impact: '~2.5× citation rate',
      source: 'Conductor 2026 AEO/GEO Benchmarks Report',
      applicableEngines: ['ChatGPT', 'Perplexity', 'Gemini', 'Google AI Overviews'],
    },
    {
      id: 'content-freshness',
      name: 'Maintain content freshness (<3 months)',
      description:
        'Content updated within the last 3 months is 3× more likely to be cited by ChatGPT than older content. Regular updates signal relevance to retrieval systems.',
      impact: '3× citation probability',
      source: 'Kevin Indig — State of AI Search Optimization 2026',
      applicableEngines: ['ChatGPT', 'Perplexity', 'Google AI Overviews'],
    },
    {
      id: 'reddit-presence',
      name: 'Build Reddit presence for Perplexity',
      description:
        'Reddit accounts for 46.7% of Perplexity citations and 22.3% of Gemini citations. Active subreddit participation and community upvotes create an authority signal these engines weight heavily.',
      impact: 'Critical for Perplexity coverage',
      source: 'Conductor 2026 AEO/GEO Benchmarks Report',
      applicableEngines: ['Perplexity', 'Gemini'],
    },
    {
      id: 'wikipedia-optimization',
      name: 'Optimize Wikipedia presence',
      description:
        'Wikipedia dominates ChatGPT citations at 47.9%. Creating and maintaining accurate, well-cited Wikipedia entries is the highest-leverage GEO activity for ChatGPT visibility.',
      impact: 'Primary ChatGPT citation source',
      source: 'Conductor 2026 AEO/GEO Benchmarks Report',
      applicableEngines: ['ChatGPT'],
    },
    {
      id: 'llms-txt',
      name: 'Implement llms.txt protocol',
      description:
        'The llms.txt file (analogous to robots.txt for LLMs) lets brands explicitly guide AI crawlers to their best content. ~0.3% of top 1,000 websites have implemented it as of June 2025. Claude has confirmed support.',
      impact: 'Early-mover advantage',
      source: 'llms.txt specification / LLMS.txt Adoption Research 2025',
      applicableEngines: ['Claude'],
    },
    {
      id: 'structured-data',
      name: 'Schema.org structured data for AI parsing',
      description:
        'AI engines parse structured data (JSON-LD, Schema.org) more reliably than unstructured HTML. Product, FAQ, HowTo, Article, and Organization schemas improve entity recognition and citation accuracy.',
      impact: 'Improved retrieval accuracy',
      source: 'AIO GEO research compilation',
      applicableEngines: ['ChatGPT', 'Gemini', 'Google AI Overviews'],
    },
    {
      id: 'eeat-signals',
      name: 'Strengthen E-E-A-T signals',
      description:
        'Experience, Expertise, Authoritativeness, Trustworthiness signals influence AI recommendations. Clear author credentials, publication dates, citations to primary sources, and corroboration across multiple trusted sites.',
      impact: 'Foundation for all GEO',
      source: 'Google Search Central / AIO research',
      applicableEngines: ['ChatGPT', 'Gemini', 'Claude', 'Perplexity', 'Google AI Overviews'],
    },
    {
      id: 'multi-platform-citation',
      name: 'Cross-platform citation building',
      description:
        'Content cited across multiple platforms (Wikipedia + Reddit + news + technical docs) creates compounding authority. AI engines cross-reference sources — a brand cited in Wikipedia AND discussed on Reddit is more likely to appear across all engines.',
      impact: 'Compounding cross-engine visibility',
      source: 'AIO Pulse research — citation pattern analysis',
      applicableEngines: ['ChatGPT', 'Gemini', 'Perplexity', 'Claude'],
    },
  ],

  marketFacts: [
    {
      fact: "AI Overviews appeared for ~25% of tracked queries in July 2025, falling to <16% by November 2025 after Google's pullback.",
      source: 'AI Overviews tracking studies 2025',
      date: '2025',
    },
    {
      fact: 'ChatGPT commands ~4.33% of search traffic with 300% growth in unique domains receiving AI traffic in 2024.',
      source: 'Market analysis 2025',
      date: '2025',
    },
    {
      fact: 'Traditional search engine volume predicted to drop 25% by 2026 and 50% by 2028.',
      source: 'Industry projections',
      date: '2025',
    },
    {
      fact: '63% of websites receive AI traffic from at least one AI engine.',
      source: '3,000-site study 2025',
      date: '2025',
    },
    {
      fact: 'AI traffic surged 527% across 400+ tracked sites in 2025.',
      source: 'Citation pattern analysis 2025',
      date: '2025',
    },
    {
      fact: 'ChatGPT referral conversions are 2× higher than traditional search sources.',
      source: 'Conductor 2026 AEO/GEO Benchmarks Report',
      date: '2026',
    },
    {
      fact: '24% of ChatGPT responses are generated without fetching online content (relying on training data alone).',
      source: 'Kevin Indig — State of AI Search Optimization 2026',
      date: '2026',
    },
    {
      fact: 'Content under 3 months old is 3× more likely to be cited by ChatGPT than older content.',
      source: 'Kevin Indig — State of AI Search Optimization 2026',
      date: '2026',
    },
    {
      fact: '60% of AI-generated citations fail (link rot, incorrect attribution, hallucinated sources).',
      source: 'AI Citation Failure Study 2025',
      date: '2025',
    },
    {
      fact: 'AI Overviews peaked at ~25% of queries in July 2025, pulled back to <16% by November 2025.',
      source: 'AI Overviews tracking',
      date: '2025',
    },
    {
      fact: "OpenAI announced advertising in ChatGPT (January 2026). Ads are separate from answers and don't influence responses.",
      source: 'OpenAI advertising announcement',
      date: '2026',
    },
  ],

  llmsTxt: {
    summary:
      'The llms.txt protocol (analogous to robots.txt for LLMs) lets brands explicitly guide AI crawlers to their best content. Claude has confirmed support. Google added then removed llms.txt from Search Central docs (December 2025). 784+ websites have implemented it (~0.3% of top 1,000 as of June 2025).',
    adoptionRate: '~0.3% of top 1,000 websites (June 2025)',
    notableImplementations: [
      'Stripe',
      'Zapier',
      'Cloudflare',
      'Anthropic / Claude',
      'Vercel',
      'Supabase',
      'ElevenLabs',
    ],
  },

  contentFreshness: {
    summary:
      'Content under 3 months old is 3× more likely to be cited by ChatGPT. Regular content updates signal relevance to AI retrieval systems. Perplexity also shows strong freshness bias. Claude weights authority over recency.',
    citedWithinMonths: 3,
    multiplierVsOld: 3,
  },
}

export function getEngineProfile(engine: string): EngineCitationProfile | undefined {
  return GEO_KNOWLEDGE.engineProfiles.find((p) =>
    p.engine.toLowerCase().includes(engine.toLowerCase()),
  )
}

export function getTacticsForEngine(engine: string): GeoTactic[] {
  return GEO_KNOWLEDGE.tactics.filter((t) =>
    t.applicableEngines.some((e) => e.toLowerCase().includes(engine.toLowerCase())),
  )
}

export function formatGeoKnowledgeForPrompt(): string {
  const sections: string[] = []

  sections.push('=== ENGINE CITATION PROFILES ===')
  for (const profile of GEO_KNOWLEDGE.engineProfiles) {
    sections.push(`${profile.engine} (${profile.trafficShare}% traffic share):`)
    sections.push(
      `  Top sources: ${profile.topCitationSources.map((s) => `${s.source} (${s.share}%)`).join(', ')}`,
    )
    sections.push(`  Freshness bias: ${profile.freshnessBias}`)
    sections.push(`  Key levers: ${profile.optimizationLevers.join('; ')}`)
    sections.push('')
  }

  sections.push('=== RESEARCH-BACKED GEO TACTICS (ranked by impact) ===')
  for (const tactic of GEO_KNOWLEDGE.tactics.slice(0, 6)) {
    sections.push(`- ${tactic.name} (${tactic.impact}): ${tactic.description}`)
  }
  sections.push('')

  sections.push('=== MARKET CONTEXT ===')
  for (const fact of GEO_KNOWLEDGE.marketFacts.slice(0, 6)) {
    sections.push(`- ${fact.fact}`)
  }
  sections.push('')

  sections.push('=== llms.txt ===')
  sections.push(`${GEO_KNOWLEDGE.llmsTxt.summary}`)
  sections.push(`Adoption: ${GEO_KNOWLEDGE.llmsTxt.adoptionRate}`)
  sections.push(
    `Notable implementations: ${GEO_KNOWLEDGE.llmsTxt.notableImplementations.join(', ')}`,
  )

  return sections.join('\n')
}
