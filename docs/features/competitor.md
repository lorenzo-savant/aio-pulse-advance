# Competitor

| Field | Value |
|---|---|
| **Route** | `/dashboard/competitor` |
| **API** | `GET/POST /api/competitor`, `GET /api/share-of-voice`, `GET /api/snapshots` |
| **Service** | [`share-of-voice.ts`](../../src/lib/services/share-of-voice.ts), [`market-position.ts`](../../src/lib/services/market-position.ts), [`gemini.ts`](../../src/lib/services/gemini.ts) |
| **Sidebar step** | 3 · Insights |

---

## 🇬🇧 English

### What it does
Two capabilities on one page, with **different cost profiles that matter operationally**:

1. **Share of Voice** (`GET /api/share-of-voice`, free) — of all brand + competitor mentions across AI responses, what share is yours versus each rival, and how the split moves over time. Computed by [`share-of-voice.ts`](../../src/lib/services/share-of-voice.ts), which is **pure and deterministic** (no DB, no network) so it is unit-tested directly; the route feeds it raw `monitoring_results` rows. Weekly time points are grouped by ISO week start (Monday).

2. **Competitor analysis** (`POST /api/competitor`, billed) — an LLM analysis via [`analyzeCompetitor`](../../src/lib/services/gemini.ts), persisted to `competitor_analyses`. `GET /api/competitor` returns the stored analyses; the POST is what creates a new one and calls the model.

Share of Voice also reports **discovered entities** (`SovDiscovered`): brands the engines mention that nobody configured as competitors. That is how a real competitive set gets corrected — the configured list reflects the brief, the discovered list reflects the market.

### Input
- `brand_id` (UUID), required on all three endpoints.
- `POST /api/competitor` body — brand + competitor context for the LLM analysis.

### Output
```ts
// GET /api/share-of-voice
{
  entities: [{ name: string, isOwn: boolean, mentions: number, share: number }],
  timeline: [{ weekStart: string, shares: Record<string, number> }],
  discovered: [{ name: string, mentions: number }]   // not configured as competitors
}
// GET /api/competitor
{ analyses: [{ id, created_at, ...analysis }] }
```

### Data signals
- Reads `monitoring_results` (share of voice) and `citation_snapshots` (benchmark rates).
- Writes `competitor_analyses` on POST — the only write on this page.

### Links
- Configured competitor list is a brand field: [`brands`](./brands.md)
- Same benchmark rates rendered as a trend: [`citations`](./citations.md)

---

## 🇮🇹 Italiano

### Cosa fa
Due capacità su una pagina, con **profili di costo diversi che contano operativamente**:

1. **Share of Voice** (gratuito) — su tutte le menzioni di brand + competitor nelle risposte AI, quale quota è tua rispetto a ciascun rivale, e come si muove nel tempo. Calcolato da un servizio **puro e deterministico** (nessun DB, nessuna rete), quindi testato unitariamente; la route gli passa le righe grezze di `monitoring_results`. I punti temporali settimanali sono raggruppati per inizio settimana ISO (lunedì).

2. **Analisi competitor** (a pagamento) — analisi LLM via Gemini, persistita in `competitor_analyses`. Il GET restituisce le analisi salvate; è il POST che ne crea una nuova e chiama il modello.

Share of Voice riporta anche le **entità scoperte**: brand che i motori nominano e che nessuno ha configurato come competitor. È così che un set competitivo reale viene corretto — la lista configurata riflette il brief, la lista scoperta riflette il mercato.

### Input
- `brand_id` (UUID), obbligatorio su tutti tre gli endpoint.
- Body del POST — contesto brand + competitor per l'analisi LLM.

### Output
Stessa shape della versione EN.

### Dati generati
- Legge `monitoring_results` (share of voice) e `citation_snapshots` (tassi di confronto).
- Scrive `competitor_analyses` sul POST — l'unica scrittura della pagina.

---

## 🇸🇪 Svenska

### Vad det gör
Två förmågor på en sida, med **olika kostnadsprofiler som spelar roll i drift**:

1. **Share of Voice** (gratis) — av alla varumärkes- och konkurrentomnämnanden i AI-svaren, vilken andel är er jämfört med varje rival, och hur rör sig fördelningen över tid. Beräknas av en **ren och deterministisk** tjänst (ingen databas, inget nätverk) som därför enhetstestas direkt; routen matar den med råa `monitoring_results`-rader. Veckopunkter grupperas på ISO-veckans start (måndag).

2. **Konkurrentanalys** (debiterad) — LLM-analys via Gemini, sparad i `competitor_analyses`. GET returnerar sparade analyser; det är POST som skapar en ny och anropar modellen.

Share of Voice rapporterar även **upptäckta aktörer**: varumärken som motorerna nämner men som ingen konfigurerat som konkurrenter. Så korrigeras en verklig konkurrensbild — den konfigurerade listan speglar briefen, den upptäckta listan speglar marknaden.

### Indata
- `brand_id` (UUID), obligatorisk på alla tre endpoints.
- POST-body — varumärkes- och konkurrentkontext för LLM-analysen.

### Utdata
Samma form som EN-versionen.

### Data
- Läser `monitoring_results` och `citation_snapshots`.
- Skriver `competitor_analyses` vid POST.

---

## Limits & known issues
- **Two metrics that look comparable and are not.** Share of Voice is a share of *mentions*; the co-mention rate on [`citations`](./citations.md) is a share of *responses*. A competitor can lead the co-mention rate while trailing badly on Share of Voice — that is not a contradiction, and any client-facing use of both numbers needs the distinction stated explicitly.
- **Configured-competitor bias** — every comparative panel is scoped to the brand's configured competitors. If the configured set is wrong (fashion brands for a category-wide marketplace, say), the comparison is against the wrong market and the `discovered` list is the only signal that says so.
- **POST is billed and unbounded per click** — each competitor analysis is one model call; nothing caches or deduplicates repeated analyses of the same brand.
- **Word-boundary matching, not substring** — competitor detection uses escaped regex with `\b` precisely because substring matching produced real false positives (`Acast` matching `Acasting` — a podcast host matching a casting platform). Do not "simplify" it back to `includes()`.

## Cost
- Share of Voice: pure computation over DB rows, free.
- Competitor analysis: one Gemini call per POST.

## Data scope
- Shares are fractions of total weighted mentions in the window; timeline buckets are ISO weeks (Monday start), UTC.
