# AIO Pulse - GEO & AEO Optimization

Generative Engine Optimization (GEO) and Answer Engine Optimization (AEO) patterns for AI search visibility.

## Concepts

### GEO (Generative Engine Optimization)

Optimizing content to appear in AI-generated responses from LLMs like ChatGPT, Gemini, Claude.

### AEO (Answer Engine Optimization)

Optimizing content to be selected as direct answers in AI search engines like Perplexity, Google AI Overview.

### Traditional SEO vs GEO/AEO

| Aspect  | Traditional SEO     | GEO/AEO                           |
| ------- | ------------------- | --------------------------------- |
| Target  | Google/Bing         | ChatGPT, Perplexity, AI Overviews |
| Goal    | Ranking #1          | Being cited as answer             |
| Content | Keywords, backlinks | Factual, structured, quotable     |
| Metrics | CTR, rankings       | Citations, featured answers       |

## Key Strategies

### 1. Structured Data

```typescript
// Use JSON-LD for structured answers
const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is AIO Pulse?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'AIO Pulse is an AI search optimization tool...',
      },
    },
  ],
}
```

### 2. Query Category Targeting

```typescript
type QueryCategory =
  | 'awareness' // "What is X?"
  | 'interest' // "How does X work?"
  | 'consideration' // "X vs Y comparison"
  | 'purchase' // "Best X under $100"
  | 'comparison' // "X vs Y"
  | 'alternative' // "Alternatives to X"
```

### 3. Citation-Ready Content

- Use numbered lists: "3 ways to optimize..."
- Include statistics: "According to research, X increases by Y%"
- Quote-worthy phrases: "The key insight is..."
- Source citations: "As reported by [source]"

### 4. Answer Engine Triggers

- FAQ sections
- How-to guides
- Comparison tables
- Definition blocks
- Step-by-step tutorials

## Domain Analysis Pipeline

```typescript
interface DomainIntel {
  domain: string
  aiMentions: number // Times mentioned in AI responses
  citationRate: number // % of queries citing domain
  sentiment: 'positive' | 'neutral' | 'negative'
  techStack: string[] // Detected technologies
  aiProviders: string[] // Where domain appears
}
```

## DataForSEO Integration

Monitor Google AI Overview appearances:

```typescript
const provider = new DataForSEOProvider()
const overview = await provider.getAIOverview(keyword)
```

## Related Skills

- `aio-provider-orchestration` - Multi-provider AI system
- `aio-ranking` - 3-tier ranking algorithm
