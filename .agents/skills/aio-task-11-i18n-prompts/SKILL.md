# Task 11 — Prompt Library i18n (SV + IT primary, EN fallback)

Implementa la localizzazione dei 70 prompt template e il meccanismo di selezione lingua basato sul mercato del brand. Mercati target: **Sweden (sv), Italy (it), English (en fallback)**.

## CONTESTO

- `src/lib/prompt-library.ts` contiene 70 template con campo `text: string` (solo inglese)
- Ogni brand ha campi `industry`, `competitors`, `domain` — manca `language`
- L'engine di monitoring in `src/lib/services/ai-router.ts` → `simulateEngineResponse` manda prompt in inglese al motore AI senza istruirlo sulla lingua di risposta
- Mercati business primari: Svezia + Italia. Inglese serve solo come fallback / mercato generico

## COSA FARE

### 1. Schema — aggiungere `language` al brand

Crea `supabase/migrations/20260413_add_brand_language.sql`:

```sql
-- Add primary market language to brands (for localized prompt generation)
BEGIN;
ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en'
  CHECK (language IN ('en', 'it', 'sv'));
COMMIT;
```

Aggiorna anche `supabase/schema.sql` per riflettere la colonna sulla definizione `brands` (stesso default/check).

Aggiorna tipi TypeScript:
- `src/types/index.ts` → `Brand` interface: aggiungi `language: BrandLanguage` (tipo `'en' | 'it' | 'sv'`)
- `src/types/index.ts` → esporta `export type BrandLanguage = 'en' | 'it' | 'sv'`
- `src/types/database.ts` se ha tipi generati, aggiungi il campo

### 2. Refactor `PromptTemplate` — multi-lingua

In `src/lib/prompt-library.ts`:

```typescript
export type PromptLang = 'en' | 'it' | 'sv'

export interface PromptTemplate {
  id: string
  category: PromptCategory
  description: string
  texts: Record<PromptLang, string>
}
```

Traduci tutti e 70 i template. Parti dall'inglese esistente e scrivi le versioni `it` e `sv` in-place. Regole:
- Mantieni i placeholder `{brand}`, `{competitor}`, `{competitor2}`, `{location}`, `{category}`, `{use_case}` identici in tutte e 3 le lingue
- Traduci SEMANTICAMENTE, non letteralmente — la domanda deve suonare naturale a un madrelingua
- "near me" in SV → "i närheten" / in IT → "vicino a me"
- "best" → SV "bäst" / IT "migliore"
- Se un prompt non ha senso in un mercato (esempio: "Black Friday" → in IT/SV meno popolare), mantieni comunque la traduzione letterale, non skippare

Crea una tabella con mapping per chiarezza:

| ID | EN | IT | SV |
|---|---|---|---|
| D01 | What is {brand}? | Cos'è {brand}? | Vad är {brand}? |
| D02 | Tell me about {brand} and what they do | Parlami di {brand} e di cosa fa | Berätta om {brand} och vad de gör |
| ... | ... | ... | ... |

(La tabella completa va nel file. Traduci tutti e 70.)

### 3. Aggiorna `hydratePrompt` con language-awareness

```typescript
export function hydratePrompt(
  template: PromptTemplate,
  language: PromptLang,
  params: HydrationParams,
): string {
  const raw = template.texts[language] ?? template.texts.en
  return raw
    .replace(/{brand}/g, params.brand || '')
    .replace(/{category}/g, params.category || '')
    .replace(/{competitor}/g, params.competitor || '')
    .replace(/{competitor2}/g, params.competitor2 || '')
    .replace(/{location}/g, params.location || '')
    .replace(/{use_case}/g, params.use_case || '')
}
```

Tutti i call-site di `hydratePrompt` dovranno passare la lingua — aggiorna i test e gli endpoint.

### 4. Seed endpoint — usa la lingua del brand

In `src/app/api/prompts/seed/route.ts`:
- Carica il brand da Supabase (già lo fa probabilmente)
- Leggi `brand.language` (default `'en'` se null)
- Hydrate ogni template con quella lingua prima di inserirlo nella tabella `prompts`
- Setta `prompts.language = brand.language` sulla riga inserita

### 5. Monitoring engine — istruzione "Respond in" nella persona

In `src/lib/services/ai-router.ts` → `simulateEngineResponse`:

