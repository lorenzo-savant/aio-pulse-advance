# AIO Pulse - AI Provider Orchestration

Multi-provider AI system with automatic fallback, health monitoring, and job deduplication.

## Features

- **Automatic Fallback**: Chain providers (Perplexity → Gemini → Claude → Azure OpenAI → ChatGPT → DataForSEO)
- **Job Deduplication**: Prevent duplicate requests with activeJobs Map
- **Health Cache**: TTL-based health status caching
- **Parallel Execution**: Execute queries across multiple providers simultaneously
- **Brand Context**: Inject brand context into prompts for contextual responses

## Architecture

```
ProviderManager
├── Providers (registered by priority)
│   ├── ChatGPTProvider
│   ├── GeminiProvider
│   ├── PerplexityProvider
│   ├── ClaudeProvider
│   ├── AzureOpenAIProvider
│   └── DataForSEOProvider
├── Health Cache (60s TTL)
├── Active Jobs (deduplication)
└── Fallback Chain
```

## Key Patterns

### Provider Health Check

```typescript
const manager = getProviderManager()
const health = await manager.getProviderHealth()
// Returns: { id, name, isConfigured, isAvailable, latencyMs, lastChecked }
```

### Execute with Brand Context

```typescript
const result = await manager.executeWithBrandContext(
  { prompt: 'Analyze our SEO performance' },
  selectedBrand,
  { includeCompetitors: true, includeIndustry: true },
)
```

### Parallel Execution with Brand

```typescript
const results = await manager.executeParallelWithBrand(
  [{ prompt: 'Query 1' }, { prompt: 'Query 2' }],
  brand,
  { includeDomain: true },
)
```

## Provider Configuration

| Provider     | Environment Variables                                                           |
| ------------ | ------------------------------------------------------------------------------- |
| ChatGPT      | `OPENAI_API_KEY`                                                                |
| Gemini       | `GEMINI_API_KEY`                                                                |
| Perplexity   | `PERPLEXITY_API_KEY`                                                            |
| Claude       | `ANTHROPIC_API_KEY`                                                             |
| Azure OpenAI | `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT_NAME` |
| DataForSEO   | `DATAFORSEO_API_KEY`                                                            |

## Related Skills

- `aio-geo-aeo` - GEO/AEO optimization patterns
- `aio-ranking` - 3-tier ranking algorithm
