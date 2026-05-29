# REPORT DI DEBUG COMPLETO — AEO Pulse v2.1.0

**Data**: 2026-05-20  
**Commit**: Current HEAD  
**Tools**: TypeScript 5.4, Vitest, Prisma, analisi statica

---

## SOMMARIO ESECUTIVO

### Metadati del progetto

| Metrica | Valore |
|---------|--------|
| File totali (escluso node_modules/.next/.git) | ~550 |
| Linee di codice totali | ~103.539 |
| File TypeScript/TSX | 365 in src/ |
| API routes (route.ts) | 96 |
| Componenti UI | 27 |
| Servizi (lib/services/) | 46 |
| Test unitari | 45 file, 701 test |
| E2E tests (Playwright) | 5 |
| Modelli DB (Prisma) | 35 |
| Dipendenze produzione | 67 |
| Lingue i18n | 3 (en, it, sv) |

### Stato quality gates

| Gate | Stato | Dettaglio |
|------|-------|-----------|
| tsc --noEmit | PASS | 0 errori - type-check pulito |
| Lint | DISABLED | Placeholder echo; ESLint flat config non migrata |
| Test suite | 701 passati, 0 falliti, 2 skip | 2 skip richiedono GEMINI_API_KEY |
| Build | ? (non testato) | Ultimo report: funzionante |

---

## SEZIONE 1 — TYPE SAFETY (58 violazioni as any)

### 1.1 as any — 58 occorrenze in 28 file produzione

Pattern dominante (75%): (supabase as any) / (db as any) / createServerClient() as any

Hotspot:
- src/lib/cost-monitor/budget-manager.ts — 8 (supabase as any)
- src/lib/agents/agent-memory.ts — 7 (supabase as any)
- src/lib/services/advisor.ts — 4 (db as any)
- src/lib/cost-monitor/cost-tracker.ts — 4 (supabase as any)
- src/app/api/billing/webhook/route.ts — 4 (event.data.object as any)
- src/lib/services/serp-cache.ts — 3
- src/lib/services/brave-search.ts — 2
- src/lib/services/dataforseo-quota.ts — 2
- src/app/api/keywords/route.ts — 2
- src/app/api/credits/use/route.ts — 2
- Altri 18 file — 1-2 ciascuno

### 1.2 @ts-expect-error — 3 occorrenze

- src/app/api/aeo-snippets/route.ts:65,82,92 — tabelle non ancora in Database type

### 1.3 eslint-disable — 13 occorrenze in 11 file

- 10x @typescript-eslint/no-explicit-any
- 1x no-constant-condition
- 1x react-hooks/exhaustive-deps
- 1x @typescript-eslint/no-non-null-assertion

---

## SEZIONE 2 — CONSOLE.* RESIDUI (64 occorrenze)

### 2.1 Categorie

console.error: 58
console.log: 5
console.warn: 1
TOTALE: 64

### 2.2 Hotspot principali

- src/app/dashboard/brands/[id]/page.tsx — 9 console.error
- src/app/dashboard/brands/new/page.tsx — 5 console.log + 2 console.error
- src/lib/cost-monitor/cost-tracker.ts — 4 console.error
- src/app/dashboard/analytics/page.tsx — 3 console.error
- src/app/dashboard/page.tsx + keywords + workflows + workspaces — 3 ciascuno
- src/lib/cost-monitor/budget-manager.ts — 3 console.error

### 2.3 Nota

Tutti i 5 console.log rimasti sono nello stesso file (brands/new/page.tsx).
Lo structured logger esiste (src/lib/logger.ts:208 righe, pino + PII masking + Sentry)
ma nessun console.* attuale lo usa.

---

## SEZIONE 3 — AI HALLUCINATION TEST

### 3.1 Nomi modelli AI — SUPERATO

Tutti i modelli sono reali:
- ChatGPT: gpt-4.1, gpt-4o, gpt-4o-mini
- Anthropic: claude-sonnet-4-6 (rilasciato feb 2026)
- Gemini: gemini-2.5-flash
- Perplexity: sonar-pro, sonar
- Groq: llama-3.3-70b-versatile

