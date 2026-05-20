# GEO Score

| Field | Value |
|---|---|
| **Route** | `/dashboard/geo-score` |
| **API** | `GET /api/geo-score?brand_id=...` |
| **Service** | [`src/lib/services/geo-score.ts`](../../src/lib/services/geo-score.ts) |
| **Sidebar step** | 3 · Insights |

---

## 🇬🇧 English

### What it does
Renders a 0-100 composite **Generative Engine Optimization score** with letter grade (A/B/C/D/F) for the selected brand, plus a 5-pillar breakdown showing how the score was derived. Also surfaces the cached static site audit and a trend chart of the score over time.

### Input
- `brand_id` (UUID), required.
- `period` query — `7d` | `30d` | `60d` | `90d` (default 30d) — controls the comparison baseline shown in the "vs Nd ago" delta.

### Output
```ts
{
  score: 0..100,
  grade: 'A'|'B'|'C'|'D'|'F',
  delta: number,            // vs comparison period
  previousScore: number,
  hasData: boolean,
  pillars: [{               // 5 weighted components
    name: 'Citation'|'Presence'|'Authority'|'Position'|'Trust',
    value: 0..100,
    weight: 0..1,
    contribution: number    // value × weight
  }],
  siteAudit: { score, grade, url } | null,
  trend: [{ date: string, score: number }]
}
```

### Pillars (composite weights)
| Pillar | Weight | Reads from |
|---|---|---|
| Citation | 30% | `brand_health_scores.citation_rate` |
| Presence | 25% | `mention_rate` |
| Authority | 20% | `recommendation_rate` |
| Position | 15% | `1 - (position_avg / 100)` (lower position = better) |
| Trust | 10% | sentiment score normalized 0-100 |

### Links
- Card UI lives in [`/dashboard/geo-score/page.tsx`](../../src/app/dashboard/geo-score/page.tsx)
- Companion data: [site-audit-summary.ts](../../src/lib/services/site-audit-summary.ts) loads the cached static readiness audit

---

## 🇮🇹 Italiano

### Cosa fa
Mostra un **punteggio GEO composito 0-100** con voto in lettera (A/B/C/D/F) per il brand selezionato, più la scomposizione in 5 pilastri pesati che mostra come è stato derivato. Include anche il site audit statico cached e un grafico trend del punteggio nel tempo.

### Input
- `brand_id` (UUID), obbligatorio.
- `period` query — `7d` | `30d` | `60d` | `90d` (default 30d) — controlla il baseline di confronto mostrato nel delta "vs Ngg fa".

### Output
Stessa shape della versione EN.

### Pilastri (pesi compositi)
| Pilastro | Peso | Legge da |
|---|---|---|
| Citation (Citazioni) | 30% | `brand_health_scores.citation_rate` |
| Presence (Presenza) | 25% | `mention_rate` |
| Authority (Autorevolezza) | 20% | `recommendation_rate` |
| Position (Posizione) | 15% | `1 - (position_avg / 100)` (più basso = meglio) |
| Trust (Fiducia) | 10% | sentiment normalizzato 0-100 |

---

## 🇸🇪 Svenska

### Vad det gör
Återger en **kompositpoäng GEO 0-100** med bokstavsbetyg (A/B/C/D/F) för det valda varumärket, plus en uppdelning i 5 viktade pelare som visar hur poängen härleddes. Visar även cachad statisk sajtgranskning och en trendgraf av poängen över tid.

### Indata
- `brand_id` (UUID), obligatorisk.
- `period` query — `7d` | `30d` | `60d` | `90d` (standard 30d).

### Utdata
Samma form som EN-versionen.

### Pelare (kompositvikter)
| Pelare | Vikt | Läser från |
|---|---|---|
| Citation (Citering) | 30% | `brand_health_scores.citation_rate` |
| Presence (Närvaro) | 25% | `mention_rate` |
| Authority (Auktoritet) | 20% | `recommendation_rate` |
| Position | 15% | `1 - (position_avg / 100)` |
| Trust (Förtroende) | 10% | sentiment normaliserat 0-100 |

---

## Limits & known issues
- **Requires monitoring data** — pillars all read from `brand_health_scores`. Brand with zero monitoring runs returns `hasData: false` and an explanatory empty state.
- **Weights are hardcoded** — changing them requires editing `src/lib/services/geo-score.ts:GEO_WEIGHTS`. Not user-configurable per brand yet.
- **Trend chart depends on daily aggregation** — only one health score row per day is expected; the cron `/api/cron/monitoring` writes one row when it completes.

## Cost
- Pure DB read, no external API. ~10-50ms per page load.

## Data scope
- All values are **percentages 0-100** stored as `Float` in Postgres.
- Trend timestamps are stored UTC, rendered in the browser's locale.
