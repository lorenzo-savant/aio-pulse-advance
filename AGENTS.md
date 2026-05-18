# AIO Pulse — Istruzioni per coding agent (OpenCode / Cursor / Claude Code)

> **Front door del progetto per AI agent.** Leggi questo prima di qualsiasi modifica.

---

## 1. Identità del progetto

**AIO Pulse** è una SaaS proprietaria che misura l'**AI Visibility Index** (AVI) interrogando programmaticamente i principali LLM (ChatGPT, Claude, Perplexity, Gemini) e SERP generative (Google AI Overviews).

- Stack: Next.js 14 (App Router), TypeScript strict, Tailwind v3, Prisma + Supabase Postgres, Stripe, Sentry, Vitest, Playwright, Upstash Redis
- Versione corrente: 2.0.0
- Stato: production-ready foundation, in transizione verso **SMB/prosumer + enterprise-lite** ($49–499/mese SMB + custom mid-market deals fino a ~€50k ARR)
- Roadmap completa: [docs/enterprise-roadmap/](docs/enterprise-roadmap/README.md)

## 2. La missione di questa fase (Q2-Q3 2026)

Trasformare AIO Pulse da "production-grade boilerplate" a **SaaS commerciale vendibile a SMB e mid-market** in 10-14 settimane.

**Target segment**: agenzie marketing, SMB ($199-499/mese), prosumer ($49-99/mese), team mid-market via founder-led sales con quote custom.

**Esplicitamente fuori scope** (non costruire, non proporre, non aggiungere):

- ❌ SAML 2.0 SSO (Google + Microsoft OAuth bastano per il target)
- ❌ SCIM 2.0 provisioning
- ❌ SOC 2 / ISO 27001 / penetration test esterno
- ❌ Multi-region active-active / data residency selection
- ❌ Procurement integrations (Coupa, Ariba, SAP, ServiceNow)
- ❌ BYOK encryption at rest
- ❌ HIPAA / FedRAMP
- ❌ Status page SLA-grade enterprise
- ❌ VPC peering / IP allowlist enterprise

Se senti la tentazione di aggiungere uno di questi: **stop, chiedi conferma all'umano prima**. Il rationale è in [docs/enterprise-roadmap/00-mission-scope-rules.md](docs/enterprise-roadmap/00-mission-scope-rules.md).

## 3. Le 4 fasi della roadmap

| Fase  | Titolo                                        | Durata   | File con i task                                                                            |
| ----- | --------------------------------------------- | -------- | ------------------------------------------------------------------------------------------ |
| **0** | Pulizia tecnica (prerequisito)                | 3-4 sett | [01-fase-0-pulizia.md](docs/enterprise-roadmap/01-fase-0-pulizia.md)                       |
| **1** | Workspace tier + audit log + scoped API keys  | 3-4 sett | [02-fase-1-workspace-audit.md](docs/enterprise-roadmap/02-fase-1-workspace-audit.md)       |
| **2** | SSO + MFA + Trust Center + GDPR + status page | 2-3 sett | [03-fase-2-trust-gdpr.md](docs/enterprise-roadmap/03-fase-2-trust-gdpr.md)                 |
| **3** | Seat billing + onboarding + API docs          | 2-3 sett | [04-fase-3-billing-onboarding.md](docs/enterprise-roadmap/04-fase-3-billing-onboarding.md) |

**Vincolo di sequenza**: Fase 0 → Fase 1 → Fase 2/3 (queste due possono parallelizzare).

Task tracker live: [docs/enterprise-roadmap/task-tracker.md](docs/enterprise-roadmap/task-tracker.md).

## 4. Comandi che devi conoscere

```bash
# Setup e sviluppo
npm install              # NB: il progetto usa npm (lock file npm-lock.yaml? verifica). Se è npm, sostituisci.
npm dev                  # http://localhost:3000

# Quality gate — DEVE PASSARE prima di ogni commit
npm type-check           # tsc --noEmit
npm lint
npm format               # Prettier
npm test                 # Vitest unit + integration
npm test:e2e             # Playwright (più lento, run before PR not before commit)

# Security
npm security:audit       # npm audit + custom check
npm security:audit:fix
npm security:check

# Database (Prisma + Supabase)
npx prisma generate                                # rigenera client dopo schema change
npx prisma migrate dev --name <descriptive>        # crea nuova migration locale
npx prisma migrate deploy                          # applica in prod (CI/CD)
npx prisma studio                                  # UI per ispezionare DB
npm run db:gen-types                               # rigenera src/types/database.ts da schema Supabase live

# Build
npm build
npm start                # production-mode locale
```

