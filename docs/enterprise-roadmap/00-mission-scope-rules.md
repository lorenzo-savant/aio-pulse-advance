# 00 — Mission, Scope, Rules

> Projektets viktigaste fil i denna fas. Alla task härleds från dessa regler.

---

## 🎯 Mission

> Förvandla AEO Pulse från production-grade boilerplate till en kommersiellt säljbar SaaS för SMB ($49-499/månad) + byråer + mid-market-team (custom deals upp till ~€50k ARR) **på 10-14 veckor**.

Vi bygger inte för Fortune 1000. Vi bygger inte för regulated industries. Vi bygger för **byråägare + marketing director SMB + founder prosumer** som vill ha ett seriöst verktyg men inte vill göra procurement.

## 🎬 Target buyer personas

### Persona 1 — "Agency Owner Alex"
- 5-30 anställda, hanterar 8-25 kunder
- Söker: white-label-rapport, multi-kund i dashboard, månadsfakturering
- Tolererad friction: medium (är van vid SaaS)
- Pricing tier target: $199-499/månad
- Vad som blockerar hen: white-label som inte fungerar, ingen multi-workspace, förvirrande billing

### Persona 2 — "Marketing Director Maria"
- Mid-market 100-1.000 anställda
- Söker: verktyg att övertyga CIO om utan att gå igenom 6 månaders procurement
- Tolererad friction: låg-medium
- Pricing tier target: custom €20-50k ARR via founder-led sales
- Vad som blockerar henne: ingen SSO, ingen audit log, ingen nedladdningsbar DPA

### Persona 3 — "Founder Felix"
- Solo founder eller early-stage team 1-10
- Söker: snabb monitoring av brand visibility + actionable insight
- Tolererad friction: hög (technical capable)
- Pricing tier target: $49-99/månad
- Vad som blockerar honom: långsam onboarding, oklart värde dag 1

Alla task i roadmapen måste flytta nålen för minst en av dessa personas.

## ✅ Scope IN (vad vi bygger)

### Arkitektur
- ✅ Organization → Workspace → Brand → Prompt hierarchy (äkta multi-tenant)
- ✅ RBAC med 4 roller (Owner, Admin, Editor, Viewer) på workspace-nivå
- ✅ Oföränderlig audit log för kritiska åtgärder
- ✅ Scoped API keys med permission model
- ✅ Type-safe codebase end-to-end

### Identity
- ✅ Email/password + JWT (redan befintligt)
- ✅ SSO Google OAuth
- ✅ SSO Microsoft (Azure AD personal/work — inte SAML enterprise full)
- ✅ MFA TOTP valfri, enforceable per workspace admin

### Security
- ✅ Scoped API keys
- ✅ Oföränderlig + exporterbar audit log
- ✅ Strukturerad logger utan PII leak
- ✅ Komplett Sentry instrumentation
- ✅ Rate limiting + Zod validation (redan befintligt)

### Compliance & Trust
- ✅ GDPR data export self-serve
- ✅ GDPR data deletion self-serve (30-day grace + hard delete)
- ✅ Nedladdningsbar DPA-mall
- ✅ Publik sub-processor list
- ✅ Trust Center page (Notion/Webflow/static)
- ✅ Status page basic (Instatus eller BetterStack)

### Billing
- ✅ Seat-based billing via Stripe
- ✅ Subscription management UI för Org admin
- ✅ Manual invoicing för custom plan (Stripe Invoicing API)
- ✅ NET-30 stödd för custom

### UX & Onboarding
- ✅ Komplett onboarding wizard signup → first analysis på <10 min
- ✅ In-app guide / empty states
- ✅ Kompletta API docs med exempel per endpoint
- ✅ SDK starter (TypeScript snippet, Python snippet)

## 🚫 Scope OUT (vad vi uttryckligen inte bygger)

### Identity / Compliance
- ❌ **SAML 2.0** — Okta, Azure AD enterprise full, OneLogin, JumpCloud setup. Google + Microsoft OAuth täcker 95% av SMB-targetet.
- ❌ **SCIM 2.0 provisioning** — user lifecycle automation från IdP. Manuellt är OK för workspace med <100 seat.
- ❌ **SOC 2 Type II** — kostar 25-50k EUR + 6-9 månaders observation. Utan det är det en blocker för Fortune 1000 men OK för SMB.
- ❌ **ISO 27001** — 30-60k EUR. Same as SOC 2.
- ❌ **Extern penetration test** (CrowdStrike, NCC Group, etc.) — npm audit + Vercel WAF täcker OWASP baseline.
- ❌ **HIPAA, FedRAMP, CMMC** — specifika vertikaler, utanför target.