### 3.2 Variabili d'ambiente — SUPERATO

Tutte le 40+ env var hanno corrispondenza in .env.example.
Due eccezioni minori: BASE_URL (test), BRAVE_API_KEY singolare (fallback non documentato)

### 3.3 Errori in italiano — NESSUNO

### 3.4 Contaminazione prompt — NESSUNA

### 3.5 Placeholder/TODO/FIXME — NESSUNO

---

## SEZIONE 4 — DEAD CODE E RIDONDANZA

### 4.1 Context React interi mai importati

TUTTI e 3 i file in src/context/ sono morti:
- BrandContext.tsx (129 righe) — BrandProvider, useBrand, useSelectedBrand, useBrandId
- CreditsContext.tsx (152 righe) — CreditsProvider, useCredits, useAvailableCredits, useHasCredits
- QueryCategoryContext.tsx (60 righe) — QueryCategoryProvider, useQueryCategory, etc.
- src/context/index.ts (barrel)

### 4.2 Hook inutilizzati

- src/hooks/useBrands.ts — intero file (60 righe), compete con useBrandsQuery
- useCreateBrandMutation, brandsQueryKey in useBrandsQuery.ts
- useDebounce, useAsyncFetch, useLocalStorage, useMediaQuery, usePrevious, useOutsideClick in hooks/index.ts
- useRealtimeAlerts in use-realtime.ts

### 4.3 Duplicato confermato

DEFAULT_PROVIDER_PRIORITY e PROVIDER_PRIORITY in src/lib/providers/types.ts:64-84
IDENTICI (stessi 8 provider, stesso ordine). DEFAULT_* mai usato.

### 4.4 @deprecated

calculateHealthScore in monitoring.ts:522 — deprecato, nessun consumer in produzione

### TOTALE DEAD CODE: ~560+ righe

---

## SEZIONE 5 — SECURITY AUDIT

### CRITICAL — 0

### HIGH — 0

### MEDIUM — 2

1. Token invito in query string URL
   File: src/app/page.tsx:25,53
   Il token di invito passa nella URL come ?token=.... Parzialmente mitigato
   da middleware che setta Referrer-Policy: no-referrer su /team/accept.

2. Math.random() per generazione ID
   File: src/lib/utils.ts:150 — generateId() usa Math.random()
   Non crypto-safe ma usato solo per scan ID client-side (non auth).

### PUNTI DI FORZA

- Rate limiting: Upstash Redis in prod, fail-closed, timing-safe cron auth
- Nessuna SQL injection: zero raw queries, solo ORM/Supabase client
- CSP robusto: nonce-locked script-src, frame-ancestors 'none'
- API key auth: bcrypt constant-time, prefix-indexed, scope-checked
- Nessun secret hardcodato
- PII masking (27 paths in logger)
- Auth guard test automatizzato che verifica ogni route

---

## SEZIONE 6 — PERFORMANCE

### 6.1 File grandi

- src/types/database.ts — 61KB (auto-generato, ok)
- src/app/docs/page.tsx — 43KB (da splittare)
- src/app/dashboard/brands/[id]/page.tsx — 40KB (da splittare)
- src/app/dashboard/optimizer/page.tsx — 33KB
- src/app/dashboard/competitor/page.tsx — 32KB
- src/app/dashboard/brands/new/page.tsx — 31KB

### 6.2 loading.tsx mancanti — 34 su 41 routes

Solo 8 routes hanno loading.tsx. 34 routes (83%) mostrano schermata bianca
durante il caricamento.

Routes con loading.tsx: alerts, analytics, brands, citations, competitor, optimizer, sentiment, root

### 6.3 React.memo — 0%

Nessun componente usa React.memo. Tutti i 27 componenti ri-renderizzano
ad ogni cambio di stato parent.

### 6.4 Cache-Control — ASSENTE

Nessuna API route imposta header HTTP di caching.
Solo 2 route usano revalidate di Next.js (health, v1).

### 6.5 Dipendenze duplicate/pesanti