→ Dettagli ambienti: [ENVIRONMENTS.md](ENVIRONMENTS.md).

## 5. Coding standards non negoziabili

Riferimento completo: [docs/enterprise-roadmap/00-mission-scope-rules.md](docs/enterprise-roadmap/00-mission-scope-rules.md) sezione "Coding standards".

Cinque punti che bocciano qualsiasi PR:

1. **Type safety**: zero `(db as any)` o `as any` introdotti nuovi. Se devi, usa `// @ts-expect-error` con commento esplicativo. Il PR check fa fail se `npm type-check` non passa.
2. **No console.log in produzione**: usa `logger` da [`src/lib/logger.ts`](src/lib/logger.ts). Se non c'è ancora structured logger, usa pino setup come task in [Fase 0](docs/enterprise-roadmap/01-fase-0-pulizia.md).
3. **Mai loggare PII o secrets**: email, IP, JWT, API key, password mai loggati raw. Mascheratura automatica via logger middleware (vedi Fase 0).
4. **Migration Supabase**: ogni schema change passa per `prisma migrate dev --name <kebab-case-descriptive>`. Le migration sono **forward-only** in produzione — niente rollback automatici, niente migration "fix" che riscrivono storia. Test locale + staging prima.
5. **Tests obbligatori per nuovi feature**: nuovo endpoint API = test Vitest + integration test su route. Nuovo workflow utente = Playwright E2E. Soglia coverage non rigida, ma "untested = unmerged".

## 6. Conventions di codice

- **Naming**: `camelCase` per variabili/funzioni JS, `PascalCase` per type/interface/class/component, `kebab-case` per file e folder, `snake_case` per colonne DB (Prisma `@map` converte)
- **File structure**: per nuova feature, segui pattern:
  - `src/lib/services/<feature>.ts` — business logic pura
  - `src/app/api/<feature>/route.ts` — HTTP layer
  - `src/lib/__tests__/<feature>.test.ts` — unit test
  - Component UI: `src/components/<area>/<Component>.tsx`
- **Validation**: ogni route input passa per Zod schema. Mai trust user input.
- **Errors**: throw `AppError` (da definire in Fase 0 se non esiste), mai stringhe nude. Sentry capture automatico via middleware.

## 7. Commit & PR rules

- **Commit message format**: convenzionale ma rilassato. `<type>: <imperativo>` (es. `feat: add audit log instrumentation`, `fix: type errors in onboarding route`)
- **Branch naming**: `fase-N/<task-id>-<slug>` (es. `fase-0/T01-fix-onboarding-imports`, `fase-1/T07-workspace-migration`)
- **PR size**: < 400 righe di diff quando possibile. PR enormi sono red flag.
- **PR title**: contiene task ID (es. `[T01] Fix onboarding imports + type safety`)
- **PR description**: include task DoD checklist copiato dal task doc (vedi 01-fase-0-pulizia.md ecc.)

## 8. Quando chiedere all'umano (founder)

Trigger di STOP — non procedere senza conferma:

- Modifiche a `prisma/schema.prisma` che **alterano** o **droppano** colonne/tabelle esistenti (le additive sono OK)
- Modifiche al billing flow / Stripe webhook
- Modifiche all'autenticazione / Supabase Auth config
- Nuove dipendenze npm con licenza non-MIT/Apache/BSD
- Nuove env var necessarie in produzione
- Cambiamenti che richiedono modifica config Vercel
- Tutto ciò che è "fuori scope" del [target segment](docs/enterprise-roadmap/00-mission-scope-rules.md)

In tutti gli altri casi: procedi, documenta, apri PR.

## 9. Stato delle issue note (CODE_REVIEW.md, Marzo 2026)

