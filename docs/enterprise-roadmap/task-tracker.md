# Task Tracker — Enterprise Roadmap

> Live view di tutti i 18 task. Update questa file ogni volta che task cambia stato.

**Convenzione stato**:
- 🟡 `Ready` — prerequisiti completi, owner libero
- 🔵 `In Progress` — qualcuno ci lavora
- 🟣 `In Review` — PR aperta, attende merge
- 🟢 `Done` — merged in main + deployed
- ⚫ `Blocked` — attesa decisione/risorsa esterna

---

## 📊 Status sommario

| Fase | Done | Scaffolding done (user verify) | Ready | Blocked |
|---|---|---|---|---|---|
| Fase 0 | 5/6 | 0 | 0 | 1 (T04 waits Sentry DSN user-provision) |
| Fase 1 | 0/3 | 3 (T07.1/T08/T09 schema+lib) | 0 | 3 (waiting Supabase access) |
| Fase 2 | 0/5 | 0 | 0 | 5 (waiting Fase 1) |
| Fase 3 | 0/4 | 0 | 0 | 4 (waiting Fase 1) |
| **Total** | **5/18** | **3** | **0** | **13** |

---

## 🟡 Fase 0 — Pulizia tecnica (Ready, può iniziare oggi)

| ID | Title | Status | Owner | Branch | PR | Updated |
|---|---|---|---|---|---|---|
| T01 | Fix imports + type bypass in `onboarding/route.ts` (S1) | 🟢 Done | — | — | — | 2026-05-14 |
| T02 | Generate strong Supabase types + refactor `supabase.ts` (S1) | 🟢 Done | OpenCode | fase-0/T02-T06-residual-cleanup | — | 2026-05-14 |
| T03 | Kill `(db as any)` across API routes (S2) — 14 instances fixed | 🟢 Done | OpenCode | fase-0/T02-T06-residual-cleanup | — | 2026-05-14 |
| T04 | Structured logger: pino setup + PII masking + Sentry forward | ⚫ Blocked (no Sentry DSN) | — | — | — | 2026-05-14 |
| T05 | Replace console.* with logger | 🟢 Done | OpenCode | fase-0/T02-T06-residual-cleanup | — | 2026-05-14 |
| T06 | CI gate: type-check + lint + test in pre-commit + PR | 🟢 Done | OpenCode | fase-0/T02-T06-residual-cleanup | — | 2026-05-14 |

Dettaglio: [01-fase-0-pulizia.md](01-fase-0-pulizia.md)

---

## 🔵 Fase 1 — Workspace + Audit + Scoped Keys

| ID | Title | Status | Owner | Branch | PR | Updated |
|---|---|---|---|---|---|---|
| T07 | Re-introduce Organization → Workspace → Brand hierarchy | 🔵 PR 7.1 done (additive schema + types + migration SQL). PR 7.2-7.7 pending DB access | Claude | fase-0/T02-T06-residual-cleanup | — | 2026-05-13 |
| T08 | Audit log table + instrumentation azioni critical | 🔵 schema + `logAudit()` helper landed. Instrumentation pending Fase 1.x | Claude | fase-0/T02-T06-residual-cleanup | — | 2026-05-13 |
| T09 | Scoped API keys con permission model | 🔵 schema + `verifyApiKey()` helper landed. UI + endpoint integration pending | Claude | fase-0/T02-T06-residual-cleanup | — | 2026-05-13 |

Dettaglio: [02-fase-1-workspace-audit.md](02-fase-1-workspace-audit.md)

**Note T07**: spezzato in 7 sub-PR (7.1–7.7). PR 7.1 ✅ — additive schema only.
Migration SQL ready at `prisma/migrations/20260513120000_fase1_workspace_audit_apikeys/migration.sql`
but **not applied** (Supabase project npxfqsbslhnkoxgqosyy unreachable). Apply when DB access restored.

---

## ⚫ Fase 2 — SSO + MFA + Trust + GDPR (waiting Fase 1)

| ID | Title | Status | Owner | Branch | PR | Updated |
|---|---|---|---|---|---|---|
| T10 | SSO Google + Microsoft OAuth | ⚫ Blocked by T07 | — | — | — | 2026-05-13 |
| T11 | MFA TOTP opzionale + enforceable per workspace admin | ⚫ Blocked by T07 | — | — | — | 2026-05-13 |
| T12 | Trust Center page + DPA + sub-processor list | ⚫ Blocked by — (può iniziare in parallelo con Fase 1) | — | — | — | 2026-05-13 |
| T13 | Status page basic (Instatus) + monitoring config | ⚫ Blocked by — (può iniziare in parallelo con Fase 1) | — | — | — | 2026-05-13 |
| T14 | GDPR essentials: data export + deletion self-serve | ⚫ Blocked by T07, T08 | — | — | — | 2026-05-13 |

