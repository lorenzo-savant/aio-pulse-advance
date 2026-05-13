# 00 — Mission, Scope, Rules

> Il file più importante del progetto in questa fase. Tutti i task derivano da queste regole.

---

## 🎯 Mission

> Trasformare AIO Pulse da production-grade boilerplate a SaaS commercialmente vendibile a SMB ($49-499/mese) + agenzie + team mid-market (custom deals fino a ~€50k ARR) **in 10-14 settimane**.

Non costruiamo per Fortune 1000. Non costruiamo per regulated industries. Costruiamo per **agency owner + marketing director SMB + founder prosumer** che vogliono uno strumento serio ma non vogliono fare procurement.

## 🎬 Target buyer personas

### Persona 1 — "Agency Owner Alex"
- 5-30 dipendenti, gestisce 8-25 clienti
- Cerca: white-label report, multi-cliente in dashboard, fatturazione mensile
- Friction tolerata: medium (è abituato a SaaS)
- Pricing tier target: $199-499/mese
- Cosa lo blocca: white-label che non funziona, no multi-workspace, billing confuso

### Persona 2 — "Marketing Director Maria"
- Mid-market 100-1.000 dipendenti
- Cerca: tool da convincere il CIO senza passare 6 mesi di procurement
- Friction tolerata: bassa-media
- Pricing tier target: custom €20-50k ARR via founder-led sales
- Cosa la blocca: no SSO, no audit log, no DPA scaricabile

### Persona 3 — "Founder Felix"
- Solo founder o early-stage team 1-10
- Cerca: monitoring brand visibility veloce + insight actionable
- Friction tolerata: alta (technical capable)
- Pricing tier target: $49-99/mese
- Cosa lo blocca: onboarding lento, valore non chiaro al day 1

Tutti i task della roadmap devono spostare l'ago per almeno una di queste personas.

## ✅ Scope IN (cosa costruiamo)

### Architettura
- ✅ Organization → Workspace → Brand → Prompt hierarchy (vera multi-tenant)
- ✅ RBAC con 4 ruoli (Owner, Admin, Editor, Viewer) a livello workspace
- ✅ Audit log immutabile per azioni critical
- ✅ Scoped API keys con permission model
- ✅ Type-safe codebase end-to-end

### Identity
- ✅ Email/password + JWT (già esistente)
- ✅ SSO Google OAuth
- ✅ SSO Microsoft (Azure AD personal/work — non SAML enterprise full)
- ✅ MFA TOTP opzionale, enforceable per workspace admin

### Security
- ✅ Scoped API keys
- ✅ Audit log immutabile + exportabile
- ✅ Logger strutturato senza PII leak
- ✅ Sentry instrumentation completa
- ✅ Rate limiting + Zod validation (già esistente)

### Compliance & Trust
- ✅ GDPR data export self-serve
- ✅ GDPR data deletion self-serve (30-day grace + hard delete)
- ✅ DPA template scaricabile
- ✅ Sub-processor list pubblica
- ✅ Trust Center page (Notion/Webflow/static)
- ✅ Status page basic (Instatus o BetterStack)

### Billing
- ✅ Seat-based billing via Stripe
- ✅ Subscription management UI per Org admin
- ✅ Manual invoicing per custom plan (Stripe Invoicing API)
- ✅ NET-30 supportato per custom

### UX & Onboarding
- ✅ Onboarding wizard completo signup → first analysis in <10 min
- ✅ In-app guide / empty states
- ✅ API docs complete con esempi per endpoint
- ✅ SDK starter (TypeScript snippet, Python snippet)

## 🚫 Scope OUT (esplicitamente non costruiamo)

### Identity / Compliance
- ❌ **SAML 2.0** — Okta, Azure AD enterprise full, OneLogin, JumpCloud setup. Google + Microsoft OAuth coprono il 95% del target SMB.
- ❌ **SCIM 2.0 provisioning** — user lifecycle automation da IdP. Manuale è OK per <100 seat workspace.
- ❌ **SOC 2 Type II** — costa 25-50k EUR + 6-9 mesi observation. Senza è blocker per Fortune 1000 ma OK per SMB.
- ❌ **ISO 27001** — 30-60k EUR. Same as SOC 2.
- ❌ **Penetration test esterno** (CrowdStrike, NCC Group, etc.) — npm audit + Vercel WAF coprono OWASP baseline.
- ❌ **HIPAA, FedRAMP, CMMC** — verticali specifici, fuori target.

