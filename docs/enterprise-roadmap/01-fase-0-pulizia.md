# Fase 0 — Pulizia tecnica (T01-T06)

> **Precondizione non negoziabile** per tutto il resto. 3-4 settimane, 25-40k EUR. Niente Fase 1+ finché Fase 0 non è completata.

---

## 🎯 Goal della fase

Eliminare il **debito tecnico bloccante** identificato in CODE_REVIEW.md (marzo 2026 — report storico rimosso dal repo) prima che si amplifichi durante l'espansione architetturale di Fase 1.

## 📋 Task overview

| Task | Titolo                                                        | Effort          | Deps |
| ---- | ------------------------------------------------------------- | --------------- | ---- |
| T01  | Fix imports + type bypass in `onboarding/route.ts` (S1)       | ✅ Already done | —    |
| T02  | Generate strong Supabase types + refactor `supabase.ts` (S1)  | 1-2 giorni      | —    |
| T03  | Kill residual `(db as any)` across API routes (S2) — 125+ → 1 | 0.5-1 giorno    | —    |
| T04  | Structured logger: pino + PII masking + Sentry forward (S2)   | 2-3 giorni      | —    |
| T05  | Replace 76 `console.log/error/warn` with logger (residual S2) | 2-3 giorni      | T04  |
| T06  | CI gate: type-check + lint + test in pre-commit + PR (S3)     | 1 giorno        | —    |

**Totale**: ~3-4 settimane con 1 dev fulltime.

---

## T01 — Fix imports + type bypass in `onboarding/route.ts` ✅ Done

**Severity**: S1 (critical, bloccante)
**Effort**: ✅ Already done (verified 2026-05-14)
**Owner**: — (pre-roadmap work)

### Stato

- Import paths `@/lib/supabase` e `@/lib/utils` verificati funzionanti — non più broken
- `(db as any)` in `onboarding/route.ts` rimosso
- `pnpm type-check` PASS su questo file
- Task chiuso prima dell'inizio della roadmap formale

### Da verificare (se non ancora presente)

- [ ] Nuovo test integration: `POST /api/onboarding` con auth → 200/201
- [ ] Nuovo test integration: `POST /api/onboarding` senza auth → 401

---

## T02 — Generate strong Supabase types + refactor `supabase.ts` 🟣 Scaffolding done

**Severity**: S1
**Effort**: ~~1-2 giorni~~ → **scaffolding done 2026-05-14, hands-on regeneration ~30 min**
**Dependencies**: nessuna
**Owner**: Claude Opus 4.7 (scaffolding) + user (run `db:gen-types`)

### Stato attuale (verificato 2026-05-14)

- ✅ `src/lib/supabase.ts` già strong-typed: `import type { Database } from '@/types/database'` + `TypedSupabaseClient = SupabaseClient<Database>` + `createServerClient(): TypedSupabaseClient`
- ✅ Plus CF-01 security guard contro `DEV_USER_ID` in prod (defense in depth)
- ✅ `src/types/database.ts` esistente, 1906 righe, formato standard Supabase gen types (Row/Insert/Update)
- ✅ **package.json**: aggiunto script `db:gen-types` + `supabase` CLI in devDependencies
- ✅ **.env.example**: aggiunta `SUPABASE_PROJECT_ID` con istruzioni
- ✅ **ENVIRONMENTS.md**: documentata procedura regen e best practice

### Action items residui (user, ~30 min)

- [ ] `npm install` (per pickare supabase CLI da devDeps)
- [ ] Aggiungere `SUPABASE_PROJECT_ID=npxfqsbslhnkoxgqosyy` in `.env.local`
- [ ] `npm run db:gen-types` → rigenera `src/types/database.ts` da schema live
- [ ] Diff manuale: verificare che le 273 righe geo_score (già nello stash) siano preservate dalla rigenerazione
- [ ] `npm run type-check` → PASS
- [ ] Commit con messaggio `chore(types): regenerate Supabase types from live schema`