Dettaglio: [03-fase-2-trust-gdpr.md](03-fase-2-trust-gdpr.md)

**Note**: T12 (Trust Center) e T13 (Status page) **possono iniziare in parallelo con Fase 1** — nessuna dipendenza tecnica. Buona task per onboarding nuovo team member.

---

## ⚫ Fase 3 — Seat billing + Onboarding + API docs (waiting Fase 1)

| ID | Title | Status | Owner | Branch | PR | Updated |
|---|---|---|---|---|---|---|
| T15 | Seat-based billing via Stripe | ⚫ Blocked by T07 | — | — | — | 2026-05-13 |
| T16 | Manual invoicing per custom plan | ⚫ Blocked by T15 | — | — | — | 2026-05-13 |
| T17 | Onboarding wizard self-serve | ⚫ Blocked by T07 | — | — | — | 2026-05-13 |
| T18 | API docs complete + SDK starter | ⚫ Blocked by T09 | — | — | — | 2026-05-13 |

Dettaglio: [04-fase-3-billing-onboarding.md](04-fase-3-billing-onboarding.md)

---

## 📝 Come usare questo tracker

### Quando inizi un task

1. Pesca task con status 🟡 `Ready`
2. Update riga: status → 🔵 `In Progress`, Owner → tuo nome/handle, Branch → nome branch, Updated → oggi
3. Commit changes a `task-tracker.md` come **primo commit** del tuo branch:
   ```bash
   git checkout -b fase-0/T01-fix-onboarding-imports
   # edit task-tracker.md
   git add docs/enterprise-roadmap/task-tracker.md
   git commit -m "chore: claim T01"
   git push -u origin fase-0/T01-fix-onboarding-imports
   ```

### Quando apri PR

1. Update riga: status → 🟣 `In Review`, PR → numero PR
2. Commit + push

### Quando merge

1. Update riga: status → 🟢 `Done`, Updated → oggi
2. Update sommario "Status sommario" in cima
3. Se sblocchi altri task: cambia loro status da ⚫ `Blocked` → 🟡 `Ready`
4. Commit direttamente su `main` (oppure in PR successiva, ma per chiarezza meglio inline)

### Quando ti blocchi

1. Update riga: status → ⚫ `Blocked`, Owner → mantieni, aggiungi commento "Blocked because X"
2. Apri issue GitHub con label `roadmap-blocked` per traccia esterna
3. Notifica founder

---

## 🎯 Decisioni critiche da prendere (founder)

Prima di iniziare alcuni task, founder deve decidere:

### Per T07 (Workspace migration)
- [ ] Quando fare la migration di produzione? Suggerito: weekend, maintenance window 30 min, notifica utenti 48h prima.
- [ ] Quale data dump backup target retention? Suggerito: 30 giorni per rollback.

### Per T12 (Trust Center)
- [ ] Quale legal counsel per review DPA? Costo stimato 500-1500 EUR (1-2h).
- [ ] DPO designato — chi è? Può essere founder se piccolo team, ma più formale = better signal.

### Per T15 (Seat billing)
- [ ] **Pricing model** confermato? Le 4 tier proposte (Starter/Pro/Agency/Custom) e i prezzi suggeriti vanno validati con founder + market research minima.
- [ ] Migration esistenti subscriber: rimangono nel piano attuale o forzato upgrade?

### Per T17 (Onboarding)
- [ ] Industry buckets coperti dal mapping "suggested prompts": quale priorità? Casting (per Acasting), marketing-SaaS, e-commerce, B2B-SaaS, agency? 5 buckets minimum, 15 ideale.

---

## 📅 Milestone date target (da rifinire con team)

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

- [AGENTS.md](../../AGENTS.md) — istruzioni universali per agent
- [README.md](README.md) — overview roadmap
- [00-mission-scope-rules.md](00-mission-scope-rules.md) — DO / DON'T / coding standards
- [Fase 0 dettaglio](01-fase-0-pulizia.md)
- [Fase 1 dettaglio](02-fase-1-workspace-audit.md)
- [Fase 2 dettaglio](03-fase-2-trust-gdpr.md)
- [Fase 3 dettaglio](04-fase-3-billing-onboarding.md)

---

**Last updated**: 2026-05-14 — Fase 0 completa (T02, T03, T05, T06 Done, T04 blocked su Sentry DSN). Fase 1 sbloccata.


