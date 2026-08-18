# Brand Overview

| Field | Value |
|---|---|
| **Route** | `/dashboard/overview` |
| **API** | `GET /api/health-scores`, `GET /api/gsc`, `GET /api/keywords`, `GET /api/scraper`, `GET /api/ai-agent` |
| **Page** | [`src/app/dashboard/overview/page.tsx`](../../src/app/dashboard/overview/page.tsx) |
| **Sidebar step** | 3 · Insights (locked until `brands > 0`) |

---

## 🇬🇧 English

### What it does
The per-brand performance view, and **the only surface in the product that shows Google Search Console data**. That makes it the bridge between organic search and AI visibility: it is the one place where you can ask "is AI exposure driving branded search, or eating my own organic clicks?"

Two panels exist nowhere else in the product:
- **Striking Distance** ([`StrikingDistancePanel`](../../src/components/StrikingDistancePanel.tsx)) — queries ranking just below the fold, where a small content fix converts to traffic.
- **Cannibalization** ([`CannibalizationPanel`](../../src/components/CannibalizationPanel.tsx)) — multiple URLs competing for the same query, splitting authority.

Panels on the page, in render order: health-score table, GSC daily trend, visibility, keywords, scraper results, Striking Distance, Cannibalization, AI agents.

> Historical note kept deliberately: this page shipped complete and working with **zero inbound links from anywhere** — reachable only by typing the URL — until it was added to `NAV_SECTIONS`. It is not a duplicate of [`dashboard`](./dashboard.md) (which aggregates the insight surfaces) nor of `/dashboard/brands/[id]` (brand configuration and team). The three share no data sources.

### Input
- `brand_id` (UUID), required by every endpoint on the page.
- `period` — `7d` | `30d` | `60d` | `90d` (default `30d`) on `/api/gsc` and `/api/health-scores`.

### Output
| Panel | Endpoint | Reads |
|---|---|---|
| Health score table | `/api/health-scores` | `brand_health_scores` |
| GSC daily trend | `/api/gsc` | `gsc_performance` |
| Keywords | `/api/keywords` | `keyword_tracking`, `keyword_research` |
| Scraper results | `/api/scraper` | `monitoring_results` |
| AI agents | `/api/ai-agent` | agent registry + memory, no tenant table |

### Data signals
Read-only for the metric panels. `/api/ai-agent` can write agent memory when an agent run is triggered from the panel.

### Links
- GSC ingestion is a prerequisite: without a connected property `gsc_performance` is empty and the trend, Striking Distance and Cannibalization panels all render empty.
- Composite scoring: [`geo-score`](./geo-score.md)

---

## 🇮🇹 Italiano

### Cosa fa
La vista di performance per singolo brand, e **l'unica superficie del prodotto che mostra i dati Google Search Console**. È quindi il ponte fra ricerca organica e visibilità AI: è il solo posto dove si può chiedere "l'esposizione AI sta generando ricerche brandizzate, o mi sta mangiando i click organici?"

Due pannelli non esistono in nessun'altra parte del prodotto:
- **Striking Distance** — query posizionate appena sotto la soglia di visibilità, dove una piccola correzione di contenuto si converte in traffico.
- **Cannibalization** — più URL in competizione per la stessa query, che si dividono l'autorevolezza.

Pannelli in ordine di rendering: tabella health score, trend giornaliero GSC, visibilità, parole chiave, risultati scraper, Striking Distance, Cannibalization, agenti AI.

> Nota storica mantenuta di proposito: questa pagina è arrivata completa e funzionante con **zero link in ingresso** — raggiungibile solo digitando l'URL — finché non è stata aggiunta a `NAV_SECTIONS`. Non duplica [`dashboard`](./dashboard.md) né `/dashboard/brands/[id]`: le tre non condividono alcuna fonte dati.

### Input
- `brand_id` (UUID), obbligatorio su ogni endpoint.
- `period` — `7d` | `30d` | `60d` | `90d` (default `30d`) su `/api/gsc` e `/api/health-scores`.

### Output
Stessa tabella pannello → endpoint della versione EN.

### Dati generati
Sola lettura per i pannelli metrici. `/api/ai-agent` può scrivere la memoria agente quando un'esecuzione viene lanciata dal pannello.

---

## 🇸🇪 Svenska

### Vad det gör
Prestandavyn per varumärke, och **den enda ytan i produkten som visar Google Search Console-data**. Därmed är den bryggan mellan organisk sökning och AI-synlighet: det är enda stället där man kan fråga "driver AI-exponeringen varumärkessökningar, eller äter den mina egna organiska klick?"

Två paneler finns ingen annanstans i produkten:
- **Striking Distance** — sökfrågor som rankar strax under synlighetsgränsen, där en liten innehållsfix ger trafik.
- **Cannibalization** — flera URL:er som konkurrerar om samma sökfråga och delar auktoriteten.

Paneler i renderingsordning: hälsopoängtabell, GSC-dagstrend, synlighet, nyckelord, scraper-resultat, Striking Distance, Cannibalization, AI-agenter.

> Historisk not: sidan levererades komplett och fungerande med **noll ingående länkar** — nåbar endast genom att skriva URL:en — innan den lades till i `NAV_SECTIONS`.

### Indata
- `brand_id` (UUID), obligatorisk för samtliga endpoints.
- `period` — `7d` | `30d` | `60d` | `90d` (standard `30d`).

### Utdata
Samma panel → endpoint-tabell som EN-versionen.

### Data
Endast läsning för mätpanelerna. `/api/ai-agent` kan skriva agentminne när en körning startas från panelen.

---

## Limits & known issues
- **GSC data is the hard dependency** — `gsc_performance` is populated by the Search Console sync, not by monitoring. A brand with monitoring data but no connected GSC property renders three empty panels with no explanation that the cause is a missing integration.
- **`period` is not applied uniformly** — `/api/keywords` and `/api/scraper` do not take the period parameter, so those panels always show their own default window while the GSC trend respects the selector. Comparing across panels on this page is not apples-to-apples.
- **Locked, not hidden** — the sidebar entry is present but locked when the account has zero brands (`lockedUntil: (s) => s.brands === 0`).

## Cost
- All metric panels are DB reads. Triggering an agent run from the AI agents panel calls a billed model.

## Data scope
- `brand_id` access is verified server-side per endpoint (`verifyBrandAccess`), so a brand the caller cannot reach returns an authorisation error rather than empty data.
