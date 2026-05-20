# Workflows

| Field | Value |
|---|---|
| **Route** | `/dashboard/workflows` |
| **API** | `GET /api/workflows`, `POST /api/workflows?action=rerun|cancel` |
| **Sidebar step** | 2 · Monitor |

---

## 🇬🇧 English

### What it does
Tracks every background job execution (monitoring runs, brand setup, alert evaluations, data exports, health-score calc) with status (`running` / `pending` / `completed` / `failed` / `retrying` / `cancelled`) + per-step progress + start/end timestamps. Lets the user rerun a `monitoring_run` workflow or cancel a still-running one.

### Input
- `GET ?brand_id=...&limit=50` — list workflows for a brand, or for the user when `brand_id` omitted.
- `POST ?id=...&action=rerun` — rerun a `monitoring_run` workflow (must have `prompt_id`).
- `POST ?id=...&action=cancel` — mark workflow + open steps as cancelled.
- `POST` with body `{ type, brandId, promptId, metadata }` — create a new workflow row (internal use).

### Output (GET)
```ts
{
  success: true,
  data: [{
    id, type, brandId, promptId, status,
    steps: [{ id, name, status, startedAt, completedAt, error }],
    startedAt, completedAt, error, metadata
  }]
}
```

### Workflow types
- `monitoring_run` — a prompt × engine[] run dispatched by /api/monitoring
- `brand_setup` — initial brand creation flow
- `alert_evaluation` — alert rule check cycle
- `data_export` — CSV/PDF report generation
- `health_score_calc` — daily aggregation

### Links
- API: [`/api/workflows/route.ts`](../../src/app/api/workflows/route.ts)
- Rerun delegates to `/api/monitoring` so the recreated row is fresh.

---

## 🇮🇹 Italiano

### Cosa fa
Traccia ogni esecuzione di job in background (run di monitoring, setup brand, valutazione alert, export dati, calcolo health score) con stato + progresso step-by-step + timestamp start/end. Permette di re-runnare un workflow `monitoring_run` o cancellare uno ancora in esecuzione.

### Input + Output + Tipi + Link
Identici a EN.

---

## 🇸🇪 Svenska

### Vad det gör
Spårar varje bakgrundsjobb (övervakningskörningar, varumärkesinställning, larmevaluering, dataexport, health-score-beräkning) med status + stegvis framsteg + start/slut-tidsstämplar. Tillåter användaren att köra om ett `monitoring_run`-arbetsflöde eller avbryta ett pågående.

### Indata + Utdata + Typer + Länkar
Identiska med EN.

---

## Limits & known issues
- **`brand_id` is optional** since the v2.2 fix — previously the page rendered empty for new users.
- **Rerun only works for `monitoring_run`** — other workflow types throw `400 Rerun is only supported for monitoring_run workflows`.
- **Empty state has a CTA** — when `workflows.length === 0` the UI shows "Go to Prompts" link, since workflows are CREATED by monitoring (not on this page).

## Cost
- Pure DB read/write. No external API.

## Data scope
- All timestamps UTC.
- `steps[]` JSONB column.