### Infrastructure
- ❌ **Multi-region active-active** — Supabase single region (EU) för nu.
- ❌ **Data residency selection** (EU vs US vs APAC) — EU only.
- ❌ **VPC peering / Private endpoints** — inte efterfrågat av SMB.
- ❌ **IP allowlist enterprise** — overkill för SMB.
- ❌ **BYOK encryption at rest** — Supabase default encryption är OK.

### Commercial
- ❌ **Procurement integrations** (Coupa, Ariba, SAP Ariba, ServiceNow, Workday) — endast för upper enterprise.
- ❌ **Custom MSA negotiation flow** — nedladdningsbar DPA-mall + standard ToS räcker.
- ❌ **Dedicated CSM motion / QBR cadence** — founder-led sales täckt av email + Calendly.
- ❌ **Publik bug bounty** (HackerOne, Bugcrowd) — kan komma senare om signal.

### Ops & SRE
- ❌ **Kontraktuella enterprise-SLA** (99.99%, definierade RTO/RPO) — best-effort deklarerat OK för SMB.
- ❌ **Status page SLA-grade** — Instatus free tier räcker.
- ❌ **Synthetic monitoring production-grade** (Checkly, Pingdom paid) — Sentry + Vercel native OK.
- ❌ **Dedikerad load testing-infrastruktur** — gör en ad-hoc-spike när det behövs.
- ❌ **Formell on-call rotation** — alert Sentry → email founder är OK i denna fas.

### Frestelser att motstå

Om du under implementation känner "vi gör också...", är du förmodligen i scope out. Verkliga exempel:
- "Vi lägger till Datadog APM" → nej, Sentry räcker
- "Setup multi-region read replica" → nej, single region EU
- "Custom domain för Trust Center" → kanske, men low priority
- "Slack + Discord + Teams integration" → en i taget, post-roadmap
- "Audit log med tamper-evidence hash chain" → overengineering för SMB

## 📐 Coding standards

### Type safety (nivå 10/10)

- **Noll omotiverade `any`**. Om du verkligen måste:
  ```ts
  // @ts-expect-error — Supabase generated types miss the JSON cast here. Tracked in #XXX.
  ```
- **Noll nya introducerade `(db as any)`**. De befintliga ska tas bort i Fas 0 task T03.
- **Generated types Supabase obligatoriska** i `src/types/supabase.ts`, regenererade via `supabase gen types typescript ...`
- **Strict mode TypeScript**: redan aktivt, inaktivera aldrig.
- **Public API surface**: typer exporterade för varje endpoint via Zod schema, aldrig inferrerade från any.

### Logging

