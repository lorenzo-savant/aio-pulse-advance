# Dashboard (aggregate)

| Field | Value |
|---|---|
| **Route** | `/dashboard` |
| **API** | `GET /api/brands`, `/api/geo-score`, `/api/citation-sources`, `/api/aeo-snippets`, `/api/keywords`, `/api/sentiment`, `/api/snapshots`, `/api/competitor` |
| **Page** | [`src/app/dashboard/page.tsx`](../../src/app/dashboard/page.tsx) |
| **Sidebar step** | Overview (standalone, above the numbered flow) |

---

## 🇬🇧 English

### What it does
The landing surface after login. It **aggregates one headline number from each Insights surface** into a single screen so an operator can see, in one glance, whether anything moved since yesterday — then click through to the surface that owns the detail.

It is deliberately **not** a data owner: every number on this page is fetched from the same endpoint the dedicated page uses. If a number here disagrees with its own page, the bug is in this page's aggregation, never in the source.

Distinct from the two neighbouring surfaces:
- [`brand-overview`](./brand-overview.md) (`/dashboard/overview`) — **per-brand** performance including Google Search Console data.
- `/dashboard/brands/[id]` — brand **configuration** and team, not metrics.

### Input
- No parameters. Brand selection is client state (defaults to the first brand returned by `GET /api/brands`).

### Output
Composed client-side; each card owns its own fetch and its own loading/empty state, so one failing endpoint degrades a single card instead of the page.

| Card | Source endpoint | Headline |
|---|---|---|
| GEO Score | `/api/geo-score` | 0-100 composite + letter grade + delta |
| Citation sources | `/api/citation-sources` | top cited domains, own-domain rank |
| Sentiment | `/api/sentiment` | positive / neutral / negative split |
| Keywords | `/api/keywords` | tracked keyword count + movers |
| AEO snippets | `/api/aeo-snippets` | snippet count ready for export |
| Snapshots | `/api/snapshots` | latest citation snapshot + trend |
| Competitor | `/api/competitor` | share-of-voice leader |

### Data signals
Writes nothing. Read-only composition over existing tables (`brand_health_scores`, `monitoring_results`, `citation_snapshots`, `keyword_tracking`).

### Links
- Sidebar model that defines the surrounding flow: [`NAV_SECTIONS`](../../src/components/layout/Sidebar.tsx)

---

## 🇮🇹 Italiano

### Cosa fa
La schermata di arrivo dopo il login. **Aggrega un numero di riferimento da ogni superficie di Analisi** in un'unica pagina, così l'operatore vede in un colpo d'occhio se qualcosa si è mosso rispetto a ieri, e da lì entra nella pagina che possiede il dettaglio.

Non è deliberatamente proprietaria di alcun dato: ogni numero qui viene dallo stesso endpoint che usa la pagina dedicata. Se un numero non coincide con la sua pagina, il bug è nell'aggregazione di questa pagina, mai nella fonte.

Da non confondere con le due superfici vicine:
- [`brand-overview`](./brand-overview.md) (`/dashboard/overview`) — performance **per singolo brand**, inclusi i dati Google Search Console.
- `/dashboard/brands/[id]` — **configurazione** del brand e team, non metriche.

### Input
- Nessun parametro. La selezione del brand è stato client (default: primo brand restituito da `GET /api/brands`).

### Output
Stessa tabella card → endpoint della versione EN. Ogni card ha fetch e stato di caricamento propri: un endpoint che fallisce degrada una card, non la pagina.

### Dati generati
Nessuna scrittura. Sola lettura su `brand_health_scores`, `monitoring_results`, `citation_snapshots`, `keyword_tracking`.

---

## 🇸🇪 Svenska

### Vad det gör
Landningsytan efter inloggning. Den **samlar ett nyckeltal från varje Insikter-yta** på en enda skärm, så att en operatör med en blick ser om något rört sig sedan i går — och därifrån klickar vidare till den yta som äger detaljen.

Sidan äger medvetet ingen data: varje tal hämtas från samma endpoint som den dedikerade sidan använder. Om ett tal avviker från sin egen sida ligger felet i den här sidans aggregering, aldrig i källan.

Skilj den från de två närliggande ytorna:
- [`brand-overview`](./brand-overview.md) (`/dashboard/overview`) — prestanda **per varumärke**, inklusive Google Search Console-data.
- `/dashboard/brands/[id]` — varumärkets **konfiguration** och team, inte mätvärden.

### Indata
- Inga parametrar. Varumärkesval är klienttillstånd (standard: första varumärket från `GET /api/brands`).

### Utdata
Samma kort → endpoint-tabell som EN-versionen. Varje kort har egen hämtning och eget laddningsläge.

### Data
Skriver inget. Endast läsning från `brand_health_scores`, `monitoring_results`, `citation_snapshots`, `keyword_tracking`.

---

## Limits & known issues
- **N+1 fetch pattern** — the page fires one request per card on mount. Fine for the current card count; adding cards keeps widening the fan-out rather than batching.
- **No cross-card consistency guarantee** — cards resolve independently, so during a monitoring run one card can reflect the new data while its neighbour still shows the previous value until refresh.
- **Empty until the first scan** — with zero monitoring runs every card renders its empty state; the sidebar locks most Insights entries in that state (`lockedUntil: (s) => !s.hasData`).

## Cost
- Pure DB reads across all cards. No external API calls, no credit consumption.

## Data scope
- Scoped to the brands the caller can reach; brand access is enforced per endpoint, not by this page.
