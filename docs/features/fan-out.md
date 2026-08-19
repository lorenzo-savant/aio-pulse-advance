# Query Fan-out

| Field | Value |
|---|---|
| **Route** | `/dashboard/fan-out` |
| **API** | `GET /api/fan-out?brand_id=…&days=30` |
| **Service** | [`fan-out.ts`](../../src/lib/services/fan-out.ts) — pure extraction + aggregation |
| **Column** | `monitoring_results.search_queries text[]` (migration `20260819090000`) |
| **Sidebar step** | 3 · Insights (locked until `hasData`) |

---

## 🇬🇧 English

### What it does
Captures and ranks **the searches an engine actually ran** to answer a monitored prompt — the query fan-out.

When a question depends on what is true right now, an engine does not answer from memory: it turns the question into one to three real web searches and synthesises the results. Those strings are what the brand competes for, and **they are not the prompt we sent**.

Measured live on 2026-08-19. Prompt:

> `Vilka sajter är bäst för att köpa begagnad elektronik i Sverige 2026?`

Gemini searched:

> `basta sajter begagnad elektronik sverige`
> `kop begagnad elektronik garanti sverige`

Diacritics stripped, the year dropped, one question split into two searches, and a concept the prompt never contained (`garanti` — warranty) introduced. A page tuned to the prompt wording is tuned to a string nobody searched. The `drift` column measures exactly that gap.

### Input
- `brand_id` (UUID), required.
- `days` — window, clamped to `[1, 365]`, default `30`.

### Output
```ts
{
  captured: number,        // runs carrying a fan-out array
  notCaptured: number,     // NULL — legacy rows, or a provider that hides its queries
  searchless: number,      // [] — the engine answered without searching
  expansionRatio: number,  // avg searches per searching run
  queries: [{
    query: string,         // most frequent spelling seen
    runs: number,
    engines: string[],
    mentionRate: number,   // 0-100, of the runs that ran this search
    citationRate: number,  // 0-100, own domain cited
    prompts: string[],     // prompts that triggered it
    drift: number          // 0-100 word-overlap distance from the top prompt
  }],
  windowDays: number,
  totalRows: number
}
```

### Provider coverage — verified live, not assumed
| Provider | Field | Captured |
|---|---|---|
| OpenAI Responses | `output[].type='web_search_call'` → `action.queries[]` | ✅ |
| Gemini Interactions (3.x) | `steps[].type='google_search_call'` → `arguments` (a **JSON string**) → `queries` | ✅ |
| Gemini generateContent (2.x) | `groundingMetadata.webSearchQueries[]` | ✅ |
| Perplexity sonar | — | ❌ returns `search_results` and `related_questions`, never the queries it ran |

### Data signals
Writes `monitoring_results.search_queries` on every monitoring run. Read path is aggregation only.

**NULL and `[]` are different and must stay different:**
- `NULL` → not captured. A row from before capture shipped, or Perplexity.
- `[]` → the engine answered from model memory without searching.

Merging them turns "we cannot see it" into "it did not happen". The API reports the two as separate counters and never folds a NULL row into a zero.

### Links
- Presentation filters shared with every per-engine surface: [`engine-provenance.ts`](../../src/lib/services/engine-provenance.ts) — a fallback-served row is not that engine's measurement
- Where the searches point: [`citation-sources`](./citation-sources.md)
- Method background: `docs/research/guida-operativa-geo-aeo-2026.md`, Fase 1

---

## 🇮🇹 Italiano

### Cosa fa
Cattura e classifica **le ricerche che un motore ha davvero eseguito** per rispondere a un prompt monitorato: il query fan-out.

Quando una domanda dipende da cosa è vero adesso, il motore non risponde a memoria: trasforma la domanda in una-tre ricerche web reali e sintetizza i risultati. Quelle stringhe sono ciò per cui il brand compete, e **non sono il prompt che abbiamo inviato**.

Misurato dal vivo il 19/8/2026. Prompt: `Vilka sajter är bäst för att köpa begagnad elektronik i Sverige 2026?` → Gemini ha cercato `basta sajter begagnad elektronik sverige` e `kop begagnad elektronik garanti sverige`. Diacritici caduti, anno caduto, una domanda spezzata in due ricerche, e un concetto mai presente nel prompt (`garanti`) introdotto. Una pagina ottimizzata sul testo del prompt è ottimizzata per una stringa che nessuno ha cercato. La colonna `drift` misura esattamente quello scarto.

