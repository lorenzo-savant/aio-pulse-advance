# Recommendations

| Field | Value |
|---|---|
| **Route** | `/dashboard/recommendations` |
| **API** | `GET/POST /api/recommendations`, `GET /api/reviews/weekly` |
| **Service** | [`prompt-generator-ai.ts`](../../src/lib/services/prompt-generator-ai.ts), [`glossary.ts`](../../src/lib/data/glossary.ts), [`research.ts`](../../src/lib/data/research.ts) |
| **Sidebar step** | 4 · Optimize |

---

## 🇬🇧 English

### What it does
The **persistent action list**. Where [`strategy-advisor`](./strategy-advisor.md) synthesises live brand data into a ranked narrative on demand, this surface is where generated actions are stored, revisited, and tracked over time.

`POST /api/recommendations` generates a new set. The prompt is grounded in three inputs, which is what keeps output from drifting into generic SEO advice:
1. **Live brand data** — `monitoring_results` and `keyword_tracking` for the brand.
2. **Glossary context** — `buildGlossaryContext()` injects the product's own definitions (AVI, citation rate, GEO pillars) so the model reasons in the same vocabulary the dashboard uses.
3. **Research context** — [`research.ts`](../../src/lib/data/research.ts) supplies the domain findings the recommendation rules are derived from.

Each generated recommendation carries a `priority` of `high` | `medium` | `low` and is inserted into `recommendation_history`, so the list is auditable: what was recommended, when, and against which data.

`GET /api/reviews/weekly` reads `weekly_reviews` joined with `recommendation_history` — the weekly retrospective of what was recommended versus what moved.

### Input
- `brand_id` (UUID), required.
- `POST` — triggers generation; the model call is the billed part of this page.

### Output
```ts
// GET /api/recommendations
{ recommendations: [{
    id: string,
    title: string,
    priority: 'high' | 'medium' | 'low',
    rationale: string,
    actions: string[],
    created_at: string
}] }
// GET /api/reviews/weekly
{ reviews: [{ week_start: string, recommendations: [...], outcome: ... }] }
```

### Data signals
Reads `monitoring_results`, `keyword_tracking`. Writes `recommendation_history` on POST. `weekly_reviews` is written by the weekly review job, not by this page.

### Links
- On-demand strategic narrative instead: [`strategy-advisor`](./strategy-advisor.md)
- The measurement side of the loop: [`geo-score`](./geo-score.md)

---

## 🇮🇹 Italiano

### Cosa fa
La **lista azioni persistente**. Dove [`strategy-advisor`](./strategy-advisor.md) sintetizza i dati live in una narrativa ordinata su richiesta, questa superficie è dove le azioni generate vengono salvate, riprese e tracciate nel tempo.

Il POST genera un nuovo set. Il prompt è ancorato a tre input, ed è questo che evita che l'output derivi verso consigli SEO generici:
1. **Dati live del brand** — `monitoring_results` e `keyword_tracking`.
2. **Contesto glossario** — inietta le definizioni del prodotto (AVI, citation rate, pilastri GEO) così il modello ragiona nello stesso vocabolario della dashboard.
3. **Contesto research** — i risultati di dominio da cui derivano le regole di raccomandazione.

Ogni raccomandazione porta una `priority` `high` | `medium` | `low` e viene inserita in `recommendation_history`, quindi la lista è verificabile: cosa è stato raccomandato, quando, e su quali dati.

`GET /api/reviews/weekly` legge `weekly_reviews` unito a `recommendation_history` — la retrospettiva settimanale fra ciò che è stato raccomandato e ciò che si è mosso.

### Input
- `brand_id` (UUID), obbligatorio.
- `POST` — innesca la generazione; la chiamata al modello è la parte a pagamento.

### Output
Stessa shape della versione EN.

### Dati generati
Legge `monitoring_results`, `keyword_tracking`. Scrive `recommendation_history` sul POST. `weekly_reviews` è scritto dal job settimanale, non da questa pagina.

---

## 🇸🇪 Svenska

### Vad det gör
Den **bestående åtgärdslistan**. Där [`strategy-advisor`](./strategy-advisor.md) syntetiserar levande varumärkesdata till en rangordnad berättelse på begäran, är den här ytan där genererade åtgärder lagras, återbesöks och följs över tid.

POST genererar en ny uppsättning. Prompten är grundad i tre indata, vilket är vad som hindrar utdata från att glida mot generiska SEO-råd:
1. **Levande varumärkesdata** — `monitoring_results` och `keyword_tracking`.
2. **Ordlistekontext** — injicerar produktens egna definitioner (AVI, citeringsgrad, GEO-pelare) så modellen resonerar i samma vokabulär som instrumentpanelen.
3. **Forskningskontext** — de domänfynd som rekommendationsreglerna härleds från.

Varje rekommendation bär en `priority` `high` | `medium` | `low` och skrivs in i `recommendation_history`, så listan är granskningsbar: vad rekommenderades, när, och mot vilka data.

`GET /api/reviews/weekly` läser `weekly_reviews` sammanfogat med `recommendation_history`.

### Indata
- `brand_id` (UUID), obligatorisk.
- `POST` — utlöser generering; modellanropet är den debiterade delen.

### Utdata
Samma form som EN-versionen.

### Data
Läser `monitoring_results`, `keyword_tracking`. Skriver `recommendation_history` vid POST.

---

## Limits & known issues
- **`priority` is model-assigned, not rule-derived** — the three levels come out of the LLM response, so two generations over the same data can rank the same action differently. Treat priority as guidance, never as a stable sort key across generations.
- **No deduplication across generations** — pressing generate twice inserts two overlapping sets into `recommendation_history`. Nothing merges or supersedes; the list grows.
- **Uplift estimates are model output** — where a recommendation states an expected point gain, that figure is generated, not computed from the [`geo-score`](./geo-score.md) weights. It must never be presented to a client as a guarantee.
- **Weekly reviews need the weekly job** — with the job not running, `weekly_reviews` stays empty and the retrospective panel renders empty with no indication that the cause is a missing job rather than missing progress.

## Cost
- `GET` is a DB read. Each `POST` is one billed model call with a large grounded prompt (brand data + glossary + research context), so it is one of the more expensive single actions in the product.

## Data scope
- `recommendation_history` rows are brand-scoped and keep `created_at` so a recommendation can always be traced back to the data window it was generated from.
