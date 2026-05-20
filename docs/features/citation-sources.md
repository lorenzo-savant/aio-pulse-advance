# Citation Sources

| Field | Value |
|---|---|
| **Route** | `/dashboard/citation-sources` |
| **API** | `GET /api/citation-sources?brand_id=...&engine=...&days=...` |
| **Sidebar step** | 3 · Insights |

---

## 🇬🇧 English

### What it does
Aggregates every URL the 4 AI engines cited when answering this brand's monitored prompts, groups them by domain, and shows: top cited domains, owned-vs-external share, citations-per-engine breakdown, and a 30-day citation timeline. Distinguishes the brand's own domain from external citations.

### Input
- `brand_id` (UUID, required)
- `engine` (optional) — `chatgpt|gemini|perplexity|claude|all` (default `all`)
- `days` (optional) — 1-365 (default 30)

### Output
```ts
{
  summary: {
    totalResponses, responsesWithSources, sourcedRate (%),
    totalCitations, uniqueDomains,
    ownedCitations, externalCitations, ownedShare (%),
    ownedDomain: string | null,
  },
  domains: [{                    // top 50
    domain, count, share (%),
    owned: boolean,
    engines: string[],
    sampleUrls: string[],        // up to 3
    lastSeen: ISO timestamp
  }],
  engineBreakdown: [{ engine, count }],
  timeline: [{ date, count }],
  filters: { engine, days }
}
```

### Data signals
Reads `monitoring_results.cited_urls[]` for the brand × engine × time window. Each URL is hostname-normalized (strip protocol/www/path) and aggregated. Vertex AI grounding redirects are resolved to their final destination via `resolveVertexRedirects` so the dashboard sees real source domains, not Google routing URLs.

### Links
- API: [`/api/citation-sources/route.ts`](../../src/app/api/citation-sources/route.ts)
- Vertex resolver: [`ai-router.ts:resolveVertexRedirects`](../../src/lib/services/ai-router.ts)

---

## 🇮🇹 Italiano

### Cosa fa
Aggrega ogni URL che i 4 motori AI hanno citato rispondendo ai prompt monitorati di questo brand, raggruppa per dominio, e mostra: top domini citati, share own-vs-external, breakdown citazioni per engine, timeline citazioni a 30 giorni. Distingue il dominio del brand dalle citazioni esterne.

### Input
- `brand_id` (UUID, obbligatorio)
- `engine` (opzionale) — `chatgpt|gemini|perplexity|claude|all` (default `all`)
- `days` (opzionale) — 1-365 (default 30)

### Output
Stessa shape EN.

### Dati
Legge `monitoring_results.cited_urls[]` per brand × engine × finestra temporale. Ogni URL viene normalizzato a hostname (strip protocol/www/path) e aggregato. I redirect Vertex AI grounding sono risolti alla destinazione finale via `resolveVertexRedirects` così il dashboard vede domini fonte reali, non URL di routing Google.

---

## 🇸🇪 Svenska

### Vad det gör
Aggregerar varje URL som de 4 AI-motorerna citerade när de svarade på detta varumärkes övervakade prompts, grupperar efter domän, och visar: mest citerade domäner, ägd-vs-extern andel, citationer per motor-uppdelning, och en 30-dagars citationstidslinje. Skiljer varumärkets egen domän från externa citationer.

### Indata
- `brand_id` (UUID, obligatorisk)
- `engine` (valfritt) — `chatgpt|gemini|perplexity|claude|all` (standard `all`)
- `days` (valfritt) — 1-365 (standard 30)

### Utdata
Samma form som EN.

### Datasignaler
Läser `monitoring_results.cited_urls[]` för varumärke × motor × tidsfönster. Vertex AI grounding-omdirigeringar löses till slutdestinationen via `resolveVertexRedirects`.

---

## Limits & known issues
- **5000-row hard cap per query** — for very heavy brands the aggregate can miss long-tail citations. Bump the limit if it matters.
- **Vertex redirect resolution costs latency** — first time a redirect is seen, a HEAD/GET is fired against `vertexaisearch.cloud.google.com`. Cached in-memory afterward.
- **Hostname normalization is "registrable host"** — `news.bbc.co.uk` is treated as a single domain, NOT as `bbc.co.uk`. If you want eTLD+1 grouping that's a separate change.

## Cost
- Pure DB read + occasional Vertex redirect resolution (one HTTP per unique redirect). No SERP API calls.

## Data scope / valuta
- Tutti i timestamp UTC.
- `share` e `ownedShare` sono percentuali con 1 decimale (es. `47.9`).
