# AEO Pulse

[![AEO Pulse](https://img.shields.io/badge/AEO%20Pulse-SaaS%20Platform-brightgreen)](https://aio-pulse.com)

**AI Visibility Index (AVI)** — Measure your brand's visibility across ChatGPT, Claude, Perplexity, Gemini, and Google AI Overviews.

- **Stack**: Next.js 14 (App Router), TypeScript (strict), Tailwind CSS v3, Prisma + Supabase Postgres, Stripe, Sentry, Vitest, Playwright, Upstash Redis
- **Version**: 2.0.0
- **Status**: Production-ready foundation → transitioning to **SMB/prosumer + enterprise-lite** ($49–499/mo SMB + custom mid-market deals up to ~€50k ARR)

---

## Quick Start

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev            # http://localhost:3000

# Quality gate (must pass before every commit)
pnpm type-check     # tsc --noEmit
pnpm lint
pnpm format         # Prettier
pnpm test           # Vitest unit + integration
pnpm test:e2e       # Playwright (run before PR, not before commit)

# Build for production
pnpm build
pnpm start          # production-mode locally
```

See [ENVIRONMENTS.md](ENVIRONMENTS.md) for environment variable configuration.

---

## Market & Geo Configuration (Sweden)

Visibility data must **represent the Swedish market**, otherwise the figures
in the reports do not reflect what a real user in Sweden sees. This is
enforced at three layers, all driven by a single source of truth:
[`src/lib/geo-config.ts`](src/lib/geo-config.ts).

| Layer                         | What it does                                                                                   | Default              |
| ----------------------------- | ---------------------------------------------------------------------------------------------- | -------------------- |
| **SERP / Google AI Overview** | DataForSEO `location_code` / `language_code` — provider geolocates server-side, IP-independent | Sweden `2752` / `sv` |
| **LLM prompts**               | Market context injected into the prompt (LLM APIs are global and ignore caller IP)             | "Sweden / Swedish"   |
| **Egress IP**                 | Vercel serverless region (for the few IP-geolocated paths)                                     | `arn1` (Stockholm)   |
| **Report**                    | Auto-generates a localized "Methodology & Limitations" section stating exactly the above       | en / it / sv         |

The declared methodology in every report is generated from the same config,
so it can never drift from actual behavior.

### ⚠️ Infrastructure prerequisites (account owner action)

These require **Pro plans** — to be activated by the account owner:

- **Vercel Pro/Enterprise** — region pinning to `arn1` (Stockholm) in
  [`vercel.json`](vercel.json) only takes effect on Pro+. On the Hobby plan
  the region is ignored and functions run from a default US region.
- **Supabase — EU region** — to avoid a Stockholm↔US round-trip on every
  query, the Supabase project should be in an EU region (ideally
  `eu-north-1`, Stockholm). If the current project is in the US, either
  migrate it or rely on the SERP/LLM layers alone (those already return
  Swedish data regardless of egress IP).

### Overriding the market (env vars, optional)

To target a different market without code changes, set any of:

| Variable                                  | Default                    | Purpose                                 |
| ----------------------------------------- | -------------------------- | --------------------------------------- |
| `AIO_MARKET_NAME`                         | `Sweden`                   | Market name shown in report methodology |
| `AIO_LANGUAGE_NAME` / `AIO_LANGUAGE_CODE` | `Swedish` / `sv`           | LLM prompt localization                 |
| `DATAFORSEO_LOCATION_CODE`                | `2752`                     | DataForSEO geo target (2840 = USA)      |
| `DATAFORSEO_LANGUAGE_CODE`                | `sv`                       | DataForSEO language                     |
| `AIO_COLLECTION_REGION`                   | `Stockholm, Sweden (arn1)` | Region string shown in methodology      |

---

## Documentation

| Document                                                                                                           | Description                                                                            |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| [AGENTS.md](AGENTS.md)                                                                                             | Instructions for coding agents (Cursor / Claude Code / others) — **read this first**   |
| [docs/enterprise-roadmap/README.md](docs/enterprise-roadmap/README.md)                                             | Full roadmap: 4 phases, 18 tasks, 10-14 week timeline                                  |
| [docs/enterprise-roadmap/00-mission-scope-rules.md](docs/enterprise-roadmap/00-mission-scope-rules.md)             | Mission, scope (IN/OUT), coding standards, definition of done                          |
| [docs/enterprise-roadmap/01-fase-0-pulizia.md](docs/enterprise-roadmap/01-fase-0-pulizia.md)                       | Phase 0: Technical cleanup (T01-T06)                                                   |
| [docs/enterprise-roadmap/02-fase-1-workspace-audit.md](docs/enterprise-roadmap/02-fase-1-workspace-audit.md)       | Phase 1: Workspace + Audit + API Keys (T07-T09)                                        |
| [docs/enterprise-roadmap/03-fase-2-trust-gdpr.md](docs/enterprise-roadmap/03-fase-2-trust-gdpr.md)                 | Phase 2: SSO, MFA, Trust Center, GDPR (T10-T14)                                        |
| [docs/enterprise-roadmap/04-fase-3-billing-onboarding.md](docs/enterprise-roadmap/04-fase-3-billing-onboarding.md) | Phase 3: Billing, Onboarding, API Docs (T15-T18)                                       |
| [docs/enterprise-roadmap/task-tracker.md](docs/enterprise-roadmap/task-tracker.md)                                 | Live Kanban board for all 18 tasks                                                     |
| [BILLING_SETUP.md](BILLING_SETUP.md)                                                                               | Stripe configuration (test + live)                                                     |
| [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)                                                                         | Vercel deployment procedures                                                           |
| [SECURITY.md](SECURITY.md)                                                                                         | Security baseline                                                                      |

---

## Architecture

```
Client (Next.js 14 App Router)
  ├── Server Components (React 19)
  ├── API Routes → Route Handlers
  │     ├── src/app/api/*/route.ts     (HTTP layer, Zod validation)
  │     └── src/lib/services/*.ts      (business logic, pure functions)
  ├── Prisma ORM → Supabase Postgres
  ├── Upstash Redis (caching, rate limiting)
  ├── Stripe (subscriptions + invoicing)
  ├── Sentry (error tracking)
  └── LLM clients (OpenAI, Anthropic, Google, Perplexity)
```

### Multi-Tenant Hierarchy

```
Organization → Workspace → Brand → User (role)
```

---

## Coding Standards (5 non-negotiable rules)

1. **Type safety**: Zero `(db as any)` or `as any`. Use `// @ts-expect-error` with explicit comment if unavoidable.
2. **No console.log in production**: Use structured `logger` from `src/lib/logger.ts`.
3. **Never log PII or secrets**: Email, IP, JWT, API keys, passwords masked automatically.
4. **Schema changes via migration**: `prisma migrate dev --name <kebab-case>`. Forward-only in production.
5. **Tests required**: New API endpoint = Vitest test + integration test. New user workflow = Playwright E2E.

See [00-mission-scope-rules.md](docs/enterprise-roadmap/00-mission-scope-rules.md) for full conventions.

---

## What's Out of Scope

| ❌                           | Reason                                                 |
| ---------------------------- | ------------------------------------------------------ |
| SAML 2.0 SSO                 | Google + Microsoft OAuth sufficient for target segment |
| SCIM 2.0 provisioning        | Not needed at current scale                            |
| SOC 2 / ISO 27001 / pen test | Cost-prohibitive for this phase                        |
| Multi-region active-active   | Single-region is acceptable                            |
| Procurement integrations     | No Coupa/Ariba/SAP/ServiceNow                          |
| BYOK encryption at rest      | Not in budget                                          |
| HIPAA / FedRAMP              | Out of scope                                           |
| SLA-grade status page        | Lightweight status page only                           |
| VPC peering / IP allowlist   | Enterprise-only feature                                |

---

## Roadmap Summary

| Phase                        | Duration  | Key Deliverables                                                      |
| ---------------------------- | --------- | --------------------------------------------------------------------- |
| **0 — Technical Cleanup**    | 3-4 weeks | Fix all S1/S2 issues, type-safe codebase, structured logging, Sentry  |
| **1 — Workspace & Audit**    | 3-4 weeks | Org/Workspace migration, audit log, scoped API keys                   |
| **2 — Trust & GDPR**         | 2-3 weeks | SSO (Google/MS), MFA/TOTP, Trust Center, GDPR self-serve, status page |
| **3 — Billing & Onboarding** | 2-3 weeks | Seat-based billing, onboarding wizard (<10 min), API docs + SDK       |
| **Buffer**                   | 1-2 weeks | Bug fixes, customer feedback, polish                                  |

---

## Contributing

1. Read [AGENTS.md](AGENTS.md) for the complete workflow
2. Open [task-tracker.md](docs/enterprise-roadmap/task-tracker.md) and pick a **Ready** task
3. Create branch: `git checkout -b fase-N/<task-id>-<slug>`
4. Implement following coding standards
5. Run `pnpm type-check && pnpm lint && pnpm test`
6. Open PR with DoD checklist from task doc

---

## License

Proprietary — AEO Pulse SaaS. All rights reserved.
