# AEO Snippets

| Field | Value |
|---|---|
| **Route** | `/dashboard/aeo-snippets` |
| **API** | `GET /api/aeo-snippets`, `POST /api/aeo-snippets` |
| **Service** | [`src/lib/services/aeo-snippets.ts`](../../src/lib/services/aeo-snippets.ts) |
| **Sidebar step** | 3 · Insights |

---

## 🇬🇧 English

### What it does
Pulls **Google "People Also Ask"** questions for a seed keyword via DataForSEO, generates a 40-60 word answer per question with an LLM, packages each Q&A as **FAQPage JSON-LD** ready to paste into the brand's site, and (optionally) checks whether the brand's own domain already ranks for each question on Brave (gap detection).

### Input — POST body
```ts
{
  brand_id: UUID,
  keyword: string (2-200 chars),
  language?: 'en' | 'it' | 'sv',  // defaults to brand.language
  max_questions?: 1-10,           // default 10
  detect_gaps?: boolean           // default true
}
```

### Output
```ts
{
  runId: UUID,
  items: [{
    question: string,
    answer: string,            // 40-60 words, voice-assistant-ready
    paaSnippet: string | null, // PAA's own snippet (for reference)
    paaSourceUrl: string | null,
    gapStatus: 'covered'|'gap'|'unknown',
    coveredUrl: string | null, // brand URL that ranks, if any
    position: number | null
  }],
  schemaJsonLd: object,        // ready FAQPage JSON-LD
  costCredits: number,
  gapCount: number,
  errors: string[]
}
```

### Pipeline
1. **PAA fetch** — `dataforseo-paa.ts:fetchPAAQuestions` via DataForSEO `/serp/google/organic/live/advanced` with PAA enabled. Wrapped by `withSerpCache` (24h TTL) + `withDataforseoQuota` ($20/mo cap).
2. **Answer generation** — per question, `analyzeResponseForBrand` (Gemini-first chain) generates the 40-60 word answer. Costs logged in `ai_cost_logs`.
3. **Gap detection** (optional) — `brave-search.ts:checkDomainRanksForQuestion` does a `site:brand.domain question` search on Brave. Hits = covered, no hits = gap.
4. **Persistence** — rows upserted into `aeo_snippets` keyed by `(brand_id, keyword, question)`. Run row updated in `aeo_runs`.

### Links
- DataForSEO docs (PAA): https://docs.dataforseo.com/v3/serp/google/organic/live/
- FAQPage schema: https://schema.org/FAQPage
- Spec llms.txt + structured data for AI engines: see [docs/features/strategy-advisor.md](./strategy-advisor.md) GEO RESEARCH REFERENCE section

---

## 🇮🇹 Italiano

### Cosa fa
Recupera le domande **Google "People Also Ask"** per una keyword seed via DataForSEO, genera una risposta da 40-60 parole per ogni domanda con un LLM, impacchetta ogni Q&A come **JSON-LD FAQPage** pronto da incollare sul sito del brand, e (opzionalmente) verifica se il dominio del brand già ranka per ogni domanda su Brave (gap detection).

### Input — POST body
Stesso shape EN.

### Output
Stesso shape EN. Status `gapStatus`: `covered` = brand ranka per quella domanda, `gap` = nessun risultato del brand → opportunità content, `unknown` = check gap disabilitato o fallito.

### Pipeline
1. **Fetch PAA** — DataForSEO endpoint con cache 24h + cap $20/mo.
2. **Generazione risposta** — Gemini-first, costo in `ai_cost_logs`.
3. **Gap detection** — Brave `site:brand.domain domanda`.
4. **Persistenza** — `aeo_snippets` + `aeo_runs`.

---

## 🇸🇪 Svenska

### Vad det gör
Hämtar Googles **"People Also Ask"**-frågor för ett seed-nyckelord via DataForSEO, genererar ett 40-60 ords svar per fråga med en LLM, paketerar varje Q&A som **FAQPage JSON-LD** redo att klistras in på varumärkets webbplats, och (valfritt) kontrollerar om varumärkets egen domän redan rankar för varje fråga på Brave (gap-detektering).

### Indata — POST body
Samma form som EN.

### Utdata
Samma form som EN.

### Pipeline
1. **PAA-hämtning** — DataForSEO via cache 24h + cap $20/mån.
2. **Svarsgenerering** — Gemini-först, kostnad i `ai_cost_logs`.
3. **Gap-detektering** — Brave `site:brand.domain fråga`.
4. **Persistens** — `aeo_snippets` + `aeo_runs`.

---

## Limits & known issues
- **Swedish PAA is sparse** — many Swedish niche queries return zero PAA. The UI now surfaces "No PAA questions returned" instead of failing silently.
- **Gap detection requires Brave** — without `BRAVE_API_KEYS` configured, gap detection is skipped (all snippets get `gapStatus: 'unknown'`).
- **DFS PAA call ~2 cents per query** — the run can fetch up to 10 questions in one DFS request but each `runAEOGeneration()` invocation = 1 DFS billed call.

## Cost
- DataForSEO: ~$0.0008/keyword (1 cent rounded up to 2 in the cap calc).
- Gemini answer generation: ~$0.001-0.003 per snippet.
- Brave gap-check: free tier counts (2k/mo total across all features).

## Data scope / valuta
- Tutti i prezzi DataForSEO in **USD**, conversione in cents stored in `dataforseo_usage.cost_cents`.
- Crediti AI registrati come `Float` USD in `ai_cost_logs.cost_usd`.
