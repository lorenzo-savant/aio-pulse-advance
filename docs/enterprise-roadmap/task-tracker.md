# Task Tracker — Enterprise Roadmap

> Live-vy av alla 18 task. Uppdatera denna fil varje gång ett task ändrar status.

**Statuskonvention**:
- 🟡 `Ready` — förutsättningar klara, owner ledig
- 🔵 `In Progress` — någon arbetar med det
- 🟣 `In Review` — PR öppen, väntar på merge
- 🟢 `Done` — merged i main + deployed
- ⚫ `Blocked` — väntar på beslut/extern resurs

---

## 📊 Statussammanfattning

| Fase | Done | Scaffolding done (user verify) | Ready | Blocked |
|---|---|---|---|---|---|
| Fase 0 | 5/6 | 0 | 0 | 1 (T04 waits Sentry DSN user-provision) |
| Fase 1 | 0/3 | 3 (T07.1/T08/T09 schema+lib) | 0 | 3 (waiting Supabase access) |
| Fase 2 | 0/5 | 0 | 0 | 5 (waiting Fase 1) |
| Fase 3 | 0/4 | 0 | 0 | 4 (waiting Fase 1) |
| **Total** | **5/18** | **3** | **0** | **13** |

---

## 🟡 Fas 0 — Teknisk uppstädning (Ready, kan starta idag)

| ID | Title | Status | Owner | Branch | PR | Updated |
|---|---|---|---|---|---|---|
| T01 | Fix imports + type bypass in `onboarding/route.ts` (S1) | 🟢 Done | — | — | — | 2026-05-14 |
| T02 | Generate strong Supabase types + refactor `supabase.ts` (S1) | 🟢 Done | agent | fase-0/T02-T06-residual-cleanup | — | 2026-05-14 |
| T03 | Kill `(db as any)` across API routes (S2) — 14 instances fixed | 🟢 Done | agent | fase-0/T02-T06-residual-cleanup | — | 2026-05-14 |
| T04 | Structured logger: pino setup + PII masking + Sentry forward | ⚫ Blocked (no Sentry DSN) | — | — | — | 2026-05-14 |
| T05 | Replace console.* with logger | 🟢 Done | agent | fase-0/T02-T06-residual-cleanup | — | 2026-05-14 |
| T06 | CI gate: type-check + lint + test in pre-commit + PR | 🟢 Done | agent | fase-0/T02-T06-residual-cleanup | — | 2026-05-14 |

Detalj: [01-fase-0-pulizia.md](01-fase-0-pulizia.md)

---

## 🔵 Fas 1 — Workspace + Audit + Scoped Keys

| ID | Title | Status | Owner | Branch | PR | Updated |
|---|---|---|---|---|---|---|
| T07 | Re-introduce Organization → Workspace → Brand hierarchy | 🔵 PR 7.1 done (additive schema + types + migration SQL). PR 7.2-7.7 pending DB access | Claude | fase-0/T02-T06-residual-cleanup | — | 2026-05-13 |
| T08 | Audit log table + instrumentation azioni critical | 🔵 schema + `logAudit()` helper landed. Instrumentation pending Fase 1.x | Claude | fase-0/T02-T06-residual-cleanup | — | 2026-05-13 |
| T09 | Scoped API keys con permission model | 🔵 schema + `verifyApiKey()` helper landed. UI + endpoint integration pending | Claude | fase-0/T02-T06-residual-cleanup | — | 2026-05-13 |

Detalj: [02-fase-1-workspace-audit.md](02-fase-1-workspace-audit.md)

**Anteckning T07**: uppdelad i 7 sub-PR (7.1–7.7). PR 7.1 ✅ — additive schema only.
Migration SQL ready at `prisma/migrations/20260513120000_fase1_workspace_audit_apikeys/migration.sql`
but **not applied** (Supabase project npxfqsbslhnkoxgqosyy unreachable). Apply when DB access restored.

---

## ⚫ Fas 2 — SSO + MFA + Trust + GDPR (väntar på Fas 1)

| ID | Title | Status | Owner | Branch | PR | Updated |
|---|---|---|---|---|---|---|
| T10 | SSO Google + Microsoft OAuth | ⚫ Blocked by T07 | — | — | — | 2026-05-13 |
| T11 | MFA TOTP opzionale + enforceable per workspace admin | ⚫ Blocked by T07 | — | — | — | 2026-05-13 |
| T12 | Trust Center page + DPA + sub-processor list | ⚫ Blocked by — (può iniziare in parallelo con Fase 1) | — | — | — | 2026-05-13 |
| T13 | Status page basic (Instatus) + monitoring config | ⚫ Blocked by — (può iniziare in parallelo con Fase 1) | — | — | — | 2026-05-13 |
| T14 | GDPR essentials: data export + deletion self-serve | ⚫ Blocked by T07, T08 | — | — | — | 2026-05-13 |

Detalj: [03-fase-2-trust-gdpr.md](03-fase-2-trust-gdpr.md)