### Files toccati dallo scaffolding 2026-05-14

- `package.json` — script `db:gen-types` + `supabase` devDep
- `.env.example` — `SUPABASE_PROJECT_ID` documented
- `ENVIRONMENTS.md` — sezione "Supabase Type Regeneration" + "Sentry + Logger Configuration"
- `AGENTS.md` — pnpm → npm consistency fix + `db:gen-types` command

### Note implementative

- `database.ts` è il filename canonico in questo repo (non `supabase.ts` come dicevano le mie istruzioni iniziali — corretto adesso)
- Project ref derivato da `NEXT_PUBLIC_SUPABASE_URL` (es. `https://abcd1234.supabase.co` → ref `abcd1234`)
- Per Acasting: project ref attuale è `npxfqsbslhnkoxgqosyy` (visto in `.env.local`)
- I types vanno committati in git (sono il contract con il DB)
- Quando lo schema cambia in produzione: rigenerare + committare in stesso PR della migration

---

## T03 — Kill residual `(db as any)` across API routes

**Severity**: S2
**Effort**: 0.5-1 giorno
**Dependencies**: nessuna
**Owner**: TBD

### Issue

- Marzo 2026: 125+ instances di `(db as any)` in API routes e services
- **Maggio 2026**: down a **1 instanza residua** verificata (pre-roadmap work)
- Conseguenza residua minore ma da chiudere per DoD

### Strategia

1. Cerca l'istanza residua:
   ```bash
   grep -rn "as any" src/app/api/ src/lib/services/
   ```
2. Sostituisci con cast typed appropriato o `// @ts-expect-error` con commento
3. Verifica type-check

### Acceptance criteria

- [ ] 0 `(db as any)` rimasti in `src/app/api/`
- [ ] 0 `(db as any)` rimasti in `src/lib/services/`
- [ ] `pnpm type-check` PASS
- [ ] `pnpm test` PASS

### Files

- `src/app/api/**/*.ts` o `src/lib/services/**/*.ts` (1 file)

### Verifica

```bash
grep -rn "as any" src/app/api/ src/lib/services/ | grep -v node_modules
# Output: deve essere vuoto

pnpm type-check
pnpm test
```

### Note

- NON convertire `(db as any)` in `(db as unknown as Database)` — quello è solo nascondere il problema
- Se l'unico residuo è veramente impossibile da tipizzare → `// @ts-expect-error` + issue ref

---

## T04 — Structured logger: pino + PII masking + Sentry forward 🟣 Scaffolding done

**Severity**: S2
**Effort**: ~~2-3 giorni~~ → **scaffolding done 2026-05-14, hands-on verification ~30 min**
**Dependencies**: nessuna
**Owner**: Claude Opus 4.7 (scaffolding) + user (npm install + DSN config + smoke test)

### Stato attuale (verificato 2026-05-14)

- ✅ `src/lib/logger.ts` riscritto con `pino` v9.x: PII auto-masking via `redact.paths` (40+ paths coprono email/password/apiKey/token/authorization/cookie/Supabase session), Sentry forward (info/warn → breadcrumb, error → captureException), edge-runtime compatible, log levels da `LOG_LEVEL` env (default: `info` in prod / `debug` altrove), pino-pretty in dev per leggibilità
- ✅ Interface `Logger` preservata (same shape) — call sites esistenti non si rompono
- ✅ `sentry.server.config.ts` rinforzato: PII filter in `beforeSend` (defense in depth), release tagging da `VERCEL_GIT_COMMIT_SHA`, `enabled` con override `SENTRY_FORCE_ENABLE`, `ignoreErrors` di noise comune
- ✅ `package.json`: aggiunti `pino ^9.5.0` (deps) + `pino-pretty ^13.0.0` (devDeps)
- ✅ `ENVIRONMENTS.md`: aggiunta sezione "Sentry + Logger Configuration" con DO/DON'T
- ⚠️ `sentry.client.config.ts` e `sentry.edge.config.ts`: lasciati intatti, conformi (eventuale enhancement con stessa beforeSend in PR follow-up)

