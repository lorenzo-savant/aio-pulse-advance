# Fas 0 — Teknisk uppstädning (T01-T06)

> **Icke förhandlingsbar förutsättning** för allt annat. 3-4 veckor, 25-40k EUR. Ingen Fas 1+ förrän Fas 0 är slutförd.

---

## 🎯 Fasens mål

Eliminera den **blockerande tekniska skulden** som identifierades i CODE_REVIEW.md (mars 2026 — historisk rapport borttagen från repot) innan den förstärks under den arkitektoniska expansionen i Fas 1.

## 📋 Task-översikt

| Task | Titel                                                         | Effort          | Deps |
| ---- | ------------------------------------------------------------- | --------------- | ---- |
| T01  | Fix imports + type bypass in `onboarding/route.ts` (S1)       | ✅ Already done | —    |
| T02  | Generate strong Supabase types + refactor `supabase.ts` (S1)  | 1-2 dagar       | —    |
| T03  | Kill residual `(db as any)` across API routes (S2) — 125+ → 1 | 0.5-1 dag       | —    |
| T04  | Structured logger: pino + PII masking + Sentry forward (S2)   | 2-3 dagar       | —    |
| T05  | Replace 76 `console.log/error/warn` with logger (residual S2) | 2-3 dagar       | T04  |
| T06  | CI gate: type-check + lint + test in pre-commit + PR (S3)     | 1 dag           | —    |

**Totalt**: ~3-4 veckor med 1 dev på heltid.

---

## T01 — Fix imports + type bypass in `onboarding/route.ts` ✅ Done

**Severity**: S1 (critical, blockerande)
**Effort**: ✅ Already done (verifierat 2026-05-14)
**Owner**: — (pre-roadmap-arbete)

### Status

- Import paths `@/lib/supabase` och `@/lib/utils` verifierade fungerande — inte längre trasiga
- `(db as any)` i `onboarding/route.ts` borttagen
- `pnpm type-check` PASS på denna fil
- Task stängd innan den formella roadmapen påbörjades

### Att verifiera (om ännu inte närvarande)

- [ ] Nytt integrationstest: `POST /api/onboarding` med auth → 200/201
- [ ] Nytt integrationstest: `POST /api/onboarding` utan auth → 401

---

## T02 — Generate strong Supabase types + refactor `supabase.ts` 🟣 Scaffolding done

**Severity**: S1
**Effort**: ~~1-2 dagar~~ → **scaffolding done 2026-05-14, hands-on regeneration ~30 min**
**Dependencies**: inga
**Owner**: Claude Opus 4.7 (scaffolding) + user (kör `db:gen-types`)

### Nuvarande status (verifierat 2026-05-14)

- ✅ `src/lib/supabase.ts` redan strong-typed: `import type { Database } from '@/types/database'` + `TypedSupabaseClient = SupabaseClient<Database>` + `createServerClient(): TypedSupabaseClient`
- ✅ Plus CF-01 security guard mot `DEV_USER_ID` i prod (defense in depth)
- ✅ `src/types/database.ts` befintlig, 1906 rader, standardformat Supabase gen types (Row/Insert/Update)
- ✅ **package.json**: tillagt script `db:gen-types` + `supabase` CLI i devDependencies
- ✅ **.env.example**: tillagt `SUPABASE_PROJECT_ID` med instruktioner
- ✅ **ENVIRONMENTS.md**: dokumenterad regen-procedur och best practice

### Återstående action items (user, ~30 min)

- [ ] `npm install` (för att plocka upp supabase CLI från devDeps)
- [ ] Lägg till `SUPABASE_PROJECT_ID=npxfqsbslhnkoxgqosyy` i `.env.local`
- [ ] `npm run db:gen-types` → regenerera `src/types/database.ts` från live-schema
- [ ] Manuell diff: verifiera att de 273 geo_score-raderna (redan i stash) bevaras av regenereringen
- [ ] `npm run type-check` → PASS
- [ ] Commit med meddelandet `chore(types): regenerate Supabase types from live schema`

### Filer berörda av scaffolding 2026-05-14

