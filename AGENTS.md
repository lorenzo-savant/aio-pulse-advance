# AIO Pulse — Instruktioner för coding agents (Cursor / Claude Code / andra)

> **Projektets ingång för AI-agenter.** Läs detta innan du gör några ändringar.

---

## 1. Projektets identitet

**AIO Pulse** är en proprietär SaaS som mäter **AI Visibility Index** (AVI) genom att programmatiskt anropa de ledande LLM:erna (ChatGPT, Claude, Perplexity, Gemini) och generativa SERP:er (Google AI Overviews).

- Stack: Next.js 14 (App Router), TypeScript strict, Tailwind v3, Prisma + Supabase Postgres, Stripe, Sentry, Vitest, Playwright, Upstash Redis
- Aktuell version: 2.0.0
- Status: production-ready foundation, i övergång mot **SMB/prosumer + enterprise-lite** ($49–499/månad SMB + custom mid-market deals upp till ~€50k ARR)
- Fullständig roadmap: [docs/enterprise-roadmap/](docs/enterprise-roadmap/README.md)

## 2. Den här fasens uppdrag (Q2-Q3 2026)

Förvandla AIO Pulse från "production-grade boilerplate" till **kommersiell SaaS säljbar till SMB och mid-market** på 10-14 veckor.

**Målsegment**: marknadsföringsbyråer, SMB ($199-499/månad), prosumer ($49-99/månad), mid-market-team via founder-led sales med custom-offerter.

**Uttryckligen utanför scope** (bygg inte, föreslå inte, lägg inte till):

- ❌ SAML 2.0 SSO (Google + Microsoft OAuth räcker för målgruppen)
- ❌ SCIM 2.0 provisioning
- ❌ SOC 2 / ISO 27001 / extern penetrationstest
- ❌ Multi-region active-active / data residency selection
- ❌ Procurement integrations (Coupa, Ariba, SAP, ServiceNow)
- ❌ BYOK encryption at rest
- ❌ HIPAA / FedRAMP
- ❌ Status page SLA-grade enterprise
- ❌ VPC peering / IP allowlist enterprise

Om du frestas att lägga till någon av dessa: **stopp, fråga människan om bekräftelse först**. Resonemanget finns i [docs/enterprise-roadmap/00-mission-scope-rules.md](docs/enterprise-roadmap/00-mission-scope-rules.md).

## 3. Roadmapens 4 faser

| Fas   | Titel                                         | Varaktighet | Fil med uppgifterna                                                                        |
| ----- | --------------------------------------------- | -------- | ------------------------------------------------------------------------------------------ |
| **0** | Teknisk städning (förutsättning)              | 3-4 v    | [01-fase-0-pulizia.md](docs/enterprise-roadmap/01-fase-0-pulizia.md)                       |
| **1** | Workspace tier + audit log + scoped API keys  | 3-4 v    | [02-fase-1-workspace-audit.md](docs/enterprise-roadmap/02-fase-1-workspace-audit.md)       |
| **2** | SSO + MFA + Trust Center + GDPR + status page | 2-3 v    | [03-fase-2-trust-gdpr.md](docs/enterprise-roadmap/03-fase-2-trust-gdpr.md)                 |
| **3** | Seat billing + onboarding + API docs          | 2-3 v    | [04-fase-3-billing-onboarding.md](docs/enterprise-roadmap/04-fase-3-billing-onboarding.md) |

**Sekvensbegränsning**: Fas 0 → Fas 1 → Fas 2/3 (de två sistnämnda kan köras parallellt).

Live task tracker: [docs/enterprise-roadmap/task-tracker.md](docs/enterprise-roadmap/task-tracker.md).

## 4. Kommandon du måste känna till

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

→ Miljödetaljer: [ENVIRONMENTS.md](ENVIRONMENTS.md).

## 5. Icke förhandlingsbara coding standards

Fullständig referens: [docs/enterprise-roadmap/00-mission-scope-rules.md](docs/enterprise-roadmap/00-mission-scope-rules.md) sektionen "Coding standards".

Fem punkter som underkänner vilken PR som helst:

