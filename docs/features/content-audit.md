# Content Audit

| Field | Value |
|---|---|
| **Route** | `/dashboard/audit` |
| **API** | `GET/POST /api/analyze`, `POST /api/audit/technical` |
| **Service** | [`analysis.ts`](../../src/lib/services/analysis.ts), [`technical-seo-audit.ts`](../../src/lib/services/technical-seo-audit.ts) |
| **Sidebar step** | 4 · Optimize |

---

## 🇬🇧 English

### What it does
A **comprehensive AEO/GEO audit of any single URL** — "analyze any URL for AI search engine readiness". Two independent audits run against the same address:

1. **AEO/GEO content analysis** (`POST /api/analyze`) — how citable the content is for AI engines. Persisted to `analysis_results`, which is why the run also shows up in [`scan-history`](./scan-history.md).
2. **Technical audit** (`POST /api/audit/technical`) — deterministic HTTP + HTML checks via [`technical-seo-audit.ts`](../../src/lib/services/technical-seo-audit.ts), persisted to `seo_audit_results`.

The technical audit's checks, grouped:

| Group | Checks |
|---|---|
| Transport | HTTPS, mixed content, response size, Time to First Byte |
| Indexing | Title tag present, title length, meta description present, meta description length, meta robots, canonical URL, hreflang |
| Core Web Vitals | Largest Contentful Paint, Cumulative Layout Shift, Interaction to Next Paint |
| AI citability | Heading structure present, content length, comparison-table extractability, last-updated signal, Open Graph |

"Comparison table extractability" and "last updated" are the two checks that exist specifically for AI engines rather than for classic SEO: engines lift comparison tables verbatim, and they down-weight content with no freshness signal.

The page accepts a `?url=` search parameter, so an audit can be linked to directly from another surface.

### Input
- `url` — the address to audit; also readable from the `?url=` query parameter.
- `POST /api/analyze` body — `input`, `mode` (`text` | `url`), `engine`, `provider`, `model`, optional `brandContext`.

### Output
```ts
// POST /api/analyze
{ score: number, signals: [...], recommendations: [...], input_mode: 'text'|'url' }
// POST /api/audit/technical
{ overall: number, categories: [{ category: string, checks: [{ name, passed, value }] }] }
```

### Data signals
Writes `analysis_results` (content analysis) and `seo_audit_results` (technical audit). Both are keyed to the audited URL, not to a brand, so audits of a non-brand page are valid and stored.

### Links
- Drill-down editing of the same signals: [`content-optimizer`](./content-optimizer.md)
- Brand-scoped consolidated version: [`site-audit`](./site-audit.md)
- Feeds the ranked action list: [`strategy-advisor`](./strategy-advisor.md)

---

## 🇮🇹 Italiano

### Cosa fa
Un **audit AEO/GEO completo di un singolo URL** — "analizza qualsiasi URL per la prontezza sui motori di ricerca AI". Due audit indipendenti girano sullo stesso indirizzo:

1. **Analisi contenuto AEO/GEO** — quanto il contenuto è citabile dai motori AI. Persistita in `analysis_results`, ed è per questo che l'esecuzione appare anche in [`scan-history`](./scan-history.md).
2. **Audit tecnico** — controlli HTTP + HTML deterministici, persistiti in `seo_audit_results`.

I controlli dell'audit tecnico, raggruppati:

| Gruppo | Controlli |
|---|---|
| Trasporto | HTTPS, contenuto misto, dimensione risposta, Time to First Byte |
| Indicizzazione | Title presente, lunghezza title, meta description presente, lunghezza meta description, meta robots, canonical, hreflang |
| Core Web Vitals | Largest Contentful Paint, Cumulative Layout Shift, Interaction to Next Paint |
| Citabilità AI | Struttura heading, lunghezza contenuto, estraibilità tabelle di confronto, segnale ultimo aggiornamento, Open Graph |

"Estraibilità tabelle di confronto" e "ultimo aggiornamento" sono i due controlli che esistono specificamente per i motori AI e non per la SEO classica: i motori riprendono le tabelle di confronto testualmente, e penalizzano contenuti senza segnale di freschezza.

La pagina accetta un parametro `?url=`, quindi un audit può essere linkato direttamente da un'altra superficie.

### Input
- `url` — l'indirizzo da analizzare; leggibile anche da `?url=`.
- Body del POST analyze — `input`, `mode` (`text` | `url`), `engine`, `provider`, `model`, `brandContext` opzionale.

### Output
Stessa shape della versione EN.

### Dati generati
Scrive `analysis_results` e `seo_audit_results`. Entrambi sono legati all'URL analizzato, non a un brand: analizzare una pagina non-brand è valido e viene salvato.

---

## 🇸🇪 Svenska

### Vad det gör
En **fullständig AEO/GEO-granskning av en enskild URL** — "granska vilken URL som helst för beredskap mot AI-sökmotorer". Två oberoende granskningar körs mot samma adress:

1. **AEO/GEO-innehållsanalys** — hur citerbart innehållet är för AI-motorer. Sparas i `analysis_results`, vilket är skälet till att körningen även syns i [`scan-history`](./scan-history.md).
2. **Teknisk granskning** — deterministiska HTTP- och HTML-kontroller, sparade i `seo_audit_results`.

Den tekniska granskningens kontroller, grupperade:

| Grupp | Kontroller |
|---|---|
| Transport | HTTPS, blandat innehåll, svarsstorlek, Time to First Byte |
| Indexering | Titel finns, titellängd, meta description finns, dess längd, meta robots, canonical, hreflang |
| Core Web Vitals | Largest Contentful Paint, Cumulative Layout Shift, Interaction to Next Paint |
| AI-citerbarhet | Rubrikstruktur, innehållslängd, extraherbarhet för jämförelsetabeller, färskhetssignal, Open Graph |

"Extraherbarhet för jämförelsetabeller" och "senast uppdaterad" är de två kontroller som finns specifikt för AI-motorer och inte för klassisk SEO: motorerna lyfter jämförelsetabeller ordagrant, och de nedviktar innehåll utan färskhetssignal.

Sidan tar emot en `?url=`-parameter, så en granskning kan länkas direkt från en annan yta.

### Indata
- `url` — adressen att granska; läses även från `?url=`.
- POST-body — `input`, `mode` (`text` | `url`), `engine`, `provider`, `model`, valfri `brandContext`.

### Utdata
Samma form som EN-versionen.

### Data
Skriver `analysis_results` och `seo_audit_results`, nycklade på granskad URL, inte på varumärke.

---

## Limits & known issues
- **Two audits, one page, no combined score** — the content analysis and the technical audit each produce their own number and nothing reconciles them. An operator can see 82 in one panel and 45 in the other with no guidance on which to act on first.
- **Core Web Vitals are measured, not field data** — the checks run against a single fetch from the server, so they are lab-style measurements. They will not match CrUX field data a client may quote.
- **URL-keyed, not brand-keyed** — audits are not attached to a brand, so there is no per-brand audit history on this page. The brand-scoped view is [`site-audit`](./site-audit.md).
- **Each run fetches the target site** — repeated audits hit the customer's server; there is no result cache on the technical path.

## Cost
- Technical audit: outbound HTTP only, free. Content analysis: one billed model call per run, with provider/model chosen in the UI.

## Data scope
- Scores are `0-100`. `analysis_results` stores `input_mode` so text and URL runs remain distinguishable.