- `package.json` — script `db:gen-types` + `supabase` devDep
- `.env.example` — `SUPABASE_PROJECT_ID` documented
- `ENVIRONMENTS.md` — sektion "Supabase Type Regeneration" + "Sentry + Logger Configuration"
- `AGENTS.md` — pnpm → npm consistency fix + `db:gen-types` command

### Implementationsanteckningar

- `database.ts` är det kanoniska filnamnet i detta repo (inte `supabase.ts` som mina ursprungliga instruktioner sa — korrigerat nu)
- Project ref härledd från `NEXT_PUBLIC_SUPABASE_URL` (t.ex. `https://abcd1234.supabase.co` → ref `abcd1234`)
- För Acasting: nuvarande project ref är `npxfqsbslhnkoxgqosyy` (sett i `.env.local`)
- Typerna ska committas i git (de är kontraktet med databasen)
- När schemat ändras i produktion: regenerera + committa i samma PR som migrationen

---

## T03 — Kill residual `(db as any)` across API routes

**Severity**: S2
**Effort**: 0.5-1 dag
**Dependencies**: inga
**Owner**: TBD

### Issue

- Mars 2026: 125+ instances av `(db as any)` i API routes och services
- **Maj 2026**: nere på **1 återstående instans** verifierad (pre-roadmap-arbete)
- Mindre kvarvarande konsekvens men ska stängas för DoD

### Strategi

1. Sök efter den återstående instansen:
   ```bash
   grep -rn "as any" src/app/api/ src/lib/services/
   ```
2. Ersätt med lämplig typad cast eller `// @ts-expect-error` med kommentar
3. Verifiera type-check

### Acceptance criteria

- [ ] 0 `(db as any)` kvar i `src/app/api/`
- [ ] 0 `(db as any)` kvar i `src/lib/services/`
- [ ] `pnpm type-check` PASS
- [ ] `pnpm test` PASS

### Filer

- `src/app/api/**/*.ts` eller `src/lib/services/**/*.ts` (1 fil)

### Verifiering

```bash
grep -rn "as any" src/app/api/ src/lib/services/ | grep -v node_modules
# Output: deve essere vuoto

pnpm type-check
pnpm test
```

### Anteckningar

- Konvertera INTE `(db as any)` till `(db as unknown as Database)` — det döljer bara problemet
- Om den enda kvarvarande verkligen är omöjlig att typsätta → `// @ts-expect-error` + issue ref

---

## T04 — Structured logger: pino + PII masking + Sentry forward 🟣 Scaffolding done

**Severity**: S2
**Effort**: ~~2-3 dagar~~ → **scaffolding done 2026-05-14, hands-on verification ~30 min**
**Dependencies**: inga
**Owner**: Claude Opus 4.7 (scaffolding) + user (npm install + DSN config + smoke test)

### Nuvarande status (verifierat 2026-05-14)

- ✅ `src/lib/logger.ts` omskriven med `pino` v9.x: PII auto-masking via `redact.paths` (40+ paths täcker email/password/apiKey/token/authorization/cookie/Supabase session), Sentry forward (info/warn → breadcrumb, error → captureException), edge-runtime compatible, log levels från `LOG_LEVEL` env (default: `info` i prod / `debug` annars), pino-pretty i dev för läsbarhet
- ✅ Interface `Logger` bevarat (same shape) — befintliga call sites går inte sönder
- ✅ `sentry.server.config.ts` förstärkt: PII filter i `beforeSend` (defense in depth), release tagging från `VERCEL_GIT_COMMIT_SHA`, `enabled` med override `SENTRY_FORCE_ENABLE`, `ignoreErrors` för vanligt brus
- ✅ `package.json`: tillagt `pino ^9.5.0` (deps) + `pino-pretty ^13.0.0` (devDeps)
- ✅ `ENVIRONMENTS.md`: tillagt sektion "Sentry + Logger Configuration" med DO/DON'T
- ⚠️ `sentry.client.config.ts` och `sentry.edge.config.ts`: lämnade orörda, kompatibla (eventuell enhancement med samma beforeSend i follow-up-PR)

### Återstående action items (user, ~30 min)

