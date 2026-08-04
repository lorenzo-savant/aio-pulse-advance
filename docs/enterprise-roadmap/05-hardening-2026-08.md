# Hardening Pass — 2026-08-03

Risultato dell'audit completo (architettura + sicurezza + qualità) e del
loop di miglioramento eseguito il 2026-08-03. Questo documento registra
**cosa è stato corretto** e **cosa resta come lavoro strutturale**, in ordine
di priorità. Nessuna modifica tocca i dati del database: solo codice, test,
configurazione e documentazione.

---

## ✅ Correzioni applicate (in questo pass)

### Sicurezza

| # | Fix | File |
|---|-----|------|
| 1 | **Rate limiter: cache per-config.** Il singleton ignorava `(limit, windowMs)` dopo la prima chiamata — tutti i 49 endpoint rate-limitati giravano col limite di chi "scaldava" la lambda per primo (es. 3/min → 30/min). Ora `Map` per config + prefix Redis isolato. Con 3 test di regressione. | `src/lib/ratelimit.ts`, `src/lib/__tests__/ratelimit-config-cache.test.ts` |
| 2 | **Auth + throttle su endpoint LLM non autenticato.** `POST /api/prompts/generate-from-industry` spendeva token Groq/Gemini/OpenAI senza login. Ora `requireUser` + 10/min per utente. | `src/app/api/prompts/generate-from-industry/route.ts` |
| 3 | **Rimossa `/api/sentry-example-api`** — scrittura non autenticata verso Sentry (quota exhaustion / triage poisoning). | route eliminata + exemption rimossa da `scripts/audit-zod-coverage.mjs` |
| 4 | **`/api/providers` hardened, duplicato eliminato.** `providers/test` era una copia byte-identica; il POST (4 chiamate LLM pagate) ora ha throttle 3/min per utente e non restituisce più error string raw dei provider (logged server-side). | `src/app/api/providers/route.ts` |
| 5 | **SSRF: `checkLlmsTxt` ora usa `safeFetch`** — era l'unico fetch outbound su hostname derivato dall'utente senza guardia (finestra DNS-rebinding + oracle booleano). | `src/lib/services/site-audit-summary.ts` |
| 6 | **Self-fetch con credenziali inoltrate eliminato.** `/api/monitoring` chiamava se stesso via HTTP (`/api/credits/use`) inoltrando cookie+authorization con origin derivata dall'header Host. Logica crediti estratta in `src/lib/services/credits.ts`, chiamata diretta. Il rerun di `/api/workflows` ora usa `NEXT_PUBLIC_APP_URL` come origin fidata. | `src/lib/services/credits.ts`, `src/app/api/credits/use/route.ts`, `src/app/api/monitoring/route.ts`, `src/app/api/workflows/route.ts` |
| 7 | **Token di invito non più esposti.** `/api/team` faceva `select('*')` su `brand_invitations` (includendo `token`) e accettava membership non-accepted per leggere il roster. Colonne enumerate + filtro `status='accepted'`. | `src/app/api/team/route.ts` |
| 8 | **`/api/health`: note diagnostiche strippate in produzione** — enumeravano quali secret mancano + error text raw del DB. | `src/app/api/health/route.ts` |
| 9 | **`/api/crawlability/bots`: rate limit 30/min per IP + runtime nodejs** (l'edge runtime rompeva l'import `dns/promises` della guardia SSRF). | `src/app/api/crawlability/bots/route.ts` |
| 10 | **CSP: aggiunte `base-uri 'self'`, `object-src 'none'`, `form-action 'self'`** + test; **HSTS: aggiunto `preload`**. | `src/middleware.ts`, `next.config.ts` |
| 11 | **Eliminata `sendWebhookNotification` morta** (fetch raw senza SSRF guard — il path vivo è `webhook-delivery.ts` con HMAC + safeFetch). | `src/lib/services/email.ts` |

### Scalabilità