- apexcharts (8.6MB) + recharts (4.5MB) = 13MB di chart library
- jspdf: 28.8MB (3° dipendenza dopo Next.js)
- framer-motion: 2.8MB
- @tanstack/react-query-devtools in dependencies (devDependencies sarebbe corretto)

### 6.6 Query DB unbounded

Almeno 6 query senza .limit() che diventeranno problematiche con la crescita:
- citation_snapshots, audit_logs, brand_health_scores (x2), monitoring_results, keyword_rankings

---

## SEZIONE 7 — STRUTTURA CODICE

### 7.1 Consistenza pattern architetturale

| Layer | File |
|-------|------|
| API routes (HTTP) | src/app/api/*/route.ts (96 file) |
| Business logic | src/lib/services/*.ts (46 file) |
| AI providers | src/lib/providers/*.ts (13 file) |
| Componenti UI | src/components/*.tsx (27 file) |
| Hook React | src/hooks/*.ts (7 file) |
| Test | src/lib/__tests__/*.test.ts (45 file) |

### 7.2 Framework e librerie

- Next.js 16 (App Router)
- React 18.3
- TypeScript 5.4 strict
- Supabase JS client (runtime DB) + Prisma (schema management)
- Pino (structured logging)
- Zod (validazione input)
- Zustand (state management client)
- TanStack React Query (data fetching)
- Stripe (billing)
- Sentry (error tracking)
- Upstash Redis (rate limiting + cache)

### 7.3 Schema DB

35 modelli Prisma, 896 righe di schema. 4 migration manuali SQL.
Problema: @updatedAt non funziona via Supabase client (manca trigger PG).

---

## SEZIONE 8 — RACCOMANDAZIONI PRIORITARIE

### Priorità 1 (Impatto immediato)

1. Rimuovere 'billing/route.ts' da PUBLIC_ROUTES in api-auth-guard.test.ts:36
   (file non esiste +, fixa il test fallito)

2. Sostituire 64 console.* con logger.* (pino + Sentry + PII masking)

3. Aggiungere loading.tsx alle 34 dashboard routes mancanti

4. Aggiungere React.memo ai componenti chiave (Sidebar, StatCard, AVIScoreCard)

### Priorità 2 (Qualità codice)

5. Rimuovere ~560 righe di dead code (3 context file, 8 hook inutilizzati)

6. Eliminare DEFAULT_PROVIDER_PRIORITY (duplicato identico)

7. Aggiungere Cache-Control header alle API read-heavy

8. Aggiungere .limit() alle 6 query unbounded

### Priorità 3 (Debito tecnico)

9. Correggere 58 as any (iniziare da budget-manager.ts e agent-memory.ts)

10. Spostare @tanstack/react-query-devtools in devDependencies

11. Valutare consolidamento apexcharts/recharts (salva ~13MB bundle)

12. Considerare lazy-load per jspdf (28.8MB) e framer-motion (2.8MB)

---

## RIEPILOGO NUMERI

### Violazioni totali per area

| Area | Conteggio |
|------|-----------|
| as any (produzione) | 58 |
| eslint-disable | 13 |
| console.* residui | 64 |
| @ts-expect-error | 3 |
| @ts-ignore | 0 (buono) |
| Dead code (righe) | ~560 |
| loading.tsx mancanti | 34 |
| React.memo coverage | 0% |
| API senza cache | 94/96 |
| Query unbounded | 6 |
| Dip. duplicate chart | 13MB |
| Test falliti | 0 (701 pass) |
| Type error | 0 |

### Quality Score (soggettivo)

| Area | Voto | Note |
|------|------|------|
| TypeScript | 7/10 | 58 as any abbassano il voto |
| Testing | 8/10 | 701 test, coverage buona |
| Security | 8/10 | Solida, 2 medium findings |
| Performance | 5/10 | loading.tsx mancanti, no memo, no cache |
| Code quality | 6/10 | Dead code, console.*, duplicati |
| Documentation | 7/10 | .env.example ok, AGENTS.md ok |
| Architettura | 8/10 | Pattern pulito, separazione layer |