- [ ] `npm install` (för att plocka upp pino + pino-pretty)
- [ ] Skapa Sentry-projekt (https://sentry.io) och hämta DSN
- [ ] Lägg till i `.env.local`: `SENTRY_DSN=https://...@sentry.io/...`, `SENTRY_ORG=<slug>`, `SENTRY_PROJECT=<slug>`
- [ ] Lägg till `SENTRY_AUTH_TOKEN` (för sourcemap upload — valfritt men rekommenderat)
- [ ] Smoke test PII masking:
  ```bash
  # In una route, temporaneamente:
  logger.info('user login', { email: 'test@test.com', apiKey: 'sk-xxx' })
  # Verifica nei log: email + apiKey appaiono come '[REDACTED]'
  ```
- [ ] Smoke test Sentry: `throw new Error('test sentry')` i en route → händelse synlig i dashboard <1min
- [ ] I produktion (post-deploy Vercel): verifiera att `release: <git_sha>` visas på Sentry events

### Acceptance criteria (scaffolding side)

- [x] Sentry config server-side hardened (PII filter, release tagging, ignoreErrors)
- [x] `pino` konfigurerad i `src/lib/logger.ts` med redact, level resolution, base service tag, formatters
- [x] PII auto-masking aktiv på 40+ paths (email, password, apiKey, token, cookies, Supabase session)
- [x] Sentry forward: error → captureException, info/warn → breadcrumb, debug → aldrig forwardad (quota)
- [x] Log levels via `LOG_LEVEL` env (default: `info` prod / `debug` annars)
- [x] Inline-dokumentation i `src/lib/logger.ts` + sektion "Sentry + Logger" i ENVIRONMENTS.md

### Filer ändrade av scaffolding 2026-05-14

- ✅ `src/lib/logger.ts` — omskriven från hantverksmässig custom till pino + Sentry forward + PII masking
- ✅ `sentry.server.config.ts` — beforeSend hardening + release tagging + ignoreErrors
- ✅ `package.json` — `pino` (deps) + `pino-pretty` (devDeps) tillagda
- ✅ `ENVIRONMENTS.md` — sektion "Sentry + Logger Configuration"
- ⚠️ `sentry.client.config.ts` — inte rörd (kan dra nytta av samma beforeSend i follow-up-PR)
- ⚠️ `sentry.edge.config.ts` — inte rörd (edge runtime har begränsningar för Sentry, verifiera separat)
- ⚠️ `next.config.ts` — inte rörd (befintlig Sentry webpack config är OK)

### Verifiering

```bash
pnpm dev
# In una route, lancia: throw new Error('test sentry')
# Vai su dashboard Sentry, verifica che l'errore appaia in <1 min

# Test logger masking:
# In una route: logger.info('user login', { email: 'test@test.com' })
# Verifica che nei log appaia: { email: '[REDACTED]' } o similar
```

### Implementationsanteckningar

- Sentry release tagging: `next.config.ts` måste skicka `git rev-parse HEAD` som release för korrekt sourcemap upload
- Logger pino rekommenderad (snabbare än winston, native JSON, utmärkt Sentry integration via `pino-sentry-transport`)
- Setup config:

  ```ts
  // src/lib/logger.ts
  import pino from 'pino'

  const redactPaths = [
    '*.password',
    '*.apiKey',
    '*.token',
    '*.authorization',
    'email',
    'password',
    'apiKey',
    'token',
    'headers.authorization',
    'headers.cookie',
    'body.password',
    'body.apiKey',
  ]

  export const logger = pino({
    level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    redact: { paths: redactPaths, censor: '[REDACTED]' },
  })
  ```

---

## T05 — Replace 76 `console.log/error/warn` with logger

**Severity**: S2
**Effort**: 2-3 dagar
**Dependencies**: T04 slutförd
**Owner**: TBD

### Issue

- Mars 2026: 116+ instances av `console.log/error/warn` i `src/app/api/*/route.ts` och `src/lib/services/*.ts`
- **Maj 2026**: nere på **76 återstående** (pre-roadmap cleanup)
- Konsekvens: ostrukturerade loggar, PII leak-risk (t.ex. `console.error(error)` med full response), Sentry ser inte händelserna

### Acceptance criteria

- [ ] 0 `console.*` i `src/` (förutom `src/types/` eller config-filer om användbart)
- [ ] Ersättningsmappning:
  - `console.log` → `logger.info` eller `logger.debug` (baserat på kritikalitet)
  - `console.warn` → `logger.warn`
  - `console.error` → `logger.error`
- [ ] Typade fel: `logger.error('description', { err, context })` inte `logger.error(err)`
- [ ] Logga aldrig kompletta objekt som kan innehålla PII (api response, request body utan sanitize)
- [ ] Mönster verifierat: `src/app/api/providers/test/route.ts` loggar inte längre API key vid error (separat S2)

### Filer

- Alla filer i `src/app/api/` med förekomster
- Alla filer i `src/lib/services/` med förekomster
- Möjligen några i `src/lib/` om de har console-statements

### Strategi

1. `grep -rn "console\." src/ | grep -v test | grep -v __tests__` för lista
2. Ta bort/ersätt en katalog i taget
3. PR-grupp om 3-5 kataloger för att vara reviewable
4. Test PASS efter varje grupp

### Verifiering

```bash
# Conta residue:
grep -r "console\." src/ --include="*.ts" --include="*.tsx" | grep -v test | grep -v __tests__ | wc -l
# Target: ~0 (alcune eccezioni se hai script standalone in src/scripts/)

pnpm type-check
pnpm test
```

---

## T06 — CI gate: type-check + lint + test in pre-commit + PR

**Severity**: S3 (warning) men **gating** för framtida Fas
**Effort**: 1 dag
**Dependencies**: inga (kan starta direkt, uppdateras om T04 ändrar dependencies)
**Owner**: TBD

### Acceptance criteria

- [ ] `husky` eller `lefthook` installerat för pre-commit hook
- [ ] Pre-commit hook kör: `pnpm type-check && pnpm lint --max-warnings 0` på stagade filer
- [ ] GitHub Actions workflow `.github/workflows/ci.yml` kör vid varje PR + push to main:
  - `pnpm install --frozen-lockfile`
  - `pnpm type-check`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build` (smoke check)
- [ ] PR block om workflow fails (branch protection rule på `main`)
- [ ] README uppdaterad med "How to run quality checks locally"

### Filer

- `.husky/pre-commit` (eller `lefthook.yml`)
- `.github/workflows/ci.yml` (ny)
- `package.json` (script `prepare` för husky install)
- `README.md` (sektion "Development workflow")

### Verifiering

```bash
# Pre-commit:
git commit -m "test" # → triggera hook
# Modifica un file con errore type:
echo "const x: number = 'foo'" >> src/test.ts
git add . && git commit -m "test"   # → hook deve bloccare

# CI: aprire PR test e verificare workflow run
```

### Anteckningar

- Branch protection rule på `main` ska konfigureras via GitHub UI (repo-inställning, inte fil)
- `lint-staged` som valfri integration för att linta endast stagade filer (perf)

---

## ✅ Definition of Done Fas 0

- [ ] T02-T06 alla merged i `main` (T01 är redan pre-done)
- [ ] `pnpm type-check` ger 0 fel
- [ ] `pnpm lint` ger 0 warning (eller alla dokumenterade)
- [ ] `pnpm test` PASS
- [ ] `pnpm test:e2e` PASS (om befintliga)
- [ ] `grep -rn "as any" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v __tests__ | wc -l` → ~0
- [ ] `grep -rn "console\." src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v __tests__ | wc -l` → ~0
- [ ] Sentry dashboard visar verkliga händelser från dev (test)
- [ ] CI workflow GitHub Actions grön på `main`
- [ ] Branch protection aktiv på `main`
- [ ] task-tracker.md uppdaterad till "Done" för alla T01-T06

## 🚀 När gå vidare till Fas 1

Endast efter att DoD Fas 0 är komplett. Om någon av DoD-punkterna inte är True → slutför T0X först.

---

**Tillbaka till kartan**: [README.md](README.md).
**Nästa fas**: [02-fase-1-workspace-audit.md](02-fase-1-workspace-audit.md).