### Infrastructure
- ❌ **Multi-region active-active** — Supabase single region (EU) per ora.
- ❌ **Data residency selection** (EU vs US vs APAC) — EU only.
- ❌ **VPC peering / Private endpoints** — non richiesto da SMB.
- ❌ **IP allowlist enterprise** — overkill per SMB.
- ❌ **BYOK encryption at rest** — Supabase default encryption è OK.

### Commercial
- ❌ **Procurement integrations** (Coupa, Ariba, SAP Ariba, ServiceNow, Workday) — solo per upper enterprise.
- ❌ **Custom MSA negotiation flow** — DPA template scaricabile + standard ToS bastano.
- ❌ **Dedicated CSM motion / QBR cadence** — founder-led sales coperto da email + Calendly.
- ❌ **Bug bounty pubblico** (HackerOne, Bugcrowd) — può venire dopo se signal.

### Ops & SRE
- ❌ **SLA contrattuali enterprise** (99.99%, RTO/RPO definiti) — best-effort dichiarato OK per SMB.
- ❌ **Status page SLA-grade** — Instatus free tier sufficiente.
- ❌ **Synthetic monitoring production-grade** (Checkly, Pingdom paid) — Sentry + Vercel native OK.
- ❌ **Load testing infrastructure dedicata** — fai uno spike ad-hoc quando serve.
- ❌ **On-call rotation formale** — alert Sentry → email founder è OK in questa fase.

### Tentazioni da resistere

Se durante implementazione senti "facciamo anche...", probabilmente sei in scope out. Esempi reali:
- "Aggiungiamo Datadog APM" → no, Sentry basta
- "Setup multi-region read replica" → no, single region EU
- "Custom domain per Trust Center" → forse, ma low priority
- "Slack + Discord + Teams integration" → uno alla volta, post-roadmap
- "Audit log con tamper-evidence hash chain" → overengineering per SMB

## 📐 Coding standards

### Type safety (livello 10/10)

- **Zero `any` non motivati**. Se proprio devi:
  ```ts
  // @ts-expect-error — Supabase generated types miss the JSON cast here. Tracked in #XXX.
  ```
- **Zero `(db as any)` introdotti nuovi**. Quelli esistenti da rimuovere in Fase 0 task T03.
- **Generated types Supabase obbligatori** in `src/types/supabase.ts`, rigenerati via `supabase gen types typescript ...`
- **Strict mode TypeScript**: già attivo, mai disattivare.
- **Public API surface**: tipi esportati per ogni endpoint via Zod schema, mai inferiti da any.

### Logging

