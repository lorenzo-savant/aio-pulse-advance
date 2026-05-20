# Keyword Tracking

| Field | Value |
|---|---|
| **Route** | `/dashboard/keywords` |
| **API** | `GET /api/keywords?brand_id=...` |
| **Services** | [`keyword-tracker.ts`](../../src/lib/services/keyword-tracker.ts), [`keyword-clustering.ts`](../../src/lib/services/keyword-clustering.ts) |
| **Sidebar step** | 3 · Insights |

---

## 🇬🇧 English

### What it does
Extracts vocabulary from `monitoring_results.response_text` across all engines, applies multi-language stemming (en/it/sv) + 200+ stopwords, detects bigram phrases ("social media"), and assigns each keyword to one of 3 clusters: **Brand Identity / Product / Market Context**. For each keyword the correlation between its presence and brand mention is computed: `P(kw|mentioned) - P(kw|not_mentioned)`, range -1..1.

### Input
- `brand_id` (UUID, required) — auto-derived from logged-in user's selected brand.

### Output
```ts
{
  keywords: [{
    keyword: string,
    mention_count: number,
    correlation_score: -1..1,   // 'High' if > 0.6, 'Medium' if > 0.3, 'Low' if > 0
    engines: string[],          // engines that mentioned it
    cluster: 'identity'|'product'|'market'|null,
    first_seen: ISO timestamp,
    last_seen: ISO timestamp
  }],
  counts: { identity: N, product: N, market: N }
}
```

### Pipeline (`trackKeywords`)
1. Pull last 500 `monitoring_results` rows for brand
2. Tokenize each `response_text` with language-aware stemmer (`stemSwedish` / `stemItalian` / `stemEnglish`)
3. Apply stopword filter (Swedish 100+, Italian 80+, English 60+)
4. Detect bigrams (co-occurring word pairs with cohesion ≥ 40% of rarer word's docs)
5. Compute correlation score per keyword
6. Filter by min-doc threshold (1/2/3 docs for sample size <10/<50/≥50)
7. Top 200 ranked by `totalOccurrences`
8. Classify clusters via `keyword-clustering.ts:classifyKeyword`:
   - Word-boundary match against brand name / aliases → `identity`
   - Word-boundary match against `brand.competitors` (or implicit competitor seed by industry) → `market`
   - Industry vocabulary set (casting / saas / ecommerce / local) → `product`
   - Geo dictionary (200+ cities) → `market`

### Cluster classifier rules (per industry)
| Industry | Vocab keywords | Implicit competitors |
|---|---|---|
| casting | actor, audition, regissör, skådespelare, talanger, role, audition, etc. | Stagepool, StarNow, Backstage, Spotlight, statist.se |
| saas | subscription, integration, api, pricing, dashboard, workflow, etc. | Notion, Airtable, Monday, Asana, ClickUp, Linear |
| ecommerce | product, cart, checkout, sku, catalog, fulfillment, etc. | Shopify, WooCommerce, BigCommerce, Wix, Squarespace, Amazon |
| local | booking, appointment, opening hours, walk-in, clinic, salon, etc. | Google Maps, Yelp, TripAdvisor, Facebook |

### Brand-lookalike exclusion
Brand names with known confusable look-alikes (e.g. "Acasting" / "Acast") are routed to `market`, never `identity`. See `BRAND_LOOKALIKES` table in `keyword-clustering.ts`.

---

## 🇮🇹 Italiano

### Cosa fa
Estrae il vocabolario da `monitoring_results.response_text` su tutti gli engine, applica stemming multi-lingua (en/it/sv) + 200+ stopwords, rileva frasi bigramma ("social media"), e assegna ogni keyword a uno di 3 cluster: **Brand Identity / Product / Market Context**. Per ogni keyword viene calcolata la correlazione fra la sua presenza e la menzione del brand.

### Input
- `brand_id` (UUID, obbligatorio).

### Output
Stesso shape EN.

### Pipeline (`trackKeywords`)
Identica a EN: pull 500 row → tokenize stemmed → stopwords → bigram detect → correlation → threshold per docs → top 200 → classify cluster con regole regex word-boundary.

### Regole classifier per industry
Tabella identica EN (casting / saas / ecommerce / local).

### Esclusione lookalike brand
Nomi brand con look-alike noti (es. "Acasting" / "Acast") finiscono in `market`, mai `identity`.

---

## 🇸🇪 Svenska

### Vad det gör
Extraherar vokabulär från `monitoring_results.response_text` över alla motorer, tillämpar flerspråkig stemming (en/it/sv) + 200+ stoppord, upptäcker bigramfraser, och tilldelar varje nyckelord till ett av 3 kluster: **Varumärkesidentitet / Produkt / Marknadskontext**. För varje nyckelord beräknas korrelationen mellan dess förekomst och varumärkesomnämning.

### Indata
- `brand_id` (UUID, obligatorisk).

### Utdata
Samma form som EN.

### Pipeline (`trackKeywords`)
Identisk med EN: hämta 500 rader → tokenisera med stemmer → stoppord → bigramdetektering → korrelation → tröskel per docs → topp 200 → klassificera kluster med ord-gräns regex.

### Klassificerarregler per bransch
Identisk tabell EN.

### Varumärkes-likhet-uteslutning
Varumärkesnamn med kända förväxlingsbara namn (t.ex. "Acasting" / "Acast") hamnar i `market`, aldrig `identity`.

---

## Limits & known issues
- **No real lemmatization** — uses suffix-stripping heuristics, NOT Snowball/proper lemmatizer. Conservative on purpose to avoid producing nonsense roots in the UI.
- **`brand.industry` free-text matching** — `verticalFor` does regex-pattern matching on the industry string. A brand with industry "Software" → SaaS preset; "SaaS B2B Martech" → SaaS preset. Unmatched industry → falls back to language-only classification.
- **Min 3 docs for stable correlation** — keywords appearing in fewer than 3 responses (for ≥50 sample) are filtered.

## Cost
- Pure DB read. No external API. Computation is in-process O(n × m) where n = rows and m = avg words per row.

## Data scope
- Tutti i timestamp UTC.
- `correlation_score` Float -1..1.
- `mention_count` Integer.