**Anteckning**: T12 (Trust Center) och T13 (Status page) **kan starta parallellt med Fas 1** — ingen teknisk dependency. Bra task för onboarding av ny team member.

---

## ⚫ Fas 3 — Seat billing + Onboarding + API docs (väntar på Fas 1)

| ID | Title | Status | Owner | Branch | PR | Updated |
|---|---|---|---|---|---|---|
| T15 | Seat-based billing via Stripe | ⚫ Blocked by T07 | — | — | — | 2026-05-13 |
| T16 | Manual invoicing per custom plan | ⚫ Blocked by T15 | — | — | — | 2026-05-13 |
| T17 | Onboarding wizard self-serve | ⚫ Blocked by T07 | — | — | — | 2026-05-13 |
| T18 | API docs complete + SDK starter | ⚫ Blocked by T09 | — | — | — | 2026-05-13 |

Detalj: [04-fase-3-billing-onboarding.md](04-fase-3-billing-onboarding.md)

---

## 📝 Hur man använder denna tracker

### När du börjar ett task

1. Plocka task med status 🟡 `Ready`
2. Uppdatera raden: status → 🔵 `In Progress`, Owner → ditt namn/handle, Branch → branch-namn, Updated → idag
3. Committa ändringar i `task-tracker.md` som **första commit** i din branch:
   ```bash
   git checkout -b fase-0/T01-fix-onboarding-imports
   # edit task-tracker.md
   git add docs/enterprise-roadmap/task-tracker.md
   git commit -m "chore: claim T01"
   git push -u origin fase-0/T01-fix-onboarding-imports
   ```

### När du öppnar PR

1. Uppdatera raden: status → 🟣 `In Review`, PR → PR-nummer
2. Commit + push

### När du mergar

1. Uppdatera raden: status → 🟢 `Done`, Updated → idag
2. Uppdatera sammanfattningen "Statussammanfattning" högst upp
3. Om du låser upp andra task: ändra deras status från ⚫ `Blocked` → 🟡 `Ready`
4. Committa direkt på `main` (eller i efterföljande PR, men för tydlighet hellre inline)

### När du blir blockerad

1. Uppdatera raden: status → ⚫ `Blocked`, Owner → behåll, lägg till kommentar "Blocked because X"
2. Öppna GitHub-issue med label `roadmap-blocked` för extern spårning
3. Notifiera founder

---

## 🎯 Kritiska beslut att fatta (founder)

Innan vissa task påbörjas måste founder besluta:

### För T07 (Workspace migration)
- [ ] När göra produktionsmigrationen? Föreslaget: helg, maintenance window 30 min, notifiera användare 48h innan.
- [ ] Vilken retention för data dump backup target? Föreslaget: 30 dagar för rollback.

### För T12 (Trust Center)
- [ ] Vilken legal counsel för review av DPA? Uppskattad kostnad 500-1500 EUR (1-2h).
- [ ] Utsedd DPO — vem är det? Kan vara founder om litet team, men mer formellt = bättre signal.

### För T15 (Seat billing)
- [ ] **Pricing model** bekräftad? De 4 föreslagna tiers (Starter/Pro/Agency/Custom) och de föreslagna priserna ska valideras med founder + minimal market research.
- [ ] Migration av befintliga subscriber: stannar i nuvarande plan eller tvingad upgrade?

### För T17 (Onboarding)
- [ ] Industry buckets täckta av mappningen "suggested prompts": vilken prioritet? Casting (för Acasting), marketing-SaaS, e-commerce, B2B-SaaS, agency? 5 buckets minimum, 15 idealt.

---

## 📅 Milestone-måldatum (att finslipa med team)

| Milestone | Target date | Status |
|---|---|---|
| Fase 0 complete | TBD (~2026-06-15) | Not started |
| Fase 1 complete (T07-T09 merged) | TBD (~2026-07-15) | Not started |
| Fase 2 complete (T10-T14 merged) | TBD (~2026-08-05) | Not started |
| Fase 3 complete (T15-T18 merged) | TBD (~2026-08-10) | Not started |
| **Production-ready SMB launch** | **TBD (~2026-08-15)** | Not started |
| First commercial customer onboarded (Acasting) | TBD | Not started |

---

## 🔗 Cross-reference

- [AGENTS.md](../../AGENTS.md) — universella instruktioner för agent
- [README.md](README.md) — overview roadmap
- [00-mission-scope-rules.md](00-mission-scope-rules.md) — DO / DON'T / coding standards
- [Fase 0 dettaglio](01-fase-0-pulizia.md)
- [Fase 1 dettaglio](02-fase-1-workspace-audit.md)
- [Fase 2 dettaglio](03-fase-2-trust-gdpr.md)
- [Fase 3 dettaglio](04-fase-3-billing-onboarding.md)

---

**Last updated**: 2026-05-14 — Fas 0 komplett (T02, T03, T05, T06 Done, T04 blocked på Sentry DSN). Fas 1 upplåst.
