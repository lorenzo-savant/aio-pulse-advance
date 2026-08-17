# Snapshots

| Field | Value |
|---|---|
| **Route** | `/dashboard/snapshots` |
| **API** | `GET/POST /api/snapshots` |
| **Service** | [`src/lib/services/citation-snapshots.ts`](../../src/lib/services/citation-snapshots.ts) |
| **Sidebar step** | 3 · Insights (locked until `hasData`) |

---

## 🇬🇧 English

### What it does
Turns raw `monitoring_results` rows into the **daily aggregated series every trend chart in the product reads**. A snapshot is one row per `engine × category × language` per day, holding the brand's citation rate plus each configured competitor's rate for that slice.

This is the aggregation layer, and it is load-bearing: [`citations`](./citations.md), [`competitor`](./competitor.md) and the trend chart in [`geo-score`](./geo-score.md) all read `citation_snapshots`, not `monitoring_results`. If a trend looks wrong, check this layer before suspecting the chart.

**Single-writer rule.** `calculateCitationSnapshots()` is the only writer for `citation_snapshots`. It upserts, so recomputing a date is idempotent. Adding a second write path is how you get duplicated dates and double-counted trends.

Two performance and correctness invariants are deliberate and documented in the service:
- Competitor matchers are compiled **once per run**, not once per combination. A brand with 5 categories and 3 languages produces 120 combinations; the earlier code rebuilt every competitor regex 120 times per snapshotted day.
- Matching is **word-boundary regex**, not substring `includes()`. Substring matching produced real false positives: `Acast` matched `Acasting` — two unrelated companies.

### Input
- `GET` — `brand_id` (required), `engine`, `category`, `language` filters.
- `POST` — `brand_id`, optional `date` (`YYYY-MM-DD`, defaults to today) to compute or recompute a day.

### Output
```ts
{
  snapshots: [{
    snapshot_date: string,        // YYYY-MM-DD
    engine: string,
    category: string,
    language: string,
    citation_rate: number,        // 0-100
    competitor_rates: Record<string, number>
  }]
}
```

### Data signals
Reads `monitoring_results` and the brand's competitor list; writes `citation_snapshots` by upsert. Rows per round-trip = `engine × category × language` for the date.

### Links
- Written automatically by the monitoring cron; also triggerable manually via POST.
- Consumers: [`citations`](./citations.md), [`competitor`](./competitor.md), [`geo-score`](./geo-score.md)

---

## 🇮🇹 Italiano

### Cosa fa
Trasforma le righe grezze di `monitoring_results` nella **serie aggregata giornaliera che legge ogni grafico trend del prodotto**. Uno snapshot è una riga per `motore × categoria × lingua` al giorno, con il citation rate del brand più quello di ciascun competitor configurato per quella fetta.

È il livello di aggregazione, ed è portante: [`citations`](./citations.md), [`competitor`](./competitor.md) e il grafico trend di [`geo-score`](./geo-score.md) leggono tutti `citation_snapshots`, non `monitoring_results`. Se un trend sembra sbagliato, controlla questo livello prima di sospettare il grafico.

**Regola del writer unico.** `calculateCitationSnapshots()` è l'unico writer di `citation_snapshots`. Fa upsert, quindi ricalcolare una data è idempotente. Aggiungere un secondo percorso di scrittura è il modo per ottenere date duplicate e trend contati due volte.

Due invarianti deliberate, documentate nel servizio:
- I matcher dei competitor sono compilati **una volta per esecuzione**, non una per combinazione. Un brand con 5 categorie e 3 lingue produce 120 combinazioni; il codice precedente ricostruiva ogni regex 120 volte al giorno.
- Il match è **regex con word boundary**, non `includes()` su sottostringa. Il match su sottostringa produceva falsi positivi reali: `Acast` corrispondeva ad `Acasting`, due aziende diverse.

### Input
- `GET` — `brand_id` (obbligatorio), filtri `engine`, `category`, `language`.
- `POST` — `brand_id`, `date` opzionale (`YYYY-MM-DD`, default oggi) per calcolare o ricalcolare un giorno.

### Output
Stessa shape della versione EN.

### Dati generati
Legge `monitoring_results` e la lista competitor del brand; scrive `citation_snapshots` in upsert.

---

## 🇸🇪 Svenska

### Vad det gör
Omvandlar råa `monitoring_results`-rader till den **dagligt aggregerade serie som varje trendgraf i produkten läser**. En ögonblicksbild är en rad per `motor × kategori × språk` och dag, med varumärkets citeringsgrad plus varje konfigurerad konkurrents grad för den delmängden.

Detta är aggregeringslagret, och det är bärande: [`citations`](./citations.md), [`competitor`](./competitor.md) och trendgrafen i [`geo-score`](./geo-score.md) läser alla `citation_snapshots`, inte `monitoring_results`. Ser en trend fel ut — kontrollera det här lagret innan du misstänker grafen.

**Regel om en enda skrivare.** `calculateCitationSnapshots()` är den enda skrivaren till `citation_snapshots`. Den gör upsert, så att räkna om ett datum är idempotent. Att lägga till en andra skrivväg är just hur man får dubbletter av datum och dubbelräknade trender.

Två medvetna invarianter:
- Konkurrentmatchare kompileras **en gång per körning**, inte en gång per kombination (5 kategorier × 3 språk = 120 kombinationer).
- Matchning sker med **regex och ordgräns**, inte `includes()`. Delsträngsmatchning gav verkliga falska positiva: `Acast` matchade `Acasting`.

### Indata
- `GET` — `brand_id` (obligatorisk), filtren `engine`, `category`, `language`.
- `POST` — `brand_id`, valfritt `date` (`YYYY-MM-DD`, standard idag).

### Utdata
Samma form som EN-versionen.

### Data
Läser `monitoring_results` och varumärkets konkurrentlista; skriver `citation_snapshots` via upsert.

---

## Limits & known issues
- **Row count grows multiplicatively** — `engine × category × language` per day. A brand with 4 engines, 5 categories and 3 languages writes 60 rows per day, 21 900 per year. Adding a dimension multiplies, it does not add.
- **Competitor rates are frozen at snapshot time** — adding a competitor to a brand does not backfill history. Its series starts the day it was configured, so a newly added competitor looks like it appeared from nothing.
- **Recompute is per-date** — there is no "rebuild the whole period" endpoint; recomputing a range means one POST per date. The rebuild path is deliberately bounded to avoid an unbounded backfill hammering the DB.
- **A day with no monitoring runs produces no row**, not a zero row. Charts must treat missing dates as absent data, not as a drop to zero.

## Cost
- Pure DB read + upsert, no external API and no model calls. Cost scales with the row multiplication above.

## Data scope
- `snapshot_date` is a date in UTC; rates are percentages `0-100`.