1. **Type safety**: noll nya `(db as any)` eller `as any` införda. Om du måste, använd `// @ts-expect-error` med förklarande kommentar. PR-kontrollen failar om `npm type-check` inte passerar.
2. **Inget console.log i produktion**: använd `logger` från [`src/lib/logger.ts`](src/lib/logger.ts). Om det ännu inte finns någon structured logger, använd pino setup som uppgift i [Fas 0](docs/enterprise-roadmap/01-fase-0-pulizia.md).
3. **Logga aldrig PII eller secrets**: e-post, IP, JWT, API key, lösenord loggas aldrig raw. Automatisk maskering via logger middleware (se Fas 0).
4. **Supabase-migration**: varje schema change går via `prisma migrate dev --name <kebab-case-descriptive>`. Migrationerna är **forward-only** i produktion — inga automatiska rollbacks, inga "fix"-migrationer som skriver om historien. Lokalt test + staging först.
5. **Obligatoriska tester för nya features**: ny API-endpoint = Vitest-test + integration test på route. Nytt användarflöde = Playwright E2E. Coverage-tröskeln är inte strikt, men "untested = unmerged".

## 6. Kodkonventioner

- **Namngivning**: `camelCase` för JS-variabler/funktioner, `PascalCase` för type/interface/class/component, `kebab-case` för filer och mappar, `snake_case` för DB-kolumner (Prisma `@map` konverterar)
- **Filstruktur**: för ny feature, följ mönstret:
  - `src/lib/services/<feature>.ts` — ren business logic
  - `src/app/api/<feature>/route.ts` — HTTP-lager
  - `src/lib/__tests__/<feature>.test.ts` — unit test
  - UI-komponent: `src/components/<area>/<Component>.tsx`
- **Validering**: varje route-input går via Zod schema. Lita aldrig på user input.
- **Errors**: throw `AppError` (definieras i Fas 0 om den inte finns), aldrig nakna strängar. Automatisk Sentry capture via middleware.

## 7. Commit- & PR-regler

- **Commit message-format**: konventionellt men avslappnat. `<type>: <imperativo>` (t.ex. `feat: add audit log instrumentation`, `fix: type errors in onboarding route`)
- **Branch naming**: `fase-N/<task-id>-<slug>` (t.ex. `fase-0/T01-fix-onboarding-imports`, `fase-1/T07-workspace-migration`)
- **PR-storlek**: < 400 rader diff när det är möjligt. Enorma PR:er är en red flag.
- **PR-titel**: innehåller task-ID (t.ex. `[T01] Fix onboarding imports + type safety`)
- **PR-beskrivning**: inkludera task DoD-checklista kopierad från task-dokumentet (se 01-fase-0-pulizia.md osv.)

## 8. När du ska fråga människan (founder)

STOPP-triggers — fortsätt inte utan bekräftelse:

- Ändringar i `prisma/schema.prisma` som **ändrar** eller **droppar** befintliga kolumner/tabeller (additiva är OK)
- Ändringar i billing-flödet / Stripe webhook
- Ändringar i autentiseringen / Supabase Auth config
- Nya npm-beroenden med icke-MIT/Apache/BSD-licens
- Nya env var som krävs i produktion
- Ändringar som kräver modifiering av Vercel-config
- Allt som är "utanför scope" för [målsegmentet](docs/enterprise-roadmap/00-mission-scope-rules.md)

I alla andra fall: fortsätt, dokumentera, öppna PR.

## 9. Status för kända issues (CODE_REVIEW.md, mars 2026)

Innan arbete på Fas 1+ påbörjas, fixa blockerarna (från CODE_REVIEW.md, mars 2026 — historisk rapport borttagen från repot):

- **3 critical (S1)**: trasig import i `onboarding/route.ts`, type bypass `(db as any)`, supabase return types svaga → allt i [Task T01-T02 i Fas 0](docs/enterprise-roadmap/01-fase-0-pulizia.md)
- **5 errors (S2)**: 125+ `(db as any)`, 116+ `console.log`, ohanterade promises, API key leak i error log → [Task T03-T05 i Fas 0](docs/enterprise-roadmap/01-fase-0-pulizia.md)
- **4 warnings (S3)**: naming inconsistencies, magic numbers, CSS organization → opportunistisk cleanup under Fas 0

## 10. Rekommenderat arbetsmönster för coding agents

