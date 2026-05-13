# Fase 0 — Pulizia tecnica (T01-T06)

> **Precondizione non negoziabile** per tutto il resto. 3-4 settimane, 25-40k EUR. Niente Fase 1+ finché Fase 0 non è completata.

---

## 🎯 Goal della fase

Eliminare il **debito tecnico bloccante** identificato in [CODE_REVIEW.md](../../CODE_REVIEW.md) (marzo 2026) prima che si amplifichi durante l'espansione architetturale di Fase 1.

## 📋 Task overview

| Task | Titolo | Effort | Deps |
|---|---|---|---|
| T01 | Fix imports + type bypass in `onboarding/route.ts` (S1) | ✅ Already done | — |
| T02 | Generate strong Supabase types + refactor `supabase.ts` (S1) | 1-2 giorni | — |
| T03 | Kill residual `(db as any)` across API routes (S2) — 125+ → 1 | 0.5-1 giorno | — |
| T04 | Structured logger: pino + PII masking + Sentry forward (S2) | 2-3 giorni | — |
| T05 | Replace 76 `console.log/error/warn` with logger (residual S2) | 2-3 giorni | T04 |
| T06 | CI gate: type-check + lint + test in pre-commit + PR (S3) | 1 giorno | — |

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

## T02 — Generate strong Supabase types + refactor `supabase.ts`

**Severity**: S1
**Effort**: 1-2 giorni
**Dependencies**: nessuna
**Owner**: TBD

### Issue

- `src/lib/supabase.ts` — `createServerClient()` return type è `any`, no strong typing
- Mancano tipi generati dallo schema Supabase reale → ogni query è untyped

### Acceptance criteria

- [ ] Generato `src/types/supabase.ts` via `supabase gen types typescript --project-id <id> > src/types/supabase.ts`
- [ ] `src/lib/supabase.ts` esporta `createServerClient<Database>()` tipizzato
- [ ] Esporta `createBrowserClient<Database>()` tipizzato
- [ ] Update `src/lib/supabase-browser.ts` analogamente
- [ ] `Database` type esportato per uso in altri file
- [ ] `npm script` aggiunto: `db:gen-types` → rigenera types Supabase
- [ ] Documentazione in `ENVIRONMENTS.md` su quando rigenerare

### Files

- `src/types/supabase.ts` (nuovo, generato)
- `src/lib/supabase.ts` (modificato)
- `src/lib/supabase-browser.ts` (modificato)
- `package.json` (script `db:gen-types`)
- `ENVIRONMENTS.md` (sezione "Type regeneration")

### Verifica

```bash
pnpm db:gen-types
pnpm type-check        # PASS
```

### Note implementative

- Project ID Supabase è in `.env.local` come `SUPABASE_PROJECT_ID` (verificare; se non esiste, aggiungere come env var)
- I types vanno committati in git (sono parte del codice)
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

## T04 — Structured logger: pino + PII masking + Sentry forward

**Severity**: S2
**Effort**: 2-3 giorni
**Dependencies**: nessuna
**Owner**: TBD

### Issue

- Sentry è installato (`@sentry/nextjs ^10.43.0` in package.json, `sentry.*.config.ts` esistenti) ma **non configurato** — DSN non attivo, dashboard vuota
- `src/lib/logger.ts` esiste ma è **custom artigianale**, non basato su pino/winston → no PII masking, no levels strutturati, no Sentry forward
- SECURITY.md flag "needs install + DSN config" ancora aperto
- Rischio PII leak: log non hanno masking su email, API key, token

### Acceptance criteria

- [ ] Sentry funzionante: errore lanciato in dev → visibile in dashboard Sentry
- [ ] `SENTRY_DSN` configurato in `.env.local` e documentato in `.env.example` + ENVIRONMENTS.md
- [ ] `pino` installato e configurato in `src/lib/logger.ts` (sostituisce logger custom attuale)
- [ ] Logger ha PII auto-masking: `email`, `password`, `apiKey`, `token`, `authorization` header, `creditCard`
- [ ] Logger forward errori a Sentry automatico (breadcrumb)
- [ ] Log levels: `debug` solo in dev, `info`/`warn`/`error` in prod
- [ ] Documentazione `src/lib/logger.ts` con esempi di uso

### Files

- `src/lib/logger.ts` (sostituisce implementazione custom attuale)
- `sentry.client.config.ts` (verifica config DSN)
- `sentry.server.config.ts` (verifica config DSN)
- `sentry.edge.config.ts` (verifica config DSN)
- `next.config.ts` (verifica Sentry plugin integration)
- `.env.example` (aggiunta `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`)
- `ENVIRONMENTS.md` (sezione Sentry + logger)

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
    '*.password', '*.apiKey', '*.token', '*.authorization',
    'email', 'password', 'apiKey', 'token',
    'headers.authorization', 'headers.cookie',
    'body.password', 'body.apiKey',
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
