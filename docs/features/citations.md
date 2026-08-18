# Citations

| Field | Value |
|---|---|
| **Route** | `/dashboard/citations` |
| **API** | `GET /api/snapshots?brand_id=…&engine=…&category=…&language=…` |
| **Page** | [`src/app/dashboard/citations/page.tsx`](../../src/app/dashboard/citations/page.tsx) |
| **Sidebar step** | 3 · Insights (locked until `hasData`) |

---

## 🇬🇧 English

### What it does
Shows **citation rate over time** — the share of AI answers that name the brand — as an "all engines" trend plus a per-engine breakdown, with competitor rates on the same axis for benchmarking. This is the rate surface; [`citation-sources`](./citation-sources.md) is the *which domains* surface. They answer different questions and read different fields.

Fetch strategy is deliberate and worth knowing before changing it: the **"all engines" aggregate is the primary series and is fetched first**; the per-engine series — `ACTIVE_ENGINES`, so `chatgpt`, `gemini`, `perplexity`; a retired engine is not drawn — are fetched separately so that one engine failing degrades a single line instead of blanking the whole panel.

The page also embeds two AI-readiness panels shared with [`site-audit`](./site-audit.md): [`CrawlerAccessPanel`](../../src/components/CrawlerAccessPanel.tsx) and [`CitationCapturePanel`](../../src/components/CitationCapturePanel.tsx) — they sit here because a zero citation rate is most often a crawler-access problem, and the answer belongs next to the symptom.

### Input
- `brand_id` (UUID), required.
- `engine` — `all` | `chatgpt` | `gemini` | `perplexity` | `claude`.
- `category` — prompt category filter, `all` by default.
- `language` — response-language filter; changing it refetches every series.

### Output
```ts
{
  snapshots: [{
    snapshot_date: string,
    engine: string,
    citation_rate: number,             // 0-100
    competitor_rates: Record<string, number>  // competitor name → 0-100
  }]
}
```

### Data signals
Read-only over `citation_snapshots`. Rows are written by [`snapshots`](./snapshots.md) / the monitoring cron, never by this page.

### Links
- Which domains get cited: [`citation-sources`](./citation-sources.md)
- Snapshot writer and its single-writer rule: [`snapshots`](./snapshots.md)

---

## 🇮🇹 Italiano

### Cosa fa
Mostra il **citation rate nel tempo** — la quota di risposte AI che nominano il brand — come trend "tutti i motori" più la scomposizione per motore, con i tassi dei competitor sullo stesso asse per il confronto. Questa è la superficie del *tasso*; [`citation-sources`](./citation-sources.md) è quella dei *domini*. Rispondono a domande diverse e leggono campi diversi.

La strategia di fetch è deliberata: l'**aggregato "tutti i motori" è la serie primaria e viene richiesto per primo**; le quattro serie per motore vengono richieste separatamente, così il fallimento di un motore degrada una linea invece di svuotare il pannello.

La pagina include anche due pannelli di AI-readiness condivisi con [`site-audit`](./site-audit.md): accesso crawler e citation capture. Stanno qui perché un citation rate a zero è quasi sempre un problema di accesso crawler, e la risposta va accanto al sintomo.

### Input
- `brand_id` (UUID), obbligatorio.
- `engine` — `all` | `chatgpt` | `gemini` | `perplexity` | `claude`.
- `category` — filtro categoria prompt, `all` di default.
- `language` — filtro lingua della risposta; cambiarlo rilancia tutte le serie.

### Output
Stessa shape della versione EN.

### Dati generati
Sola lettura su `citation_snapshots`. Le righe le scrive [`snapshots`](./snapshots.md) / il cron di monitoraggio, mai questa pagina.

---

## 🇸🇪 Svenska

### Vad det gör
Visar **citeringsgrad över tid** — andelen AI-svar som nämner varumärket — som en trend för "alla motorer" plus en uppdelning per motor, med konkurrenternas nivåer på samma axel. Detta är ytan för *graden*; [`citation-sources`](./citation-sources.md) är ytan för *vilka domäner*.

Hämtningsstrategin är medveten: **aggregatet "alla motorer" är den primära serien och hämtas först**; de fyra serierna per motor hämtas separat, så att en trasig motor bara försämrar en linje istället för att tömma hela panelen.

Sidan innehåller även två AI-beredskapspaneler som delas med [`site-audit`](./site-audit.md): crawler-åtkomst och citation capture. De ligger här eftersom en citeringsgrad på noll oftast är ett crawler-problem.

### Indata
- `brand_id` (UUID), obligatorisk.
- `engine` — `all` | `chatgpt` | `gemini` | `perplexity` | `claude`.
- `category` — promptkategori, `all` som standard.
- `language` — språkfilter; ändring hämtar om samtliga serier.

### Utdata
Samma form som EN-versionen.

### Data
Endast läsning från `citation_snapshots`.

---

## Limits & known issues
- **Five requests per view** — one aggregate + four per-engine. Adding an engine adds a request; there is no batched endpoint.
- **Empty until snapshots exist** — the sidebar locks the entry on `!s.hasData`. A brand with monitoring runs but no snapshot rows still renders empty, because the page reads `citation_snapshots`, not `monitoring_results`.
- **Competitor rates depend on brand configuration** — `competitor_rates` only contains competitors configured on the brand. A competitor the engines mention but nobody configured is invisible here (the same class of gap that shows up as "not configured" in client reports).

## Cost
- Pure DB reads. The two embedded readiness panels make outbound HTTP requests to the brand domain when run.

## Data scope
- Rates are percentages `0-100` stored as `Float`; dates are `snapshot_date` (date, UTC).