### Input
- `brand_id` (UUID), obbligatorio.
- `days` — finestra, limitata a `[1, 365]`, default `30`.

### Output
Stessa shape della versione EN.

### Copertura per provider — verificata dal vivo
OpenAI ✅ (`web_search_call` → `action.queries`), Gemini Interactions ✅ (`arguments` è una **stringa JSON**), Gemini 2.x ✅ (`webSearchQueries`), **Perplexity ❌**: la sua API restituisce `search_results` e `related_questions` ma mai le query eseguite.

### Dati generati
Scrive `monitoring_results.search_queries` a ogni esecuzione. In lettura solo aggregazione.

**NULL e `[]` sono cose diverse:** `NULL` = non catturato (riga storica, o Perplexity); `[]` = il motore ha risposto senza cercare. Fonderli trasformerebbe "non possiamo vederlo" in "non è successo".

---

## 🇸🇪 Svenska

### Vad det gör
Fångar och rangordnar **de sökningar en motor faktiskt körde** för att besvara en bevakad prompt — sökfrågeexpansionen.

När en fråga beror på vad som är sant just nu svarar motorn inte ur minnet: den gör om frågan till en till tre verkliga webbsökningar och sammanfattar resultaten. Det är de strängarna varumärket konkurrerar om, och **de är inte prompten vi skickade**.

Uppmätt live 2026-08-19. Prompt: `Vilka sajter är bäst för att köpa begagnad elektronik i Sverige 2026?` → Gemini sökte på `basta sajter begagnad elektronik sverige` och `kop begagnad elektronik garanti sverige`. Diakriterna borta, årtalet borta, en fråga delad i två sökningar, och ett begrepp prompten aldrig innehöll (`garanti`) tillagt. En sida anpassad efter promptens formulering är anpassad efter en sträng ingen sökte på. Kolumnen `drift` mäter precis den skillnaden.

### Indata
- `brand_id` (UUID), obligatorisk.
- `days` — fönster, begränsat till `[1, 365]`, standard `30`.

### Utdata
Samma form som EN-versionen.

### Leverantörstäckning — verifierad live
OpenAI ✅, Gemini Interactions ✅ (`arguments` är en **JSON-sträng**), Gemini 2.x ✅, **Perplexity ❌** — returnerar `search_results` och `related_questions`, aldrig frågorna den körde.

### Data
Skriver `monitoring_results.search_queries` vid varje körning. **NULL och `[]` betyder olika saker:** NULL = ej fångat (äldre rad, eller Perplexity), `[]` = motorn svarade utan att söka.

---

## Limits & known issues
- **History is permanently lost.** Capture began 2026-08-19. Every run before it carries NULL, and it is not recoverable: `raw_response` exists as a column but no writer ever populated it, so the original provider payloads were never stored. The 2 581 runs that predate this feature have no fan-out and never will.
- **Perplexity is structurally blind.** One of the three active engines cannot contribute. Its rows count in `notCaptured`, never in the ranking. Any claim about "all engines" must exclude it explicitly.
- **`drift` is lexical, not semantic.** Jaccard distance over word sets, no stemming and no embeddings. `köpa` and `kop` score as different words — which is the intended reading (the engine really did search a different string), but it means drift overstates the gap for languages with heavy inflection. Read it as a flag for inspection, not a precision instrument.
- **Ranking bias by design.** Sorted by runs, then ascending mention rate, so gaps surface above strengths. A search with 100% mention rate is a position to defend and sinks to the bottom of its volume band.
- **Window cap.** The route reads at most 5 000 rows per request; a very high-volume brand over 365 days would truncate.

## Cost
- Free. The fan-out arrives inside responses already being paid for; capture adds parsing, no extra call. The aggregation is a pure reduction over rows already fetched.

## Data scope
- `search_queries` is `text[]`, nullable, with a GIN index for containment lookups. Queries are stored as the engine wrote them — diacritics are **not** normalised away, because whether the engine stripped them is itself a signal.