Prima di iniziare lavoro su Fase 1+, fixare i blocker (da CODE_REVIEW.md, marzo 2026 — report storico rimosso dal repo):

- **3 critical (S1)**: import broken in `onboarding/route.ts`, type bypass `(db as any)`, supabase return types weak → tutto in [Task T01-T02 di Fase 0](docs/enterprise-roadmap/01-fase-0-pulizia.md)
- **5 errors (S2)**: 125+ `(db as any)`, 116+ `console.log`, promise non gestite, API key leak in error log → [Task T03-T05 di Fase 0](docs/enterprise-roadmap/01-fase-0-pulizia.md)
- **4 warnings (S3)**: naming inconsistencies, magic numbers, CSS organization → cleanup opportunistico durante Fase 0

## 10. Pattern di lavoro raccomandato per OpenCode

Quando inizi una sessione su questo progetto:

1. **Leggi** [docs/enterprise-roadmap/task-tracker.md](docs/enterprise-roadmap/task-tracker.md) per vedere lo stato corrente
2. **Pesca un task** "Ready" (prerequisiti completi, owner libero)
3. **Aggiorna** task-tracker.md → status "In Progress" + tuo nome agent + timestamp
4. **Crea branch**: `git checkout -b fase-N/<task-id>-<slug>`
5. **Leggi il task** completo nel doc di fase (DoD, file modificati, test richiesti)
6. **Implementa** rispettando coding standards (sez. 5)
7. **Test locali**: `npm type-check && npm lint && npm test`
8. **Commit + push + PR** con DoD checklist
9. **Aggiorna** task-tracker.md → status "In Review"
10. Solo dopo merge + deploy: status "Done"

## 11. Cosa NON fare mai

- ❌ Modificare `prisma/schema.prisma` senza generare migration matching
- ❌ Committare `.env*` files o secrets in qualsiasi forma
- ❌ Disabilitare Sentry per "ridurre noise" — il noise è informazione
- ❌ Aggiungere `eslint-disable` o `// @ts-ignore` come fix rapido (sempre `@ts-expect-error` con motivo)
- ❌ Refactor "opportunistico" non richiesto nel task — sta in scope
- ❌ Aggiungere nuove dipendenze npm "perché utili" — chiedi prima
- ❌ Marcare task "Done" se test falliscono o type-check è rosso
- ❌ Force-push su `main` o branch condivisi
- ❌ Aprire PR senza local test pass

## 12. Documenti tecnici di riferimento (già esistenti nel repo)

| Doc                                                            | Quando consultarlo                                 |
| -------------------------------------------------------------- | -------------------------------------------------- |
| [README.md](README.md)                                         | Overview + setup base                              |
| [SECURITY.md](SECURITY.md)                                     | Stato sicurezza marzo 2026, baseline da migliorare |
| [BILLING_SETUP.md](BILLING_SETUP.md)                           | Configurazione Stripe (test + live)                |
| [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)                     | Deploy procedures Vercel                           |
| [ENVIRONMENTS.md](ENVIRONMENTS.md)                             | Environment variables management                   |
| [GUIDA_ENCRYPTION_GENERATOR.md](GUIDA_ENCRYPTION_GENERATOR.md) | Encryption tooling docs                            |

## 13. Contesto cliente

AIO Pulse è anche il tool centrale di misurazione della **strategia Acasting** (cliente Q1 2026) — `~/Desktop/dev-projects/seo-parasite-strategy-aeo-geo-aio/seo-parasite-strategy/`. Acasting sarà il **primo deployment commerciale reale** della SaaS, quindi:

- Feedback diretto founder Acasting su gaps prodotto = priorità in roadmap
- Le 60 query in [query-inventory.md](file:///c:/Users/loren/Desktop/dev-projects/seo-parasite-strategy-aeo-geo-aio/seo-parasite-strategy/06-assets/query-inventory.md) sono i primi prompt veri da seedare in produzione
- Bug trovati durante setup Acasting hanno priorità su roadmap "lite"

---

**Tornare in cima**: [Punto 3 — Le 4 fasi della roadmap](#3-le-4-fasi-della-roadmap).
**Iniziare lavoro**: [docs/enterprise-roadmap/task-tracker.md](docs/enterprise-roadmap/task-tracker.md).
