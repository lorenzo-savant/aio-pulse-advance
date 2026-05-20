# Strategy Advisor

| Field | Value |
|---|---|
| **Route** | `/dashboard/advisor` |
| **API** | `POST /api/advisor` |
| **Service** | [`src/lib/services/advisor.ts`](../../src/lib/services/advisor.ts) |
| **Sidebar step** | 4 · Optimize |

---

## 🇬🇧 English

### What it does
Calls an LLM (Groq → Gemini → OpenAI fallback chain) for **1-3 ranked actionable recommendations** grounded in the brand's live data. Not a generic prompt-anything chat — the system prompt enforces evidence-citation rules (every recommendation must reference a specific CONTEXT fact) and confidence calibration tied to data richness.

### Input
- `brand_id` (UUID) — selected on the page from the brands the user owns.
- `question` (optional) — free-text question. Default: *"What are the most important things to do this week for this brand?"*

### Output
JSON validated by zod (`StrategyOutputSchema`):
```ts
{
  summary: string                // 10-600 chars
  recommendations: [{            // 1-3 entries
    title: string
    rationale: string
    impact: 'high' | 'medium' | 'low'
    effort: 'high' | 'medium' | 'low'
    actions: string[]            // 1-6 concrete next steps
    sources: string[]            // CONTEXT facts cited
  }]
  newPrompts?: [{                // 0-8 entries — only from promptGenerator suggestions
    text: string
    intentBucket: 'B1'|'B2'|'B3'|'B4'|'B5'
    priority: 'high'|'medium'|'low'
  }]
  confidence: 0..1
}
```

### Data signals fed to the LLM
The context builder (`buildAdvisorContext`) pulls in parallel:
- Brand row + aliases + configured competitors
- Latest `brand_health_scores` row + 7-day delta (AVI, citation rate, mention rate, sentiment, position avg)
- Monitoring activity last 7 days (per-engine counts + failed workflows)
- Active prompts count + language breakdown
- AEO snippets total/gap/covered
- Latest cached site audit summary
- **Prompt insights** — top/worst performing prompts by mention rate (last 30d)
- **Top mentioned competitors** — aggregated from `monitoring_results.competitor_mentions`
- **Brand disambiguation** — warning if brand name is ambiguous (e.g. Acasting vs Acast)
- **Prompt generator suggestions** — preset-driven new prompts the brand isn't monitoring yet
- **External presence** — Wikipedia + Reddit presence check
- **GEO research reference** — Princeton tactics + industry benchmarks

### Links
- Provider chain: Groq (llama-3.3-70b-versatile) → Gemini 2.5 Flash → gpt-4o-mini
- Schema: [`StrategyOutputSchema`](../../src/lib/services/advisor.ts)
- System prompt rules: 14 numbered rules covering grounding, confidence, setup-gap override, disambiguation, prompt generator, external presence

---

## 🇮🇹 Italiano

### Cosa fa
Chiama un LLM (catena Groq → Gemini → OpenAI) per **1-3 raccomandazioni prioritizzate e azionabili** basate sui dati live del brand. Non è una chat generica: il system prompt impone regole di citazione (ogni raccomandazione deve riferirsi a un fatto specifico nel CONTEXT) e calibrazione della confidence basata sulla ricchezza dei dati.

### Input
- `brand_id` (UUID) — selezionato dalla pagina tra i brand dell'utente.
- `question` (opzionale) — domanda free-text. Default: *"Quali sono le cose più importanti da fare questa settimana per questo brand?"*

### Output
JSON validato da zod (stesso schema della versione EN).