- **Mai `console.log/error/warn/info` in src/**. Solo `logger.info/error/warn/debug` da `src/lib/logger.ts`.
- **Sentry breadcrumb auto** per ogni `logger.error`.
- **PII auto-masking**: il logger deve mascherare automaticamente `email`, `password`, `apiKey`, `token`, `creditCard`, `ip` (parziale). Setup in Fase 0 task T05.
- **Log levels**:
  - `debug` — info utile in dev, rimossa in prod build
  - `info` — eventi normali rilevanti per operations
  - `warn` — situazioni inattese ma non bloccanti
  - `error` — failure che richiedono attention

### Database & migration

- **Mai modificare schema senza migration matching**. Workflow: edit `prisma/schema.prisma` → `pnpm prisma migrate dev --name <descriptive>`.
- **Migration forward-only in prod**. Niente rollback automatici. Se hai sbagliato → migration "fix" forward, non rewrite.
- **Test migration su staging prima di prod**. Sempre.
- **Backup pre-migration distruttiva**. Per migration che alterano colonne/tabelle esistenti (rare), fare dump Supabase prima.
- **Nomi colonne**: `snake_case` in DB, Prisma `@map("col_name")` per convertire. JavaScript usa `camelCase`.
- **Soft delete dove possibile**: `deletedAt DateTime?` invece di `DELETE FROM` per dati business-critical (Brand, Prompt, etc.).

### API design

- **REST RESTful**: `GET /api/v1/brands`, `POST /api/v1/brands`, `PATCH /api/v1/brands/:id`, `DELETE /api/v1/brands/:id`.
- **Versionato**: `/api/v1/*` namespace, mai breaking change senza bump `/v2`.
- **Zod validation su ogni input**: query params, body, headers critical.
- **Error response format**:
  ```json
  {
    "error": {
      "code": "INVALID_INPUT",
      "message": "Brand name is required",
      "details": { "field": "name" }
    }
  }
  ```
- **Status codes**: 200/201/204 success, 400 client error, 401 unauth, 403 forbidden, 404 not found, 409 conflict, 422 unprocessable, 429 rate limit, 500 server error. Mai 200 con `error` body.
- **Rate limit headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (già presente — non rompere).

### Testing

- **Vitest** per unit + integration. Files `*.test.ts` co-locati o in `__tests__/`.
- **Playwright** per E2E. Files in `e2e/`.
- **Coverage non rigida ma**: ogni nuovo endpoint API ha almeno 3 test (happy + 1 error + 1 auth fail). Ogni nuovo workflow utente ha 1 E2E.
- **Mock policy**: mock external API (OpenAI, Supabase, Stripe) in unit test. Integration test usa test fixture Supabase local.
- **CI gate**: PR fails se test fails. Niente skip.

### Naming

- **Files**: `kebab-case.ts` (es. `workspace-auth.ts`)
- **Folders**: `kebab-case/`
- **Components React**: `PascalCase` (es. `BrandSwitcher.tsx`)
- **Functions/variables**: `camelCase` (es. `getCurrentWorkspace`)
- **Types/Interfaces/Classes**: `PascalCase` (es. `WorkspaceMember`, `BrandService`)
- **Constants**: `UPPER_SNAKE_CASE` (es. `DEFAULT_CREDITS`)
- **Enums**: `PascalCase` for type, `UPPER_SNAKE_CASE` for values
- **DB columns**: `snake_case` (Prisma `@map` converte)
- **API routes**: `/api/v1/<resource>` plural lowercase
- **Env vars**: `UPPER_SNAKE_CASE`, prefisso `NEXT_PUBLIC_` per client-side

## 🎯 Definition of Done universale

Un task è "Done" se TUTTI i seguenti sono true:

1. ✅ Codice implementato secondo brief del task
2. ✅ `pnpm type-check` PASS (zero errori)
3. ✅ `pnpm lint` PASS (warning OK se documentati)
4. ✅ `pnpm test` PASS (incluso nuovi test scritti per il task)
5. ✅ `pnpm test:e2e` PASS se task tocca user-facing flow
6. ✅ Documentazione aggiornata (README, AGENTS.md, ENVIRONMENTS.md se rilevante)
7. ✅ Migration Prisma applicabile pulita (se schema change)
8. ✅ Manual smoke test su `pnpm dev` per task UI
9. ✅ DoD checklist del task specifico (vedi singolo doc fase) tutta tickata
10. ✅ PR aperta con titolo `[TXX] <descrizione>` e DoD copiata
11. ✅ PR mergiata (review opzionale dipende da setup team)
12. ✅ task-tracker.md aggiornato a "Done" con commit SHA finale

## 🛑 Quando STOP (chiedere all'umano)

- Modifiche distruttive a `prisma/schema.prisma` (drop column/table, rename, type change)
- Modifiche al flow Stripe webhook
- Modifiche al flow di auth Supabase (configurazione, RLS major changes)
- Nuove env var necessarie in produzione
- Nuove dipendenze npm non strettamente necessarie
- Cambiamenti che richiedono Vercel config update
- Refactor di moduli oltre i file del task specifico
- Decisioni di architettura non documentate in roadmap (es. "facciamo questa cosa in modo diverso")
- Performance regression osservato dopo il task

## ✅ Quando GO (non chiedere)

- Bug fix nel codice toccato dal task
- Aggiunta test per il task
- Refactor MINORE all'interno dei file del task (rinominare variabile, estrarre funzione locale)
- Aggiornare README/AGENTS.md per riflettere il task
- Migration ADDITIVE (nuova tabella, nuova colonna nullable o con default)
- Aggiungere logger statement appropriati
- Aggiungere Sentry instrumentation

## 🧭 Lo spirito della roadmap

Quattro principi che guidano ogni decisione:

1. **Lean over complete** — un'implementazione che funziona per SMB oggi vale più di una "perfetta" per enterprise tra 6 mesi.
2. **Type-safe over fast** — fixare i 125+ `(db as any)` rallenta un PR ma previene 50 bug invisibili.
3. **Test the path, not the line** — E2E del flow critico vale 100 unit test di edge case rari.
4. **Document only what changes** — niente docs aggiornata = bug per il prossimo agent. Docs eccessiva = nessuno la legge.

---

**Tornare alla mappa**: [README.md](README.md).
**Iniziare**: [01-fase-0-pulizia.md](01-fase-0-pulizia.md).