När du startar en session på detta projekt:

1. **Läs** [docs/enterprise-roadmap/task-tracker.md](docs/enterprise-roadmap/task-tracker.md) för att se aktuell status
2. **Plocka en uppgift** "Ready" (förutsättningar klara, owner ledig)
3. **Uppdatera** task-tracker.md → status "In Progress" + ditt agent-namn + timestamp
4. **Skapa branch**: `git checkout -b fase-N/<task-id>-<slug>`
5. **Läs hela uppgiften** i fas-dokumentet (DoD, ändrade filer, krävda tester)
6. **Implementera** med respekt för coding standards (sek. 5)
7. **Lokala tester**: `npm type-check && npm lint && npm test`
8. **Commit + push + PR** med DoD-checklista
9. **Uppdatera** task-tracker.md → status "In Review"
10. Först efter merge + deploy: status "Done"

## 11. Vad du ALDRIG ska göra

- ❌ Ändra `prisma/schema.prisma` utan att generera matchande migration
- ❌ Committa `.env*`-filer eller secrets i någon form
- ❌ Inaktivera Sentry för att "minska brus" — bruset är information
- ❌ Lägga till `eslint-disable` eller `// @ts-ignore` som snabb fix (alltid `@ts-expect-error` med motivering)
- ❌ "Opportunistisk" refaktorering som inte efterfrågas i uppgiften — håll dig inom scope
- ❌ Lägga till nya npm-beroenden "för att de är användbara" — fråga först
- ❌ Markera en uppgift "Done" om tester failar eller type-check är röd
- ❌ Force-pusha till `main` eller delade brancher
- ❌ Öppna PR utan att lokala tester passerar

## 12. Tekniska referensdokument (finns redan i repot)

| Doc                                                            | När du ska konsultera det                          |
| -------------------------------------------------------------- | -------------------------------------------------- |
| [README.md](README.md)                                         | Översikt + grundsetup                              |
| [SECURITY.md](SECURITY.md)                                     | Säkerhetsstatus mars 2026, baseline att förbättra  |
| [BILLING_SETUP.md](BILLING_SETUP.md)                           | Stripe-konfiguration (test + live)                 |
| [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)                     | Deploy-procedurer Vercel                           |
| [ENVIRONMENTS.md](ENVIRONMENTS.md)                             | Environment variables management                   |
| [GUIDA_ENCRYPTION_GENERATOR.md](GUIDA_ENCRYPTION_GENERATOR.md) | Encryption tooling docs                            |

## 13. Kundkontext

AIO Pulse är även det centrala mätverktyget för **Acasting-strategin** (kund Q1 2026) — `~/Desktop/dev-projects/seo-parasite-strategy-aeo-geo-aio/seo-parasite-strategy/`. Acasting blir SaaS:ens **första verkliga kommersiella deployment**, så:

- Direkt feedback från Acasting-founder om produktluckor = prioritet i roadmapen
- De 60 frågorna i [query-inventory.md](file:///c:/Users/loren/Desktop/dev-projects/seo-parasite-strategy-aeo-geo-aio/seo-parasite-strategy/06-assets/query-inventory.md) är de första riktiga prompterna att seeda i produktion
- Buggar som hittas under Acasting-setup har prioritet över "lite"-roadmapen

---

**Tillbaka till toppen**: [Punkt 3 — Roadmapens 4 faser](#3-le-4-fasi-della-roadmap).
**Börja arbeta**: [docs/enterprise-roadmap/task-tracker.md](docs/enterprise-roadmap/task-tracker.md).

<!-- OCR:START -->
## Open Code Review Instructions

These instructions are for AI assistants handling code review in this project.

Always open `.ocr/skills/SKILL.md` when the request:
- Asks for code review, PR review, or feedback on changes
- Mentions "review my code" or similar phrases
- Wants multi-perspective analysis of code quality
- Asks to map, organize, or navigate a large changeset

Use `.ocr/skills/SKILL.md` to learn:
- How to run the 8-phase review workflow
- How to generate a Code Review Map for large changesets
- Available reviewer personas and their focus areas
- Session management and output format

Keep this managed block so `ocr init` can refresh the instructions.

<!-- OCR:END -->
