# Reports

| Field | Value |
|---|---|
| **Route** | `/dashboard/reports` |
| **API** | `GET /api/export?format=csv\|json\|pdf`, `GET/POST/DELETE /api/brands/[id]/report-schedules`, `POST /api/cron/report-delivery` |
| **Service** | [`src/lib/services/report-branding.ts`](../../src/lib/services/report-branding.ts) |
| **Sidebar step** | 3 · Insights (locked until `hasData`) |

---

## 🇬🇧 English

### What it does
Two things that are easy to confuse: **exporting a report now**, and **scheduling one to be emailed later**.

**Export now** — `GET /api/export` with `format=csv | json | pdf` over a `brand_id` and an optional date range. The PDF path renders through `jsPDF` and applies white-label branding from [`report-branding.ts`](../../src/lib/services/report-branding.ts) (brand colour, logo, client name), so the artefact can go to a client without editing.

**Schedule delivery** — `POST /api/brands/[id]/report-schedules` persists a recurring delivery:

| Field | Constraint |
|---|---|
| `frequency` | `daily` \| `weekly` \| `monthly` |
| `recipients` | 1-20 valid email addresses |
| `label` | optional human name for the schedule |

The stored row tracks `is_active`, `next_run_at`, `last_sent_at`, `last_error`, `send_count` — so a schedule that has been silently failing is diagnosable from the row rather than from logs. `POST /api/cron/report-delivery` is the worker that walks due schedules and sends.

Creating a schedule **persists a row and later emails brand data to third parties**, which is why it takes editor role rather than viewer.

### Input
- `brand_id` (UUID), required for both export and schedules.
- `format` — `csv` | `json` | `pdf`; any other value is rejected (`validFormats` allowlist).
- Optional date range; an invalid range is rejected rather than silently widened.

### Output
- Export: a file stream in the requested format.
- Schedules: the persisted row including its delivery bookkeeping fields.

### Data signals
Reads `monitoring_results` for the export payload. Writes and deletes `report_schedules`. The cron worker updates `last_sent_at` / `last_error` / `send_count`.

### Links
- White-label PDF branding: [`report-branding.ts`](../../src/lib/services/report-branding.ts)
- Narrative export aimed at client meetings: [`ai-funnel`](./ai-funnel.md)

---

## 🇮🇹 Italiano

### Cosa fa
Due cose facili da confondere: **esportare un report adesso** e **schedularne l'invio via email**.

**Export immediato** — `GET /api/export` con `format=csv | json | pdf` su un `brand_id` e un intervallo di date opzionale. Il percorso PDF passa da `jsPDF` e applica il branding white-label (colore del brand, logo, nome cliente), quindi l'artefatto può andare al cliente senza modifiche.

**Consegna schedulata** — il POST persiste una consegna ricorrente:

| Campo | Vincolo |
|---|---|
| `frequency` | `daily` \| `weekly` \| `monthly` |
| `recipients` | 1-20 indirizzi email validi |
| `label` | nome opzionale della schedulazione |

La riga salvata traccia `is_active`, `next_run_at`, `last_sent_at`, `last_error`, `send_count` — così una schedulazione che sta fallendo in silenzio è diagnosticabile dalla riga, non dai log. `POST /api/cron/report-delivery` è il worker che percorre le schedulazioni scadute e invia.

Creare una schedulazione **persiste una riga e in seguito invia dati del brand a terzi via email**: per questo richiede ruolo editor e non viewer.

### Input
- `brand_id` (UUID), obbligatorio per export e schedulazioni.
- `format` — `csv` | `json` | `pdf`; qualsiasi altro valore è rifiutato (allowlist).
- Intervallo di date opzionale; un intervallo non valido è rifiutato, non allargato in silenzio.

### Output
- Export: stream del file nel formato richiesto.
- Schedulazioni: la riga persistita con i campi di tracciamento consegna.

### Dati generati
Legge `monitoring_results` per il payload. Scrive ed elimina `report_schedules`. Il worker aggiorna `last_sent_at` / `last_error` / `send_count`.

---

## 🇸🇪 Svenska

### Vad det gör
Två saker som är lätta att blanda ihop: **exportera en rapport nu**, och **schemalägga en som skickas med e-post senare**.

**Exportera nu** — `GET /api/export` med `format=csv | json | pdf` för ett `brand_id` och ett valfritt datumintervall. PDF-vägen renderas via `jsPDF` och applicerar white-label-branding (varumärkesfärg, logotyp, kundnamn), så artefakten kan gå till kund utan redigering.

**Schemalagd leverans** — POST sparar en återkommande leverans:

| Fält | Villkor |
|---|---|
| `frequency` | `daily` \| `weekly` \| `monthly` |
| `recipients` | 1-20 giltiga e-postadresser |
| `label` | valfritt namn på schemat |

Den sparade raden spårar `is_active`, `next_run_at`, `last_sent_at`, `last_error`, `send_count` — så ett schema som tyst misslyckas kan diagnostiseras från raden istället för från loggarna. `POST /api/cron/report-delivery` är arbetaren som går igenom förfallna scheman och skickar.

Att skapa ett schema **sparar en rad och skickar senare varumärkesdata till tredje part via e-post**, vilket är skälet till att det kräver editor-roll och inte viewer.

### Indata
- `brand_id` (UUID), obligatorisk.
- `format` — `csv` | `json` | `pdf`; andra värden avvisas.
- Valfritt datumintervall; ett ogiltigt intervall avvisas.

### Utdata
- Export: filström i begärt format.
- Scheman: den sparade raden med leveransbokföringen.

### Data
Läser `monitoring_results`. Skriver och tar bort `report_schedules`. Arbetaren uppdaterar `last_sent_at` / `last_error` / `send_count`.

---

## Limits & known issues
- **Recipients are not verified** — the schema validates email *format*, not ownership. Twenty addresses can be attached to a schedule that then emails brand data to all of them; the only gate is the editor role on the brand.
- **Failures are recorded, not surfaced** — `last_error` is stored on the row but nothing alerts on it. A schedule can fail every week and look healthy in the list until someone reads the field.
- **PDF is generated per request** — nothing is cached, so the same report regenerated after new monitoring data differs while keeping the same filename.
- **Export reads `monitoring_results` directly**, not `citation_snapshots`, so an exported CSV can disagree with an on-screen trend chart for the same period. That is the aggregation boundary described in [`snapshots`](./snapshots.md), not a bug in either surface.

## Cost
- Exports and schedule CRUD are DB reads/writes plus PDF rendering. Delivery costs whatever the email provider charges per send; no model calls.

## Data scope
- Date ranges are validated; `next_run_at` is stored UTC.
