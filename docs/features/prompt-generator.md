# Prompt Generator

| Field | Value |
|---|---|
| **Route** | `/dashboard/tools/prompt-generator` |
| **API** | `GET /api/industries`, `POST /api/prompts/generate-from-industry` |
| **Service** | [`src/lib/services/prompt-generator.ts`](../../src/lib/services/prompt-generator.ts) |
| **Sidebar step** | Tools |

---

## 🇬🇧 English

### What it does
Expands a brand name + (optional) location into 20-30 concrete monitoring prompts using one of 10 industry presets (casting, SaaS B2B, e-commerce, local business, …). Each preset has localized templates per intent bucket (B1-B5) with `{brand}`, `{competitor}`, `{category}`, `{role}`, `{location}`, `{year}` placeholders that get expanded combinatorially.

### Intent buckets
| Bucket | Label | Pattern |
|---|---|---|
| B1 | Brand & Competitor | `{brand} review`, `{brand} vs {competitor}` |
| B2 | Category Creation | `best {category}`, `{category} for {role}` |
| B3 | Problem / JTBD | `how to {action}`, `where can I find {role}` |
| B4 | Buyer Intent (B2B) | `{category} pricing`, `{brand} alternative` |
| B5 | Compliance & Risk | `{category} regulations`, `is {brand} legitimate` |

### Input — POST body
```ts
{
  brand: string,
  industryId: string,           // 'casting-talent' | 'saas-b2b' | ...
  locale: 'en' | 'it' | 'sv',
  location?: string             // e.g. 'Stockholm'
}
```

### Output
```ts
{
  success: true,
  data: [{
    query: string,              // expanded prompt text
    intentBucket: 'B1'|'B2'|'B3'|'B4'|'B5',
    priority: 'high'|'medium'|'low',
    expectedOutput: string,     // what good answer looks like
    targetLlms: string[],       // e.g. ['chatgpt','perplexity']
    suggestedFrequency: 'daily'|'weekly'|'monthly',
    systemPrompt: string        // pre-translated system prompt
  }],
  total: number
}
```

### Pipeline
1. `getIndustryPreset(industryId)` loads the preset (TS constant, no DB).
2. `expandKeywords(brand, industryId, locale, location?)` walks every `intentPatterns[]` template, substitutes placeholders with `{brand}`, `{location}`, `{year}`, every `competitor`, every `category`, every `role` from the preset.
3. Adds `localizedTemplates[locale]` patterns (locale-specific phrasing) on top.
4. Returns flat list of `ExpandedQuery` rows.

### Links
- 10 industry presets: see `INDUSTRY_PRESETS` constant in source.
- Strategy Advisor integration: when the brand's industry matches a preset, `buildPromptGeneratorContext` (in advisor.ts) calls `expandKeywords`, filters out already-monitored queries, and scores the rest by AEO gap + competitor signal.

---

## 🇮🇹 Italiano

### Cosa fa
Espande il nome del brand + (opzionale) location in 20-30 prompt concreti di monitoring usando uno dei 10 preset di settore (casting, SaaS B2B, e-commerce, local business, …). Ogni preset ha template localizzati per intent bucket (B1-B5) con segnaposto `{brand}`, `{competitor}`, `{category}`, `{role}`, `{location}`, `{year}` espansi combinatorialmente.

### Bucket di intent
| Bucket | Etichetta | Pattern |
|---|---|---|
| B1 | Brand e Competitor | `{brand} recensione`, `{brand} vs {competitor}` |
| B2 | Creazione di Categoria | `migliore {category}`, `{category} per {role}` |
| B3 | Problema / JTBD | `come {azione}`, `dove trovare {role}` |
| B4 | Intento di Acquisto | `{category} prezzi`, `{brand} alternativa` |
| B5 | Conformità e Rischi | `{category} normativa`, `{brand} è affidabile` |

### Input + Output + Pipeline + Link
Identici alla versione EN.

---

## 🇸🇪 Svenska

### Vad det gör
Expanderar ett varumärkesnamn + (valfri) plats till 20-30 konkreta övervakningsprompts med en av 10 branschförinställningar (casting, SaaS B2B, e-handel, lokal verksamhet, …). Varje förinställning har lokaliserade mallar per avsiktsbucket (B1-B5) med platshållarna `{brand}`, `{competitor}`, `{category}`, `{role}`, `{location}`, `{year}` som expanderas kombinatoriskt.

### Avsiktsbuckets
| Bucket | Etikett | Mönster |
|---|---|---|
| B1 | Varumärke & Konkurrent | `{brand} recension`, `{brand} vs {competitor}` |
| B2 | Kategoriskapande | `bästa {category}`, `{category} för {role}` |
| B3 | Problem / JTBD | `hur man {åtgärd}`, `var hittar man {role}` |
| B4 | Köpintention | `{category} priser`, `{brand} alternativ` |
| B5 | Regelefterlevnad och risk | `{category} föreskrifter`, `är {brand} legitimt` |

### Indata + Utdata + Pipeline + Länkar
Identiska med EN-versionen.

---

## Limits & known issues
- **No DB persistence yet** — presets are TypeScript constants. Customizing per client requires a code change. Promotion to a `industry_presets` table is a future feature.
- **No auth on `/api/industries` and `/api/prompts/generate-from-industry`** — stateless transformation, no tenant data exposed. The downstream save-to-prompts endpoint IS auth-protected.
- **Output multiplies fast** — 12 patterns × 5 competitors × 4 categories × 3 locations = 720 prompts. Most presets stay under 30 by limiting competitors and not using location.

## Cost
- Pure CPU. No external API.

## Data scope
- Tutti i preset versionati nel codice. Modifica → richiede rebuild + deploy.
