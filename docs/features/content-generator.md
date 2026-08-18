# Content Generator

| Field | Value |
|---|---|
| **Route** | `/dashboard/content-generator` |
| **API** | `POST /api/brands/[id]/generate-article` |
| **Service** | [`article-generator.ts`](../../src/lib/services/article-generator.ts), [`citation-quality-scorer.ts`](../../src/lib/services/citation-quality-scorer.ts) |
| **Sidebar step** | 4 · Optimize |

---

## 🇬🇧 English

### What it does
Produces **draft Markdown articles optimised against the same five AI-citation signals** that [`content-optimizer`](./content-optimizer.md) measures — clarity, E-E-A-T, Q&A format, section structure, structured data. This closes the measure → create loop: the product both measures AI citations and generates content scored against the measured signals, using one scorer for both directions.

Pipeline in [`article-generator.ts`](../../src/lib/services/article-generator.ts):

1. Build a constraint-rich system prompt encoding the five signals.
2. `callLLM` with the fallback chain **Groq → Cerebras → Mistral → Gemini → OpenAI** — a provider that rate-limits or runs out of credit falls through instead of failing the request.
3. Auto-score the output with `scoreCitationQuality`.
4. Return `{ markdown, score, recommendations }`.

The draft never leaves the generator unscored, so an operator sees immediately whether the generated article would itself be citable — and the recommendations returned are the same vocabulary as the audit surfaces.

**Authorisation and rate limiting are deliberately tight**: the endpoint writes back to the brand and calls a paid model, so it requires **editor role** on the brand (`requireBrandRole`), and it is capped **per user, not per IP**, through the `ai_heavy` tier in [`rate-limit-tiers.ts`](../../src/lib/rate-limit-tiers.ts) at **5 requests/minute** — generous for a human, hostile to a loop.

### Input
- `brand_id` (UUID) in the path.
- `intent` — `B1` | `B2` | `B3` | `B4` | `B5` (the same intent buckets used by prompt generation).
- `length` — `short` | `medium` | `long`.
- Brand context (`ArticleBrandContext`) is assembled server-side from the `brands` row, not trusted from the client.

### Output
```ts
{
  markdown: string,              // the draft article
  score: number,                 // 0-100 from scoreCitationQuality
  recommendations: string[]      // how to raise the score
}
```

### Data signals
Reads the `brands` row for context. Writes back to the brand. Prompt building and post-processing are unit-testable; the LLM boundary accepts an injected `llmCaller` for mocking.

### Links
- The scorer, and what each signal is worth: [`content-optimizer`](./content-optimizer.md)
- Intent buckets B1-B5: [`prompt-generator`](./prompt-generator.md)

---

## 🇮🇹 Italiano

### Cosa fa
Produce **bozze di articoli in Markdown ottimizzate sugli stessi cinque segnali di citazione AI** che [`content-optimizer`](./content-optimizer.md) misura — chiarezza, E-E-A-T, formato domanda-risposta, struttura in sezioni, dati strutturati. Questo chiude il ciclo misura → crea: il prodotto misura le citazioni AI e genera contenuto valutato sugli stessi segnali, con un unico scorer per entrambe le direzioni.

Pipeline:

1. Costruisce un system prompt ricco di vincoli che codifica i cinque segnali.
2. `callLLM` con la catena di fallback **Groq → Cerebras → Mistral → Gemini → OpenAI** — un provider che va in rate limit o esaurisce il credito viene scavalcato invece di far fallire la richiesta.
3. Valuta automaticamente l'output con `scoreCitationQuality`.
4. Restituisce `{ markdown, score, recommendations }`.

La bozza non esce mai dal generatore senza punteggio, così l'operatore vede subito se l'articolo generato sarebbe a sua volta citabile — e le raccomandazioni restituite usano lo stesso vocabolario delle superfici di audit.

**Autorizzazione e rate limit sono stretti di proposito**: l'endpoint scrive sul brand e chiama un modello a pagamento, quindi richiede **ruolo editor** sul brand, ed è limitato **per utente, non per IP**, tramite il tier `ai_heavy` a **5 richieste/minuto** — generoso per una persona, ostile a un loop.

### Input
- `brand_id` (UUID) nel path.
- `intent` — `B1` | `B2` | `B3` | `B4` | `B5`.
- `length` — `short` | `medium` | `long`.
- Il contesto brand è assemblato server-side dalla riga `brands`, non accettato dal client.

### Output
Stessa shape della versione EN.

### Dati generati
Legge la riga `brands` per il contesto e vi scrive. La costruzione del prompt e il post-processing sono testabili unitariamente; il confine LLM accetta un `llmCaller` iniettato per il mocking.

---

## 🇸🇪 Svenska

### Vad det gör
Producerar **utkast till Markdown-artiklar optimerade mot samma fem AI-citeringssignaler** som [`content-optimizer`](./content-optimizer.md) mäter — tydlighet, E-E-A-T, fråga-svar-format, sektionsstruktur, strukturerad data. Det sluter kretsen mät → skapa: produkten både mäter AI-citeringar och genererar innehåll poängsatt mot de mätta signalerna, med en och samma poängsättare i båda riktningarna.

Pipeline:

1. Bygger en villkorsrik systemprompt som kodar de fem signalerna.
2. `callLLM` med fallback-kedjan **Groq → Cerebras → Mistral → Gemini → OpenAI** — en leverantör som rate-limitar eller får slut på kredit hoppas över istället för att fälla anropet.
3. Poängsätter utdata automatiskt med `scoreCitationQuality`.
4. Returnerar `{ markdown, score, recommendations }`.

Utkastet lämnar aldrig generatorn opoängsatt, så operatören ser direkt om den genererade artikeln själv skulle vara citerbar.

**Behörighet och rate limit är medvetet strama**: endpointen skriver tillbaka till varumärket och anropar en betald modell, så den kräver **editor-roll** på varumärket och är begränsad **per användare, inte per IP**, via `ai_heavy`-nivån på **5 anrop/minut**.

### Indata
- `brand_id` (UUID) i sökvägen.
- `intent` — `B1` | `B2` | `B3` | `B4` | `B5`.
- `length` — `short` | `medium` | `long`.
- Varumärkeskontexten sätts samman på servern från `brands`-raden, inte från klienten.

### Utdata
Samma form som EN-versionen.

### Data
Läser `brands`-raden för kontext och skriver tillbaka till den.

---

## Limits & known issues
- **The score is self-assessed** — the generator scores its own output with the same heuristics it optimised for, so a high score means "shaped the way the scorer rewards", not "verified as citable by an engine". Only [`monitoring`](./monitoring.md) can confirm the latter, weeks later.
- **Provider fallback masks quality variance** — the chain is ordered by cost/latency, not by writing quality. A request served by the fifth provider produces noticeably different prose from one served by the first, with nothing in the response saying which ran.
- **Output is a draft, not publishable copy** — no fact-checking, no brand-voice enforcement beyond the prompt, no citation of sources. It must be edited before publication.
- **5/min per user is a hard ceiling** — batch generation of many articles needs to be paced client-side; hitting the tier returns a rate-limit error, not a queue.

## Cost
- One billed model call per generation, on whichever provider in the chain answers. Scoring is free.

## Data scope
- `score` is `0-100` on the same scale as the Citation Quality card, so generator output and audited pages are directly comparable.