| # | Fix | File |
|---|-----|------|
| 12 | **Cron monitoring: engine in parallelo** (`Promise.allSettled`, come già faceva il path manuale) — prima: sleep 2s + await sequenziali = ~4× wall-clock per prompt. Cap prompt per run: da 3 hardcoded a `CRON_MONITORING_MAX_PROMPTS` (default 6, clamp 1–20). | `src/app/api/cron/monitoring/route.ts` |
| 13 | **`maxDuration = 300` sui 3 cron che ne erano privi** (digest, weekly-review, report-delivery) + cap sulle query brands illimitate (500 / 100 per run) + le 3 query per-brand del digest ora in `Promise.all`. | `src/app/api/cron/{digest,weekly-review,report-delivery}/route.ts` |
| 14 | **`getAccessibleBrandIds`: 2 query in `Promise.all` + dedup** (hot path di quasi tutte le liste autenticate). | `src/lib/authorize.ts` |
| 15 | **Eliminato il rate limiter privato DB-backed di `audit/technical`** — era non-atomico (lost update) e fail-OPEN su ogni errore; ora usa il limiter condiviso fail-closed. | `src/app/api/audit/technical/route.ts` |
| 16 | **`verifyApiKey` centralizzato** in `public-api.ts` — era copiato verbatim in 4 route `/api/v1/**` (un fix di revoca ne avrebbe mancate 3). | `src/lib/services/public-api.ts` + 4 route v1 |
| 17 | **Cache Redis (5 min) sugli endpoint AVI** — `analytics/avi` e `v1/brands/[id]/avi` ricomputavano a ogni refresh della dashboard; l'helper `cached()` esisteva già ed era usato da 1 route su 135. | `src/app/api/analytics/avi/route.ts`, `src/app/api/v1/brands/[id]/avi/route.ts` |

### Qualità / test / CI

| # | Fix | File |
|---|-----|------|
| 18 | **32 test API "a vuoto" ora skippano onestamente.** Il guard `skipIfNoServer` ritornava dentro il body → i test risultavano PASSED in CI senza asserire nulla. Ora probe unico + `describe.skipIf` → risultano SKIPPED. | `src/lib/__tests__/{api-integration,api,api-health}.test.ts` |
| 19 | **16 test nuovi per `secret-box`** (crittografia delle API key dei clienti: round-trip, tamper GCM, derivazione chiave, mask). Prima: zero test. | `src/lib/__tests__/secret-box.test.ts` |
| 20 | **`services.test.ts` testa la funzione reale** — testava una COPIA inline di `repairTruncatedJson` (poteva passare mentre la produzione driftava). Ora la funzione è esportata e importata. | `src/lib/services/analysis.ts`, `src/lib/__tests__/services.test.ts` |
| 21 | **Footgun `canEditBrand` disinnescato** — due funzioni omonime con argomenti INVERTITI (`(brandId, userId)` vs `(userId, workspaceId)`). La versione workspace è ora `canEditBrandsInWorkspace`. | `src/lib/services/workspace-auth.ts` |
| 22 | **Consolidato `use-realtime.ts`** — due file omonimi con API diverse (`src/hooks/` vs `src/lib/hooks/`); ora un solo file, ref tipizzati (niente `any`), niente `console.warn`. | `src/hooks/use-realtime.ts` |
| 23 | **CI: coverage reale** — il job unit-tests non generava coverage ma il passo codecov ne caricava il file (no-op permanente). Ora `--coverage`. + `concurrency` group (push sovrascritti cancellano i run in corso). | `.github/workflows/test.yml` |
| 24 | **README allineato alla realtà** (Next 16, React 18, v2.1.0, comandi npm — CI usa npm, non pnpm). | `README.md` |
| 25 | **Meta-test aggiornati**: `verifyApiKey` riconosciuto come auth gate; test dedup di `getAccessibleBrandIds` riflette il nuovo comportamento. | `src/lib/__tests__/{api-auth-coverage,authorize}.test.ts` |

**Verifica finale**: `tsc --noEmit` ✅ · `eslint` 0 errori ✅ · Vitest **1597 passed, 34 skipped** ✅ · RLS 51/51 ✅ · Zod 56/56 ✅

---

## ✅ Pass 2 — lavoro strutturale (stessa giornata)

Secondo giro sul backlog strutturale qui sotto. P2, P4, P9 chiusi; P3 e P7
avanzati; P1 resta l'unico blocco davvero grande.

