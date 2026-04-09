# AIO Pulse - 3-Tier Ranking Algorithm

Hierarchical ranking system for evaluating AI search results, domain authority, and answer quality.

## Overview

The ranking system uses **3 tiers** with epsilon-based tie detection:

```
Tier 1: Raw Metrics (provider-specific)
    ↓
Tier 2: Normalized Scores (0-100)
    ↓
Tier 3: Final Rankings (with epsilon ties)
```

## Tier Breakdown

### Tier 1: Raw Metrics

Provider-specific measurements:

- Token usage
- Latency (ms)
- Cost ($)
- Citation count
- Response length

### Tier 2: Normalized Scores

Standardized 0-100 scores using min-max normalization:

```typescript
normalizedScore = ((value - min) / (max - min)) * 100
```

### Tier 3: Final Rankings

Hierarchical comparison with epsilon tie detection:

```typescript
const EPSILON = 0.01
const isTie = Math.abs(scoreA - scoreB) < EPSILON
```

## Ranking Factors

### Primary Factors (40%)

| Factor             | Weight | Description              |
| ------------------ | ------ | ------------------------ |
| Token Efficiency   | 15%    | Tokens per useful output |
| Response Quality   | 15%    | Factual accuracy         |
| Citation Relevance | 10%    | Source quality           |

### Secondary Factors (35%)

| Factor          | Weight | Description         |
| --------------- | ------ | ------------------- |
| Latency         | 15%    | Response speed      |
| Cost Efficiency | 10%    | Cost per result     |
| Brand Mention   | 10%    | Brand context match |

### Tertiary Factors (25%)

| Factor       | Weight | Description               |
| ------------ | ------ | ------------------------- |
| Completeness | 10%    | All query aspects covered |
| Clarity      | 10%    | Readability score         |
| Freshness    | 5%     | Recency of information    |

## Usage

```typescript
import { rankResults, normalizeScores } from '@/lib/ranking'

const results = await providerManager.executeParallel(queries)
const ranked = rankResults(results, {
  weights: {
    quality: 0.4,
    efficiency: 0.35,
    relevance: 0.25,
  },
  epsilon: 0.01,
})
```

## Analytics Integration

Track rankings over time:

```typescript
interface RankingMetrics {
  queryId: string
  timestamp: Date
  tier1Scores: Record<string, number>
  tier2Scores: Record<string, number>
  finalRankings: Array<{ provider: string; score: number; rank: number }>
}
```

## Related Skills

- `aio-provider-orchestration` - Provider system
- `aio-geo-aeo` - GEO/AEO patterns