```typescript
const LANGUAGE_LABEL: Record<PromptLang, string> = {
  en: 'English',
  it: 'Italian (Italiano)',
  sv: 'Swedish (Svenska)',
}

// Accetta language come 3° param con default 'en'
export async function simulateEngineResponse(
  promptText: string,
  engine: MonitoringEngine,
  language: PromptLang = 'en',
): Promise<{ text: string; provider: string }> {
  const enginePersona: Record<MonitoringEngine, string> = {
    chatgpt: `You are ChatGPT. Respond in ${LANGUAGE_LABEL[language]} naturally and fluently, as if answering a user from that market. Include relevant brands, products, and services that would be recognized locally.`,
    gemini: `You are Google Gemini. Respond in ${LANGUAGE_LABEL[language]} with well-structured, factual information. Include brands and services relevant to that language's market.`,
    perplexity: `You are Perplexity AI. Respond in ${LANGUAGE_LABEL[language]} with verified facts and local sources where possible.`,
    claude: `You are Claude. Respond in ${LANGUAGE_LABEL[language]} with nuanced analysis and locally relevant brands.`,
  }
  // resto invariato
}
```

Tutti i caller di `simulateEngineResponse` devono passare la lingua. Il monitoring runner (`runMonitoringCheck` in `src/lib/services/monitoring.ts`) deve leggere `brand.language` (o `prompt.language` se presente) e passarla.

### 6. UI — Guided Setup & Brand Edit: dropdown lingua

In `src/app/dashboard/onboarding/**` (guided setup step brand):
- Aggiungi dropdown `Primary Market Language` dopo `Industry`
- Options: `🇬🇧 English`, `🇮🇹 Italiano`, `🇸🇪 Svenska`
- Default: non pre-selezionare — forza scelta consapevole
- Infobox sotto: "I prompt e le simulazioni AI gireranno in questa lingua per riflettere come i tuoi clienti cercano davvero."

In `src/app/dashboard/brands/[id]/edit/page.tsx` (o il form di edit brand esistente):
- Stessa dropdown, editabile post-creation
- Warning se l'utente cambia lingua post-seed: "Questo non ri-genera i prompt già creati. Vuoi ri-seedarli nella nuova lingua?"

### 7. Badge lingua sul brand card + nudge banner

In `src/app/dashboard/brands/page.tsx` (lista brand):
- Mostra badge piccolo con bandiera + lingua accanto al nome: `🇮🇹 IT`, `🇸🇪 SV`, `🇬🇧 EN`

In `src/app/dashboard/brands/[id]/page.tsx` (brand detail):
- Se `brand.language === 'en'` E il brand è stato creato PRIMA di questa migration (heuristica: check `updated_at < '2026-04-13'`):
  - Mostra banner soft in cima: "📍 Imposta il mercato primario per questo brand — i dati saranno più accurati"
  - CTA: link al form di edit
- Non bloccare, solo nudge

### 8. Test

Aggiungi in `src/lib/__tests__/prompt-library.test.ts`:
- Tutti i 70 template hanno `texts.en`, `texts.it`, `texts.sv` non vuoti
- I placeholder `{brand}` compaiono in tutte e 3 le lingue per ogni template che ha quel placeholder in EN
- `hydratePrompt(template, 'it', { brand: 'Test' })` produce output italiano
- `hydratePrompt(template, 'unknown' as PromptLang, ...)` fallback a EN

Aggiorna `src/lib/__tests__/services.test.ts` se esiste già un test di monitoring — verifica che la lingua venga propagata.

## VERIFICA

1. `npx tsc --noEmit` — zero errori (ci saranno molti call-site da aggiornare)
2. `npx vitest run` — tutti i test verdi
3. Setup manuale in Supabase: migration applicata, tabella brands ha colonna `language`
4. Flow manuale:
   - Crea brand in guided setup → scegli "Italiano"
   - Seeda prompts → verifica che siano in italiano nel DB
   - Launch monitoring → verifica che il motore AI risponda in italiano
5. Flow manuale:
   - Cambia lingua di un brand esistente → verifica banner "Vuoi ri-seedare?"

## COMMIT MESSAGE

```
feat(i18n): localize 70 prompt templates for IT + SV markets, en fallback

- Add brand.language column (en/it/sv) with guided setup picker
- Refactor PromptTemplate to { texts: { en, it, sv } } structure
- Translate all 70 templates preserving placeholder compatibility
- Monitoring engine passes "Respond in {language}" to personas
- Seed endpoint uses brand.language for hydration
- Badge + nudge banner for brand language assignment

Target markets: SE (Swedish) + IT (Italian) primary, EN as fallback.
```

## NOTE IMPLEMENTATIVE

- **Priorità qualità traduzioni**: IT + SV sono i mercati operativi dell'utente. Le traduzioni vanno lette e riviste — non basta "traduttore automatico"
- **Mantieni compatibility**: aggiungi `language: PromptLang` come parametro OPZIONALE dove possibile, con default `'en'`, per non rompere call-site che non hanno il contesto del brand
- **Non creare una tabella separata `prompt_translations`**: complica le query e non aiuta nulla. JSONB/objet su riga unica è più semplice.
- **Lingua primaria del brand, non dell'utente**: il dashboard UI stesso resta in inglese (per ora). Solo i prompt e le risposte AI sono localizzati.