| # | Fix | File |
|---|-----|------|
| 26 | **`withLlmCache()` — cache LLM + coalescing (P2).** Due livelli: (1) promise map in-process che collassa chiamate concorrenti identiche — è il *double-spend guard* per doppio click, retry storm o cron che si sovrappone a un run manuale; (2) TTL su Redis, opt-in per call site. Degrada a MISS su qualunque errore Redis, non persiste mai risultati vuoti (che avvelenerebbero i retry per tutto il TTL). 18 test. | `src/lib/services/llm-cache.ts`, `src/lib/__tests__/llm-cache.test.ts` |
| 27 | **Monitoring: −50% di spesa LLM per run.** `runMonitoringCheck` fa due chiamate. La **simulazione** è la misura stessa → mai persistita (ttl 0, solo dedup: un re-run deve campionare l'engine davvero). L'**analisi** è una derivazione pura di (responseText, brand, promptText) → identico input = identico output, quindi cacheabile (TTL 1h, `AIO_ANALYSIS_CACHE_TTL_SECONDS`). Scan diversi producono responseText diverso → chiave diversa, nessun falso sharing. | `src/lib/services/monitoring.ts` |
| 28 | **`withApiHandler()` — envelope errori + catch di ultima istanza (P4).** Applicato a **15 handler in 11 route** che non avevano alcun try/catch: un throw diventava un 500 grezzo, senza log e invisibile in Sentry. `SsrfError` → 400 generico (non usabile per sondare la rete interna); tutto il resto → 500 loggato con `source` e stack. | `src/lib/api-utils.ts` + 11 route |
| 29 | **PSI_CACHE a due livelli (P9).** Era una `Map` per-lambda: hit-rate ~0 sulla fleet mentre la quota PageSpeed veniva consumata come se non ci fosse cache. Ora L1 memoria + **L2 Redis** condiviso. Il risultato negativo (`null` = PSI fallita) è avvolto in un envelope, altrimenti rileggendolo da Redis sarebbe indistinguibile da un MISS e si riaprirebbe il retry-storm che la cache esiste per prevenire. | `src/lib/services/technical-seo-audit.ts` |
| 30 | **API pubblica v1: `/v1/brands` paginata (P3).** Restituiva *ogni* brand dell'utente — su una API pubblica la response size è un contratto. Ora `page`/`limit` (default 50, max 200) + blocco `pagination`; `data` resta un array, quindi additivo per gli integratori esistenti. Bound di sicurezza (2000 righe) anche su `/api/snapshots`, il cui range date è fornito dal chiamante. | `src/app/api/v1/brands/route.ts`, `src/app/api/snapshots/route.ts` |
| 31 | **CI: ratchet ESLint (P7).** `npm run lint:ci` = `--max-warnings 171` (il conteggio attuale). La regola #1 del repo è `warn`, quindi `eslint .` non poteva fallire su di essa: 129 `as any` si sono accumulati sotto un check verde. Ogni PR di pulizia deve **abbassare** il numero in `package.json`. | `package.json`, `.github/workflows/test.yml` |
| 32 | **CI: gitleaks ora bloccante** — verificato prima di attivarlo, scan pulito sugli 822 file tracciati (`no leaks found`). Aggiunti anche **run schedulato settimanale** (lunedì 06:00 UTC — `npm audit` altrimenti non vede advisory pubblicate dopo l'ultimo merge) e job **knip informativo** (era in `package.json` ma mai in CI: ecco come si sono accumulati 57 export morti). | `.github/workflows/test.yml` |

**Verifica pass 2**: `tsc --noEmit` ✅ · `lint:ci` ✅ (171/171) · Vitest **1615 passed, 34 skipped** ✅ · gitleaks ✅ · `next build` ✅

---

## 🔭 Lavoro strutturale rimanente (prioritizzato)

Questi item richiedono decisioni di prodotto o giorni/settimane di lavoro.

### P1 — Job queue per il lavoro LLM (il vero unlock di scala) — **APERTO**
Tutto il lavoro costoso (fan-out LLM, PDF, audit) gira inline nelle request.
Il cron monitoring, anche parallelizzato, resta cappato (~6 prompt/run × 3
run/giorno). **QStash** si integra con l'infra Upstash già presente; Inngest
se servono retry/fan-out più ricchi. I cron dovrebbero accodare, non eseguire.
→ Prerequisito per rimuovere ogni cap e servire più tenant.

### P2 — Cache LLM — ✅ **FATTO** (pass 2, #26-27)
Resta da estendere `withLlmCache` alle altre superfici generative
(`prompt-generator-ai`, `exec-summary`, `advisor`): l'infrastruttura c'è,
serve solo scegliere TTL e `shouldCache` per ciascuna.

### P3 — Confine di servizio + pagination — **PARZIALE**
- ✅ v1 pubblica paginata + bound su snapshots (pass 2, #30).
- ⬜ Restano ~32 endpoint lista senza bound. Gli helper sono in
  `api-utils.ts`; procedere per gruppi, verificando ogni volta il consumer
  frontend (alcuni si aspettano un array nudo).
- ⬜ 91/135 route chiamano `createServerClient()` direttamente; 14 route >200
  righe non importano alcun service. Estrarre in `src/lib/services/` e poi
  lint-ban `createServerClient` dentro `src/app/api`.

### P4 — Envelope errori unificato — ✅ **FATTO in gran parte** (pass 2, #28)
`withApiHandler` esiste e copre le route che erano senza catch. Resta:
- ⬜ migrare progressivamente le 41 route che usano `{error}` invece di
  `{success:false, message}` (la v1 pubblica usa `{error}` — cambiarla è
  breaking, va versionato);
- ⬜ valutare RFC 9457 problem+json per la v1.

### P5 — Decisioni su codice morto (knip)
57 export + 54 type inutilizzati. In particolare da DECIDERE (non solo cancellare):
- `decryptSecret` non ha call-site: le chiavi provider dei clienti vengono
  cifrate ma mai decifrate/usate → o si integra l'uso delle chiavi utente nei
  provider client, o la feature "porta la tua chiave" è morta.
- 4 sender email dead (`sendAlertEmail`, `sendWelcomeEmail`,
  `sendPasswordResetEmail`): i flussi welcome/reset sono rotti o mai wired?
- `organization-auth.ts`: `addOrganizationMember` & co. dead ma la UI org
  esiste → verificare quale path usa la UI.
- `rate-limit-tiers.ts` usato da 1 route su 135: adottarlo o eliminarlo.

### P6 — Schema drift (2 workaround attivi)
- `monitoring_results.prompt_id` inserito `null` contro un tipo NOT NULL
  (`queries/orchestrate/route.ts`).
- `sentiment_history` interrogata ma assente dallo schema (`reports/pdf/route.ts`).
→ Wired il secret `SUPABASE_DB_URL` in GitHub per attivare il drift-check CI
(oggi soft-skippa), poi risolvere i due TODO.

### P7 — CI — ✅ **FATTO in gran parte** (pass 2, #31-32)
Ratchet ESLint, gitleaks bloccante, run schedulato e knip informativo sono
attivi. Resta:
- ⬜ **Abbassare il ratchet**: 171 → 0. Ogni PR di pulizia scende di qualche
  unità; i cluster peggiori sono `advisor.ts` (10 `as any`),
  `geo-score-precompute.ts` (8), `budget-manager.ts` (8), `agent-memory.ts` (7).
- ⬜ Coverage thresholds in `vitest.config.ts` — ora che la CI genera davvero
  il report (#23), misurare la baseline e pinnarla.
- ⬜ Wire dei secret GitHub: finché mancano, i job **build**, **e2e** e
  **migration-drift** sono no-op verdi — tre gate spenti. Verificato il
  2026-08-04: `gh secret list` restituisce `[]`.

  I set sono **separati** dal 2026-08-04. Prima condividevano gli stessi tre
  nomi, quindi armare **build** avrebbe puntato Playwright su **produzione**
  senza dirlo. Ordine di attivazione:
  1. `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` → arma
     **build**. Esposizione nulla: viaggiano già dentro il bundle browser.
     Lasciare `SUPABASE_SERVICE_KEY` non impostato finché una build rossa non
     dimostra che serve davvero.
  2. `SUPABASE_DB_URL` → arma **migration-drift**. Usare un ruolo Postgres
     **read-only** dedicato, non `postgres`: `gen types` legge solo pg_catalog.
     Attenzione: con i due workaround di P6 ancora aperti questo gate può
     partire rosso — è il suo lavoro.
  3. `E2E_SUPABASE_URL` / `E2E_SUPABASE_ANON_KEY` / `E2E_SUPABASE_SERVICE_KEY`
     → arma **e2e**, e devono puntare a un progetto Supabase usa-e-getta (o a
     un branch Supabase). Il job si rifiuta di partire se l'URL coincide con
     quello di produzione.

### P8 — Frontend (performance percepita)
- 52/58 pagine sono `'use client'` con waterfall fetch client-side;
  `dashboard/brands/[id]/page.tsx` = 1571 righe, 25 useState, 14 fetch.
  Migrare le pagine più lette a RSC + streaming.
- i18n: 1462 chiavi × 3 locale esistono ma solo 10/43 pagine le usano.

### P9 — In-memory state residuo (serverless) — **PARZIALE**
- ✅ `PSI_CACHE` → due livelli con Redis (pass 2, #29).
- ⬜ `vertexResolveCache` (`ai-router.ts`) — stesso trattamento.
- ℹ️ `inflight` (serp-cache, llm-cache) resta volutamente per-processo: è
  coalescing di promise concorrenti, non una cache; su Redis non avrebbe senso.

---

## Nota operativa

Le azioni manuali da dashboard vendor (deploy Vercel, dominio, BetterStack,
log drain, email alias) restano tracciate in `lorenzotodolist.md` — nessuna
è automatizzabile da codice.
