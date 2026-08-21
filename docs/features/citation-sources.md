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

Also classifies each cited domain by **whose side it serves** — Missing / Strong / Unique / Shared — which turns the ranking into a plan: Missing domains are outreach targets, Strong and Unique are positions to defend.

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
  taxonomy: {
    sources: [{                  // top 100, ordered missing → strong → unique → shared
      domain,
      class: 'missing' | 'strong' | 'unique' | 'shared',
      citedWithBrand,            // responses citing it that named the brand
      citedWithCompetitors,      // responses citing it that named a declared competitor
      totalCitations,            // responses citing it at all (once per response)
    }],
    requiresDeclaredCompetitors, // true → sources is empty, the brand has no competitor list
    ownDomain: { domain, totalCitations } | null,
    belowThreshold,              // domains seen only once, held back
  },
  engineBreakdown: [{ engine, count }],
  timeline: [{ date, count }],
  filters: { engine, days }
}
```

#### Source taxonomy — the definitions, and how they differ from Semrush's
Semrush compares per-brand campaigns: they run the brand's prompts and the competitor's prompts separately, then intersect the two source lists. We measure **co-occurrence inside a single answer** instead — for each response, whether it named the brand and whether it named a declared competitor. "Cited with the competitors" therefore means *cited in answers where a rival was named*, not *cited in the rival's own campaign*. The classes carry the same operational meaning; the measurement underneath is ours, and it is the sharper of the two for a single-brand subscription.

| Class | Definition | What to do |
|---|---|---|
| **Missing** | Never cited alongside the brand, at least once alongside a competitor | Outreach targets — the engines trust this source about your market and it has nothing of yours to quote |
| **Strong** | Cited for both, more often with the brand | Positions to defend |
| **Unique** | Cited with the brand, never with a competitor | Yours alone — nobody is contesting it yet |
| **Shared** | Cited for both, at least as often with the competitors | Contested ground |

Three deliberate refusals:
- **No declared competitor list → no classification at all.** Every class is defined against competitor co-occurrence, so without a list every domain would file as "unique": confident, and meaningless. The API returns `requiresDeclaredCompetitors: true` and the UI asks for the list.
- **The brand's own domain is reported apart, never classified.** Seeing your own site under "shared" reads as a finding when it is an artefact of the arithmetic.
- **Domains seen once are held back** (`minCitations`, default 2) and counted in `belowThreshold`, so a short list is legible as a threshold effect rather than as an empty market.

Competitor names are matched through `competitor-identity.ts` (word-boundary, legal-suffix folded), so a declared "Blocket AB" matches an observed "Blocket" — and never matches a longer word that merely contains it.

### Data signals
Reads `monitoring_results.cited_urls[]` for the brand × engine × time window. Each URL is hostname-normalized (strip protocol/www/path) and aggregated. Vertex AI grounding redirects are resolved to their final destination via `resolveVertexRedirects` so the dashboard sees real source domains, not Google routing URLs.

### Links
- API: [`/api/citation-sources/route.ts`](../../src/app/api/citation-sources/route.ts)
- Taxonomy service: [`source-taxonomy.ts`](../../src/lib/services/source-taxonomy.ts)
- Vertex resolver: [`ai-router.ts:resolveVertexRedirects`](../../src/lib/services/ai-router.ts)

---

## 🇮🇹 Italiano

### Cosa fa
Aggrega ogni URL che i 4 motori AI hanno citato rispondendo ai prompt monitorati di questo brand, raggruppa per dominio, e mostra: top domini citati, share own-vs-external, breakdown citazioni per engine, timeline citazioni a 30 giorni. Distingue il dominio del brand dalle citazioni esterne.

Classifica inoltre ogni dominio citato per **da che parte sta** — Missing / Strong / Unique / Shared. Missing = i motori lo usano quando parlano dei rivali e mai quando parlano di te: sono i target di outreach. Strong e Unique sono posizioni da difendere.

**Definizioni adattate.** Semrush confronta campagne per-brand (prompt del brand e prompt del competitor eseguiti separatamente, poi intersezione delle fonti). Noi misuriamo la **co-occorrenza dentro la stessa risposta**: "citato con i competitor" significa *citato in risposte dove un rivale è stato nominato*, non *citato nella campagna del rivale*. Tre rifiuti deliberati: senza lista competitor dichiarata non si classifica nulla (`requiresDeclaredCompetitors`), il dominio proprio è riportato a parte e mai classificato, i domini visti una volta sola restano fuori finché non si ripetono.

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

Klassificerar dessutom varje citerad domän efter **vems sida den tjänar** — Missing / Strong / Unique / Shared. Missing = motorerna använder den när de talar om konkurrenterna, aldrig om er: det är målen för outreach. Strong och Unique är positioner att försvara.

**Anpassade definitioner.** Semrush jämför kampanjer per varumärke; vi mäter **samförekomst inom ett och samma svar**. Utan deklarerad konkurrentlista klassificeras ingenting (`requiresDeclaredCompetitors`), den egna domänen redovisas separat och klassificeras aldrig, och domäner som setts en enda gång hålls tillbaka tills de återkommer.

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
- **The taxonomy inherits the mention extractor's blind spots** — a response that discusses a competitor without naming it counts as neither side, so its sources stay out of the classification rather than being guessed into one.
- **Hostname normalization is "registrable host"** — `news.bbc.co.uk` is treated as a single domain, NOT as `bbc.co.uk`. If you want eTLD+1 grouping that's a separate change.

## Cost
- Pure DB read + occasional Vertex redirect resolution (one HTTP per unique redirect). No SERP API calls.

## Data scope / valuta
- Tutti i timestamp UTC.
- `share` e `ownedShare` sono percentuali con 1 decimale (es. `47.9`).
