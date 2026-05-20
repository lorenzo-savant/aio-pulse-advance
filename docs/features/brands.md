# Brands

| Field | Value |
|---|---|
| **Route** | `/dashboard/brands`, `/dashboard/brands/[id]` |
| **API** | `GET/POST /api/brands`, `GET/PUT/DELETE /api/brands/[id]` |
| **Sidebar step** | 1 · Setup |

---

## 🇬🇧 English

### What it does
CRUD for the brands the user monitors. Each brand defines the entity that downstream features (prompts, monitoring, advisor, GEO score) operate on. Brand has identity (name, domain, aliases), market context (industry, competitors, language), and presentation (color, logo, white-label fields).

### Input
- POST/PUT: `{ name, domain?, aliases[], domains[], competitors[], industry?, language?, color? }`
- GET list: optional `?include_archived`

### Output
```ts
{
  id, user_id, workspaceId, organizationId,
  name, slug, description, domain,
  aliases: string[], domains: string[],
  competitors: string[],
  industry: string | null,
  language: 'en'|'it'|'sv',
  color, logoUrl, isActive,
  createdAt, updatedAt
}
```

### Key fields downstream
- `name` + `aliases` → brand-mention detection in monitoring + word-boundary classifier in keyword tracking
- `domain` → owned-vs-external citation share + Brave `site:` gap detection
- `competitors[]` → cluster classification + competitor mention tracking
- `industry` → industry preset lookup for prompt-generator + advisor recommendations
- `language` → default locale for prompt generation + stemming language for keyword tracking

---

## 🇮🇹 Italiano

### Cosa fa
CRUD per i brand monitorati. Ogni brand definisce l'entità su cui operano le feature downstream (prompts, monitoring, advisor, GEO score). Identità (nome, dominio, alias), contesto mercato (settore, competitor, lingua), e presentazione (colore, logo, white-label).

### Input + Output
Identici a EN.

### Campi chiave downstream
- `name` + `aliases` → detection brand-mention nel monitoring + classifier keyword
- `domain` → share citazioni own-vs-external + Brave `site:` gap detection
- `competitors[]` → classificazione cluster + tracking menzioni competitor
- `industry` → lookup preset settore per prompt-generator + raccomandazioni advisor
- `language` → locale default per generazione prompt + lingua stemming keyword

---

## 🇸🇪 Svenska

### Vad det gör
CRUD för de varumärken användaren övervakar. Varje varumärke definierar entiteten som nedströms funktioner (prompts, övervakning, advisor, GEO-poäng) opererar på. Identitet (namn, domän, alias), marknadskontext (bransch, konkurrenter, språk), och presentation (färg, logo, white-label).

### Indata + Utdata
Identiska med EN.

### Nyckelfält nedströms
- `name` + `aliases` → varumärkesomnämningsdetektering + nyckelordsklassificerare
- `domain` → ägd-mot-extern citationsandel + Brave `site:` gap-detektering
- `competitors[]` → klusterklassificering + konkurrentomnämningsspårning
- `industry` → branschförinställningssökning för prompt-generator + advisor-rekommendationer
- `language` → standardspråk för promptgenerering + stemming-språk för nyckelordsspårning

---

## Limits & known issues
- **One brand per slug per user** — uniqueness enforced at DB level.
- **Aliases are case-sensitive at match time** — case-insensitive matching is applied in `brand-enrichment` and `keyword-clustering`.
- **`language` field** — backed by `brands.language` column added in migration `20260413000100_add_brand_language.sql`.

## Cost
- Pure DB CRUD.

## Data scope
- All timestamps UTC.
- `industry` is free-text; matched via regex by feature consumers (prompt-generator, keyword-clustering).
