# Monitoring

| Field | Value |
|---|---|
| **Route** | `/dashboard/monitoring` |
| **API** | `GET /api/monitoring`, `POST /api/monitoring` |
| **Service** | [`src/lib/services/monitoring.ts`](../../src/lib/services/monitoring.ts) |
| **Sidebar step** | 2 · Monitor |

---

## 🇬🇧 English

### What it does
Sends a prompt to the chosen AI engine(s), persists the raw response, runs LLM-driven analysis on it to extract brand-mention metrics (mentioned/not, position, sentiment, hallucinations, competitor mentions), and stores the result in `monitoring_results`. Each invocation also creates a `workflow_executions` row that powers `/dashboard/workflows`.

### Input — POST body
```ts
{
  prompt_id: UUID,                       // a row in `prompts`
  engines?: ('chatgpt'|'gemini'|'perplexity'|'claude')[]
                                         // defaults to prompt.engines
}
```

### Output
Per engine: a `MonitoringResult` row in DB containing:
```ts
{
  id, prompt_id, brand_id, user_id, engine,
  prompt_text, response_text,            // raw LLM output
  brand_mentioned: boolean,
  mention_position: number | null,       // 1-based char index of first mention
  mention_count: integer,
  mention_type: 'direct'|'indirect'|'none',
  visibility_score: 0..100,
  sentiment: 'positive'|'negative'|'neutral',
  sentiment_score: -1..1,
  sentiment_reasoning: string,
  cited_urls: string[],                  // resolved (Vertex redirects unwrapped)
  competitor_mentions: [{ name, position, count }],
  has_hallucination: boolean,
  hallucination_flags: [{ text, severity, type }],
  execution_time_ms: number,
  cost_credits: number,                  // platform credit ledger
  primary_provider: string,
  all_providers: string[],
  created_at: timestamptz
}
```

### Pipeline
1. **Credit check** — POST to `/api/credits/use` to deduct credits up front. Fails closed if credits insufficient.
2. **Engine simulation** — `simulateEngineResponse(promptText, engine, lang, brand)` in `ai-router.ts` calls the engine's provider with `enrichPromptWithBrandContext` (brand disambiguation hints embedded). Returns text + citations.
3. **Brand analysis** — `analyzeResponseForBrand(analysisPrompt)` builds a strict-JSON analysis prompt over the response text + zod-validates against `analysisOutputSchema`. Uses Gemini (jsonMode: thinkingBudget=0) for the JSON pass.
4. **Persistence** — INSERT into `monitoring_results`. Workflow row updated in `workflow_executions`. Alert rules in `alert_rules` evaluated; matching ones dispatch via the configured channels.
5. **Citation aggregation cron** — daily `/api/cron/digest` recomputes `brand_health_scores` for the day from the monitoring rows.

### Links
- Engine simulation: [`ai-router.ts`](../../src/lib/services/ai-router.ts)
- Brand context: [`brand-enrichment.ts`](../../src/lib/brand-enrichment.ts)
- Analysis schema: `analysisOutputSchema` in monitoring.ts

---

## 🇮🇹 Italiano

### Cosa fa
Invia un prompt all'engine AI scelto/i, persiste la risposta grezza, esegue analisi LLM-driven per estrarre metriche di menzione brand (menzionato/no, posizione, sentiment, hallucination, menzioni competitor), e salva il risultato in `monitoring_results`. Ogni invocazione crea anche una riga `workflow_executions` che alimenta `/dashboard/workflows`.

### Input — POST body
Stesso shape EN.

### Output
Per engine: una riga `MonitoringResult` in DB. Stessa shape EN.

### Pipeline
1. **Check crediti** — POST a `/api/credits/use`. Fail-closed se crediti insufficienti.
2. **Simulazione engine** — `simulateEngineResponse` con `enrichPromptWithBrandContext` (hint disambiguazione brand embedded).
3. **Analisi brand** — `analyzeResponseForBrand` con prompt JSON-strict + validazione zod. Gemini jsonMode (thinkingBudget=0).
4. **Persistenza** — INSERT in `monitoring_results`. Workflow update. Alert rules evaluated → dispatched.
5. **Cron aggregazione** — `/api/cron/digest` quotidiano ricalcola `brand_health_scores` dalle righe del giorno.

---

## 🇸🇪 Svenska

### Vad det gör
Skickar en prompt till valda AI-motorer, sparar det råa svaret, kör LLM-driven analys för att extrahera varumärkesomnämningsmetrik (omnämnt/inte, position, sentiment, hallucinationer, konkurrentomnämningar), och lagrar resultatet i `monitoring_results`. Varje anrop skapar också en `workflow_executions`-rad som matar `/dashboard/workflows`.

### Indata — POST body
Samma form som EN.

### Utdata
En `MonitoringResult`-rad per motor i databasen. Samma form som EN.

### Pipeline
1. **Kreditkontroll** — POST till `/api/credits/use`. Failar stängt vid otillräckliga krediter.
2. **Motorsimulering** — `simulateEngineResponse` med `enrichPromptWithBrandContext`.
3. **Varumärkesanalys** — `analyzeResponseForBrand` med strikt JSON + zod-validering. Gemini jsonMode.
4. **Persistens** — INSERT i `monitoring_results`. Workflow-uppdatering. Larmregler evalueras → utskickas.
5. **Aggregeringscron** — `/api/cron/digest` dagligen räknar om `brand_health_scores`.

---

## Limits & known issues
- **Brand mention detection is LLM-based, not regex** — works around word-boundary edge cases (Acasting vs Acast) via explicit disambiguation rules in the analysis prompt.
- **Per-engine cost differs** — ChatGPT runs are pricier than Gemini Flash. Cost recorded in `cost_credits` (platform internal credit unit, 1 credit = $0.001).
- **Failed engine call ≠ failed run** — if 1 of 4 engines fails, the workflow completes with the 3 successful results. The failure is logged in `workflow_executions.error`.

## Cost
- 1 LLM call per engine for the response generation + 1 LLM call for the JSON analysis. Cached responses (via `serp_query_cache`) eliminate the analysis call when the response text is byte-identical.

## Data scope / valuta
- `cost_credits` is **platform credits**, not USD. Conversion: 1 credit = $0.001 USD (configurable).
- `ai_cost_logs.cost_usd` stores the real provider cost in USD Float.
- All timestamps UTC.