- **Aldrig `console.log/error/warn/info` i src/**. Endast `logger.info/error/warn/debug` från `src/lib/logger.ts`.
- **Sentry breadcrumb auto** för varje `logger.error`.
- **PII auto-masking**: loggern måste automatiskt maskera `email`, `password`, `apiKey`, `token`, `creditCard`, `ip` (partiellt). Setup i Fas 0 task T05.
- **Log levels**:
  - `debug` — info användbar i dev, borttagen i prod build
  - `info` — normala händelser relevanta för operations
  - `warn` — oväntade men icke-blockerande situationer
  - `error` — failure som kräver attention

### Database & migration

- **Ändra aldrig schema utan matchande migration**. Workflow: edit `prisma/schema.prisma` → `pnpm prisma migrate dev --name <descriptive>`.
- **Migration forward-only i prod**. Inga automatiska rollbacks. Om du gjort fel → migration "fix" forward, inte rewrite.
- **Testa migration på staging före prod**. Alltid.
- **Backup före destruktiv migration**. För migration som ändrar befintliga kolumner/tabeller (sällsynt), gör Supabase-dump innan.
- **Kolumnnamn**: `snake_case` i DB, Prisma `@map("col_name")` för att konvertera. JavaScript använder `camelCase`.
- **Soft delete där möjligt**: `deletedAt DateTime?` istället för `DELETE FROM` för business-kritisk data (Brand, Prompt, etc.).

### API design

- **REST RESTful**: `GET /api/v1/brands`, `POST /api/v1/brands`, `PATCH /api/v1/brands/:id`, `DELETE /api/v1/brands/:id`.
- **Versionerat**: `/api/v1/*` namespace, aldrig breaking change utan bump `/v2`.
- **Zod validation på varje input**: query params, body, kritiska headers.
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
- **Status codes**: 200/201/204 success, 400 client error, 401 unauth, 403 forbidden, 404 not found, 409 conflict, 422 unprocessable, 429 rate limit, 500 server error. Aldrig 200 med `error` body.
- **Rate limit headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (redan närvarande — bryt inte).

### Testing

- **Vitest** för unit + integration. Filer `*.test.ts` co-locerade eller i `__tests__/`.
- **Playwright** för E2E. Filer i `e2e/`.
- **Coverage inte strikt men**: varje ny API-endpoint har minst 3 test (happy + 1 error + 1 auth fail). Varje nytt användarworkflow har 1 E2E.
- **Mock policy**: mocka external API (OpenAI, Supabase, Stripe) i unit test. Integration test använder test fixture Supabase local.
- **CI gate**: PR fails om test fails. Inga skip.

### Naming

- **Files**: `kebab-case.ts` (t.ex. `workspace-auth.ts`)
- **Folders**: `kebab-case/`
- **Components React**: `PascalCase` (t.ex. `BrandSwitcher.tsx`)
- **Functions/variables**: `camelCase` (t.ex. `getCurrentWorkspace`)
- **Types/Interfaces/Classes**: `PascalCase` (t.ex. `WorkspaceMember`, `BrandService`)
- **Constants**: `UPPER_SNAKE_CASE` (t.ex. `DEFAULT_CREDITS`)
- **Enums**: `PascalCase` for type, `UPPER_SNAKE_CASE` for values
- **DB columns**: `snake_case` (Prisma `@map` konverterar)
- **API routes**: `/api/v1/<resource>` plural lowercase
- **Env vars**: `UPPER_SNAKE_CASE`, prefix `NEXT_PUBLIC_` för client-side

## 🎯 Universell Definition of Done

Ett task är "Done" om ALLA följande är true:

1. ✅ Kod implementerad enligt task-briefen
2. ✅ `pnpm type-check` PASS (noll fel)
3. ✅ `pnpm lint` PASS (warning OK om dokumenterade)
4. ✅ `pnpm test` PASS (inklusive nya test skrivna för tasket)
5. ✅ `pnpm test:e2e` PASS om tasket rör user-facing flow
6. ✅ Dokumentation uppdaterad (README, AGENTS.md, ENVIRONMENTS.md om relevant)
7. ✅ Prisma-migration ren och applicerbar (om schema change)
8. ✅ Manuell smoke test på `pnpm dev` för UI-task
9. ✅ DoD-checklista för det specifika tasket (se enskilt fas-doc) helt ibockad
10. ✅ PR öppnad med titel `[TXX] <descrizione>` och DoD kopierad
11. ✅ PR mergad (review valfri beroende på team-setup)
12. ✅ task-tracker.md uppdaterad till "Done" med slutlig commit SHA

## 🛑 När STOPP (fråga människan)

- Destruktiva ändringar i `prisma/schema.prisma` (drop column/table, rename, type change)
- Ändringar i Stripe webhook flow
- Ändringar i Supabase auth flow (konfiguration, RLS major changes)
- Nya env var nödvändiga i produktion
- Nya npm-dependencies inte strikt nödvändiga
- Ändringar som kräver Vercel config update
- Refactor av moduler utöver det specifika taskets filer
- Arkitekturbeslut inte dokumenterade i roadmap (t.ex. "vi gör det här på ett annat sätt")
- Performance regression observerad efter tasket

## ✅ När GO (fråga inte)

- Bug fix i kod som rörts av tasket
- Tillägg av test för tasket
- MINDRE refactor inom taskets filer (byta namn på variabel, extrahera lokal funktion)
- Uppdatera README/AGENTS.md för att spegla tasket
- ADDITIVA migration (ny tabell, ny nullable kolumn eller med default)
- Lägga till lämpliga logger-statements
- Lägga till Sentry instrumentation

## 🧭 Roadmapens anda

Fyra principer som styr varje beslut:

1. **Lean over complete** — en implementation som fungerar för SMB idag är värd mer än en "perfekt" för enterprise om 6 månader.
2. **Type-safe over fast** — att fixa de 125+ `(db as any)` saktar ner en PR men förebygger 50 osynliga buggar.
3. **Test the path, not the line** — E2E av det kritiska flödet är värt 100 unit test av sällsynta edge cases.
4. **Document only what changes** — ingen uppdaterad dok = bug för nästa agent. Överdriven dok = ingen läser den.

---

**Tillbaka till kartan**: [README.md](README.md).
**Börja**: [01-fase-0-pulizia.md](01-fase-0-pulizia.md).