### Action items residui (user, ~30 min)

- [ ] `npm install` (per pickare pino + pino-pretty)
- [ ] Crea progetto Sentry (https://sentry.io) e ottieni DSN
- [ ] Aggiungi in `.env.local`: `SENTRY_DSN=https://...@sentry.io/...`, `SENTRY_ORG=<slug>`, `SENTRY_PROJECT=<slug>`
- [ ] Aggiungi `SENTRY_AUTH_TOKEN` (per sourcemap upload — opzionale ma raccomandato)
- [ ] Smoke test PII masking:
  ```bash
  # In una route, temporaneamente:
  logger.info('user login', { email: 'test@test.com', apiKey: 'sk-xxx' })
  # Verifica nei log: email + apiKey appaiono come '[REDACTED]'
  ```
- [ ] Smoke test Sentry: `throw new Error('test sentry')` in una route → evento visibile in dashboard <1min
- [ ] In produzione (post-deploy Vercel): verificare che `release: <git_sha>` compaia sui Sentry events

### Acceptance criteria (scaffolding side)

- [x] Sentry config server-side hardened (PII filter, release tagging, ignoreErrors)
- [x] `pino` configurato in `src/lib/logger.ts` con redact, level resolution, base service tag, formatters
- [x] PII auto-masking attiva su 40+ paths (email, password, apiKey, token, cookies, Supabase session)
- [x] Sentry forward: error → captureException, info/warn → breadcrumb, debug → mai forwardato (quota)
- [x] Log levels via `LOG_LEVEL` env (default: `info` prod / `debug` altrove)
- [x] Documentazione inline in `src/lib/logger.ts` + sezione "Sentry + Logger" in ENVIRONMENTS.md

### Files modificati dallo scaffolding 2026-05-14

- ✅ `src/lib/logger.ts` — riscritto da custom artigianale a pino + Sentry forward + PII masking
- ✅ `sentry.server.config.ts` — beforeSend hardening + release tagging + ignoreErrors
- ✅ `package.json` — `pino` (deps) + `pino-pretty` (devDeps) aggiunti
- ✅ `ENVIRONMENTS.md` — sezione "Sentry + Logger Configuration"
- ⚠️ `sentry.client.config.ts` — non toccato (potrebbe beneficiare di stessa beforeSend in PR follow-up)
- ⚠️ `sentry.edge.config.ts` — non toccato (edge runtime ha vincoli su Sentry, verificare separatamente)
- ⚠️ `next.config.ts` — non toccato (Sentry webpack config esistente è OK)

### Verifica

```bash
pnpm dev
# In una route, lancia: throw new Error('test sentry')
# Vai su dashboard Sentry, verifica che l'errore appaia in <1 min

# Test logger masking:
# In una route: logger.info('user login', { email: 'test@test.com' })
# Verifica che nei log appaia: { email: '[REDACTED]' } o similar
```

### Note implementative

- Sentry release tagging: `next.config.ts` deve passare `git rev-parse HEAD` come release per sourcemap upload corretto
- Logger pino raccomandato (più veloce di winston, native JSON, ottimo Sentry integration via `pino-sentry-transport`)
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
**Effort**: 2-3 giorni
**Dependencies**: T04 completato
**Owner**: TBD

### Issue

- Marzo 2026: 116+ instances di `console.log/error/warn` in `src/app/api/*/route.ts` e `src/lib/services/*.ts`
- **Maggio 2026**: down a **76 residue** (pre-roadmap cleanup)
- Conseguenza: log non strutturati, PII leak rischio (es. `console.error(error)` con response full), Sentry non vede gli eventi

### Acceptance criteria

- [ ] 0 `console.*` in `src/` (eccetto `src/types/` o file di config se utile)
- [ ] Sostituzioni mapping:
  - `console.log` → `logger.info` o `logger.debug` (basato su criticità)
  - `console.warn` → `logger.warn`
  - `console.error` → `logger.error`
- [ ] Errori tipizzati: `logger.error('description', { err, context })` non `logger.error(err)`
- [ ] Mai loggare oggetti completi che possono contenere PII (api response, request body senza sanitize)
- [ ] Pattern verificato: `src/app/api/providers/test/route.ts` non logga più API key in error (S2 separato)

### Files

- Tutti i file in `src/app/api/` con occorrenze
- Tutti i file in `src/lib/services/` con occorrenze
- Possibilmente alcuni in `src/lib/` se hanno console statement

### Strategia

1. `grep -rn "console\." src/ | grep -v test | grep -v __tests__` per lista
2. Rimuovi/sostituisci una directory alla volta
3. PR group di 3-5 directory per essere reviewable
4. Test PASS dopo ogni gruppo

### Verifica

```bash
# Conta residue:
grep -r "console\." src/ --include="*.ts" --include="*.tsx" | grep -v test | grep -v __tests__ | wc -l
# Target: ~0 (alcune eccezioni se hai script standalone in src/scripts/)

pnpm type-check
pnpm test
```

---

## T06 — CI gate: type-check + lint + test in pre-commit + PR

**Severity**: S3 (warning) ma **gating** per future Fase
**Effort**: 1 giorno
**Dependencies**: nessuna (può partire subito, si aggiornerà se T04 cambia dipendenze)
**Owner**: TBD

### Acceptance criteria

- [ ] `husky` o `lefthook` installato per pre-commit hook
- [ ] Pre-commit hook esegue: `pnpm type-check && pnpm lint --max-warnings 0` su file staged
- [ ] GitHub Actions workflow `.github/workflows/ci.yml` esegue su ogni PR + push to main:
  - `pnpm install --frozen-lockfile`
  - `pnpm type-check`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build` (smoke check)
- [ ] PR block se workflow fails (branch protection rule su `main`)
- [ ] README aggiornato con "How to run quality checks locally"

### Files

- `.husky/pre-commit` (o `lefthook.yml`)
- `.github/workflows/ci.yml` (nuovo)
- `package.json` (script `prepare` per husky install)
- `README.md` (sezione "Development workflow")

### Verifica

```bash
# Pre-commit:
git commit -m "test" # → triggera hook
# Modifica un file con errore type:
echo "const x: number = 'foo'" >> src/test.ts
git add . && git commit -m "test"   # → hook deve bloccare

# CI: aprire PR test e verificare workflow run
```

### Note

- Branch protection rule su `main` da configurare via GitHub UI (impostazione repo, non file)
- `lint-staged` come integration optional per lintare solo file staged (perf)

---

## ✅ Definition of Done Fase 0

- [ ] T02-T06 tutti merged in `main` (T01 è già pre-done)
- [ ] `pnpm type-check` produce 0 errori
- [ ] `pnpm lint` produce 0 warning (o tutti documentati)
- [ ] `pnpm test` PASS
- [ ] `pnpm test:e2e` PASS (se esistenti)
- [ ] `grep -rn "as any" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v __tests__ | wc -l` → ~0
- [ ] `grep -rn "console\." src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v __tests__ | wc -l` → ~0
- [ ] Sentry dashboard mostra eventi reali da dev (test)
- [ ] CI workflow GitHub Actions verde su `main`
- [ ] Branch protection attiva su `main`
- [ ] task-tracker.md aggiornato a "Done" per tutti i T01-T06

## 🚀 Quando passare a Fase 1

Solo dopo DoD Fase 0 completo. Se uno dei punti DoD non è True → finire T0X first.

---

**Tornare alla mappa**: [README.md](README.md).
**Prossima fase**: [02-fase-1-workspace-audit.md](02-fase-1-workspace-audit.md).