### Dati che alimentano il LLM
- Brand + alias + competitor configurati
- Ultima riga `brand_health_scores` + delta 7gg (AVI, citation rate, mention rate, sentiment, posizione media)
- Attività monitoring ultimi 7gg (counter per engine + workflow falliti)
- Numero prompt attivi + distribuzione per lingua
- Conteggio AEO snippets totali/gap/covered
- Ultimo site audit cached
- **Insight prompt** — top/worst per mention rate (ultimi 30gg)
- **Top competitor menzionati** — aggregati da `monitoring_results.competitor_mentions`
- **Disambiguation brand** — warning se il nome è ambiguo (es. Acasting vs Acast)
- **Suggerimenti prompt-generator** — nuovi prompt preset-driven non ancora monitorati
- **Presenza esterna** — check Wikipedia + Reddit
- **Riferimento ricerca GEO** — tattiche Princeton + benchmark di settore

### Link
- Chain provider: Groq (llama-3.3-70b-versatile) → Gemini 2.5 Flash → gpt-4o-mini
- Schema: [`StrategyOutputSchema`](../../src/lib/services/advisor.ts)
- Regole system prompt: 14 regole numerate (grounding, confidence, setup-gap, disambiguation, prompt generator, presenza esterna)

---

## 🇸🇪 Svenska

### Vad det gör
Anropar en LLM (Groq → Gemini → OpenAI fallback-kedja) för **1-3 rangordnade åtgärdsbara rekommendationer** baserade på varumärkets live-data. Ingen generisk chatt — systemprompten kräver evidens-citering (varje rekommendation måste referera ett specifikt CONTEXT-faktum) och konfidenskalibrering knuten till datarikedom.

### Indata
- `brand_id` (UUID) — vald på sidan från användarens varumärken.
- `question` (valfritt) — fri text. Standard: *"Vad är de viktigaste sakerna att göra denna vecka för detta varumärke?"*

### Utdata
JSON validerat av zod (samma schema som EN-versionen).

### Datasignaler till LLM
- Varumärkesrad + alias + konfigurerade konkurrenter
- Senaste `brand_health_scores`-raden + 7-dagars delta
- Övervakningsaktivitet senaste 7 dagarna (per motor + misslyckade arbetsflöden)
- Antal aktiva prompts + språkfördelning
- AEO-snippets summa/gap/täckta
- Senaste cachade site-audit
- **Promptinsikter** — bästa/sämsta efter omnämnandetakt (senaste 30 dagarna)
- **Mest omnämnda konkurrenter** — aggregerat från `monitoring_results.competitor_mentions`
- **Varumärkesdisambiguering** — varning om namnet är tvetydigt (t.ex. Acasting vs Acast)
- **Promptgenerator-förslag** — preset-drivna nya prompts som varumärket ännu inte övervakar
- **Extern närvaro** — Wikipedia + Reddit-kontroll
- **GEO-forskningsreferens** — Princeton-taktiker + branschbenchmarks

### Länkar
- Providerkedja: Groq (llama-3.3-70b-versatile) → Gemini 2.5 Flash → gpt-4o-mini
- Schema: [`StrategyOutputSchema`](../../src/lib/services/advisor.ts)
- Systempromptregler: 14 numrerade regler

---

## Limits & known issues
- **No cache for `llmClassifyIndustry`**: when a brand's industry doesn't match exact/keyword presets, a 5-sec LLM call fires on every advisor invocation. Acceptable while Groq is free; revisit if cost surfaces.
- **Confidence: 0.6+ requires monitoring volume**: brands with <30 runs in last 7d will see confidence capped ≤0.5 regardless of data quality elsewhere.
- **External presence check adds ~3s latency** (Wikipedia REST + Brave site:reddit.com). Soft-fail on errors.

## Cost (per call)
- Groq: ~free at current volume (~30 req/min, ~6k tokens/min free tier)
- Gemini fallback: ~$0.0005-0.001/call (gpt-4.7-mini equivalent)
- OpenAI fallback: ~$0.002-0.005/call

## Schema valuta
Tutti i costi loggati in **USD** in `ai_cost_logs.cost_usd`, convertiti a centesimi nell'overview `/dashboard/api-costs`.
