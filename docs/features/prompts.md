# Prompts

| Field | Value |
|---|---|
| **Route** | `/dashboard/prompts` |
| **API** | `GET/POST /api/prompts`, `POST /api/prompts/seed` |
| **Sidebar step** | 1 · Setup |

---

## 🇬🇧 English

### What it does
Manages the list of questions that monitoring will send to AI engines for a given brand. Each prompt has a category, language, and the set of engines it should hit. "Run" on a prompt dispatches it via `/api/monitoring`, which generates the `monitoring_results` rows downstream features read.

### Input — POST body
```ts
{
  brand_id: UUID,
  text: string,                          // the actual prompt
  language: 'en'|'it'|'sv',
  market?: string,                       // default 'global'
  category?: string,                     // free-text bucket label
  engines?: ('chatgpt'|'gemini'|'perplexity'|'claude')[],
                                         // default all 4
  is_active?: boolean,                   // default true
  run_frequency?: 'daily'|'weekly'|'monthly'
                                         // default daily
}
```

### Output
```ts
{
  id, brand_id, user_id, text,
  language, market, category,
  engines: string[],                     // 4 by default since v2.2.0
  is_active, run_frequency,
  last_run_at: timestamptz | null,
  createdAt, updatedAt, deletedAt
}
```

### Default engines = 4 (since v2.2.0)
Previously the Prisma default for `engines[]` was `['chatgpt','gemini','perplexity']` (3 engines, Claude missing). Migration `20260520090000_prompts_engines_include_claude.sql` updated the default + backfilled rows that had exactly the 3-engine legacy default.

### Links
- Seed endpoint: `/api/prompts/seed` — bulk insert prompts from `prompt-library.ts` templates
- Run dispatcher: `/api/monitoring` consumes the prompt + dispatches per engine
- Prompt generator: `/api/prompts/generate-from-industry` produces ready-to-insert prompts from industry presets

---

## 🇮🇹 Italiano

### Cosa fa
Gestisce la lista di domande che il monitoring invierà agli engine AI per un dato brand. Ogni prompt ha categoria, lingua, set di engine da colpire. "Run" su un prompt lo invia via `/api/monitoring`, che genera le righe `monitoring_results` lette dalle feature downstream.

### Input + Output
Identici a EN.

### Engine di default = 4 (dalla v2.2.0)
Prima il default Prisma per `engines[]` era 3 (Claude mancava). La migration `20260520090000` ha aggiornato il default e backfillato le righe legacy.

### Link
- Endpoint seed: `/api/prompts/seed` — bulk insert da template `prompt-library.ts`
- Run dispatcher: `/api/monitoring`
- Prompt generator: `/api/prompts/generate-from-industry`

---

## 🇸🇪 Svenska

### Vad det gör
Hanterar listan med frågor som övervakningen skickar till AI-motorer för ett givet varumärke. Varje prompt har kategori, språk, och uppsättningen motorer den ska träffa. "Run" på en prompt skickar den via `/api/monitoring`, som genererar `monitoring_results`-raderna som nedströms funktioner läser.

### Indata + Utdata
Identiska med EN.

### Standardmotorer = 4 (sedan v2.2.0)
Tidigare var Prisma-standarden för `engines[]` 3 motorer (Claude saknades). Migrationen `20260520090000` uppdaterade standarden och fyllde i de gamla raderna.

### Länkar
- Seed-endpoint: `/api/prompts/seed`
- Kör-dispatcher: `/api/monitoring`
- Prompt-generator: `/api/prompts/generate-from-industry`

---

## Limits & known issues
- **Soft delete via `deletedAt`** — rows aren't physically removed; downstream queries filter on `deletedAt IS NULL`.
- **No DB-level engine validation** — `engines[]` is a free-form text array. Application layer validates via zod.

## Cost
- Pure DB CRUD. Running a prompt costs ≈ N engines × LLM call (see monitoring.md).

## Data scope
- All timestamps UTC.
- `engines[]` Postgres text[].
