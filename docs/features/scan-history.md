# Scan History

| Field | Value |
|---|---|
| **Route** | `/dashboard/history` |
| **API** | `GET /api/scans` (via the client store, not called from the page) |
| **Page** | [`src/app/dashboard/history/page.tsx`](../../src/app/dashboard/history/page.tsx) |
| **Store** | [`src/lib/store.ts`](../../src/lib/store.ts) — `scanHistory`, `loadScanHistory`, `addScan`, `clearHistory` |
| **Sidebar step** | 3 · Insights |

---

## 🇬🇧 English

### What it does
The log of **ad-hoc analyses** — the one-off scans run from [`content-audit`](./content-audit.md) and [`content-optimizer`](./content-optimizer.md) against a pasted text or a URL. It is not the log of scheduled brand monitoring; that history lives in `monitoring_results` and surfaces through [`monitoring`](./monitoring.md) and [`snapshots`](./snapshots.md).

Per entry the page shows a score ring, source, input type (`text` | `url`), engine and model used, and timestamp — with search, filtering, per-entry delete, and CSV / JSON export via [`src/lib/export.ts`](../../src/lib/export.ts).

Architecturally this page is the odd one out: **it renders from the Zustand store, not from a fetch of its own**. The store hydrates from `GET /api/scans` and caps the list at the 50 most recent entries (`[entry, ...s.scanHistory].slice(0, 50)`). Any component can add to it via `addScan()`, which is why an analysis run on another page appears here without this page knowing about it.

### Input
- No route parameters. The list is whatever the store holds for the signed-in user.
- Client-side controls: free-text search, engine filter, sort.

### Output
```ts
ScanHistoryEntry {
  id: string
  source: string
  type: 'text' | 'url'
  engine: EngineId
  model: ModelId
  score: number          // drives the ring colour: ≥80 green, ≥50 indigo, else rose
  createdAt: string
}
```

### Data signals
Reads `analysis_results` through `GET /api/scans`. `addScan()` persists a new analysis; `clearHistory()` clears **client state only** and does not delete server rows.

### Links
- Producers of these entries: [`content-audit`](./content-audit.md), [`content-optimizer`](./content-optimizer.md)
- Scheduled brand monitoring history instead: [`monitoring`](./monitoring.md)

---

## 🇮🇹 Italiano

### Cosa fa
Il registro delle **analisi ad-hoc** — le scansioni singole lanciate da [`content-audit`](./content-audit.md) e [`content-optimizer`](./content-optimizer.md) su un testo incollato o un URL. Non è il registro del monitoraggio programmato del brand: quella storia vive in `monitoring_results` e affiora da [`monitoring`](./monitoring.md) e [`snapshots`](./snapshots.md).

Per ogni voce la pagina mostra un anello di punteggio, sorgente, tipo di input (`text` | `url`), motore e modello usati, e timestamp — con ricerca, filtri, eliminazione per voce ed export CSV / JSON.

Architetturalmente questa pagina è l'eccezione: **rende dallo store Zustand, non da un fetch proprio**. Lo store si idrata da `GET /api/scans` e limita la lista alle 50 voci più recenti. Qualsiasi componente può aggiungere una voce con `addScan()`: è per questo che un'analisi lanciata su un'altra pagina appare qui senza che questa pagina ne sappia nulla.

### Input
- Nessun parametro di route. La lista è ciò che lo store contiene per l'utente autenticato.
- Controlli client: ricerca testuale, filtro motore, ordinamento.

### Output
Stessa shape `ScanHistoryEntry` della versione EN. Il colore dell'anello: ≥80 verde, ≥50 indaco, altrimenti rosso.

### Dati generati
Legge `analysis_results` via `GET /api/scans`. `addScan()` persiste una nuova analisi; `clearHistory()` svuota **solo lo stato client** e non elimina righe sul server.

---

## 🇸🇪 Svenska

### Vad det gör
Loggen över **ad-hoc-analyser** — enstaka körningar startade från [`content-audit`](./content-audit.md) och [`content-optimizer`](./content-optimizer.md) mot inklistrad text eller en URL. Det är inte loggen över schemalagd varumärkesövervakning; den historiken finns i `monitoring_results`.

Per post visas en poängring, källa, indatatyp (`text` | `url`), motor och modell, samt tidsstämpel — med sökning, filtrering, radering per post och export till CSV / JSON.

Arkitektoniskt är sidan undantaget: **den renderar från Zustand-lagret, inte från en egen hämtning**. Lagret fylls från `GET /api/scans` och begränsar listan till de 50 senaste posterna. Vilken komponent som helst kan lägga till via `addScan()`, vilket är skälet till att en analys körd på en annan sida syns här.

### Indata
- Inga route-parametrar. Listan är vad lagret håller för den inloggade användaren.
- Klientkontroller: fritextsökning, motorfilter, sortering.

### Utdata
Samma `ScanHistoryEntry`-form som EN-versionen.

### Data
Läser `analysis_results` via `GET /api/scans`. `addScan()` sparar en ny analys; `clearHistory()` rensar **endast klienttillståndet**.

---

## Limits & known issues
- **Hard cap at 50 entries** — the store slices to 50 on insert. The 51st scan silently drops the oldest from view even though the row remains in `analysis_results`. There is no pagination and no "show all".
- **`clearHistory()` is misleading** — it empties the client list only. A user who "clears history" and reloads sees the entries return, because the server rows were never touched.
- **Not brand-scoped** — entries are per user and carry a free-text `source`, so ad-hoc scans for different brands interleave with no brand filter.
- **Renders from store state, so it can be stale** — if `loadScanHistory()` has not run in the session the page shows an empty list rather than a loading state tied to its own fetch.

## Cost
- The page itself is free. Each entry was produced by a billed analysis on the page that created it.

## Data scope
- `score` is `0-100`; timestamps are stored UTC and rendered relative in the browser locale.
